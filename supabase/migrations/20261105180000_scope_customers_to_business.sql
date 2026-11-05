-- ============================================================
-- Scope customers strictly to the caller's business.
--
-- The "Admins can read all customers" policy (M6,
-- 20260812030000_admin_read_service_tables) lets any
-- is_admin() user read every customer row in every business.
-- That lets a fixture account's customers from another business
-- leak into "my customers" for an admin viewer.
--
-- Customers are tenant data: a login must be an active member of
-- the row's business (is_business_member(business_id)) to see it,
-- with no admin escape hatch. Dropping the admin read-all policy
-- leaves the tenant policy as the only SELECT path, so customers
-- from another business -- including Authz Fixture accounts --
-- never appear in another business's customer list.
-- ============================================================

DROP POLICY IF EXISTS "Admins can read all customers" ON public.customers;

notify pgrst, 'reload schema';
