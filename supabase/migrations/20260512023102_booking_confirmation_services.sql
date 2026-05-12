-- Booking add-on services and confirmation data for customer PDF/QR confirmation.

create table if not exists public.booking_services (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  service_code text not null,
  service_name text not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  service_date date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (length(trim(service_code)) > 0),
  check (length(trim(service_name)) > 0)
);

create index if not exists booking_services_booking_idx
  on public.booking_services (property_id, booking_id, created_at);

create or replace function private.assert_booking_service_same_property()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_booking_property uuid;
begin
  select property_id into v_booking_property
  from public.bookings
  where id = new.booking_id;

  if v_booking_property is distinct from new.property_id then
    raise exception 'Booking service must belong to the same property as booking';
  end if;

  return new;
end;
$$;

drop trigger if exists booking_services_same_property_trg on public.booking_services;
create trigger booking_services_same_property_trg
  before insert or update of property_id, booking_id on public.booking_services
  for each row execute function private.assert_booking_service_same_property();

alter table public.booking_services enable row level security;

drop policy if exists "property scoped booking services select" on public.booking_services;
create policy "property scoped booking services select" on public.booking_services
  for select to authenticated
  using (property_id = (select private.current_property_id()));

drop policy if exists "reception manage booking services insert" on public.booking_services;
create policy "reception manage booking services insert" on public.booking_services
  for insert to authenticated
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]))
  );

drop policy if exists "reception manage booking services update" on public.booking_services;
create policy "reception manage booking services update" on public.booking_services
  for update to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]))
  )
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]))
  );

drop policy if exists "reception manage booking services delete" on public.booking_services;
create policy "reception manage booking services delete" on public.booking_services
  for delete to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]))
  );

grant select, insert, update, delete on public.booking_services to authenticated;

create or replace function public.fn_create_booking(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_property_id uuid := (p_payload->>'property_id')::uuid;
  v_guest_id uuid := (p_payload->>'guest_id')::uuid;
  v_room_id uuid := (p_payload->>'room_id')::uuid;
  v_check_in timestamptz := (p_payload->>'check_in')::timestamptz;
  v_check_out timestamptz := (p_payload->>'check_out')::timestamptz;
  v_status public.booking_status := coalesce((p_payload->>'status')::public.booking_status, 'tentative');
  v_services jsonb := coalesce(p_payload->'services', '[]'::jsonb);
  v_service jsonb;
  v_booking_id uuid;
  v_booking_number text;
  v_room_type_id uuid;
  v_quantity int;
  v_unit_price numeric;
  v_total_amount numeric;
  v_service_name text;
  v_service_code text;
begin
  if v_property_id is null or v_property_id <> private.current_property_id() then
    raise exception 'Invalid property';
  end if;

  if not private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to create bookings';
  end if;

  if v_status not in ('tentative', 'confirmed') then
    raise exception 'Bookings can only be created as tentative or confirmed';
  end if;

  if v_check_out <= v_check_in then
    raise exception 'Check-out must be after check-in';
  end if;

  if jsonb_typeof(v_services) <> 'array' then
    raise exception 'Booking services must be an array';
  end if;

  select room_type_id into v_room_type_id
  from public.rooms
  where id = v_room_id
    and property_id = v_property_id;

  if v_room_type_id is null then
    raise exception 'Room not found';
  end if;

  if not exists (
    select 1
    from public.fn_check_availability(v_property_id, v_room_type_id, v_check_in, v_check_out)
    where id = v_room_id
  ) then
    raise exception 'Room is not available';
  end if;

  v_booking_number := 'BK-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.bookings (
    booking_number,
    property_id,
    guest_id,
    check_in,
    check_out,
    nights,
    adults,
    children,
    status,
    source,
    rate_code,
    rate_per_night,
    total_amount,
    deposit_amount,
    deposit_paid,
    external_reference,
    notes,
    created_by
  )
  values (
    v_booking_number,
    v_property_id,
    v_guest_id,
    v_check_in,
    v_check_out,
    greatest(1, ceil(extract(epoch from (v_check_out - v_check_in)) / 86400)::int),
    coalesce((p_payload->>'adults')::int, 1),
    coalesce((p_payload->>'children')::int, 0),
    v_status,
    coalesce((p_payload->>'source')::public.booking_source, 'direct'),
    coalesce(p_payload->>'rate_code', 'BAR'),
    coalesce((p_payload->>'rate_per_night')::numeric, 0),
    coalesce((p_payload->>'total_amount')::numeric, 0),
    coalesce((p_payload->>'deposit_amount')::numeric, 0),
    coalesce((p_payload->>'deposit_paid')::boolean, false),
    p_payload->>'external_reference',
    p_payload->>'notes',
    auth.uid()
  )
  returning id into v_booking_id;

  insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
  values (v_property_id, v_booking_id, v_room_id, v_check_in, v_check_out, v_status);

  for v_service in select value from jsonb_array_elements(v_services)
  loop
    v_service_name := trim(coalesce(v_service->>'service_name', v_service->>'name', ''));
    v_service_code := trim(coalesce(v_service->>'service_code', v_service->>'code', 'other'));
    v_quantity := coalesce((v_service->>'quantity')::int, 1);
    v_unit_price := coalesce((v_service->>'unit_price')::numeric, 0);
    v_total_amount := coalesce((v_service->>'total_amount')::numeric, v_quantity * v_unit_price);

    if v_service_name = '' then
      raise exception 'Booking service name is required';
    end if;

    if v_quantity <= 0 or v_unit_price < 0 or v_total_amount < 0 then
      raise exception 'Booking service amount is invalid';
    end if;

    insert into public.booking_services (
      property_id,
      booking_id,
      service_code,
      service_name,
      quantity,
      unit_price,
      total_amount,
      service_date,
      notes,
      created_by
    )
    values (
      v_property_id,
      v_booking_id,
      v_service_code,
      v_service_name,
      v_quantity,
      v_unit_price,
      v_total_amount,
      nullif(v_service->>'service_date', '')::date,
      nullif(v_service->>'notes', ''),
      auth.uid()
    );
  end loop;

  return v_booking_id;
end;
$$;

grant execute on function public.fn_create_booking(jsonb) to authenticated;
revoke all on function public.fn_create_booking(jsonb) from public, anon;
