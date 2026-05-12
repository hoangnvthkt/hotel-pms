-- Guest service orders, complaints, and follow-up workflow.

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'guest_request_type') then
    create type public.guest_request_type as enum (
      'service_order',
      'complaint',
      'housekeeping',
      'maintenance',
      'billing',
      'lost_found',
      'special_request',
      'feedback'
    );
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'guest_request_status') then
    create type public.guest_request_status as enum (
      'new',
      'triaged',
      'assigned',
      'in_progress',
      'waiting_guest',
      'waiting_vendor',
      'resolved',
      'closed',
      'cancelled',
      'escalated'
    );
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'guest_request_source') then
    create type public.guest_request_source as enum (
      'front_desk',
      'phone',
      'email',
      'chat',
      'qr',
      'internal',
      'post_stay'
    );
  end if;
end $$;

create table if not exists public.guest_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  request_number text not null,
  type public.guest_request_type not null,
  status public.guest_request_status not null default 'new',
  priority public.priority_level not null default 'normal',
  source public.guest_request_source not null default 'front_desk',
  title text not null check (length(trim(title)) > 0),
  description text,
  booking_id uuid references public.bookings(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  department text not null default 'front_desk' check (department in ('front_desk', 'housekeeping', 'maintenance', 'accounting', 'management', 'restaurant', 'concierge')),
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution text,
  compensation_amount numeric(12,2) not null default 0 check (compensation_amount >= 0),
  folio_item_id uuid references public.folio_items(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, request_number)
);

create table if not exists public.guest_request_comments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  request_id uuid not null references public.guest_requests(id) on delete cascade,
  comment text not null check (length(trim(comment)) > 0),
  is_internal boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_request_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  request_id uuid not null references public.guest_requests(id) on delete cascade,
  event_type text not null check (length(trim(event_type)) > 0),
  old_status public.guest_request_status,
  new_status public.guest_request_status,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_request_attachments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  request_id uuid not null references public.guest_requests(id) on delete cascade,
  file_path text not null check (length(trim(file_path)) > 0),
  file_name text,
  mime_type text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create index if not exists guest_requests_property_status_idx
  on public.guest_requests (property_id, status, priority, due_at);

create index if not exists guest_requests_booking_idx
  on public.guest_requests (booking_id) where booking_id is not null;

create index if not exists guest_requests_guest_idx
  on public.guest_requests (guest_id) where guest_id is not null;

create index if not exists guest_requests_assigned_idx
  on public.guest_requests (assigned_to, status) where assigned_to is not null;

create index if not exists guest_request_comments_request_idx
  on public.guest_request_comments (request_id, created_at desc);

create index if not exists guest_request_events_request_idx
  on public.guest_request_events (request_id, created_at desc);

create or replace function private.touch_guest_request_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guest_requests_touch_updated_at_trg on public.guest_requests;
create trigger guest_requests_touch_updated_at_trg
  before update on public.guest_requests
  for each row execute function private.touch_guest_request_updated_at();

alter table public.guest_requests enable row level security;
alter table public.guest_request_comments enable row level security;
alter table public.guest_request_events enable row level security;
alter table public.guest_request_attachments enable row level security;

drop policy if exists "guest requests property select" on public.guest_requests;
create policy "guest requests property select"
  on public.guest_requests
  for select to authenticated
  using (property_id = (select private.current_property_id()));

drop policy if exists "guest requests staff insert" on public.guest_requests;
create policy "guest requests staff insert"
  on public.guest_requests
  for insert to authenticated
  with check (
    property_id = (select private.current_property_id())
    and private.has_any_role(array['admin','manager','receptionist','hk_supervisor','hk_staff','accountant']::public.pms_role[])
  );

drop policy if exists "guest requests staff update" on public.guest_requests;
create policy "guest requests staff update"
  on public.guest_requests
  for update to authenticated
  using (
    property_id = (select private.current_property_id())
    and (
      private.has_any_role(array['admin','manager','receptionist','hk_supervisor','accountant']::public.pms_role[])
      or assigned_to = (select auth.uid())
      or created_by = (select auth.uid())
    )
  )
  with check (property_id = (select private.current_property_id()));

drop policy if exists "guest request comments property select" on public.guest_request_comments;
create policy "guest request comments property select"
  on public.guest_request_comments
  for select to authenticated
  using (property_id = (select private.current_property_id()));

