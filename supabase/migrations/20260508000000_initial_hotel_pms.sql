-- Hotel PMS MVP schema for Grand Palace.
-- Apply with Supabase CLI or SQL Editor, then run advisors before production.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create schema if not exists private;

create type public.pms_role as enum ('admin', 'manager', 'receptionist', 'hk_supervisor', 'hk_staff', 'accountant');
create type public.room_status as enum ('vacant_clean', 'vacant_dirty', 'occupied', 'occupied_dirty', 'occupied_clean', 'inspected', 'out_of_order', 'blocked');
create type public.booking_status as enum ('tentative', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');
create type public.booking_source as enum ('walk_in', 'phone', 'facebook', 'direct', 'ota_manual', 'website_later');
create type public.hk_task_status as enum ('pending', 'in_progress', 'done', 'inspected', 'rejected');
create type public.payment_method as enum ('cash', 'bank_transfer', 'qr_manual', 'card_manual', 'gateway_later');
create type public.payment_status as enum ('draft', 'posted', 'finalized', 'voided', 'refunded');
create type public.folio_status as enum ('open', 'closed', 'invoiced');
create type public.folio_item_source_type as enum ('room', 'manual_service', 'minibar', 'laundry', 'restaurant_later', 'event_later', 'payment', 'deposit', 'refund', 'other');
create type public.invoice_status as enum ('draft', 'issued', 'voided');
create type public.business_date_status as enum ('open', 'auditing', 'closed');
create type public.maintenance_status as enum ('open', 'in_progress', 'resolved', 'cancelled');
create type public.priority_level as enum ('low', 'normal', 'high', 'urgent');

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text,
  email text,
  stars int not null default 3 check (stars between 1 and 5),
  total_rooms int not null check (total_rooms > 0),
  check_in_time time not null default '14:00',
  check_out_time time not null default '12:00',
  currency text not null default 'VND',
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  full_name text not null,
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.roles (
  name public.pms_role primary key,
  description text not null
);

create table public.profile_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.pms_role not null references public.roles(name) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (profile_id, role)
);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (property_id, key)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table public.room_types (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  code text not null,
  max_occupancy int not null check (max_occupancy > 0),
  bed_type text not null,
  area numeric(6,2),
  amenities text[] not null default '{}',
  description text,
  base_price numeric(12,2) not null check (base_price >= 0),
  unique (property_id, code)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_type_id uuid not null references public.room_types(id) on delete restrict,
  number text not null,
  floor int not null,
  status public.room_status not null default 'vacant_clean',
  is_active boolean not null default true,
  notes text,
  lock_provider text,
  lock_external_id text,
  power_device_id text,
  last_cleaned_at timestamptz,
  created_at timestamptz not null default now(),
  unique (property_id, number)
);

create table public.room_rates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  rate_code text not null check (rate_code in ('BAR', 'WALK', 'CORP', 'SEASONAL')),
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'VND',
  start_date date,
  end_date date,
  is_active boolean not null default true
);

create table public.room_status_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  from_status public.room_status,
  to_status public.room_status not null,
  reason text,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  title text not null,
  description text,
  status public.maintenance_status not null default 'open',
  priority public.priority_level not null default 'normal',
  created_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  full_name text not null,
  email text,
  phone text not null,
  nationality text not null,
  document_type text not null check (document_type in ('cccd', 'passport', 'other')),
  document_number text not null,
  document_issue_date date,
  document_issue_place text,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  occupation text,
  current_address text,
  stay_purpose text,
  is_vip boolean not null default false,
  is_blacklisted boolean not null default false,
  blacklist_reason text,
  marketing_consent boolean not null default false,
  loyalty_code text,
  notes text,
  total_stays int not null default 0,
  total_spent numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (property_id, document_type, document_number)
);

