import { dbService, authService, supabase } from './supabase';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';


/**
 * Scoped User ID Helper
 * Ensures all database calls are isolated under the active user's UID.
 */
const getUid = () => {
  const { user } = useAuthStore.getState();
  if (!user) {
    throw new Error('KaisySales Error: Attempted database request without an active authenticated session.');
  }
  return user.uid;
};

// ====================================================
// 1. SALES
// ====================================================
export const fetchSales = async () => {
  try {
    const uid = getUid();
    return await dbService.fetchUserRecords(uid, 'sales');
  } catch (error) {
    console.error('🔥 Error fetching sales:', error);
    return [];
  }
};

export const createSale = async (sale) => {
  const uid = getUid();
  return await dbService.createUserRecord(uid, 'sales', sale);
};

export const updateSale = async (id, sale) => {
  const uid = getUid();
  return await dbService.updateUserRecord(uid, 'sales', id, sale);
};

export const deleteSale = async (id) => {
  const uid = getUid();
  await dbService.deleteUserRecord(uid, 'sales', id);
};

// ====================================================
// 2. INVOICES
// ====================================================
export const fetchInvoices = async () => {
  try {
    const uid = getUid();
    return await dbService.fetchUserRecords(uid, 'invoices');
  } catch (error) {
    console.error('🔥 Error fetching invoices:', error);
    return [];
  }
};

export const createInvoice = async (invoice) => {
  const uid = getUid();
  return await dbService.createUserRecord(uid, 'invoices', invoice);
};

export const updateInvoice = async (id, invoice) => {
  const uid = getUid();
  return await dbService.updateUserRecord(uid, 'invoices', id, invoice);
};

export const deleteInvoice = async (id) => {
  const uid = getUid();
  await dbService.deleteUserRecord(uid, 'invoices', id);
};

// ====================================================
// 3. EXPENSES
// ====================================================
export const fetchExpenses = async () => {
  try {
    const uid = getUid();
    return await dbService.fetchUserRecords(uid, 'expenses');
  } catch (error) {
    console.error('🔥 Error fetching expenses:', error);
    return [];
  }
};

export const createExpense = async (expense) => {
  const uid = getUid();
  return await dbService.createUserRecord(uid, 'expenses', expense);
};

export const updateExpense = async (id, expense) => {
  const uid = getUid();
  return await dbService.updateUserRecord(uid, 'expenses', id, expense);
};

export const deleteExpense = async (id) => {
  const uid = getUid();
  await dbService.deleteUserRecord(uid, 'expenses', id);
};

