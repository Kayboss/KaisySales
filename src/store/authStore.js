import { create } from 'zustand';
import { authService } from '../services/supabase';

/**
 * Auth Store
 * Manages Supabase authentication state and reactive listeners.
 */
export const useAuthStore = create((set) => {
  
  // Register the auth listener to update the store immediately on auth status changes
  const unsubscribe = authService.onAuthStateChanged((user) => {
    if (user) {
      set({ 
        user: {
          uid: user.uid,
          email: user.email,
          // Set by the `create-staff` function; CheckAuth blocks the app until
          // the password has been replaced.
          mustChangePassword: user.mustChangePassword === true,
        }, 
        isAuthenticated: true, 
        isInitialized: true 
      });
      // Deliberately nothing else here. Provisioning a business must only happen
      // from onboarding, because a login that was invited as staff already has
      // one and must not be given a second.
    } else {
      set({ 
        user: null, 
        isAuthenticated: false, 
        isInitialized: true 
      });
    }
  });

  return {
    user: null,
    isAuthenticated: false,
    isInitialized: false,

    /**
     * Supabase signup wrapper. Returns `{ status, user }` — the status is what
     * the form needs, because "already registered" arrives with no error and no
     * user. See describeSignUp in utils/authMessages.
     */
    signup: async (email, password) => {
      return authService.signUp(email, password);
    },

    /**
     * Supabase signin wrapper
     */
    login: async (email, password) => {
      const user = await authService.signIn(email, password);
      return user;
    },

    /**
     * Supabase signout wrapper
     */
    logout: async () => {
      await authService.signOut();
    },

    /**
     * Google Sign-in action
     */
    signInWithGoogle: async () => {
      const user = await authService.signInWithGoogle();
      return user;
    },

    /**
     * Passphrase reset action
     */
    resetPassword: async (email) => {
      await authService.resetPassword(email);
    },

    // Exposed for teardowns in testing if needed
    cleanup: () => unsubscribe()
  };
});
