const colorThemes = {
  '#6F240A': {
    primary: '#6F240A',
    primaryContainer: '#8E3A1F',
    secondary: '#875200',
    tertiary: '#25432F',
    shadow: '142, 58, 31',
  },
  '#875200': {
    primary: '#875200',
    primaryContainer: '#A06A14',
    secondary: '#6F240A',
    tertiary: '#1E3A8A',
    shadow: '135, 82, 0',
  },
  '#25432F': {
    primary: '#25432F',
    primaryContainer: '#3A5E46',
    secondary: '#6F240A',
    tertiary: '#875200',
    shadow: '37, 67, 47',
  },
  '#D4AF37': {
    primary: '#B8860B',
    primaryContainer: '#D4AF37',
    secondary: '#6F240A',
    tertiary: '#25432F',
    shadow: '184, 134, 11',
  },
  '#8E3A1F': {
    primary: '#8E3A1F',
    primaryContainer: '#A85A3E',
    secondary: '#6F240A',
    tertiary: '#8B5E7C',
    shadow: '142, 58, 31',
  },
  '#1E3A8A': {
    primary: '#1E3A8A',
    primaryContainer: '#3B5CB8',
    secondary: '#6F240A',
    tertiary: '#875200',
    shadow: '30, 58, 138',
  },
  '#8B5E7C': {
    primary: '#8B5E7C',
    primaryContainer: '#A87A9A',
    secondary: '#6F240A',
    tertiary: '#875200',
    shadow: '139, 94, 124',
  },
};

export const getThemeForColor = (avatarColor) => {
  const palette = colorThemes[avatarColor] || colorThemes['#6F240A'];
  return {
    colors: {
      primary: palette.primary,
      primaryContainer: palette.primaryContainer,
      secondary: palette.secondary,
      tertiary: palette.tertiary,
      background: {
        main: '#FCF9F3',
        surface: '#FFFFFF',
        surfaceVariant: '#F0EEE8',
      },
      text: {
        main: '#1C1C18',
        muted: '#55423D',
        onPrimary: '#FFFFFF',
      },
      status: {
        success: palette.tertiary,
        error: '#BA1A1A',
        warning: palette.secondary,
      },
      border: '#89726C',
      outlineVariant: '#DCC1B9',
    },
    fonts: {
      main: "'Work Sans', system-ui, sans-serif",
      display: "'Manrope', sans-serif",
      data: "'Work Sans', monospace",
    },
    fontSizes: {
      xs: '12px', sm: '14px', base: '16px', lg: '18px', xl: '20px',
      '2xl': '24px', '3xl': '32px', '4xl': '48px',
    },
    spacing: { unit: '4px', xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '40px' },
    borderRadius: { sm: '4px', md: '8px', lg: '16px', full: '9999px' },
    shadows: {
      soft: `0 4px 6px rgba(${palette.shadow}, 0.08)`,
      ambient: `0 10px 15px -3px rgba(${palette.shadow}, 0.1)`,
    },
    transitions: {
      default: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      fast: 'all 0.15s ease-in-out',
    },
  };
};


