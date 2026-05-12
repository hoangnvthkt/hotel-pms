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

select test.create_auth_user('40000000-0000-4000-8000-000000000101', 'checkin-rec@test.local');

insert into public.properties (id, name, address, total_rooms)
values ('40000000-0000-4000-8000-000000000001', 'Checkin Test', 'A', 2);

insert into public.profiles (id, property_id, full_name, email)
values ('40000000-0000-4000-8000-000000000101', '40000000-0000-4000-8000-000000000001', 'Reception', 'checkin-rec@test.local');

insert into public.profile_roles (profile_id, role)
values ('40000000-0000-4000-8000-000000000101', 'receptionist');

select test.set_auth_user('40000000-0000-4000-8000-000000000101');

insert into public.room_types (id, property_id, name, code, max_occupancy, bed_type, base_price)
values ('40000000-0000-4000-8000-000000000201', '40000000-0000-4000-8000-000000000001', 'Standard', 'STD', 2, 'Queen', 100);

insert into public.rooms (id, property_id, room_type_id, number, floor, status)
values
  ('40000000-0000-4000-8000-000000000301', '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000201', '401', 4, 'vacant_clean'),
  ('40000000-0000-4000-8000-000000000302', '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000201', '402', 4, 'vacant_dirty');

insert into public.guests (
  id, property_id, first_name, last_name, full_name, phone, nationality,
  document_type, document_number, document_issue_date, document_issue_place,
  date_of_birth, gender, occupation, current_address, stay_purpose
)
values (
  '40000000-0000-4000-8000-000000000401',
  '40000000-0000-4000-8000-000000000001',
  'A', 'Guest', 'A Guest', '0900000000', 'VN',
  'cccd', '001400', date '2020-01-01', 'HCMC',
  date '1990-01-01', 'male', 'Engineer', 'HCMC', 'travel'
);

insert into public.bookings (
  id, booking_number, property_id, guest_id, check_in, check_out, nights,
  status, rate_per_night, total_amount, deposit_amount, deposit_paid
)
values
  ('40000000-0000-4000-8000-000000000501', 'BK-CI-1', '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000401', '2026-05-10 14:00+07', '2026-05-11 12:00+07', 1, 'confirmed', 100, 100, 30, true),
  ('40000000-0000-4000-8000-000000000502', 'BK-CI-2', '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000401', '2026-05-12 14:00+07', '2026-05-13 12:00+07', 1, 'confirmed', 100, 100, 0, false);

insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
values
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000501', '40000000-0000-4000-8000-000000000301', '2026-05-10 14:00+07', '2026-05-11 12:00+07', 'confirmed'),
  ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000502', '40000000-0000-4000-8000-000000000302', '2026-05-12 14:00+07', '2026-05-13 12:00+07', 'confirmed');

set local role authenticated;
select public.fn_check_in_booking('40000000-0000-4000-8000-000000000501', '40000000-0000-4000-8000-000000000301', null);
reset role;

select is(
  (select status from public.bookings where id = '40000000-0000-4000-8000-000000000501'),
  'checked_in'::public.booking_status,
  'check-in moves booking to checked_in'
);

select is(
  (select status from public.rooms where id = '40000000-0000-4000-8000-000000000301'),
  'occupied'::public.room_status,
  'check-in moves room to occupied'
);

select is(
  (select count(*)::int from public.folios where booking_id = '40000000-0000-4000-8000-000000000501' and parent_folio_id is null),
  1,
  'check-in creates exactly one master folio'
);

select is(
  (select count(*)::int from public.folio_items where source_type = 'deposit' and type = 'credit'),
  1,
  'paid deposit is opened as folio credit'
);

select is(
  (
    select count(*)::int
    from public.audit_logs
    where entity_type = 'booking'
      and entity_id = '40000000-0000-4000-8000-000000000501'
      and action = 'check_in'
      and actor_id = '40000000-0000-4000-8000-000000000101'
  ),
  1,
  'check-in writes audit log under authenticated RLS'
);

select public.fn_check_in_booking('40000000-0000-4000-8000-000000000501', '40000000-0000-4000-8000-000000000301', null);

select is(
  (select count(*)::int from public.folios where booking_id = '40000000-0000-4000-8000-000000000501' and parent_folio_id is null),
  1,
  'second check-in call does not duplicate master folio'
);

select ok(
  test.expect_error($$
    select public.fn_check_in_booking(
      '40000000-0000-4000-8000-000000000502',
      '40000000-0000-4000-8000-000000000302',
      null
    )
  $$),
  'receptionist cannot check into non-vacant-clean room'
);

select ok(
  exists (
    select 1
    from public.booking_rooms br
    join public.folios f on f.booking_id = br.booking_id
    where br.booking_id = '40000000-0000-4000-8000-000000000501'
      and br.status = 'checked_in'
      and f.status = 'open'
  ),
  'checked-in booking has active room assignment and open folio'
);

select * from finish();

rollback;
