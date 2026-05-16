begin;

set search_path = public, extensions;

select plan(12);

insert into public.roles (name, description) values
  ('admin', 'Admin'),
  ('manager', 'Manager'),
  ('receptionist', 'Receptionist'),
  ('hk_supervisor', 'HK supervisor'),
  ('hk_staff', 'HK staff'),
  ('accountant', 'Accountant')
on conflict do nothing;

select test.create_auth_user('92000000-0000-4000-8000-000000000101', 'cashier-a@test.local');
select test.create_auth_user('92000000-0000-4000-8000-000000000102', 'cashier-c@test.local');
select test.create_auth_user('92000000-0000-4000-8000-000000000103', 'cashier-accountant@test.local');

insert into public.properties (id, name, address, total_rooms)
values ('92000000-0000-4000-8000-000000000001', 'Stay Adjustment Test', 'A', 3);

insert into public.profiles (id, property_id, full_name, email)
values
  ('92000000-0000-4000-8000-000000000101', '92000000-0000-4000-8000-000000000001', 'Reception A', 'cashier-a@test.local'),
  ('92000000-0000-4000-8000-000000000102', '92000000-0000-4000-8000-000000000001', 'Reception C', 'cashier-c@test.local'),
  ('92000000-0000-4000-8000-000000000103', '92000000-0000-4000-8000-000000000001', 'Accountant', 'cashier-accountant@test.local');

insert into public.profile_roles (profile_id, role)
values
  ('92000000-0000-4000-8000-000000000101', 'receptionist'),
  ('92000000-0000-4000-8000-000000000102', 'receptionist'),
  ('92000000-0000-4000-8000-000000000103', 'accountant');

select test.set_auth_user('92000000-0000-4000-8000-000000000101');

insert into public.room_types (id, property_id, name, code, max_occupancy, bed_type, base_price)
values ('92000000-0000-4000-8000-000000000201', '92000000-0000-4000-8000-000000000001', 'Standard', 'STD', 2, 'Queen', 1000000);

insert into public.rooms (id, property_id, room_type_id, number, floor, status)
values
  ('92000000-0000-4000-8000-000000000301', '92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000201', '1201', 12, 'vacant_clean'),
  ('92000000-0000-4000-8000-000000000302', '92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000201', '1202', 12, 'vacant_clean'),
  ('92000000-0000-4000-8000-000000000303', '92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000201', '1203', 12, 'vacant_clean');

insert into public.guests (
  id, property_id, first_name, last_name, full_name, phone, nationality,
  document_type, document_number, document_issue_date, document_issue_place,
  date_of_birth, gender, occupation, current_address, stay_purpose
)
values
  ('92000000-0000-4000-8000-000000000401', '92000000-0000-4000-8000-000000000001', 'Guest', 'Early', 'Early Guest', '0912000001', 'VN', 'cccd', '092401', date '2020-01-01', 'HCMC', date '1990-01-01', 'male', 'Engineer', 'HCMC', 'travel'),
  ('92000000-0000-4000-8000-000000000402', '92000000-0000-4000-8000-000000000001', 'Guest', 'Overpost', 'Overpost Guest', '0912000002', 'VN', 'cccd', '092402', date '2020-01-01', 'HCMC', date '1990-01-01', 'female', 'Designer', 'HCMC', 'travel'),
  ('92000000-0000-4000-8000-000000000403', '92000000-0000-4000-8000-000000000001', 'Guest', 'Extend', 'Extend Guest', '0912000003', 'VN', 'cccd', '092403', date '2020-01-01', 'HCMC', date '1990-01-01', 'male', 'Manager', 'HCMC', 'travel');

