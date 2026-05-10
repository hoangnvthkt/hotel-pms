-- Metadata-backed room configuration.

create table if not exists public.metadata_options (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  category text not null,
  code text not null,
  label text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  system_locked boolean not null default false,
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.metadata_options add column if not exists property_id uuid references public.properties(id) on delete cascade;
alter table public.metadata_options add column if not exists category text;
alter table public.metadata_options add column if not exists code text;
alter table public.metadata_options add column if not exists label text;
alter table public.metadata_options add column if not exists description text;
alter table public.metadata_options add column if not exists sort_order int not null default 0;
alter table public.metadata_options add column if not exists is_active boolean not null default true;
alter table public.metadata_options add column if not exists system_locked boolean not null default false;
alter table public.metadata_options add column if not exists extra jsonb;
alter table public.metadata_options add column if not exists created_at timestamptz not null default now();
alter table public.metadata_options add column if not exists updated_at timestamptz not null default now();

create unique index if not exists metadata_options_property_category_code_idx
  on public.metadata_options (property_id, category, code);

alter table public.metadata_options drop constraint if exists metadata_options_category_check;
alter table public.metadata_options
  add constraint metadata_options_category_check
  check (
    category in (
      'guest_type',
      'stay_purpose',
      'booking_source',
      'folio_service_type',
      'payment_method',
      'hk_task_type',
      'bed_type',
      'room_feature',
      'rate_code',
      'cancellation_reason'
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'metadata_options_code_not_blank'
  ) then
    alter table public.metadata_options
      add constraint metadata_options_code_not_blank
      check (length(trim(code)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'metadata_options_label_not_blank'
  ) then
    alter table public.metadata_options
      add constraint metadata_options_label_not_blank
      check (length(trim(label)) > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'room_rates_rate_code_not_blank'
  ) then
    alter table public.room_rates
      add constraint room_rates_rate_code_not_blank
      check (length(trim(rate_code)) > 0);
  end if;
end $$;

alter table public.room_rates drop constraint if exists room_rates_rate_code_check;

create or replace function private.set_metadata_options_updated_at()
returns trigger
language plpgsql
set search_path = public, private
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists metadata_options_updated_at_trg on public.metadata_options;
create trigger metadata_options_updated_at_trg
  before update on public.metadata_options
  for each row execute function private.set_metadata_options_updated_at();

alter table public.metadata_options enable row level security;

drop policy if exists "metadata same property select" on public.metadata_options;
create policy "metadata same property select" on public.metadata_options
  for select to authenticated
  using (property_id = (select private.current_property_id()));

drop policy if exists "admin manager insert metadata" on public.metadata_options;
create policy "admin manager insert metadata" on public.metadata_options
  for insert to authenticated
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager']::public.pms_role[]))
  );

drop policy if exists "admin manager update metadata" on public.metadata_options;
create policy "admin manager update metadata" on public.metadata_options
  for update to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager']::public.pms_role[]))
  )
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager']::public.pms_role[]))
  );

drop policy if exists "admin manager delete metadata" on public.metadata_options;
create policy "admin manager delete metadata" on public.metadata_options
  for delete to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager']::public.pms_role[]))
  );

grant select, insert, update, delete on public.metadata_options to authenticated;

insert into public.metadata_options (
  property_id,
  category,
  code,
  label,
  description,
  sort_order,
  is_active,
  system_locked,
  extra
)
select
  p.id,
  seed.category,
  seed.code,
  seed.label,
  seed.description,
  seed.sort_order,
  true,
  false,
  null::jsonb
from public.properties p
cross join (
  values
    ('guest_type', 'standard', 'Khách thường', null, 0),
    ('guest_type', 'vip', 'VIP', null, 1),
    ('guest_type', 'corporate', 'Công ty', null, 2),
    ('stay_purpose', 'business', 'Công tác', null, 0),
    ('stay_purpose', 'leisure', 'Du lịch', null, 1),
    ('stay_purpose', 'family', 'Gia đình', null, 2),
    ('booking_source', 'direct', 'Trực tiếp', null, 0),
    ('booking_source', 'phone', 'Điện thoại', null, 1),
    ('booking_source', 'ota_manual', 'OTA', null, 2),
    ('booking_source', 'facebook', 'Facebook', null, 3),
    ('folio_service_type', 'manual_service', 'Dịch vụ thủ công', null, 0),
    ('folio_service_type', 'minibar', 'Minibar', null, 1),
    ('folio_service_type', 'laundry', 'Giặt là', null, 2),
    ('payment_method', 'cash', 'Tiền mặt', null, 0),
    ('payment_method', 'bank_transfer', 'Chuyển khoản', null, 1),
    ('payment_method', 'qr_manual', 'QR thủ công', null, 2),
    ('hk_task_type', 'checkout_clean', 'Dọn checkout', null, 0),
    ('hk_task_type', 'daily_service', 'Dọn hằng ngày', null, 1),
    ('hk_task_type', 'deep_clean', 'Tổng vệ sinh', null, 2),
    ('bed_type', 'double', 'Giường đôi', null, 0),
    ('bed_type', 'queen', 'Giường Queen', null, 1),
    ('bed_type', 'king', 'Giường King', null, 2),
    ('bed_type', 'twin', '2 giường đơn', null, 3),
    ('bed_type', 'king_sofa', 'Giường King + Sofa bed', null, 4),
    ('bed_type', 'family', 'Giường King + 2 Giường đôi', null, 5),
    ('room_feature', 'wifi', 'WiFi', null, 0),
    ('room_feature', 'tv', 'TV', null, 1),
    ('room_feature', 'aircon', 'Điều hòa', null, 2),
    ('room_feature', 'minibar', 'Minibar', null, 3),
    ('room_feature', 'safe', 'Két an toàn', null, 4),
    ('room_feature', 'city_view', 'View thành phố', null, 5),
    ('room_feature', 'pool_view', 'View hồ bơi', null, 6),
    ('room_feature', 'bathtub', 'Bồn tắm', null, 7),
    ('room_feature', 'living_room', 'Phòng khách riêng', null, 8),
    ('room_feature', 'kitchenette', 'Bếp nhỏ', null, 9),
    ('room_feature', 'terrace', 'Sân thượng riêng', null, 10),
    ('room_feature', 'jacuzzi', 'Bồn tắm jacuzzi', null, 11),
    ('rate_code', 'BAR', 'Best Available Rate', null, 0),
    ('rate_code', 'WALK', 'Walk-in Rate', null, 1),
    ('rate_code', 'CORP', 'Corporate Rate', null, 2),
    ('rate_code', 'SEASONAL', 'Seasonal Rate', null, 3),
    ('cancellation_reason', 'guest_request', 'Khách yêu cầu', null, 0),
    ('cancellation_reason', 'no_deposit', 'Chưa đặt cọc', null, 1),
    ('cancellation_reason', 'duplicate', 'Đặt trùng', null, 2)
) as seed(category, code, label, description, sort_order)
on conflict (property_id, category, code) do nothing;