create table public.guest_documents (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  document_type text not null,
  document_number text not null,
  issue_date date,
  issue_place text,
  expires_at date,
  created_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null,
  property_id uuid not null references public.properties(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete restrict,
  check_in timestamptz not null,
  check_out timestamptz not null,
  nights int not null check (nights > 0),
  adults int not null default 1 check (adults > 0),
  children int not null default 0 check (children >= 0),
  status public.booking_status not null default 'tentative',
  source public.booking_source not null default 'direct',
  rate_code text not null default 'BAR',
  rate_per_night numeric(12,2) not null check (rate_per_night >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  deposit_paid boolean not null default false,
  external_reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (check_out > check_in),
  unique (property_id, booking_number)
);

create table public.booking_rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete restrict,
  check_in timestamptz not null,
  check_out timestamptz not null,
  status public.booking_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  check (check_out > check_in),
  exclude using gist (
    room_id with =,
    tstzrange(check_in, check_out, '[)') with &&
  ) where (status in ('tentative', 'confirmed', 'checked_in'))
);

create table public.booking_deposits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  method public.payment_method not null,
  reference text,
  received_at timestamptz not null default now(),
  received_by uuid references public.profiles(id) on delete set null
);

create table public.booking_notes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  note text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.housekeeping_tasks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  task_type text not null check (task_type in ('checkout_clean', 'daily_service', 'turndown', 'inspection', 'deep_clean')),
  status public.hk_task_status not null default 'pending',
  priority public.priority_level not null default 'normal',
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  inspector_id uuid references public.profiles(id) on delete set null,
  inspection_notes text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  inspected_at timestamptz
);

create table public.hk_assignments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  task_id uuid not null references public.housekeeping_tasks(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (task_id, assigned_to)
);

create table public.lost_found (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  description text not null,
  found_by uuid references public.profiles(id) on delete set null,
  found_at timestamptz not null default now(),
  status text not null default 'stored' check (status in ('stored', 'claimed', 'disposed')),
  storage_location text,
  notes text
);

create table public.folios (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  parent_folio_id uuid references public.folios(id) on delete set null,
  folio_number text not null,
  status public.folio_status not null default 'open',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (property_id, folio_number)
);

create table public.folio_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  folio_id uuid not null references public.folios(id) on delete cascade,
  type text not null check (type in ('debit', 'credit')),
  source_type public.folio_item_source_type not null,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  amount numeric(12,2) not null check (amount >= 0),
  business_date date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  posted_by uuid references public.profiles(id) on delete set null,
  posted_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  folio_id uuid not null references public.folios(id) on delete cascade,
  method public.payment_method not null,
  status public.payment_status not null default 'posted',
  amount numeric(12,2) not null check (amount > 0),
  reference text,
  received_at timestamptz not null default now(),
  received_by uuid references public.profiles(id) on delete set null
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  folio_id uuid not null references public.folios(id) on delete restrict,
  invoice_number text not null,
  status public.invoice_status not null default 'draft',
  total_amount numeric(12,2) not null check (total_amount >= 0),
  pdf_url text,
  issued_at timestamptz,
  issued_by uuid references public.profiles(id) on delete set null,
  unique (property_id, invoice_number)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete restrict,
  folio_id uuid not null references public.folios(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  status public.payment_status not null default 'posted',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.business_dates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  business_date date not null,
  status public.business_date_status not null default 'open',
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  unique (property_id, business_date)
);

create table public.night_audit_logs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  business_date date not null,
  step text not null,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on public.profiles (property_id);
create index on public.rooms (property_id, status);
create index on public.room_rates (property_id, room_type_id, rate_code);
create index on public.bookings (property_id, status, check_in, check_out);
create index on public.booking_rooms (property_id, room_id, check_in, check_out);
create index on public.guests (property_id, full_name);
create index on public.housekeeping_tasks (property_id, assigned_to, status);
create index on public.folios (property_id, booking_id, status);
create index on public.folio_items (property_id, folio_id);
create index on public.payments (property_id, folio_id, status);

create or replace function private.current_property_id()
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select property_id from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function private.has_role(required_role public.pms_role)
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
    where pr.profile_id = auth.uid()
      and p.is_active = true
      and pr.role = required_role
  )
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
    where pr.profile_id = auth.uid()
      and p.is_active = true
      and pr.role = any(required_roles)
  )
