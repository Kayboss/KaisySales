/**
 * Backend configuration rules for KaisySales.
 *
 * Deliberately dependency-free and import-free so the rules can be unit tested in
 * plain Node (scripts/backend-config.test.mjs) without a bundler or a browser.
 * A security rule that can only be verified by shipping a broken build is not a
 * rule anyone can rely on.
 *
 * The rule: financial records must never be kept in localStorage by a production
 * build. The fallback exists for UI development without credentials, so it is
 * enabled only in a dev build; a production build with no Supabase credentials
 * refuses to start instead of accepting a sign-in and silently storing data.
 */

export const CONFIG_ERROR_MESSAGE =
  'KaisySales is not configured: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing from this build. Nothing has been saved.';

/**
 * @param {{ url?: string, anonKey?: string, isDev: boolean }} env
 * @returns {{ isConfigured: boolean, isMockFallbackEnabled: boolean, shouldBlockStartup: boolean }}
 */
export function resolveBackend({ url, anonKey, isDev }) {
  const isConfigured = Boolean(url && anonKey && !String(url).includes('your-'));
  const isMockFallbackEnabled = Boolean(isDev);
  return {
    isConfigured,
    isMockFallbackEnabled,
    // Fail closed: block the app unless a real backend exists.
    shouldBlockStartup: !isConfigured && !isMockFallbackEnabled,
  };
}

/**
 * Returns a guard that throws in a production build with no backend, so no code
 * path can quietly read or write a user's records into localStorage.
 */
export function createAssertBackendAvailable({ isConfigured, isMockFallbackEnabled, message = CONFIG_ERROR_MESSAGE }) {
  return function assertBackendAvailable() {
    if (isConfigured || isMockFallbackEnabled) return;
    const error = new Error(message);
    error.code = 'SUPABASE_NOT_CONFIGURED';
    throw error;
  };
}
