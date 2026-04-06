import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from './theme';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  // null = follow system, 'light' or 'dark' = manual override
  const [manualTheme, setManualTheme] = useState(null);

  const isDark = manualTheme ? manualTheme === 'dark' : systemScheme === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setManualTheme((prev) => {
      if (prev === null) return isDark ? 'light' : 'dark';
      return prev === 'dark' ? 'light' : 'dark';
    });
  };

  const resetToSystem = () => setManualTheme(null);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, resetToSystem, manualTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export default ThemeContext;