drop policy if exists "guest request comments staff insert" on public.guest_request_comments;
create policy "guest request comments staff insert"
  on public.guest_request_comments
  for insert to authenticated
  with check (
    property_id = (select private.current_property_id())
    and exists (
      select 1 from public.guest_requests gr
      where gr.id = request_id
        and gr.property_id = guest_request_comments.property_id
    )
  );

drop policy if exists "guest request events property select" on public.guest_request_events;
create policy "guest request events property select"
  on public.guest_request_events
  for select to authenticated
  using (property_id = (select private.current_property_id()));

drop policy if exists "guest request events staff insert" on public.guest_request_events;
create policy "guest request events staff insert"
  on public.guest_request_events
  for insert to authenticated
  with check (
    property_id = (select private.current_property_id())
    and private.has_any_role(array['admin','manager','receptionist','hk_supervisor','hk_staff','accountant']::public.pms_role[])
  );

drop policy if exists "guest request attachments property select" on public.guest_request_attachments;
create policy "guest request attachments property select"
  on public.guest_request_attachments
  for select to authenticated
  using (property_id = (select private.current_property_id()));

drop policy if exists "guest request attachments staff insert" on public.guest_request_attachments;
create policy "guest request attachments staff insert"
  on public.guest_request_attachments
  for insert to authenticated
  with check (
    property_id = (select private.current_property_id())
    and exists (
      select 1 from public.guest_requests gr
      where gr.id = request_id
        and gr.property_id = guest_request_attachments.property_id
    )
  );

grant select, insert, update on public.guest_requests to authenticated;
grant select, insert on public.guest_request_comments to authenticated;
grant select, insert on public.guest_request_events to authenticated;
grant select, insert on public.guest_request_attachments to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.guest_requests;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create or replace function private.guest_request_default_department(p_type public.guest_request_type)
returns text
language sql
immutable
as $$
  select case p_type
    when 'housekeeping' then 'housekeeping'
    when 'maintenance' then 'maintenance'
    when 'billing' then 'accounting'
    when 'complaint' then 'management'
    when 'lost_found' then 'housekeeping'
    else 'front_desk'
  end
$$;

