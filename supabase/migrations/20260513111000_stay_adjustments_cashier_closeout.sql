-- Stay adjustment, room-charge reconciliation, and cashier shift closeout workflow.

create table if not exists public.booking_stay_adjustments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('early_checkout', 'extend_stay', 'date_change')),
  old_check_out timestamptz not null,
  new_check_out timestamptz not null,
  old_nights int not null check (old_nights > 0),
  new_nights int not null check (new_nights > 0),
  old_total_amount numeric(12,2) not null check (old_total_amount >= 0),
  new_total_amount numeric(12,2) not null check (new_total_amount >= 0),
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.booking_stay_adjustments enable row level security;

grant select, insert on public.booking_stay_adjustments to authenticated;

drop policy if exists "booking stay adjustments select" on public.booking_stay_adjustments;
create policy "booking stay adjustments select"
  on public.booking_stay_adjustments
  for select
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]))
  );

drop policy if exists "booking stay adjustments insert" on public.booking_stay_adjustments;
create policy "booking stay adjustments insert"
  on public.booking_stay_adjustments
  for insert
  to authenticated
  with check (
    property_id = (select private.current_property_id())
    and created_by = (select auth.uid())
    and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]))
  );

create index if not exists booking_stay_adjustments_booking_created_idx
  on public.booking_stay_adjustments (booking_id, created_at desc);

create unique index if not exists folio_items_unique_room_adjustment_source_idx
  on public.folio_items (folio_id, source_id)
  where source_type = 'room_adjustment' and source_id is not null;

create or replace function public.fn_adjust_booking_stay(
  p_booking_id uuid,
  p_new_check_out timestamptz,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_booking public.bookings%rowtype;
  v_assignment public.booking_rooms%rowtype;
  v_old_check_out timestamptz;
  v_old_nights int;
  v_new_nights int;
  v_old_total_amount numeric;
  v_new_total_amount numeric;
  v_service_total numeric := 0;
  v_adjustment_type text;
  v_adjustment_id uuid;
begin
  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to adjust booking stay';
  end if;

  if p_new_check_out is null then
    raise exception 'New checkout date is required';
  end if;

  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Stay adjustment reason is required';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and property_id = private.current_property_id()
    and status in ('tentative', 'confirmed', 'checked_in')
  for update;

  if not found then
    raise exception 'Active booking not found';
  end if;

  if p_new_check_out <= v_booking.check_in then
    raise exception 'New checkout must be after check-in';
  end if;

  select * into v_assignment
  from public.booking_rooms
  where booking_id = p_booking_id
    and status in ('checked_in', 'confirmed', 'tentative')
  order by case status when 'checked_in' then 1 when 'confirmed' then 2 else 3 end, check_in desc
  limit 1
  for update;

  if not found then
    raise exception 'Active room assignment not found';
  end if;

  if p_new_check_out = v_booking.check_out then
    return jsonb_build_object(
      'booking_id', p_booking_id,
      'adjusted', false,
      'check_out', v_booking.check_out,
      'nights', v_booking.nights,
      'total_amount', v_booking.total_amount
    );
  end if;

  if p_new_check_out > v_booking.check_out and exists (
    select 1
    from public.booking_rooms br
    where br.property_id = v_booking.property_id
      and br.room_id = v_assignment.room_id
      and br.id <> v_assignment.id
      and br.status in ('tentative', 'confirmed', 'checked_in')
      and tstzrange(br.check_in, br.check_out, '[)') && tstzrange(v_booking.check_in, p_new_check_out, '[)')
  ) then
    raise exception 'Room is not available for the extended stay';
  end if;

  v_old_check_out := v_booking.check_out;
  v_old_nights := v_booking.nights;
  v_old_total_amount := v_booking.total_amount;
  v_new_nights := greatest(
    ((p_new_check_out at time zone 'Asia/Ho_Chi_Minh')::date - (v_booking.check_in at time zone 'Asia/Ho_Chi_Minh')::date),
    1
  );

  select coalesce(sum(total_amount), 0)
  into v_service_total
  from public.booking_services
  where booking_id = p_booking_id
    and property_id = v_booking.property_id;

  v_new_total_amount := coalesce(v_booking.rate_per_night, 0) * v_new_nights + v_service_total;
  v_adjustment_type := case
    when p_new_check_out < v_booking.check_out then 'early_checkout'
    when p_new_check_out > v_booking.check_out then 'extend_stay'
    else 'date_change'
  end;

  update public.bookings
  set check_out = p_new_check_out,
      nights = v_new_nights,
      total_amount = v_new_total_amount
  where id = p_booking_id;

  update public.booking_rooms
  set check_out = p_new_check_out
  where id = v_assignment.id;

  insert into public.booking_stay_adjustments (
    property_id,
    booking_id,
    adjustment_type,
    old_check_out,
    new_check_out,
    old_nights,
    new_nights,
    old_total_amount,
    new_total_amount,
    reason,
    created_by
  )
  values (
    v_booking.property_id,
    p_booking_id,
    v_adjustment_type,
    v_old_check_out,
    p_new_check_out,
    v_old_nights,
    v_new_nights,
    v_old_total_amount,
    v_new_total_amount,
    trim(coalesce(p_reason, '')),
    auth.uid()
  )
  returning id into v_adjustment_id;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    v_booking.property_id,
    auth.uid(),
    'booking',
    p_booking_id,
    'adjust_stay',
    jsonb_build_object('check_out', v_old_check_out, 'nights', v_old_nights, 'total_amount', v_old_total_amount),
    jsonb_build_object('check_out', p_new_check_out, 'nights', v_new_nights, 'total_amount', v_new_total_amount, 'reason', p_reason, 'adjustment_type', v_adjustment_type)
  );

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'adjusted', true,
    'adjustment_id', v_adjustment_id,
    'adjustment_type', v_adjustment_type,
    'old_check_out', v_old_check_out,
    'new_check_out', p_new_check_out,
    'old_nights', v_old_nights,
    'new_nights', v_new_nights,
    'old_total_amount', v_old_total_amount,
    'new_total_amount', v_new_total_amount
  );
