import { create } from 'zustand';
import { authService, dbService } from '../services/supabase';

/**
 * Auth Store
 * Manages Supabase authentication state and reactive listeners.
 */
export const useAuthStore = create((set) => {
  
  // Register the auth listener to update the store immediately on auth status changes
  const unsubscribe = authService.onAuthStateChanged((user) => {
    if (user) {
      set({ 
        user: { uid: user.uid, email: user.email }, 
        isAuthenticated: true, 
        isInitialized: true 
      });
      dbService.ensureFreeTrial(user.uid);
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
     * Supabase signup wrapper
     */
    signup: async (email, password) => {
      const user = await authService.signUp(email, password);
      return user;
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