insert into public.bookings (
  id, booking_number, property_id, guest_id, check_in, check_out, nights,
  status, rate_per_night, total_amount, deposit_amount, deposit_paid
)
values
  (
    '92000000-0000-4000-8000-000000000501',
    'BK-STAY-EARLY',
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000401',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1) + time '14:00') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1) + time '12:00') at time zone 'Asia/Ho_Chi_Minh',
    2,
    'confirmed',
    1000000,
    2000000,
    500000,
    false
  ),
  (
    '92000000-0000-4000-8000-000000000502',
    'BK-STAY-OVERPOST',
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000402',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1) + time '14:00') at time zone 'Asia/Ho_Chi_Minh',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1) + time '12:00') at time zone 'Asia/Ho_Chi_Minh',
    2,
    'confirmed',
    1000000,
    2000000,
    0,
    false
  ),
  (
    '92000000-0000-4000-8000-000000000503',
    'BK-STAY-EXTEND',
    '92000000-0000-4000-8000-000000000001',
    '92000000-0000-4000-8000-000000000403',
    (((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1) + time '14:00') at time zone 'Asia/Ho_Chi_Minh',
    ((now() at time zone 'Asia/Ho_Chi_Minh')::date + time '12:00') at time zone 'Asia/Ho_Chi_Minh',
    1,
    'confirmed',
    800000,
    800000,
    0,
    false
  );

insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
select property_id, id,
  case id
    when '92000000-0000-4000-8000-000000000501' then '92000000-0000-4000-8000-000000000301'::uuid
    when '92000000-0000-4000-8000-000000000502' then '92000000-0000-4000-8000-000000000302'::uuid
    else '92000000-0000-4000-8000-000000000303'::uuid
  end,
  check_in,
  check_out,
  'confirmed'
from public.bookings
where id in (
  '92000000-0000-4000-8000-000000000501',
  '92000000-0000-4000-8000-000000000502',
  '92000000-0000-4000-8000-000000000503'
);

set local role authenticated;

select public.fn_record_booking_deposit('92000000-0000-4000-8000-000000000501', 'cash', 500000, 'A-DEP', null);
select public.fn_check_in_booking('92000000-0000-4000-8000-000000000501', '92000000-0000-4000-8000-000000000301', null);

select public.fn_add_folio_charge(
  (select id from public.folios where booking_id = '92000000-0000-4000-8000-000000000501'),
  'restaurant_later',
  'Ăn đêm',
  200000
);

select public.fn_add_folio_charge(
  (select id from public.folios where booking_id = '92000000-0000-4000-8000-000000000501'),
  'manual_service',
  'Mua giúp đồ ăn ngoài',
  100000
);

select public.fn_record_folio_payment(
  (select id from public.folios where booking_id = '92000000-0000-4000-8000-000000000501'),
  'cash',
  100000,
  'A-FOOD',
  null
);

select is(
  (
    select (public.fn_folio_projection(id)->>'projected_balance')::numeric
    from public.folios
    where booking_id = '92000000-0000-4000-8000-000000000501'
  ),
  1700000::numeric,
  'before early adjustment, projection is two room nights plus services minus A cash collections'
);

reset role;
select test.set_auth_user('92000000-0000-4000-8000-000000000102');
set local role authenticated;

select public.fn_adjust_booking_stay('92000000-0000-4000-8000-000000000501', now(), 'Khách trả phòng sớm');

select is(
  (
    select (public.fn_folio_projection(id)->>'projected_balance')::numeric
    from public.folios
    where booking_id = '92000000-0000-4000-8000-000000000501'
  ),
  700000::numeric,
  'early adjustment changes projection to one room night plus services minus collections'
);

select public.fn_record_folio_payment(
  (select id from public.folios where booking_id = '92000000-0000-4000-8000-000000000501'),
  'cash',
  700000,
  'C-CHECKOUT',
  null
);

select public.fn_check_out_booking('92000000-0000-4000-8000-000000000501', 'paid');

select is(
  (select status from public.bookings where id = '92000000-0000-4000-8000-000000000501'),
  'checked_out'::public.booking_status,
  'checkout succeeds after C collects the early-checkout balance'
);

reset role;
select test.set_auth_user('92000000-0000-4000-8000-000000000103');
set local role authenticated;

select is(
  (
    select cs.opening_float
      + coalesce((select sum(amount) from public.payments where cashier_session_id = cs.id and method = 'cash' and status in ('posted', 'finalized')), 0)
      + coalesce((select sum(amount) from public.booking_deposits where cashier_session_id = cs.id and method = 'cash' and status in ('posted', 'finalized')), 0)
      - coalesce((select sum(amount) from public.refunds where cashier_session_id = cs.id and status in ('posted', 'finalized')), 0)
    from public.cashier_sessions cs
    where cs.cashier_id = '92000000-0000-4000-8000-000000000101'
  ),
  600000::numeric,
  'cashier A owns the deposit and paid food collection'
);

select is(
  (
    select cs.opening_float
      + coalesce((select sum(amount) from public.payments where cashier_session_id = cs.id and method = 'cash' and status in ('posted', 'finalized')), 0)
      + coalesce((select sum(amount) from public.booking_deposits where cashier_session_id = cs.id and method = 'cash' and status in ('posted', 'finalized')), 0)
      - coalesce((select sum(amount) from public.refunds where cashier_session_id = cs.id and status in ('posted', 'finalized')), 0)
    from public.cashier_sessions cs
    where cs.cashier_id = '92000000-0000-4000-8000-000000000102'
  ),
  700000::numeric,
  'cashier C owns the checkout collection'
);

reset role;
select test.set_auth_user('92000000-0000-4000-8000-000000000101');
set local role authenticated;

select public.fn_check_in_booking('92000000-0000-4000-8000-000000000503', '92000000-0000-4000-8000-000000000303', null);
select public.fn_adjust_booking_stay('92000000-0000-4000-8000-000000000503', now() + interval '1 day', 'Khách ở thêm 1 đêm');

select is(
  (select nights from public.bookings where id = '92000000-0000-4000-8000-000000000503'),
  2,
  'extend stay updates booking nights'
);

select is(
  (
    select (public.fn_folio_projection(id)->>'projected_room_charges')::numeric
    from public.folios
    where booking_id = '92000000-0000-4000-8000-000000000503'
  ),
  1600000::numeric,
  'extend stay increases projected room charges'
);

select public.fn_check_in_booking('92000000-0000-4000-8000-000000000502', '92000000-0000-4000-8000-000000000302', null);
select public.fn_post_room_charges_until_checkout(
  '92000000-0000-4000-8000-000000000502',
  ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1)
);

