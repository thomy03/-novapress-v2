'use client';

import React from 'react';
import { useTheme } from '@/app/contexts/ThemeContext';
import { useCountUp } from '@/app/hooks/useCountUp';

/**
 * UI-003b: AnimatedCounter Component
 * Compteur animé avec count-up effect et formatage
 */

// UI-003c: Formatage nombres (K, M, B)
export function formatNumber(value: number, compact = false): string {
  if (!compact) {
    return value.toLocaleString('fr-FR');
  }

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
}

interface AnimatedCounterProps {
  /** Valeur finale à atteindre */
  value: number;
  /** Durée de l'animation en ms */
  duration?: number;
  /** Préfixe (ex: "+") */
  prefix?: string;
  /** Suffixe (ex: " sources") */
  suffix?: string;
  /** Format compact (K, M, B) */
  compact?: boolean;
  /** Nombre de décimales */
  decimals?: number;
  /** Taille du texte */
  size?: 'small' | 'medium' | 'large';
  /** Couleur personnalisée */
  color?: string;
  /** Délai avant animation (ms) */
  delay?: number;
  /** Label pour accessibilité */
  label?: string;
}

export function AnimatedCounter({
  value,
  duration = 2000,
  prefix = '',
  suffix = '',
  compact = false,
  decimals = 0,
  size = 'medium',
  color,
  delay = 0,
  label,
}: AnimatedCounterProps) {
  const { theme } = useTheme();

  const { value: animatedValue, ref, isComplete } = useCountUp({
    end: value,
    duration,
    decimals,
    delay,
    enableScrollTrigger: true,
    threshold: 0.3,
  });

  // Format the displayed value
  const displayValue = compact
    ? formatNumber(Math.round(animatedValue), true)
    : animatedValue.toLocaleString('fr-FR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  // Size styles
  const sizeStyles: Record<string, React.CSSProperties> = {
    small: { fontSize: '24px', fontWeight: 600 },
    medium: { fontSize: '36px', fontWeight: 700 },
    large: { fontSize: '48px', fontWeight: 800 },
  };

  return (
    <span
      ref={ref as React.RefObject<HTMLSpanElement>}
      role="status"
      aria-label={label || `${prefix}${value}${suffix}`}
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '4px',
        color: color || theme.text,
        fontFamily: '"Inter", -apple-system, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        ...sizeStyles[size],
      }}
    >
      {prefix && (
        <span style={{ fontSize: '0.7em', opacity: 0.7 }}>{prefix}</span>
      )}
      <span
        style={{
          transition: 'transform 0.1s ease',
          transform: isComplete ? 'scale(1)' : 'scale(1.02)',
        }}
      >
        {displayValue}
      </span>
      {suffix && (
        <span
          style={{
            fontSize: '0.5em',
            fontWeight: 400,
            color: theme.textSecondary,
            marginLeft: '4px',
          }}
        >
          {suffix}
        </span>
      )}
    </span>
  );
}

/**
 * StatCard: Carte de statistique avec AnimatedCounter et icône
 */
interface StatCardProps {
  value: number;
  label: string;
  icon?: string;
  trend?: number; // Pourcentage de changement
  trendLabel?: string;
  compact?: boolean;
  delay?: number;
}

export function StatCard({
  value,
  label,
  icon,
  trend,
  trendLabel,
  compact = false,
  delay = 0,
}: StatCardProps) {
  const { theme } = useTheme();

  const trendColor = trend && trend > 0 ? '#10B981' : trend && trend < 0 ? '#EF4444' : theme.textSecondary;
  const trendPrefix = trend && trend > 0 ? '+' : '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '20px',
        backgroundColor: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: '12px',
      }}
    >
      {/* Icon */}
      {icon && (
        <span style={{ fontSize: '24px', marginBottom: '4px' }}>{icon}</span>
      )}

      {/* Value */}
      <AnimatedCounter
        value={value}
        compact={compact}
        size="medium"
        delay={delay}
        label={`${value} ${label}`}
      />

      {/* Label */}
      <span
        style={{
          fontSize: '13px',
          color: theme.textSecondary,
          fontWeight: 500,
        }}
      >
        {label}
      </span>

      {/* Trend */}
      {trend !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: trendColor,
            fontWeight: 500,
          }}
        >
          <span>{trendPrefix}{trend}%</span>
          {trendLabel && (
            <span style={{ color: theme.textSecondary }}>{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default AnimatedCounter;
