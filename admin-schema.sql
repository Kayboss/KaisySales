-- ============================================================
-- KaisySales — Super Admin Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GHS';

-- 2. Create is_admin() security definer function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2b. Trigger to prevent non-admin users from changing privileged columns
CREATE OR REPLACE FUNCTION prevent_privilege_escalation()
RETURNS TRIGGER SET search_path = '' AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT EXISTS 
    (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Cannot change role without admin privileges';
  END IF;
  -- Allow users to accept free trial (NULL/'none' → 'free')
  IF NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan AND NOT EXISTS 
    (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    IF NOT (NEW.subscription_plan = 'free' AND (OLD.subscription_plan IS NULL OR OLD.subscription_plan = 'none')) THEN
      RAISE EXCEPTION 'Cannot change subscription plan without admin privileges';
    END IF;
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status AND NOT EXISTS 
    (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    IF NOT (NEW.subscription_status = 'active' AND (OLD.subscription_status IS NULL OR OLD.subscription_status = 'none')) THEN
      RAISE EXCEPTION 'Cannot change subscription status without admin privileges';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_profile_update ON public.profiles;
CREATE TRIGGER check_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_privilege_escalation();

-- 3. Create support_notes table
CREATE TABLE IF NOT EXISTS support_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_from_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error TEXT NOT NULL,
  page TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Enable RLS on new tables
ALTER TABLE support_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for support_notes
DROP POLICY IF EXISTS "Admins can read all support notes" ON support_notes;
CREATE POLICY "Admins can read all support notes" ON support_notes
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert support notes" ON support_notes;
CREATE POLICY "Admins can insert support notes" ON support_notes
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete support notes" ON support_notes;
CREATE POLICY "Admins can delete support notes" ON support_notes
  FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "Users can read own support notes" ON support_notes;
CREATE POLICY "Users can read own support notes" ON support_notes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own support notes" ON support_notes;
CREATE POLICY "Users can insert own support notes" ON support_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. RLS policies for error_logs
DROP POLICY IF EXISTS "Users can insert own error logs" ON error_logs;
CREATE POLICY "Users can insert own error logs" ON error_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read error logs" ON error_logs;
CREATE POLICY "Admins can read error logs" ON error_logs
  FOR SELECT USING (is_admin());

-- 8. Admin SELECT policies on all user data tables
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
CREATE POLICY "Admins can read all profiles" ON profiles
  FOR SELECT USING (is_admin());

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['sales', 'invoices', 'expenses', 'inventory', 'stores', 'categories'])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins can read all %I" ON %I;', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "Admins can read all %I" ON %I FOR SELECT USING (is_admin());',
      tbl, tbl
    );
  END LOOP;
END $$;

-- 9. Admin UPDATE policy for profiles (so admin can update status/role)
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- 11. Subscription management
-- 11a. Add subscription columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'none';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMPTZ;

-- Replace handle_new_user to set free trial atomically on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, subscription_plan, subscription_status, subscription_expires_at)
  VALUES (NEW.id, NEW.email, 'free', 'active', NOW() + INTERVAL '3 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11b. Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default plans
INSERT INTO subscription_plans (name, price, duration_days, features) VALUES
  ('free', 0.00, 3, '{"max_sales_month": 10, "max_invoices_month": 2, "max_products": 5, "reports": "basic", "support": "email", "trial": true}'),
  ('silver', 35.00, 30, '{"max_sales_month": 100, "max_invoices_month": 20, "max_products": 50, "reports": "basic", "support": "email"}'),
  ('gold', 75.00, 30, '{"max_sales_month": -1, "max_invoices_month": -1, "max_products": -1, "reports": "advanced", "support": "priority"}')
ON CONFLICT (name) DO NOTHING;

-- 11c. Create subscription_payments table
CREATE TABLE IF NOT EXISTS subscription_payments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reference TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'refunded')),
  payment_method TEXT DEFAULT 'manual' CHECK (payment_method IN ('manual', 'mobile_money')),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- RLS: admins can read all payments, users can read their own
DROP POLICY IF EXISTS "Admins can read all subscription payments" ON subscription_payments;
CREATE POLICY "Admins can read all subscription payments" ON subscription_payments
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Users can read own payments" ON subscription_payments;
CREATE POLICY "Users can read own payments" ON subscription_payments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own payments" ON subscription_payments;
CREATE POLICY "Users can insert own payments" ON subscription_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update subscription payments" ON subscription_payments;
CREATE POLICY "Admins can update subscription payments" ON subscription_payments
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- RLS: users can read subscription_plans
DROP POLICY IF EXISTS "Anyone can read subscription plans" ON subscription_plans;
CREATE POLICY "Anyone can read subscription plans" ON subscription_plans
  FOR SELECT USING (true);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Admin can read subscription_updated_at from profiles
-- (already covered by "Admins can read all profiles" policy above)

-- Grant permissions
GRANT ALL ON subscription_payments TO authenticated;
GRANT USAGE ON SEQUENCE subscription_payments_id_seq TO authenticated;
GRANT ALL ON subscription_plans TO authenticated;
GRANT USAGE ON SEQUENCE subscription_plans_id_seq TO authenticated;

-- 12. Grant permissions
GRANT ALL ON support_notes TO authenticated;
GRANT USAGE ON SEQUENCE support_notes_id_seq TO authenticated;
GRANT ALL ON error_logs TO authenticated;
GRANT USAGE ON SEQUENCE error_logs_id_seq TO authenticated;

-- 10. Set yourself as admin
UPDATE profiles SET role = 'admin' WHERE email = 'tripelkay@gmail.com';

-- 12. Remove subscription limit triggers (causes INSERT hang on sales)
DROP TRIGGER IF EXISTS enforce_subscription_limit ON public.sales;
DROP TRIGGER IF EXISTS enforce_subscription_limit ON public.invoices;
DROP TRIGGER IF EXISTS enforce_subscription_limit ON public.inventory;
DROP FUNCTION IF EXISTS check_subscription_limit();

-- 13. Auto-cleanup error logs older than 30 days (runs daily at midnight)
SELECT cron.schedule(
  'cleanup-old-error-logs',
  '0 0 * * *',
  $$DELETE FROM public.error_logs WHERE created_at < NOW() - INTERVAL '30 days'$$
);

-- 14. Verify
SELECT email, business_name, role FROM profiles WHERE role = 'admin';

-- 15. Reload schema cache
NOTIFY pgrst, 'reload schema';
