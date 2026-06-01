import { dbService, authService, supabase } from './supabase';
import { useAuthStore } from '../store/authStore';


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
