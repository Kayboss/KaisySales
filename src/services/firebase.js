import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection as firestoreCollection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where
} from 'firebase/firestore';

// ----------------------------------------------------
// 1. ENVIRONMENT CONFIGURATION & DETECTION
// ----------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if Firebase keys are fully configured in Vite environment
// Prevents connection attempts if keys are empty or still containing placeholder 'your-' text
export const isRealFirebase = !!(
  firebaseConfig.apiKey && 
  !firebaseConfig.apiKey.includes('your-') &&
  firebaseConfig.projectId && 
  !firebaseConfig.projectId.includes('your-') &&
  firebaseConfig.authDomain &&
  !firebaseConfig.authDomain.includes('your-')
);

let app = null;
let auth = null;
let db = null;

if (isRealFirebase) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('🔥 KaisySales: Connected to Real Cloud Firebase & Firestore!');
  } catch (error) {
    console.error('🔥 Firebase initialization failed, falling back to Local Mode:', error);
  }
} else {
  console.log(
    '🌱 KaisySales: Running in Local Emulator Fallback mode.\n' +
    'To connect to real Firebase, add your credentials to the .env file. See .env.example'
  );
}

// ----------------------------------------------------
// 2. AUTHENTICATION SERVICE
// ----------------------------------------------------
export const authService = {
  /**
   * Signs up a new user with email and password.
   */
  signUp: async (email, password) => {
    if (isRealFirebase && auth) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } else {
      // Local Mock Signup
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const mockUsers = JSON.parse(localStorage.getItem('kaisysales_mock_users') || '{}');
          if (mockUsers[email.toLowerCase()]) {
            reject(new Error('auth/email-already-in-use: Email already registered.'));
            return;
          }
          
          const uid = 'mock-uid-' + Math.random().toString(36).substr(2, 9);
          const newUser = {
            uid,
            email: email.toLowerCase(),
            password: password, // For mock testing simplicity
            createdAt: new Date().toISOString()
          };
          
          mockUsers[email.toLowerCase()] = newUser;
          localStorage.setItem('kaisysales_mock_users', JSON.stringify(mockUsers));
          
          // Set session
          localStorage.setItem('kaisysales_mock_session', JSON.stringify(newUser));
          
          // Trigger mock state change
          triggerMockAuthStateChange(newUser);
          resolve(newUser);
        }, 800);
      });
    }
  },

  /**
   * Signs in an existing user.
   */
  signIn: async (email, password) => {
    if (isRealFirebase && auth) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } else {
      // Local Mock SignIn
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const mockUsers = JSON.parse(localStorage.getItem('kaisysales_mock_users') || '{}');
          const user = mockUsers[email.toLowerCase()];
          
          if (!user || user.password !== password) {
            reject(new Error('auth/wrong-password: Invalid email or passphrase.'));
            return;
          }
          
          const sessionUser = { uid: user.uid, email: user.email };
          localStorage.setItem('kaisysales_mock_session', JSON.stringify(sessionUser));
          
          // Trigger mock state change
          triggerMockAuthStateChange(sessionUser);
          resolve(sessionUser);
        }, 800);
      });
    }
  },

  /**
   * Signs out the current user.
   */
  signOut: async () => {
    if (isRealFirebase && auth) {
      await firebaseSignOut(auth);
    } else {
      // Local Mock SignOut
      localStorage.removeItem('kaisysales_mock_session');
      triggerMockAuthStateChange(null);
    }
  },

  /**
   * Listens to authorization changes.
   */
  onAuthStateChanged: (callback) => {
    if (isRealFirebase && auth) {
      return firebaseOnAuthStateChanged(auth, callback);
    } else {
      // Add callback to the global mock listeners
      mockAuthListeners.push(callback);
      
      // Immediately call with current session value asynchronously on the next tick
      const sessionStr = localStorage.getItem('kaisysales_mock_session');
      const currentUser = sessionStr ? JSON.parse(sessionStr) : null;
      setTimeout(() => callback(currentUser), 0);
      
      // Return unsubscriber function
      return () => {
        const index = mockAuthListeners.indexOf(callback);
        if (index > -1) mockAuthListeners.splice(index, 1);
      };
    }
  },

  /**
   * Gets the current authenticated user synchronously.
   */
  getCurrentUser: () => {
    if (isRealFirebase && auth) {
      return auth.currentUser;
    } else {
      const sessionStr = localStorage.getItem('kaisysales_mock_session');
      return sessionStr ? JSON.parse(sessionStr) : null;
    }
  },

  /**
   * Google Sign-In pop-up driver wrapper
   */
  signInWithGoogle: async () => {
    if (isRealFirebase && auth) {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      return userCredential.user;
    } else {
      // Local Mock Google Sign-In
      return new Promise((resolve) => {
        setTimeout(() => {
          const mockUsers = JSON.parse(localStorage.getItem('kaisysales_mock_users') || '{}');
          const email = 'demo@kaisysales.com';
          
          let user = mockUsers[email];
          if (!user) {
            const uid = 'mock-google-uid-' + Math.random().toString(36).substr(2, 9);
            user = {
              uid,
              email,
              password: 'google-oauth-flow',
              createdAt: new Date().toISOString()
            };
            mockUsers[email] = user;
            localStorage.setItem('kaisysales_mock_users', JSON.stringify(mockUsers));
          }
          
          const sessionUser = { uid: user.uid, email: user.email };
          localStorage.setItem('kaisysales_mock_session', JSON.stringify(sessionUser));
          triggerMockAuthStateChange(sessionUser);
          resolve(sessionUser);
        }, 800);
      });
    }
  },

  /**
   * Reset Passphrase Wrapper
   */
  resetPassword: async (email) => {
    if (isRealFirebase && auth) {
      await sendPasswordResetEmail(auth, email);
    } else {
      // Local Mock Password Reset
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          const mockUsers = JSON.parse(localStorage.getItem('kaisysales_mock_users') || '{}');
          if (!mockUsers[email.toLowerCase()]) {
            reject(new Error('auth/user-not-found: Email not registered.'));
            return;
          }
          resolve(true);
        }, 800);
      });
    }
  }
};

