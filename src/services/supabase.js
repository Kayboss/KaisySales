/**
 * KaisySales Supabase Client
 *
 * Provides authService and dbService matching the app's expected interface.
 * Falls back to localStorage mock when Supabase is unreachable.
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

// ----------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-'));

let supabase = null;
if (isConfigured) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ----------------------------------------------------------------
// Auth helpers
// ----------------------------------------------------------------

let authListeners = [];

function notifyListeners(user) {
  authListeners.forEach((fn) => { try { fn(user); } catch {} });
}

function mapUser(sbUser) {
  if (!sbUser) return null;
  return {
    uid: sbUser.id,
    email: sbUser.email || '',
    ...sbUser.user_metadata,
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
  const collections = ['sales', 'invoices', 'expenses', 'inventory', 'stores', 'categories'];
  let migrated = false;

  for (const col of collections) {
    // Search for any mock key pattern for this collection
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('kaisysales_mock_') && key.endsWith(`_${col}`)) {
        const records = JSON.parse(localStorage.getItem(key) || '[]');
        if (records.length > 0) {
          for (const record of records) {
            const { id, createdAt, updatedAt, ...rest } = record;
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
  async signUp(email, password) {
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) migrateLocalData(data.user.id);
      return mapUser(data.user);
    }
    // Mock
    await new Promise(r => setTimeout(r, 300));
    const user = { id: mockUid(), email };
    notifyListeners(mapUser(user));
    return mapUser(user);
  },

  async signIn(email, password) {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) migrateLocalData(data.user.id);
      return mapUser(data.user);
    }
    // Mock
    await new Promise(r => setTimeout(r, 300));
    const user = { id: mockUid(), email };
    notifyListeners(mapUser(user));
    return mapUser(user);
  },

  async signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    notifyListeners(null);
  },

  onAuthStateChanged(callback) {
    authListeners.push(callback);
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        callback(session?.user ? mapUser(session.user) : null);
      });
      return () => data.subscription.unsubscribe();
    }
    // Mock — emit null immediately so isInitialized becomes true
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
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
      return null;
    }
    alert('Google sign-in is not configured. Please sign up with email and password instead.');
    return null;
  },

  async resetPassword(email) {
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    }
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

// ----------------------------------------------------------------
// DATABASE SERVICE
// ----------------------------------------------------------------

export const dbService = {
  async getUserProfile(uid) {
    if (supabase) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data ? toCamelCase(data) : null;
    }
    const raw = localStorage.getItem(`kaisysales_mock_profile_${uid}`);
    return raw ? JSON.parse(raw) : null;
  },

  async saveUserProfile(uid, profileData) {
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
  // ADMIN METHODS (RLS-enforced: only admin role can read)
  // ---------------------------------------------------

  async fetchAllProfiles() {
    if (supabase) {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => toCamelCase(r));
    }
    return JSON.parse(localStorage.getItem('kaisysales_mock_all_profiles') || '[]');
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

  async fetchUsersWithStats() {
    if (!supabase) return [];
    const profiles = await this.fetchAllProfiles();
    const results = [];
    for (const profile of profiles) {
      const [sales, invoices, expenses, inventory] = await Promise.all([
        supabase.from('sales').select('id,amount', { count: 'exact', head: false }).eq('user_id', profile.id),
        supabase.from('invoices').select('id,total', { count: 'exact', head: false }).eq('user_id', profile.id),
        supabase.from('expenses').select('id,amount', { count: 'exact', head: false }).eq('user_id', profile.id),
        supabase.from('inventory').select('id', { count: 'exact', head: false }).eq('user_id', profile.id),
      ]);
      const parseAmt = (v) => {
        if (typeof v === 'number') return v;
        if (typeof v !== 'string') return 0;
        return parseFloat(v.replace(/[^\d.]/g, '')) || 0;
      };
      results.push({
        ...profile,
        salesCount: sales.data?.length || 0,
        salesRevenue: (sales.data || []).reduce((s, r) => s + parseAmt(r.amount), 0),
        invoiceCount: invoices.data?.length || 0,
        invoiceTotal: (invoices.data || []).reduce((s, r) => s + parseAmt(r.total), 0),
        expenseCount: expenses.data?.length || 0,
        expenseTotal: (expenses.data || []).reduce((s, r) => s + parseAmt(r.amount), 0),
        inventoryCount: inventory.data?.length || 0,
      });
    }
    return results;
  },

  async fetchRecentActivity(limit = 20) {
    if (!supabase) return [];
    const collections = ['sales', 'invoices', 'expenses'];
    const results = [];
    for (const col of collections) {
      const { data, error } = await supabase
        .from(col)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) continue;
      for (const r of data || []) {
        results.push({
          type: col,
          id: String(r.id),
          userId: r.user_id,
          label: col === 'sales' ? r.item : col === 'invoices' ? `Invoice #${r.id}` : r.title,
          amount: r.amount || r.total,
          date: r.created_at || r.date,
          userEmail: null,
        });
      }
    }
    results.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return results.slice(0, limit);
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
      let query = supabase.from('support_notes').select('*').order('created_at', { ascending: false });
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(r => toCamelCase(r));
    }
    return [];
  },

  async fetchUserRecords(uid, collection) {
    if (supabase) {
      const { data, error } = await supabase
        .from(collection)
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(r => ({ ...toCamelCase(r), id: String(r.id) }));
    }
    return mockGet(collection);
  },

  async createUserRecord(uid, collection, recordData) {
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

  async updateUserRecord(uid, collection, recordId, recordData) {
    if (supabase) {
      const { data, error } = await supabase
        .from(collection)
        .update(toSnakeCase(recordData))
        .eq('id', recordId)
        .eq('user_id', uid)
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
    if (supabase) {
      const { error } = await supabase
        .from(collection)
        .delete()
        .eq('id', parseInt(recordId) || recordId)
        .eq('user_id', uid);
      if (error) throw error;
      return true;
    }
    const records = mockGet(collection);
    mockSet(collection, records.filter(r => String(r.id) !== String(recordId)));
    return true;
  },
};

export { supabase };
