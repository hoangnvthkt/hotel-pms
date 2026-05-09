begin;

set search_path = public, extensions;

select plan(8);

insert into public.roles (name, description) values
  ('admin', 'Admin'),
  ('manager', 'Manager'),
  ('receptionist', 'Receptionist'),
  ('hk_supervisor', 'HK supervisor'),
  ('hk_staff', 'HK staff'),
  ('accountant', 'Accountant')
on conflict do nothing;

select test.create_auth_user('60000000-0000-4000-8000-000000000101', 'audit-manager@test.local');
select test.create_auth_user('60000000-0000-4000-8000-000000000102', 'audit-rec@test.local');

insert into public.properties (id, name, address, total_rooms)
values ('60000000-0000-4000-8000-000000000001', 'Audit Test', 'A', 2);

insert into public.profiles (id, property_id, full_name, email)
values
  ('60000000-0000-4000-8000-000000000101', '60000000-0000-4000-8000-000000000001', 'Manager', 'audit-manager@test.local'),
  ('60000000-0000-4000-8000-000000000102', '60000000-0000-4000-8000-000000000001', 'Reception', 'audit-rec@test.local');

insert into public.profile_roles (profile_id, role)
values
  ('60000000-0000-4000-8000-000000000101', 'manager'),
  ('60000000-0000-4000-8000-000000000102', 'receptionist');

insert into public.room_types (id, property_id, name, code, max_occupancy, bed_type, base_price)
values ('60000000-0000-4000-8000-000000000201', '60000000-0000-4000-8000-000000000001', 'Standard', 'STD', 2, 'Queen', 100);

insert into public.rooms (id, property_id, room_type_id, number, floor, status)
values
  ('60000000-0000-4000-8000-000000000301', '60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000201', '601', 6, 'occupied'),
  ('60000000-0000-4000-8000-000000000302', '60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000201', '602', 6, 'vacant_clean');

insert into public.guests (
  id, property_id, first_name, last_name, full_name, phone, nationality,
  document_type, document_number, document_issue_date, document_issue_place,
  date_of_birth, gender, occupation, current_address, stay_purpose
)
values
  (
    '60000000-0000-4000-8000-000000000401',
    '60000000-0000-4000-8000-000000000001',
    'A', 'Guest', 'A Guest', '0900000000', 'VN',
    'cccd', '001600', date '2020-01-01', 'HCMC',
    date '1990-01-01', 'male', 'Engineer', 'HCMC', 'travel'
  ),
  (
    '60000000-0000-4000-8000-000000000402',
    '60000000-0000-4000-8000-000000000001',
    'B', 'Guest', 'B Guest', '0900000001', 'VN',
    'cccd', '001601', date '2020-01-01', 'HCMC',
    date '1991-01-01', 'female', 'Designer', 'HCMC', 'travel'
  );

insert into public.bookings (
  id, booking_number, property_id, guest_id, check_in, check_out, nights,
  status, rate_per_night, total_amount
)
values
  ('60000000-0000-4000-8000-000000000501', 'BK-AUD-1', '60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000401', '2026-05-09 14:00+07', '2026-05-10 12:00+07', 1, 'checked_in', 100, 100),
  ('60000000-0000-4000-8000-000000000502', 'BK-AUD-2', '60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000402', '2026-05-09 14:00+07', '2026-05-10 12:00+07', 1, 'confirmed', 100, 100);

insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
values
  ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000501', '60000000-0000-4000-8000-000000000301', '2026-05-09 14:00+07', '2026-05-10 12:00+07', 'checked_in'),
  ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000502', '60000000-0000-4000-8000-000000000302', '2026-05-09 14:00+07', '2026-05-10 12:00+07', 'confirmed');

insert into public.folios (id, property_id, booking_id, folio_number, status)
values ('60000000-0000-4000-8000-000000000601', '60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000501', 'F-AUD-1', 'open');

select test.set_auth_user('60000000-0000-4000-8000-000000000102');

select ok(
  test.expect_error($$
    select public.fn_run_night_audit('60000000-0000-4000-8000-000000000001', date '2026-05-09')
  $$),
  'only manager/admin can run night audit'
);

select test.set_auth_user('60000000-0000-4000-8000-000000000101');

select public.fn_run_night_audit('60000000-0000-4000-8000-000000000001', date '2026-05-09');

select is(
  (select status from public.bookings where id = '60000000-0000-4000-8000-000000000502'),
  'no_show'::public.booking_status,
  'night audit marks due confirmed booking as no_show'
);

select is(
  (select count(*)::int from public.folio_items where folio_id = '60000000-0000-4000-8000-000000000601' and source_type = 'room' and business_date = date '2026-05-09'),
  1,
  'night audit posts one room charge per folio/date'
);

select is(
  (select status from public.business_dates where property_id = '60000000-0000-4000-8000-000000000001' and business_date = date '2026-05-09'),
  'closed'::public.business_date_status,
  'night audit locks business date'
);

select is(
  (select status from public.business_dates where property_id = '60000000-0000-4000-8000-000000000001' and business_date = date '2026-05-10'),
  'open'::public.business_date_status,
  'night audit opens next business date'
);

select test.set_auth_user('60000000-0000-4000-8000-000000000102');

select ok(
  test.expect_error($$
    update public.bookings
    set notes = 'late edit'
    where id = '60000000-0000-4000-8000-000000000501'
  $$),
  'locked business date blocks normal booking edits'
);

select test.set_auth_user('60000000-0000-4000-8000-000000000101');

select is(
  ((public.fn_revenue_summary('60000000-0000-4000-8000-000000000001', date '2026-05-09', date '2026-05-09')->>'room_revenue')::numeric),
  100::numeric,
  'revenue summary calculates room revenue'
);

select is(
  (select count(*)::int from public.fn_c65_export_rows('60000000-0000-4000-8000-000000000001', date '2026-05-09', date '2026-05-10')),
  1,
  'C65 export returns checked-in/checked-out guest rows'
);

select * from finish();

rollback;

