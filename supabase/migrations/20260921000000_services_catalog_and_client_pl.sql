-- ============================================================
-- Service Catalog table + per-client expense tagging.
-- 1) services: predefined services with default price/category.
-- 2) expenses.client_name: lets expenses be attributed to a client
--    so per-client P&L can be computed.
-- ============================================================

CREATE TABLE IF NOT EXISTS services (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) DEFAULT 0,
  category TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD their services" ON services;
CREATE POLICY "Users can CRUD their services" ON services
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all services" ON services;
CREATE POLICY "Admins can read all services" ON services
  FOR SELECT USING (public.is_admin());

GRANT ALL ON services TO authenticated;
GRANT USAGE ON SEQUENCE services_id_seq TO authenticated;

-- Per-client expense attribution for P&L
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS client_name TEXT DEFAULT '';

NOTIFY pgrst, 'reload schema';