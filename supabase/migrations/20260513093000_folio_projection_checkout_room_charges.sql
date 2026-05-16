-- Folio projected receivables and checkout room-charge closeout.

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
  v_projected_room_charges numeric := 0;
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
    coalesce(sum(amount) filter (where type = 'debit' and source_type <> 'room'), 0),
    coalesce(sum(amount) filter (where type = 'credit' and source_type = 'deposit'), 0),
    coalesce(sum(amount) filter (where type = 'credit' and source_type = 'payment'), 0),
    coalesce(sum(case when type = 'debit' then amount else -amount end), 0)
  into
    v_posted_room_charges,
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

  v_pending_payments := v_pending_folio_payments + v_pending_deposits;
  v_projected_room_charges := greatest(v_expected_room_charges, v_posted_room_charges);
  v_projected_balance := v_posted_balance + greatest(v_projected_room_charges - v_posted_room_charges, 0);

  return jsonb_build_object(
    'folio_id', p_folio_id,
    'booking_id', v_folio.booking_id,
    'room_nights', v_room_nights,
    'rate_per_night', coalesce(v_booking.rate_per_night, 0),
    'posted_room_charges', v_posted_room_charges,
    'projected_room_charges', v_projected_room_charges,
    'room_charge_to_post', greatest(v_projected_room_charges - v_posted_room_charges, 0),
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
  v_until_exclusive date;
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
  v_until_exclusive := least(
    coalesce(p_until_date, (v_booking.check_out at time zone 'Asia/Ho_Chi_Minh')::date),
    (v_booking.check_out at time zone 'Asia/Ho_Chi_Minh')::date
  );

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

  perform public.fn_post_room_charges_until_checkout(p_booking_id, (v_booking.check_out at time zone 'Asia/Ho_Chi_Minh')::date);

  v_balance := public.fn_calculate_folio_balance(v_folio.id);

  if coalesce(v_balance, 0) > 0 and p_settlement_mode <> 'city_ledger' then
    raise exception 'Folio balance must be zero before checkout';
  end if;

  if coalesce(v_balance, 0) > 0
     and p_settlement_mode = 'city_ledger'
     and not private.has_any_role(array['admin','manager','accountant']::public.pms_role[]) then
    raise exception 'Only manager/accountant can move balance to city ledger';
  end if;

  v_checkout_at := greatest(now(), v_assignment.check_in + interval '1 second');

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

revoke all on function public.fn_folio_projection(uuid) from public, anon;
revoke all on function public.fn_post_room_charges_until_checkout(uuid, date) from public, anon;

grant execute on function public.fn_folio_projection(uuid) to authenticated;
grant execute on function public.fn_post_room_charges_until_checkout(uuid, date) to authenticated;