export const fetchLargestExpenseCategory = async () => {
  try {
    const uid = getUid();
    if (!supabase) return 'N/A';
    const { data, error } = await supabase
      .from('expenses')
      .select('category')
      .eq('user_id', uid);
    if (error) throw error;
    const counts = {};
    (data || []).forEach(r => { counts[r.category] = (counts[r.category] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || 'N/A';
  } catch (error) {
    console.error('Failed to fetch largest expense category', error);
    return 'N/A';
  }
};

// ====================================================
// 4. INVENTORY
// ====================================================
export const fetchInventory = async () => {
  try {
    const uid = getUid();
    return await dbService.fetchUserRecords(uid, 'inventory');
  } catch (error) {
    console.error('🔥 Error fetching inventory:', error);
    return [];
  }
};

export const createInventoryItem = async (item) => {
  const uid = getUid();
  return await dbService.createUserRecord(uid, 'inventory', item);
};

export const updateInventoryItem = async (id, item) => {
  const uid = getUid();
  return await dbService.updateUserRecord(uid, 'inventory', id, item);
};

export const deleteInventoryItem = async (id) => {
  const uid = getUid();
  await dbService.deleteUserRecord(uid, 'inventory', id);
};

// ====================================================
// 5. PARTNER STORES
// ====================================================
export const fetchStores = async () => {
  try {
    const uid = getUid();
    return await dbService.fetchUserRecords(uid, 'stores');
  } catch (error) {
    console.error('🔥 Error fetching retail stores:', error);
    return [];
  }
};

export const createStore = async (store) => {
  const uid = getUid();
  return await dbService.createUserRecord(uid, 'stores', store);
};

export const updateStore = async (id, store) => {
  const uid = getUid();
  return await dbService.updateUserRecord(uid, 'stores', id, store);
};

export const deleteStore = async (id) => {
  const uid = getUid();
  await dbService.deleteUserRecord(uid, 'stores', id);
};

// ====================================================
// 6. CATEGORIES
// ====================================================
export const fetchCategories = async (type) => {
  try {
    const uid = getUid();
    const all = await dbService.fetchUserRecords(uid, 'categories');
    return type ? all.filter(c => c.type === type) : all;
  } catch (error) {
    console.error('🔥 Error fetching categories:', error);
    return [];
  }
};

export const createCategory = async (category) => {
  const uid = getUid();
  return await dbService.createUserRecord(uid, 'categories', category);
};

export const updateCategory = async (id, category) => {
  const uid = getUid();
  return await dbService.updateUserRecord(uid, 'categories', id, category);
};

export const deleteCategory = async (id) => {
  const uid = getUid();
  await dbService.deleteUserRecord(uid, 'categories', id);
};

// ====================================================
// 7. ADMIN
// ====================================================

const requireAdmin = async () => {
  const { user } = useAuthStore.getState();
  if (!user) {
    throw new Error('Unauthorized. No active session.');
  }
  const verifyUrl = import.meta.env.VITE_VERIFY_ADMIN_FUNCTION_URL;
  if (!verifyUrl) {
    throw new Error('Admin verification service not configured.');
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('No access token');
    const res = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Admin access required.');
    }
  } catch (error) {
    if (error.message === 'Admin access required.' || error.message === 'No access token') {
      throw new Error('Unauthorized. Admin access required.');
    }
    throw error;
  }
  return user.uid;
};
export const fetchAllProfiles = async () => {
  try {
    await requireAdmin();
    return await dbService.fetchAllProfiles();
  } catch (error) {
    console.error('Failed to fetch all profiles', error);
    return [];
  }
};

export const fetchUsersWithStats = async () => {
  try {
    await requireAdmin();
    return await dbService.fetchUsersWithStats();
  } catch (error) {
    console.error('Failed to fetch users with stats', error);
    return [];
  }
};

export const fetchRecentActivity = async (limit = 20) => {
  try {
    await requireAdmin();
    return await dbService.fetchRecentActivity(limit);
  } catch (error) {
    console.error('Failed to fetch recent activity', error);
    return [];
  }
};

export const createSupportNote = async (note) => {
  try {
    await requireAdmin();
    return await dbService.createSupportNote(note);
  } catch (error) {
    console.error('Failed to create support note', error);
    throw error;
  }
};

export const fetchSupportNotes = async (userId) => {
  try {
    await requireAdmin();
    return await dbService.fetchSupportNotes(userId);
  } catch (error) {
    console.error('Failed to fetch support notes', error);
    return [];
  }
};

export const fetchErrorLogs = async (limit = 20) => {
  try {
    await requireAdmin();
    return await dbService.fetchErrorLogs(limit);
  } catch (error) {
    console.error('Failed to fetch error logs', error);
    return [];
  }
};

export const updateUserStatus = async (userId, status) => {
  try {
    await requireAdmin();
    return await dbService.updateUserStatus(userId, status);
  } catch (error) {
    console.error('Failed to update user status', error);
    throw error;
  }
};

export const updateUserBusinessType = async (userId, businessType) => {
  try {
    await requireAdmin();
    return await dbService.updateUserBusinessType(userId, businessType);
  } catch (error) {
    console.error('Failed to update user business type', error);
    throw error;
  }
};

// ====================================================
// 8. SUBSCRIPTIONS
// ====================================================
export const fetchSubscriptionPlans = async () => {
  try {
    return await dbService.fetchSubscriptionPlans();
  } catch (error) {
    console.error('Failed to fetch subscription plans', error);
    return [];
  }
};

export const assignSubscription = async (userId, plan, durationDays) => {
  try {
    await requireAdmin();
    return await dbService.assignSubscription(userId, plan, durationDays);
  } catch (error) {
    console.error('Failed to assign subscription', error);
    throw error;
  }
};

export const cancelSubscription = async (userId) => {
  try {
    await requireAdmin();
    return await dbService.cancelSubscription(userId);
  } catch (error) {
    console.error('Failed to cancel subscription', error);
    throw error;
  }
};

export const recordPayment = async (paymentData) => {
  try {
    return await dbService.recordPayment(paymentData);
  } catch (error) {
    console.error('Failed to record payment', error);
    throw error;
  }
};

export const confirmPayment = async (paymentId, adminId) => {
  try {
    await requireAdmin();
    return await dbService.confirmPayment(paymentId, adminId);
  } catch (error) {
    console.error('Failed to confirm payment', error);
    throw error;
  }
};

export const fetchAllPayments = async (limit = 50) => {
  try {
    await requireAdmin();
    return await dbService.fetchAllPayments(limit);
  } catch (error) {
    console.error('Failed to fetch payments', error);
    return [];
  }
};

export const fetchUserPayments = async (userId) => {
  try {
    const currentUid = getUid();
    const { role } = useSettingsStore.getState();
    if (currentUid !== userId && role !== 'admin') {
      throw new Error('Unauthorized');
    }
    return await dbService.fetchUserPayments(userId);
  } catch (error) {
    console.error('Failed to fetch user payments', error);
    return [];
  }
};

// ====================================================
// 9. CUSTOMERS (Services)
// ====================================================
export const fetchCustomers = async () => {
  try {
    const uid = getUid();
    return await dbService.fetchUserRecords(uid, 'customers');
  } catch (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
};

export const createCustomer = async (customer) => {
  const uid = getUid();
  return await dbService.createUserRecord(uid, 'customers', customer);
};

export const updateCustomer = async (id, customer) => {
  const uid = getUid();
  return await dbService.updateUserRecord(uid, 'customers', id, customer);
};

export const deleteCustomer = async (id) => {
  const uid = getUid();
  await dbService.deleteUserRecord(uid, 'customers', id);
};

// ====================================================
// 10. PROJECTS (Services)
// ====================================================
export const fetchProjects = async () => {
  try {
    const uid = getUid();
    return await dbService.fetchUserRecords(uid, 'projects');
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
};

export const createProject = async (project) => {
  const uid = getUid();
  return await dbService.createUserRecord(uid, 'projects', project);
};

export const updateProject = async (id, project) => {
  const uid = getUid();
  return await dbService.updateUserRecord(uid, 'projects', id, project);
};

export const deleteProject = async (id) => {
  const uid = getUid();
  await dbService.deleteUserRecord(uid, 'projects', id);
};

// ====================================================
// 11. SERVICE INCOME (Services)
// ====================================================
export const fetchServiceIncome = async () => {
  try {
    const uid = getUid();
    return await dbService.fetchUserRecords(uid, 'service_income');
  } catch (error) {
    console.error('Error fetching service income:', error);
    return [];
  }
};

export const createServiceIncome = async (income) => {
  const uid = getUid();
  return await dbService.createUserRecord(uid, 'service_income', income);
};

export const updateServiceIncome = async (id, income) => {
  const uid = getUid();
  return await dbService.updateUserRecord(uid, 'service_income', id, income);
};

export const deleteServiceIncome = async (id) => {
  const uid = getUid();
  await dbService.deleteUserRecord(uid, 'service_income', id);
};

// ====================================================
// 12. RECURRING INCOME (Services)
// ====================================================
export const fetchRecurringIncome = async () => {
  try {
    const uid = getUid();
    return await dbService.fetchUserRecords(uid, 'recurring_income');
  } catch (error) {
    console.error('Error fetching recurring income:', error);
    return [];
  }
};

export const createRecurringIncome = async (item) => {
  const uid = getUid();
  return await dbService.createUserRecord(uid, 'recurring_income', item);
};

export const updateRecurringIncome = async (id, item) => {
  const uid = getUid();
  return await dbService.updateUserRecord(uid, 'recurring_income', id, item);
};

export const deleteRecurringIncome = async (id) => {
  const uid = getUid();
  await dbService.deleteUserRecord(uid, 'recurring_income', id);
};

export const fetchVisitStats = async () => {
  try {
    return await dbService.fetchVisitStats();
  } catch (error) {
    console.error('Failed to fetch visit stats', error);
    return { deviceData: [], locationData: [], dailyVisits: [] };
  }
};
