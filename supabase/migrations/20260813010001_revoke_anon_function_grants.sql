-- ============================================================
-- Follow-up: internal functions carried explicit anon/authenticated
-- grants that REVOKE FROM PUBLIC does not remove. Revoke them
-- explicitly and strip the last anon table grants (TRIGGER etc.).
-- ============================================================

-- is_admin/can_create_record/is_subscription_active: RLS-only (authenticated)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_create_record(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_subscription_active() FROM anon;

-- Internal/trigger functions: no caller needs direct execute
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, uuid, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_privilege_escalation() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_profile_changes() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_payment_changes() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_insert_escalation() FROM anon, authenticated;

-- Remove all anon privileges on user data tables (RLS + authenticated grants remain)
REVOKE ALL ON
  profiles, sales, invoices, inventory, customers, stores, categories, expenses,
  service_income, recurring_income, error_logs, support_notes, subscription_payments,
  admin_audit_log, page_visits
FROM anon;

-- subscription_plans: keep anon read (public data), drop everything else
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON subscription_plans FROM anon;
