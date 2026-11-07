/**
 * KaisySales Supabase Client
 *
 * Provides authService and dbService matching the app's expected interface.
 * Falls back to a localStorage mock ONLY in a dev build, so the UI can be built
 * without credentials. A production build with no credentials refuses to start
 * instead — see backendConfig.js.
 *
 * Setup:
 *   1. Create a Supabase project at https://supabase.com
 *   2. Copy your project URL and anon key into .env:
 *        VITE_SUPABASE_URL=https://xxx.supabase.co
 *        VITE_SUPABASE_ANON_KEY=eyJxxx
 *   3. Run the SQL from supabase-schema.sql in Supabase SQL Editor
 *   4. Enable Google OAuth in Supabase Auth → Providers
 */

import { createClient } from '@supabase/supabase-js';
import { resolveBackend, createAssertBackendAvailable, CONFIG_ERROR_MESSAGE } from './backendConfig';

// ----------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The localStorage fallback keeps a business's real financial records in one
// browser profile, unencrypted and unsynced. It exists so the UI can be built
// without credentials, so it is only ever enabled in a dev build. In a
// production build a missing Supabase config throws instead of pretending the
// data was saved — a loud failure is recoverable, silent data loss is not.
// The rules live in backendConfig.js so they can be unit tested.
const { isConfigured, isMockFallbackEnabled } = resolveBackend({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  isDev: import.meta.env.DEV,
});

let supabase = null;
if (isConfigured) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Refuses to serve mock data in a production build, so a misconfigured deploy
 * cannot silently divert a user's records into localStorage.
 */
const assertBackendAvailable = createAssertBackendAvailable({ isConfigured, isMockFallbackEnabled });

// Lets the UI fail loudly (and early) on a production build with no backend.
export const isSupabaseConfigured = isConfigured;

// ----------------------------------------------------------------
// Auth helpers
// ----------------------------------------------------------------

let authListeners = [];

function notifyListeners(user) {
  authListeners.forEach((fn) => { try { fn(user); } catch (e) { if (import.meta.env.DEV) console.error('Auth listener error:', e); } });
}

function mapUser(sbUser) {
  if (!sbUser) return null;
  return {
    uid: sbUser.id,
    email: sbUser.email || '',
    ...sbUser.user_metadata,
    // The staff-login function stores this in metadata rather than in a new
    // `profiles` column: it is set when the owner creates the login and cleared
    // by the same `updateUser` call that sets the new password, so no extra
    // write (and no RLS bypass) is involved.
    mustChangePassword: sbUser.user_metadata?.must_change_password === true,
  };
}

// ----------------------------------------------------------------
// localStorage mock fallback (for dev without Supabase)
// ----------------------------------------------------------------

function mockUid() {
  let uid = localStorage.getItem('kaisysales_mock_uid');
  if (!uid) {
    uid = 'mock-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('kaisysales_mock_uid', uid);
  }
  return uid;
}

function mockGet(collection) {
  const uid = mockUid();
  return JSON.parse(localStorage.getItem(`kaisysales_mock_${uid}_${collection}`) || '[]');
}

function mockSet(collection, data) {
  const uid = mockUid();
  localStorage.setItem(`kaisysales_mock_${uid}_${collection}`, JSON.stringify(data));
}

/**
 * Migrates all localStorage mock data to Supabase for the given user.
 * Called automatically after sign-in/sign-up when Supabase is active.
 */
async function migrateLocalData(newUid) {
  const collections = ['sales', 'invoices', 'expenses', 'inventory', 'stores', 'categories', 'customers', 'service_income', 'recurring_income', 'services'];
  let migrated = false;

  for (const col of collections) {
    // Search for any mock key pattern for this collection
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('kaisysales_mock_') && key.endsWith(`_${col}`)) {
        const records = JSON.parse(localStorage.getItem(key) || '[]');
        if (records.length > 0) {
          for (const record of records) {
            const { ...rest } = record;
            await supabase.from(col).insert({ user_id: newUid, ...rest }).select().single();
          }
          localStorage.removeItem(key);
          migrated = true;
        }
      }
    }
  }

  // Migrate profile
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('kaisysales_mock_profile_')) {
      const profile = JSON.parse(localStorage.getItem(key) || '{}');
      if (Object.keys(profile).length > 0) {
        await supabase.from('profiles').upsert({ id: newUid, ...profile, updated_at: new Date().toISOString() });
        localStorage.removeItem(key);
        migrated = true;
      }
    }
  }

  if (migrated) {
    if (import.meta.env.DEV) console.log('Local data migrated to Supabase successfully');
  }
}

// ----------------------------------------------------------------
// AUTH SERVICE
// ----------------------------------------------------------------

