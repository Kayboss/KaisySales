-- ============================================================
-- KaisySales — Super Admin Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add role + last_sign_in_at to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- 2. Create is_admin() security definer function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

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

-- 7. RLS policies for error_logs
DROP POLICY IF EXISTS "Anyone can insert error logs" ON error_logs;
CREATE POLICY "Anyone can insert error logs" ON error_logs
  FOR INSERT WITH CHECK (true);

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

-- 9. Grant permissions
GRANT ALL ON support_notes TO authenticated;
GRANT USAGE ON SEQUENCE support_notes_id_seq TO authenticated;
GRANT ALL ON error_logs TO authenticated;
GRANT USAGE ON SEQUENCE error_logs_id_seq TO authenticated;

-- 10. Set yourself as admin
UPDATE profiles SET role = 'admin' WHERE email = 'tripelkay@gmail.com';

-- 11. Verify
SELECT email, business_name, role FROM profiles WHERE role = 'admin';

-- 12. Reload schema cache
NOTIFY pgrst, 'reload schema';
