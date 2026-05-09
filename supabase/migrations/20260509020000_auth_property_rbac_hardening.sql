-- Harden auth/property/RBAC invariants without relying on user-editable metadata.

create index if not exists profiles_active_property_idx
  on public.profiles (property_id, is_active);

create index if not exists profile_roles_role_profile_idx
  on public.profile_roles (role, profile_id);

create index if not exists audit_logs_property_entity_idx
  on public.audit_logs (property_id, entity_type, entity_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_full_name_not_blank'
  ) then
    alter table public.profiles
      add constraint profiles_full_name_not_blank
      check (length(trim(full_name)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'settings_key_not_blank'
  ) then
    alter table public.settings
      add constraint settings_key_not_blank
      check (length(trim(key)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'audit_logs_entity_action_not_blank'
  ) then
    alter table public.audit_logs
      add constraint audit_logs_entity_action_not_blank
      check (length(trim(entity_type)) > 0 and length(trim(action)) > 0);
  end if;
end $$;

create or replace function private.current_property_id()
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select p.property_id
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active = true
    and p.property_id is not null
$$;

create or replace function private.has_any_role(required_roles public.pms_role[])
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.profiles p on p.id = pr.profile_id
    join public.roles r on r.name = pr.role
    where pr.profile_id = auth.uid()
      and p.is_active = true
      and p.property_id is not null
      and r.name = any(required_roles)
  )
$$;

create or replace function private.has_role(required_role public.pms_role)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.has_any_role(array[required_role]::public.pms_role[])
$$;

create or replace function private.profile_has_any_role(
  p_profile_id uuid,
  required_roles public.pms_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.profiles p on p.id = pr.profile_id
    where pr.profile_id = p_profile_id
      and p.is_active = true
      and pr.role = any(required_roles)
  )
$$;

create or replace function private.assert_actor_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_actor_property uuid;
begin
  if new.actor_id is null then
    return new;
  end if;

  select property_id into v_actor_property
  from public.profiles
  where id = new.actor_id and is_active = true;

  if v_actor_property is distinct from new.property_id then
    raise exception 'Audit actor must belong to the same property';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'audit_logs_actor_same_property_trg'
  ) then
    create trigger audit_logs_actor_same_property_trg
      before insert or update on public.audit_logs
      for each row execute function private.assert_actor_same_property();
  end if;
end $$;

