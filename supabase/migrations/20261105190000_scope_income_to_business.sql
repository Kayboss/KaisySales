-- ============================================================
-- Scope recurring income and service income to the caller's business.
--
-- The "Admins can read all recurring income" and "Admins can read all
-- service income" policies (M6, 20260812030000_admin_read_service_tables)
-- let any is_admin() user read every row in every business. That lets a
-- fixture account's recurring income / service income from another business
-- leak into "my dashboard" for an admin viewer (e.g. the GHS 4.00 Monthly
-- Recurring card = four Authz Fixture rows at GHS 1.00 each).
--
-- These tables are tenant data: a login must be an active member of the row's
-- business (is_business_member(business_id)) to see it, with no admin escape
-- hatch. Dropping the admin read-all policies leaves the tenant policy as the
-- only SELECT path, so rows from another business never appear in another
-- business's dashboard.
-- ============================================================

DROP POLICY IF EXISTS "Admins can read all recurring income" ON public.recurring_income;
DROP POLICY IF EXISTS "Admins can read all service income" ON public.service_income;

notify pgrst, 'reload schema';
