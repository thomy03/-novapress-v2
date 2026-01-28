'use client';

import React from 'react';
import { useTheme } from '@/app/contexts/ThemeContext';

/**
 * UI-005a: NarrativeArcIndicator Component
 * Badge visuel avec couleur et icône selon la phase narrative
 */

export type NarrativeArc = 'emerging' | 'developing' | 'peak' | 'declining' | 'resolved';

interface NarrativeArcConfig {
  label: string;
  labelFr: string;
  icon: string;
  color: string;
  bgLight: string;
  bgDark: string;
  description: string;
}

export const NARRATIVE_ARC_CONFIG: Record<NarrativeArc, NarrativeArcConfig> = {
  emerging: {
    label: 'Emerging',
    labelFr: 'Émergent',
    icon: '🌱',
    color: '#2563EB',
    bgLight: '#EFF6FF',
    bgDark: '#1E3A5F',
    description: 'Sujet récent, peu de couverture',
  },
  developing: {
    label: 'Developing',
    labelFr: 'En cours',
    icon: '📈',
    color: '#10B981',
    bgLight: '#D1FAE5',
    bgDark: '#064E3B',
    description: 'Sujet en croissance, attention médiatique',
  },
  peak: {
    label: 'Peak',
    labelFr: 'Pic',
    icon: '🔥',
    color: '#F59E0B',
    bgLight: '#FEF3C7',
    bgDark: '#78350F',
    description: 'Maximum de couverture médiatique',
  },
  declining: {
    label: 'Declining',
    labelFr: 'Déclin',
    icon: '📉',
    color: '#EF4444',
    bgLight: '#FEE2E2',
    bgDark: '#7F1D1D',
    description: 'Intérêt médiatique en baisse',
  },
  resolved: {
    label: 'Resolved',
    labelFr: 'Résolu',
    icon: '✓',
    color: '#6B7280',
    bgLight: '#F3F4F6',
    bgDark: '#374151',
    description: 'Sujet clos ou résolu',
  },
};

interface NarrativeArcIndicatorProps {
  /** Phase narrative du topic */
  arc: NarrativeArc;
  /** Afficher le label */
  showLabel?: boolean;
  /** Taille du badge */
  size?: 'small' | 'medium' | 'large';
  /** Afficher l'icône */
  showIcon?: boolean;
  /** Style personnalisé */
  style?: React.CSSProperties;
}

export function NarrativeArcIndicator({
  arc,
  showLabel = true,
  size = 'small',
  showIcon = true,
  style,
}: NarrativeArcIndicatorProps) {
  const { darkMode } = useTheme();
  const config = NARRATIVE_ARC_CONFIG[arc] || NARRATIVE_ARC_CONFIG.emerging;

  const sizeStyles: Record<string, React.CSSProperties> = {
    small: { padding: '2px 8px', fontSize: '10px' },
    medium: { padding: '4px 12px', fontSize: '12px' },
    large: { padding: '6px 16px', fontSize: '14px' },
  };

  return (
    <span
      title={config.description}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: darkMode ? config.bgDark : config.bgLight,
        color: config.color,
        borderRadius: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...sizeStyles[size],
        ...style,
      }}
    >
      {showIcon && <span>{config.icon}</span>}
      {showLabel && <span>{config.labelFr}</span>}
    </span>
  );
}

/**
 * NarrativeArcProgress: Barre de progression visuelle de l'arc
 */
interface NarrativeArcProgressProps {
  arc: NarrativeArc;
  width?: number;
}

export function NarrativeArcProgress({ arc, width = 100 }: NarrativeArcProgressProps) {
  const { theme, darkMode } = useTheme();

  // Position sur la timeline (0-100%)
  const arcPositions: Record<NarrativeArc, number> = {
    emerging: 15,
    developing: 40,
    peak: 60,
    declining: 80,
    resolved: 95,
  };

  const position = arcPositions[arc] || 15;
  const config = NARRATIVE_ARC_CONFIG[arc];

  return (
    <div
      style={{
        width,
        height: '4px',
        backgroundColor: darkMode ? '#374151' : '#E5E7EB',
        borderRadius: '2px',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {/* Progress fill */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${position}%`,
          backgroundColor: config.color,
          borderRadius: '2px',
          transition: 'width 0.5s ease',
        }}
      />
      {/* Current position marker */}
      <div
        style={{
          position: 'absolute',
          left: `${position}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '10px',
          height: '10px',
          backgroundColor: config.color,
          borderRadius: '50%',
          border: `2px solid ${theme.card}`,
          boxShadow: `0 0 4px ${config.color}`,
        }}
      />
    </div>
  );
}

export default NarrativeArcIndicator;
