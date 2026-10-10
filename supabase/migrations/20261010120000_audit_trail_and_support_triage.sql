-- ============================================================================
-- Audit trail of user actions + user-facing problem reporting
--
--  1. user_actions: append-only audit of every data write, captured by a
--     SECURITY DEFINER trigger on all user-owned business tables.
--  2. support_notes: gains category / status / url so users can file a report
--     from the app and support can triage it (mark resolved on a report).
--  3. error_logs: gains `details` jsonb so the admin Errors view can carry the
--     stack trace and user-agent next to the message.
--
-- Why the trigger function is SECURITY DEFINER (see 20261005153000):
--   A SECURITY INVOKER trigger would INSERT into user_actions as `authenticated`.
--   That works while user_id = auth.uid(), but an ADMIN writing to a customer's
--   row (e.g. confirming a payment) sets user_id to the *customer*, so the row's
--   insert policy (auth.uid() = user_id) would reject the audit insert and roll
--   back the legitimate write. Running the trigger as postgres avoids that, just
--   like the audit_profile_changes fix did. The trail stays honest: auth.uid()
--   and the row's OWN user_id are recorded, not the postgres role.
--
-- Security of the DEFINER function:
--   REVOKE ALL ... FROM anon, authenticated. Trigger functions need no runtime
--   EXECUTE privilege (see 20261004010000), so revoking it does not break the
--   triggers, and anon cannot forge audit rows through POST /rest/v1/rpc/...
--   search_path is pinned to '' as the standard mitigation for DEFINER.
--
-- Append-only enforcement:
--   user_actions grants authenticated SELECT only — the SECURITY DEFINER trigger
--   is the sole writer — and there is no UPDATE/DELETE privilege or policy, so
--   neither a user nor an anon caller can alter or purge the trail.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. user_actions table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_actions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_actions_user_created
  ON public.user_actions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_actions_created
  ON public.user_actions (created_at DESC);

ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all user actions" ON public.user_actions;
CREATE POLICY "Admins can read all user actions" ON public.user_actions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Users can read own user actions" ON public.user_actions;
CREATE POLICY "Users can read own user actions" ON public.user_actions
  FOR SELECT USING (auth.uid() = user_id);

-- Only the SECURITY DEFINER trigger writes the trail, so `authenticated` is given
-- SELECT alone: granting INSERT would let any signed-in user forge audit rows
-- about themselves. The admin view reads through the "Admins can read all" policy.
GRANT SELECT ON public.user_actions TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trigger function + triggers on every user-owned business table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_user_action()
RETURNS TRIGGER SET search_path = '' AS $$
DECLARE
  new_row jsonb;
  old_row jsonb;
  actor uuid;
BEGIN
  -- This one function is attached to heterogeneous tables: most carry a
  -- user_id column, profiles does not (its own id is the account). Referencing
  -- NEW.user_id directly would raise "record has no field user_id" on profiles
  -- and break signup and every settings save, so the owner is read out of the
  -- row snapshot instead — a missing key yields NULL rather than an error.
  new_row := to_jsonb(NEW);
  old_row := to_jsonb(OLD);
  actor := COALESCE(
    NULLIF(new_row->>'user_id', '')::uuid,
    NULLIF(old_row->>'user_id', '')::uuid,
    CASE WHEN new_row->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}$' THEN (new_row->>'id')::uuid END,
    CASE WHEN old_row->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}$' THEN (old_row->>'id')::uuid END,
    auth.uid()
  );
  INSERT INTO public.user_actions (user_id, action, entity, entity_id, details)
  VALUES (
    actor,
    lower(TG_OP),
    TG_TABLE_NAME,
    COALESCE(new_row->>'id', old_row->>'id'),
    CASE WHEN TG_OP = 'DELETE' THEN old_row ELSE new_row END
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.log_user_action() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'sales', 'invoices', 'expenses', 'inventory', 'stores', 'categories',
    'customers', 'services', 'service_income', 'recurring_income',
    'profiles', 'subscription_payments'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_user_actions ON public.%I;', tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_user_actions AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_user_action();',
      tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. support_notes: triage + where the user hit the problem
-- ---------------------------------------------------------------------------
ALTER TABLE public.support_notes ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.support_notes ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.support_notes ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.support_notes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'resolved'));

-- Admins must be able to mark a report resolved. Users stay append-only:
-- they can insert and read their own notes but not edit or delete them.
DROP POLICY IF EXISTS "Admins can update support notes" ON public.support_notes;
CREATE POLICY "Admins can update support notes" ON public.support_notes
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- A user files a report as themselves and only as themselves: without the
-- is_from_admin guard a user could post rows that render as a support reply in
-- their own thread. Admins still reply through the separate is_admin() policy.
DROP POLICY IF EXISTS "Users can insert own support notes" ON public.support_notes;
CREATE POLICY "Users can insert own support notes" ON public.support_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_from_admin IS NOT TRUE);

-- ---------------------------------------------------------------------------
-- 4. error_logs: carry stack + user-agent context
-- ---------------------------------------------------------------------------
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS details JSONB;

-- ---------------------------------------------------------------------------
-- 5. Reload the PostgREST schema cache
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';