$$;

create or replace function public.fn_calculate_folio_balance(p_folio_id uuid)
returns numeric
language sql
stable
security invoker
as $$
  select coalesce(sum(case when type = 'debit' then amount else -amount end), 0)
  from public.folio_items
  where folio_id = p_folio_id
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
    and r.status not in ('occupied', 'out_of_order', 'blocked')
    and not exists (
      select 1
      from public.booking_rooms br
      where br.room_id = r.id
        and br.status in ('tentative', 'confirmed', 'checked_in')
        and tstzrange(br.check_in, br.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
    )
  order by r.number
$$;

create or replace function public.fn_add_folio_charge(
  p_folio_id uuid,
  p_source_type public.folio_item_source_type,
  p_description text,
  p_amount numeric
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_property_id uuid;
  v_item_id uuid;
begin
  select property_id into v_property_id from public.folios where id = p_folio_id and status = 'open';
  if v_property_id is null then
    raise exception 'Open folio not found';
  end if;

  insert into public.folio_items (property_id, folio_id, type, source_type, description, quantity, unit_price, amount, posted_by)
  values (v_property_id, p_folio_id, 'debit', p_source_type, p_description, 1, p_amount, p_amount, auth.uid())
  returning id into v_item_id;

  return v_item_id;
end;
$$;

create or replace function public.fn_record_payment(
  p_folio_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_reference text default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_property_id uuid;
  v_payment_id uuid;
begin
  select property_id into v_property_id from public.folios where id = p_folio_id and status = 'open';
  if v_property_id is null then
    raise exception 'Open folio not found';
  end if;

  insert into public.payments (property_id, folio_id, method, amount, reference, received_by)
  values (v_property_id, p_folio_id, p_method, p_amount, p_reference, auth.uid())
  returning id into v_payment_id;

  insert into public.folio_items (property_id, folio_id, type, source_type, description, quantity, unit_price, amount, posted_by)
  values (v_property_id, p_folio_id, 'credit', 'payment', 'Thanh toán', 1, p_amount, p_amount, auth.uid());

  return v_payment_id;
end;
$$;

create or replace function public.fn_create_booking(p_payload jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_property_id uuid := (p_payload->>'property_id')::uuid;
  v_guest_id uuid := (p_payload->>'guest_id')::uuid;
  v_room_id uuid := (p_payload->>'room_id')::uuid;
  v_check_in timestamptz := (p_payload->>'check_in')::timestamptz;
  v_check_out timestamptz := (p_payload->>'check_out')::timestamptz;
  v_booking_id uuid;
  v_booking_number text;
begin
  if v_property_id <> private.current_property_id() then
    raise exception 'Invalid property';
  end if;

  if not private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to create bookings';
  end if;

  if not exists (
    select 1 from public.fn_check_availability(v_property_id, (select room_type_id from public.rooms where id = v_room_id), v_check_in, v_check_out)
    where id = v_room_id
  ) then
    raise exception 'Room is not available';
  end if;

  v_booking_number := 'BK-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.bookings (
    booking_number, property_id, guest_id, check_in, check_out, nights, adults, children, status,
    source, rate_code, rate_per_night, total_amount, deposit_amount, deposit_paid,
    external_reference, notes, created_by
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
    coalesce((p_payload->>'status')::public.booking_status, 'tentative'),
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
  values (v_property_id, v_booking_id, v_room_id, v_check_in, v_check_out, coalesce((p_payload->>'status')::public.booking_status, 'tentative'));

  return v_booking_id;
end;
$$;

create or replace function public.fn_check_in_booking(
  p_booking_id uuid,
  p_room_id uuid,
  p_payment jsonb default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_property_id uuid;
  v_room_status public.room_status;
  v_folio_id uuid;
begin
  if not private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to check in';
  end if;

  select b.property_id into v_property_id from public.bookings b where b.id = p_booking_id;
  if v_property_id <> private.current_property_id() then
    raise exception 'Booking not found';
  end if;

  select status into v_room_status from public.rooms where id = p_room_id and property_id = v_property_id;
  if v_room_status <> 'vacant_clean' and not private.has_any_role(array['admin','manager']::public.pms_role[]) then
    raise exception 'Room must be vacant_clean before check-in';
  end if;

  update public.bookings set status = 'checked_in' where id = p_booking_id;
  update public.booking_rooms set status = 'checked_in', room_id = p_room_id where booking_id = p_booking_id;
  update public.rooms set status = 'occupied' where id = p_room_id;

  insert into public.folios (property_id, booking_id, folio_number)
  values (v_property_id, p_booking_id, 'F-' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYYMMDDHH24MISS'))
  on conflict do nothing
  returning id into v_folio_id;

  if v_folio_id is null then
    select id into v_folio_id from public.folios where booking_id = p_booking_id and parent_folio_id is null limit 1;
  end if;

  if p_payment is not null and coalesce((p_payment->>'amount')::numeric, 0) > 0 then
    perform public.fn_record_payment(v_folio_id, (p_payment->>'method')::public.payment_method, (p_payment->>'amount')::numeric, p_payment->>'reference');
  end if;

  return v_folio_id;
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
  v_property_id uuid;
  v_room_id uuid;
  v_folio_id uuid;
  v_balance numeric;
begin
  if not private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]) then
    raise exception 'Not allowed to check out';
  end if;

  select b.property_id, br.room_id
  into v_property_id, v_room_id
  from public.bookings b
  join public.booking_rooms br on br.booking_id = b.id
  where b.id = p_booking_id and b.status = 'checked_in'
  limit 1;

  if v_property_id <> private.current_property_id() then
    raise exception 'Checked-in booking not found';
  end if;

  select id, public.fn_calculate_folio_balance(id) into v_folio_id, v_balance
  from public.folios
  where booking_id = p_booking_id and parent_folio_id is null
  limit 1;

  if coalesce(v_balance, 0) > 0 and p_settlement_mode <> 'city_ledger' then
    raise exception 'Folio balance must be zero before checkout';
  end if;
  if coalesce(v_balance, 0) > 0 and not private.has_any_role(array['admin','manager','accountant']::public.pms_role[]) then
    raise exception 'Only manager/accountant can move balance to city ledger';
  end if;

  update public.folios set status = 'closed', closed_at = now() where id = v_folio_id;
  update public.bookings set status = 'checked_out' where id = p_booking_id;
  update public.booking_rooms set status = 'checked_out' where booking_id = p_booking_id;
  update public.rooms set status = 'vacant_dirty' where id = v_room_id;

  insert into public.housekeeping_tasks (property_id, room_id, task_type, status, priority, notes)
  values (v_property_id, v_room_id, 'checkout_clean', 'pending', 'high', 'Tự động tạo sau checkout');

  return v_folio_id;
end;
$$;

create or replace function public.fn_change_room(
  p_booking_id uuid,
  p_from_room_id uuid,
  p_to_room_id uuid,
  p_effective_at timestamptz default now()
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_property_id uuid;
  v_check_out timestamptz;
  v_new_assignment uuid;
begin
  if not private.has_any_role(array['admin','manager','receptionist']::public.pms_role[]) then
    raise exception 'Not allowed to change room';
  end if;

  select b.property_id, b.check_out into v_property_id, v_check_out
  from public.bookings b
  where b.id = p_booking_id and b.status = 'checked_in';

  if v_property_id <> private.current_property_id() then
    raise exception 'Checked-in booking not found';
  end if;

  if not exists (
    select 1
    from public.fn_check_availability(v_property_id, (select room_type_id from public.rooms where id = p_to_room_id), p_effective_at, v_check_out)
    where id = p_to_room_id
  ) then
    raise exception 'Target room is not available';
  end if;

  update public.booking_rooms
  set status = 'checked_out', check_out = p_effective_at
  where booking_id = p_booking_id and room_id = p_from_room_id and status = 'checked_in';

  insert into public.booking_rooms (property_id, booking_id, room_id, check_in, check_out, status)
  values (v_property_id, p_booking_id, p_to_room_id, p_effective_at, v_check_out, 'checked_in')
  returning id into v_new_assignment;

  update public.rooms set status = 'vacant_dirty' where id = p_from_room_id;
  update public.rooms set status = 'occupied' where id = p_to_room_id;

  insert into public.audit_logs (property_id, actor_id, entity_type, entity_id, action, before_data, after_data)
  values (
    v_property_id,
    auth.uid(),
    'booking',
    p_booking_id,
    'room_change',
    jsonb_build_object('room_id', p_from_room_id),
    jsonb_build_object('room_id', p_to_room_id)
  );

  return v_new_assignment;
end;
$$;

create or replace function public.fn_run_night_audit(p_property_id uuid, p_business_date date)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_posted int := 0;
  v_no_show int := 0;
begin
  if not private.has_any_role(array['admin', 'manager']::public.pms_role[]) then
    raise exception 'Not allowed to run night audit';
  end if;

  update public.bookings
  set status = 'no_show'
  where property_id = p_property_id
    and status in ('tentative', 'confirmed')
    and check_in::date <= p_business_date
    and not exists (select 1 from public.booking_rooms br where br.booking_id = bookings.id and br.status = 'checked_in');
  get diagnostics v_no_show = row_count;

  insert into public.folio_items (property_id, folio_id, type, source_type, description, quantity, unit_price, amount, business_date, posted_by)
  select f.property_id, f.id, 'debit', 'room', 'Night audit room charge', 1, b.rate_per_night, b.rate_per_night, p_business_date, auth.uid()
  from public.folios f
  join public.bookings b on b.id = f.booking_id
  where f.property_id = p_property_id
    and f.status = 'open'
    and b.status = 'checked_in'
    and not exists (
      select 1 from public.folio_items fi
      where fi.folio_id = f.id and fi.source_type = 'room' and fi.business_date = p_business_date
    );
  get diagnostics v_posted = row_count;

  insert into public.business_dates (property_id, business_date, status, closed_at, closed_by)
  values (p_property_id, p_business_date, 'closed', now(), auth.uid())
  on conflict (property_id, business_date)
  do update set status = 'closed', closed_at = excluded.closed_at, closed_by = excluded.closed_by;

  insert into public.business_dates (property_id, business_date, status)
  values (p_property_id, p_business_date + 1, 'open')
  on conflict do nothing;

  insert into public.night_audit_logs (property_id, business_date, step, summary, created_by)
  values (p_property_id, p_business_date, 'complete', jsonb_build_object('posted_room_charges', v_posted, 'no_show_bookings', v_no_show), auth.uid());

  return jsonb_build_object('posted_room_charges', v_posted, 'no_show_bookings', v_no_show);
end;
$$;

create or replace function public.fn_dashboard_stats()
returns jsonb
language sql
stable
security invoker
as $$
  with room_stats as (
    select
      count(*)::int as total_rooms,
      count(*) filter (where status in ('occupied','occupied_dirty','occupied_clean'))::int as occupied_rooms,
      count(*) filter (where status = 'vacant_clean')::int as available_rooms,
      count(*) filter (where status = 'vacant_dirty')::int as dirty_rooms,
      count(*) filter (where status = 'out_of_order')::int as maintenance_rooms
    from public.rooms
    where property_id = private.current_property_id()
  ),
  booking_stats as (
    select
      count(*) filter (where check_in::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date and status in ('confirmed','tentative'))::int as today_arrivals,
      count(*) filter (where check_out::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date and status = 'checked_in')::int as today_departures,
      count(*) filter (where status = 'checked_in')::int as in_house_guests,
      coalesce(sum(total_amount) filter (where created_at::date = (now() at time zone 'Asia/Ho_Chi_Minh')::date), 0) as today_revenue,
      coalesce(sum(total_amount) filter (where date_trunc('month', created_at) = date_trunc('month', now())), 0) as month_revenue
    from public.bookings
    where property_id = private.current_property_id()
  ),
  folio_stats as (
    select count(*) filter (where public.fn_calculate_folio_balance(id) > 0 and status = 'open')::int as unpaid_folios
    from public.folios
    where property_id = private.current_property_id()
  ),
  hk_stats as (
    select count(*) filter (where status in ('pending','in_progress'))::int as pending_hk_tasks
    from public.housekeeping_tasks
    where property_id = private.current_property_id()
  )
  select jsonb_build_object(
    'totalRooms', rs.total_rooms,
    'occupiedRooms', rs.occupied_rooms,
    'availableRooms', rs.available_rooms,
    'dirtyRooms', rs.dirty_rooms,
    'maintenanceRooms', rs.maintenance_rooms,
    'occupancyRate', case when rs.total_rooms = 0 then 0 else round((rs.occupied_rooms::numeric / rs.total_rooms) * 100, 2) end,
    'todayArrivals', bs.today_arrivals,
    'todayDepartures', bs.today_departures,
    'inHouseGuests', bs.in_house_guests,
    'todayRevenue', bs.today_revenue,
    'monthRevenue', bs.month_revenue,
    'adr', case when rs.occupied_rooms = 0 then 0 else round(bs.today_revenue / rs.occupied_rooms, 2) end,
    'revpar', case when rs.total_rooms = 0 then 0 else round(bs.today_revenue / rs.total_rooms, 2) end,
    'unpaidFolios', fs.unpaid_folios,
    'pendingHKTasks', hs.pending_hk_tasks
  )
  from room_stats rs, booking_stats bs, folio_stats fs, hk_stats hs
$$;

alter table public.properties enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.profile_roles enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.room_types enable row level security;
alter table public.rooms enable row level security;
alter table public.room_rates enable row level security;
alter table public.room_status_history enable row level security;
alter table public.maintenance_tickets enable row level security;
alter table public.guests enable row level security;
alter table public.guest_documents enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_rooms enable row level security;
alter table public.booking_deposits enable row level security;
alter table public.booking_notes enable row level security;
alter table public.housekeeping_tasks enable row level security;
alter table public.hk_assignments enable row level security;
alter table public.lost_found enable row level security;
alter table public.folios enable row level security;
alter table public.folio_items enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;
alter table public.refunds enable row level security;
alter table public.business_dates enable row level security;
alter table public.night_audit_logs enable row level security;

create policy "roles readable by authenticated users" on public.roles for select to authenticated using (true);
create policy "profiles same property select" on public.profiles for select to authenticated using (property_id = private.current_property_id() or id = auth.uid());
create policy "profile roles same property select" on public.profile_roles for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = profile_id and p.property_id = private.current_property_id())
);

create policy "properties same property select" on public.properties for select to authenticated using (id = private.current_property_id());

create policy "property scoped select settings" on public.settings for select to authenticated using (property_id = private.current_property_id());
create policy "admin manager manage settings" on public.settings for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager']::public.pms_role[])
);

create policy "property scoped select audit logs" on public.audit_logs for select to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager']::public.pms_role[])
);

create policy "property scoped select room types" on public.room_types for select to authenticated using (property_id = private.current_property_id());
create policy "property scoped manage room types" on public.room_types for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager']::public.pms_role[])
);

