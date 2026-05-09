begin;

set search_path = public, extensions;

select plan(10);

insert into public.roles (name, description) values
  ('admin', 'Admin'),
  ('manager', 'Manager'),
  ('receptionist', 'Receptionist'),
  ('hk_supervisor', 'HK supervisor'),
  ('hk_staff', 'HK staff'),
  ('accountant', 'Accountant')
on conflict do nothing;

select test.create_auth_user('50000000-0000-4000-8000-000000000101', 'pay-rec@test.local');
select test.create_auth_user('50000000-0000-4000-8000-000000000102', 'pay-hksup@test.local');
select test.create_auth_user('50000000-0000-4000-8000-000000000103', 'pay-hk1@test.local');
select test.create_auth_user('50000000-0000-4000-8000-000000000104', 'pay-hk2@test.local');

insert into public.properties (id, name, address, total_rooms)
values ('50000000-0000-4000-8000-000000000001', 'Payment Test', 'A', 1);

insert into public.profiles (id, property_id, full_name, email)
values
  ('50000000-0000-4000-8000-000000000101', '50000000-0000-4000-8000-000000000001', 'Reception', 'pay-rec@test.local'),
  ('50000000-0000-4000-8000-000000000102', '50000000-0000-4000-8000-000000000001', 'HK Sup', 'pay-hksup@test.local'),
  ('50000000-0000-4000-8000-000000000103', '50000000-0000-4000-8000-000000000001', 'HK One', 'pay-hk1@test.local'),
  ('50000000-0000-4000-8000-000000000104', '50000000-0000-4000-8000-000000000001', 'HK Two', 'pay-hk2@test.local');

insert into public.profile_roles (profile_id, role)
values
  ('50000000-0000-4000-8000-000000000101', 'receptionist'),
  ('50000000-0000-4000-8000-000000000102', 'hk_supervisor'),
  ('50000000-0000-4000-8000-000000000103', 'hk_staff'),
  ('50000000-0000-4000-8000-000000000104', 'hk_staff');

insert into public.room_types (id, property_id, name, code, max_occupancy, bed_type, base_price)
values ('50000000-0000-4000-8000-000000000201', '50000000-0000-4000-8000-000000000001', 'Standard', 'STD', 2, 'Queen', 100);

insert into public.rooms (id, property_id, room_type_id, number, floor, status)
values ('50000000-0000-4000-8000-000000000301', '50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000201', '501', 5, 'occupied');

insert into public.guests (
  id, property_id, first_name, last_name, full_name, phone, nationality,
  document_type, document_number, document_issue_date, document_issue_place,
  date_of_birth, gender, occupation, current_address, stay_purpose
)
values (
  '50000000-0000-4000-8000-000000000401',
  '50000000-0000-4000-8000-000000000001',
  'A', 'Guest', 'A Guest', '0900000000', 'VN',
  'cccd', '001500', date '2020-01-01', 'HCMC',
  date '1990-01-01', 'male', 'Engineer', 'HCMC', 'travel'
);

insert into public.bookings (
  id, booking_number, property_id, guest_id, check_in, check_out, nights,
  status, rate_per_night, total_amount
)
values ('50000000-0000-4000-8000-000000000501', 'BK-PAY-1', '50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000401', '2026-05-10 14:00+07', '2026-05-11 12:00+07', 1, 'checked_in', 100, 100);

insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
values ('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000501', '50000000-0000-4000-8000-000000000301', '2026-05-10 14:00+07', '2026-05-11 12:00+07', 'checked_in');

insert into public.folios (id, property_id, booking_id, folio_number, status)
values ('50000000-0000-4000-8000-000000000601', '50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000501', 'F-PAY-1', 'open');

select test.set_auth_user('50000000-0000-4000-8000-000000000101');

select public.fn_add_folio_charge('50000000-0000-4000-8000-000000000601', 'manual_service', 'Spa', 100);
select public.fn_record_payment('50000000-0000-4000-8000-000000000601', 'cash', 40, 'P1');

select is(
  public.fn_calculate_folio_balance('50000000-0000-4000-8000-000000000601'),
  60::numeric,
  'balance equals debit minus credit'
);

select ok(
  test.expect_error($$
    insert into public.payments (property_id, folio_id, method, amount)
    values (gen_random_uuid(), '50000000-0000-4000-8000-000000000601', 'cash', 1)
  $$),
  'payment property must match folio'
);

select ok(
  test.expect_error($$
    select public.fn_check_out_booking('50000000-0000-4000-8000-000000000501', 'paid')
  $$),
  'checkout with positive balance is rejected for receptionist'
);

select public.fn_record_payment('50000000-0000-4000-8000-000000000601', 'cash', 60, 'P2');

select is(
  public.fn_calculate_folio_balance('50000000-0000-4000-8000-000000000601'),
  0::numeric,
  'remaining payment clears folio balance'
);

select public.fn_check_out_booking('50000000-0000-4000-8000-000000000501', 'paid');

select is(
  (select status from public.bookings where id = '50000000-0000-4000-8000-000000000501'),
  'checked_out'::public.booking_status,
  'checkout closes booking'
);

select is(
  (select status from public.rooms where id = '50000000-0000-4000-8000-000000000301'),
  'vacant_dirty'::public.room_status,
  'checkout moves room to vacant_dirty'
);

select is(
  (select count(*)::int from public.housekeeping_tasks where room_id = '50000000-0000-4000-8000-000000000301' and task_type = 'checkout_clean'),
  1,
  'checkout creates checkout_clean HK task'
);

select test.set_auth_user('50000000-0000-4000-8000-000000000102');

select public.fn_assign_hk_task(
  (select id from public.housekeeping_tasks where room_id = '50000000-0000-4000-8000-000000000301' limit 1),
  '50000000-0000-4000-8000-000000000103'
);

select test.set_auth_user('50000000-0000-4000-8000-000000000103');

select ok(
  test.expect_success($$
    select public.fn_update_hk_task_status(
      (select id from public.housekeeping_tasks where room_id = '50000000-0000-4000-8000-000000000301' limit 1),
      'in_progress',
      'started'
    )
  $$),
  'hk_staff can update assigned task'
);

insert into public.housekeeping_tasks (
  id, property_id, room_id, task_type, status, priority, assigned_to
)
values (
  '50000000-0000-4000-8000-000000000701',
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000301',
  'daily_service',
  'pending',
  'normal',
  '50000000-0000-4000-8000-000000000104'
);

select ok(
  test.expect_error($$
    select public.fn_update_hk_task_status(
      '50000000-0000-4000-8000-000000000701',
      'in_progress',
      'not mine'
    )
  $$),
  'hk_staff cannot update unassigned task'
);

update public.housekeeping_tasks
set status = 'done'
where id = '50000000-0000-4000-8000-000000000701';

select test.set_auth_user('50000000-0000-4000-8000-000000000102');

select public.fn_update_hk_task_status('50000000-0000-4000-8000-000000000701', 'rejected', 'redo');
select public.fn_update_hk_task_status('50000000-0000-4000-8000-000000000701', 'pending', 'redo assigned');

select is(
  (select status from public.housekeeping_tasks where id = '50000000-0000-4000-8000-000000000701'),
  'pending'::public.hk_task_status,
  'supervisor can reject task then move it back to pending'
);

select * from finish();

rollback;

