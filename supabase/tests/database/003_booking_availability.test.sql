begin;

set search_path = public, extensions;

select plan(6);

insert into public.roles (name, description) values
  ('admin', 'Admin'),
  ('manager', 'Manager'),
  ('receptionist', 'Receptionist'),
  ('hk_supervisor', 'HK supervisor'),
  ('hk_staff', 'HK staff'),
  ('accountant', 'Accountant')
on conflict do nothing;

select test.create_auth_user('30000000-0000-4000-8000-000000000101', 'booking-rec@test.local');

insert into public.properties (id, name, address, total_rooms)
values ('30000000-0000-4000-8000-000000000001', 'Booking Test', 'A', 1);

insert into public.profiles (id, property_id, full_name, email)
values ('30000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000001', 'Reception', 'booking-rec@test.local');

insert into public.profile_roles (profile_id, role)
values ('30000000-0000-4000-8000-000000000101', 'receptionist');

select test.set_auth_user('30000000-0000-4000-8000-000000000101');

insert into public.room_types (id, property_id, name, code, max_occupancy, bed_type, base_price)
values ('30000000-0000-4000-8000-000000000201', '30000000-0000-4000-8000-000000000001', 'Standard', 'STD', 2, 'Queen', 100);

insert into public.rooms (id, property_id, room_type_id, number, floor, status)
values ('30000000-0000-4000-8000-000000000301', '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000201', '301', 3, 'vacant_clean');

insert into public.guests (
  id, property_id, first_name, last_name, full_name, phone, nationality,
  document_type, document_number, document_issue_date, document_issue_place,
  date_of_birth, gender, occupation, current_address, stay_purpose
)
values (
  '30000000-0000-4000-8000-000000000401',
  '30000000-0000-4000-8000-000000000001',
  'A', 'Guest', 'A Guest', '0900000000', 'VN',
  'cccd', '001300', date '2020-01-01', 'HCMC',
  date '1990-01-01', 'male', 'Engineer', 'HCMC', 'travel'
);

select ok(
  test.expect_error($$
    insert into public.bookings (
      booking_number, property_id, guest_id, check_in, check_out, nights,
      rate_per_night, total_amount
    )
    values (
      'BAD-DATE',
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000401',
      '2026-05-12 12:00+07',
      '2026-05-12 11:00+07',
      1,
      100,
      100
    )
  $$),
  'booking checkout <= checkin is rejected'
);

insert into public.bookings (
  id, booking_number, property_id, guest_id, check_in, check_out, nights,
  status, rate_per_night, total_amount
)
values
  ('30000000-0000-4000-8000-000000000501', 'BK-1', '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000401', '2026-05-10 14:00+07', '2026-05-12 12:00+07', 2, 'confirmed', 100, 200),
  ('30000000-0000-4000-8000-000000000502', 'BK-2', '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000401', '2026-05-11 14:00+07', '2026-05-13 12:00+07', 2, 'confirmed', 100, 200);

insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
values (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000501',
  '30000000-0000-4000-8000-000000000301',
  '2026-05-10 14:00+07',
  '2026-05-12 12:00+07',
  'confirmed'
);

select ok(
  test.expect_error($$
    insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
    values (
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000502',
      '30000000-0000-4000-8000-000000000301',
      '2026-05-11 14:00+07',
      '2026-05-13 12:00+07',
      'confirmed'
    )
  $$),
  'double-booking same room/date is rejected by DB'
);

select ok(
  test.expect_error($$
    insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
    values (
      gen_random_uuid(),
      '30000000-0000-4000-8000-000000000502',
      '30000000-0000-4000-8000-000000000301',
      '2026-05-13 14:00+07',
      '2026-05-14 12:00+07',
      'confirmed'
    )
  $$),
  'booking_room property must match booking and room'
);

select public.fn_cancel_booking('30000000-0000-4000-8000-000000000501', 'guest cancelled', 'keep_deposit');

select is(
  (select status from public.bookings where id = '30000000-0000-4000-8000-000000000501'),
  'cancelled'::public.booking_status,
  'cancel changes booking status'
);

select is(
  (select count(*)::int from public.booking_rooms where booking_id = '30000000-0000-4000-8000-000000000501'),
  1,
  'cancel keeps booking_room history row'
);

select is(
  (select count(*)::int from public.booking_notes where booking_id = '30000000-0000-4000-8000-000000000501'),
  1,
  'cancel writes booking note'
);

select * from finish();

rollback;

