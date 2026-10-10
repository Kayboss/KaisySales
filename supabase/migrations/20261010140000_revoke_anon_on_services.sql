-- ============================================================================
-- Revoke anon on `services` (Service Catalog)
--
-- `services` is a user-data table (RLS: auth.uid() = user_id for CRUD, plus an
-- admin SELECT policy) that escaped the anon revoke in 20260813010000. Its ACL
-- still carried the inherited Supabase default
--   anon=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm
-- so, exactly like user_actions before 20261010130000, only RLS stood between
-- the public anon key and the table. The authz suite's A/C/D/E checks already
-- pass (RLS denies anon), but the privilege layer must not lean on RLS alone:
-- anon should hold nothing on a user-data table.
--
-- `authenticated` keeps full DML (the app reads/writes the catalogue signed in),
-- and the audit trigger log_user_action is SECURITY DEFINER owned by postgres,
-- so neither needs anon.
-- ============================================================================

REVOKE ALL ON public.services FROM anon;

NOTIFY pgrst, 'reload schema';
