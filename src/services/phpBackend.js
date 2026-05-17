/**
 * KaisySales Universal Backend Client
 *
 * Auto-detects PHP API availability. Falls back to localStorage mock
 * when the PHP server is not reachable (e.g., local development).
 *
 * Exports identical authService & dbService interface as the old firebase.js.
 */

const API_BASE = '/KaisySales/api';

const LS_TOKEN  = 'kaisysales_php_token';
const LS_USER   = 'kaisysales_php_user';

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------

let authListeners   = [];
let apiAvailable    = null; // null = untested, true/false = known

function notifyListeners(user) {
  authListeners.forEach((fn) => { try { fn(user); } catch (e) { /* skip */ } });
}

function mapUser(u) {
  if (!u) return null;
  return { uid: String(u.uid || u.id), email: u.email || '', ...u };
}

// ----------------------------------------------------------------
// PHP API helpers
// ----------------------------------------------------------------

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem(LS_TOKEN);
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body.success) throw new Error(body.error || 'Unknown API error');
  return body;
}

async function testApi() {
  try {
    await fetch(`${API_BASE}/auth/verify.php`, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
    apiAvailable = true;
  } catch {
    apiAvailable = false;
  }
}

// ----------------------------------------------------------------
// Mock (localStorage) helpers — same as old firebase.js fallback
// ----------------------------------------------------------------

function lsKey(uid, collection) {
  return `kaisysales_mock_data_${uid}_${collection}`;
}

function localGet(uid, collection) {
  const raw = localStorage.getItem(lsKey(uid, collection));
  return raw ? JSON.parse(raw) : [];
}

function localSet(uid, collection, data) {
  localStorage.setItem(lsKey(uid, collection), JSON.stringify(data));
}

// ----------------------------------------------------------------
// AUTH SERVICE
// ----------------------------------------------------------------

export const authService = {
  async signUp(email, password) {
    await testApi();
    if (apiAvailable) {
      const body = await apiFetch('/auth/signup.php', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(LS_TOKEN, body.token);
      localStorage.setItem(LS_USER, JSON.stringify(body.user));
      notifyListeners(mapUser(body.user));
      return mapUser(body.user);
    }

    // Local mock signup
    await new Promise((r) => setTimeout(r, 300));
    const mockUsers = JSON.parse(localStorage.getItem('kaisysales_mock_users') || '{}');
    if (mockUsers[email.toLowerCase()]) throw new Error('auth/email-already-in-use');
    const uid = 'mock-uid-' + Math.random().toString(36).substr(2, 9);
    const newUser = { uid, email: email.toLowerCase(), password: password };
    mockUsers[email.toLowerCase()] = newUser;
    localStorage.setItem('kaisysales_mock_users', JSON.stringify(mockUsers));
    const sessionUser = { uid, email: email.toLowerCase() };
    localStorage.setItem(LS_TOKEN, uid);
    localStorage.setItem(LS_USER, JSON.stringify(sessionUser));
    localStorage.setItem('kaisysales_mock_session', JSON.stringify(sessionUser));
    notifyListeners(mapUser(sessionUser));
    return mapUser(sessionUser);
  },

  async signIn(email, password) {
    await testApi();
    if (apiAvailable) {
      const body = await apiFetch('/auth/login.php', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(LS_TOKEN, body.token);
      localStorage.setItem(LS_USER, JSON.stringify(body.user));
      notifyListeners(mapUser(body.user));
      return mapUser(body.user);
    }

    // Local mock signin
    await new Promise((r) => setTimeout(r, 300));
    const mockUsers = JSON.parse(localStorage.getItem('kaisysales_mock_users') || '{}');
    const user = mockUsers[email.toLowerCase()];
    if (!user || user.password !== password) throw new Error('auth/wrong-password');
    const sessionUser = { uid: user.uid, email: user.email };
    localStorage.setItem(LS_TOKEN, user.uid);
    localStorage.setItem(LS_USER, JSON.stringify(sessionUser));
    localStorage.setItem('kaisysales_mock_session', JSON.stringify(sessionUser));
    notifyListeners(mapUser(sessionUser));
    return mapUser(sessionUser);
  },

  async signOut() {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
    localStorage.removeItem('kaisysales_mock_session');
    notifyListeners(null);
  },

  onAuthStateChanged(callback) {
    authListeners.push(callback);
    const stored = localStorage.getItem(LS_USER);
    setTimeout(() => callback(stored ? JSON.parse(stored) : null), 0);
    return () => {
      authListeners = authListeners.filter((fn) => fn !== callback);
    };
  },

  getCurrentUser() {
    const stored = localStorage.getItem(LS_USER);
    return stored ? JSON.parse(stored) : null;
  },

  async signInWithGoogle() {
    // Google sign-in only works with the real API, fallback uses mock demo account
    await testApi();
    if (apiAvailable) {
      throw new Error('Google sign-in not yet supported in PHP backend.');
    }
    // Mock Google sign-in
    await new Promise((r) => setTimeout(r, 300));
    const mockUsers = JSON.parse(localStorage.getItem('kaisysales_mock_users') || '{}');
    const email = 'demo@kaisysales.com';
    let user = mockUsers[email];
    if (!user) {
      const uid = 'mock-google-uid-' + Math.random().toString(36).substr(2, 9);
      user = { uid, email, password: 'google-oauth-flow' };
      mockUsers[email] = user;
      localStorage.setItem('kaisysales_mock_users', JSON.stringify(mockUsers));
    }
    const sessionUser = { uid: user.uid, email: user.email };
    localStorage.setItem(LS_TOKEN, user.uid);
    localStorage.setItem(LS_USER, JSON.stringify(sessionUser));
    localStorage.setItem('kaisysales_mock_session', JSON.stringify(sessionUser));
    notifyListeners(mapUser(sessionUser));
    return mapUser(sessionUser);
  },

  async resetPassword(email) {
    // In mock mode, just resolve silently
    return Promise.resolve();
  },
};

// ----------------------------------------------------------------
// DATABASE SERVICE
// ----------------------------------------------------------------

const dbCall = {
  async exec(method, ...args) {
    if (apiAvailable) {
      try {
        return await method(...args);
      } catch {
        // If API fails, fall through to mock
      }
    }
    return await localMock(...args);
  },
};

// Local mock implementations
async function localMock(operation, uid, collectionName, ...rest) {
  const records = localGet(uid, collectionName);

  switch (operation) {
    case 'fetch':
      return records;

    case 'create': {
      const recordData = rest[0];
      const newRecord = { ...recordData, id: 'rec-' + Math.random().toString(36).substr(2, 9), createdAt: new Date().toISOString() };
      records.push(newRecord);
      localSet(uid, collectionName, records);
      return newRecord;
    }

    case 'update': {
      const [recordId, recordData] = rest;
      const idx = records.findIndex((r) => r.id === recordId);
      if (idx === -1) throw new Error('Record not found');
      records[idx] = { ...records[idx], ...recordData, updatedAt: new Date().toISOString() };
      localSet(uid, collectionName, records);
      return records[idx];
    }

    case 'delete': {
      const [recordId] = rest;
      localSet(uid, collectionName, records.filter((r) => r.id !== recordId));
      return true;
    }

    default:
      throw new Error('Unknown operation');
  }
}

async function apiMock(operation, uid, collectionName, ...rest) {
  // Wrapper that tries API first, falls back to localStorage mock
  if (apiAvailable) {
    try {
      switch (operation) {
        case 'fetch': {
          const body = await apiFetch(`/records.php?collection=${collectionName}`);
          return body.data;
        }
        case 'create': {
          const body = await apiFetch(`/records.php?collection=${collectionName}`, {
            method: 'POST',
            body: JSON.stringify(rest[0]),
          });
          return body.data;
        }
        case 'update': {
          const body = await apiFetch(`/records.php?collection=${collectionName}&id=${rest[0]}`, {
            method: 'PUT',
            body: JSON.stringify(rest[1]),
          });
          return body.data;
        }
        case 'delete': {
          await apiFetch(`/records.php?collection=${collectionName}&id=${rest[0]}`, {
            method: 'DELETE',
          });
          return true;
        }
      }
    } catch {
      // API call failed — fall through to localStorage mock
    }
  }
  return localMock(operation, uid, collectionName, ...rest);
}

export const dbService = {
  async getUserProfile(uid) {
    if (apiAvailable) {
      try {
        const body = await apiFetch('/profile.php');
        return body.data;
      } catch { /* fall through */ }
    }
    const raw = localStorage.getItem(`kaisysales_mock_profile_${uid}`);
    return raw ? JSON.parse(raw) : null;
  },

  async saveUserProfile(uid, profileData) {
    if (apiAvailable) {
      try {
        const body = await apiFetch('/profile.php', {
          method: 'PUT',
          body: JSON.stringify(profileData),
        });
        localStorage.setItem(`kaisysales_mock_profile_${uid}`, JSON.stringify(body.data));
        return body.data;
      } catch { /* fall through */ }
    }
    const current = JSON.parse(localStorage.getItem(`kaisysales_mock_profile_${uid}`) || '{}');
    const merged = { ...current, ...profileData, updatedAt: new Date().toISOString() };
    localStorage.setItem(`kaisysales_mock_profile_${uid}`, JSON.stringify(merged));
    return merged;
  },

  fetchUserRecords(uid, collectionName) {
    return apiMock('fetch', uid, collectionName);
  },

  createUserRecord(uid, collectionName, recordData) {
    return apiMock('create', uid, collectionName, recordData);
  },

  updateUserRecord(uid, collectionName, recordId, recordData) {
    return apiMock('update', uid, collectionName, recordId, recordData);
  },

  deleteUserRecord(uid, collectionName, recordId) {
    return apiMock('delete', uid, collectionName, recordId);
  },
};
