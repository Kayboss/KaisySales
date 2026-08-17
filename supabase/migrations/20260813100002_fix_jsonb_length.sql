-- Fix: jsonb_length() doesn't exist in PostgreSQL.
-- Replace with a check that the jsonb object is not empty.
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
  IF changes != '{}'::jsonb THEN
    PERFORM public.log_admin_action('profile_update', NEW.id, changes);
  END IF;
  RETURN NEW;
END;
$$;
