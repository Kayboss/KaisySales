import { createContext, useContext, useState } from 'react';
import { ThemeProvider } from 'styled-components';
import { themeTokens } from '../styles/themeTokens';

const ThemeContext = createContext();

export const ThemeContextProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to premium dark

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  // Only token keys that actually exist are exposed. This previously read
  // dark/light variants of the background group, which the design tokens never
  // defined, so theme.background resolved to undefined for everything this
  // provider wraps.
  const theme = {
    ...themeTokens,
    mode: isDarkMode ? 'dark' : 'light',
    background: themeTokens.colors.background.main,
    surface: isDarkMode ? themeTokens.colors.background.surface : '#FFFFFF',
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeContextProvider');
  }
  return context;
};
