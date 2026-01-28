'use client';

/**
 * MiniNovaLine - Sparkline version of the tension narrative visualization
 * Shows a compact sparkline with tension score for use in Hero section
 * Newspaper style: black line, simple presentation
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useNovaLineData } from './useNovaLineData';
import {
  NovaLinePoint,
} from '@/app/types/novaline';
import { useTheme } from '@/app/contexts/ThemeContext';

interface MiniNovaLineProps {
  synthesisId: string;
  category: string;
  height?: number;
  showLabel?: boolean;
}

export function MiniNovaLine({
  synthesisId,
  category,
  height = 40,
  showLabel = true,
}: MiniNovaLineProps) {
  const { theme } = useTheme();
  const { data, isLoading, error } = useNovaLineData(synthesisId, category);

  // Prepare chart data from NovaLine points
  const chartData = useMemo(() => {
    if (!data?.points || data.points.length === 0) {
      // Generate mock data for visual placeholder
      return [
        { x: 0, tension: 30 },
        { x: 1, tension: 45 },
        { x: 2, tension: 55 },
        { x: 3, tension: 70 },
        { x: 4, tension: 65 },
      ];
    }

    return data.points.map((point: NovaLinePoint, index: number) => ({
      x: index,
      tension: point.tension,
      phase: point.phase,
    }));
  }, [data]);

  // Get current tension (last point or calculated)
  const currentTension = useMemo(() => {
    if (!data?.points || data.points.length === 0) {
      return 50; // Default
    }
    const lastPoint = data.points[data.points.length - 1];
    return lastPoint.tension;
  }, [data]);

  // Get days tracked
  const daysTracked = data?.daysTracked || 0;

  // Track container readiness to prevent Recharts -1 error
  const [isContainerReady, setIsContainerReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setIsContainerReady(true);
    }
  }, []);

  if (error) {
    return null; // Silently hide on error
  }

  // Don't show if no real data
  if (!data?.points || data.points.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 16px',
        backgroundColor: '#F9FAFB',
        border: `1px solid ${theme.border}`,
      }}
    >
      {/* Label */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          minWidth: '100px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#6B7280',
          }}
        >
          Historique
        </span>
        <span
          style={{
            fontSize: '11px',
            color: '#9CA3AF',
          }}
        >
          {daysTracked} jour{daysTracked > 1 ? 's' : ''} de suivi
        </span>
      </div>

      {/* Sparkline - with explicit dimensions to prevent Recharts -1 error */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          height: `${height}px`,
          minHeight: `${height}px`,
          minWidth: 100,
          opacity: isLoading ? 0.5 : 1,
          transition: 'opacity 0.3s ease',
        }}
      >
        {isContainerReady && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="tension"
                stroke="#000000"
                strokeWidth={2}
                dot={false}
                isAnimationActive={!isLoading}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Score indicator */}
      {showLabel && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            minWidth: '50px',
          }}
        >
          <span
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#000000',
              fontFamily: 'Georgia, serif',
              lineHeight: 1,
            }}
          >
            {currentTension}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 500,
              color: '#6B7280',
            }}
          >
            /100
          </span>
        </div>
      )}
    </div>
  );
}

export default MiniNovaLine;
