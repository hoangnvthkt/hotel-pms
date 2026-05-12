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

insert into public.properties (id, name, address, total_rooms)
values ('70000000-0000-4000-8000-000000000001', 'Account Hotel', 'A', 1);

select test.create_auth_user('70000000-0000-4000-8000-000000000101', 'account-user-a@test.local');
select test.create_auth_user('70000000-0000-4000-8000-000000000102', 'account-user-b@test.local');
select test.create_auth_user('70000000-0000-4000-8000-000000000103', 'account-admin@test.local');
select test.create_auth_user('70000000-0000-4000-8000-000000000104', 'account-manager@test.local');
select test.create_auth_user('70000000-0000-4000-8000-000000000105', 'account-staff@test.local');
select test.create_auth_user('70000000-0000-4000-8000-000000000106', 'account-accountant@test.local');

insert into public.profiles (id, property_id, full_name, email)
values
  ('70000000-0000-4000-8000-000000000101', '70000000-0000-4000-8000-000000000001', 'User A', 'account-user-a@test.local'),
  ('70000000-0000-4000-8000-000000000102', '70000000-0000-4000-8000-000000000001', 'User B', 'account-user-b@test.local'),
  ('70000000-0000-4000-8000-000000000103', '70000000-0000-4000-8000-000000000001', 'Admin', 'account-admin@test.local'),
  ('70000000-0000-4000-8000-000000000104', '70000000-0000-4000-8000-000000000001', 'Manager', 'account-manager@test.local'),
  ('70000000-0000-4000-8000-000000000105', '70000000-0000-4000-8000-000000000001', 'Staff', 'account-staff@test.local'),
  ('70000000-0000-4000-8000-000000000106', '70000000-0000-4000-8000-000000000001', 'Accountant', 'account-accountant@test.local');

insert into public.profile_roles (profile_id, role)
values
  ('70000000-0000-4000-8000-000000000101', 'receptionist'),
  ('70000000-0000-4000-8000-000000000102', 'receptionist'),
  ('70000000-0000-4000-8000-000000000103', 'admin'),
  ('70000000-0000-4000-8000-000000000104', 'manager'),
  ('70000000-0000-4000-8000-000000000105', 'receptionist'),
  ('70000000-0000-4000-8000-000000000106', 'accountant');

select test.set_auth_user('70000000-0000-4000-8000-000000000101');

select ok(
  (public.fn_update_my_profile(
    'User A Updated',
    '0909000001',
    '70000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000101/avatar.webp',
    'Lễ tân ca sáng'
  )).id = '70000000-0000-4000-8000-000000000101'::uuid,
  'user can update own profile'
);

select is(
  (select full_name from public.profiles where id = '70000000-0000-4000-8000-000000000101'),
  'User A Updated',
  'own profile full name updated'
);

select ok(
  test.expect_error($$
    select public.fn_update_my_profile(
      'Invalid Avatar',
      null,
      '70000000-0000-4000-8000-000000000001/70000000-0000-4000-8000-000000000102/avatar.webp',
      null
    )
  $$),
  'user cannot set avatar path for another profile'
);

select ok(
  test.expect_error($$
    select public.fn_update_staff_profile(
      '70000000-0000-4000-8000-000000000102',
      'Illegal Staff Edit',
      null,
      null,
      null,
      null
    )
  $$),
  'regular user cannot update another staff profile'
);

select test.set_auth_user('70000000-0000-4000-8000-000000000104');

select ok(
  test.expect_success($$
    select public.fn_set_staff_roles(
      '70000000-0000-4000-8000-000000000105',
      array['hk_staff']::text[]
    )
  $$),
  'manager can assign operational staff role'
);

select ok(
  test.expect_error($$
    select public.fn_set_staff_roles(
      '70000000-0000-4000-8000-000000000105',
      array['admin']::text[]
    )
  $$),
  'manager cannot grant admin role'
);

select ok(
  test.expect_error($$
    select public.fn_deactivate_staff('70000000-0000-4000-8000-000000000106')
  $$),
  'manager cannot deactivate accountant profile'
);

select test.set_auth_user('70000000-0000-4000-8000-000000000103');

select ok(
  test.expect_success($$
    select public.fn_deactivate_staff('70000000-0000-4000-8000-000000000105')
  $$),
  'admin can deactivate staff profile'
);

select is(
  (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'avatars %'),
  4,
  'avatar storage policies exist'
);

select * from finish();

rollback;
