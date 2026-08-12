-- ============================================================
-- KaisySales — Services Business Schema
-- Run this after supabase-schema.sql and admin-schema.sql
-- ============================================================

-- 1. Add business_type to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'retail'
  CHECK (business_type IN ('retail', 'services'));

-- 2. Customers table
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  location TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their customers" ON customers;
CREATE POLICY "Users can CRUD their customers" ON customers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_name TEXT DEFAULT '',
  description TEXT DEFAULT '',
  budget DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
  platform_tag TEXT DEFAULT 'direct',
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their projects" ON projects;
CREATE POLICY "Users can CRUD their projects" ON projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Service Income table (milestones + split payments)
CREATE TABLE IF NOT EXISTS service_income (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  client_name TEXT DEFAULT '',
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2) DEFAULT 0,
  platform_tag TEXT DEFAULT 'direct',
  milestone_label TEXT DEFAULT '',
  payment_date DATE DEFAULT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE service_income ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their service_income" ON service_income;
CREATE POLICY "Users can CRUD their service_income" ON service_income
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Recurring Income table (retainers/hosting)
CREATE TABLE IF NOT EXISTS recurring_income (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  next_due_date DATE DEFAULT NULL,
  category TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recurring_income ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their recurring_income" ON recurring_income;
CREATE POLICY "Users can CRUD their recurring_income" ON recurring_income
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Extend expenses with service-specific fields
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor TEXT DEFAULT '';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT '';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS renewal_date DATE DEFAULT NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_asset BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS asset_lifetime_years INTEGER DEFAULT NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS transaction_fee DECIMAL(10,2) DEFAULT 0;

-- 7. Extend invoices with project link and notes
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- 7b. Extend customers with company name
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company TEXT DEFAULT '';

-- Grant permissions
GRANT ALL ON customers TO authenticated;
GRANT USAGE ON SEQUENCE customers_id_seq TO authenticated;
GRANT ALL ON projects TO authenticated;
GRANT USAGE ON SEQUENCE projects_id_seq TO authenticated;
GRANT ALL ON service_income TO authenticated;
GRANT USAGE ON SEQUENCE service_income_id_seq TO authenticated;
GRANT ALL ON recurring_income TO authenticated;
GRANT USAGE ON SEQUENCE recurring_income_id_seq TO authenticated;

NOTIFY pgrst, 'reload schema';