// State listeners registry for simulated auth
const mockAuthListeners = [];
const triggerMockAuthStateChange = (user) => {
  mockAuthListeners.forEach(callback => callback(user));
};

// ----------------------------------------------------
// 3. FIRESTORE DATABASE SERVICE
// ----------------------------------------------------

// Dynamic database activity flag that degrades gracefully to local mock if Firestore fails
export let isFirebaseActive = isRealFirebase;

const disableRealFirebase = () => {
  if (isFirebaseActive) {
    isFirebaseActive = false;
    console.warn('⚠️ KaisySales: Switched to Local Emulation Fallback Mode due to a network connection timeout or unprovisioned Firestore.');
  }
};

const DB_TIMEOUT_MS = 2500; // 2.5 seconds timeout for live Firestore requests

const executeWithTimeout = async (promise, fallbackAction) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT: Connection to Firebase timed out.')), DB_TIMEOUT_MS)
    )
  ]).catch(err => {
    if (err.message && err.message.includes('TIMEOUT')) {
      console.warn('🔥 Firestore connection timed out. Automatic fallback to local database triggered.');
      disableRealFirebase();
      return fallbackAction();
    }
    throw err;
  });
};

/**
 * Searches all localStorage mock profiles for one matching the given email.
 * Returns the profile and its stored UID if found.
 */
const findLocalProfileByEmail = (email) => {
  if (!email) return null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('kaisysales_mock_profile_')) {
      try {
        const profile = JSON.parse(localStorage.getItem(key));
        if (profile.email && profile.email.toLowerCase() === email.toLowerCase()) {
          return { profile, oldUid: key.replace('kaisysales_mock_profile_', '') };
        }
      } catch (e) {
        // skip invalid JSON entries
      }
    }
  }
  return null;
};

