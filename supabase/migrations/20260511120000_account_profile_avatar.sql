-- Account self-service, staff profile management, and avatar storage.

alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists position_title text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_path_shape'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_path_shape
      check (
        avatar_path is null
        or avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/avatar\.(jpg|jpeg|png|webp)$'
      );
  end if;
end $$;

create index if not exists profiles_property_active_name_idx
  on public.profiles (property_id, is_active, full_name);

create or replace function private.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at_trg on public.profiles;
create trigger profiles_updated_at_trg
  before update on public.profiles
  for each row execute function private.set_profiles_updated_at();

create or replace function private.assert_avatar_path_for_profile(
  p_profile_id uuid,
  p_property_id uuid,
  p_avatar_path text
)
returns void
language plpgsql
stable
set search_path = public, private
as $$
begin
  if p_avatar_path is null then
    return;
  end if;

  if split_part(p_avatar_path, '/', 1) <> p_property_id::text
     or split_part(p_avatar_path, '/', 2) <> p_profile_id::text
     or split_part(p_avatar_path, '/', 3) !~ '^avatar\.(jpg|jpeg|png|webp)$' then
    raise exception 'Invalid avatar path for profile';
  end if;
end;
$$;

create or replace function private.can_manage_staff_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and p.property_id = private.current_property_id()
  )
  and (
    private.has_any_role(array['admin']::public.pms_role[])
    or (
      private.has_any_role(array['manager']::public.pms_role[])
      and not private.profile_has_any_role(
        p_profile_id,
        array['admin','manager','accountant']::public.pms_role[]
      )
    )
  );
$$;

