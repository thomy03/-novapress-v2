'use client';

import React from 'react';
import { useNovaLineData } from './useNovaLineData';
import { NovaLineHorizontal } from './NovaLineHorizontal';
import { NovaLineVertical } from './NovaLineVertical';
import { NovaLinePoint, NOVALINE_THEME } from '@/app/types/novaline';

interface NovaLineProps {
  synthesisId: string;
  category: string;
  height?: number;
  showPredictions?: boolean;
  onPointClick?: (point: NovaLinePoint) => void;
}

/**
 * NovaLine v3 - The Electrocardiogram of News
 * Responsive component that shows horizontal (desktop) or vertical (mobile) view
 */
export function NovaLine({
  synthesisId,
  category,
  height = 280,
  showPredictions = true,
  onPointClick,
}: NovaLineProps) {
  const { data, isLoading, error } = useNovaLineData(synthesisId, category);
  const [isMobile, setIsMobile] = React.useState(false);

  // Detect mobile on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: NOVALINE_THEME.background,
          borderRadius: '4px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: isMobile ? '200px' : `${height}px`,
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            border: `2px solid ${NOVALINE_THEME.grid}`,
            borderTopColor: NOVALINE_THEME.pointPresent,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: NOVALINE_THEME.textSecondary,
          }}
        >
          Chargement du fil narratif...
        </span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          backgroundColor: NOVALINE_THEME.background,
          borderRadius: '4px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            color: NOVALINE_THEME.textSecondary,
          }}
        >
          Impossible de charger le fil narratif
        </span>
      </div>
    );
  }

  // No data state - return null (hide component entirely)
  if (!data || data.points.length === 0) {
    return null;
  }

  // If only 1 point, not enough data to show a meaningful graph
  if (data.points.length === 1) {
    return null;
  }

  // Render appropriate version based on screen size
  return isMobile ? (
    <NovaLineVertical data={data} onPointClick={onPointClick} />
  ) : (
    <NovaLineHorizontal
      data={data}
      height={height}
      showPredictions={showPredictions}
      onPointClick={onPointClick}
    />
  );
}

export default NovaLine;
