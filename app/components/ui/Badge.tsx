"use client";

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

type BadgeVariant =
  | 'default'
  | 'breaking'
  | 'live'
  | 'ai'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'category';

type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  category?: string;
  dot?: boolean;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function Badge({
  variant = 'default',
  size = 'md',
  category,
  dot = false,
  pulse = false,
  children,
  className = '',
  style = {},
}: BadgeProps) {
  const { theme, darkMode } = useTheme();

  // Size styles
  const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
    sm: {
      padding: '2px 6px',
      fontSize: '10px',
      gap: '3px',
    },
    md: {
      padding: '4px 10px',
      fontSize: '12px',
      gap: '4px',
    },
    lg: {
      padding: '6px 14px',
      fontSize: '14px',
      gap: '6px',
    },
  };

  // Get category color
  const getCategoryColorValue = (cat: string): string => {
    const key = cat.toUpperCase() as keyof typeof colors.category;
    return colors.category[key] || theme.textSecondary;
  };

  // Variant styles
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'breaking':
        return {
          background: theme.brand.primary,
          color: '#FFFFFF',
          boxShadow: darkMode ? '0 0 10px rgba(220, 38, 38, 0.4)' : 'none',
        };
      case 'live':
        return {
          background: theme.brand.primary,
          color: '#FFFFFF',
        };
      case 'ai':
        return {
          background: theme.brand.secondary,
          color: '#FFFFFF',
        };
      case 'success':
        return {
          background: theme.successBg,
          color: theme.success,
        };
      case 'warning':
        return {
          background: theme.warningBg,
          color: theme.warning,
        };
      case 'error':
        return {
          background: theme.errorBg,
          color: theme.error,
        };
      case 'info':
        return {
          background: theme.infoBg,
          color: theme.info,
        };
      case 'category':
        const catColor = category ? getCategoryColorValue(category) : theme.textSecondary;
        return {
          background: `${catColor}15`,
          color: catColor,
          border: `1px solid ${catColor}30`,
        };
      case 'default':
      default:
        return {
          background: theme.bgTertiary,
          color: theme.textSecondary,
        };
    }
  };

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '6px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
    ...getVariantStyles(),
    ...style,
  };

  // Add pulse animation for live badge
  const animationClass = variant === 'live' || pulse ? 'animate-live-pulse' : '';

  return (
    <span className={`${animationClass} ${className}`} style={baseStyle}>
      {dot && (
        <span
          style={{
            width: size === 'sm' ? 4 : size === 'lg' ? 8 : 6,
            height: size === 'sm' ? 4 : size === 'lg' ? 8 : 6,
            borderRadius: '50%',
            background: 'currentColor',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

// ============================================================================
// LIVE BADGE (Pre-configured)
// ============================================================================

interface LiveBadgeProps {
  size?: BadgeSize;
  className?: string;
}

export function LiveBadge({ size = 'md', className = '' }: LiveBadgeProps) {
  return (
    <Badge variant="live" size={size} dot pulse className={className}>
      EN DIRECT
    </Badge>
  );
}

// ============================================================================
// BREAKING BADGE (Pre-configured)
// ============================================================================

interface BreakingBadgeProps {
  size?: BadgeSize;
  className?: string;
}

export function BreakingBadge({ size = 'md', className = '' }: BreakingBadgeProps) {
  return (
    <Badge variant="breaking" size={size} className={className}>
      BREAKING
    </Badge>
  );
}

// ============================================================================
// AI BADGE (Pre-configured)
// ============================================================================

interface AIBadgeProps {
  size?: BadgeSize;
  className?: string;
}

export function AIBadge({ size = 'md', className = '' }: AIBadgeProps) {
  return (
    <Badge variant="ai" size={size} className={className}>
      AI
    </Badge>
  );
}

// ============================================================================
// CATEGORY BADGE (Pre-configured)
// ============================================================================

interface CategoryBadgeProps {
  category: string;
  size?: BadgeSize;
  className?: string;
}

export function CategoryBadge({ category, size = 'md', className = '' }: CategoryBadgeProps) {
  return (
    <Badge variant="category" category={category} size={size} className={className}>
      {category}
    </Badge>
  );
}

// ============================================================================
// COUNT BADGE (For notifications)
// ============================================================================

interface CountBadgeProps {
  count: number;
  max?: number;
  size?: BadgeSize;
  variant?: 'primary' | 'secondary' | 'error';
  className?: string;
}

export function CountBadge({
  count,
  max = 99,
  size = 'sm',
  variant = 'primary',
  className = '',
}: CountBadgeProps) {
  const { theme } = useTheme();

  const displayCount = count > max ? `${max}+` : count.toString();

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { background: theme.brand.primary, color: '#FFFFFF' },
    secondary: { background: theme.brand.secondary, color: '#FFFFFF' },
    error: { background: theme.error, color: '#FFFFFF' },
  };

  const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
    sm: { minWidth: 16, height: 16, fontSize: 10, padding: '0 4px' },
    md: { minWidth: 20, height: 20, fontSize: 11, padding: '0 6px' },
    lg: { minWidth: 24, height: 24, fontSize: 12, padding: '0 8px' },
  };

  if (count <= 0) return null;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '9999px',
        fontWeight: 700,
        ...sizeStyles[size],
        ...variantStyles[variant],
      }}
    >
      {displayCount}
    </span>
  );
}

export default Badge;
