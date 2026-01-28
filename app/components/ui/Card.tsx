"use client";

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// ============================================================================
// TYPES
// ============================================================================

type CardVariant = 'default' | 'elevated' | 'glass' | 'outlined' | 'ghost';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function Card({
  variant = 'default',
  padding = 'md',
  interactive = false,
  onClick,
  className = '',
  style = {},
  children,
}: CardProps) {
  const { theme, darkMode, getGlass } = useTheme();

  // Padding styles
  const paddingStyles: Record<CardPadding, React.CSSProperties> = {
    none: { padding: 0 },
    sm: { padding: 12 },
    md: { padding: 20 },
    lg: { padding: 28 },
  };

  // Variant styles
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'default':
        return {
          background: theme.card,
          border: `1px solid ${theme.border}`,
          boxShadow: darkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
        };
      case 'elevated':
        return {
          background: theme.card,
          border: 'none',
          boxShadow: darkMode
            ? '0 4px 20px rgba(0,0,0,0.4)'
            : '0 4px 20px rgba(0,0,0,0.08)',
        };
      case 'glass':
        return getGlass();
      case 'outlined':
        return {
          background: 'transparent',
          border: `1px solid ${theme.border}`,
        };
      case 'ghost':
        return {
          background: 'transparent',
          border: 'none',
        };
      default:
        return {};
    }
  };

  const baseStyle: React.CSSProperties = {
    borderRadius: '12px',
    overflow: 'hidden',
    transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: interactive || onClick ? 'pointer' : 'default',
    ...paddingStyles[padding],
    ...getVariantStyles(),
    ...style,
  };

  const interactiveClass = interactive ? 'card-interactive' : '';

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={`${interactiveClass} ${className}`}
      style={baseStyle}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      {children}
    </Component>
  );
}

// ============================================================================
// CARD HEADER
// ============================================================================

interface CardHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = '',
  style = {},
}: CardHeaderProps) {
  const { theme } = useTheme();

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 16,
        ...style,
      }}
    >
      <div>
        {title && (
          <h3
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: theme.text,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {title}
          </h3>
        )}
        {subtitle && (
          <p
            style={{
              fontSize: 14,
              color: theme.textSecondary,
              margin: 0,
              marginTop: 4,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

// ============================================================================
// CARD BODY
// ============================================================================

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function CardBody({ children, className = '', style = {} }: CardBodyProps) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

// ============================================================================
// CARD FOOTER
// ============================================================================

interface CardFooterProps {
  children: React.ReactNode;
  separator?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function CardFooter({
  children,
  separator = true,
  className = '',
  style = {},
}: CardFooterProps) {
  const { theme } = useTheme();

  return (
    <div
      className={className}
      style={{
        marginTop: 16,
        paddingTop: separator ? 16 : 0,
        borderTop: separator ? `1px solid ${theme.border}` : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// CARD IMAGE
// ============================================================================

interface CardImageProps {
  src: string;
  alt: string;
  height?: number | string;
  overlay?: React.ReactNode;
  zoom?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function CardImage({
  src,
  alt,
  height = 200,
  overlay,
  zoom = true,
  className = '',
  style = {},
}: CardImageProps) {
  const { darkMode } = useTheme();

  return (
    <div
      className={`${zoom ? 'img-zoom' : ''} ${className}`}
      style={{
        position: 'relative',
        height,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {overlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: darkMode
              ? 'linear-gradient(transparent 50%, rgba(0,0,0,0.8))'
              : 'linear-gradient(transparent 50%, rgba(0,0,0,0.6))',
            display: 'flex',
            alignItems: 'flex-end',
            padding: 16,
          }}
        >
          {overlay}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// GLASS CARD (Pre-configured)
// ============================================================================

interface GlassCardProps {
  children: React.ReactNode;
  padding?: CardPadding;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function GlassCard({
  children,
  padding = 'md',
  interactive = false,
  onClick,
  className = '',
  style = {},
}: GlassCardProps) {
  return (
    <Card
      variant="glass"
      padding={padding}
      interactive={interactive}
      onClick={onClick}
      className={className}
      style={style}
    >
      {children}
    </Card>
  );
}

// ============================================================================
// STAT CARD (For Bento grid stats)
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, change, icon, className = '' }: StatCardProps) {
  const { theme } = useTheme();

  const changeColor = change
    ? change.type === 'increase'
      ? theme.success
      : change.type === 'decrease'
      ? theme.error
      : theme.textSecondary
    : theme.textSecondary;

  return (
    <Card variant="default" padding="md" className={className}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p
            style={{
              fontSize: 14,
              color: theme.textSecondary,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 500,
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: theme.text,
              lineHeight: 1,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {value}
          </p>
          {change && (
            <p
              style={{
                fontSize: 14,
                color: changeColor,
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {change.type === 'increase' ? '↑' : change.type === 'decrease' ? '↓' : '→'}
              {Math.abs(change.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: theme.bgTertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.brand.secondary,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export default Card;
