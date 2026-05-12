-- Operational Night Audit MVP.
-- Adds a real pre-check endpoint, a current business-date endpoint, and hardens
-- the run RPC so the frontend cannot close a date while operational blockers remain.

create or replace function public.fn_get_current_business_date(p_property_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_row public.business_dates%rowtype;
begin
  if p_property_id <> private.current_property_id() then
    raise exception 'Invalid property';
  end if;

  if not private.has_any_role(array['admin','manager']::public.pms_role[]) then
    raise exception 'Not allowed to run night audit';
  end if;

  select *
  into v_row
  from public.business_dates
  where property_id = p_property_id
    and status = 'open'
  order by business_date desc
  limit 1;

  if not found then
    insert into public.business_dates (property_id, business_date, status)
    values (p_property_id, (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'open')
    on conflict (property_id, business_date)
    do nothing
    returning * into v_row;

    if not found then
      select *
      into v_row
      from public.business_dates
      where property_id = p_property_id
      order by business_date desc
      limit 1;

      if v_row.status = 'closed' then
        insert into public.business_dates (property_id, business_date, status)
        values (p_property_id, v_row.business_date + 1, 'open')
        on conflict (property_id, business_date)
        do nothing
        returning * into v_row;

        if not found then
          select *
          into v_row
          from public.business_dates
          where property_id = p_property_id
            and status = 'open'
          order by business_date desc
          limit 1;
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'property_id', v_row.property_id,
    'business_date', v_row.business_date,
    'status', v_row.status,
    'closed_at', v_row.closed_at,
    'closed_by', v_row.closed_by
  );
end;
$$;

create or replace function public.fn_night_audit_precheck(
  p_property_id uuid,
  p_business_date date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, private
as $$
declare
  v_business_date_status public.business_date_status;
  v_is_closed boolean := false;
  v_open_departures_count int := 0;
  v_unpaid_folios_count int := 0;
  v_pending_payments_count int := 0;
  v_pending_deposits_count int := 0;
  v_open_hk_count int := 0;
  v_no_show_count int := 0;
  v_room_charge_count int := 0;
  v_room_charge_total numeric := 0;
  v_blockers_count int := 0;
  v_open_departures jsonb := '[]'::jsonb;
  v_unpaid_folios jsonb := '[]'::jsonb;
  v_pending_payments jsonb := '[]'::jsonb;
  v_pending_deposits jsonb := '[]'::jsonb;
  v_open_hk jsonb := '[]'::jsonb;
  v_no_show jsonb := '[]'::jsonb;
begin
  if p_property_id <> private.current_property_id() then
    raise exception 'Invalid property';
  end if;

  if not private.has_any_role(array['admin','manager']::public.pms_role[]) then
    raise exception 'Not allowed to run night audit';
  end if;

  select status
  into v_business_date_status
  from public.business_dates
  where property_id = p_property_id
    and business_date = p_business_date;

  v_is_closed := v_business_date_status = 'closed';

  select count(*), coalesce(jsonb_agg(item order by item->>'room_number', item->>'booking_number'), '[]'::jsonb)
  into v_open_departures_count, v_open_departures
  from (
    select jsonb_build_object(
      'booking_id', b.id,
      'booking_number', b.booking_number,
      'guest_name', g.full_name,
      'room_number', r.number,
      'date', b.check_out::date,
      'status', b.status
    ) as item
    from public.bookings b
    join public.guests g on g.id = b.guest_id
    left join public.booking_rooms br on br.booking_id = b.id and br.status = 'checked_in'
    left join public.rooms r on r.id = br.room_id
    where b.property_id = p_property_id
      and b.status = 'checked_in'
      and b.check_out::date <= p_business_date
  ) rows;

  select count(*), coalesce(jsonb_agg(item order by (item->>'balance')::numeric desc), '[]'::jsonb)
  into v_unpaid_folios_count, v_unpaid_folios
  from (
    select jsonb_build_object(
      'folio_id', f.id,
      'folio_number', f.folio_number,
      'booking_id', b.id,
      'booking_number', b.booking_number,
      'guest_name', g.full_name,
      'balance', public.fn_calculate_folio_balance(f.id),
      'status', f.status
    ) as item
    from public.folios f
    join public.bookings b on b.id = f.booking_id
    join public.guests g on g.id = b.guest_id
    where f.property_id = p_property_id
      and f.status = 'open'
      and public.fn_calculate_folio_balance(f.id) > 0
  ) rows;

  select count(*), coalesce(jsonb_agg(item order by item->>'date' desc), '[]'::jsonb)
  into v_pending_payments_count, v_pending_payments
  from (
    select jsonb_build_object(
      'payment_id', p.id,
      'folio_id', p.folio_id,
      'folio_number', f.folio_number,
      'booking_id', b.id,
      'booking_number', b.booking_number,
      'guest_name', g.full_name,
      'amount', p.amount,
      'date', p.received_at,
      'status', p.status
    ) as item
    from public.payments p
    join public.folios f on f.id = p.folio_id
    join public.bookings b on b.id = f.booking_id
    join public.guests g on g.id = b.guest_id
    where p.property_id = p_property_id
      and p.status = 'pending_verification'
  ) rows;

  select count(*), coalesce(jsonb_agg(item order by item->>'date' desc), '[]'::jsonb)
  into v_pending_deposits_count, v_pending_deposits
  from (
    select jsonb_build_object(
      'deposit_id', bd.id,
      'booking_id', b.id,
      'booking_number', b.booking_number,
      'guest_name', g.full_name,
      'amount', bd.amount,
      'date', bd.received_at,
      'status', bd.status
    ) as item
    from public.booking_deposits bd
    join public.bookings b on b.id = bd.booking_id
    join public.guests g on g.id = b.guest_id
    where bd.property_id = p_property_id
      and bd.status = 'pending_verification'
  ) rows;

  select count(*), coalesce(jsonb_agg(item order by item->>'room_number', item->>'status'), '[]'::jsonb)
  into v_open_hk_count, v_open_hk
  from (
    select jsonb_build_object(
      'task_id', ht.id,
      'room_number', r.number,
      'status', ht.status,
      'label', ht.task_type,
      'date', ht.created_at
    ) as item
    from public.housekeeping_tasks ht
    join public.rooms r on r.id = ht.room_id
    where ht.property_id = p_property_id
      and ht.status in ('pending', 'in_progress', 'done', 'rejected')
  ) rows;

  select count(*), coalesce(jsonb_agg(item order by item->>'date', item->>'booking_number'), '[]'::jsonb)
  into v_no_show_count, v_no_show
  from (
    select jsonb_build_object(
      'booking_id', b.id,
      'booking_number', b.booking_number,
      'guest_name', g.full_name,
      'date', b.check_in::date,
      'status', b.status
    ) as item
    from public.bookings b
    join public.guests g on g.id = b.guest_id
    where b.property_id = p_property_id
      and b.status in ('tentative', 'confirmed')
      and b.check_in::date <= p_business_date
      and not exists (
        select 1
        from public.booking_rooms br
        where br.booking_id = b.id
          and br.status = 'checked_in'
      )
  ) rows;

  select count(*), coalesce(sum(b.rate_per_night), 0)
  into v_room_charge_count, v_room_charge_total
  from public.folios f
  join public.bookings b on b.id = f.booking_id
  where f.property_id = p_property_id
    and f.status = 'open'
    and b.status = 'checked_in'
    and b.rate_per_night > 0
    and not exists (
      select 1
      from public.folio_items fi
      where fi.folio_id = f.id
        and fi.source_type = 'room'
        and fi.type = 'debit'
        and fi.business_date = p_business_date
    );

  v_blockers_count :=
    case when v_is_closed or v_business_date_status is distinct from 'open' then 1 else 0 end
    + v_open_departures_count
    + v_unpaid_folios_count
    + v_pending_payments_count
    + v_pending_deposits_count
    + v_open_hk_count;

  return jsonb_build_object(
    'business_date', p_business_date,
    'status', v_business_date_status,
    'is_closed', v_is_closed,
    'can_run', v_blockers_count = 0,
    'blockers_count', v_blockers_count,
    'warnings_count', v_no_show_count,
    'summary', jsonb_build_object(
      'open_departures', v_open_departures_count,
      'unpaid_folios', v_unpaid_folios_count,
      'pending_payments', v_pending_payments_count,
      'pending_deposits', v_pending_deposits_count,
      'open_housekeeping_tasks', v_open_hk_count,
      'no_show_candidates', v_no_show_count,
      'room_charge_candidates', v_room_charge_count,
      'room_charge_total', v_room_charge_total
    ),
    'blockers', jsonb_build_object(
      'open_departures', v_open_departures,
      'unpaid_folios', v_unpaid_folios,
      'pending_payments', v_pending_payments,
      'pending_deposits', v_pending_deposits,
      'open_housekeeping_tasks', v_open_hk
    ),
    'warnings', jsonb_build_object(
      'no_show_candidates', v_no_show
    )
  );
end;
$$;

create or replace function public.fn_run_night_audit(
  p_property_id uuid,
  p_business_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_posted int := 0;
  v_no_show int := 0;
  v_room_revenue numeric := 0;
  v_service_revenue numeric := 0;
  v_payments numeric := 0;
  v_precheck jsonb;
  v_business_date public.business_dates%rowtype;
begin
  if p_property_id <> private.current_property_id() then
    raise exception 'Invalid property';
  end if;

  if not private.has_any_role(array['admin','manager']::public.pms_role[]) then
    raise exception 'Not allowed to run night audit';
  end if;

  perform pg_advisory_xact_lock(hashtext('night_audit:' || p_property_id::text || ':' || p_business_date::text));

  select *
  into v_business_date
  from public.business_dates
  where property_id = p_property_id
    and business_date = p_business_date
  for update;

  if not found then
    raise exception 'Business date % is not open', p_business_date;
  end if;

  if v_business_date.status = 'closed' then
    raise exception 'Business date % is already closed', p_business_date;
  end if;

  if v_business_date.status <> 'open' then
    raise exception 'Business date % is not open', p_business_date;
  end if;

  v_precheck := public.fn_night_audit_precheck(p_property_id, p_business_date);

  if coalesce((v_precheck->>'can_run')::boolean, false) is not true then
    raise exception 'Night audit blocked by pre-check: % blockers', coalesce((v_precheck->>'blockers_count')::int, 0);
  end if;

  insert into public.night_audit_logs (property_id, business_date, step, summary, created_by)
  values (
    p_property_id,
    p_business_date,
    'pre_check_passed',
    v_precheck,
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

  update public.business_dates
  set status = 'closed',
      closed_at = now(),
      closed_by = auth.uid()
  where id = v_business_date.id;

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

  perform private.notify_roles(
    p_property_id,
    array['admin','manager']::public.pms_role[],
    auth.uid(),
    'night_audit',
    'success',
    'Night Audit hoàn tất',
    'Ngày ' || p_business_date::text || ' đã được đóng và mở ngày ' || (p_business_date + 1)::text || '.',
    'business_date',
    v_business_date.id,
    '/night-audit'
  );

  return jsonb_build_object(
    'precheck', v_precheck,
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

revoke all on function public.fn_get_current_business_date(uuid) from public, anon;
revoke all on function public.fn_night_audit_precheck(uuid, date) from public, anon;
revoke all on function public.fn_run_night_audit(uuid, date) from public, anon;

grant execute on function public.fn_get_current_business_date(uuid) to authenticated;
grant execute on function public.fn_night_audit_precheck(uuid, date) to authenticated;
grant execute on function public.fn_run_night_audit(uuid, date) to authenticated;
