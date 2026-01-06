"use client";

import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useIsDarkMode } from '../hooks/useMediaQuery';

interface ThemeColors {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  text: string;
  textSecondary: string;
  border: string;
  borderDark: string;
  hover: string;
  card: string;
  shadow: string;
}

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  theme: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemDarkMode = useIsDarkMode();
  const [darkMode, setDarkModeStorage] = useLocalStorage('theme-dark-mode', systemDarkMode);

  const toggleDarkMode = useCallback(() => {
    setDarkModeStorage(!darkMode);
  }, [darkMode, setDarkModeStorage]);

  const setDarkMode = useCallback((isDark: boolean) => {
    setDarkModeStorage(isDark);
  }, [setDarkModeStorage]);

  const theme: ThemeColors = {
    bg: darkMode ? '#0a0a0a' : '#ffffff',
    bgSecondary: darkMode ? '#0f0f0f' : '#ffffff',
    bgTertiary: darkMode ? '#1a1a1a' : '#f3f4f6',
    text: darkMode ? '#e5e5e5' : '#000000',
    textSecondary: darkMode ? '#a3a3a3' : '#6b7280',
    border: darkMode ? '#333333' : '#e5e7eb',
    borderDark: darkMode ? '#333333' : '#000000',
    hover: darkMode ? '#2a2a2a' : '#f9fafb',
    card: darkMode ? '#141414' : '#ffffff',
    shadow: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)',
  };

  // Apply theme to body
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.style.backgroundColor = theme.bg;
      document.body.style.color = theme.text;
      document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    }
  }, [theme.bg, theme.text]);

  const value = {
    darkMode,
    toggleDarkMode,
    setDarkMode,
    theme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}