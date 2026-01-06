'use client';

import React from 'react';

interface LoadingStateProps {
  message?: string;
  variant?: 'spinner' | 'skeleton' | 'dots' | 'pulse';
  size?: 'small' | 'medium' | 'large';
  fullPage?: boolean;
}

/**
 * Unified Loading State Component
 * Consistent loading indicators across the application
 */
export function LoadingState({
  message,
  variant = 'spinner',
  size = 'medium',
  fullPage = false,
}: LoadingStateProps) {
  const sizes = {
    small: { spinner: 24, text: 12 },
    medium: { spinner: 40, text: 14 },
    large: { spinner: 64, text: 16 },
  };

  const currentSize = sizes[size];

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: fullPage ? '0' : '40px 20px',
    minHeight: fullPage ? '60vh' : 'auto',
  };

  const spinnerStyle: React.CSSProperties = {
    width: currentSize.spinner,
    height: currentSize.spinner,
    border: `3px solid #E5E5E5`,
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  const messageStyle: React.CSSProperties = {
    marginTop: '16px',
    fontSize: currentSize.text,
    color: '#6B7280',
    textAlign: 'center',
  };

  // Inject keyframes
  React.useEffect(() => {
    const styleId = 'loading-state-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes dots {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  if (variant === 'spinner') {
    return (
      <div style={containerStyle}>
        <div style={spinnerStyle} />
        {message && <p style={messageStyle}>{message}</p>}
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: currentSize.spinner / 4,
                height: currentSize.spinner / 4,
                backgroundColor: '#2563EB',
                borderRadius: '50%',
                animation: `dots 1.4s infinite ease-in-out both`,
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </div>
        {message && <p style={messageStyle}>{message}</p>}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div style={containerStyle}>
        <div
          style={{
            width: currentSize.spinner,
            height: currentSize.spinner,
            backgroundColor: '#2563EB',
            borderRadius: '50%',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
        {message && <p style={messageStyle}>{message}</p>}
      </div>
    );
  }

  // Skeleton variant
  return (
    <div style={{ ...containerStyle, alignItems: 'stretch' }}>
      <SkeletonCard />
      {message && <p style={{ ...messageStyle, marginTop: '24px' }}>{message}</p>}
    </div>
  );
}

/**
 * Skeleton Card for content placeholders
 */
export function SkeletonCard() {
  const shimmerStyle: React.CSSProperties = {
    background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  };

  React.useEffect(() => {
    const styleId = 'skeleton-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <div style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E5E5' }}>
      <div style={{ ...shimmerStyle, height: '20px', width: '60%', borderRadius: '4px', marginBottom: '12px' }} />
      <div style={{ ...shimmerStyle, height: '14px', width: '100%', borderRadius: '4px', marginBottom: '8px' }} />
      <div style={{ ...shimmerStyle, height: '14px', width: '90%', borderRadius: '4px', marginBottom: '8px' }} />
      <div style={{ ...shimmerStyle, height: '14px', width: '75%', borderRadius: '4px' }} />
    </div>
  );
}

/**
 * Skeleton List for multiple items
 */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/**
 * Full page loading overlay
 */
export function PageLoading({ message = 'Chargement...' }: { message?: string }) {
  return (
    <LoadingState
      variant="spinner"
      size="large"
      fullPage
      message={message}
    />
  );
}

export default LoadingState;
