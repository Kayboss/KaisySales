import React, { createContext, useContext, useState } from 'react';
import { ThemeProvider } from 'styled-components';
import { themeTokens } from '../styles/themeTokens';

const ThemeContext = createContext();

export const ThemeContextProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to premium dark

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const theme = {
    ...themeTokens,
    mode: isDarkMode ? 'dark' : 'light',
    background: isDarkMode ? themeTokens.colors.background.dark : themeTokens.colors.background.light,
    surface: isDarkMode ? themeTokens.colors.background.surface : '#FFFFFF',
    text: isDarkMode ? themeTokens.colors.text.main : '#1A1A1A',
    textMuted: isDarkMode ? themeTokens.colors.text.muted : '#666666',
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeContextProvider');
  }
  return context;
};
