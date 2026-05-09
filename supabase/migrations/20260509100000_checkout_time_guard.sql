-- Ensure checkout never writes an actual check_out earlier than check_in.

create or replace function public.fn_check_out_booking(
  p_booking_id uuid,
  p_settlement_mode text default 'paid'
)
returns uuid
language plpgsql
security invoker
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

