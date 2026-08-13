-- ============================================================
-- Security hardening: function ACLs, profile INSERT escalation,
-- keep_alive anon access, subscription_payments inserts, anon DML.
-- ============================================================

-- 1. Restrict EXECUTE on internal functions.
--    is_admin/can_create_record/is_subscription_active are used by RLS
--    policies evaluated as the authenticated role; everything else is
--    only called by triggers (no direct execute needed).
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.can_create_record(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_create_record(text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_subscription_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_subscription_active() TO authenticated;

REVOKE ALL ON FUNCTION public.log_admin_action(text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_privilege_escalation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_profile_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_payment_changes() FROM PUBLIC;

-- 2. Prevent privilege escalation on profile INSERT.
--    The UPDATE trigger already guards updates; INSERT was unprotected.
CREATE OR REPLACE FUNCTION public.prevent_profile_insert_escalation()
RETURNS TRIGGER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    NEW.role := 'user';
    IF NEW.subscription_plan IS NOT NULL AND NEW.subscription_plan NOT IN ('none', 'free') THEN
      RAISE EXCEPTION 'Cannot set subscription plan without admin privileges';
    END IF;
    IF NEW.subscription_status IS NOT NULL
       AND NEW.subscription_status <> 'none'
       AND NOT (NEW.subscription_status = 'active' AND NEW.subscription_plan IN ('none', 'free')) THEN
      RAISE EXCEPTION 'Cannot set subscription status without admin privileges';
    END IF;
    IF NEW.subscription_expires_at IS NOT NULL AND NEW.subscription_plan NOT IN ('none', 'free') THEN
      RAISE EXCEPTION 'Cannot set subscription expiry without admin privileges';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_profile_insert ON public.profiles;
CREATE TRIGGER check_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_insert_escalation();

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id AND role IS DISTINCT FROM 'admin');

-- 3. keep_alive: not used by the client anymore; revoke anon access.
DROP POLICY IF EXISTS "Allow anon to insert keep_alive" ON keep_alive;
DROP POLICY IF EXISTS "Allow anon to read keep_alive" ON keep_alive;
REVOKE ALL ON keep_alive FROM anon;

-- 4. subscription_payments: users may only submit pending payments;
--    confirming requires an admin update.
DROP POLICY IF EXISTS "Users can insert own payments" ON subscription_payments;
CREATE POLICY "Users can insert own payments" ON subscription_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending' AND admin_id IS NULL);

-- 5. Hygiene: revoke anon DML on user data tables. RLS still governs
--    all access; this removes unused (and risky) table-level grants.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON
  profiles, sales, invoices, inventory, customers, stores, categories, expenses,
  service_income, recurring_income, error_logs, support_notes, subscription_payments,
  admin_audit_log, page_visits
FROM anon;
