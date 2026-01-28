"use client";

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { colors, typography, effects, getGlassStyles, getCategoryColor } from '../lib/design-system';

// ============================================================================
// THEME TYPES
// ============================================================================

interface ThemeColors {
  // Base colors
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderStrong: string;
  hover: string;
  card: string;
  shadow: string;
  shadowStrong: string;

  // Brand colors
  brand: {
    primary: string;
    secondary: string;
    accent: string;
    emerald: string;
    amber: string;
  };

  // Glassmorphism
  glass: {
    bg: string;
    bgSubtle: string;
    border: string;
  };

  // Semantic
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  info: string;
  infoBg: string;
}

interface ThemeTypography {
  fonts: {
    serif: string;
    sans: string;
    mono: string;
  };
  sizes: typeof typography.sizes;
  weights: typeof typography.weights;
  lineHeights: typeof typography.lineHeights;
}

interface ThemeEffects {
  radius: typeof effects.radius;
  shadows: typeof effects.shadows | typeof effects.shadowsDark;
  blur: typeof effects.blur;
  transitions: typeof effects.transitions;
}

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  theme: ThemeColors;
  typography: ThemeTypography;
  effects: ThemeEffects;
  getGlass: (intensity?: 'subtle' | 'normal') => React.CSSProperties;
  getCategoryColor: (category: string) => string;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Dark mode par defaut (style Bloomberg/The Verge)
  const [darkMode, setDarkModeStorage] = useLocalStorage('theme-dark-mode', true);

  const toggleDarkMode = useCallback(() => {
    setDarkModeStorage(!darkMode);
  }, [darkMode, setDarkModeStorage]);

  const setDarkMode = useCallback((isDark: boolean) => {
    setDarkModeStorage(isDark);
  }, [setDarkModeStorage]);

  // Theme colors memoized
  const theme: ThemeColors = useMemo(() => {
    const base = darkMode ? colors.dark : colors.light;

    return {
      ...base,
      brand: colors.brand,
      glass: {
        bg: darkMode ? colors.glass.dark : colors.glass.light,
        bgSubtle: darkMode ? colors.glass.darkSubtle : colors.glass.lightSubtle,
        border: darkMode ? colors.glass.borderDark : colors.glass.border,
      },
      success: colors.semantic.success,
      successBg: colors.semantic.successBg,
      warning: colors.semantic.warning,
      warningBg: colors.semantic.warningBg,
      error: colors.semantic.error,
      errorBg: colors.semantic.errorBg,
      info: colors.semantic.info,
      infoBg: colors.semantic.infoBg,
    };
  }, [darkMode]);

  // Typography config
  const typographyConfig: ThemeTypography = useMemo(() => ({
    fonts: typography.fonts,
    sizes: typography.sizes,
    weights: typography.weights,
    lineHeights: typography.lineHeights,
  }), []);

  // Effects config
  const effectsConfig: ThemeEffects = useMemo(() => ({
    radius: effects.radius,
    shadows: darkMode ? effects.shadowsDark : effects.shadows,
    blur: effects.blur,
    transitions: effects.transitions,
  }), [darkMode]);

  // Glass helper
  const getGlass = useCallback((intensity: 'subtle' | 'normal' = 'normal') => {
    return getGlassStyles(darkMode, intensity) as React.CSSProperties;
  }, [darkMode]);

  // Apply theme to document
  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;

      // Apply CSS custom properties
      root.style.setProperty('--bg', theme.bg);
      root.style.setProperty('--bg-secondary', theme.bgSecondary);
      root.style.setProperty('--bg-tertiary', theme.bgTertiary);
      root.style.setProperty('--text', theme.text);
      root.style.setProperty('--text-secondary', theme.textSecondary);
      root.style.setProperty('--border', theme.border);
      root.style.setProperty('--brand-primary', theme.brand.primary);
      root.style.setProperty('--brand-secondary', theme.brand.secondary);

      // Apply to body
      document.body.style.backgroundColor = theme.bg;
      document.body.style.color = theme.text;
      document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';

      // Toggle dark class for CSS selectors
      if (darkMode) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [theme, darkMode]);

  const value = useMemo(() => ({
    darkMode,
    toggleDarkMode,
    setDarkMode,
    theme,
    typography: typographyConfig,
    effects: effectsConfig,
    getGlass,
    getCategoryColor,
  }), [darkMode, toggleDarkMode, setDarkMode, theme, typographyConfig, effectsConfig, getGlass]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
