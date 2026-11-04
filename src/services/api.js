import { dbService, supabase } from './supabase';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { getEntity, CATEGORY_TYPE_BY_ENTITY } from '../utils/import/schema';
import { findDuplicates, applyImportValues } from '../utils/import/duplicates';
import { branchForWrites } from '../utils/tenancy';
import { cached, invalidateAdminCache } from './adminCache';


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

/**
 * The branch the owner has selected, or null for "All branches". Staff never
 * have a null here: their membership pins them to one branch and RLS does the
 * rest, so this filter is mostly for the owner's branch switcher.
 */
const getBranchScope = () => useSettingsStore.getState().activeBranchId ?? null;

/**
 * Inventory is per branch. An owner looking at "All branches" still needs one
 * shelf to add stock to, so writes/shelf reads fall back to the default branch.
 */
export const getInventoryBranchId = () => {
  const { activeBranchId, branchId, branches, businessRole } =
    useSettingsStore.getState();
  return branchForWrites({
    role: businessRole,
    branchId,
    activeBranchId,
    branches,
  });
};

// ====================================================
// 1. SALES
// ====================================================
export const fetchSales = async () => {
  try {
    return await dbService.fetchTenantRecords('sales', { branchId: getBranchScope(), userId: getUid() });
  } catch (error) {
    console.error('🔥 Error fetching sales:', error);
    return [];
  }
};

export const createSale = async (sale) => {
  return await dbService.createTenantRecord('sales', sale);
};

export const updateSale = async (id, sale) => {
  return await dbService.updateTenantRecord('sales', id, sale);
};

export const deleteSale = async (id) => {
  await dbService.deleteTenantRecord('sales', id);
};

// ====================================================
// 2. INVOICES
// ====================================================
export const fetchInvoices = async () => {
  try {
    return await dbService.fetchTenantRecords('invoices', { branchId: getBranchScope(), userId: getUid() });
  } catch (error) {
    console.error('🔥 Error fetching invoices:', error);
    return [];
  }
};

export const createInvoice = async (invoice) => {
  return await dbService.createTenantRecord('invoices', invoice);
};

export const updateInvoice = async (id, invoice) => {
  return await dbService.updateTenantRecord('invoices', id, invoice);
};

export const deleteInvoice = async (id) => {
  await dbService.deleteTenantRecord('invoices', id);
};

// ====================================================
// 3. EXPENSES
// ====================================================
export const fetchExpenses = async () => {
  try {
    return await dbService.fetchTenantRecords('expenses', { branchId: getBranchScope(), userId: getUid() });
  } catch (error) {
    console.error('🔥 Error fetching expenses:', error);
    return [];
  }
};

export const createExpense = async (expense) => {
  return await dbService.createTenantRecord('expenses', expense);
};

export const updateExpense = async (id, expense) => {
  return await dbService.updateTenantRecord('expenses', id, expense);
};

export const deleteExpense = async (id) => {
  await dbService.deleteTenantRecord('expenses', id);
};

