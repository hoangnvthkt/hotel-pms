-- Harden checkout and housekeeping task lifecycle.

create index if not exists housekeeping_tasks_room_status_idx
  on public.housekeeping_tasks (property_id, room_id, status);

create index if not exists hk_assignments_assigned_to_idx
  on public.hk_assignments (property_id, assigned_to);

create or replace function private.assert_hk_task_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_room_property uuid;
  v_assignee_property uuid;
  v_inspector_property uuid;
begin
  select property_id into v_room_property
  from public.rooms
  where id = new.room_id;

  if v_room_property is distinct from new.property_id then
    raise exception 'Housekeeping task property must match room';
  end if;

  if new.assigned_to is not null then
    select property_id into v_assignee_property
    from public.profiles
    where id = new.assigned_to
      and is_active = true;

    if v_assignee_property is distinct from new.property_id then
      raise exception 'Housekeeping assignee must belong to the same property';
    end if;

    if not private.profile_has_any_role(new.assigned_to, array['hk_staff','hk_supervisor']::public.pms_role[]) then
      raise exception 'Housekeeping assignee must be hk_staff or hk_supervisor';
    end if;
  end if;

  if new.inspector_id is not null then
    select property_id into v_inspector_property
    from public.profiles
    where id = new.inspector_id
      and is_active = true;

    if v_inspector_property is distinct from new.property_id then
      raise exception 'Housekeeping inspector must belong to the same property';
    end if;

    if not private.profile_has_any_role(new.inspector_id, array['admin','manager','hk_supervisor']::public.pms_role[]) then
      raise exception 'Housekeeping inspector must be supervisor/manager/admin';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.assert_hk_assignment_valid()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_task_property uuid;
  v_assignee_property uuid;
  v_assigner_property uuid;
begin
  select property_id into v_task_property
  from public.housekeeping_tasks
  where id = new.task_id;

  if v_task_property is distinct from new.property_id then
    raise exception 'HK assignment property must match task';
  end if;

  select property_id into v_assignee_property
  from public.profiles
  where id = new.assigned_to
    and is_active = true;

  if v_assignee_property is distinct from new.property_id then
    raise exception 'HK assignee must belong to the same property';
  end if;

  if not private.profile_has_any_role(new.assigned_to, array['hk_staff','hk_supervisor']::public.pms_role[]) then
    raise exception 'HK assignee must be hk_staff or hk_supervisor';
  end if;

  if new.assigned_by is not null then
    select property_id into v_assigner_property
    from public.profiles
    where id = new.assigned_by
      and is_active = true;

    if v_assigner_property is distinct from new.property_id then
      raise exception 'HK assigner must belong to the same property';
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'housekeeping_tasks_same_property_trg') then
    create trigger housekeeping_tasks_same_property_trg
      before insert or update of property_id, room_id, assigned_to, inspector_id on public.housekeeping_tasks
      for each row execute function private.assert_hk_task_same_property();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'hk_assignments_valid_trg') then
    create trigger hk_assignments_valid_trg
      before insert or update of property_id, task_id, assigned_to, assigned_by on public.hk_assignments
      for each row execute function private.assert_hk_assignment_valid();
  end if;
end $$;

create or replace function public.fn_assign_hk_task(
  p_task_id uuid,
  p_assigned_to uuid
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_task record;
  v_assignment_id uuid;
begin
  if not private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[]) then
    raise exception 'Not allowed to assign housekeeping tasks';
  end if;

  select * into v_task
  from public.housekeeping_tasks
  where id = p_task_id
    and property_id = private.current_property_id()
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

  return v_assignment_id;
end;
$$;

create or replace function private.hk_transition_allowed(
  p_from public.hk_task_status,
  p_to public.hk_task_status
)
returns boolean
language sql
immutable
as $$
  select p_from = p_to
    or (p_from = 'pending' and p_to = 'in_progress')
    or (p_from = 'in_progress' and p_to = 'done')
    or (p_from = 'done' and p_to in ('inspected', 'rejected'))
    or (p_from = 'rejected' and p_to = 'pending')
$$;

