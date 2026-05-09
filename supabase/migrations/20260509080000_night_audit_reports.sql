-- Harden night audit, business-date locks, and MVP reporting RPCs.

create unique index if not exists folio_items_unique_room_charge_per_date_idx
  on public.folio_items (folio_id, business_date)
  where source_type = 'room' and type = 'debit';

create index if not exists business_dates_property_status_idx
  on public.business_dates (property_id, status, business_date);

create index if not exists night_audit_logs_property_date_idx
  on public.night_audit_logs (property_id, business_date, created_at desc);

create or replace function private.is_business_date_closed(
  p_property_id uuid,
  p_business_date date
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.business_dates bd
    where bd.property_id = p_property_id
      and bd.business_date = p_business_date
      and bd.status = 'closed'
  )
$$;

create or replace function private.prevent_locked_business_date_changes()
returns trigger
language plpgsql
security invoker
as $$
declare
  v_property_id uuid;
  v_business_date date;
begin
  if tg_table_name = 'bookings' then
    if tg_op = 'DELETE' then
      v_property_id := old.property_id;
      v_business_date := old.check_in::date;
    else
      v_property_id := new.property_id;
      v_business_date := new.check_in::date;
    end if;
  elsif tg_table_name = 'folio_items' then
    if tg_op = 'DELETE' then
      v_property_id := old.property_id;
      v_business_date := old.business_date;
    else
      v_property_id := new.property_id;
      v_business_date := new.business_date;
    end if;
  elsif tg_table_name = 'payments' then
    if tg_op = 'DELETE' then
      v_property_id := old.property_id;
      v_business_date := (old.received_at at time zone 'Asia/Ho_Chi_Minh')::date;
    else
      v_property_id := new.property_id;
      v_business_date := (new.received_at at time zone 'Asia/Ho_Chi_Minh')::date;
    end if;
  else
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if private.is_business_date_closed(v_property_id, v_business_date)
     and not private.has_any_role(array['admin','manager']::public.pms_role[]) then
    raise exception 'Business date % is locked', v_business_date;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'bookings_business_date_lock_trg') then
    create trigger bookings_business_date_lock_trg
      before insert or update or delete on public.bookings
      for each row execute function private.prevent_locked_business_date_changes();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'folio_items_business_date_lock_trg') then
    create trigger folio_items_business_date_lock_trg
      before insert or update or delete on public.folio_items
      for each row execute function private.prevent_locked_business_date_changes();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'payments_business_date_lock_trg') then
    create trigger payments_business_date_lock_trg
      before insert or update or delete on public.payments
      for each row execute function private.prevent_locked_business_date_changes();
  end if;
end $$;

