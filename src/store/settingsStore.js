import { create } from 'zustand';
import { dbService } from '../services/supabase';
import { resolveActiveBranch } from '../utils/tenancy';
// import { detectCurrency } from '../utils/currency';

const BRANCH_KEY = 'kaisysales_active_branch';

const readActiveBranch = (businessId, branches, role, memberBranchId) => {
  // Staff are pinned to the branch on their membership; the switcher is an
  // owner-only affordance and a cashier must not be able to look at another
  // shop's takings by editing localStorage. The rule itself lives in
  // utils/tenancy.js so it can be tested without zustand.
  if (role === 'staff') return resolveActiveBranch({ role, branchId: memberBranchId });
  if (!businessId) return null;
  return resolveActiveBranch({
    role,
    branches,
    stored: localStorage.getItem(`${BRANCH_KEY}:${businessId}`),
  });
};

/**
 * Settings Store
 *
 * Profile fields (name, avatar colour, subscription) live on `profiles`.
 * Business fields (name, currency, logo, type, category, phone, location) live
 * on `businesses`, because a business can now have more than one login.
 */
export const useSettingsStore = create((set, get) => ({
  businessId: null,
  businessRole: null,   // 'owner' | 'staff' | null — distinct from platform `role`
  branchId: null,       // the branch on the membership (staff assignment)
  modules: ['sales'],   // 'sales' is always present; 'reporting' is opt-in
  branches: [],
  activeBranchId: null, // null means "All branches" for an owner

  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  location: '',
  category: '',
  businessType: 'retail',
  avatarColor: '#6F240A',
  role: 'user',         // platform role (admin), never the business role
  status: 'active',
  currency: 'GHS',
  logoUrl: '',
  areaPrice: '',
  subscriptionPlan: 'none',
  subscriptionStatus: 'none',
  subscriptionExpiresAt: null,
  isOnboarded: null,
  isLoading: false,

  /**
   * Loads the profile plus the membership/business/branch bundle in one pass.
   */
  loadSettings: async (uid) => {
    set({ isLoading: true });
    try {
      const [profile, tenant] = await Promise.all([
        dbService.getUserProfile(uid),
        dbService.myPermissions().catch((error) => {
          console.error('🔥 Error loading business membership:', error);
          return null;
        }),
      ]);

      const business = tenant?.business || null;
      const branches = Array.isArray(tenant?.branches) ? tenant.branches : [];
      const businessId = tenant?.businessId || null;
      const activeBranchId = readActiveBranch(
        businessId,
        branches,
        tenant?.role,
        tenant?.branchId
      );

      set({
        businessId,
        businessRole: tenant?.role || null,
        branchId: tenant?.branchId ?? null,
        modules: Array.isArray(tenant?.modules) ? tenant.modules : [],
        branches,
        activeBranchId,
        businessName: business?.name || '',
        phone: business?.phone || '',
        location: business?.location || '',
        category: business?.category || '',
        businessType: business?.businessType || business?.business_type || 'retail',
        currency: business?.currency || 'GHS',
        logoUrl: business?.logoUrl || business?.logo_url || '',
        ownerName: profile?.ownerName || '',
        email: profile?.email || '',
        avatarColor: profile?.avatarColor || '#6F240A',
        role: profile?.role || 'user',
        status: profile?.status || 'active',
        areaPrice: profile?.areaPrice || profile?.area_price || '0',
        subscriptionPlan: profile?.subscriptionPlan || 'none',
        subscriptionStatus: profile?.subscriptionStatus || 'none',
        subscriptionExpiresAt: profile?.subscriptionExpiresAt || null,
        // A completed profile is not enough: without a membership the login
        // cannot write a single row, so onboarding must run again.
        isOnboarded: profile?.isOnboarded === true && Boolean(businessId),
        isLoading: false,
      });
    } catch (error) {
      console.error('🔥 Error loading settings:', error);
      set({ isLoading: false, isOnboarded: false });
    }
  },

  /**
   * Splits a save between the profile and the business row. `businessRole`
   * and `role` are never taken from the payload.
   */
  updateSettings: async (uid, newSettings) => {
    set({ isLoading: true });
    try {
      const {
        businessName,
        businessType,
        currency,
        logoUrl,
        phone,
        location,
        category,
        ...profileFields
      } = newSettings;

      const businessId = get().businessId;
      const businessPatch = {};
      if (businessName !== undefined) businessPatch.name = businessName;
      if (businessType !== undefined) businessPatch.business_type = businessType;
      if (currency !== undefined) businessPatch.currency = currency;
      if (logoUrl !== undefined) businessPatch.logo_url = logoUrl;
      if (phone !== undefined) businessPatch.phone = phone;
      if (location !== undefined) businessPatch.location = location;
      if (category !== undefined) businessPatch.category = category;

      if (businessId && Object.keys(businessPatch).length > 0) {
        await dbService.updateBusiness(businessId, businessPatch);
      }

      const updated = await dbService.saveUserProfile(uid, profileFields);

      set((state) => ({
        ...state,
        isLoading: false,
        businessName: businessName ?? state.businessName,
        businessType: businessType ?? state.businessType,
        currency: currency ?? state.currency,
        logoUrl: logoUrl ?? state.logoUrl,
        phone: phone ?? state.phone,
        location: location ?? state.location,
        category: category ?? state.category,
        ownerName: updated?.ownerName ?? state.ownerName,
        avatarColor: updated?.avatarColor ?? state.avatarColor,
        email: updated?.email ?? state.email,
        areaPrice: updated?.areaPrice ?? state.areaPrice,
        isOnboarded: updated?.isOnboarded ?? state.isOnboarded,
        // Privileged fields are never copied from the payload.
        role: state.role,
        businessRole: state.businessRole,
        subscriptionPlan: state.subscriptionPlan,
        subscriptionStatus: state.subscriptionStatus,
        subscriptionExpiresAt: state.subscriptionExpiresAt,
      }));
    } catch (error) {
      console.error('🔥 Error saving settings:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Switches the owner's view. Persisted per business so a reload keeps the
   * branch they were looking at. Staff cannot call this (the UI hides it).
   */
  setActiveBranchId: (branchId) => {
    const { businessId, businessRole } = get();
    if (businessRole === 'staff') return;
    const normalised = branchId == null ? null : Number(branchId);
    if (businessId) {
      if (normalised == null) localStorage.removeItem(`${BRANCH_KEY}:${businessId}`);
      else localStorage.setItem(`${BRANCH_KEY}:${businessId}`, String(normalised));
    }
    set({ activeBranchId: normalised });
  },

  /**
   * Re-reads the membership after onboarding created or joined a business.
   */
  reloadTenant: async (uid) => {
    await get().loadSettings(uid);
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
    businessId: null,
    businessRole: null,
    branchId: null,
    modules: ['sales'],
    branches: [],
    activeBranchId: null,
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    location: '',
    category: '',
    businessType: 'retail',
    currency: 'GHS',
    logoUrl: '',
    role: 'user',
    status: 'active',
    subscriptionPlan: 'none',
    subscriptionStatus: 'none',
    subscriptionExpiresAt: null,
    isOnboarded: null,
    isLoading: false,
  })
}));
