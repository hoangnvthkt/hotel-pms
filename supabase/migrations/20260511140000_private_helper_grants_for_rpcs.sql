-- Allow authenticated users to execute public RPCs and RLS policies that call private helpers.
-- The private schema remains unexposed through the Data API; these grants only allow DB execution.

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;
