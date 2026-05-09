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

insert into public.properties (id, name, address, total_rooms)
values
  ('10000000-0000-4000-8000-000000000001', 'RBAC A', 'A', 1),
  ('10000000-0000-4000-8000-000000000002', 'RBAC B', 'B', 1);

select test.create_auth_user('10000000-0000-4000-8000-000000000101', 'rbac-a@test.local');
select test.create_auth_user('10000000-0000-4000-8000-000000000102', 'rbac-b@test.local');

insert into public.profiles (id, property_id, full_name, email)
values
  ('10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000001', 'User A', 'rbac-a@test.local'),
  ('10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000002', 'User B', 'rbac-b@test.local');

insert into public.profile_roles (profile_id, role)
values
  ('10000000-0000-4000-8000-000000000101', 'manager'),
  ('10000000-0000-4000-8000-000000000102', 'receptionist');

select ok(
  test.expect_error($$
    insert into public.profiles (id, property_id, full_name)
    values ('10000000-0000-4000-8000-000000000199', null, 'No Property')
  $$),
  'profile without property is rejected'
);

select ok(
  test.expect_error($$
    insert into public.profile_roles (profile_id, role)
    values ('10000000-0000-4000-8000-000000000101', 'manager')
  $$),
  'duplicate role assignment is rejected'
);

select test.set_auth_user('10000000-0000-4000-8000-000000000101');

select is(
  private.current_property_id(),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'current_property_id resolves from profiles table'
);

select ok(
  private.has_any_role(array['admin','manager']::public.pms_role[]),
  'has_any_role resolves from profile_roles table'
);

set local role authenticated;

select is(
  (select count(*)::int from public.profiles where property_id = '10000000-0000-4000-8000-000000000002'),
  0,
  'RLS hides profiles from another property'
);

reset role;

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('profiles', 'profile_roles', 'roles')),
  3,
  'RBAC tables have expected select policies'
);

select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_active_property_idx'),
  'profiles active/property index exists'
);

select * from finish();

rollback;

