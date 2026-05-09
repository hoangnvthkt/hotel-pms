-- Harden folio/payment invariants and in-house room changes.

create index if not exists folio_items_folio_business_date_idx
  on public.folio_items (folio_id, business_date, source_type);

create index if not exists payments_folio_received_at_idx
  on public.payments (folio_id, received_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'folio_items_amount_positive'
  ) then
    alter table public.folio_items
      add constraint folio_items_amount_positive
      check (amount > 0) not valid;
  end if;
end $$;

create or replace function private.assert_folio_item_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_folio_property uuid;
begin
  select property_id into v_folio_property
  from public.folios
  where id = new.folio_id;

  if v_folio_property is distinct from new.property_id then
    raise exception 'Folio item property must match folio';
  end if;

  if new.amount <= 0 then
    raise exception 'Folio item amount must be positive';
  end if;

  return new;
end;
$$;

create or replace function private.assert_payment_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_folio_property uuid;
begin
  select property_id into v_folio_property
  from public.folios
  where id = new.folio_id;

  if v_folio_property is distinct from new.property_id then
    raise exception 'Payment property must match folio';
  end if;

  return new;
end;
$$;

create or replace function private.assert_invoice_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_folio_property uuid;
begin
  select property_id into v_folio_property
  from public.folios
  where id = new.folio_id;

  if v_folio_property is distinct from new.property_id then
    raise exception 'Invoice property must match folio';
  end if;

  return new;
end;
$$;

create or replace function private.assert_refund_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_folio_property uuid;
  v_payment_property uuid;
begin
  select property_id into v_folio_property
  from public.folios
  where id = new.folio_id;

  if v_folio_property is distinct from new.property_id then
    raise exception 'Refund property must match folio';
  end if;

  if new.payment_id is not null then
    select property_id into v_payment_property
    from public.payments
    where id = new.payment_id;

    if v_payment_property is distinct from new.property_id then
      raise exception 'Refund property must match payment';
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'folio_items_same_property_trg') then
    create trigger folio_items_same_property_trg
      before insert or update of property_id, folio_id, amount on public.folio_items
      for each row execute function private.assert_folio_item_same_property();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'payments_same_property_trg') then
    create trigger payments_same_property_trg
      before insert or update of property_id, folio_id on public.payments
      for each row execute function private.assert_payment_same_property();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'invoices_same_property_trg') then
    create trigger invoices_same_property_trg
      before insert or update of property_id, folio_id on public.invoices
      for each row execute function private.assert_invoice_same_property();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'refunds_same_property_trg') then
    create trigger refunds_same_property_trg
      before insert or update of property_id, folio_id, payment_id on public.refunds
      for each row execute function private.assert_refund_same_property();
  end if;
end $$;

create or replace function private.create_payment_credit_item()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status in ('posted', 'finalized') then
    insert into public.folio_items (
      property_id,
      folio_id,
      type,
      source_type,
      description,
      quantity,
      unit_price,
      amount,
      business_date,
      posted_by
    )
    values (
      new.property_id,
      new.folio_id,
      'credit',
      'payment',
      'Thanh toán ' || new.method::text,
      1,
      new.amount,
      new.amount,
      (new.received_at at time zone 'Asia/Ho_Chi_Minh')::date,
      new.received_by
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'payments_create_credit_item_trg') then
    create trigger payments_create_credit_item_trg
      after insert on public.payments
      for each row execute function private.create_payment_credit_item();
  end if;
end $$;

create or replace function private.prevent_unauthorized_finalized_payment_update()
returns trigger
language plpgsql
security invoker
as $$
begin
  if old.status = 'finalized'
     and not private.has_any_role(array['admin','accountant']::public.pms_role[]) then
    raise exception 'Only accountant/admin can update finalized payments';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'payments_finalized_guard_trg') then
    create trigger payments_finalized_guard_trg
      before update on public.payments
      for each row execute function private.prevent_unauthorized_finalized_payment_update();
  end if;
end $$;

