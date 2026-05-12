-- Public staff/account RPCs require a signed-in PMS user.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'fn_clear_my_avatar',
        'fn_update_my_profile',
        'fn_update_staff_profile',
        'fn_set_staff_roles',
        'fn_deactivate_staff',
        'fn_reactivate_staff'
      )
  loop
    execute format('revoke execute on function %s from anon', fn.signature);
    execute format('revoke execute on function %s from public', fn.signature);
    execute format('grant execute on function %s to authenticated', fn.signature);
  end loop;
end $$;
