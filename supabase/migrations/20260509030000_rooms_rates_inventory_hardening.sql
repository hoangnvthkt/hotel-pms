-- Harden room/rate inventory and centralize room status transitions.

create index if not exists room_status_history_room_changed_at_idx
  on public.room_status_history (room_id, changed_at desc);

create index if not exists maintenance_tickets_room_status_idx
  on public.maintenance_tickets (property_id, room_id, status);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'room_rates_seasonal_dates_valid'
  ) then
    alter table public.room_rates
      add constraint room_rates_seasonal_dates_valid
      check (
        rate_code <> 'SEASONAL'
        or (start_date is not null and end_date is not null and start_date <= end_date)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'room_rates_dates_order_valid'
  ) then
    alter table public.room_rates
      add constraint room_rates_dates_order_valid
      check (start_date is null or end_date is null or start_date <= end_date);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'rooms_number_not_blank'
  ) then
    alter table public.rooms
      add constraint rooms_number_not_blank
      check (length(trim(number)) > 0);
  end if;
end $$;

create or replace function private.assert_room_type_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_property_id uuid;
begin
  select property_id into v_property_id
  from public.room_types
  where id = new.room_type_id;

  if v_property_id is distinct from new.property_id then
    raise exception 'Room type must belong to the same property';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'rooms_room_type_same_property_trg'
  ) then
    create trigger rooms_room_type_same_property_trg
      before insert or update of property_id, room_type_id on public.rooms
      for each row execute function private.assert_room_type_same_property();
  end if;
end $$;

create or replace function private.assert_room_rate_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_property_id uuid;
begin
  select property_id into v_property_id
  from public.room_types
  where id = new.room_type_id;

  if v_property_id is distinct from new.property_id then
    raise exception 'Room rate room type must belong to the same property';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'room_rates_room_type_same_property_trg'
  ) then
    create trigger room_rates_room_type_same_property_trg
      before insert or update of property_id, room_type_id on public.room_rates
      for each row execute function private.assert_room_rate_same_property();
  end if;
end $$;

create or replace function private.is_room_transition_allowed(
  p_from public.room_status,
  p_to public.room_status
)
returns boolean
language sql
immutable
as $$
  select p_from = p_to
    or (p_from = 'vacant_clean' and p_to in ('occupied', 'blocked', 'out_of_order'))
    or (p_from = 'occupied' and p_to in ('vacant_dirty', 'occupied_dirty', 'occupied_clean', 'out_of_order'))
    or (p_from = 'occupied_dirty' and p_to in ('occupied_clean', 'vacant_dirty'))
    or (p_from = 'occupied_clean' and p_to in ('occupied_dirty', 'vacant_dirty'))
    or (p_from = 'vacant_dirty' and p_to in ('inspected', 'out_of_order'))
    or (p_from = 'inspected' and p_to in ('vacant_clean', 'vacant_dirty'))
    or (p_from in ('blocked', 'out_of_order') and p_to in ('vacant_dirty', 'vacant_clean'))
$$;

create or replace function public.fn_change_room_status(
  p_room_id uuid,
  p_to_status public.room_status,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_room record;
  v_history_id uuid;
begin
  if not private.has_any_role(array['admin','manager','receptionist','hk_supervisor']::public.pms_role[]) then
    raise exception 'Not allowed to change room status';
  end if;

  select * into v_room
  from public.rooms
  where id = p_room_id
    and property_id = private.current_property_id()
  for update;

  if not found then
    raise exception 'Room not found';
  end if;

  if not private.is_room_transition_allowed(v_room.status, p_to_status) then
    raise exception 'Invalid room status transition: % -> %', v_room.status, p_to_status;
  end if;

  update public.rooms
  set status = p_to_status,
      last_cleaned_at = case when p_to_status = 'vacant_clean' then now() else last_cleaned_at end
  where id = p_room_id;

  insert into public.room_status_history (
    property_id,
    room_id,
    from_status,
    to_status,
    reason,
    changed_by
  )
  values (
    v_room.property_id,
    p_room_id,
    v_room.status,
    p_to_status,
    p_reason,
    auth.uid()
  )
  returning id into v_history_id;

  return v_history_id;
end;
$$;

create or replace function public.fn_check_availability(
  p_property_id uuid,
  p_room_type_id uuid,
  p_check_in timestamptz,
  p_check_out timestamptz
)
returns setof public.rooms
language sql
stable
security invoker
as $$
  select r.*
  from public.rooms r
  where r.property_id = p_property_id
    and r.room_type_id = p_room_type_id
    and r.is_active = true
    and p_check_out > p_check_in
    and r.status not in ('occupied', 'occupied_dirty', 'occupied_clean', 'out_of_order', 'blocked')
    and not exists (
      select 1
      from public.booking_rooms br
      where br.room_id = r.id
        and br.status in ('tentative', 'confirmed', 'checked_in')
        and tstzrange(br.check_in, br.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
    )
  order by r.number
$$;

