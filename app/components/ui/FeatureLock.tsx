'use client';

/**
 * FeatureLock — Wrapper qui superpose un badge "PRO" sur les features gated.
 * Style newspaper strict: pas de gradients, inline styles uniquement.
 */

import React from 'react';

interface FeatureLockProps {
  children: React.ReactNode;
  isLocked: boolean;
  featureName?: string;
  onUpgrade: () => void;
}

export function FeatureLock({
  children,
  isLocked,
  featureName,
  onUpgrade,
}: FeatureLockProps) {
  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'block',
      }}
    >
      {/* Contenu flouté */}
      <div
        style={{
          filter: 'blur(3px)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Overlay semi-transparent + badge centré */}
      <div
        onClick={onUpgrade}
        role="button"
        tabIndex={0}
        aria-label={featureName ? `Debloquer ${featureName} avec PRO` : 'Debloquer avec PRO'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onUpgrade();
          }
        }}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255,255,255,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* Badge PRO */}
        <span
          style={{
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.05em',
            padding: '4px 10px',
            fontFamily: 'Arial, sans-serif',
            textTransform: 'uppercase',
            borderRadius: '2px',
          }}
        >
          PRO
        </span>

        {featureName && (
          <span
            style={{
              fontSize: '12px',
              color: '#000000',
              fontFamily: 'Arial, sans-serif',
              fontWeight: '500',
            }}
          >
            {featureName}
          </span>
        )}
      </div>
    </div>
  );
}

export default FeatureLock;
