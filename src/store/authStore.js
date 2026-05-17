import { create } from 'zustand';
import { authService } from '../services/phpBackend';

/**
 * Auth Store
 * Manages Firebase authentication state and reactive listeners.
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
     * Firebase signup wrapper
     */
    signup: async (email, password) => {
      try {
        const user = await authService.signUp(email, password);
        return user;
      } catch (error) {
        throw error;
      }
    },

    /**
     * Firebase signin wrapper
     */
    login: async (email, password) => {
      try {
        const user = await authService.signIn(email, password);
        return user;
      } catch (error) {
        throw error;
      }
    },

    /**
     * Firebase signout wrapper
     */
    logout: async () => {
      try {
        await authService.signOut();
      } catch (error) {
        throw error;
      }
    },

    /**
     * Google Sign-in action
     */
    signInWithGoogle: async () => {
      try {
        const user = await authService.signInWithGoogle();
        return user;
      } catch (error) {
        throw error;
      }
    },

    /**
     * Passphrase reset action
     */
    resetPassword: async (email) => {
      try {
        await authService.resetPassword(email);
      } catch (error) {
        throw error;
      }
    },

    setInitialized: (val) => set({ isInitialized: val }),
    
    // Exposed for teardowns in testing if needed
    cleanup: () => unsubscribe()
  };
});
