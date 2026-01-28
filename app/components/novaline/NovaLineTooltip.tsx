'use client';

import React from 'react';
import { NovaLinePoint, NOVALINE_THEME, NOVALINE_PHASE_COLORS, getTensionLevel } from '@/app/types/novaline';
import { PHASE_CONFIG } from '@/app/types/timeline';

interface NovaLineTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: NovaLinePoint;
  }>;
  label?: string;
}

/**
 * Custom tooltip for NovaLine chart
 * Shows point details on hover
 */
export function NovaLineTooltip({ active, payload }: NovaLineTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0].payload;
  const phaseConfig = PHASE_CONFIG[point.phase];
  const tensionLevel = getTensionLevel(point.tension);

  return (
    <div
      style={{
        backgroundColor: NOVALINE_THEME.background,
        border: `1px solid ${NOVALINE_THEME.grid}`,
        borderRadius: '4px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        maxWidth: '280px',
        fontFamily: 'Georgia, serif',
      }}
    >
      {/* Date and phase */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: NOVALINE_THEME.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {point.dateFormatted}
        </span>
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            backgroundColor: phaseConfig.bgColor,
            color: phaseConfig.color,
            borderRadius: '2px',
            fontWeight: 500,
          }}
        >
          {phaseConfig.icon} {phaseConfig.labelFr}
        </span>
      </div>

      {/* Title */}
      <h4
        style={{
          margin: '0 0 8px 0',
          fontSize: '14px',
          fontWeight: 600,
          color: NOVALINE_THEME.text,
          lineHeight: 1.3,
        }}
      >
        {point.title}
      </h4>

      {/* Summary if available */}
      {point.summary && (
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: '12px',
            color: NOVALINE_THEME.textSecondary,
            lineHeight: 1.4,
          }}
        >
          {point.summary.length > 150
            ? `${point.summary.substring(0, 150)}...`
            : point.summary}
        </p>
      )}

      {/* Tension score */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: NOVALINE_THEME.textSecondary,
          }}
        >
          Tension:
        </span>
        <div
          style={{
            flex: 1,
            height: '4px',
            backgroundColor: NOVALINE_THEME.grid,
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${point.tension}%`,
              height: '100%',
              backgroundColor: tensionLevel.color,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: tensionLevel.color,
          }}
        >
          {point.tension}
        </span>
      </div>

      {/* Sources */}
      {point.sources && point.sources.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
          }}
        >
          {point.sources.slice(0, 3).map((source, i) => (
            <span
              key={i}
              style={{
                fontSize: '10px',
                padding: '2px 4px',
                backgroundColor: NOVALINE_THEME.grid,
                color: NOVALINE_THEME.textSecondary,
                borderRadius: '2px',
              }}
            >
              {source}
            </span>
          ))}
          {point.sources.length > 3 && (
            <span
              style={{
                fontSize: '10px',
                color: NOVALINE_THEME.textSecondary,
              }}
            >
              +{point.sources.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Future indicator */}
      {point.isFuture && (
        <div
          style={{
            marginTop: '8px',
            padding: '4px 8px',
            backgroundColor: 'rgba(156, 163, 175, 0.1)',
            borderRadius: '2px',
            fontSize: '10px',
            color: NOVALINE_THEME.textSecondary,
            fontStyle: 'italic',
          }}
        >
          Prédiction (probabilité estimée)
        </div>
      )}
    </div>
  );
}

/**
 * Tooltip for contradiction markers
 */
interface ContradictionTooltipProps {
  contradiction: {
    type: string;
    claim_a: string;
    claim_b: string;
    source_a: string;
    source_b: string;
    date: string;
  };
}

export function ContradictionTooltip({ contradiction }: ContradictionTooltipProps) {
  const typeLabels: Record<string, { label: string; icon: string }> = {
    factual: { label: 'Contradiction factuelle', icon: '❌' },
    temporal: { label: 'Incohérence temporelle', icon: '⏱️' },
    sentiment: { label: 'Divergence de ton', icon: '💭' },
  };

  const typeInfo = typeLabels[contradiction.type] || typeLabels.factual;

  return (
    <div
      style={{
        backgroundColor: NOVALINE_THEME.background,
        border: `2px solid ${NOVALINE_THEME.contradiction}`,
        borderRadius: '4px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
        maxWidth: '320px',
        fontFamily: 'Georgia, serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: `1px solid ${NOVALINE_THEME.grid}`,
        }}
      >
        <span style={{ fontSize: '16px' }}>{typeInfo.icon}</span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: NOVALINE_THEME.contradiction,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {typeInfo.label}
        </span>
      </div>

      {/* Claims comparison */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Claim A */}
        <div>
          <div
            style={{
              fontSize: '10px',
              color: NOVALINE_THEME.textSecondary,
              marginBottom: '4px',
              textTransform: 'uppercase',
            }}
          >
            {contradiction.source_a}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: NOVALINE_THEME.text,
              lineHeight: 1.4,
              paddingLeft: '8px',
              borderLeft: `2px solid ${NOVALINE_THEME.textSecondary}`,
            }}
          >
            "{contradiction.claim_a}"
          </div>
        </div>

        {/* VS separator */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '10px',
            color: NOVALINE_THEME.contradiction,
            fontWeight: 600,
          }}
        >
          VS
        </div>

        {/* Claim B */}
        <div>
          <div
            style={{
              fontSize: '10px',
              color: NOVALINE_THEME.textSecondary,
              marginBottom: '4px',
              textTransform: 'uppercase',
            }}
          >
            {contradiction.source_b}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: NOVALINE_THEME.text,
              lineHeight: 1.4,
              paddingLeft: '8px',
              borderLeft: `2px solid ${NOVALINE_THEME.textSecondary}`,
            }}
          >
            "{contradiction.claim_b}"
          </div>
        </div>
      </div>
    </div>
  );
}

export default NovaLineTooltip;
