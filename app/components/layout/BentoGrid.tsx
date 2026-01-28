'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/app/contexts/ThemeContext';
import { BentoGridProps, BENTO_BREAKPOINTS, BENTO_COLUMNS_CONFIG } from '@/app/types/bento';

// SSR guard
const isBrowser = typeof window !== 'undefined';

/**
 * UI-002c: BentoGrid Container Component
 * Conteneur CSS Grid responsive pour cartes Bento
 * Responsive: 1 col mobile, 2 col tablet, 4 col desktop
 */
export function BentoGrid({
  children,
  gap = 16,
  columns = 4,
  style,
  className,
}: BentoGridProps) {
  const { theme } = useTheme();
  const [currentColumns, setCurrentColumns] = useState(columns);

  // Responsive columns based on viewport (browser only)
  useEffect(() => {
    if (!isBrowser) return;

    const handleResize = () => {
      const width = window.innerWidth;
      if (width < BENTO_BREAKPOINTS.sm) {
        setCurrentColumns(BENTO_COLUMNS_CONFIG.mobile);
      } else if (width < BENTO_BREAKPOINTS.lg) {
        setCurrentColumns(BENTO_COLUMNS_CONFIG.tablet);
      } else {
        setCurrentColumns(BENTO_COLUMNS_CONFIG.desktop);
      }
    };

    // Initial check
    handleResize();

    // Listen for resize
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const gridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${currentColumns}, 1fr)`,
    gridAutoRows: 'minmax(160px, auto)',
    gap: `${gap}px`,
    width: '100%',
    ...style,
  };

  return (
    <div
      className={className}
      style={gridStyles}
      role="list"
      aria-label="Grille de contenu"
    >
      {children}
    </div>
  );
}

/**
 * BentoGridSection: Section avec titre et grille Bento
 */
interface BentoGridSectionProps extends BentoGridProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function BentoGridSection({
  title,
  subtitle,
  action,
  children,
  ...gridProps
}: BentoGridSectionProps) {
  const { theme } = useTheme();

  return (
    <section style={{ marginBottom: '48px' }}>
      {/* Header */}
      {(title || subtitle || action) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <div>
            {title && (
              <h2
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  color: theme.textSecondary,
                  margin: 0,
                  marginBottom: subtitle ? '8px' : 0,
                }}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: theme.text,
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  margin: 0,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}

      {/* Grid */}
      <BentoGrid {...gridProps}>{children}</BentoGrid>
    </section>
  );
}

export default BentoGrid;