create or replace function public.fn_update_my_profile(
  p_full_name text default null,
  p_phone text default null,
  p_avatar_path text default null,
  p_position_title text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_profile public.profiles%rowtype;
  v_before jsonb;
begin
  select * into v_profile
  from public.profiles
  where id = auth.uid()
    and is_active = true;

  if not found then
    raise exception 'Active profile not found';
  end if;

  perform private.assert_avatar_path_for_profile(v_profile.id, v_profile.property_id, coalesce(p_avatar_path, v_profile.avatar_path));

  v_before := to_jsonb(v_profile);

  update public.profiles
  set
    full_name = case
      when p_full_name is null then full_name
      when length(trim(p_full_name)) = 0 then full_name
      else trim(p_full_name)
    end,
    phone = case
      when p_phone is null then phone
      when length(trim(p_phone)) = 0 then null
      else trim(p_phone)
    end,
    avatar_path = coalesce(p_avatar_path, avatar_path),
    position_title = case
      when p_position_title is null then position_title
      when length(trim(p_position_title)) = 0 then null
      else trim(p_position_title)
    end
  where id = v_profile.id
  returning * into v_profile;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (v_profile.property_id, auth.uid(), 'profile', v_profile.id, 'update_my_profile', v_before, to_jsonb(v_profile));

  return v_profile;
end;
$$;

create or replace function public.fn_clear_my_avatar()
returns public.profiles
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_profile public.profiles%rowtype;
  v_before jsonb;
begin
  select * into v_profile
  from public.profiles
  where id = auth.uid()
    and is_active = true;

  if not found then
    raise exception 'Active profile not found';
  end if;

  v_before := to_jsonb(v_profile);

  update public.profiles
  set avatar_path = null
  where id = v_profile.id
  returning * into v_profile;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (v_profile.property_id, auth.uid(), 'profile', v_profile.id, 'clear_my_avatar', v_before, to_jsonb(v_profile));

  return v_profile;
end;
$$;

create or replace function public.fn_update_staff_profile(
  p_profile_id uuid,
  p_full_name text default null,
  p_phone text default null,
  p_is_active boolean default null,
  p_avatar_path text default null,
  p_position_title text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_profile public.profiles%rowtype;
  v_before jsonb;
begin
  if not private.can_manage_staff_profile(p_profile_id) then
    raise exception 'Not allowed to manage this staff profile';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    raise exception 'Staff profile not found';
  end if;

  perform private.assert_avatar_path_for_profile(v_profile.id, v_profile.property_id, coalesce(p_avatar_path, v_profile.avatar_path));

  v_before := to_jsonb(v_profile);

  update public.profiles
  set
    full_name = case
      when p_full_name is null then full_name
      when length(trim(p_full_name)) = 0 then full_name
      else trim(p_full_name)
    end,
    phone = case
      when p_phone is null then phone
      when length(trim(p_phone)) = 0 then null
      else trim(p_phone)
    end,
    is_active = coalesce(p_is_active, is_active),
    avatar_path = coalesce(p_avatar_path, avatar_path),
    position_title = case
      when p_position_title is null then position_title
      when length(trim(p_position_title)) = 0 then null
      else trim(p_position_title)
    end
  where id = p_profile_id
  returning * into v_profile;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (v_profile.property_id, auth.uid(), 'profile', v_profile.id, 'update_staff_profile', v_before, to_jsonb(v_profile));

  return v_profile;
end;
$$;

create or replace function public.fn_set_staff_roles(
  p_profile_id uuid,
  p_roles public.pms_role[]
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_property_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if p_roles is null or array_length(p_roles, 1) is null then
    raise exception 'At least one role is required';
  end if;

  if not private.can_manage_staff_profile(p_profile_id) then
    raise exception 'Not allowed to manage this staff profile';
  end if;

  if private.has_any_role(array['manager']::public.pms_role[])
     and not private.has_any_role(array['admin']::public.pms_role[])
     and p_roles && array['admin','manager','accountant']::public.pms_role[] then
    raise exception 'Manager cannot grant admin, manager, or accountant roles';
  end if;

  select property_id into v_property_id
  from public.profiles
  where id = p_profile_id;

  select coalesce(jsonb_agg(role order by role), '[]'::jsonb) into v_before
  from public.profile_roles
  where profile_id = p_profile_id;

  delete from public.profile_roles
  where profile_id = p_profile_id;

  insert into public.profile_roles (profile_id, role)
  select p_profile_id, role_input.role
  from unnest(p_roles) as role_input(role)
  group by role_input.role;

  select coalesce(jsonb_agg(role order by role), '[]'::jsonb) into v_after
  from public.profile_roles
  where profile_id = p_profile_id;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (v_property_id, auth.uid(), 'profile_roles', p_profile_id, 'set_staff_roles', v_before, v_after);
end;
$$;

create or replace function public.fn_deactivate_staff(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if p_profile_id = auth.uid() then
    raise exception 'Cannot deactivate your own account';
  end if;

  perform public.fn_update_staff_profile(
    p_profile_id => p_profile_id,
    p_is_active => false
  );
end;
$$;

create or replace function public.fn_reactivate_staff(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  perform public.fn_update_staff_profile(
    p_profile_id => p_profile_id,
    p_is_active => true
  );
end;
$$;

revoke all on function public.fn_update_my_profile(text, text, text, text) from public;
revoke all on function public.fn_clear_my_avatar() from public;
revoke all on function public.fn_update_staff_profile(uuid, text, text, boolean, text, text) from public;
revoke all on function public.fn_set_staff_roles(uuid, public.pms_role[]) from public;
revoke all on function public.fn_deactivate_staff(uuid) from public;
revoke all on function public.fn_reactivate_staff(uuid) from public;

grant execute on function public.fn_update_my_profile(text, text, text, text) to authenticated;
grant execute on function public.fn_clear_my_avatar() to authenticated;
grant execute on function public.fn_update_staff_profile(uuid, text, text, boolean, text, text) to authenticated;
grant execute on function public.fn_set_staff_roles(uuid, public.pms_role[]) to authenticated;
grant execute on function public.fn_deactivate_staff(uuid) to authenticated;
grant execute on function public.fn_reactivate_staff(uuid) to authenticated;

insert into storage.buckets (
  id,
  name,
  "public",
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  false,
  2097152,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set
  "public" = excluded."public",
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars select own or staff same property" on storage.objects;
create policy "avatars select own or staff same property"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select private.current_property_id())::text
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or (select private.has_any_role(array['admin','manager']::public.pms_role[]))
    )
  );

drop policy if exists "avatars insert own profile folder" on storage.objects;
create policy "avatars insert own profile folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select private.current_property_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and lower(storage.filename(name)) ~ '^avatar\.(jpg|jpeg|png|webp)$'
  );

drop policy if exists "avatars update own profile folder" on storage.objects;
create policy "avatars update own profile folder"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select private.current_property_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select private.current_property_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and lower(storage.filename(name)) ~ '^avatar\.(jpg|jpeg|png|webp)$'
  );

drop policy if exists "avatars delete own profile folder" on storage.objects;
create policy "avatars delete own profile folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select private.current_property_id())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
