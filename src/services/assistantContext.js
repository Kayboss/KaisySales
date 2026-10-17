import { fetchSales, fetchServiceIncome, fetchExpenses, fetchInventory, fetchCustomers, fetchRecurringIncome, fetchInvoices, fetchCategories } from './api';
import { useSettingsStore } from '../store/settingsStore';
import { buildStatsByScope, buildProjection } from '../utils/assistant/stats';

/**
 * Loads everything the assistant needs in one pass and packages it into the
 * context object the engine consumes. Every fetch already fails soft (returns
 * [] on error), so a dead backend degrades to "no records yet" rather than a
 * crash. Called lazily the first time the panel opens.
 */
export const buildAssistantContext = async () => {
  const { businessType, currency, businessName } = useSettingsStore.getState();
  const mode = businessType === 'services' ? 'services' : 'retail';

  const [sales, serviceIncome, expenses, inventory, customers, recurring, invoices, expenseCategories, incomeCategories] = await Promise.all([
    mode === 'retail' ? fetchSales() : Promise.resolve([]),
    mode === 'services' ? fetchServiceIncome() : Promise.resolve([]),
    fetchExpenses(),
    mode === 'retail' ? fetchInventory() : Promise.resolve([]),
    mode === 'services' ? fetchCustomers() : Promise.resolve([]),
    mode === 'services' ? fetchRecurringIncome() : Promise.resolve([]),
    mode === 'services' ? fetchInvoices() : Promise.resolve([]),
    fetchCategories('expense'),
    mode === 'services' ? fetchCategories('income') : Promise.resolve([]),
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

  // The parser prompt is given the category list so it reuses the business's own
  // names instead of inventing one, and the item list so a sale lines up with the
  // inventory row whose cost and stock must move with it. The full `inventory`
  // rows ride along too, because the panel has to resolve that row (stock, cost,
  // min level) before it can show — or block — a sale's card.
  const categories = [...new Set([...expenseCategories, ...incomeCategories].map((c) => c?.name).filter(Boolean))];
  const items = inventory.map((item) => item?.name).filter(Boolean);

  return {
    mode,
    currency: currency || 'GHS',
    businessName: businessName || '',
    statsByScope,
    projection,
    categories,
    items,
    inventory,
  };
};