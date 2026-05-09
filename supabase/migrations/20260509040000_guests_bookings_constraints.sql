-- Harden guest/booking consistency, C65 readiness, and cancellation behavior.

create index if not exists bookings_guest_status_idx
  on public.bookings (property_id, guest_id, status);

create index if not exists booking_rooms_active_room_range_idx
  on public.booking_rooms using gist (
    room_id,
    tstzrange(check_in, check_out, '[)')
  )
  where status in ('tentative', 'confirmed', 'checked_in');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'guests_c65_identity_ready'
  ) then
    alter table public.guests
      add constraint guests_c65_identity_ready
      check (
        length(trim(full_name)) > 0
        and length(trim(nationality)) > 0
        and length(trim(document_number)) > 0
        and document_issue_date is not null
        and length(trim(coalesce(document_issue_place, ''))) > 0
        and date_of_birth is not null
        and gender is not null
        and length(trim(coalesce(occupation, ''))) > 0
        and length(trim(coalesce(current_address, ''))) > 0
        and length(trim(coalesce(stay_purpose, ''))) > 0
      ) not valid;
  end if;
end $$;

create or replace function private.assert_guest_document_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_property_id uuid;
begin
  select property_id into v_property_id
  from public.guests
  where id = new.guest_id;

  if v_property_id is distinct from new.property_id then
    raise exception 'Guest document must belong to the same property as guest';
  end if;

  return new;
end;
$$;

create or replace function private.assert_booking_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_guest_property uuid;
begin
  select property_id into v_guest_property
  from public.guests
  where id = new.guest_id;

  if v_guest_property is distinct from new.property_id then
    raise exception 'Booking guest must belong to the same property';
  end if;

  return new;
end;
$$;

create or replace function private.assert_booking_room_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_booking_property uuid;
  v_room_property uuid;
begin
  select property_id into v_booking_property
  from public.bookings
  where id = new.booking_id;

  select property_id into v_room_property
  from public.rooms
  where id = new.room_id;

  if v_booking_property is distinct from new.property_id then
    raise exception 'Booking room property must match booking';
  end if;

  if v_room_property is distinct from new.property_id then
    raise exception 'Booking room property must match room';
  end if;

  return new;
end;
$$;

create or replace function private.assert_booking_child_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_booking_property uuid;
begin
  select property_id into v_booking_property
  from public.bookings
  where id = new.booking_id;

  if v_booking_property is distinct from new.property_id then
    raise exception 'Booking child row property must match booking';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'guest_documents_same_property_trg') then
    create trigger guest_documents_same_property_trg
      before insert or update of property_id, guest_id on public.guest_documents
      for each row execute function private.assert_guest_document_same_property();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'bookings_guest_same_property_trg') then
    create trigger bookings_guest_same_property_trg
      before insert or update of property_id, guest_id on public.bookings
      for each row execute function private.assert_booking_same_property();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'booking_rooms_same_property_trg') then
    create trigger booking_rooms_same_property_trg
      before insert or update of property_id, booking_id, room_id on public.booking_rooms
      for each row execute function private.assert_booking_room_same_property();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'booking_deposits_same_property_trg') then
    create trigger booking_deposits_same_property_trg
      before insert or update of property_id, booking_id on public.booking_deposits
      for each row execute function private.assert_booking_child_same_property();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'booking_notes_same_property_trg') then
    create trigger booking_notes_same_property_trg
      before insert or update of property_id, booking_id on public.booking_notes
      for each row execute function private.assert_booking_child_same_property();
  end if;
end $$;

create or replace function public.fn_create_booking(p_payload jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_property_id uuid := (p_payload->>'property_id')::uuid;
  v_guest_id uuid := (p_payload->>'guest_id')::uuid;
  v_room_id uuid := (p_payload->>'room_id')::uuid;
  v_check_in timestamptz := (p_payload->>'check_in')::timestamptz;
  v_check_out timestamptz := (p_payload->>'check_out')::timestamptz;
  v_status public.booking_status := coalesce((p_payload->>'status')::public.booking_status, 'tentative');
  v_booking_id uuid;
  v_booking_number text;
  v_room_type_id uuid;
begin
  if v_property_id is null or v_property_id <> private.current_property_id() then
    raise exception 'Invalid property';
  end if;

  if not private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to create bookings';
  end if;

  if v_status not in ('tentative', 'confirmed') then
    raise exception 'Bookings can only be created as tentative or confirmed';
  end if;

  if v_check_out <= v_check_in then
    raise exception 'Check-out must be after check-in';
  end if;

  select room_type_id into v_room_type_id
  from public.rooms
  where id = v_room_id
    and property_id = v_property_id;

  if v_room_type_id is null then
    raise exception 'Room not found';
  end if;

  if not exists (
    select 1
    from public.fn_check_availability(v_property_id, v_room_type_id, v_check_in, v_check_out)
    where id = v_room_id
  ) then
    raise exception 'Room is not available';
  end if;

  v_booking_number := 'BK-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.bookings (
    booking_number,
    property_id,
    guest_id,
    check_in,
    check_out,
    nights,
    adults,
    children,
    status,
    source,
    rate_code,
    rate_per_night,
    total_amount,
    deposit_amount,
    deposit_paid,
    external_reference,
    notes,
    created_by
  )
  values (
    v_booking_number,
    v_property_id,
    v_guest_id,
    v_check_in,
    v_check_out,
    greatest(1, ceil(extract(epoch from (v_check_out - v_check_in)) / 86400)::int),
    coalesce((p_payload->>'adults')::int, 1),
    coalesce((p_payload->>'children')::int, 0),
    v_status,
    coalesce((p_payload->>'source')::public.booking_source, 'direct'),
    coalesce(p_payload->>'rate_code', 'BAR'),
    coalesce((p_payload->>'rate_per_night')::numeric, 0),
    coalesce((p_payload->>'total_amount')::numeric, 0),
    coalesce((p_payload->>'deposit_amount')::numeric, 0),
    coalesce((p_payload->>'deposit_paid')::boolean, false),
    p_payload->>'external_reference',
    p_payload->>'notes',
    auth.uid()
  )
  returning id into v_booking_id;

  insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
  values (v_property_id, v_booking_id, v_room_id, v_check_in, v_check_out, v_status);

  return v_booking_id;
end;
$$;

create or replace function public.fn_cancel_booking(
  p_booking_id uuid,
  p_reason text default null,
  p_refund_policy text default 'manual'
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_booking record;
begin
  if not private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to cancel booking';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.status in ('checked_in', 'checked_out', 'cancelled') then
    raise exception 'Booking status % cannot be cancelled', v_booking.status;
  end if;

  update public.bookings
  set status = 'cancelled',
      notes = concat_ws(E'\n', notes, nullif('Cancel reason: ' || coalesce(p_reason, ''), 'Cancel reason: '))
  where id = p_booking_id;

  update public.booking_rooms
  set status = 'cancelled'
  where booking_id = p_booking_id
    and status in ('tentative', 'confirmed');

  insert into public.booking_notes (property_id, booking_id, note, created_by)
  values (
    v_booking.property_id,
    p_booking_id,
    'Cancelled. Refund policy: ' || coalesce(p_refund_policy, 'manual') ||
      coalesce('. Reason: ' || nullif(p_reason, ''), ''),
    auth.uid()
  );

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    v_booking.property_id,
    auth.uid(),
    'booking',
    p_booking_id,
    'cancel',
    jsonb_build_object('status', v_booking.status),
    jsonb_build_object('status', 'cancelled', 'refund_policy', p_refund_policy)
  );

  return p_booking_id;
end;
$$;