create policy "property scoped select rooms" on public.rooms for select to authenticated using (property_id = private.current_property_id());
create policy "operations manage rooms" on public.rooms for update to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist','hk_supervisor']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist','hk_supervisor']::public.pms_role[])
);

create policy "property scoped select rates" on public.room_rates for select to authenticated using (property_id = private.current_property_id());
create policy "admin manager manage rates" on public.room_rates for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager']::public.pms_role[])
);

create policy "property scoped room status history" on public.room_status_history for select to authenticated using (property_id = private.current_property_id());
create policy "operations insert room status history" on public.room_status_history for insert to authenticated with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist','hk_supervisor']::public.pms_role[])
);

create policy "property scoped maintenance" on public.maintenance_tickets for select to authenticated using (property_id = private.current_property_id());
create policy "operations manage maintenance" on public.maintenance_tickets for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','hk_supervisor','receptionist']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','hk_supervisor','receptionist']::public.pms_role[])
);

create policy "property scoped guests select" on public.guests for select to authenticated using (property_id = private.current_property_id());
create policy "reception manage guests" on public.guests for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])
);

create policy "property scoped guest documents select" on public.guest_documents for select to authenticated using (property_id = private.current_property_id());
create policy "reception manage guest documents" on public.guest_documents for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])
);

