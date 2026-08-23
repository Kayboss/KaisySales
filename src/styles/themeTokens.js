/**
 * KaisySales Design Tokens
 * Inspired by traditional African heritage and modern financial technology.
 */

export const themeTokens = {
  colors: {
    primary: '#6F240A', // Terracotta
    primaryContainer: '#8E3A1F', // Deep Terracotta
    secondary: '#875200', // Ochre
    tertiary: '#25432F', // Forest Green
    
    background: {
      main: '#FCF9F3', // Warm Cream
      surface: '#FFFFFF',
      surfaceVariant: '#F0EEE8',
    },
    
    text: {
      main: '#1C1C18', // Deep Charcoal
      muted: '#55423D', // Warm Muted Gray
      onPrimary: '#FFFFFF',
    },
    
    status: {
      success: '#25432F', // Forest Green
      error: '#BA1A1A',
      warning: '#875200',
    },

    border: '#89726C',
    outlineVariant: '#DCC1B9',
  },

  fonts: {
    main: "'Work Sans', system-ui, sans-serif",
    display: "'Tango Sans', 'Manrope', sans-serif",
    data: "'Work Sans', monospace",
  },

  fontSizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '48px',
  },

  spacing: {
    unit: '4px',
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '40px',
  },

  borderRadius: {
    sm: '4px',
    md: '8px', // Default rounding
    lg: '16px',
    full: '9999px',
  },

  shadows: {
    soft: '0 4px 6px rgba(142, 58, 31, 0.08)',
    ambient: '0 10px 15px -3px rgba(142, 58, 31, 0.1)',
  },

  transitions: {
    default: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    fast: 'all 0.15s ease-in-out',
  }
};
