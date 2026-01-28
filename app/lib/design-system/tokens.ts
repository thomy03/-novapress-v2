/**
 * NovaPress AI v2 - Design System Tokens
 * Tendances 2025-2026: Dark Mode, Glassmorphism, Bento Grid
 */

// ============================================================================
// COLOR TOKENS
// ============================================================================

export const colors = {
  // Brand colors
  brand: {
    primary: '#DC2626',      // Breaking news red
    secondary: '#2563EB',    // Logo AI blue
    accent: '#7C3AED',       // Accent purple (admin, special)
    emerald: '#10B981',      // Success, positive
    amber: '#F59E0B',        // Warning, developing
  },

  // Light mode
  light: {
    bg: '#FFFFFF',
    bgSecondary: '#FAFAFA',
    bgTertiary: '#F5F5F5',
    text: '#0A0A0A',
    textSecondary: '#525252',
    textTertiary: '#737373',
    border: '#E5E5E5',
    borderStrong: '#D4D4D4',
    hover: '#F5F5F5',
    card: '#FFFFFF',
    shadow: 'rgba(0, 0, 0, 0.08)',
    shadowStrong: 'rgba(0, 0, 0, 0.15)',
  },

  // Dark mode (Bloomberg/Verge style)
  dark: {
    bg: '#0A0A0A',
    bgSecondary: '#141414',
    bgTertiary: '#1F1F1F',
    text: '#FAFAFA',
    textSecondary: '#A3A3A3',
    textTertiary: '#737373',
    border: '#262626',
    borderStrong: '#404040',
    hover: '#1F1F1F',
    card: '#141414',
    shadow: 'rgba(0, 0, 0, 0.4)',
    shadowStrong: 'rgba(0, 0, 0, 0.6)',
  },

  // Glassmorphism
  glass: {
    light: 'rgba(255, 255, 255, 0.7)',
    lightSubtle: 'rgba(255, 255, 255, 0.4)',
    dark: 'rgba(10, 10, 10, 0.7)',
    darkSubtle: 'rgba(10, 10, 10, 0.4)',
    border: 'rgba(255, 255, 255, 0.18)',
    borderDark: 'rgba(255, 255, 255, 0.08)',
  },

  // Semantic colors
  semantic: {
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.1)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.1)',
    error: '#EF4444',
    errorBg: 'rgba(239, 68, 68, 0.1)',
    info: '#3B82F6',
    infoBg: 'rgba(59, 130, 246, 0.1)',
  },

  // Category colors
  category: {
    MONDE: '#3B82F6',
    TECH: '#8B5CF6',
    ECONOMIE: '#10B981',
    POLITIQUE: '#EF4444',
    CULTURE: '#F59E0B',
    SPORT: '#06B6D4',
    SCIENCES: '#EC4899',
    BREAKING: '#DC2626',
  },
} as const;

// ============================================================================
// TYPOGRAPHY TOKENS
// ============================================================================

export const typography = {
  // Font families (Google Fonts)
  fonts: {
    serif: '"Fraunces", Georgia, "Times New Roman", serif',
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", Consolas, monospace',
  },

  // Font sizes (rem)
  sizes: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
    '6xl': '3.75rem',  // 60px
    '7xl': '4.5rem',   // 72px
  },

  // Line heights
  lineHeights: {
    none: 1,
    tight: 1.15,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  // Font weights
  weights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },

  // Letter spacing
  tracking: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// ============================================================================
// SPACING TOKENS
// ============================================================================

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  11: '2.75rem',     // 44px
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
  28: '7rem',        // 112px
  32: '8rem',        // 128px
} as const;

// ============================================================================
// EFFECTS TOKENS
// ============================================================================

export const effects = {
  // Border radius
  radius: {
    none: '0',
    sm: '0.25rem',    // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px',
  },

  // Box shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
    none: 'none',
  },

  // Dark mode shadows (with glow)
  shadowsDark: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -4px rgba(0, 0, 0, 0.5)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.6)',
    glow: {
      brand: '0 0 20px rgba(220, 38, 38, 0.3)',
      accent: '0 0 20px rgba(37, 99, 235, 0.3)',
      purple: '0 0 20px rgba(124, 58, 237, 0.3)',
    },
  },

  // Glassmorphism
  blur: {
    sm: 'blur(4px)',
    md: 'blur(8px)',
    lg: 'blur(12px)',
    xl: 'blur(16px)',
    '2xl': 'blur(20px)',
    '3xl': 'blur(24px)',
  },

  // Transitions
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slower: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: '500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

// ============================================================================
// BREAKPOINTS
// ============================================================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ============================================================================
// Z-INDEX SCALE
// ============================================================================

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  max: 9999,
} as const;

// ============================================================================
// ANIMATION KEYFRAMES (for CSS-in-JS)
// ============================================================================