end;
$$;

create or replace function public.fn_folio_projection(p_folio_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, private
as $$
declare
  v_folio public.folios%rowtype;
  v_booking public.bookings%rowtype;
  v_expected_room_charges numeric := 0;
  v_posted_room_charges numeric := 0;
  v_room_adjustment_debits numeric := 0;
  v_room_adjustment_credits numeric := 0;
  v_room_balance numeric := 0;
  v_room_delta numeric := 0;
  v_service_charges numeric := 0;
  v_deposit_credits numeric := 0;
  v_payment_credits numeric := 0;
  v_pending_folio_payments numeric := 0;
  v_pending_deposits numeric := 0;
  v_pending_payments numeric := 0;
  v_posted_balance numeric := 0;
  v_projected_balance numeric := 0;
  v_room_nights int := 0;
begin
  select * into v_folio
  from public.folios
  where id = p_folio_id
    and property_id = private.current_property_id();

  if not found then
    raise exception 'Folio not found';
  end if;

  select * into v_booking
  from public.bookings
  where id = v_folio.booking_id
    and property_id = v_folio.property_id;

  if not found then
    raise exception 'Booking not found for folio';
  end if;

  v_room_nights := greatest(
    coalesce(v_booking.nights, (v_booking.check_out::date - v_booking.check_in::date), 0),
    0
  );
  v_expected_room_charges := coalesce(v_booking.rate_per_night, 0) * v_room_nights;

  select
    coalesce(sum(amount) filter (where type = 'debit' and source_type = 'room'), 0),
    coalesce(sum(amount) filter (where type = 'debit' and source_type = 'room_adjustment'), 0),
    coalesce(sum(amount) filter (where type = 'credit' and source_type = 'room_adjustment'), 0),
    coalesce(sum(amount) filter (where type = 'debit' and source_type not in ('room', 'room_adjustment')), 0),
    coalesce(sum(amount) filter (where type = 'credit' and source_type = 'deposit'), 0),
    coalesce(sum(amount) filter (where type = 'credit' and source_type = 'payment'), 0),
    coalesce(sum(case when type = 'debit' then amount else -amount end), 0)
  into
    v_posted_room_charges,
    v_room_adjustment_debits,
    v_room_adjustment_credits,
    v_service_charges,
    v_deposit_credits,
    v_payment_credits,
    v_posted_balance
  from public.folio_items
  where folio_id = p_folio_id;

  select coalesce(sum(amount), 0)
  into v_pending_folio_payments
  from public.payments
  where folio_id = p_folio_id
    and status = 'pending_verification';

  select coalesce(sum(amount), 0)
  into v_pending_deposits
  from public.booking_deposits
  where booking_id = v_folio.booking_id
    and property_id = v_folio.property_id
    and status = 'pending_verification';

  v_room_balance := v_posted_room_charges + v_room_adjustment_debits - v_room_adjustment_credits;
  v_room_delta := v_expected_room_charges - v_room_balance;
  v_pending_payments := v_pending_folio_payments + v_pending_deposits;
  v_projected_balance := v_posted_balance + v_room_delta;

  return jsonb_build_object(
    'folio_id', p_folio_id,
    'booking_id', v_folio.booking_id,
    'room_nights', v_room_nights,
    'rate_per_night', coalesce(v_booking.rate_per_night, 0),
    'posted_room_charges', v_posted_room_charges,
    'projected_room_charges', v_expected_room_charges,
    'room_adjustment_debits', v_room_adjustment_debits,
    'room_adjustment_credits', v_room_adjustment_credits,
    'room_balance', v_room_balance,
    'room_charge_to_post', greatest(v_room_delta, 0),
    'room_adjustment_to_credit', greatest(-v_room_delta, 0),
    'service_charges', v_service_charges,
    'deposit_credits', v_deposit_credits,
    'payment_credits', v_payment_credits,
    'pending_folio_payments', v_pending_folio_payments,
    'pending_deposits', v_pending_deposits,
    'pending_payments', v_pending_payments,
    'posted_balance', v_posted_balance,
    'projected_balance', v_projected_balance
  );
end;
$$;

create or replace function public.fn_post_room_charges_until_checkout(
  p_booking_id uuid,
  p_until_date date
)
returns int
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_booking public.bookings%rowtype;
  v_folio public.folios%rowtype;
  v_start_date date;
  v_booking_until_exclusive date;
  v_requested_until date;
  v_until_exclusive date;
  v_room_nights int;
  v_posted int := 0;
begin
  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to post room charges';
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

  select * into v_folio
  from public.folios
  where booking_id = p_booking_id
    and parent_folio_id is null
    and status = 'open'
  for update;

  if not found then
    raise exception 'Open master folio not found';
  end if;

  v_start_date := (v_booking.check_in at time zone 'Asia/Ho_Chi_Minh')::date;
  v_room_nights := greatest(
    coalesce(v_booking.nights, (v_booking.check_out at time zone 'Asia/Ho_Chi_Minh')::date - v_start_date, 0),
    0
  );
  v_booking_until_exclusive := v_start_date + v_room_nights;
  v_requested_until := coalesce(p_until_date, v_booking_until_exclusive);
  v_until_exclusive := least(v_requested_until, v_booking_until_exclusive);

  if v_room_nights > 0 and v_until_exclusive <= v_start_date then
    v_until_exclusive := v_start_date + 1;
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
    business_date,
    posted_by
  )
  select
    v_booking.property_id,
    v_folio.id,
    'debit',
    'room',
    'Room charge',
    1,
    v_booking.rate_per_night,
    v_booking.rate_per_night,
    charge_day::date,
    auth.uid()
  from generate_series(v_start_date, v_until_exclusive - 1, interval '1 day') as charge_day
  where v_booking.rate_per_night > 0
  on conflict do nothing;

  get diagnostics v_posted = row_count;

  if v_posted > 0 then
    insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
    values (
      v_booking.property_id,
      auth.uid(),
      'booking',
      p_booking_id,
      'post_room_charges_until_checkout',
      jsonb_build_object('folio_id', v_folio.id, 'until_date', p_until_date, 'posted_room_charges', v_posted)
    );
  end if;

  return v_posted;
