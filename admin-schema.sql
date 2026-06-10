-- ============================================================
-- KaisySales — Super Admin Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add role column to profiles (default 'user')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 2. Create is_admin() security definer function
--    (bypasses RLS to avoid infinite recursion in policies)
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

-- 4. Enable RLS on support_notes
ALTER TABLE support_notes ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for support_notes
DROP POLICY IF EXISTS "Admins can read all support notes" ON support_notes;
CREATE POLICY "Admins can read all support notes" ON support_notes
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert support notes" ON support_notes;
CREATE POLICY "Admins can insert support notes" ON support_notes
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete support notes" ON support_notes;
CREATE POLICY "Admins can delete support notes" ON support_notes
  FOR DELETE USING (is_admin());

-- 6. Admin SELECT policies on all user data tables
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

-- 7. Grant permissions
GRANT ALL ON support_notes TO authenticated;
GRANT USAGE ON SEQUENCE support_notes_id_seq TO authenticated;

-- 8. Set yourself as admin
UPDATE profiles SET role = 'admin' WHERE email = 'tripelkay@gmail.com';

-- 9. Verify
SELECT email, business_name, role FROM profiles WHERE role = 'admin';

-- 10. Reload schema cache
NOTIFY pgrst, 'reload schema';