create or replace function public.fn_create_guest_request(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_property_id uuid := (p_payload->>'property_id')::uuid;
  v_type public.guest_request_type := coalesce(nullif(p_payload->>'type', ''), 'service_order')::public.guest_request_type;
  v_priority public.priority_level := coalesce(nullif(p_payload->>'priority', ''), 'normal')::public.priority_level;
  v_source public.guest_request_source := coalesce(nullif(p_payload->>'source', ''), 'front_desk')::public.guest_request_source;
  v_booking_id uuid := nullif(p_payload->>'booking_id', '')::uuid;
  v_guest_id uuid := nullif(p_payload->>'guest_id', '')::uuid;
  v_room_id uuid := nullif(p_payload->>'room_id', '')::uuid;
  v_assigned_to uuid := nullif(p_payload->>'assigned_to', '')::uuid;
  v_due_at timestamptz := nullif(p_payload->>'due_at', '')::timestamptz;
  v_department text := coalesce(nullif(p_payload->>'department', ''), private.guest_request_default_department(v_type));
  v_request_id uuid;
  v_request_number text;
begin
  if v_property_id <> private.current_property_id() then
    raise exception 'Invalid property';
  end if;

  if not private.has_any_role(array['admin','manager','receptionist','hk_supervisor','hk_staff','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to create guest requests';
  end if;

  if length(trim(coalesce(p_payload->>'title', ''))) = 0 then
    raise exception 'Guest request title is required';
  end if;

  if v_booking_id is not null then
    select guest_id into v_guest_id
    from public.bookings
    where id = v_booking_id
      and property_id = v_property_id;

    if not found then
      raise exception 'Booking not found';
    end if;
  end if;

  if v_guest_id is not null and not exists (
    select 1 from public.guests where id = v_guest_id and property_id = v_property_id
  ) then
    raise exception 'Guest not found';
  end if;

  if v_room_id is not null and not exists (
    select 1 from public.rooms where id = v_room_id and property_id = v_property_id
  ) then
    raise exception 'Room not found';
  end if;

  if v_assigned_to is not null and not exists (
    select 1 from public.profiles where id = v_assigned_to and property_id = v_property_id and is_active = true
  ) then
    raise exception 'Assignee not found';
  end if;

  v_request_number := 'REQ-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.guest_requests (
    property_id,
    request_number,
    type,
    status,
    priority,
    source,
    title,
    description,
    booking_id,
    guest_id,
    room_id,
    department,
    assigned_to,
    due_at,
    compensation_amount,
    created_by
  )
  values (
    v_property_id,
    v_request_number,
    v_type,
    case when v_assigned_to is null then 'new'::public.guest_request_status else 'assigned'::public.guest_request_status end,
    v_priority,
    v_source,
    trim(p_payload->>'title'),
    nullif(trim(coalesce(p_payload->>'description', '')), ''),
    v_booking_id,
    v_guest_id,
    v_room_id,
    v_department,
    v_assigned_to,
    v_due_at,
    greatest(coalesce(nullif(p_payload->>'compensation_amount', '')::numeric, 0), 0),
    auth.uid()
  )
  returning id into v_request_id;

  insert into public.guest_request_events (property_id, request_id, event_type, new_status, payload, created_by)
  values (
    v_property_id,
    v_request_id,
    'created',
    case when v_assigned_to is null then 'new'::public.guest_request_status else 'assigned'::public.guest_request_status end,
    jsonb_build_object('type', v_type, 'priority', v_priority, 'department', v_department),
    auth.uid()
  );

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_property_id,
    auth.uid(),
    'guest_request',
    v_request_id,
    'create_guest_request',
    jsonb_build_object('request_number', v_request_number, 'type', v_type, 'priority', v_priority)
  );

  if v_assigned_to is not null then
    perform private.create_notification(
      v_property_id,
      v_assigned_to,
      auth.uid(),
      'system',
      case when v_priority in ('high','urgent') then 'warning' else 'info' end,
      'Yêu cầu khách hàng mới',
      v_request_number || ' - ' || trim(p_payload->>'title'),
      'guest_request',
      v_request_id,
      '/guest-requests'
    );
  end if;

  if v_type = 'complaint' or v_priority in ('high','urgent') then
    perform private.notify_roles(
      v_property_id,
      array['admin','manager']::public.pms_role[],
      auth.uid(),
      'system',
      case when v_priority = 'urgent' then 'critical' else 'warning' end,
      'Yêu cầu/khiếu nại cần chú ý',
      v_request_number || ' - ' || trim(p_payload->>'title'),
      'guest_request',
      v_request_id,
      '/guest-requests'
    );
  elsif v_type in ('housekeeping', 'lost_found') then
    perform private.notify_roles(
      v_property_id,
      array['hk_supervisor']::public.pms_role[],
      auth.uid(),
      'housekeeping',
      'info',
      'Yêu cầu liên quan Housekeeping',
      v_request_number || ' - ' || trim(p_payload->>'title'),
      'guest_request',
      v_request_id,
      '/guest-requests'
    );
  end if;

  return v_request_id;
end;
$$;

create or replace function public.fn_update_guest_request_status(
  p_request_id uuid,
  p_status public.guest_request_status,
  p_resolution text default null,
  p_assigned_to uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_request public.guest_requests%rowtype;
begin
  select * into v_request
  from public.guest_requests
  where id = p_request_id
    and property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Guest request not found';
  end if;

  if not (
    private.has_any_role(array['admin','manager','receptionist','hk_supervisor','accountant']::public.pms_role[])
    or v_request.assigned_to = auth.uid()
    or v_request.created_by = auth.uid()
  ) then
    raise exception 'Not allowed to update guest request';
  end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.profiles
    where id = p_assigned_to
      and property_id = v_request.property_id
      and is_active = true
  ) then
    raise exception 'Assignee not found';
  end if;

  update public.guest_requests
  set status = p_status,
      assigned_to = coalesce(p_assigned_to, assigned_to),
      resolution = coalesce(nullif(trim(coalesce(p_resolution, '')), ''), resolution),
      resolved_at = case when p_status = 'resolved' then now() else resolved_at end,
      closed_at = case when p_status = 'closed' then now() else closed_at end
  where id = p_request_id;

  insert into public.guest_request_events (property_id, request_id, event_type, old_status, new_status, payload, created_by)
  values (
    v_request.property_id,
    p_request_id,
    'status_changed',
    v_request.status,
    p_status,
    jsonb_build_object('resolution', p_resolution, 'assigned_to', p_assigned_to),
    auth.uid()
  );

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    v_request.property_id,
    auth.uid(),
    'guest_request',
    p_request_id,
    'update_guest_request_status',
    jsonb_build_object('status', v_request.status, 'assigned_to', v_request.assigned_to),
    jsonb_build_object('status', p_status, 'assigned_to', coalesce(p_assigned_to, v_request.assigned_to))
  );

  if p_assigned_to is not null and p_assigned_to is distinct from v_request.assigned_to then
    perform private.create_notification(
      v_request.property_id,
      p_assigned_to,
      auth.uid(),
      'system',
      'info',
      'Bạn được giao xử lý yêu cầu',
      v_request.request_number || ' - ' || v_request.title,
      'guest_request',
      p_request_id,
      '/guest-requests'
    );
  end if;

  if p_status = 'escalated' then
    perform private.notify_roles(
      v_request.property_id,
      array['admin','manager']::public.pms_role[],
      auth.uid(),
      'system',
      'critical',
      'Yêu cầu khách hàng bị escalation',
      v_request.request_number || ' - ' || v_request.title,
      'guest_request',
      p_request_id,
      '/guest-requests'
    );
  end if;

  return p_request_id;