create or replace function public.fn_add_folio_charge(
  p_folio_id uuid,
  p_source_type public.folio_item_source_type,
  p_description text,
  p_amount numeric
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_folio record;
  v_item_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Charge amount must be positive';
  end if;

  if p_source_type in ('payment', 'deposit', 'refund') then
    raise exception 'Use payment/deposit/refund flows for credit source types';
  end if;

  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to add folio charges';
  end if;

  select * into v_folio
  from public.folios
  where id = p_folio_id
    and property_id = private.current_property_id()
    and status = 'open'
  for update;

  if not found then
    raise exception 'Open folio not found';
  end if;

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
    v_folio.property_id,
    p_folio_id,
    'debit',
    p_source_type,
    p_description,
    1,
    p_amount,
    p_amount,
    auth.uid()
  )
  returning id into v_item_id;

  return v_item_id;
end;
$$;

create or replace function public.fn_record_payment(
  p_folio_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_reference text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_folio record;
  v_payment_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;

  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to record payments';
  end if;

  select * into v_folio
  from public.folios
  where id = p_folio_id
    and property_id = private.current_property_id()
    and status = 'open'
  for update;

  if not found then
    raise exception 'Open folio not found';
  end if;

  insert into public.payments (
    property_id,
    folio_id,
    method,
    amount,
    reference,
    received_by
  )
  values (
    v_folio.property_id,
    p_folio_id,
    p_method,
    p_amount,
    p_reference,
    auth.uid()
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

create or replace function public.fn_calculate_folio_balance(p_folio_id uuid)
returns numeric
language sql
stable
security invoker
as $$
  select coalesce(sum(case when type = 'debit' then amount else -amount end), 0)
  from public.folio_items
  where folio_id = p_folio_id
$$;

create or replace function public.fn_change_room(
  p_booking_id uuid,
  p_from_room_id uuid,
  p_to_room_id uuid,
  p_effective_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_booking record;
  v_from_room record;
  v_to_room record;
  v_new_assignment uuid;
begin
  if not private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to change room';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and property_id = private.current_property_id()
    and status = 'checked_in'
  for update;

  if not found then
    raise exception 'Checked-in booking not found';
  end if;

  select * into v_from_room
  from public.rooms
  where id = p_from_room_id
    and property_id = v_booking.property_id
  for update;

  if not found then
    raise exception 'Source room not found';
  end if;

  select * into v_to_room
  from public.rooms
  where id = p_to_room_id
    and property_id = v_booking.property_id
  for update;

  if not found then
    raise exception 'Target room not found';
  end if;

  if v_to_room.status <> 'vacant_clean' and not private.has_any_role(array['admin','manager']::public.pms_role[]) then
    raise exception 'Target room must be vacant_clean';
  end if;

  if exists (
    select 1
    from public.booking_rooms br
    where br.room_id = p_to_room_id
      and br.booking_id <> p_booking_id
      and br.status in ('tentative', 'confirmed', 'checked_in')
      and tstzrange(br.check_in, br.check_out, '[)') && tstzrange(p_effective_at, v_booking.check_out, '[)')
  ) then
    raise exception 'Target room is not available';
  end if;

  update public.booking_rooms
  set status = 'checked_out',
      check_out = p_effective_at
  where booking_id = p_booking_id
    and room_id = p_from_room_id
    and status = 'checked_in';

  if not found then
    raise exception 'Active source room assignment not found';
  end if;

  insert into public.booking_rooms (
    property_id,
    booking_id,
    room_id,
    check_in,
    check_out,
    status
  )
  values (
    v_booking.property_id,
    p_booking_id,
    p_to_room_id,
    p_effective_at,
    v_booking.check_out,
    'checked_in'
  )
  returning id into v_new_assignment;

  update public.rooms set status = 'vacant_dirty' where id = p_from_room_id;
  update public.rooms set status = 'occupied' where id = p_to_room_id;

  insert into public.room_status_history (property_id, room_id, from_status, to_status, reason, changed_by)
  values
    (v_booking.property_id, p_from_room_id, v_from_room.status, 'vacant_dirty', 'room_change_from', auth.uid()),
    (v_booking.property_id, p_to_room_id, v_to_room.status, 'occupied', 'room_change_to', auth.uid());

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    v_booking.property_id,
    auth.uid(),
    'booking',
    p_booking_id,
    'room_change',
    jsonb_build_object('room_id', p_from_room_id),
    jsonb_build_object('room_id', p_to_room_id, 'effective_at', p_effective_at)
  );

  return v_new_assignment;
end;
$$;
