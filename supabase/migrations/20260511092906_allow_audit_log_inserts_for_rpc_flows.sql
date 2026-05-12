-- Business RPCs run under the caller role and write audit_logs as the
-- authenticated actor. Keep audit history insert-only for active staff in the
-- same property so check-in/checkout/room-change flows are not blocked by RLS.

drop policy if exists "active staff insert own audit logs" on public.audit_logs;
create policy "active staff insert own audit logs"
  on public.audit_logs
  for insert
  to authenticated
  with check (
    property_id = (select private.current_property_id())
    and actor_id = auth.uid()
    and (
      select private.has_any_role(
        array[
          'admin',
          'manager',
          'receptionist',
          'hk_supervisor',
          'hk_staff',
          'accountant'
        ]::public.pms_role[]
      )
    )
  );