export const authService = {
  /**
   * Creates an account and reports which of three things actually happened.
   *
   * Returning the bare user was the bug behind "I clicked Create and nothing
   * happened": GoTrue answers a repeat signup for an address that already has
   * an account with `{ user: null, error: null }`, so the caller's `if (result)`
   * was false and the screen neither succeeded nor failed. The caller now gets
   * an explicit status, and `describeSignUp` turns it into words.
   *
   * @returns {Promise<{ status: string, user: object|null }>}
   */
  async signUp(email, password) {
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Without this the confirmation link lands on Auth's `site_url` root,
          // which this deployment 308-redirects to the static landing page —
          // a page with no supabase-js on it, so the token in the URL fragment
          // is never consumed and the visitor stays logged out. `/login` mounts
          // the app, which picks the session out of the URL.
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;

      // An existing address comes back as `user: null` (older GoTrue) or as a
      // user whose `identities` array is empty (current GoTrue). Both mean
      // "nothing was created", and both used to read as success.
      const identities = data.user?.identities;
      const isObfuscated =
        !data.user || (Array.isArray(identities) && identities.length === 0);
      if (isObfuscated) {
        return { status: 'already_registered', user: null };
      }

      // A session only exists when email confirmation is switched off. With it
      // on there is no JWT here, so every write from this point would be refused
      // by RLS and rolled back. The free plan is assigned from explicit
      // onboarding instead (never on every auth change: an invited cashier must
      // not be handed a business of their own).
      if (data.session) {
        migrateLocalData(data.user.id);
      }

      return {
        status: data.session ? 'signed_in' : 'needs_confirmation',
        user: mapUser(data.user),
      };
    }
    // Mock
    assertBackendAvailable();
    await new Promise(r => setTimeout(r, 300));
    const user = { id: mockUid(), email };
    notifyListeners(mapUser(user));
    return { status: 'signed_in', user: mapUser(user) };
  },

  async signIn(email, password) {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        const { data: profile } = await supabase.from('profiles').select('status, deleted_at').eq('id', data.user.id).single();
        if (profile?.status === 'suspended') {
          await supabase.auth.signOut();
          throw new Error('Your account has been suspended. Please contact support.');
        }
        if (profile?.deleted_at) {
          await supabase.auth.signOut();
          throw new Error('This account has been deleted. Please contact support.');
        }
        migrateLocalData(data.user.id);
        supabase.from('profiles').update({ last_sign_in_at: new Date().toISOString() }).eq('id', data.user.id).then().catch((err) => {
          if (import.meta.env.DEV) console.error('Failed to update last_sign_in_at:', err);
        });
      }
      return mapUser(data.user);
    }
    // Mock
    assertBackendAvailable();
    await new Promise(r => setTimeout(r, 300));
    const user = { id: mockUid(), email };
    notifyListeners(mapUser(user));
    return mapUser(user);
  },

  async signOut() {
    assertBackendAvailable();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    notifyListeners(null);
  },

  onAuthStateChanged(callback) {
    authListeners.push(callback);
    if (supabase) {
      // Get initial session first (recommended pattern for v2)
      supabase.auth.getSession().then(({ data: { session } }) => {
        callback(session?.user ? mapUser(session.user) : null);
      });
      // Listen for subsequent changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        callback(session?.user ? mapUser(session.user) : null);
      });
      return () => subscription.unsubscribe();
    }
    // Mock — emit null immediately so isInitialized becomes true.
    // Deliberately does not throw: this runs at import time (authStore registers
    // the listener when the module is evaluated), and a throw here would blank
    // the app before it can render the configuration error screen.
    setTimeout(() => callback(null), 0);
    return () => { authListeners = authListeners.filter(fn => fn !== callback); };
  },

  async getCurrentUser() {
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      return data?.user ? mapUser(data.user) : null;
    }
    return null;
  },

  async signInWithGoogle() {
    if (supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/login' }
      });
      if (error) throw error;
      return null;
    }
    alert('Google sign-in is not configured. Please sign up with email and password instead.');
    return null;
  },

  async resetPassword(email) {
    if (supabase) {
      // Same reason as signUp: the reset link's default target is the static
      // landing page, which cannot consume the recovery token.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
    }
  },

  /**
   * Sets a new password for the signed-in login and clears the
   * `must_change_password` flag in the same call, so the CheckAuth gate stops
   * asking without a second write. A staff login created by an owner has a
   * temporary password they were given in person; this is where they replace it.
   */
  async updatePassword(password) {
    if (!supabase) throw new Error('Setting a password requires a configured backend.');
    const { data, error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    if (error) throw error;
    const updated = mapUser(data?.user);
    // GoTrue also emits USER_UPDATED, which reaches the store through
    // onAuthStateChanged. This is the same notification made explicit: if that
    // event were ever missed, the person would land back on the "choose your
    // password" screen with the new password already saved and no way past it.
    if (updated) notifyListeners(updated);
    return updated;
  },
};

// ----------------------------------------------------------------
// Helpers: camelCase <-> snake_case
// ----------------------------------------------------------------

const toSnakeCase = (obj) => {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key.replace(/([A-Z])/g, '_$1').toLowerCase()] = value;
  }
  return result;
};

const toCamelCase = (obj) => {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return result;
};

// PostgREST caps one response at the project's `max_rows` (1000 on this
// project), so a select without `.limit()` truncates silently: 1,223 page
// visits were being read as 1,000 and the 501st profile would have vanished
// from the admin list. An admin read must walk every page instead.
//
// `buildQuery` must return a FRESH builder each call -- Supabase builders are
// single-use. An explicit secondary key keeps the window stable when
// `created_at` ties, or `.range()` can repeat/skip rows.
const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

const fetchAllPages = async (buildQuery) => {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
};

// `my_permissions()` returns a nested JSON object. toCamelCase is shallow, so
// the business and branch rows inside it would keep their snake_case keys and
// every consumer would have to remember which shape it was holding.
const normalizeTenant = (data) => {
  if (!data) {
    return { businessId: null, role: null, branchId: null, modules: [], business: null, branches: [] };
  }
  return {
    businessId: data.business_id || null,
    role: data.role || null,
    branchId: data.branch_id != null ? Number(data.branch_id) : null,
    modules: Array.isArray(data.modules) ? data.modules : [],
    business: data.business ? toCamelCase(data.business) : null,
    branches: Array.isArray(data.branches)
      ? data.branches.map((branch) => ({ ...toCamelCase(branch), id: Number(branch.id) }))
      : [],
  };
};

const emptyMockTenant = {
  businessId: null,
  role: null,
  branchId: null,
  modules: [],
  business: null,
  branches: [],
};

function mockTenant() {
  const raw = localStorage.getItem('kaisysales_mock_tenant');
  return raw ? JSON.parse(raw) : { ...emptyMockTenant };
}

function saveMockTenant(tenant) {
  localStorage.setItem('kaisysales_mock_tenant', JSON.stringify(tenant));
}

// ----------------------------------------------------------------
// DATABASE SERVICE
// ----------------------------------------------------------------

