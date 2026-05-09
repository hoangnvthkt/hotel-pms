-- Realtime surface and query/RLS path indexes for MVP operations.

create index if not exists rooms_property_type_status_idx
  on public.rooms (property_id, room_type_id, status, is_active);

create index if not exists rooms_property_floor_status_idx
  on public.rooms (property_id, floor, status);

create index if not exists booking_rooms_property_room_status_range_idx
  on public.booking_rooms (property_id, room_id, status, check_in, check_out);

create index if not exists bookings_property_dates_status_idx
  on public.bookings (property_id, check_in, check_out, status);

create index if not exists housekeeping_tasks_board_idx
  on public.housekeeping_tasks (property_id, status, assigned_to, room_id);

create index if not exists folio_items_folio_type_source_idx
  on public.folio_items (folio_id, type, source_type);

create index if not exists payments_property_status_method_idx
  on public.payments (property_id, status, method, received_at desc);

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'housekeeping_tasks'
  ) then
    alter publication supabase_realtime add table public.housekeeping_tasks;
  end if;
end $$;