end;
$$;

create or replace function public.fn_add_guest_request_comment(
  p_request_id uuid,
  p_comment text,
  p_is_internal boolean default true
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_request public.guest_requests%rowtype;
  v_comment_id uuid;
begin
  select * into v_request
  from public.guest_requests
  where id = p_request_id
    and property_id = private.current_property_id();

  if not found then
    raise exception 'Guest request not found';
  end if;

  if length(trim(coalesce(p_comment, ''))) = 0 then
    raise exception 'Comment is required';
  end if;

  insert into public.guest_request_comments (property_id, request_id, comment, is_internal, created_by)
  values (v_request.property_id, p_request_id, trim(p_comment), coalesce(p_is_internal, true), auth.uid())
  returning id into v_comment_id;

  insert into public.guest_request_events (property_id, request_id, event_type, payload, created_by)
  values (
    v_request.property_id,
    p_request_id,
    'commented',
    jsonb_build_object('is_internal', coalesce(p_is_internal, true)),
    auth.uid()
  );

  return v_comment_id;
end;
$$;

create or replace function public.fn_post_guest_request_charge(
  p_request_id uuid,
  p_folio_id uuid,
  p_description text,
  p_amount numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_request public.guest_requests%rowtype;
  v_folio public.folios%rowtype;
  v_item_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Charge amount must be positive';
  end if;

  if length(trim(coalesce(p_description, ''))) = 0 then
    raise exception 'Charge description is required';
  end if;

  select * into v_request
  from public.guest_requests
  where id = p_request_id
    and property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Guest request not found';
  end if;

  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to post guest request charge';
  end if;

  select * into v_folio
  from public.folios
  where id = p_folio_id
    and property_id = v_request.property_id
    and status = 'open';

  if not found then
    raise exception 'Open folio not found';
  end if;

  insert into public.folio_items (
    property_id,
    folio_id,
    type,
    source_type,
    source_id,
    description,
    quantity,
    unit_price,
    amount,
    posted_by
  )
  values (
    v_request.property_id,
    p_folio_id,
    'debit',
    'manual_service',
    p_request_id,
    trim(p_description),
    1,
    p_amount,
    p_amount,
    auth.uid()
  )
  returning id into v_item_id;

  update public.guest_requests
  set folio_item_id = v_item_id
  where id = p_request_id;

  insert into public.guest_request_events (property_id, request_id, event_type, payload, created_by)
  values (
    v_request.property_id,
    p_request_id,
    'folio_charge_posted',
    jsonb_build_object('folio_id', p_folio_id, 'folio_item_id', v_item_id, 'amount', p_amount),
    auth.uid()
  );

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_request.property_id,
    auth.uid(),
    'guest_request',
    p_request_id,
    'post_guest_request_charge',
    jsonb_build_object('folio_id', p_folio_id, 'folio_item_id', v_item_id, 'amount', p_amount)
  );

  return v_item_id;
end;
$$;

revoke all on function public.fn_create_guest_request(jsonb) from public, anon;
revoke all on function public.fn_update_guest_request_status(uuid, public.guest_request_status, text, uuid) from public, anon;
revoke all on function public.fn_add_guest_request_comment(uuid, text, boolean) from public, anon;
revoke all on function public.fn_post_guest_request_charge(uuid, uuid, text, numeric) from public, anon;

grant execute on function public.fn_create_guest_request(jsonb) to authenticated;
grant execute on function public.fn_update_guest_request_status(uuid, public.guest_request_status, text, uuid) to authenticated;
grant execute on function public.fn_add_guest_request_comment(uuid, text, boolean) to authenticated;
grant execute on function public.fn_post_guest_request_charge(uuid, uuid, text, numeric) to authenticated;
