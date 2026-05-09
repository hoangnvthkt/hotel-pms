begin;

set search_path = public, extensions;

select plan(7);

insert into public.roles (name, description) values
  ('admin', 'Admin'),
  ('manager', 'Manager'),
  ('receptionist', 'Receptionist'),
  ('hk_supervisor', 'HK supervisor'),
  ('hk_staff', 'HK staff'),
  ('accountant', 'Accountant')
on conflict do nothing;

select test.create_auth_user('20000000-0000-4000-8000-000000000101', 'rooms-manager@test.local');

insert into public.properties (id, name, address, total_rooms)
values ('20000000-0000-4000-8000-000000000001', 'Rooms Test', 'A', 4);

insert into public.profiles (id, property_id, full_name, email)
values ('20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000001', 'Rooms Manager', 'rooms-manager@test.local');

insert into public.profile_roles (profile_id, role)
values ('20000000-0000-4000-8000-000000000101', 'manager');

select test.set_auth_user('20000000-0000-4000-8000-000000000101');

insert into public.room_types (id, property_id, name, code, max_occupancy, bed_type, base_price)
values ('20000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000001', 'Standard', 'STD', 2, 'Queen', 100);

insert into public.rooms (id, property_id, room_type_id, number, floor, status)
values
  ('20000000-0000-4000-8000-000000000301', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000201', '201', 2, 'vacant_clean'),
  ('20000000-0000-4000-8000-000000000302', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000201', '202', 2, 'occupied'),
  ('20000000-0000-4000-8000-000000000303', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000201', '203', 2, 'out_of_order'),
  ('20000000-0000-4000-8000-000000000304', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000201', '204', 2, 'blocked');

select ok(
  test.expect_error($$
    delete from public.room_types where id = '20000000-0000-4000-8000-000000000201'
  $$),
  'room type with rooms cannot be deleted'
);

select ok(
  test.expect_error($$
    insert into public.room_rates (property_id, room_type_id, rate_code, name, amount, start_date, end_date)
    values (
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000201',
      'SEASONAL',
      'Bad Seasonal',
      100,
      date '2026-05-10',
      date '2026-05-01'
    )
  $$),
  'seasonal rate start/end date is enforced'
);

select is(
  (
    select count(*)::int
    from public.fn_check_availability(
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000201',
      '2026-05-10 14:00+07',
      '2026-05-11 12:00+07'
    )
  ),
  1,
  'availability excludes occupied, out_of_order, and blocked rooms'
);

select ok(
  test.expect_error($$
    select public.fn_change_room_status(
      '20000000-0000-4000-8000-000000000302',
      'vacant_clean',
      'bad direct transition'
    )
  $$),
  'invalid occupied -> vacant_clean transition is rejected'
);

select ok(
  test.expect_success($$
    update public.rooms set status = 'vacant_dirty' where id = '20000000-0000-4000-8000-000000000301'
  $$),
  'fixture room can be moved to dirty state'
);

select ok(
  test.expect_success($$
    select public.fn_change_room_status(
      '20000000-0000-4000-8000-000000000301',
      'inspected',
      'cleaned'
    )
  $$),
  'valid vacant_dirty -> inspected transition succeeds'
);

select is(
  (select count(*)::int from public.room_status_history where room_id = '20000000-0000-4000-8000-000000000301'),
  1,
  'room status history is recorded'
);

select * from finish();

rollback;

