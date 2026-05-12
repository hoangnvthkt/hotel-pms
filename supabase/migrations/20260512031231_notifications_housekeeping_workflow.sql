-- Notifications and Housekeeping workflow completion.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('booking', 'payment', 'housekeeping', 'room', 'night_audit', 'system')),
  severity text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  title text not null check (length(trim(title)) > 0),
  body text,
  entity_type text,
  entity_id uuid,
  action_url text,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, read_at, dismissed_at, created_at desc);

create index if not exists notifications_property_created_idx
  on public.notifications (property_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notification recipient select" on public.notifications;
create policy "notification recipient select" on public.notifications
  for select to authenticated
  using (
    property_id = (select private.current_property_id())
    and recipient_id = (select auth.uid())
  );

drop policy if exists "notification recipient update" on public.notifications;
create policy "notification recipient update" on public.notifications
  for update to authenticated
  using (
    property_id = (select private.current_property_id())
    and recipient_id = (select auth.uid())
  )
  with check (
    property_id = (select private.current_property_id())
    and recipient_id = (select auth.uid())
  );

drop policy if exists "notification recipient delete" on public.notifications;
create policy "notification recipient delete" on public.notifications
  for delete to authenticated
  using (
    property_id = (select private.current_property_id())
    and recipient_id = (select auth.uid())
  );

grant select, update, delete on public.notifications to authenticated;

create or replace function private.create_notification(
  p_property_id uuid,
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type text,
  p_severity text,
  p_title text,
  p_body text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_action_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_notification_id uuid;
begin
  if p_recipient_id is null then
    return null;
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_recipient_id
      and property_id = p_property_id
      and is_active = true
  ) then
    return null;
  end if;

  insert into public.notifications (
    property_id,
    recipient_id,
    actor_id,
    type,
    severity,
    title,
    body,
    entity_type,
    entity_id,
    action_url
  )
  values (
    p_property_id,
    p_recipient_id,
    p_actor_id,
    p_type,
    coalesce(p_severity, 'info'),
    p_title,
    p_body,
    p_entity_type,
    p_entity_id,
    p_action_url
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

create or replace function private.notify_roles(
  p_property_id uuid,
  p_roles public.pms_role[],
  p_actor_id uuid,
  p_type text,
  p_severity text,
  p_title text,
  p_body text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_action_url text default null
)
returns int
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_profile record;
  v_count int := 0;
begin
  for v_profile in
    select distinct p.id
    from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id
    where p.property_id = p_property_id
      and p.is_active = true
      and pr.role = any(p_roles)
  loop
    perform private.create_notification(
      p_property_id,
      v_profile.id,
      p_actor_id,
      p_type,
      p_severity,
      p_title,
      p_body,
      p_entity_type,
      p_entity_id,
      p_action_url
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function private.create_notification(uuid, uuid, uuid, text, text, text, text, text, uuid, text) to authenticated;
grant execute on function private.notify_roles(uuid, public.pms_role[], uuid, text, text, text, text, text, uuid, text) to authenticated;

create or replace function public.fn_mark_notification_read(p_notification_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_id = auth.uid()
    and property_id = private.current_property_id();

  if not found then
    raise exception 'Notification not found';
  end if;

  return p_notification_id;
end;
$$;

create or replace function public.fn_mark_all_notifications_read()
returns int
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_count int;
begin
  update public.notifications
  set read_at = coalesce(read_at, now())
  where recipient_id = auth.uid()
    and property_id = private.current_property_id()
    and read_at is null
    and dismissed_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.fn_dismiss_notification(p_notification_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  update public.notifications
  set dismissed_at = coalesce(dismissed_at, now()),
      read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_id = auth.uid()
    and property_id = private.current_property_id();

  if not found then
    raise exception 'Notification not found';
  end if;

  return p_notification_id;
end;
$$;

create or replace function public.fn_create_hk_task(
  p_room_id uuid,
  p_task_type text,
  p_priority public.priority_level default 'normal',
  p_notes text default null,
  p_assigned_to uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_property_id uuid := private.current_property_id();
  v_task_id uuid;
  v_room record;
begin
  if not private.has_any_role(array['admin','manager','hk_supervisor','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to create housekeeping tasks';
  end if;

  if p_task_type not in ('checkout_clean', 'daily_service', 'turndown', 'inspection', 'deep_clean') then
    raise exception 'Invalid housekeeping task type';
  end if;

  select id, number into v_room
  from public.rooms
  where id = p_room_id
    and property_id = v_property_id;

  if not found then
    raise exception 'Room not found';
  end if;

  insert into public.housekeeping_tasks (
    property_id,
    room_id,
    task_type,
    status,
    priority,
    assigned_to,
    notes
  )
  values (
    v_property_id,
    p_room_id,
    p_task_type,
    'pending',
    coalesce(p_priority, 'normal'),
    p_assigned_to,
    p_notes
  )
  returning id into v_task_id;

  if p_assigned_to is not null then
    insert into public.hk_assignments (property_id, task_id, assigned_to, assigned_by)
    values (v_property_id, v_task_id, p_assigned_to, auth.uid())
    on conflict (task_id, assigned_to) do nothing;

    perform private.create_notification(
      v_property_id,
      p_assigned_to,
      auth.uid(),
      'housekeeping',
      'info',
      'Bạn có task Housekeeping mới',
      'Phòng ' || v_room.number || ' cần xử lý: ' || p_task_type,
      'housekeeping_task',
      v_task_id,
      '/housekeeping'
    );
  else
    perform private.notify_roles(
      v_property_id,
      array['admin','manager','hk_supervisor']::public.pms_role[],
      auth.uid(),
      'housekeeping',
      'warning',
      'Task Housekeeping chưa giao',
      'Phòng ' || v_room.number || ' có task mới chưa phân công.',
      'housekeeping_task',
      v_task_id,
      '/housekeeping'
    );
  end if;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_property_id,
    auth.uid(),
    'housekeeping_task',
    v_task_id,
    'create',
    jsonb_build_object('room_id', p_room_id, 'task_type', p_task_type, 'assigned_to', p_assigned_to)
  );

  return v_task_id;
end;
$$;

create or replace function public.fn_assign_hk_task(
  p_task_id uuid,
  p_assigned_to uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_task record;
  v_assignment_id uuid;
begin
  if not private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[]) then
    raise exception 'Not allowed to assign housekeeping tasks';
  end if;

  select ht.*, r.number as room_number into v_task
  from public.housekeeping_tasks ht
  join public.rooms r on r.id = ht.room_id
  where ht.id = p_task_id
    and ht.property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Housekeeping task not found';
  end if;

  insert into public.hk_assignments (property_id, task_id, assigned_to, assigned_by)
  values (v_task.property_id, p_task_id, p_assigned_to, auth.uid())
  on conflict (task_id, assigned_to) do update set assigned_at = now(), assigned_by = excluded.assigned_by
  returning id into v_assignment_id;

  update public.housekeeping_tasks
  set assigned_to = p_assigned_to
  where id = p_task_id;

  perform private.create_notification(
    v_task.property_id,
    p_assigned_to,
    auth.uid(),
    'housekeeping',
    'info',
    'Bạn được giao task Housekeeping',
    'Phòng ' || v_task.room_number || ' cần xử lý: ' || v_task.task_type,
    'housekeeping_task',
    p_task_id,
    '/housekeeping'
  );

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_task.property_id,
    auth.uid(),
    'housekeeping_task',
    p_task_id,
    'assign',
    jsonb_build_object('assigned_to', p_assigned_to)
  );

  return v_assignment_id;
end;
$$;

create or replace function public.fn_update_hk_task_status(
  p_task_id uuid,
  p_to_status public.hk_task_status,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_task record;
  v_room_status public.room_status;
  v_is_supervisor boolean := private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[]);
begin
  select ht.*, r.number as room_number into v_task
  from public.housekeeping_tasks ht
  join public.rooms r on r.id = ht.room_id
  where ht.id = p_task_id
    and ht.property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Housekeeping task not found';
  end if;

  if not v_is_supervisor and v_task.assigned_to is distinct from auth.uid() then
    raise exception 'HK staff can only update assigned tasks';
  end if;

  if p_to_status in ('inspected', 'rejected') and not v_is_supervisor then
    raise exception 'Only supervisor/manager/admin can inspect or reject tasks';
  end if;

  if p_to_status = 'rejected' and length(trim(coalesce(p_notes, ''))) = 0 then
    raise exception 'Reject note is required';
  end if;

  if not private.hk_transition_allowed(v_task.status, p_to_status) then
    raise exception 'Invalid HK task transition: % -> %', v_task.status, p_to_status;
  end if;

  update public.housekeeping_tasks
  set status = p_to_status,
      notes = case when p_to_status not in ('inspected', 'rejected') then coalesce(p_notes, notes) else notes end,
      started_at = case when p_to_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when p_to_status = 'done' then now() else completed_at end,
      inspected_at = case when p_to_status in ('inspected', 'rejected') then now() else inspected_at end,
      inspector_id = case when p_to_status in ('inspected', 'rejected') then auth.uid() else inspector_id end,
      inspection_notes = case when p_to_status in ('inspected', 'rejected') then p_notes else inspection_notes end
  where id = p_task_id;

  if p_to_status = 'done' then
    perform private.notify_roles(
      v_task.property_id,
      array['admin','manager','hk_supervisor']::public.pms_role[],
      auth.uid(),
      'housekeeping',
      'success',
      'Task Housekeeping chờ kiểm tra',
      'Phòng ' || v_task.room_number || ' đã hoàn thành và chờ duyệt.',
      'housekeeping_task',
      p_task_id,
      '/housekeeping'
    );
  elsif p_to_status = 'rejected' then
    perform private.create_notification(
      v_task.property_id,
      v_task.assigned_to,
      auth.uid(),
      'housekeeping',
      'warning',
      'Task Housekeeping bị từ chối',
      'Phòng ' || v_task.room_number || ': ' || coalesce(p_notes, 'Cần làm lại.'),
      'housekeeping_task',
      p_task_id,
      '/housekeeping'
    );
  elsif p_to_status = 'inspected' then
    select status into v_room_status
    from public.rooms
    where id = v_task.room_id;

    update public.rooms
    set status = 'vacant_clean',
        last_cleaned_at = now()
    where id = v_task.room_id
      and status in ('vacant_dirty', 'inspected');

    insert into public.room_status_history (property_id, room_id, from_status, to_status, reason, changed_by)
    values (v_task.property_id, v_task.room_id, v_room_status, 'vacant_clean', 'hk_inspected', auth.uid());

    if v_task.assigned_to is not null then
      perform private.create_notification(
        v_task.property_id,
        v_task.assigned_to,
        auth.uid(),
        'housekeeping',
        'success',
        'Task Housekeeping đã được duyệt',
        'Phòng ' || v_task.room_number || ' đạt kiểm tra.',
        'housekeeping_task',
        p_task_id,
        '/housekeeping'
      );
    end if;
  end if;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    v_task.property_id,
    auth.uid(),
    'housekeeping_task',
    p_task_id,
    'status_change',
    jsonb_build_object('status', v_task.status),
    jsonb_build_object('status', p_to_status, 'notes', p_notes)
  );

  return p_task_id;
end;
$$;

create or replace function public.fn_create_lost_found(
  p_room_id uuid,
  p_guest_id uuid default null,
  p_description text default null,
  p_storage_location text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_property_id uuid := private.current_property_id();
  v_item_id uuid;
begin
  if not private.has_any_role(array['admin','manager','hk_supervisor','hk_staff','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to create lost found items';
  end if;

  if length(trim(coalesce(p_description, ''))) = 0 then
    raise exception 'Lost found description is required';
  end if;

  if p_room_id is not null and not exists (
    select 1 from public.rooms where id = p_room_id and property_id = v_property_id
  ) then
    raise exception 'Room not found';
  end if;

  if p_guest_id is not null and not exists (
    select 1 from public.guests where id = p_guest_id and property_id = v_property_id
  ) then
    raise exception 'Guest not found';
  end if;

  insert into public.lost_found (
    property_id,
    room_id,
    guest_id,
    description,
    found_by,
    status,
    storage_location,
    notes
  )
  values (
    v_property_id,
    p_room_id,
    p_guest_id,
    trim(p_description),
    auth.uid(),
    'stored',
    nullif(trim(coalesce(p_storage_location, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_item_id;

  perform private.notify_roles(
    v_property_id,
    array['admin','manager','hk_supervisor']::public.pms_role[],
    auth.uid(),
    'housekeeping',
    'info',
    'Có vật thất lạc mới',
    trim(p_description),
    'lost_found',
    v_item_id,
    '/housekeeping'
  );

  return v_item_id;
end;
$$;

create or replace function public.fn_update_lost_found_status(
  p_item_id uuid,
  p_status text,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if not private.has_any_role(array['admin','manager','hk_supervisor','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to update lost found items';
  end if;

  if p_status not in ('stored', 'claimed', 'disposed') then
    raise exception 'Invalid lost found status';
  end if;

  update public.lost_found
  set status = p_status,
      notes = coalesce(p_notes, notes)
  where id = p_item_id
    and property_id = private.current_property_id();

  if not found then
    raise exception 'Lost found item not found';
  end if;

  return p_item_id;
end;
$$;

grant execute on function public.fn_mark_notification_read(uuid) to authenticated;
grant execute on function public.fn_mark_all_notifications_read() to authenticated;
grant execute on function public.fn_dismiss_notification(uuid) to authenticated;
grant execute on function public.fn_create_hk_task(uuid, text, public.priority_level, text, uuid) to authenticated;
grant execute on function public.fn_assign_hk_task(uuid, uuid) to authenticated;
grant execute on function public.fn_update_hk_task_status(uuid, public.hk_task_status, text) to authenticated;
grant execute on function public.fn_create_lost_found(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.fn_update_lost_found_status(uuid, text, text) to authenticated;

revoke all on function public.fn_mark_notification_read(uuid) from public, anon;
revoke all on function public.fn_mark_all_notifications_read() from public, anon;
revoke all on function public.fn_dismiss_notification(uuid) from public, anon;
revoke all on function public.fn_create_hk_task(uuid, text, public.priority_level, text, uuid) from public, anon;
revoke all on function public.fn_assign_hk_task(uuid, uuid) from public, anon;
revoke all on function public.fn_update_hk_task_status(uuid, public.hk_task_status, text) from public, anon;
revoke all on function public.fn_create_lost_found(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.fn_update_lost_found_status(uuid, text, text) from public, anon;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
