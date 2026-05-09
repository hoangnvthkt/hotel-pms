-- Test harness support for Supabase pgTAP database tests.
-- This migration intentionally avoids production fixtures in public schemas.

create extension if not exists pgtap with schema extensions;
create extension if not exists pgcrypto;

create schema if not exists test;

comment on schema test is 'Helpers used by Supabase pgTAP tests. Do not expose through the Data API.';

create or replace function test.set_auth_user(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

create or replace function test.clear_auth_user()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end;
$$;

create or replace function test.create_auth_user(
  p_user_id uuid,
  p_email text default null
)
returns uuid
language plpgsql
as $$
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values (
    p_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    coalesce(p_email, p_user_id::text || '@test.local'),
    crypt('password', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{}'::jsonb,
    '{}'::jsonb
  )
  on conflict (id) do nothing;

  return p_user_id;
end;
$$;

create or replace function test.create_property(
  p_name text default 'Test Hotel'
)
returns uuid
language plpgsql
as $$
declare
  v_property_id uuid := gen_random_uuid();
begin
  insert into public.properties (id, name, address, total_rooms)
  values (v_property_id, p_name, 'Test Address', 1);

  return v_property_id;
end;
$$;

create or replace function test.expect_error(p_sql text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end;
$$;

create or replace function test.expect_success(p_sql text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return true;
exception when others then
  return false;
end;
$$;
