-- ============================================================
-- KaisySales Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. PROFILES (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  business_name TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  location TEXT DEFAULT '',
  category TEXT DEFAULT '',
  avatar_color TEXT DEFAULT '#6F240A',
  is_onboarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. SALES
CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  category TEXT DEFAULT '',
  quantity INTEGER DEFAULT 1,
  unit_price REAL DEFAULT 0,
  amount TEXT DEFAULT '',
  payment_method TEXT DEFAULT 'Cash',
  date DATE DEFAULT NULL,
  time TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their sales" ON sales;
CREATE POLICY "Users can CRUD their sales"
  ON sales FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer TEXT NOT NULL,
  customer_location TEXT DEFAULT '',
  date DATE DEFAULT NULL,
  total REAL DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  items JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their invoices" ON invoices;
CREATE POLICY "Users can CRUD their invoices"
  ON invoices FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount REAL DEFAULT 0,
  category TEXT DEFAULT '',
  date DATE DEFAULT NULL,
  trend TEXT DEFAULT 'down',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their expenses" ON expenses;
CREATE POLICY "Users can CRUD their expenses"
  ON expenses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. INVENTORY
CREATE TABLE IF NOT EXISTS inventory (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  quantity INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  status TEXT DEFAULT 'In Stock',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their inventory" ON inventory;
CREATE POLICY "Users can CRUD their inventory"
  ON inventory FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. STORES
CREATE TABLE IF NOT EXISTS stores (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT '',
  location TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their stores" ON stores;
CREATE POLICY "Users can CRUD their stores"
  ON stores FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their categories" ON categories;
CREATE POLICY "Users can CRUD their categories"
  ON categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. KEEP ALIVE (for free-tier inactivity prevention)
CREATE TABLE IF NOT EXISTS keep_alive (
  id BIGSERIAL PRIMARY KEY,
  ping_id UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE keep_alive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon to read keep_alive" ON keep_alive;
CREATE POLICY "Allow anon to read keep_alive"
  ON keep_alive FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow anon to insert keep_alive" ON keep_alive;
CREATE POLICY "Allow anon to insert keep_alive"
  ON keep_alive FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon to delete old keep_alive records" ON keep_alive;
CREATE POLICY "Allow anon to delete old keep_alive records"
  ON keep_alive FOR DELETE
  TO anon
  USING (true);

-- Grant Data API access (tables must be accessible to roles for REST API to expose them)
-- RLS policies still control row-level access per role
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, DELETE ON keep_alive TO anon;
GRANT USAGE ON SEQUENCE keep_alive_id_seq TO anon;

-- Reload PostgREST schema cache so tables are immediately available via REST API
NOTIFY pgrst, 'reload schema';