create or replace function public.fn_run_night_audit(
  p_property_id uuid,
  p_business_date date
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_posted int := 0;
  v_no_show int := 0;
  v_unpaid int := 0;
  v_dirty_tasks int := 0;
  v_departures_open int := 0;
  v_room_revenue numeric := 0;
  v_service_revenue numeric := 0;
  v_payments numeric := 0;
begin
  if p_property_id <> private.current_property_id() then
    raise exception 'Invalid property';
  end if;

  if not private.has_any_role(array['admin','manager']::public.pms_role[]) then
    raise exception 'Not allowed to run night audit';
  end if;

  if private.is_business_date_closed(p_property_id, p_business_date) then
    raise exception 'Business date % is already closed', p_business_date;
  end if;

  select count(*) into v_departures_open
  from public.bookings
  where property_id = p_property_id
    and status = 'checked_in'
    and check_out::date <= p_business_date;

  select count(*) into v_dirty_tasks
  from public.housekeeping_tasks
  where property_id = p_property_id
    and status in ('pending', 'in_progress', 'done', 'rejected');

  select count(*) into v_unpaid
  from public.folios f
  where f.property_id = p_property_id
    and f.status = 'open'
    and public.fn_calculate_folio_balance(f.id) > 0;

  insert into public.night_audit_logs (property_id, business_date, step, summary, created_by)
  values (
    p_property_id,
    p_business_date,
    'pre_check',
    jsonb_build_object(
      'open_departures', v_departures_open,
      'open_housekeeping_tasks', v_dirty_tasks,
      'unpaid_open_folios', v_unpaid
    ),
    auth.uid()
  );

  update public.bookings
  set status = 'no_show'
  where property_id = p_property_id
    and status in ('tentative', 'confirmed')
    and check_in::date <= p_business_date
    and not exists (
      select 1
      from public.booking_rooms br
      where br.booking_id = bookings.id
        and br.status = 'checked_in'
    );
  get diagnostics v_no_show = row_count;

  update public.booking_rooms br
  set status = 'no_show'
  from public.bookings b
  where b.id = br.booking_id
    and b.property_id = p_property_id
    and b.status = 'no_show'
    and br.status in ('tentative', 'confirmed');

  insert into public.folio_items (
    property_id,
    folio_id,
    type,
    source_type,
    description,
    quantity,
    unit_price,
    amount,
    business_date,
    posted_by
  )
  select
    f.property_id,
    f.id,
    'debit',
    'room',
    'Night audit room charge',
    1,
    b.rate_per_night,
    b.rate_per_night,
    p_business_date,
    auth.uid()
  from public.folios f
  join public.bookings b on b.id = f.booking_id
  where f.property_id = p_property_id
    and f.status = 'open'
    and b.status = 'checked_in'
    and b.rate_per_night > 0
  on conflict do nothing;
  get diagnostics v_posted = row_count;

  select
    coalesce(sum(amount) filter (where type = 'debit' and source_type = 'room'), 0),
    coalesce(sum(amount) filter (where type = 'debit' and source_type <> 'room'), 0),
    coalesce(sum(amount) filter (where type = 'credit' and source_type = 'payment'), 0)
  into v_room_revenue, v_service_revenue, v_payments
  from public.folio_items
  where property_id = p_property_id
    and business_date = p_business_date;

  insert into public.night_audit_logs (property_id, business_date, step, summary, created_by)
  values (
    p_property_id,
    p_business_date,
    'revenue_recalc',
    jsonb_build_object(
      'room_revenue', v_room_revenue,
      'service_revenue', v_service_revenue,
      'payments', v_payments
    ),
    auth.uid()
  );

  insert into public.business_dates (property_id, business_date, status, closed_at, closed_by)
  values (p_property_id, p_business_date, 'closed', now(), auth.uid())
  on conflict (property_id, business_date)
  do update set status = 'closed', closed_at = excluded.closed_at, closed_by = excluded.closed_by;

  insert into public.business_dates (property_id, business_date, status)
  values (p_property_id, p_business_date + 1, 'open')
  on conflict do nothing;

  insert into public.night_audit_logs (property_id, business_date, step, summary, created_by)
  values (
    p_property_id,
    p_business_date,
    'complete',
    jsonb_build_object(
      'posted_room_charges', v_posted,
      'no_show_bookings', v_no_show,
      'next_business_date', p_business_date + 1
    ),
    auth.uid()
  );

  return jsonb_build_object(
    'pre_check',
    jsonb_build_object(
      'open_departures', v_departures_open,
      'open_housekeeping_tasks', v_dirty_tasks,
      'unpaid_open_folios', v_unpaid
    ),
    'posted_room_charges', v_posted,
    'no_show_bookings', v_no_show,
    'room_revenue', v_room_revenue,
    'service_revenue', v_service_revenue,
    'payments', v_payments,
    'locked_business_date', p_business_date,
    'next_business_date', p_business_date + 1
  );
end;
$$;

create or replace function public.fn_revenue_summary(
  p_property_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language sql
stable
security invoker
as $$
  with revenue as (
    select
      coalesce(sum(amount) filter (where type = 'debit' and source_type = 'room'), 0) as room_revenue,
      coalesce(sum(amount) filter (where type = 'debit' and source_type <> 'room'), 0) as service_revenue,
      coalesce(sum(amount) filter (where type = 'credit' and source_type = 'payment'), 0) as payments
    from public.folio_items
    where property_id = p_property_id
      and property_id = private.current_property_id()
      and business_date between p_from and p_to
  ),
  occupancy as (
    select
      greatest(1, (p_to - p_from + 1))::numeric as days,
      (select count(*)::numeric from public.rooms where property_id = p_property_id and is_active = true) as rooms,
      count(*) filter (where b.status in ('checked_in', 'checked_out'))::numeric as occupied_nights
    from public.bookings b
    where b.property_id = p_property_id
      and b.property_id = private.current_property_id()
      and b.check_in::date <= p_to
      and b.check_out::date > p_from
  )
  select jsonb_build_object(
    'room_revenue', revenue.room_revenue,
    'service_revenue', revenue.service_revenue,
    'payments', revenue.payments,
    'occupancy_rate',
      case when occupancy.rooms = 0 then 0 else round(occupancy.occupied_nights / (occupancy.rooms * occupancy.days) * 100, 2) end,
    'adr',
      case when occupancy.occupied_nights = 0 then 0 else round(revenue.room_revenue / occupancy.occupied_nights, 2) end,
    'revpar',
      case when occupancy.rooms = 0 then 0 else round(revenue.room_revenue / (occupancy.rooms * occupancy.days), 2) end
  )
  from revenue, occupancy
$$;

create or replace function public.fn_c65_export_rows(
  p_property_id uuid,
  p_from date,
  p_to date
)
returns table (
  booking_id uuid,
  guest_id uuid,
  full_name text,
  date_of_birth date,
  gender text,
  nationality text,
  document_type text,
  document_number text,
  document_issue_date date,
  document_issue_place text,
  occupation text,
  current_address text,
  stay_purpose text,
  check_in timestamptz,
  check_out timestamptz,
  room_number text
)
language sql
stable
security invoker
as $$
  select
    b.id,
    g.id,
    g.full_name,
    g.date_of_birth,
    g.gender,
    g.nationality,
    g.document_type,
    g.document_number,
    g.document_issue_date,
    g.document_issue_place,
    g.occupation,
    g.current_address,
    g.stay_purpose,
    b.check_in,
    b.check_out,
    r.number
  from public.bookings b
  join public.guests g on g.id = b.guest_id
  join public.booking_rooms br on br.booking_id = b.id
  join public.rooms r on r.id = br.room_id
  where b.property_id = p_property_id
    and b.property_id = private.current_property_id()
    and b.status in ('checked_in', 'checked_out')
    and b.check_in::date <= p_to
    and b.check_out::date >= p_from
  order by b.check_in, r.number, g.full_name
$$;
