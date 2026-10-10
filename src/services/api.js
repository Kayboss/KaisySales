import { dbService, supabase } from './supabase';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { getEntity, CATEGORY_TYPE_BY_ENTITY } from '../utils/import/schema';
import { findDuplicates, applyImportValues } from '../utils/import/duplicates';


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
      throw new Error('Unauthorized. Admin access required.', { cause: error });
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

export const fetchRecentActivity = async (limit = 20, userId = null) => {
  try {
    await requireAdmin();
    return await dbService.fetchRecentActivity(limit, userId);
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

export const updateSupportNoteStatus = async (noteId, status) => {
  try {
    await requireAdmin();
    return await dbService.updateSupportNoteStatus(noteId, status);
  } catch (error) {
    console.error('Failed to update support note status', error);
    throw error;
  }
};

// User-facing (no admin gate): a signed-in user files a problem report and can
// read back their own thread. RLS scopes both to auth.uid() = user_id.
export const createSupportRequest = async ({ message, category, url }) => {
  const uid = getUid();
  return await dbService.createSupportNote({ userId: uid, message, category, url });
};

export const fetchMySupportNotes = async () => {
  const uid = getUid();
  return await dbService.fetchSupportNotes(uid);
};

export const fetchUserActions = async (limit = 75, userId = null) => {
  try {
    await requireAdmin();
    return await dbService.fetchUserActions(limit, userId);
  } catch (error) {
    console.error('Failed to fetch user actions', error);
    return [];
  }
};

export const fetchOpenSupportRequests = async (limit = 100) => {
  try {
    await requireAdmin();
    return await dbService.fetchOpenSupportRequests(limit);
  } catch (error) {
    console.error('Failed to fetch open support requests', error);
    return [];
  }
};

export const fetchErrorLogs = async (limit = 20, userId = null) => {
  try {
    await requireAdmin();
    return await dbService.fetchErrorLogs(limit, userId);
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
// 10. SERVICE CATALOG (Services)
// ====================================================
export const fetchServices = async () => {
  try {
    const uid = getUid();
    return await dbService.fetchUserRecords(uid, 'services');
  } catch (error) {
    console.error('Error fetching services:', error);
    return [];
  }
};

export const createService = async (service) => {
  const uid = getUid();
  return await dbService.createUserRecord(uid, 'services', service);
};

export const updateService = async (id, service) => {
  const uid = getUid();
  return await dbService.updateUserRecord(uid, 'services', id, service);
};

export const deleteService = async (id) => {
  const uid = getUid();
  await dbService.deleteUserRecord(uid, 'services', id);
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

// ====================================================
// 15. LOGO UPLOAD (Supabase Storage)
// ====================================================

export const uploadBusinessLogo = async (file) => {
  const uid = getUid();
  const ext = file.name.split('.').pop() || 'png';
  const path = `${uid}/logo.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('business-logos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from('business-logos').getPublicUrl(path);
  return data.publicUrl;
};

export const deleteBusinessLogo = async () => {
  const uid = getUid();
  const { data: files } = await supabase.storage.from('business-logos').list(uid);
  if (files && files.length > 0) {
    const paths = files.map(f => `${uid}/${f.name}`);
    await supabase.storage.from('business-logos').remove(paths);
  }
};

// ====================================================
// 16. BULK IMPORT
// ====================================================
const WITHOUT_META = ['id', 'user_id', 'uid'];

const stripMeta = (record) => {
  const copy = { ...record };
  for (const key of WITHOUT_META) delete copy[key];
  return copy;
};

const importError = (message) => ({ message });

export const fetchExistingRows = async (entityKey) => {
  const entity = getEntity(entityKey);
  if (!entity) throw new Error(`Unknown import target "${entityKey}".`);
  const uid = getUid();
  return await dbService.fetchUserRecords(uid, entity.table);
};

export const importRows = async (entityKey, records, options = {}) => {
  const entity = getEntity(entityKey);
  if (!entity) throw new Error(`Unknown import target "${entityKey}".`);
  if (!Array.isArray(records) || records.length === 0) {
    return { success: true, attempted: 0, inserted: [], replaced: [], merged: [] };
  }

  const uid = getUid();
  const collision = options.collision === 'replace' ? 'replace' : 'add';
  const near = options.near === 'merge' ? 'merge' : 'add';

  let existing = options.existing || null;
  if (!existing) {
    try {
      existing = await fetchExistingRows(entityKey);
    } catch {
      existing = [];
    }
  }

  const { exact, near: nearMatches, unique } = findDuplicates(entity, records, existing);

  const toInsert = [];
  if (collision === 'add') toInsert.push(...exact.map((entry) => entry.record));
  if (near === 'add') toInsert.push(...nearMatches.map((entry) => entry.record));
  toInsert.push(...records.slice(0, unique));

  const updated = [];
  if (collision === 'replace') {
    for (const entry of exact) {
      updated.push({
        id: entry.existing.id,
        mode: 'replace',
        record: applyImportValues(entity, entry.existing, entry.record, 'replace'),
      });
    }
  }
  if (near === 'merge') {
    for (const entry of nearMatches) {
      updated.push({
        id: entry.existing.id,
        mode: 'merge',
        record: applyImportValues(entity, entry.existing, entry.record, 'merge'),
      });
    }
  }

  const outcome = {
    attempted: records.length,
    inserted: [],
    replaced: [],
    merged: [],
    errors: [],
  };

  if (toInsert.length > 0) {
    try {
      outcome.inserted = await dbService.createUserRecords(uid, entity.table, toInsert);
    } catch (error) {
      outcome.inserted = error.inserted || [];
      outcome.errors.push(error.message || 'Some rows could not be saved.');
      outcome.failedFrom = error.failedFrom;
    }
  }

  for (const operation of updated) {
    const previous = existing.find((row) => String(row.id) === String(operation.id));
    if (!previous) continue;

    const next = operation.record;
    const unchanged = JSON.stringify(stripMeta(next)) === JSON.stringify(stripMeta(previous));
    if (unchanged) {
      outcome[operation.mode === 'replace' ? 'replaced' : 'merged'].push({
        id: operation.id,
        previous,
        applied: next,
        unchanged: true,
      });
      continue;
    }

    try {
      const applied = await dbService.updateUserRecord(uid, entity.table, operation.id, stripMeta(next));
      outcome[operation.mode === 'replace' ? 'replaced' : 'merged'].push({
        id: operation.id,
        previous,
        applied,
      });
    } catch (error) {
      outcome.errors.push(error.message || `Could not update row ${operation.id}.`);
    }
  }

  const applied = outcome.inserted.length + outcome.replaced.length + outcome.merged.length;
  return {
    success: outcome.errors.length === 0 || applied > 0,
    attempted: outcome.attempted,
    inserted: outcome.inserted,
    replaced: outcome.replaced,
    merged: outcome.merged,
    partial: outcome.errors.length > 0,
    error: outcome.errors.length ? importError(outcome.errors.join(' ')) : null,
  };
};

export const undoImport = async (entityKey, { insertedIds = [], previous = [] }) => {
  const entity = getEntity(entityKey);
  if (!entity) return { success: true, error: null };

  const uid = getUid();
  const problems = [];

  for (const id of insertedIds) {
    try {
      await dbService.deleteUserRecord(uid, entity.table, id);
    } catch (error) {
      problems.push(error.message || `Could not remove row ${id}.`);
    }
  }

  for (const row of [...previous].reverse()) {
    try {
      await dbService.updateUserRecord(uid, entity.table, row.id, stripMeta(row));
    } catch (error) {
      problems.push(error.message || `Could not restore row ${row.id}.`);
    }
  }

  return {
    success: problems.length === 0,
    error: problems.length ? importError(problems.join(' ')) : null,
  };
};

export const deleteImportedRows = async (entityKey, ids) => {
  const entity = getEntity(entityKey);
  if (!entity || !Array.isArray(ids) || ids.length === 0) return { success: true };

  const uid = getUid();
  try {
    for (const id of ids) {
      await dbService.deleteUserRecord(uid, entity.table, id);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};

export const ensureImportCategories = async (entityKey, names) => {
  const type = CATEGORY_TYPE_BY_ENTITY[entityKey];
  if (!type) return { success: true, created: 0 };

  const clean = [...new Set((names || []).map((name) => String(name).trim()).filter(Boolean))];
  if (clean.length === 0) return { success: true, created: 0 };

  const uid = getUid();
  try {
    const existing = await dbService.fetchUserRecords(uid, 'categories');
    const existingNames = new Set(existing.map((cat) => String(cat.name).toLowerCase()));
    const toCreate = clean.filter((name) => !existingNames.has(name.toLowerCase()));

    let created = 0;
    for (const name of toCreate) {
      await dbService.createUserRecord(uid, 'categories', { name, type });
      created++;
    }
    return { success: true, created };
  } catch (error) {
    return { success: false, error, created: 0 };
  }
};