select is(
  (
    select count(*)::int
    from public.folio_items
    where folio_id = (select id from public.folios where booking_id = '92000000-0000-4000-8000-000000000502')
      and source_type = 'room'
      and type = 'debit'
  ),
  2,
  'posting room charges for two booked nights creates two ledger rows'
);

select public.fn_adjust_booking_stay('92000000-0000-4000-8000-000000000502', now(), 'Khách trả phòng sớm sau night audit');
select public.fn_reconcile_room_charges('92000000-0000-4000-8000-000000000502');

select is(
  (
    select coalesce(sum(amount), 0)
    from public.folio_items
    where folio_id = (select id from public.folios where booking_id = '92000000-0000-4000-8000-000000000502')
      and source_type = 'room_adjustment'
      and type = 'credit'
  ),
  1000000::numeric,
  'early checkout after over-posted room charges creates a room adjustment credit'
);

select public.fn_close_cashier_session(
  (select id from public.cashier_sessions where cashier_id = '92000000-0000-4000-8000-000000000101'),
  550000,
  'Nhân viên nộp thiếu'
);

select is(
  (
    select cs.declared_cash - (
      cs.opening_float
      + coalesce((select sum(amount) from public.payments where cashier_session_id = cs.id and method = 'cash' and status in ('posted', 'finalized')), 0)
      + coalesce((select sum(amount) from public.booking_deposits where cashier_session_id = cs.id and method = 'cash' and status in ('posted', 'finalized')), 0)
      - coalesce((select sum(amount) from public.refunds where cashier_session_id = cs.id and status in ('posted', 'finalized')), 0)
    )
    from public.cashier_sessions cs
    where cs.cashier_id = '92000000-0000-4000-8000-000000000101'
  ),
  -50000::numeric,
  'closing cashier A with lower declared cash records a negative variance'
);

reset role;
select test.set_auth_user('92000000-0000-4000-8000-000000000103');
set local role authenticated;

select ok(
  test.expect_error($$
    select public.fn_approve_cashier_session(
      (select id from public.cashier_sessions where cashier_id = '92000000-0000-4000-8000-000000000101'),
      'approve',
      null
    )
  $$),
  'approving a variance cashier session requires an accountant note'
);

select public.fn_approve_cashier_session(
  (select id from public.cashier_sessions where cashier_id = '92000000-0000-4000-8000-000000000101'),
  'approve',
  'Đã xác nhận nhân viên nộp thiếu 50k'
);

select is(
  (select status from public.cashier_sessions where cashier_id = '92000000-0000-4000-8000-000000000101'),
  'approved',
  'accountant approves the closed cashier session with variance note'
);

select * from finish();

rollback;
