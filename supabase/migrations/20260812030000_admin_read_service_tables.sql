-- M6: Admin read access for service tables so the admin dashboard and
-- audit functions can see all users' data (mirrors core-table policies).

DROP POLICY IF EXISTS "Admins can read all customers" ON customers;
CREATE POLICY "Admins can read all customers" ON customers
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all projects" ON projects;
CREATE POLICY "Admins can read all projects" ON projects
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all service income" ON service_income;
CREATE POLICY "Admins can read all service income" ON service_income
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read all recurring income" ON recurring_income;
CREATE POLICY "Admins can read all recurring income" ON recurring_income
  FOR SELECT USING (public.is_admin());
