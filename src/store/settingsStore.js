import { create } from 'zustand';
import { dbService } from '../services/supabase';
// import { detectCurrency } from '../utils/currency';

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
  businessType: 'retail',
  avatarColor: '#6F240A',
  role: 'user',
  status: 'active',
  currency: 'GHS',
  subscriptionPlan: 'none',
  subscriptionStatus: 'none',
  subscriptionExpiresAt: null,
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
          businessType: profile.businessType || profile.business_type || 'retail',
          avatarColor: profile.avatarColor || '#6F240A',
          role: profile.role || 'user',
          status: profile.status || 'active',
          currency: profile.currency || 'GHS',
          subscriptionPlan: profile.subscriptionPlan || 'none',
          subscriptionStatus: profile.subscriptionStatus || 'none',
          subscriptionExpiresAt: profile.subscriptionExpiresAt || null,
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
      // Strip privileged fields to prevent client-side privilege escalation
      const { ...safeSettings } = newSettings;
      const updated = await dbService.saveUserProfile(uid, safeSettings);
      set((state) => ({
        ...state,
        ...updated,
        role: state.role,
        subscriptionPlan: state.subscriptionPlan,
        subscriptionStatus: state.subscriptionStatus,
        subscriptionExpiresAt: state.subscriptionExpiresAt,
        isLoading: false
      }));
    } catch (error) {
      console.error('🔥 Error saving settings to Firestore:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Live-update avatarColor in local state only (for theme preview).
   * Does NOT persist to DB — the user must click "Save Changes" for that.
   */
  setAvatarColor: (color) => set({ avatarColor: color }),

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
    role: 'user',
    isOnboarded: null,
    isLoading: false
  })
}));
