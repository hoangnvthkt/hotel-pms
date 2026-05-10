-- Allow controlled room CRUD from the PMS UI. Delete remains admin/manager only.

drop policy if exists "operations insert rooms" on public.rooms;
create policy "operations insert rooms"
  on public.rooms
  for insert
  to authenticated
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager']::public.pms_role[]))
  );

drop policy if exists "operations delete rooms" on public.rooms;
create policy "operations delete rooms"
  on public.rooms
  for delete
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager']::public.pms_role[]))
  );

