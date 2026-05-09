-- Cleanup from Supabase lint/advisors: stable search_path, duplicate index, extension schema, RLS initplan.

create schema if not exists extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'btree_gist'
      and n.nspname = 'public'
  ) then
    alter extension btree_gist set schema extensions;
  end if;
end $$;

drop index if exists public.booking_rooms_active_room_range_idx;

alter function public.fn_cancel_booking(uuid, text, text) set search_path = public, private;
alter function private.prevent_unauthorized_finalized_payment_update() set search_path = public, private;
alter function public.fn_dashboard_stats() set search_path = public, private;
alter function public.fn_update_hk_task_status(uuid, public.hk_task_status, text) set search_path = public, private;
alter function private.prevent_locked_business_date_changes() set search_path = public, private;
alter function public.fn_c65_export_rows(uuid, date, date) set search_path = public, private;
alter function public.fn_check_availability(uuid, uuid, timestamptz, timestamptz) set search_path = public, private;
alter function public.fn_create_booking(jsonb) set search_path = public, private;
alter function public.fn_record_payment(uuid, public.payment_method, numeric, text) set search_path = public, private;
alter function public.fn_check_out_booking(uuid, text) set search_path = public, private;
alter function public.fn_change_room_status(uuid, public.room_status, text) set search_path = public, private;
alter function public.fn_revenue_summary(uuid, date, date) set search_path = public, private;
alter function public.fn_run_night_audit(uuid, date) set search_path = public, private;
alter function public.fn_assign_hk_task(uuid, uuid) set search_path = public, private;
alter function public.fn_check_in_booking(uuid, uuid, jsonb) set search_path = public, private;
alter function public.fn_calculate_folio_balance(uuid) set search_path = public, private;
alter function private.hk_transition_allowed(public.hk_task_status, public.hk_task_status) set search_path = public, private;
alter function public.fn_change_room(uuid, uuid, uuid, timestamptz) set search_path = public, private;
alter function private.is_room_transition_allowed(public.room_status, public.room_status) set search_path = public, private;
alter function public.fn_add_folio_charge(uuid, public.folio_item_source_type, text, numeric) set search_path = public, private;

alter function test.set_auth_user(uuid) set search_path = public, auth, extensions, test;
alter function test.clear_auth_user() set search_path = public, auth, extensions, test;
alter function test.create_auth_user(uuid, text) set search_path = public, auth, extensions, test;
alter function test.create_property(text) set search_path = public, auth, extensions, test;
alter function test.expect_error(text) set search_path = public, auth, extensions, test;
alter function test.expect_success(text) set search_path = public, auth, extensions, test;

drop policy if exists "profiles same property select" on public.profiles;
create policy "profiles same property select"
  on public.profiles
  for select
  to authenticated
  using (
    property_id = (select private.current_property_id())
    or id = (select auth.uid())
  );

drop policy if exists "hk staff update own tasks" on public.housekeeping_tasks;
create policy "hk staff update own tasks"
  on public.housekeeping_tasks
  for update
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (
      assigned_to = (select auth.uid())
      or (select private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[]))
    )
  )
  with check (
    property_id = (select private.current_property_id())
    and (
      assigned_to = (select auth.uid())
      or (select private.has_any_role(array['admin','manager','hk_supervisor']::public.pms_role[]))
    )
  );

