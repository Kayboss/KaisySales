-- ============================================================
-- KaisySales — Super Admin Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add role column to profiles (default 'user')
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 2. Create support_notes table
CREATE TABLE IF NOT EXISTS support_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_from_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS on support_notes
ALTER TABLE support_notes ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for support_notes: admins can CRUD, users can read their own
DROP POLICY IF EXISTS "Admins can read all support notes" ON support_notes;
CREATE POLICY "Admins can read all support notes" ON support_notes
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can insert support notes" ON support_notes;
CREATE POLICY "Admins can insert support notes" ON support_notes
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete support notes" ON support_notes;
CREATE POLICY "Admins can delete support notes" ON support_notes
  FOR DELETE USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- 5. Admin SELECT policies on all user data tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['sales', 'invoices', 'expenses', 'inventory', 'stores', 'categories'])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Admins can read all %I" ON %I;', tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "Admins can read all %I" ON %I FOR SELECT USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role = ''admin'')
      );', tbl, tbl
    );
  END LOOP;
END $$;

-- 6. Grant authenticated users access to support_notes
GRANT ALL ON support_notes TO authenticated;
GRANT USAGE ON SEQUENCE support_notes_id_seq TO authenticated;

-- 7. Set yourself as admin (replace with your actual user UUID from auth.users)
-- Uncomment and run after finding your UUID:
-- UPDATE profiles SET role = 'admin' WHERE email = 'tripelkay@gmail.com';
-- SELECT * FROM profiles WHERE role = 'admin';

-- 8. Reload schema cache
NOTIFY pgrst, 'reload schema';
