-- Split broad FOR ALL manage policies so SELECT uses one permissive policy per table.

drop policy if exists "admin manager manage settings" on public.settings;
create policy "admin manager insert settings" on public.settings
  for insert to authenticated
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));
create policy "admin manager update settings" on public.settings
  for update to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])))
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));
create policy "admin manager delete settings" on public.settings
  for delete to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));

drop policy if exists "property scoped manage room types" on public.room_types;
create policy "admin manager insert room types" on public.room_types
  for insert to authenticated
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));
create policy "admin manager update room types" on public.room_types
  for update to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])))
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));
create policy "admin manager delete room types" on public.room_types
  for delete to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));

drop policy if exists "admin manager manage rates" on public.room_rates;
create policy "admin manager insert rates" on public.room_rates
  for insert to authenticated
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));
create policy "admin manager update rates" on public.room_rates
  for update to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])))
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));
create policy "admin manager delete rates" on public.room_rates
  for delete to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));

drop policy if exists "reception manage guests" on public.guests;
create policy "reception insert guests" on public.guests
  for insert to authenticated
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));
create policy "reception update guests" on public.guests
  for update to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])))
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));
create policy "reception delete guests" on public.guests
  for delete to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));

drop policy if exists "reception manage guest documents" on public.guest_documents;
create policy "reception insert guest documents" on public.guest_documents
  for insert to authenticated
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));
create policy "reception update guest documents" on public.guest_documents
  for update to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])))
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));
create policy "reception delete guest documents" on public.guest_documents
  for delete to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));

drop policy if exists "reception manage bookings" on public.bookings;
create policy "reception insert bookings" on public.bookings
  for insert to authenticated
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));
create policy "reception update bookings" on public.bookings
  for update to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])))
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));
create policy "reception delete bookings" on public.bookings
  for delete to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));

drop policy if exists "reception manage booking rooms" on public.booking_rooms;
create policy "reception insert booking rooms" on public.booking_rooms
  for insert to authenticated
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));
create policy "reception update booking rooms" on public.booking_rooms
  for update to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])))
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));
create policy "reception delete booking rooms" on public.booking_rooms
  for delete to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist']::public.pms_role[])));

drop policy if exists "operations manage maintenance" on public.maintenance_tickets;
create policy "operations insert maintenance" on public.maintenance_tickets
  for insert to authenticated
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','hk_supervisor','receptionist']::public.pms_role[])));
create policy "operations update maintenance" on public.maintenance_tickets
  for update to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','hk_supervisor','receptionist']::public.pms_role[])))
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','hk_supervisor','receptionist']::public.pms_role[])));
create policy "operations delete maintenance" on public.maintenance_tickets
  for delete to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','hk_supervisor','receptionist']::public.pms_role[])));

drop policy if exists "hk manage lost found" on public.lost_found;
create policy "hk insert lost found" on public.lost_found
  for insert to authenticated
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[])));
create policy "hk update lost found" on public.lost_found
  for update to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[])))
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[])));
create policy "hk delete lost found" on public.lost_found
  for delete to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[])));

drop policy if exists "reception manage folios" on public.folios;
create policy "reception insert folios" on public.folios
  for insert to authenticated
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[])));
create policy "reception update folios" on public.folios
  for update to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[])))
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[])));
create policy "reception delete folios" on public.folios
  for delete to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[])));

drop policy if exists "manager run business dates" on public.business_dates;
create policy "manager insert business dates" on public.business_dates
  for insert to authenticated
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));
create policy "manager update business dates" on public.business_dates
  for update to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])))
  with check (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));
create policy "manager delete business dates" on public.business_dates
  for delete to authenticated
  using (property_id = (select private.current_property_id()) and (select private.has_any_role(array['admin','manager']::public.pms_role[])));