/**
 * Migrates all CRUD data from an old mock UID to the current UID in localStorage.
 */
const migrateDataToNewUid = (oldUid, newUid) => {
  const collections = ['sales', 'invoices', 'expenses', 'inventory', 'stores', 'categories'];
  collections.forEach((col) => {
    const oldData = localStorage.getItem(`kaisysales_mock_data_${oldUid}_${col}`);
    if (oldData) {
      localStorage.setItem(`kaisysales_mock_data_${newUid}_${col}`, oldData);
      localStorage.removeItem(`kaisysales_mock_data_${oldUid}_${col}`);
    }
  });
  // Remove old profile
  localStorage.removeItem(`kaisysales_mock_profile_${oldUid}`);
};

export const dbService = {
  /**
   * Fetches a user's settings profile.
   * Falls back to email-based localStorage lookup when Firestore doc is missing,
   * allowing a seamless migration from mock mode to real Firebase.
   */
  getUserProfile: async (uid) => {
    const localFetch = () => {
      const profile = localStorage.getItem(`kaisysales_mock_profile_${uid}`);
      if (profile) return JSON.parse(profile);
      // UID-based lookup failed — try email-based lookup (migration from mock-mode era)
      const currentUser = auth?.currentUser;
      if (currentUser?.email) {
        const found = findLocalProfileByEmail(currentUser.email);
        if (found) {
          migrateDataToNewUid(found.oldUid, uid);
          // Write the profile under the new UID so subsequent lookups succeed
          localStorage.setItem(`kaisysales_mock_profile_${uid}`, JSON.stringify(found.profile));
          return found.profile;
        }
      }
      return null;
    };

    if (isFirebaseActive && db) {
      return executeWithTimeout(
        (async () => {
          const docRef = doc(db, 'users', uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            return docSnap.data();
          }
          // Doc doesn't exist in Firestore — attempt email-based migration from localStorage
          const currentUser = auth?.currentUser;
          if (currentUser?.email) {
            const found = findLocalProfileByEmail(currentUser.email);
            if (found) {
              // Migrate profile to Firestore
              await setDoc(docRef, { ...found.profile, updatedAt: new Date().toISOString() }, { merge: true });
              // Migrate CRUD data to new UID in localStorage
              migrateDataToNewUid(found.oldUid, uid);
              return found.profile;
            }
          }
          return null;
        })(),
        localFetch
      );
    } else {
      // Local mock profile fetch
      return new Promise((resolve) => {
        setTimeout(() => resolve(localFetch()), 50);
      });
    }
  },

  /**
   * Saves a user's settings profile.
   */
  saveUserProfile: async (uid, profileData) => {
    const localSave = () => {
      const currentProfileStr = localStorage.getItem(`kaisysales_mock_profile_${uid}`);
      const currentProfile = currentProfileStr ? JSON.parse(currentProfileStr) : {};
      const merged = { ...currentProfile, ...profileData, updatedAt: new Date().toISOString() };
      localStorage.setItem(`kaisysales_mock_profile_${uid}`, JSON.stringify(merged));
      return merged;
    };

    if (isFirebaseActive && db) {
      return executeWithTimeout(
        (async () => {
          const docRef = doc(db, 'users', uid);
          await setDoc(docRef, { ...profileData, updatedAt: new Date().toISOString() }, { merge: true });
          return profileData;
        })(),
        localSave
      );
    } else {
      // Local mock profile save
      return new Promise((resolve) => {
        setTimeout(() => resolve(localSave()), 50);
      });
    }
  },

  /**
   * Fetches records for a sub-collection (e.g. sales, inventory, expenses, invoices)
   */
  fetchUserRecords: async (uid, collectionName) => {
    const localFetch = () => {
      const recordsStr = localStorage.getItem(`kaisysales_mock_data_${uid}_${collectionName}`);
      return recordsStr ? JSON.parse(recordsStr) : [];
    };

    if (isFirebaseActive && db) {
      return executeWithTimeout(
        (async () => {
          const colRef = firestoreCollection(db, 'users', uid, collectionName);
          const snapshot = await getDocs(colRef);
          const records = [];
          snapshot.forEach((doc) => {
            records.push({ id: doc.id, ...doc.data() });
          });
          return records;
        })(),
        localFetch
      );
    } else {
      // Local mock sub-collection fetch
      return new Promise((resolve) => {
        setTimeout(() => resolve(localFetch()), 80);
      });
    }
  },

  /**
   * Creates a record in a user's sub-collection.
   */
  createUserRecord: async (uid, collectionName, recordData) => {
    const localCreate = () => {
      const recordsStr = localStorage.getItem(`kaisysales_mock_data_${uid}_${collectionName}`);
      const records = recordsStr ? JSON.parse(recordsStr) : [];
      const newRecord = {
        ...recordData,
        id: 'mock-rec-' + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString()
      };
      records.push(newRecord);
      localStorage.setItem(`kaisysales_mock_data_${uid}_${collectionName}`, JSON.stringify(records));
      return newRecord;
    };

    if (isFirebaseActive && db) {
      return executeWithTimeout(
        (async () => {
          const colRef = firestoreCollection(db, 'users', uid, collectionName);
          const docRef = await addDoc(colRef, { ...recordData, createdAt: new Date().toISOString() });
          return { ...recordData, id: docRef.id };
        })(),
        localCreate
      );
    } else {
      // Local mock sub-collection creation
      return new Promise((resolve) => {
        setTimeout(() => resolve(localCreate()), 50);
      });
    }
  },

  /**
   * Updates an existing record in a user's sub-collection.
   */
  updateUserRecord: async (uid, collectionName, recordId, recordData) => {
    const localUpdate = () => {
      const recordsStr = localStorage.getItem(`kaisysales_mock_data_${uid}_${collectionName}`);
      const records = recordsStr ? JSON.parse(recordsStr) : [];
      const index = records.findIndex(r => r.id === recordId);
      if (index === -1) {
        throw new Error('Record not found.');
      }
      const updated = {
        ...records[index],
        ...recordData,
        updatedAt: new Date().toISOString()
      };
      records[index] = updated;
      localStorage.setItem(`kaisysales_mock_data_${uid}_${collectionName}`, JSON.stringify(records));
      return updated;
    };

    if (isFirebaseActive && db) {
      return executeWithTimeout(
        (async () => {
          const docRef = doc(db, 'users', uid, collectionName, recordId);
          await updateDoc(docRef, { ...recordData, updatedAt: new Date().toISOString() });
          return { ...recordData, id: recordId };
        })(),
        localUpdate
      );
    } else {
      // Local mock sub-collection update
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            resolve(localUpdate());
          } catch (e) {
            reject(e);
          }
        }, 50);
      });
    }
  },

  /**
   * Deletes a record from a user's sub-collection.
   */
  deleteUserRecord: async (uid, collectionName, recordId) => {
    const localDelete = () => {
      const recordsStr = localStorage.getItem(`kaisysales_mock_data_${uid}_${collectionName}`);
      const records = recordsStr ? JSON.parse(recordsStr) : [];
      const filtered = records.filter(r => r.id !== recordId);
      localStorage.setItem(`kaisysales_mock_data_${uid}_${collectionName}`, JSON.stringify(filtered));
      return true;
    };

    if (isFirebaseActive && db) {
      return executeWithTimeout(
        (async () => {
          const docRef = doc(db, 'users', uid, collectionName, recordId);
          await deleteDoc(docRef);
          return true;
        })(),
        localDelete
      );
    } else {
      // Local mock sub-collection deletion
      return new Promise((resolve) => {
        setTimeout(() => resolve(localDelete()), 50);
      });
    }
  }
};
