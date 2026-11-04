-- ============================================================
-- M5: Per-user row scoping on sales, invoices, expenses.
--
-- Currently any active member of a business can read every row
-- in that business (owner sees all branches, staff sees their
-- branch). This changes SELECT so:
--
--   * Every authenticated user always sees their own rows
--     (user_id = auth.uid()), regardless of business.
--   * Business owners additionally see all rows in their
--     business (existing oversight behaviour preserved).
--   * Non-owner staff see only their own rows (changed from
--     seeing every row in their branch).
--
-- Write policies are unchanged: fill_tenant() already forces
-- user_id = auth.uid() and business_id = membership on insert,
-- so users can only ever write their own rows.
-- ============================================================

-- sales
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
  for select to authenticated
  using (user_id = auth.uid()
     or (public.is_business_owner(business_id) and public.can_see_branch(business_id, branch_id)));

-- invoices
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated
  using (user_id = auth.uid()
     or (public.is_business_owner(business_id) and public.can_see_branch(business_id, branch_id)));

-- expenses
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (user_id = auth.uid()
     or (public.is_business_owner(business_id) and public.can_see_branch(business_id, branch_id)));

notify pgrst, 'reload schema';
