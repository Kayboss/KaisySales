/**
 * Security Configuration
 * Defines Content Security Policy (CSP) and other browser security headers.
 */

export const securityConfig = {
  // Content Security Policy defaults
  csp: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"], // unsafe-inline might be needed for some dev tools
    'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    'font-src': ["'self'", "https://fonts.gstatic.com"],
    'img-src': ["'self'", "data:", "https:"],
    'connect-src': ["'self'", "https://api.example.com"], // Add your API domain here
  },

  // Rate Limiting simulation for client-side protection
  rateLimit: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },

  // Session configuration
  session: {
    tokenKey: 'anti_gravity_auth_token',
    refreshKey: 'anti_gravity_refresh_token',
    expiryDays: 7,
  }
};

/**
 * Utility to generate CSP string for meta tag
 */
export const getCSPString = () => {
  return Object.entries(securityConfig.csp)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
};
