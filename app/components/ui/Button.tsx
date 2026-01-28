"use client";

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// ============================================================================
// TYPES
// ============================================================================

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'breaking';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const { theme, darkMode } = useTheme();

  // Size styles
  const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
    sm: {
      padding: '6px 12px',
      fontSize: '12px',
      minHeight: '32px',
    },
    md: {
      padding: '10px 20px',
      fontSize: '14px',
      minHeight: '40px',
    },
    lg: {
      padding: '14px 28px',
      fontSize: '16px',
      minHeight: '48px',
    },
  };

  // Variant styles
  const getVariantStyles = (): React.CSSProperties => {
    const baseTransition = 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)';

    switch (variant) {
      case 'primary':
        return {
          background: theme.brand.primary,
          color: '#FFFFFF',
          border: 'none',
          transition: baseTransition,
        };
      case 'secondary':
        return {
          background: theme.brand.secondary,
          color: '#FFFFFF',
          border: 'none',
          transition: baseTransition,
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: theme.text,
          border: 'none',
          transition: baseTransition,
        };
      case 'outline':
        return {
          background: 'transparent',
          color: theme.text,
          border: `1px solid ${theme.border}`,
          transition: baseTransition,
        };
      case 'danger':
        return {
          background: theme.error,
          color: '#FFFFFF',
          border: 'none',
          transition: baseTransition,
        };
      case 'breaking':
        return {
          background: theme.brand.primary,
          color: '#FFFFFF',
          border: 'none',
          boxShadow: darkMode ? '0 0 20px rgba(220, 38, 38, 0.4)' : '0 0 10px rgba(220, 38, 38, 0.3)',
          transition: baseTransition,
        };
      default:
        return {};
    }
  };

  // Hover class based on variant
  const getHoverClass = (): string => {
    switch (variant) {
      case 'primary':
      case 'breaking':
        return 'btn-hover-danger';
      case 'secondary':
        return 'btn-hover-primary';
      case 'ghost':
      case 'outline':
        return 'btn-hover-bg';
      case 'danger':
        return 'btn-hover-danger';
      default:
        return '';
    }
  };

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: '8px',
    fontWeight: 500,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? '100%' : 'auto',
    fontFamily: 'inherit',
    outline: 'none',
    ...sizeStyles[size],
    ...getVariantStyles(),
  };

  return (
    <button
      className={`${getHoverClass()} ${className}`}
      style={baseStyle}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <LoadingSpinner size={size} />
      ) : (
        <>
          {leftIcon && <span style={{ display: 'flex', alignItems: 'center' }}>{leftIcon}</span>}
          {children}
          {rightIcon && <span style={{ display: 'flex', alignItems: 'center' }}>{rightIcon}</span>}
        </>
      )}
    </button>
  );
}

// ============================================================================
// LOADING SPINNER
// ============================================================================

function LoadingSpinner({ size }: { size: ButtonSize }) {
  const spinnerSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;

  return (
    <svg
      width={spinnerSize}
      height={spinnerSize}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============================================================================
// ICON BUTTON VARIANT
// ============================================================================

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'ghost' | 'outline' | 'primary';
  size?: ButtonSize;
  label: string; // For accessibility
}

export function IconButton({
  icon,
  variant = 'ghost',
  size = 'md',
  label,
  className = '',
  ...props
}: IconButtonProps) {
  const { theme } = useTheme();

  const sizeMap: Record<ButtonSize, number> = {
    sm: 32,
    md: 40,
    lg: 48,
  };

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: theme.brand.primary,
          color: '#FFFFFF',
        };
      case 'outline':
        return {
          background: 'transparent',
          color: theme.text,
          border: `1px solid ${theme.border}`,
        };
      case 'ghost':
      default:
        return {
          background: 'transparent',
          color: theme.textSecondary,
        };
    }
  };

  const buttonSize = sizeMap[size];

  return (
    <button
      className={`icon-btn-hover ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: buttonSize,
        height: buttonSize,
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 150ms ease',
        ...getVariantStyles(),
      }}
      aria-label={label}
      {...props}
    >
      {icon}
    </button>
  );
}

export default Button;
