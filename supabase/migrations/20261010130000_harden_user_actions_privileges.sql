-- ============================================================================
-- Harden privileges on user_actions (follow-up to 20261010120000)
--
-- 20261010120000 created public.user_actions and ran
--   GRANT SELECT ON public.user_actions TO authenticated;
-- but it never REVOKEd first. Every table created in `public` inherits the
-- Supabase default table ACL
--   anon=arwdDxtm, authenticated=arwdDxtm, service_role=arwdDxtm
-- (see pg_default_acl), so the new table came up with `anon` holding full DML
-- and `authenticated` holding INSERT/UPDATE/DELETE — NOT the SELECT-only,
-- append-only posture the migration comment claims. RLS still refuses those
-- writes (user_actions has no INSERT/UPDATE/DELETE policy and the two SELECT
-- policies both require auth.uid()/is_admin()), so nothing was exploitable
-- through the anon key — but the privilege layer must not lean on RLS alone,
-- and anon must hold nothing on a user-data table (20260813010000 did exactly
-- this revoke for every table that existed then; user_actions postdates it).
--
-- user_actions is written solely by the SECURITY DEFINER trigger
-- public.log_user_action (owned by postgres), which does not need the caller to
-- hold INSERT. So:
--   * anon:          no privilege whatsoever, like every other user-data table.
--   * authenticated: SELECT only — the trail is append-only by privilege, not
--                    merely by policy.
-- ============================================================================

REVOKE ALL ON public.user_actions FROM anon;

REVOKE ALL ON public.user_actions FROM authenticated;
GRANT SELECT ON public.user_actions TO authenticated;

-- Stop the same hole recurring: any future table created in public by postgres
-- no longer silently grants anon full DML. A table that genuinely needs anon
-- (e.g. the public subscription_plans catalogue) must GRANT explicitly, which
-- is the fail-closed default this project already uses for functions
-- (20261004010000).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;

NOTIFY pgrst, 'reload schema';
