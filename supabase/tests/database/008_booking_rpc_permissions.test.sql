begin;

set search_path = public, extensions;

select plan(3);

insert into public.roles (name, description) values
  ('admin', 'Admin'),
  ('manager', 'Manager'),
  ('receptionist', 'Receptionist'),
  ('hk_supervisor', 'HK supervisor'),
  ('hk_staff', 'HK staff'),
  ('accountant', 'Accountant')
on conflict do nothing;

insert into public.properties (id, name, address, total_rooms)
values ('80000000-0000-4000-8000-000000000001', 'Booking RPC Hotel', 'A', 1);

select test.create_auth_user('80000000-0000-4000-8000-000000000101', 'booking-rpc-reception@test.local');
select test.create_auth_user('80000000-0000-4000-8000-000000000102', 'booking-rpc-hk@test.local');

insert into public.profiles (id, property_id, full_name, email)
values
  ('80000000-0000-4000-8000-000000000101', '80000000-0000-4000-8000-000000000001', 'Reception', 'booking-rpc-reception@test.local'),
  ('80000000-0000-4000-8000-000000000102', '80000000-0000-4000-8000-000000000001', 'HK', 'booking-rpc-hk@test.local');

insert into public.profile_roles (profile_id, role)
values
  ('80000000-0000-4000-8000-000000000101', 'receptionist'),
  ('80000000-0000-4000-8000-000000000102', 'hk_staff');

insert into public.room_types (id, property_id, code, name, max_occupancy, bed_type, base_price)
values ('80000000-0000-4000-8000-000000000201', '80000000-0000-4000-8000-000000000001', 'STD', 'Standard', 2, 'double', 800000);

insert into public.rooms (id, property_id, room_type_id, number, floor, status)
values ('80000000-0000-4000-8000-000000000301', '80000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000201', '801', 8, 'vacant_clean');

insert into public.guests (
  id, property_id, first_name, last_name, full_name, phone, nationality,
  document_type, document_number, document_issue_date, document_issue_place,
  date_of_birth, gender, occupation, current_address, stay_purpose
)
values (
  '80000000-0000-4000-8000-000000000401',
  '80000000-0000-4000-8000-000000000001',
  'A', 'Guest', 'Guest A', '0900000000', 'Vietnam',
  'cccd', '012345678901', current_date, 'CA TP.HCM',
  '1990-01-01', 'male', 'Engineer', 'HCMC', 'business'
);

select test.set_auth_user('80000000-0000-4000-8000-000000000101');
set local role authenticated;

select ok(
  test.expect_success($$
    select public.fn_create_booking(jsonb_build_object(
      'property_id', '80000000-0000-4000-8000-000000000001',
      'guest_id', '80000000-0000-4000-8000-000000000401',
      'room_id', '80000000-0000-4000-8000-000000000301',
      'check_in', '2026-06-01T14:00:00+07:00',
      'check_out', '2026-06-02T12:00:00+07:00',
      'status', 'confirmed',
      'source', 'direct',
      'rate_code', 'BAR',
      'rate_per_night', 800000,
      'total_amount', 800000,
      'deposit_amount', 0,
      'deposit_paid', false,
      'adults', 1,
      'children', 0
    ))
  $$),
  'receptionist can create booking through RPC'
);

select ok(
  exists (
    select 1
    from public.booking_rooms
    where room_id = '80000000-0000-4000-8000-000000000301'
      and status = 'confirmed'
  ),
  'booking room assignment is created'
);

select test.set_auth_user('80000000-0000-4000-8000-000000000102');

select ok(
  test.expect_error($$
    select public.fn_create_booking(jsonb_build_object(
      'property_id', '80000000-0000-4000-8000-000000000001',
      'guest_id', '80000000-0000-4000-8000-000000000401',
      'room_id', '80000000-0000-4000-8000-000000000301',
      'check_in', '2026-06-03T14:00:00+07:00',
      'check_out', '2026-06-04T12:00:00+07:00'
    ))
  $$),
  'hk staff cannot create booking through RPC'
);

select * from finish();

rollback;
