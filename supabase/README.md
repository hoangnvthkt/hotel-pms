# Supabase Database Workflow

The first production migration, `20260508000000_initial_hotel_pms.sql`, has already been applied remotely. Do not rewrite or split it.

Use forward-only migrations for every database change:

```bash
npx supabase migration list --linked
npx supabase db push --dry-run
npx supabase db push
npx supabase test db
npx supabase db lint
```

Database tests live in `supabase/tests/database`. Supabase runs SQL/pgTAP test files from the `supabase/tests` directory and wraps each test file in a transaction, but each file still uses explicit `begin` and `rollback` for clarity.

