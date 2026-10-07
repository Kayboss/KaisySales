import { fetchSales, fetchServiceIncome, fetchExpenses, fetchInventory, fetchCustomers, fetchRecurringIncome, fetchInvoices } from './api';
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

  return { mode, currency: currency || 'GHS', businessName: businessName || '', statsByScope, projection };
};