create policy "property scoped booking select" on public.bookings for select to authenticated using (property_id = private.current_property_id());
create policy "reception manage bookings" on public.bookings for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])
);

create policy "property scoped booking rooms select" on public.booking_rooms for select to authenticated using (property_id = private.current_property_id());
create policy "reception manage booking rooms" on public.booking_rooms for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])
);

create policy "property scoped booking finance select" on public.booking_deposits for select to authenticated using (property_id = private.current_property_id());
create policy "reception booking deposits insert" on public.booking_deposits for insert to authenticated with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[])
);
create policy "property scoped booking notes" on public.booking_notes for all to authenticated using (property_id = private.current_property_id()) with check (property_id = private.current_property_id());

create policy "property scoped hk select" on public.housekeeping_tasks for select to authenticated using (property_id = private.current_property_id());
create policy "hk staff update own tasks" on public.housekeeping_tasks for update to authenticated using (
  property_id = private.current_property_id()
  and (assigned_to = auth.uid() or private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[]))
) with check (
  property_id = private.current_property_id()
  and (assigned_to = auth.uid() or private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[]))
);
create policy "hk supervisor manage tasks" on public.housekeeping_tasks for insert to authenticated with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','hk_supervisor','receptionist']::public.pms_role[])
);

create policy "property scoped hk assignments" on public.hk_assignments for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[])
);

