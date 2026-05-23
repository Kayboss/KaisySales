import { create } from 'zustand';
import { dbService } from '../services/supabase';

/**
 * Settings Store
 * Coordinates user settings and business details with the Firestore backend.
 */
export const useSettingsStore = create((set) => ({
  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  location: '',
  category: '',
  isOnboarded: null,
  isLoading: false,

  /**
   * Fetches settings document from Firestore
   */
  loadSettings: async (uid) => {
    set({ isLoading: true });
    try {
      const profile = await dbService.getUserProfile(uid);
      if (profile) {
        set({
          businessName: profile.businessName || '',
          ownerName: profile.ownerName || '',
          email: profile.email || '',
          phone: profile.phone || '',
          location: profile.location || '',
          category: profile.category || '',
          isOnboarded: profile.isOnboarded === true,
          isLoading: false
        });
      } else {
        // Pristine default settings for completely fresh users
        set({
          businessName: '',
          ownerName: '',
          email: '',
          phone: '',
          location: '',
          category: '',
          isOnboarded: false,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('🔥 Error loading settings from Firestore:', error);
      set({ isLoading: false, isOnboarded: false });
    }
  },

  /**
   * Updates user settings in Firestore and local state
   */
  updateSettings: async (uid, newSettings) => {
    set({ isLoading: true });
    try {
      const updated = await dbService.saveUserProfile(uid, newSettings);
      set((state) => ({
        ...state,
        ...updated,
        isLoading: false
      }));
    } catch (error) {
      console.error('🔥 Error saving settings to Firestore:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Resets local settings to default empty state
   */
  clearSettings: () => set({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    location: '',
    category: '',
    isOnboarded: null,
    isLoading: false
  })
}));