create or replace function public.fn_update_hk_task_status(
  p_task_id uuid,
  p_to_status public.hk_task_status,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_task record;
  v_room_status public.room_status;
  v_is_supervisor boolean := private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[]);
begin
  select * into v_task
  from public.housekeeping_tasks
  where id = p_task_id
    and property_id = private.current_property_id()
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

  if not private.hk_transition_allowed(v_task.status, p_to_status) then
    raise exception 'Invalid HK task transition: % -> %', v_task.status, p_to_status;
  end if;

  update public.housekeeping_tasks
  set status = p_to_status,
      notes = coalesce(p_notes, notes),
      started_at = case when p_to_status = 'in_progress' and started_at is null then now() else started_at end,
      completed_at = case when p_to_status = 'done' then now() else completed_at end,
      inspected_at = case when p_to_status in ('inspected', 'rejected') then now() else inspected_at end,
      inspector_id = case when p_to_status in ('inspected', 'rejected') then auth.uid() else inspector_id end,
      inspection_notes = case when p_to_status in ('inspected', 'rejected') then p_notes else inspection_notes end
  where id = p_task_id;

  if p_to_status = 'inspected' then
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
  end if;

  return p_task_id;
end;
$$;

create or replace function public.fn_check_out_booking(
  p_booking_id uuid,
  p_settlement_mode text default 'paid'
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_booking record;
  v_assignment record;
  v_folio record;
  v_balance numeric;
  v_invoice_number text;
  v_invoice_total numeric;
begin
  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to check out';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and property_id = private.current_property_id()
    and status = 'checked_in'
  for update;

  if not found then
    raise exception 'Checked-in booking not found';
  end if;

  select * into v_assignment
  from public.booking_rooms
  where booking_id = p_booking_id
    and status = 'checked_in'
  order by check_in desc
  limit 1
  for update;

  if not found then
    raise exception 'Active room assignment not found';
  end if;

  select * into v_folio
  from public.folios
  where booking_id = p_booking_id
    and parent_folio_id is null
  for update;

  if not found then
    raise exception 'Master folio not found';
  end if;

  v_balance := public.fn_calculate_folio_balance(v_folio.id);

  if coalesce(v_balance, 0) > 0 and p_settlement_mode <> 'city_ledger' then
    raise exception 'Folio balance must be zero before checkout';
  end if;

  if coalesce(v_balance, 0) > 0
     and p_settlement_mode = 'city_ledger'
     and not private.has_any_role(array['admin','manager','accountant']::public.pms_role[]) then
    raise exception 'Only manager/accountant can move balance to city ledger';
  end if;

  update public.folios
  set status = 'closed',
      closed_at = now()
  where id = v_folio.id;

  update public.bookings
  set status = 'checked_out'
  where id = p_booking_id;

  update public.booking_rooms
  set status = 'checked_out',
      check_out = now()
  where id = v_assignment.id;

  update public.rooms
  set status = 'vacant_dirty'
  where id = v_assignment.room_id;

  insert into public.room_status_history (property_id, room_id, from_status, to_status, reason, changed_by)
  values (v_booking.property_id, v_assignment.room_id, 'occupied', 'vacant_dirty', 'check_out', auth.uid());

  insert into public.housekeeping_tasks (property_id, room_id, task_type, status, priority, notes)
  values (v_booking.property_id, v_assignment.room_id, 'checkout_clean', 'pending', 'high', 'Tự động tạo sau checkout');

  v_invoice_number := 'INV-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  select coalesce(sum(amount), 0) into v_invoice_total
  from public.folio_items
  where folio_id = v_folio.id
    and type = 'debit';

  insert into public.invoices (
    property_id,
    folio_id,
    invoice_number,
    status,
    total_amount,
    issued_at,
    issued_by
  )
  values (
    v_booking.property_id,
    v_folio.id,
    v_invoice_number,
    'issued',
    v_invoice_total,
    now(),
    auth.uid()
  );

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, after_data)
  values (
    v_booking.property_id,
    auth.uid(),
    'booking',
    p_booking_id,
    'check_out',
    jsonb_build_object('folio_id', v_folio.id, 'room_id', v_assignment.room_id, 'settlement_mode', p_settlement_mode)
  );

  return v_folio.id;
end;
$$;
