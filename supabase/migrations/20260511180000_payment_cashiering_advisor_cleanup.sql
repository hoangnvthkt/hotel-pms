-- Advisor cleanup for payment/cashiering lifecycle migration.

alter function private.normalize_manual_payment_method(public.payment_method)
  set search_path = public, private;

alter function private.generate_receipt_number(text)
  set search_path = public, private;

drop policy if exists "active staff insert own audit logs" on public.audit_logs;
create policy "active staff insert own audit logs"
  on public.audit_logs
  for insert
  to authenticated
  with check (
    property_id = (select private.current_property_id())
    and actor_id = (select auth.uid())
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

drop policy if exists "finance manage bank accounts" on public.bank_accounts;

drop policy if exists "finance insert bank accounts" on public.bank_accounts;
create policy "finance insert bank accounts"
  on public.bank_accounts
  for insert
  to authenticated
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  );

drop policy if exists "finance update bank accounts" on public.bank_accounts;
create policy "finance update bank accounts"
  on public.bank_accounts
  for update
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  )
  with check (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  );

drop policy if exists "finance delete bank accounts" on public.bank_accounts;
create policy "finance delete bank accounts"
  on public.bank_accounts
  for delete
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
  );

drop policy if exists "cashier sessions select" on public.cashier_sessions;
create policy "cashier sessions select"
  on public.cashier_sessions
  for select
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (
      cashier_id = (select auth.uid())
      or (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
    )
  );

drop policy if exists "cashier sessions insert" on public.cashier_sessions;
create policy "cashier sessions insert"
  on public.cashier_sessions
  for insert
  to authenticated
  with check (
    property_id = (select private.current_property_id())
    and cashier_id = (select auth.uid())
    and (select private.has_any_role(array['admin','manager','receptionist','accountant']::public.pms_role[]))
  );

drop policy if exists "cashier sessions update" on public.cashier_sessions;
create policy "cashier sessions update"
  on public.cashier_sessions
  for update
  to authenticated
  using (
    property_id = (select private.current_property_id())
    and (
      cashier_id = (select auth.uid())
      or (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
    )
  )
  with check (
    property_id = (select private.current_property_id())
    and (
      cashier_id = (select auth.uid())
      or (select private.has_any_role(array['admin','manager','accountant']::public.pms_role[]))
    )
  );