export const keyframes = {
  fadeIn: {
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  fadeOut: {
    from: { opacity: 1, transform: 'translateY(0)' },
    to: { opacity: 0, transform: 'translateY(10px)' },
  },
  slideInRight: {
    from: { opacity: 0, transform: 'translateX(20px)' },
    to: { opacity: 1, transform: 'translateX(0)' },
  },
  slideInLeft: {
    from: { opacity: 0, transform: 'translateX(-20px)' },
    to: { opacity: 1, transform: 'translateX(0)' },
  },
  scaleIn: {
    from: { opacity: 0, transform: 'scale(0.95)' },
    to: { opacity: 1, transform: 'scale(1)' },
  },
  shimmer: {
    from: { backgroundPosition: '-1000px 0' },
    to: { backgroundPosition: '1000px 0' },
  },
  livePulse: {
    '0%, 100%': { boxShadow: '0 0 0 0 rgba(220, 38, 38, 0.7)' },
    '50%': { boxShadow: '0 0 0 8px rgba(220, 38, 38, 0)' },
  },
  titleReveal: {
    from: { opacity: 0, transform: 'translateY(30px)', filter: 'blur(10px)' },
    to: { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
  },
} as const;

// ============================================================================
// BENTO GRID CONFIGURATIONS
// ============================================================================

export const bentoGrid = {
  // Column spans
  spans: {
    '1x1': { gridColumn: 'span 1', gridRow: 'span 1' },
    '2x1': { gridColumn: 'span 2', gridRow: 'span 1' },
    '1x2': { gridColumn: 'span 1', gridRow: 'span 2' },
    '2x2': { gridColumn: 'span 2', gridRow: 'span 2' },
    '3x1': { gridColumn: 'span 3', gridRow: 'span 1' },
    '3x2': { gridColumn: 'span 3', gridRow: 'span 2' },
  },

  // Grid gap
  gap: spacing[4],

  // Min column width
  minColumnWidth: '280px',
} as const;

// ============================================================================
// COMPONENT VARIANTS
// ============================================================================

export const componentVariants = {
  button: {
    primary: {
      bg: colors.brand.primary,
      text: '#FFFFFF',
      hover: '#B91C1C',
      border: 'transparent',
    },
    secondary: {
      bg: colors.brand.secondary,
      text: '#FFFFFF',
      hover: '#1D4ED8',
      border: 'transparent',
    },
    ghost: {
      bg: 'transparent',
      text: 'inherit',
      hover: colors.light.hover,
      border: 'transparent',
    },
    outline: {
      bg: 'transparent',
      text: 'inherit',
      hover: colors.light.hover,
      border: colors.light.border,
    },
    danger: {
      bg: colors.semantic.error,
      text: '#FFFFFF',
      hover: '#DC2626',
      border: 'transparent',
    },
  },

  badge: {
    default: {
      bg: colors.light.bgTertiary,
      text: colors.light.textSecondary,
    },
    breaking: {
      bg: colors.brand.primary,
      text: '#FFFFFF',
    },
    live: {
      bg: colors.brand.primary,
      text: '#FFFFFF',
    },
    ai: {
      bg: colors.brand.secondary,
      text: '#FFFFFF',
    },
    success: {
      bg: colors.semantic.successBg,
      text: colors.semantic.success,
    },
    warning: {
      bg: colors.semantic.warningBg,
      text: colors.semantic.warning,
    },
    error: {
      bg: colors.semantic.errorBg,
      text: colors.semantic.error,
    },
  },

  card: {
    default: {
      bg: colors.light.card,
      border: colors.light.border,
      shadow: effects.shadows.sm,
    },
    elevated: {
      bg: colors.light.card,
      border: 'transparent',
      shadow: effects.shadows.lg,
    },
    glass: {
      bg: colors.glass.light,
      border: colors.glass.border,
      shadow: effects.shadows.lg,
      backdrop: effects.blur['2xl'],
    },
    featured: {
      bg: 'transparent',
      border: 'transparent',
      shadow: 'none',
    },
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get theme-aware color
 */
export function getThemeColor(darkMode: boolean, lightColor: string, darkColor: string): string {
  return darkMode ? darkColor : lightColor;
}

/**
 * Get glassmorphism styles
 */
export function getGlassStyles(darkMode: boolean, intensity: 'subtle' | 'normal' = 'normal') {
  const bgKey = intensity === 'subtle'
    ? (darkMode ? 'darkSubtle' : 'lightSubtle')
    : (darkMode ? 'dark' : 'light');

  return {
    background: colors.glass[bgKey],
    backdropFilter: effects.blur['2xl'],
    WebkitBackdropFilter: effects.blur['2xl'],
    border: `1px solid ${darkMode ? colors.glass.borderDark : colors.glass.border}`,
  };
}

/**
 * Get category color
 */
export function getCategoryColor(category: string): string {
  const key = category.toUpperCase() as keyof typeof colors.category;
  return colors.category[key] || colors.light.textSecondary;
}

// ============================================================================
// THEME TYPE EXPORT
// ============================================================================

export type ThemeColors = typeof colors.light;
export type ThemeMode = 'light' | 'dark';
