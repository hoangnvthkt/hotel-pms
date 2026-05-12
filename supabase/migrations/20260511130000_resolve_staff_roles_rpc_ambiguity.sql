-- Resolve PostgREST RPC ambiguity for fn_set_staff_roles by exposing one text[] signature.

drop function if exists public.fn_set_staff_roles(uuid, public.pms_role[]);
drop function if exists public.fn_set_staff_roles(uuid, text[]);

create or replace function public.fn_set_staff_roles(
  p_profile_id uuid,
  p_roles text[]
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
  v_roles public.pms_role[];
begin
  if p_roles is null or array_length(p_roles, 1) is null then
    raise exception 'At least one role is required';
  end if;

  begin
    select array_agg(distinct role_text::public.pms_role order by role_text::public.pms_role)
    into v_roles
    from unnest(p_roles) as role_input(role_text);
  exception
    when invalid_text_representation then
      raise exception 'Invalid staff role';
  end;

  if v_roles is null or array_length(v_roles, 1) is null then
    raise exception 'At least one role is required';
  end if;

  if not private.can_manage_staff_profile(p_profile_id) then
    raise exception 'Not allowed to manage this staff profile';
  end if;

  if private.has_any_role(array['manager']::public.pms_role[])
     and not private.has_any_role(array['admin']::public.pms_role[])
     and v_roles && array['admin','manager','accountant']::public.pms_role[] then
    raise exception 'Manager cannot grant admin, manager, or accountant roles';
  end if;

  select property_id into v_property_id
  from public.profiles
  where id = p_profile_id;

  if v_property_id is null then
    raise exception 'Staff profile not found';
  end if;

  select coalesce(jsonb_agg(role order by role), '[]'::jsonb) into v_before
  from public.profile_roles
  where profile_id = p_profile_id;

  delete from public.profile_roles
  where profile_id = p_profile_id;

  insert into public.profile_roles (profile_id, role)
  select p_profile_id, role_input.role_value
  from unnest(v_roles) as role_input(role_value);

  select coalesce(jsonb_agg(role order by role), '[]'::jsonb) into v_after
  from public.profile_roles
  where profile_id = p_profile_id;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (v_property_id, auth.uid(), 'profile_roles', p_profile_id, 'set_staff_roles', v_before, v_after);
end;
$$;

revoke all on function public.fn_set_staff_roles(uuid, text[]) from public;
grant execute on function public.fn_set_staff_roles(uuid, text[]) to authenticated;
