import { fetchSales, fetchServiceIncome, fetchExpenses, fetchInventory, fetchCustomers, fetchRecurringIncome, fetchInvoices } from './api';
import { useSettingsStore } from '../store/settingsStore';
import { buildStatsByScope, buildProjection } from '../utils/assistant/stats';
import { canSeeReports } from '../utils/tenancy';

/**
 * Loads everything the assistant needs in one pass and packages it into the
 * context object the engine and the insights list consume. Every fetch already
 * fails soft (returns [] on error), so a dead backend degrades to "no records
 * yet" rather than a crash. Called lazily the first time the panel opens.
 *
 * The membership role travels with the numbers. A staff login without the
 * `reporting` module gets no expense rows back from RLS, so the same stats would
 * read "you spent GHS 0" — an answer that looks like a fact. The role lets the
 * engine say it cannot see them instead.
 */
export const buildAssistantContext = async () => {
  const { businessType, currency, businessName, businessRole, modules } =
    useSettingsStore.getState();
  const mode = businessType === 'services' ? 'services' : 'retail';
  // Only a retail staff login is ever limited. Everything else — an owner, a
  // services login (no staff exist there), or a membership that has not loaded
  // yet (businessRole is null until `loadSettings` finishes) — keeps every
  // figure. Defaulting the other way would tell an owner their expenses are
  // "not switched on" during the first paint.
  const role = mode === 'retail' && businessRole === 'staff' ? 'staff' : 'owner';
  const canSeeFinancials = canSeeReports({ role, modules });

  const [sales, serviceIncome, expenses, inventory, customers, recurring, invoices] = await Promise.all([
    mode === 'retail' ? fetchSales() : Promise.resolve([]),
    mode === 'services' ? fetchServiceIncome() : Promise.resolve([]),
    fetchExpenses(),
    mode === 'retail' ? fetchInventory() : Promise.resolve([]),
    mode === 'services' ? fetchCustomers() : Promise.resolve([]),
    mode === 'services' ? fetchRecurringIncome() : Promise.resolve([]),
    mode === 'services' ? fetchInvoices() : Promise.resolve([]),
  ]);

  const statsByScope = buildStatsByScope({
    mode,
    sales,
    serviceIncome,
    expenses,
    inventory,
    customers,
    recurring,
    invoices,
  });
  const projection = buildProjection({ mode, sales, serviceIncome });

  return {
    mode,
    role,
    modules: Array.isArray(modules) ? modules : [],
    canSeeFinancials,
    currency: currency || 'GHS',
    businessName: businessName || '',
    statsByScope,
    projection,
  };
};
