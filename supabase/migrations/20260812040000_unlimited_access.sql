-- TEMPORARY: Subscriptions disabled — everything unlimited for all users.
-- Re-enable later by restoring the can_create_record definition from
-- 20260812010000_subscription_limits_rls.sql and reverting the client
-- checks in src/utils/subscriptionLimits.js.

CREATE OR REPLACE FUNCTION public.can_create_record(rec_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT true;
$$;
