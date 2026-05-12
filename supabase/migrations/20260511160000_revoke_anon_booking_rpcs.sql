-- Revoke anon/public execute on all operational RPCs.
-- These functions rely on private.* helpers which already block anon at runtime,
-- but explicit revoke keeps the permission surface clean and removes advisor warnings.

-- Booking lifecycle
revoke all on function public.fn_check_availability(uuid, uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.fn_create_booking(jsonb) from public, anon;
revoke all on function public.fn_cancel_booking(uuid, text, text) from public, anon;
revoke all on function public.fn_check_in_booking(uuid, uuid, jsonb) from public, anon;
revoke all on function public.fn_check_out_booking(uuid, text) from public, anon;

-- Room management
revoke all on function public.fn_change_room_status(uuid, public.room_status, text) from public, anon;
revoke all on function public.fn_change_room(uuid, uuid, uuid, timestamptz) from public, anon;

-- Folio / payments
revoke all on function public.fn_add_folio_charge(uuid, public.folio_item_source_type, text, numeric) from public, anon;
revoke all on function public.fn_record_payment(uuid, public.payment_method, numeric, text) from public, anon;
revoke all on function public.fn_calculate_folio_balance(uuid) from public, anon;

-- Housekeeping
revoke all on function public.fn_assign_hk_task(uuid, uuid) from public, anon;
revoke all on function public.fn_update_hk_task_status(uuid, public.hk_task_status, text) from public, anon;

-- Reporting
revoke all on function public.fn_run_night_audit(uuid, date) from public, anon;
revoke all on function public.fn_revenue_summary(uuid, date, date) from public, anon;
revoke all on function public.fn_c65_export_rows(uuid, date, date) from public, anon;
revoke all on function public.fn_dashboard_stats() from public, anon;

-- Re-grant to authenticated only
grant execute on function public.fn_check_availability(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.fn_create_booking(jsonb) to authenticated;
grant execute on function public.fn_cancel_booking(uuid, text, text) to authenticated;
grant execute on function public.fn_check_in_booking(uuid, uuid, jsonb) to authenticated;
grant execute on function public.fn_check_out_booking(uuid, text) to authenticated;

grant execute on function public.fn_change_room_status(uuid, public.room_status, text) to authenticated;
grant execute on function public.fn_change_room(uuid, uuid, uuid, timestamptz) to authenticated;

grant execute on function public.fn_add_folio_charge(uuid, public.folio_item_source_type, text, numeric) to authenticated;
grant execute on function public.fn_record_payment(uuid, public.payment_method, numeric, text) to authenticated;
grant execute on function public.fn_calculate_folio_balance(uuid) to authenticated;

grant execute on function public.fn_assign_hk_task(uuid, uuid) to authenticated;
grant execute on function public.fn_update_hk_task_status(uuid, public.hk_task_status, text) to authenticated;

grant execute on function public.fn_run_night_audit(uuid, date) to authenticated;
grant execute on function public.fn_revenue_summary(uuid, date, date) to authenticated;
grant execute on function public.fn_c65_export_rows(uuid, date, date) to authenticated;
grant execute on function public.fn_dashboard_stats() to authenticated;