end;
$$;

create or replace function public.fn_reconcile_room_charges(p_booking_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_booking public.bookings%rowtype;
  v_folio public.folios%rowtype;
  v_adjustment_source_id uuid;
  v_room_nights int;
  v_expected_room_charges numeric;
  v_posted_room_charges numeric := 0;
  v_room_adjustment_debits numeric := 0;
  v_room_adjustment_credits numeric := 0;
  v_room_balance numeric := 0;
  v_delta numeric := 0;
  v_posted_count int := 0;
  v_description text;
begin
  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to reconcile room charges';
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

  select * into v_folio
  from public.folios
  where booking_id = p_booking_id
    and parent_folio_id is null
    and status = 'open'
  for update;

  if not found then
    raise exception 'Open master folio not found';
  end if;

  v_posted_count := public.fn_post_room_charges_until_checkout(
    p_booking_id,
    (v_booking.check_out at time zone 'Asia/Ho_Chi_Minh')::date
  );

  v_room_nights := greatest(coalesce(v_booking.nights, 0), 0);
  v_expected_room_charges := coalesce(v_booking.rate_per_night, 0) * v_room_nights;

  select
    coalesce(sum(amount) filter (where type = 'debit' and source_type = 'room'), 0),
    coalesce(sum(amount) filter (where type = 'debit' and source_type = 'room_adjustment'), 0),
    coalesce(sum(amount) filter (where type = 'credit' and source_type = 'room_adjustment'), 0)
  into v_posted_room_charges, v_room_adjustment_debits, v_room_adjustment_credits
  from public.folio_items
  where folio_id = v_folio.id;

  v_room_balance := v_posted_room_charges + v_room_adjustment_debits - v_room_adjustment_credits;
  v_delta := v_expected_room_charges - v_room_balance;

  select id into v_adjustment_source_id
  from public.booking_stay_adjustments
  where booking_id = p_booking_id
  order by created_at desc
  limit 1;

  v_adjustment_source_id := coalesce(v_adjustment_source_id, p_booking_id);

  if v_delta <> 0 then
    v_description := case
      when v_delta > 0 then 'Điều chỉnh tăng tiền phòng do thay đổi lưu trú'
      else 'Điều chỉnh giảm tiền phòng do thay đổi lưu trú'
    end;

    insert into public.folio_items (
      property_id,
      folio_id,
      type,
      source_type,
      source_id,
      description,
      quantity,
      unit_price,
      amount,
      business_date,
      posted_by
    )
    values (
      v_booking.property_id,
      v_folio.id,
      case when v_delta > 0 then 'debit' else 'credit' end,
      'room_adjustment',
      v_adjustment_source_id,
      v_description,
      1,
      abs(v_delta),
      abs(v_delta),
      (now() at time zone 'Asia/Ho_Chi_Minh')::date,
      auth.uid()
    )
    on conflict (folio_id, source_id)
      where source_type = 'room_adjustment' and source_id is not null
    do update set
      type = excluded.type,
      description = excluded.description,
      unit_price = excluded.unit_price,
      amount = excluded.amount,
      posted_by = excluded.posted_by,
      posted_at = now();
  end if;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_booking.property_id,
    auth.uid(),
    'booking',
    p_booking_id,
    'reconcile_room_charges',
    jsonb_build_object(
      'folio_id', v_folio.id,
      'expected_room_charges', v_expected_room_charges,
      'posted_room_charges', v_posted_room_charges,
      'room_adjustment_debits', v_room_adjustment_debits,
      'room_adjustment_credits', v_room_adjustment_credits,
      'delta', v_delta,
      'posted_room_charge_count', v_posted_count
    )
  );

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'folio_id', v_folio.id,
    'expected_room_charges', v_expected_room_charges,
    'posted_room_charges', v_posted_room_charges,
    'room_adjustment_debits', v_room_adjustment_debits,
    'room_adjustment_credits', v_room_adjustment_credits,
    'delta', v_delta,
    'posted_room_charge_count', v_posted_count
  );
