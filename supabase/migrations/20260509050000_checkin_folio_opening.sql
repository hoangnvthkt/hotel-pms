-- Harden check-in as one transaction: booking, room, assignment, folio, deposit credit.

create unique index if not exists folios_one_master_per_booking_idx
  on public.folios (booking_id)
  where parent_folio_id is null;

create index if not exists folios_booking_master_status_idx
  on public.folios (booking_id, status)
  where parent_folio_id is null;

create or replace function private.assert_folio_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_booking_property uuid;
  v_parent_property uuid;
begin
  select property_id into v_booking_property
  from public.bookings
  where id = new.booking_id;

  if v_booking_property is distinct from new.property_id then
    raise exception 'Folio property must match booking';
  end if;

  if new.parent_folio_id is not null then
    select property_id into v_parent_property
    from public.folios
    where id = new.parent_folio_id;

    if v_parent_property is distinct from new.property_id then
      raise exception 'Sub-folio property must match parent folio';
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'folios_same_property_trg') then
    create trigger folios_same_property_trg
      before insert or update of property_id, booking_id, parent_folio_id on public.folios
      for each row execute function private.assert_folio_same_property();
  end if;
end $$;

create or replace function private.assert_guest_c65_ready(p_guest_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_missing text[];
begin
  select array_remove(array[
    case when length(trim(coalesce(full_name, ''))) = 0 then 'full_name' end,
    case when date_of_birth is null then 'date_of_birth' end,
    case when gender is null then 'gender' end,
    case when length(trim(coalesce(nationality, ''))) = 0 then 'nationality' end,
    case when length(trim(coalesce(document_number, ''))) = 0 then 'document_number' end,
    case when document_issue_date is null then 'document_issue_date' end,
    case when length(trim(coalesce(document_issue_place, ''))) = 0 then 'document_issue_place' end,
    case when length(trim(coalesce(occupation, ''))) = 0 then 'occupation' end,
    case when length(trim(coalesce(current_address, ''))) = 0 then 'current_address' end,
    case when length(trim(coalesce(stay_purpose, ''))) = 0 then 'stay_purpose' end
  ], null)
  into v_missing
  from public.guests
  where id = p_guest_id;

  if v_missing is null then
    raise exception 'Guest not found';
  end if;

  if array_length(v_missing, 1) > 0 then
    raise exception 'Guest C65 fields missing: %', array_to_string(v_missing, ', ');
  end if;
end;
$$;

create or replace function public.fn_check_in_booking(
  p_booking_id uuid,
  p_room_id uuid,
  p_payment jsonb default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_booking record;
  v_room record;
  v_assignment_id uuid;
  v_folio_id uuid;
  v_payment_amount numeric := coalesce((p_payment->>'amount')::numeric, 0);
begin
  if not private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to check in';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.status = 'checked_in' then
    select id into v_folio_id
    from public.folios
    where booking_id = p_booking_id
      and parent_folio_id is null
    limit 1;

    if v_folio_id is null then
      raise exception 'Checked-in booking has no master folio';
    end if;

    return v_folio_id;
  end if;

  if v_booking.status not in ('tentative', 'confirmed') then
    raise exception 'Booking status % cannot be checked in', v_booking.status;
  end if;

  perform private.assert_guest_c65_ready(v_booking.guest_id);

  select * into v_room
  from public.rooms
  where id = p_room_id
    and property_id = v_booking.property_id
  for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if v_room.status <> 'vacant_clean' and not private.has_any_role(array['admin','manager']::public.pms_role[]) then
    raise exception 'Room must be vacant_clean before check-in';
  end if;

  if v_room.status in ('out_of_order', 'blocked') and not private.has_any_role(array['admin','manager']::public.pms_role[]) then
    raise exception 'Only manager/admin can override blocked or out-of-order rooms';
  end if;

  if exists (
    select 1
    from public.booking_rooms br
    where br.room_id = p_room_id
      and br.booking_id <> p_booking_id
      and br.status in ('tentative', 'confirmed', 'checked_in')
      and tstzrange(br.check_in, br.check_out, '[)') && tstzrange(v_booking.check_in, v_booking.check_out, '[)')
  ) then
    raise exception 'Room is not available';
  end if;

  select id into v_assignment_id
  from public.booking_rooms
  where booking_id = p_booking_id
    and status in ('tentative', 'confirmed')
  order by created_at
  limit 1
  for update;

  if v_assignment_id is null then
    raise exception 'Booking has no active room assignment';
  end if;

  update public.bookings
  set status = 'checked_in'
  where id = p_booking_id;

  update public.booking_rooms
  set status = 'checked_in',
      room_id = p_room_id,
      check_in = v_booking.check_in,
      check_out = v_booking.check_out
  where id = v_assignment_id;

  update public.rooms
  set status = 'occupied'
  where id = p_room_id;

  insert into public.room_status_history (
    property_id,
    room_id,
    from_status,
    to_status,
    reason,
    changed_by
  )
  values (
    v_booking.property_id,
    p_room_id,
    v_room.status,
    'occupied',
    'check_in',
    auth.uid()
  );

  insert into public.folios (property_id, booking_id, folio_number)
  values (v_booking.property_id, p_booking_id, 'F-' || v_booking.booking_number)
  on conflict (booking_id) where parent_folio_id is null
  do update set booking_id = excluded.booking_id
  returning id into v_folio_id;

  if v_booking.deposit_paid and v_booking.deposit_amount > 0 and not exists (
    select 1
    from public.folio_items
    where folio_id = v_folio_id
      and source_type = 'deposit'
      and type = 'credit'
  ) then
    insert into public.folio_items (
      property_id,
      folio_id,
      type,
      source_type,
      description,
      quantity,
      unit_price,
      amount,
      posted_by
    )
    values (
      v_booking.property_id,
      v_folio_id,
      'credit',
      'deposit',
      'Deposit received before check-in',
      1,
      v_booking.deposit_amount,
      v_booking.deposit_amount,
      auth.uid()
    );
  end if;

  if p_payment is not null and v_payment_amount > 0 then
    perform public.fn_record_payment(
      v_folio_id,
      (p_payment->>'method')::public.payment_method,
      v_payment_amount,
      p_payment->>'reference'
    );
  end if;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_booking.property_id,
    auth.uid(),
    'booking',
    p_booking_id,
    'check_in',
    jsonb_build_object('room_id', p_room_id, 'folio_id', v_folio_id)
  );

  return v_folio_id;
end;
$$;