export const dbService = {
  async getUserProfile(uid) {
    assertBackendAvailable();
    if (supabase) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data ? toCamelCase(data) : null;
    }
    const raw = localStorage.getItem(`kaisysales_mock_profile_${uid}`);
    return raw ? JSON.parse(raw) : null;
  },

  async saveUserProfile(uid, profileData) {
    assertBackendAvailable();
    if (supabase) {
      const { data, error } = await supabase.from('profiles').upsert({
        id: uid,
        ...toSnakeCase(profileData),
        updated_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      return toCamelCase(data);
    }
    const current = JSON.parse(localStorage.getItem(`kaisysales_mock_profile_${uid}`) || '{}');
    const merged = { ...current, ...profileData, updatedAt: new Date().toISOString() };
    localStorage.setItem(`kaisysales_mock_profile_${uid}`, JSON.stringify(merged));
    return merged;
  },

  // ---------------------------------------------------
  // TENANCY (business, membership, branches, team)
  // ---------------------------------------------------

  /**
   * The single source of truth for "who am I here": membership role, assigned
   * branch, module list, the business row and its live branches. Returns empty
   * fields (not an error) when the login has no business yet, because that is
   * the state onboarding needs to see.
   */
  async myPermissions() {
    assertBackendAvailable();
    if (supabase) {
      const { data, error } = await supabase.rpc('my_permissions');
      if (error) throw error;
      return normalizeTenant(data);
    }
    return mockTenant();
  },

  /**
   * Creates the business for a login that has none, then fills the fields the
   * RPC does not take. `create_business` deliberately stays minimal (name and
   * type) so a future RPC change cannot silently widen what the client sets.
   */
  async createBusiness({ name, type, currency, category, phone, location, logoUrl }) {
    assertBackendAvailable();
    if (supabase) {
      const { data, error } = await supabase.rpc('create_business', {
        p_name: name,
        p_type: type || 'retail',
      });
      if (error) throw error;
      const patch = {};
      if (currency !== undefined) patch.currency = currency;
      if (category !== undefined) patch.category = category;
      if (phone !== undefined) patch.phone = phone;
      if (location !== undefined) patch.location = location;
      if (logoUrl !== undefined) patch.logo_url = logoUrl;
      if (Object.keys(patch).length > 0) {
        await this.updateBusiness(data, patch);
      }
      return data;
    }
    const businessId = 'mock-business-' + Math.random().toString(36).slice(2, 9);
    saveMockTenant({
      businessId,
      role: 'owner',
      branchId: 1,
      modules: ['sales', 'reporting'],
      business: {
        id: businessId,
        name: name || 'My Business',
        businessType: type || 'retail',
        currency: currency || 'GHS',
        category: category || '',
        phone: phone || '',
        location: location || '',
        logoUrl: logoUrl || '',
      },
      branches: [{ id: 1, name: 'Main', isDefault: true }],
    });
    return businessId;
  },

  async updateBusiness(businessId, fields) {
    assertBackendAvailable();
    if (supabase) {
      if (!businessId) throw new Error('No business to update');
      const snake = toSnakeCase(fields);
      delete snake.id;
      const { data, error } = await supabase
        .from('businesses')
        .update({ ...snake, updated_at: new Date().toISOString() })
        .eq('id', businessId)
        .select()
        .single();
      if (error) throw error;
      return toCamelCase(data);
    }
    const tenant = mockTenant();
    tenant.business = { ...(tenant.business || {}), ...fields };
    saveMockTenant(tenant);
    return tenant.business;
  },

  async redeemInvite(code) {
    assertBackendAvailable();
    if (supabase) {
      const { data, error } = await supabase.rpc('redeem_invite', { p_code: String(code || '').trim().toUpperCase() });
      if (error) throw error;
      return data;
    }
    throw new Error('Joining a business requires a configured backend.');
  },

  async fetchBranches() {
    assertBackendAvailable();
    if (supabase) {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .is('archived_at', null)
        .order('is_default', { ascending: false })
        .order('id');
      if (error) throw error;
      return (data || []).map((row) => ({ ...toCamelCase(row), id: Number(row.id) }));
    }
    return mockTenant().branches || [];
  },

  async createBranch({ businessId, name, location, phone }) {
    assertBackendAvailable();
    if (supabase) {
      if (!businessId) throw new Error('No business to add a branch to');
      const { data, error } = await supabase
        .from('branches')
        .insert({
          business_id: businessId,
          name,
          location: location || '',
          phone: phone || '',
        })
        .select()
        .single();
      if (error) throw error;
      return { ...toCamelCase(data), id: Number(data.id) };
    }
    const tenant = mockTenant();
    const branch = { id: Date.now(), name, location: location || '', phone: phone || '', isDefault: false };
    tenant.branches = [...(tenant.branches || []), branch];
    saveMockTenant(tenant);
    return branch;
  },

  async updateBranch(branchId, fields) {
    assertBackendAvailable();
    if (supabase) {
      const { data, error } = await supabase
        .from('branches')
        .update(toSnakeCase(fields))
        .eq('id', branchId)
        .select()
        .single();
      if (error) throw error;
      return { ...toCamelCase(data), id: Number(data.id) };
    }
    const tenant = mockTenant();
    tenant.branches = (tenant.branches || []).map((branch) =>
      String(branch.id) === String(branchId) ? { ...branch, ...fields } : branch
    );
    saveMockTenant(tenant);
    return tenant.branches.find((branch) => String(branch.id) === String(branchId));
  },

  // Branches are archived, never deleted: sales and stock rows point at them.
  async archiveBranch(branchId) {
    assertBackendAvailable();
    if (supabase) {
      const { error } = await supabase
        .from('branches')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', branchId);
      if (error) throw error;
      return true;
    }
    const tenant = mockTenant();
    tenant.branches = (tenant.branches || []).filter((branch) => String(branch.id) !== String(branchId));
    saveMockTenant(tenant);
    return true;
  },

  async listMembers() {
    assertBackendAvailable();
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('list_business_members');
    if (error) throw error;
    return (data || []).map((row) => toCamelCase(row));
  },

  async memberDirectory() {
    assertBackendAvailable();
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('member_directory');
    if (error) throw error;
    return (data || []).map((row) => toCamelCase(row));
  },

  async createInvite(branchId) {
    assertBackendAvailable();
    if (!supabase) throw new Error('Invites require a configured backend.');
    const { data, error } = await supabase.rpc('create_invite', { p_branch_id: branchId ?? null });
    if (error) throw error;
    return data ? toCamelCase(data) : data;
  },

  async listInvites() {
    assertBackendAvailable();
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('list_invites');
    if (error) throw error;
    return (data || []).map((row) => toCamelCase(row));
  },

  async revokeInvite(inviteId) {
    assertBackendAvailable();
    if (!supabase) return false;
    const { data, error } = await supabase.rpc('revoke_invite', { p_invite_id: inviteId });
    if (error) throw error;
    return data === true;
  },

  async setMemberModules(userId, modules) {
    assertBackendAvailable();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('set_member_modules', {
      p_user_id: userId,
      p_modules: modules,
    });
    if (error) throw error;
    return data;
  },

  async setMemberBranch(userId, branchId) {
    assertBackendAvailable();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('set_member_branch', {
      p_user_id: userId,
      p_branch_id: branchId,
    });
    if (error) throw error;
    return data;
  },

  async removeMember(userId) {
    assertBackendAvailable();
    if (!supabase) return false;
    const { data, error } = await supabase.rpc('remove_member', { p_user_id: userId });
    if (error) throw error;
    return data === true;
  },

  async reactivateMember(userId, branchId = null) {
    assertBackendAvailable();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('reactivate_member', {
      p_user_id: userId,
      p_branch_id: branchId ?? null,
    });
    if (error) throw error;
    return data;
  },

  async transferOwnership(userId) {
    assertBackendAvailable();
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('transfer_ownership', { p_user_id: userId });
    if (error) throw error;
    return data;
  },

  /**
   * Creates a staff login for the signed-in owner (edge function `create-staff`,
   * because only a service-role key can create an auth user). The owner hands
   * over the temporary password, and the new login must change it on first
   * sign-in.
   */
  async createStaffLogin({ email, password, fullName, branchId, modules }) {
    assertBackendAvailable();
    if (!supabase) throw new Error('Creating a login requires a configured backend.');
    const { data, error } = await supabase.functions.invoke('create-staff', {
      body: { email, password, fullName, branchId, modules },
    });
    if (error) {
      // FunctionsHttpError hides the function's own body, and that body is the
      // only useful message ("An account already exists for that email
      // address."). Fall back to the transport message if it cannot be read.
      let message = error.message;
      try {
        const body = await error.context?.json?.();
        if (body?.error) message = body.error;
      } catch {
        // Keep the transport message.
      }
      throw new Error(message || 'Could not create that login.');
    }
    return data;
  },

  // ---------------------------------------------------
  // TENANT-SCOPED RECORDS
  //
  // RLS already limits every table to the caller's business (and branch, for
  // branch-scoped tables). These helpers therefore must NOT filter by user_id:
  // a cashier has to see the sales they recorded and the stock their owner
  // stocked, and an owner has to see the whole business.
  // ---------------------------------------------------

  async fetchTenantRecords(collection, { branchId, userId } = {}) {
    assertBackendAvailable();
    if (supabase) {
      let query = supabase
        .from(collection)
        .select('*')
        .order('created_at', { ascending: false });
      if (branchId != null) query = query.eq('branch_id', branchId);
      if (userId != null) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((r) => ({ ...toCamelCase(r), id: String(r.id) }));
    }
    return mockGet(collection);
  },

  async createTenantRecord(collection, recordData) {
    assertBackendAvailable();
    if (supabase) {
      const row = toSnakeCase(recordData);
      delete row.id;
      delete row.user_id;
      const { data, error } = await supabase.from(collection).insert(row).select().single();
      if (error) throw error;
      return { ...toCamelCase(data), id: String(data.id) };
    }
    const records = mockGet(collection);
    const created = { ...recordData, id: 'rec-' + Math.random().toString(36).slice(2, 9) };
    mockSet(collection, [...records, created]);
    return created;
  },

  async updateTenantRecord(collection, recordId, recordData) {
    assertBackendAvailable();
    if (supabase) {
      const { data, error } = await supabase
        .from(collection)
        .update(toSnakeCase(recordData))
        .eq('id', parseInt(recordId) || recordId)
        .select()
        .single();
      if (error) throw error;
      return { ...toCamelCase(data), id: String(data.id) };
    }
    const records = mockGet(collection);
    const idx = records.findIndex((r) => String(r.id) === String(recordId));
    if (idx === -1) throw new Error('Record not found');
    records[idx] = { ...records[idx], ...recordData };
    mockSet(collection, records);
    return records[idx];
  },

  async deleteTenantRecord(collection, recordId) {
    assertBackendAvailable();
    if (supabase) {
      const { error } = await supabase
        .from(collection)
        .delete()
        .eq('id', parseInt(recordId) || recordId);
      if (error) throw error;
      return true;
    }
    const records = mockGet(collection);
    mockSet(collection, records.filter((r) => String(r.id) !== String(recordId)));
    return true;
  },

  // ---------------------------------------------------
  // INVENTORY (products + per-branch stock)
  // ---------------------------------------------------

  async fetchProducts() {
    assertBackendAvailable();
    if (!supabase) return [];
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) throw error;
    return (data || []).map((r) => ({ ...toCamelCase(r), id: String(r.id) }));
  },

  /**
   * Stock rows joined to their product identity. `branchId` narrows the list;
   * omitting it returns every branch the caller can see (owner reports).
   */
  async fetchBranchInventory(branchId = null) {
    assertBackendAvailable();
    if (!supabase) return [];
    let query = supabase
      .from('branch_inventory')
      .select('*, products(name, category, unit)')
      .order('id');
    if (branchId != null) query = query.eq('branch_id', branchId);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => {
      const { products, ...rest } = row;
      return {
        ...toCamelCase(rest),
        id: String(row.id),
        productId: String(row.product_id),
        branchId: Number(row.branch_id),
        name: products?.name || '',
        category: products?.category || '',
        unit: products?.unit || 'pcs',
      };
    });
  },

  async createProduct({ name, category, unit, price, cost, minStock, branchId, stock }) {
    assertBackendAvailable();
    if (!supabase) throw new Error('Inventory requires a configured backend.');
    const { data, error } = await supabase.rpc('create_product', {
      p_name: name,
      p_category: category || '',
      p_unit: unit || 'pcs',
      p_price: price || '',
      p_cost: cost || '',
      p_min_stock: minStock ?? 5,
      p_branch_id: branchId ?? null,
      p_stock: stock ?? 0,
    });
    if (error) throw error;
    return data;
  },

  async updateProduct(productId, fields) {
    assertBackendAvailable();
    if (!supabase) throw new Error('Inventory requires a configured backend.');
    const { data, error } = await supabase
      .from('products')
      .update(toSnakeCase(fields))
      .eq('id', productId)
      .select()
      .single();
    if (error) throw error;
    return { ...toCamelCase(data), id: String(data.id) };
  },

  async deleteProduct(productId) {
    assertBackendAvailable();
    if (!supabase) throw new Error('Inventory requires a configured backend.');
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
    return true;
  },

  async setBranchStock({ productId, branchId, stock, price, cost, minStock }) {
    assertBackendAvailable();
    if (!supabase) throw new Error('Inventory requires a configured backend.');
    const { data, error } = await supabase.rpc('set_branch_stock', {
      p_product_id: productId,
      p_branch_id: branchId,
      p_stock: stock,
      p_price: price ?? null,
      p_cost: cost ?? null,
      p_min_stock: minStock ?? null,
    });
    if (error) throw error;
    return data;
  },

  async updateBranchStock(stockRowId, fields) {
    assertBackendAvailable();
    if (!supabase) throw new Error('Inventory requires a configured backend.');
    const { data, error } = await supabase
      .from('branch_inventory')
      .update(toSnakeCase(fields))
      .eq('id', stockRowId)
      .select()
      .single();
    if (error) throw error;
    return { ...toCamelCase(data), id: String(data.id) };
  },

  // ---------------------------------------------------
  // SALES / INVOICES (RPCs that move stock atomically)
  // ---------------------------------------------------

  async recordSale({ productId, quantity, paymentMethod, date, unitPrice, cost, branchId, discount }) {
    assertBackendAvailable();
    if (!supabase) throw new Error('Recording a sale requires a configured backend.');
    const { data, error } = await supabase.rpc('record_sale', {
      p_product_id: productId,
      p_quantity: quantity,
      p_payment_method: paymentMethod || 'Cash',
      p_date: date || null,
      p_unit_price: unitPrice != null ? String(unitPrice) : null,
      p_cost: cost != null ? Number(cost) : null,
      p_branch_id: branchId ?? null,
      p_discount: discount ?? 0,
    });
    if (error) throw error;
    return data;
  },

  async recordInvoiceSale(invoiceId) {
    assertBackendAvailable();
    if (!supabase) throw new Error('Converting an invoice requires a configured backend.');
    const { data, error } = await supabase.rpc('record_invoice_sale', { p_invoice_id: invoiceId });
    if (error) throw error;
    return data;
  },

  async voidSale(saleId, reason = '') {
    assertBackendAvailable();
    if (!supabase) throw new Error('Voiding a sale requires a configured backend.');
    const { data, error } = await supabase.rpc('void_sale', { p_sale_id: saleId, p_reason: reason });
    if (error) throw error;
    return data;
  },

  // ---------------------------------------------------
  // ADMIN METHODS (RLS-enforced: only admin role can read)
  // ---------------------------------------------------

  async fetchAllProfiles() {
    assertBackendAvailable();
    if (supabase) {
      const rows = await fetchAllPages(() => supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .order('id'));
      return rows.map(r => toCamelCase(r));
    }
    return JSON.parse(localStorage.getItem('kaisysales_mock_all_profiles') || '[]');
  },

  // Resolves each user's business name (via business_members → businesses)
  // and email (from profiles). Admin screens used to read profiles.business_name
  // before that column was dropped in M4.
  async fetchUserBusinessEmailMap(userIds) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return {};
    const [membersResult, businessesResult, profilesResult] = await Promise.all([
      supabase.from('business_members').select('user_id, business_id').in('user_id', ids),
      supabase.from('businesses').select('id, name'),
      supabase.from('profiles').select('id, email'),
    ]);
    const businessMap = Object.fromEntries((businessesResult.data || []).map(b => [b.id, b.name]));
    const userBusinessMap = {};
    (membersResult.data || []).forEach(m => {
      if (m.business_id && businessMap[m.business_id]) {
        userBusinessMap[m.user_id] = businessMap[m.business_id];
      }
    });
    const emailMap = Object.fromEntries((profilesResult.data || []).map(p => [p.id, p.email]));
    return Object.fromEntries(ids.map(id => [id, { email: emailMap[id] || null, businessName: userBusinessMap[id] || null }]));
  },

  // Just the accounts that have never signed in. The admin inbox only needs
  // these for the "never signed in" list, so it asks the database for exactly
  // them instead of pulling every profile and filtering in the browser.
  async fetchNeverSignedInUsers(limit = 200) {
    assertBackendAvailable();
    if (supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, owner_name, avatar_color, created_at, last_sign_in_at')
        .is('last_sign_in_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map(r => toCamelCase(r));
    }
    return [];
  },

  /**
   * Logins that are staff of somebody else's business.
   *
   * The admin screens count accounts per profile, and a cashier has a profile of
   * their own, so without this they read as a new business in the Growth funnel
   * and as a separate "user with errors" in the Inbox. Read-only; the policy is
   * `is_admin()` (migration `20261103150000`).
   */
  async fetchStaffUserIds() {
    assertBackendAvailable();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('business_members')
      .select('user_id, role, status')
      .eq('role', 'staff');
    if (error) throw error;
    return (data || []).filter(row => row.status !== 'removed').map(row => row.user_id);
  },

  async fetchAllRecords(collection) {
    if (supabase) {
      const { data, error } = await supabase
        .from(collection)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map(r => ({ ...toCamelCase(r), id: String(r.id) }));
    }
    return [];
  },

  // Per-account counts and totals. The four tenant-scoped tables (customers,
  // service income, recurring income, inventory) can no longer be read across
  // businesses by the admin -- migrations 20261105180000/190000 dropped the
  // admin read-all policies so those rows stop leaking into the admin's own
  // app screens. `admin_user_stats()` is the aggregate that replaces them: one
  // gated row per profile, computed in SQL, so it is also immune to the
  // 1000-row response cap.
  async fetchUsersWithStats() {
    if (!supabase) return [];
    const [profiles, { data: statsRows, error }] = await Promise.all([
      this.fetchAllProfiles(),
      supabase.rpc('admin_user_stats'),
    ]);
    if (error) throw error;

    const stats = new Map((statsRows || []).map(row => [row.user_id, row]));
    const num = (value) => Number(value) || 0;

    return profiles.map(p => {
      const s = stats.get(p.id);
      return {
        ...p,
        salesCount: num(s?.sales_count),
        salesRevenue: num(s?.sales_total),
        invoiceCount: num(s?.invoice_count),
        invoiceTotal: num(s?.invoice_total),
        expenseCount: num(s?.expense_count),
        expenseTotal: num(s?.expense_total),
        inventoryCount: num(s?.inventory_count),
        customerCount: num(s?.customer_count),
        serviceIncomeCount: num(s?.service_income_count),
        serviceIncomeTotal: num(s?.service_income_total),
        recurringIncomeCount: num(s?.recurring_income_count),
        recurringIncomeTotal: num(s?.recurring_income_total),
      };
    });
  },

  // Recent records across every table the Activity feed and the user drawer
  // show. Served by `admin_recent_activity()` because customers, service
  // income and recurring income are no longer readable across businesses from
  // the client -- and because a six-table loop can only ever be as fresh as
  // its slowest select.
  async fetchRecentActivity(limit = 20, userId = null) {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('admin_recent_activity', {
      p_limit: limit,
      p_user_id: userId,
    });
    if (error) throw error;

    const results = (data || []).map(r => ({
      type: r.record_type,
      id: String(r.record_id),
      userId: r.user_id,
      label: r.label,
      amount: r.amount,
      date: r.happened_at,
      userEmail: null,
      businessName: null,
    }));

    const userIds = [...new Set(results.map(r => r.userId).filter(Boolean))];
    if (userIds.length > 0) {
      const profileMap = await this.fetchUserBusinessEmailMap(userIds);
      results.forEach(r => {
        if (profileMap[r.userId]) {
          r.businessName = profileMap[r.userId].businessName;
          r.userEmail = profileMap[r.userId].email;
        }
      });
    }
    return results;
  },

  async createSupportNote(note) {
    if (supabase) {
      const { data, error } = await supabase
        .from('support_notes')
        .insert(toSnakeCase(note))
        .select()
        .single();
      if (error) throw error;
      return toCamelCase(data);
    }
    return { ...note, id: 'note-' + Math.random().toString(36).substr(2, 9) };
  },

  async fetchSupportNotes(userId) {
    if (supabase) {
      if (!userId) throw new Error('userId required');
      const { data, error } = await supabase
        .from('support_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Mark any unread notes as read now that the admin is viewing them.
      try {
        await supabase.rpc('mark_support_notes_read', { p_user_id: userId });
      } catch {
        // best-effort; marking read should never break reading the thread
      }
      return (data || []).map(r => toCamelCase(r));
    }
    return [];
  },

  async fetchOpenSupportRequests(limit = 100) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('support_notes')
      .select('*')
      .eq('is_from_admin', false)
      .eq('status', 'open')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    const notes = (data || []).map(r => toCamelCase(r));
    const userIds = [...new Set(notes.map(n => n.userId).filter(Boolean))];
    if (userIds.length === 0) return notes;
    const profileMap = await this.fetchUserBusinessEmailMap(userIds);
    return notes.map(n => ({
      ...n,
      userEmail: profileMap[n.userId]?.email || null,
      userBusinessName: profileMap[n.userId]?.businessName || null,
    }));
  },

  async updateSupportNoteStatus(noteId, status) {
    if (supabase) {
      const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
      const { data, error } = await supabase
        .from('support_notes')
        .update({ status, resolved_at: resolvedAt })
        .eq('id', noteId)
        .select()
        .single();
      if (error) throw error;
      return toCamelCase(data);
    }
    return { id: noteId, status };
  },

  async fetchUserRecords(uid, collection) {
    assertBackendAvailable();
    if (supabase) {
      // RLS scopes this to the caller's business (and branch, where the table is
      // branch-scoped). Filtering by user_id as well would hide an owner's stock
      // and a cashier's shared sales from each other.
      const { data, error } = await supabase
        .from(collection)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(r => ({ ...toCamelCase(r), id: String(r.id) }));
    }
    return mockGet(collection);
  },

  async createUserRecord(uid, collection, recordData) {
    assertBackendAvailable();
    if (supabase) {
      const { data, error } = await supabase
        .from(collection)
        .insert({ user_id: uid, ...toSnakeCase(recordData) })
        .select()
        .single();
      if (error) throw error;
      return { ...toCamelCase(data), id: String(data.id) };
    }
    const records = mockGet(collection);
    const newRecord = { ...recordData, id: 'rec-' + Math.random().toString(36).substr(2, 9), user_id: uid };
    records.push(newRecord);
    mockSet(collection, records);
    return newRecord;
  },

  async createUserRecords(uid, collection, records) {
    assertBackendAvailable();
    if (!Array.isArray(records) || records.length === 0) return [];

    const rows = records.map((record) => {
      const snake = toSnakeCase(record);
      delete snake.id;
      delete snake.user_id;
      delete snake.uid;
      return snake;
    });

    if (supabase) {
      const CHUNK_SIZE = 200;
      const inserted = [];
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE).map((row) => ({ user_id: uid, ...row }));
        const { data, error } = await supabase.from(collection).insert(chunk).select();
        if (error) {
          const failure = new Error(error.message || 'Some rows could not be saved.');
          failure.inserted = inserted;
          failure.failedFrom = i;
          throw failure;
        }
        inserted.push(...(data || []).map((r) => ({ ...toCamelCase(r), id: String(r.id) })));
      }
      return inserted;
    }

    const existing = mockGet(collection);
    const created = records.map((record) => ({
      ...record,
      id: 'rec-' + Math.random().toString(36).substr(2, 9),
      user_id: uid,
    }));
    mockSet(collection, [...existing, ...created]);
    return created;
  },

  async updateUserRecord(uid, collection, recordId, recordData) {
    assertBackendAvailable();
    if (supabase) {
      const { data, error } = await supabase
        .from(collection)
        .update(toSnakeCase(recordData))
        .eq('id', recordId)
        .select()
        .single();
      if (error) throw error;
      return { ...toCamelCase(data), id: String(data.id) };
    }
    const records = mockGet(collection);
    const idx = records.findIndex(r => String(r.id) === String(recordId));
    if (idx === -1) throw new Error('Record not found');
    records[idx] = { ...records[idx], ...recordData };
    mockSet(collection, records);
    return records[idx];
  },

  async deleteUserRecord(uid, collection, recordId) {
    assertBackendAvailable();
    if (supabase) {
      const { error } = await supabase
        .from(collection)
        .delete()
        .eq('id', parseInt(recordId) || recordId);
      if (error) throw error;
      return true;
    }
    const records = mockGet(collection);
    mockSet(collection, records.filter(r => String(r.id) !== String(recordId)));
    return true;
  },

  async fetchErrorLogs(limit = 20, userId = null) {
    if (supabase) {
      let query = supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      const logs = (data || []).map(r => toCamelCase(r));
      const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))];
      if (userIds.length > 0) {
        const profileMap = await this.fetchUserBusinessEmailMap(userIds);
        return logs.map(l => ({
          ...l,
          userEmail: profileMap[l.userId]?.email || null,
          userBusinessName: profileMap[l.userId]?.businessName || null,
        }));
      }
      return logs;
    }
    return [];
  },

  async fetchUserActions(limit = 75, userId = null) {
    if (!supabase) return [];
    let query = supabase
      .from('user_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    const actions = (data || []).map(r => toCamelCase(r));
    const userIds = [...new Set(actions.map(a => a.userId).filter(Boolean))];
    if (userIds.length === 0) return actions;
    const profileMap = await this.fetchUserBusinessEmailMap(userIds);
    return actions.map(a => ({
      ...a,
      userEmail: profileMap[a.userId]?.email || null,
      userBusinessName: profileMap[a.userId]?.businessName || null,
    }));
  },

  async updateUserStatus(userId, status) {
    if (supabase) {
      const { error } = await supabase.rpc('set_user_status', { p_user_id: userId, p_status: status });
      if (error) throw error;
      return true;
    }
    return false;
  },

  async deleteUserAccount(userId) {
    if (supabase) {
      const { error } = await supabase.rpc('delete_user_account', { p_user_id: userId });
      if (error) throw error;
      return true;
    }
    return false;
  },

  /**
   * Brings a deactivated account back. The login was never removed, so this is
   * just the `profiles.deleted_at` flag that CheckAuth gates on.
   */
  async restoreUserAccount(userId) {
    if (supabase) {
      const { error } = await supabase.rpc('restore_user_account', { p_user_id: userId });
      if (error) throw error;
      return true;
    }
    return false;
  },

  /**
   * Irreversible. Deletes the login (and, for an owner, the business with it),
   * which there is no client-side way to undo. The database refuses an owner
   * who still has active staff and refuses the caller's own account.
   */
  async purgeUserAccount(userId) {
    if (supabase) {
      const { error } = await supabase.rpc('purge_user_account', { p_user_id: userId });
      if (error) throw error;
      return true;
    }
    return false;
  },

  async updateUserBusinessType(userId, businessType) {
    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({ business_type: businessType, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
      return true;
    }
    return false;
  },

  // ---------------------------------------------------
  // SUBSCRIPTION METHODS
  // ---------------------------------------------------
  async ensureFreeTrial(userId) {
    if (!supabase) return;
    try {
      const { data: existing } = await supabase.from('profiles').select('subscription_plan').eq('id', userId).maybeSingle();
      if (existing?.subscription_plan && existing.subscription_plan !== 'none') return;
      await supabase.from('profiles').update({
        subscription_plan: 'free',
        subscription_status: 'active',
        subscription_expires_at: null,
        subscription_updated_at: new Date().toISOString(),
      }).eq('id', userId);
    } catch (err) {
      console.error('Failed to assign free plan:', err);
    }
  },

  async fetchSubscriptionPlans() {
    if (supabase) {
      const { data, error } = await supabase.from('subscription_plans').select('*').order('name');
      if (error) throw error;
      return (data || []).map(r => toCamelCase(r));
    }
    return [];
  },

  async assignSubscription(userId, plan, durationDays = 30) {
    if (supabase) {
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_plan: plan,
          subscription_status: 'active',
          subscription_expires_at: expiresAt,
          subscription_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (error) throw error;
      return true;
    }
    return false;
  },

  async cancelSubscription(userId) {
    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_plan: 'none',
          subscription_status: 'none',
          subscription_expires_at: null,
          subscription_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      if (error) throw error;
      return true;
    }
    return false;
  },

  async recordPayment({ userId, plan, amount, reference, paymentMethod }) {
    if (supabase) {
      // Server-side price validation — look up the plan's actual price
      const { data: planRow, error: planError } = await supabase
        .from('subscription_plans')
        .select('price')
        .eq('name', plan)
        .single();
      if (planError || !planRow) throw new Error('Invalid subscription plan.');
      const actualPrice = parseFloat(planRow.price);
      if (actualPrice > 0 && parseFloat(amount) !== actualPrice) {
        throw new Error('Payment amount does not match plan price.');
      }
      const { data, error } = await supabase
        .from('subscription_payments')
        .insert({
          user_id: userId,
          plan,
          amount,
          reference: reference || null,
          payment_method: paymentMethod || 'manual',
          status: 'pending',
        })
        .select()
        .single();
      if (error) throw error;
      return toCamelCase(data);
    }
    return { id: 'pay-' + Math.random().toString(36).substr(2, 9), userId, plan, amount, status: 'pending' };
  },

  async confirmPayment(paymentId, adminId) {
    if (supabase) {
      const { data: adminCheck } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', adminId)
        .eq('role', 'admin')
        .single();
      if (!adminCheck) throw new Error('Unauthorized. Admin access required.');
      const { data: payment } = await supabase
        .from('subscription_payments')
        .update({ status: 'confirmed', admin_id: adminId, confirmed_at: new Date().toISOString() })
        .eq('id', paymentId)
        .select()
        .single();
      if (!payment) throw new Error('Payment not found');
      const planRow = await supabase
        .from('subscription_plans')
        .select('duration_days')
        .eq('name', payment.plan)
        .single();
      const durationDays = planRow.data?.duration_days || 30;
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('profiles')
        .update({
          subscription_plan: payment.plan,
          subscription_status: 'active',
          subscription_expires_at: expiresAt,
          subscription_updated_at: new Date().toISOString(),
        })
        .eq('id', payment.user_id);
      return toCamelCase(payment);
    }
    return null;
  },

  // Recent payments, enriched with the payer's email/business the same way the
  // support and error feeds are. Without it the Payments tab could only print
  // "User 8c3f2a11" -- the rows carry user_id, never an address.
  async fetchAllPayments(limit = 50) {
    if (supabase) {
      const { data, error } = await supabase
        .from('subscription_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;

      const payments = (data || []).map(r => toCamelCase(r));
      const userIds = [...new Set(payments.map(p => p.userId).filter(Boolean))];
      if (userIds.length === 0) return payments;

      const profileMap = await this.fetchUserBusinessEmailMap(userIds);
      return payments.map(p => ({
        ...p,
        userEmail: profileMap[p.userId]?.email || null,
        userBusinessName: profileMap[p.userId]?.businessName || null,
      }));
    }
    return [];
  },

  async fetchUserPayments(userId) {
    if (supabase) {
      const { data, error } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => toCamelCase(r));
    }
    return [];
  },

  async trackPageVisit(userId, page, deviceType, location) {
    if (!supabase) return;
    // The RLS policy is WITH CHECK (auth.uid() = user_id). A missing id makes
    // that comparison NULL, not false, so an undefined userId would fail the
    // insert rather than being ignored.
    if (!userId) return;
    try {
      const { error } = await supabase.from('page_visits').insert({
        user_id: userId,
        page,
        device_type: deviceType,
        location,
      });
      // supabase-js resolves with { error } instead of throwing, so a bare
      // try/catch never sees a failed insert.
      if (error) console.warn('trackPageVisit insert failed:', error.message);
    } catch (err) {
      console.warn('trackPageVisit insert failed:', err?.message || err);
    }
  },

  // Writes the first touch of a browser session, once. The row is write-once by
  // design (there is no UPDATE policy), so a repeat is a unique violation and
  // not an error worth showing anyone: the first touch already recorded is the
  // answer. Returns true when the touch is safely on the server or already was,
  // so the caller knows it can stop holding it in sessionStorage.
  async recordAcquisition(userId, touch) {
    if (!supabase) return false;
    if (!userId || !touch?.source) return false;
    try {
      const { error } = await supabase.from('acquisition').insert({
        user_id: userId,
        source: touch.source,
        medium: touch.medium || '',
        campaign: touch.campaign || '',
        content: touch.content || '',
        term: touch.term || '',
        referrer: touch.referrer || '',
        landing_page: touch.landingPage || '',
      });
      if (!error) return true;
      // 23505 = unique violation: this account was already attributed.
      const isDuplicate = error.code === '23505'
        || error.status === 409
        || (typeof error.message === 'string' && /23505|already exists|duplicate key/i.test(error.message));
      if (isDuplicate) return true;
      console.warn('recordAcquisition insert failed:', error.message);
      return false;
    } catch (err) {
      console.warn('recordAcquisition insert failed:', err?.message || err);
      return false;
    }
  },

  // Admin-only by RLS. One row per attributed account, so it is read in full:
  // truncating it would relabel real accounts as "Not attributed" in the
  // Growth funnel.
  async fetchAcquisition(limit = null) {
    assertBackendAvailable();
    if (!supabase) return [];
    const rows = await fetchAllPages(() => supabase
      .from('acquisition')
      .select('user_id, source, medium, campaign, content, term, referrer, landing_page, created_at')
      .order('created_at', { ascending: false })
      .order('user_id'));
    const capped = limit ? rows.slice(0, limit) : rows;
    return capped.map(r => toCamelCase(r));
  },

  // Distinct days, not distinct page views: retention is measured from these,
  // and the database groups them so the 1000-row cap cannot hide an older
  // visiting day. `createdAt` keeps the shape growth.js already reduces.
  async fetchVisitDays(days = 90) {
    assertBackendAvailable();
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('admin_visit_days', { p_days: days });
    if (error) throw error;
    return (data || []).map(r => ({ userId: r.user_id, createdAt: r.visit_day }));
  },

  async fetchVisitStats() {
    if (!supabase) return { deviceData: [], locationData: [], dailyVisits: [] };
    try {
      // Grouped in SQL: 30 days of visits already exceeded the 1000-row
      // response cap, so the client used to chart a truncated sample.
      const { data, error } = await supabase.rpc('admin_visit_stats', { p_days: 30 });
      if (error) throw error;

      const deviceCounts = {};
      const locationCounts = {};
      const dayCounts = {};
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      (data || []).forEach(v => {
        const count = Number(v.visits) || 0;
        deviceCounts[v.device_type] = (deviceCounts[v.device_type] || 0) + count;
        locationCounts[v.location] = (locationCounts[v.location] || 0) + count;
        const day = dayNames[v.day_index];
        if (day) dayCounts[day] = (dayCounts[day] || 0) + count;
      });

      const deviceData = Object.entries(deviceCounts).map(([name, value]) => ({ name, value }));
      const locationData = Object.entries(locationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value }));
      const dailyVisits = dayNames.map(day => ({ day, visits: dayCounts[day] || 0 }));

      return { deviceData, locationData, dailyVisits };
    } catch {
      return { deviceData: [], locationData: [], dailyVisits: [] };
    }
  },
};