create policy "property scoped lost found select" on public.lost_found for select to authenticated using (property_id = private.current_property_id());
create policy "hk manage lost found" on public.lost_found for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[])
);

create policy "property scoped folios select" on public.folios for select to authenticated using (property_id = private.current_property_id());
create policy "reception manage folios" on public.folios for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[])
);

create policy "property scoped folio items select" on public.folio_items for select to authenticated using (property_id = private.current_property_id());
create policy "reception add folio items" on public.folio_items for insert to authenticated with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[])
);

create policy "property scoped payments select" on public.payments for select to authenticated using (property_id = private.current_property_id());
create policy "reception record payments" on public.payments for insert to authenticated with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[])
);
create policy "accountant update payments" on public.payments for update to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','accountant']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','accountant']::public.pms_role[])
);

create policy "property scoped invoices" on public.invoices for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','accountant']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager','accountant']::public.pms_role[])
);

create policy "property scoped refunds" on public.refunds for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','accountant']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','accountant']::public.pms_role[])
);

create policy "property scoped business dates select" on public.business_dates for select to authenticated using (property_id = private.current_property_id());
create policy "manager run business dates" on public.business_dates for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager']::public.pms_role[])
);

create policy "property scoped night audit logs" on public.night_audit_logs for all to authenticated using (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager']::public.pms_role[])
) with check (
  property_id = private.current_property_id() and private.has_any_role(array['admin','manager']::public.pms_role[])
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

insert into public.roles (name, description) values
  ('admin', 'Quản trị viên toàn hệ thống'),
  ('manager', 'Quản lý vận hành'),
  ('receptionist', 'Lễ tân'),
  ('hk_supervisor', 'Giám sát housekeeping'),
  ('hk_staff', 'Nhân viên housekeeping'),
  ('accountant', 'Kế toán')
on conflict do nothing;

do $$
declare
  v_property uuid := '00000000-0000-4000-8000-000000000001';
  v_std uuid := '00000000-0000-4000-8000-000000000101';
  v_sup uuid := '00000000-0000-4000-8000-000000000102';
  v_dlx uuid := '00000000-0000-4000-8000-000000000103';
  v_jsu uuid := '00000000-0000-4000-8000-000000000104';
  v_phs uuid := '00000000-0000-4000-8000-000000000105';
begin
  insert into public.properties (id, name, address, phone, email, stars, total_rooms)
  values (v_property, 'Grand Palace Hotel', '123 Đường Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh', '028 3822 1234', 'info@grandpalace.vn', 4, 50)
  on conflict (id) do nothing;

  insert into public.room_types (id, property_id, name, code, max_occupancy, bed_type, area, amenities, description, base_price) values
    (v_std, v_property, 'Phòng Standard', 'STD', 2, 'Giường đôi', 22, array['WiFi','TV','Điều hòa','Minibar'], 'Phòng tiêu chuẩn cho 2 khách', 800000),
    (v_sup, v_property, 'Phòng Superior', 'SUP', 2, 'Giường King', 28, array['WiFi','TV','Điều hòa','Minibar','View thành phố'], 'Phòng Superior tầng trung', 1100000),
    (v_dlx, v_property, 'Phòng Deluxe', 'DLX', 2, 'Giường King', 35, array['WiFi','TV','Điều hòa','Minibar','Bồn tắm'], 'Phòng Deluxe cao cấp', 1500000),
    (v_jsu, v_property, 'Phòng Junior Suite', 'JSU', 3, 'King + Sofa bed', 45, array['WiFi','TV','Phòng khách','Bồn tắm'], 'Suite nhỏ có phòng khách', 2200000),
    (v_phs, v_property, 'Penthouse Suite', 'PHS', 4, 'King + 2 giường đôi', 80, array['WiFi','TV','Phòng khách','Bếp nhỏ','Sân thượng'], 'Penthouse tầng thượng', 4500000)
  on conflict (id) do nothing;

  insert into public.rooms (property_id, room_type_id, number, floor)
  select v_property, v_std, (100 + gs)::text, 1 from generate_series(1,10) gs
  on conflict do nothing;
  insert into public.rooms (property_id, room_type_id, number, floor)
  select v_property, case when gs <= 4 then v_std else v_sup end, (200 + gs)::text, 2 from generate_series(1,10) gs
  on conflict do nothing;
  insert into public.rooms (property_id, room_type_id, number, floor)
  select v_property, case when gs <= 4 then v_sup else v_dlx end, (300 + gs)::text, 3 from generate_series(1,10) gs
  on conflict do nothing;
  insert into public.rooms (property_id, room_type_id, number, floor)
  select v_property, case when gs <= 5 then v_dlx else v_jsu end, (400 + gs)::text, 4 from generate_series(1,10) gs
  on conflict do nothing;
  insert into public.rooms (property_id, room_type_id, number, floor)
  select v_property, case when gs <= 5 then v_jsu else v_phs end, (500 + gs)::text, 5 from generate_series(1,10) gs
  on conflict do nothing;

  insert into public.room_rates (property_id, room_type_id, rate_code, name, amount)
  select v_property, id, 'BAR', 'Best Available Rate', base_price from public.room_types where property_id = v_property
  union all
  select v_property, id, 'WALK', 'Walk-in Rate', round(base_price * 1.10, 2) from public.room_types where property_id = v_property
  union all
  select v_property, id, 'CORP', 'Corporate Rate', round(base_price * 0.90, 2) from public.room_types where property_id = v_property;

  insert into public.settings (property_id, key, value)
  values (v_property, 'operations', '{"check_in_time":"14:00","check_out_time":"12:00","night_audit_time":"23:00"}'::jsonb)
  on conflict (property_id, key) do nothing;

  insert into public.business_dates (property_id, business_date, status)
  values (v_property, (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'open')
  on conflict do nothing;
end $$;
