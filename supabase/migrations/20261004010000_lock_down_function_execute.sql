-- ============================================================
-- Stop anon and authenticated inheriting EXECUTE on new functions.
--
-- Two functions added in the migrations above were reachable by the public
-- anon key:
--
--   normalize_amount(text)        HTTP 200, callable with {"value":"5.00"}
--   sync_inventory_quantity()     trigger function, not callable over RPC
--
-- Both were invisible to the authorization suite, which reported
-- "not exposed to PostgREST - anonymous callers cannot reach it". That verdict
-- was wrong for normalize_amount: the probe only ever sends a `user_id`
-- argument, PostgREST answers 404 to a parameter name it does not recognise, and
-- the suite read that 404 as proof of non-reachability. See the shape list in
-- scripts/test-authz.mjs.
--
-- The underlying cause is the default ACL recorded in pg_default_acl, which
-- grants EXECUTE on functions, tables and sequences in `public` to anon and
-- authenticated. Revoking from PUBLIC is therefore never sufficient in this
-- database; the roles must be named.
--
-- Exposure was low: normalize_amount is a pure string formatter and
-- sync_inventory_quantity is a trigger, so neither can read or change a row.
-- It mattered because it contradicted the documented posture that anon can
-- execute no function at all, and because it made the suite report a PASS it
-- had not earned.
-- ============================================================

REVOKE ALL ON FUNCTION public.normalize_amount(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_inventory_quantity() FROM PUBLIC, anon, authenticated;

-- Close the trap for the next function. This affects newly created functions
-- only, so the three helpers that policies legitimately call
-- (can_create_record, is_admin, is_subscription_active) keep their existing
-- authenticated grant. Any future function that a policy or trigger relies on
-- must now say so with an explicit GRANT.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Confirm the three policy helpers still work for a signed-in user, since they
-- are the only functions authenticated is meant to reach. Kept as a plain query
-- rather than a DO block so it reports instead of raising:
--
--   select p.proname,
--          has_function_privilege('anon', p.oid, 'EXECUTE')         as anon_should_be_false,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authed_should_be_true
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('can_create_record', 'is_admin', 'is_subscription_active');
--
-- Every row must read anon_should_be_false = false, authed_should_be_true = true.
-- A trigger function needs no runtime EXECUTE privilege, so revoking it from
-- authenticated costs nothing.