end;
$$;

create or replace function public.fn_check_out_booking(
  p_booking_id uuid,
  p_settlement_mode text default 'paid'
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_booking record;
  v_assignment record;
  v_folio record;
  v_balance numeric;
  v_invoice_number text;
  v_invoice_total numeric;
  v_checkout_at timestamptz;
begin
  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to check out';
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

  select * into v_assignment
  from public.booking_rooms
  where booking_id = p_booking_id
    and status = 'checked_in'
  order by check_in desc
  limit 1
  for update;

  if not found then
    raise exception 'Active room assignment not found';
  end if;

  select * into v_folio
  from public.folios
  where booking_id = p_booking_id
    and parent_folio_id is null
  for update;

  if not found then
    raise exception 'Master folio not found';
  end if;

  v_checkout_at := greatest(now(), v_assignment.check_in + interval '1 second');

  if v_checkout_at < v_booking.check_out then
    perform public.fn_adjust_booking_stay(
      p_booking_id,
      v_checkout_at,
      'Trả phòng sớm khi checkout'
    );

    select * into v_booking
    from public.bookings
    where id = p_booking_id
    for update;

    select * into v_assignment
    from public.booking_rooms
    where id = v_assignment.id
    for update;
  end if;

  if exists (
    select 1
    from public.payments
    where folio_id = v_folio.id
      and status = 'pending_verification'
  ) or exists (
    select 1
    from public.booking_deposits
    where booking_id = p_booking_id
      and status = 'pending_verification'
  ) then
    raise exception 'Pending bank transfers must be verified before checkout';
  end if;

  perform public.fn_reconcile_room_charges(p_booking_id);

  v_balance := public.fn_calculate_folio_balance(v_folio.id);

  if coalesce(v_balance, 0) > 0 and p_settlement_mode <> 'city_ledger' then
    raise exception 'Folio balance must be zero before checkout';
  end if;

  if coalesce(v_balance, 0) > 0
     and p_settlement_mode = 'city_ledger'
     and not private.has_any_role(array['admin','manager','accountant']::public.pms_role[]) then
    raise exception 'Only manager/accountant can move balance to city ledger';
  end if;

  update public.folios
  set status = 'closed',
      closed_at = v_checkout_at
  where id = v_folio.id;

  update public.bookings
  set status = 'checked_out'
  where id = p_booking_id;

  update public.booking_rooms
  set status = 'checked_out',
      check_out = v_checkout_at
  where id = v_assignment.id;

  update public.rooms
  set status = 'vacant_dirty'
  where id = v_assignment.room_id;

  insert into public.room_status_history (property_id, room_id, from_status, to_status, reason, changed_by)
  values (v_booking.property_id, v_assignment.room_id, 'occupied', 'vacant_dirty', 'check_out', auth.uid());

  insert into public.housekeeping_tasks (property_id, room_id, task_type, status, priority, notes)
  values (v_booking.property_id, v_assignment.room_id, 'checkout_clean', 'pending', 'high', 'Tự động tạo sau checkout');

  v_invoice_number := 'INV-' || to_char(v_checkout_at at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  select coalesce(sum(amount), 0) into v_invoice_total
  from public.folio_items
  where folio_id = v_folio.id
    and type = 'debit';

  insert into public.invoices (
    property_id,
    folio_id,
    invoice_number,
    status,
    total_amount,
    issued_at,
    issued_by
  )
  values (
    v_booking.property_id,
    v_folio.id,
    v_invoice_number,
    'issued',
    v_invoice_total,
    v_checkout_at,
    auth.uid()
  );

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_booking.property_id,
    auth.uid(),
    'booking',
    p_booking_id,
    'check_out',
    jsonb_build_object('folio_id', v_folio.id, 'room_id', v_assignment.room_id, 'settlement_mode', p_settlement_mode, 'checkout_at', v_checkout_at)
  );

  return v_folio.id;
end;
$$;

create or replace function private.cashier_session_expected_cash(p_session_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, private
as $$
  select
    cs.opening_float
    + coalesce((
        select sum(p.amount)
        from public.payments p
        where p.cashier_session_id = cs.id
          and p.method = 'cash'
          and p.status in ('posted', 'finalized')
      ), 0)
    + coalesce((
        select sum(bd.amount)
        from public.booking_deposits bd
        where bd.cashier_session_id = cs.id
          and bd.method = 'cash'
          and bd.status in ('posted', 'finalized')
      ), 0)
    - coalesce((
        select sum(r.amount)
        from public.refunds r
        where r.cashier_session_id = cs.id
          and r.status in ('posted', 'finalized')
      ), 0)
  from public.cashier_sessions cs
  where cs.id = p_session_id
$$;

create or replace function public.fn_close_cashier_session(
  p_session_id uuid,
  p_declared_cash numeric,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_session public.cashier_sessions%rowtype;
begin
  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to close cashier session';
  end if;

  if p_declared_cash is null or p_declared_cash < 0 then
    raise exception 'Declared cash must be zero or positive';
  end if;

  select * into v_session
  from public.cashier_sessions
  where id = p_session_id
    and property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Cashier session not found';
  end if;

  if v_session.status <> 'open' then
    raise exception 'Only open cashier sessions can be closed';
  end if;

  if v_session.cashier_id <> auth.uid()
     and not private.has_any_role(array['admin','manager','accountant']::public.pms_role[]) then
    raise exception 'Only finance roles can close another cashier session';
  end if;

  update public.cashier_sessions
  set status = 'closed',
      declared_cash = p_declared_cash,
      note = nullif(trim(coalesce(p_note, '')), ''),
      closed_at = now()
  where id = p_session_id;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_session.property_id,
    auth.uid(),
    'cashier_session',
    p_session_id,
    'close_cashier_session',
    jsonb_build_object(
      'declared_cash', p_declared_cash,
      'expected_cash', private.cashier_session_expected_cash(p_session_id),
      'note', p_note
    )
  );

  return p_session_id;
end;
$$;

create or replace function public.fn_approve_cashier_session(
  p_session_id uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_session public.cashier_sessions%rowtype;
  v_expected_cash numeric;
  v_variance numeric;
begin
  if p_decision not in ('approve', 'void') then
    raise exception 'Invalid cashier session decision';
  end if;

  if not private.has_any_role(array['admin','manager','accountant']::public.pms_role[]) then
    raise exception 'Only accountant/manager/admin can approve cashier sessions';
  end if;

  select * into v_session
  from public.cashier_sessions
  where id = p_session_id
    and property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Cashier session not found';
  end if;

  if v_session.status <> 'closed' then
    raise exception 'Only closed cashier sessions can be approved';
  end if;

  v_expected_cash := private.cashier_session_expected_cash(p_session_id);
  v_variance := coalesce(v_session.declared_cash, 0) - coalesce(v_expected_cash, 0);

  if v_variance <> 0 and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Variance note is required for cashier sessions with cash difference';
  end if;

  update public.cashier_sessions
  set status = case when p_decision = 'approve' then 'approved' else 'voided' end,
      note = coalesce(nullif(trim(coalesce(p_note, '')), ''), note),
      approved_at = now(),
      approved_by = auth.uid()
  where id = p_session_id;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_session.property_id,
    auth.uid(),
    'cashier_session',
    p_session_id,
    'approve_cashier_session',
    jsonb_build_object(
      'decision', p_decision,
      'declared_cash', v_session.declared_cash,
      'expected_cash', v_expected_cash,
      'variance', v_variance,
      'note', p_note
    )
  );

  return p_session_id;
end;
$$;

revoke all on function public.fn_adjust_booking_stay(uuid, timestamptz, text) from public, anon;
revoke all on function public.fn_reconcile_room_charges(uuid) from public, anon;
revoke all on function public.fn_close_cashier_session(uuid, numeric, text) from public, anon;
revoke all on function public.fn_approve_cashier_session(uuid, text, text) from public, anon;

grant execute on function public.fn_adjust_booking_stay(uuid, timestamptz, text) to authenticated;
grant execute on function public.fn_reconcile_room_charges(uuid) to authenticated;
grant execute on function public.fn_close_cashier_session(uuid, numeric, text) to authenticated;
grant execute on function public.fn_approve_cashier_session(uuid, text, text) to authenticated;
