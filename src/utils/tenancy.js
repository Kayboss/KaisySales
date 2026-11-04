/**
 * Tenancy rules, kept pure and import-free so they can be unit tested in plain
 * Node (`scripts/tenant.test.mjs`) and so there is exactly one place that
 * decides "what may this login see".
 *
 * The database is the authority: RLS plus `fill_tenant` decide what comes back
 * at all. These helpers decide what the *interface* offers, and they must agree
 * with the SQL or a screen will render empty while looking healthy:
 *
 *   MODULES          ↔ `public.business_members.modules` / `has_module()`
 *   resolveActiveBranch ↔ `can_see_branch()` (staff are pinned to one branch)
 *   canSeeReports    ↔ `has_module(business_id, 'reporting')`
 */

/**
 * The only modules that exist. `sales` is always present (it is the job the
 * cashier was hired for); `reporting` is the one opt-in toggle and it also
 * covers Expenses and the Business Overview totals.
 *
 * Adding a module here without adding it to `set_member_modules`' allow-list
 * would let the UI offer a permission the database silently drops, so
 * `scripts/tenant.test.mjs` reads the migration and fails on drift.
 */
export const MODULES = ['sales', 'reporting'];

export const BASE_MODULE = 'sales';

export const REPORTING_MODULE = 'reporting';

/**
 * Mirrors `set_member_modules`: unknown names are dropped, duplicates collapse,
 * the list is sorted, and `sales` is appended when missing.
 */
export const normaliseModules = (modules) => {
  const list = Array.isArray(modules) ? modules : [];
  const unique = [...new Set(list.filter((name) => MODULES.includes(name)))].sort();
  return unique.includes(BASE_MODULE) ? unique : [...unique, BASE_MODULE];
};

/**
 * A staff member must not be able to reach Reporting, Expenses, the Overview
 * totals or the assistant insights; the owner always can.
 */
export const canSeeReports = ({ role, modules } = {}) =>
  role === 'owner' || normaliseModules(modules).includes(REPORTING_MODULE);

/**
 * Which branch the screen is looking at:
 *   - staff: the branch on their membership, never a stored preference
 *     (localStorage is editable, and a cashier switching it would be looking at
 *     another shop's takings on a screen the database then empties);
 *   - owner: the branch they picked, or `null` for "All branches".
 *
 * A stored branch that no longer exists (archived) resolves to All branches
 * rather than to an empty screen nobody can explain.
 */
export const resolveActiveBranch = ({ role, branchId = null, branches = [], stored = null } = {}) => {
  if (role === 'staff') return branchId ?? null;
  const list = Array.isArray(branches) ? branches : [];
  if (list.length === 0) return null;
  const candidate = stored == null || stored === '' ? NaN : Number(stored);
  if (!Number.isFinite(candidate)) return null;
  return list.some((branch) => Number(branch.id) === candidate) ? candidate : null;
};

/**
 * The branch a write lands in when the owner is viewing "All branches": the
 * default branch, else the first live one. Inventory is per branch, so there is
 * no "all branches" shelf to add stock to.
 */
export const branchForWrites = ({ role, branchId = null, activeBranchId = null, branches = [] } = {}) => {
  if (role === 'staff') return branchId ?? null;
  if (activeBranchId != null) return activeBranchId;
  const list = Array.isArray(branches) ? branches : [];
  const fallback = list.find((branch) => branch.isDefault) || list[0];
  return fallback ? Number(fallback.id) : null;
};
