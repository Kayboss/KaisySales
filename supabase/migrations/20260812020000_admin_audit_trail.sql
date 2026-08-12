-- M5: Admin audit trail. Records privileged changes to profiles
-- (role, subscription, status) and payment confirmations.
-- Written server-side by SECURITY DEFINER triggers, so it cannot be
-- forged or bypassed through the client API.

-- 1. Audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit log" ON admin_audit_log;
CREATE POLICY "Admins can read audit log" ON admin_audit_log
  FOR SELECT USING (public.is_admin());

GRANT SELECT ON admin_audit_log TO authenticated;

-- 2. Audit writer (SECURITY DEFINER so inserts bypass RLS)
CREATE OR REPLACE FUNCTION public.log_admin_action(action text, target_id uuid, details jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, action, target_id, details)
  VALUES (auth.uid(), action, target_id, COALESCE(details, '{}'::jsonb));
END;
$$;

-- 3. Log privileged profile changes
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    changes := changes || jsonb_build_object('role', jsonb_build_object('old', OLD.role, 'new', NEW.role));
  END IF;
  IF NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan THEN
    changes := changes || jsonb_build_object('subscription_plan', jsonb_build_object('old', OLD.subscription_plan, 'new', NEW.subscription_plan));
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    changes := changes || jsonb_build_object('subscription_status', jsonb_build_object('old', OLD.subscription_status, 'new', NEW.subscription_status));
  END IF;
  IF NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at THEN
    changes := changes || jsonb_build_object('subscription_expires_at', jsonb_build_object('old', OLD.subscription_expires_at, 'new', NEW.subscription_expires_at));
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    changes := changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
  END IF;
  IF jsonb_length(changes) > 0 THEN
    PERFORM public.log_admin_action('profile_update', NEW.id, changes);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();

-- 4. Log payment confirmation/status changes
CREATE OR REPLACE FUNCTION public.audit_payment_changes()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.admin_id IS DISTINCT FROM OLD.admin_id THEN
    PERFORM public.log_admin_action('payment_update', NEW.id, jsonb_build_object(
      'status', jsonb_build_object('old', OLD.status, 'new', NEW.status),
      'admin_id', NEW.admin_id
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_payment_changes ON public.subscription_payments;
CREATE TRIGGER audit_payment_changes
  AFTER UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_payment_changes();