// Standalone error logger — call from anywhere
const SENSITIVE_PATTERNS = [
  /Bearer\s+\S+/gi,
  /(api[_-]?key|secret|token|password|authorization)\s*[:=]\s*['"]?\S+['"]?/gi,
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
];
const sanitizeError = (msg) => {
  let safe = String(msg).slice(0, 1000);
  SENSITIVE_PATTERNS.forEach((re) => { safe = safe.replace(re, '[REDACTED]'); });
  return safe;
};
export const logClientError = async (error, page) => {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const errorMsg = typeof error === 'string' ? error : (error?.message || String(error));
    // A message alone rarely says where the user was stuck. Keep the stack and
    // the browser beside it so the admin Errors tab can reproduce the problem.
    // Both go through sanitizeError: a stack can carry a token in a request URL,
    // and user agent strings are capricious, so they are truncated and redacted.
    const stack = typeof error?.stack === 'string' ? error.stack : '';
    const details = {
      stack: sanitizeError(stack).slice(0, 4000) || null,
      userAgent: sanitizeError(navigator?.userAgent || '').slice(0, 300) || null,
      viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
    };
    await supabase.from('error_logs').insert({
      user_id: user?.id || null,
      error: sanitizeError(errorMsg),
      page: page || window.location.pathname,
      details,
    });
  } catch {
    // Silently fail — don't log errors about logging errors
  }
};

export { supabase, isMockFallbackEnabled, CONFIG_ERROR_MESSAGE };