export const fetchLargestExpenseCategory = async () => {
  try {
    if (!supabase) return 'N/A';
    const { data, error } = await supabase
      .from('expenses')
      .select('category')
      .eq('user_id', getUid());
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
// 4. INVENTORY (products + per-branch stock)
// ====================================================
export const fetchInventory = async () => {
  try {
    return await dbService.fetchBranchInventory(getInventoryBranchId());
  } catch (error) {
    console.error('🔥 Error fetching inventory:', error);
    return [];
  }
};

// Kept for the import adapter and any caller that only has a name.
export const fetchProducts = async () => {
  try {
    return await dbService.fetchProducts();
  } catch (error) {
    console.error('🔥 Error fetching products:', error);
    return [];
  }
};

export const fetchBranchInventory = async (branchId = getInventoryBranchId()) => {
  try {
    return await dbService.fetchBranchInventory(branchId);
  } catch (error) {
    console.error('🔥 Error fetching branch inventory:', error);
    return [];
  }
};

export const createInventoryItem = async (item) => {
  return await dbService.createProduct({
    name: item.name,
    category: item.category,
    unit: item.unit,
    price: item.price,
    cost: item.costPrice,
    minStock: item.minStock,
    branchId: getInventoryBranchId(),
    stock: Number(item.stock) || 0,
  });
};

export const updateInventoryItem = async (id, item) => {
  const productId = item.productId || item.product_id;
  if (productId) {
    await dbService.updateProduct(productId, {
      name: item.name,
      category: item.category,
      unit: item.unit,
    });
  }
  await dbService.updateBranchStock(id, {
    stock: Number(item.stock) || 0,
    price: item.price,
    cost_price: item.costPrice,
    min_stock: item.minStock,
    status: item.status,
  });
  return { ...item, id: String(id) };
};

// Product identity is business-wide, stock is per branch: deleting the product
// cascades every branch's stock row by design.
export const deleteInventoryItem = async (id, productId = null) => {
  const target = productId || id;
  await dbService.deleteProduct(target);
};

export const restockProduct = async (productId, quantityDelta, branchId = getInventoryBranchId()) => {
  const rows = await dbService.fetchBranchInventory(branchId);
  const row = rows.find((item) => String(item.productId) === String(productId));
  if (!row) throw new Error('This product is not stocked at the selected branch.');
  const next = Math.max(0, (Number(row.stock) || 0) + quantityDelta);
  await dbService.setBranchStock({
    productId,
    branchId,
    stock: next,
    price: row.price,
    cost: row.costPrice,
    minStock: row.minStock,
  });
  return next;
};

// ====================================================
// 4b. BRANCHES / TEAM
// ====================================================
export const fetchBranches = async () => {
  try {
    return await dbService.fetchBranches();
  } catch (error) {
    console.error('Failed to fetch branches', error);
    return [];
  }
};

export const createBranch = async (branch) => {
  const { businessId } = useSettingsStore.getState();
  return dbService.createBranch({ businessId, ...branch });
};

export const updateBranch = async (branchId, fields) => {
  return dbService.updateBranch(branchId, fields);
};

export const archiveBranch = async (branchId) => {
  return dbService.archiveBranch(branchId);
};

export const listMembers = async () => {
  return dbService.listMembers();
};

export const fetchMemberDirectory = async () => {
  try {
    return await dbService.memberDirectory();
  } catch (error) {
    console.error('Failed to load teammate names', error);
    return [];
  }
};

export const createInvite = async (branchId) => {
  return dbService.createInvite(branchId);
};

export const listInvites = async () => {
  return dbService.listInvites();
};

export const revokeInvite = async (inviteId) => {
  return dbService.revokeInvite(inviteId);
};

export const setMemberModules = async (userId, modules) => {
  return dbService.setMemberModules(userId, modules);
};

export const setMemberBranch = async (userId, branchId) => {
  return dbService.setMemberBranch(userId, branchId);
};

export const removeMember = async (userId) => {
  return dbService.removeMember(userId);
};

export const transferOwnership = async (userId) => {
  return dbService.transferOwnership(userId);
};

export const redeemInvite = async (code) => {
  return dbService.redeemInvite(code);
};

// ====================================================
// 4c. SALES / INVOICE RPCs
// ====================================================
export const recordSale = async (sale) => {
  return dbService.recordSale({
    ...sale,
    branchId: sale.branchId ?? getInventoryBranchId(),
  });
};

export const recordInvoiceSale = async (invoiceId) => {
  return dbService.recordInvoiceSale(invoiceId);
};

export const voidSale = async (saleId, reason = '') => {
  return dbService.voidSale(saleId, reason);
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
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Unauthorized. Admin access required.');
  try {
    // The verify-admin edge function is a network hop in front of EVERY admin
    // read. The answer cannot change until the access token does, so memoize it
    // per token for a short window and share one in-flight call between the
    // concurrent fetches a tab fires (e.g. the inbox's Promise.all). Failures are
    // never cached, so a denied caller still fails on the next attempt.
    await cached(`admin:verify:${token}`, async () => {
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
      return true;
    }, 60 * 1000);
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
    return await cached('admin:allProfiles', () => dbService.fetchAllProfiles());
  } catch (error) {
    console.error('Failed to fetch all profiles', error);
    return [];
  }
};

export const fetchUsersWithStats = async () => {
  try {
    await requireAdmin();
    return await cached('admin:usersWithStats', () => dbService.fetchUsersWithStats());
  } catch (error) {
    console.error('Failed to fetch users with stats', error);
    return [];
  }
};

export const fetchNeverSignedInUsers = async (limit = 200) => {
  try {
    await requireAdmin();
    return await dbService.fetchNeverSignedInUsers(limit);
  } catch (error) {
    console.error('Failed to fetch never-signed-in users', error);
    return [];
  }
};

/**
 * Staff logins (see `dbService.fetchStaffUserIds`). A Set because every caller
 * only ever asks "is this account a cashier?" — and the alternative, a `find`
 * per row, is how a funnel with 500 accounts gets slow for no reason.
 */
export const fetchStaffUserIds = async () => {
  try {
    await requireAdmin();
    const ids = await cached('admin:staffUserIds', () => dbService.fetchStaffUserIds());
    return new Set(Array.isArray(ids) ? ids : []);
  } catch (error) {
    console.error('Failed to fetch staff accounts', error);
    // An empty set means the exclusion cannot be applied, so the funnel would
    // over-count staff as businesses until the next load. That is visible in the
    // numbers; throwing would blank the whole screen for one failed lookup.
    return new Set();
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
    const result = await dbService.updateUserStatus(userId, status);
    invalidateAdminCache();
    return result;
  } catch (error) {
    console.error('Failed to update user status', error);
    throw error;
  }
};

export const deleteUser = async (userId) => {
  try {
    const result = await dbService.deleteUserAccount(userId);
    invalidateAdminCache();
    return result;
  } catch (error) {
    console.error('Failed to delete user account', error);
    throw error;
  }
};

export const updateUserBusinessType = async (userId, businessType) => {
  try {
    await requireAdmin();
    const result = await dbService.updateUserBusinessType(userId, businessType);
    invalidateAdminCache();
    return result;
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
    const result = await dbService.assignSubscription(userId, plan, durationDays);
    invalidateAdminCache();
    return result;
  } catch (error) {
    console.error('Failed to assign subscription', error);
    throw error;
  }
};

export const cancelSubscription = async (userId) => {
  try {
    await requireAdmin();
    const result = await dbService.cancelSubscription(userId);
    invalidateAdminCache();
    return result;
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
    const result = await dbService.confirmPayment(paymentId, adminId);
    invalidateAdminCache();
    return result;
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
// 14b. GROWTH (acquisition + activation)
// ====================================================

// Records where this account first came from. Fails soft: a business losing its
// signup attribution must never interrupt the app it just signed into.
export const recordAcquisition = async (touch) => {
  try {
    const uid = getUid();
    return await dbService.recordAcquisition(uid, touch);
  } catch (error) {
    console.error('Failed to record acquisition', error);
    return false;
  }
};

export const fetchAcquisition = async () => {
  try {
    return await dbService.fetchAcquisition();
  } catch (error) {
    console.error('Failed to fetch acquisition', error);
    return [];
  }
};

export const fetchVisitDays = async (days = 90) => {
  try {
    return await dbService.fetchVisitDays(days);
  } catch (error) {
    console.error('Failed to fetch visit days', error);
    return [];
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

// Inventory moved from a per-user `inventory` row to a business `products` row
// plus a per-branch `branch_inventory` row. Import has to write through the same
// RPCs as the UI, otherwise imported stock lands in the legacy table where the
// sales screen can no longer see it.
const importInventoryRow = async (row) => {
  const branchId = getInventoryBranchId();
  const name = String(row.name || '').trim();
  const rows = await dbService.fetchBranchInventory(branchId);
  const match = rows.find((item) => item.name.trim().toLowerCase() === name.toLowerCase());
  const stock = Number(row.stock) || 0;
  const price = row.price ?? '';
  const cost = row.costPrice ?? '';
  const minStock = Number(row.minStock) || 5;

  if (match) {
    await dbService.setBranchStock({
      productId: match.productId,
      branchId,
      stock,
      price,
      cost,
      minStock,
    });
    return { ...match, stock, price, costPrice: cost, minStock };
  }

  const productId = await dbService.createProduct({
    name,
    category: row.category,
    unit: row.unit,
    price,
    cost,
    minStock,
    branchId,
    stock,
  });
  const created = (await dbService.fetchBranchInventory(branchId))
    .find((item) => String(item.productId) === String(productId));
  return created || { id: String(productId), productId: String(productId), ...row, stock };
};

const deleteInventoryRowById = async (id) => {
  const rows = await dbService.fetchBranchInventory(getInventoryBranchId());
  const row = rows.find((item) => String(item.id) === String(id));
  if (!row?.productId) return;
  await dbService.deleteProduct(row.productId);
};

export const fetchExistingRows = async (entityKey) => {
  const entity = getEntity(entityKey);
  if (!entity) throw new Error(`Unknown import target "${entityKey}".`);
  if (entityKey === 'inventory') return await fetchInventory();
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
    if (entityKey === 'inventory') {
      for (const row of toInsert) {
        try {
          outcome.inserted.push(await importInventoryRow(row));
        } catch (error) {
          outcome.errors.push(error.message || 'Some items could not be saved.');
        }
      }
    } else {
      try {
        outcome.inserted = await dbService.createUserRecords(uid, entity.table, toInsert);
      } catch (error) {
        outcome.inserted = error.inserted || [];
        outcome.errors.push(error.message || 'Some rows could not be saved.');
        outcome.failedFrom = error.failedFrom;
      }
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
      const applied = entityKey === 'inventory'
        ? await updateInventoryItem(operation.id, stripMeta(next))
        : await dbService.updateUserRecord(uid, entity.table, operation.id, stripMeta(next));
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
      if (entityKey === 'inventory') await deleteInventoryRowById(id);
      else await dbService.deleteUserRecord(uid, entity.table, id);
    } catch (error) {
      problems.push(error.message || `Could not remove row ${id}.`);
    }
  }

  for (const row of [...previous].reverse()) {
    try {
      if (entityKey === 'inventory') await updateInventoryItem(row.id, stripMeta(row));
      else await dbService.updateUserRecord(uid, entity.table, row.id, stripMeta(row));
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
      if (entityKey === 'inventory') await deleteInventoryRowById(id);
      else await dbService.deleteUserRecord(uid, entity.table, id);
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
