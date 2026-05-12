begin;

set search_path = public, extensions;

select plan(9);

insert into public.roles (name, description) values
  ('admin', 'Admin'),
  ('manager', 'Manager'),
  ('receptionist', 'Receptionist'),
  ('hk_supervisor', 'HK supervisor'),
  ('hk_staff', 'HK staff'),
  ('accountant', 'Accountant')
on conflict do nothing;

select test.create_auth_user('90000000-0000-4000-8000-000000000101', 'payment-rec@test.local');
select test.create_auth_user('90000000-0000-4000-8000-000000000102', 'payment-accountant@test.local');

insert into public.properties (id, name, address, total_rooms)
values ('90000000-0000-4000-8000-000000000001', 'Payment Test', 'A', 2);

insert into public.profiles (id, property_id, full_name, email)
values
  ('90000000-0000-4000-8000-000000000101', '90000000-0000-4000-8000-000000000001', 'Reception', 'payment-rec@test.local'),
  ('90000000-0000-4000-8000-000000000102', '90000000-0000-4000-8000-000000000001', 'Accountant', 'payment-accountant@test.local');

insert into public.profile_roles (profile_id, role)
values
  ('90000000-0000-4000-8000-000000000101', 'receptionist'),
  ('90000000-0000-4000-8000-000000000102', 'accountant');

select test.set_auth_user('90000000-0000-4000-8000-000000000101');

insert into public.room_types (id, property_id, name, code, max_occupancy, bed_type, base_price)
values ('90000000-0000-4000-8000-000000000201', '90000000-0000-4000-8000-000000000001', 'Standard', 'STD', 2, 'Queen', 100);

insert into public.rooms (id, property_id, room_type_id, number, floor, status)
values ('90000000-0000-4000-8000-000000000301', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000201', '901', 9, 'vacant_clean');

insert into public.guests (
  id, property_id, first_name, last_name, full_name, phone, nationality,
  document_type, document_number, document_issue_date, document_issue_place,
  date_of_birth, gender, occupation, current_address, stay_purpose
)
values (
  '90000000-0000-4000-8000-000000000401',
  '90000000-0000-4000-8000-000000000001',
  'Pay', 'Guest', 'Pay Guest', '0900000000', 'VN',
  'cccd', '009400', date '2020-01-01', 'HCMC',
  date '1990-01-01', 'male', 'Engineer', 'HCMC', 'business'
);

insert into public.bookings (
  id, booking_number, property_id, guest_id, check_in, check_out, nights,
  status, rate_per_night, total_amount, deposit_amount, deposit_paid
)
values (
  '90000000-0000-4000-8000-000000000501',
  'BK-PAY-1',
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000401',
  '2026-07-01 14:00+07',
  '2026-07-02 12:00+07',
  1,
  'confirmed',
  1000,
  1000,
  500,
  false
);

insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
values (
  '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000501',
  '90000000-0000-4000-8000-000000000301',
  '2026-07-01 14:00+07',
  '2026-07-02 12:00+07',
  'confirmed'
);

set local role authenticated;

select public.fn_record_booking_deposit(
  '90000000-0000-4000-8000-000000000501',
  'bank_transfer',
  500,
  'BANK-001',
  'evidence/001.png'
);

select is(
  (select status from public.booking_deposits where booking_id = '90000000-0000-4000-8000-000000000501'),
  'pending_verification'::public.payment_status,
  'bank transfer deposit starts pending verification'
);

select ok(
  test.expect_error($$
    select public.fn_verify_payment(
      (select id from public.booking_deposits where booking_id = '90000000-0000-4000-8000-000000000501'),
      'deposit',
      'approve',
      null
    )
  $$),
  'receptionist cannot verify deposit'
);

reset role;
select test.set_auth_user('90000000-0000-4000-8000-000000000102');
set local role authenticated;

select public.fn_verify_payment(
  (select id from public.booking_deposits where booking_id = '90000000-0000-4000-8000-000000000501'),
  'deposit',
  'approve',
  'bank statement matched'
);

select is(
  (select status from public.booking_deposits where booking_id = '90000000-0000-4000-8000-000000000501'),
  'posted'::public.payment_status,
  'accountant verifies deposit'
);

select ok(
  (select receipt_number is not null from public.booking_deposits where booking_id = '90000000-0000-4000-8000-000000000501'),
  'verified deposit receives receipt number'
);

reset role;
select test.set_auth_user('90000000-0000-4000-8000-000000000101');
set local role authenticated;

select public.fn_check_in_booking(
  '90000000-0000-4000-8000-000000000501',
  '90000000-0000-4000-8000-000000000301',
  null
);

select is(
  (select count(*)::int from public.folio_items where source_type = 'deposit' and amount = 500),
  1,
  'check-in applies only posted deposits to folio'
);

select public.fn_add_folio_charge(
  (select id from public.folios where booking_id = '90000000-0000-4000-8000-000000000501'),
  'manual_service',
  'Late checkout',
  1000
);

select public.fn_record_folio_payment(
  (select id from public.folios where booking_id = '90000000-0000-4000-8000-000000000501'),
  'bank_transfer',
  500,
  'BANK-002',
  'evidence/002.png'
);

select is(
  public.fn_calculate_folio_balance((select id from public.folios where booking_id = '90000000-0000-4000-8000-000000000501')),
  500::numeric,
  'pending bank transfer does not reduce folio balance'
);

select ok(
  test.expect_error($$
    select public.fn_check_out_booking('90000000-0000-4000-8000-000000000501', 'paid')
  $$),
  'checkout is blocked while bank transfer is pending verification'
);

select public.fn_record_folio_payment(
  (select id from public.folios where booking_id = '90000000-0000-4000-8000-000000000501'),
  'cash',
  100,
  'CASH-001',
  null
);

select ok(
  exists (
    select 1
    from public.payments
    where method = 'cash'
      and cashier_session_id is not null
  ),
  'cash payment is linked to cashier session'
);

reset role;
select test.set_auth_user('90000000-0000-4000-8000-000000000102');
set local role authenticated;

select public.fn_verify_payment(
  (select id from public.payments where reference = 'BANK-002'),
  'payment',
  'approve',
  'bank statement matched'
);

select is(
  public.fn_calculate_folio_balance((select id from public.folios where booking_id = '90000000-0000-4000-8000-000000000501')),
  -100::numeric,
  'verified bank transfer creates payment credit'
);

select * from finish();

rollback;
