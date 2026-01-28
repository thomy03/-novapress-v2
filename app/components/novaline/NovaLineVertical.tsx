'use client';

import React, { useState } from 'react';
import {
  NovaLineData,
  NovaLinePoint,
  NOVALINE_THEME,
  NOVALINE_PHASE_COLORS,
  getTensionLevel,
} from '@/app/types/novaline';
import { PHASE_CONFIG } from '@/app/types/timeline';
import { ContradictionTooltip } from './NovaLineTooltip';

interface NovaLineVerticalProps {
  data: NovaLineData;
  onPointClick?: (point: NovaLinePoint) => void;
}

/**
 * NovaLine Vertical - Mobile version
 * Displays timeline as a vertical metro-style line
 */
export function NovaLineVertical({ data, onPointClick }: NovaLineVerticalProps) {
  const [expandedPoint, setExpandedPoint] = useState<string | null>(null);
  const [showContradiction, setShowContradiction] = useState<NovaLinePoint | null>(null);

  // Combine past points and future predictions
  const allPoints = [
    ...data.points,
    ...data.predictions.flatMap((pred) =>
      pred.points.map((p) => ({
        ...p,
        scenarioLabel: pred.label,
        probability: pred.probability,
      }))
    ),
  ];

  const toggleExpand = (pointId: string) => {
    setExpandedPoint(expandedPoint === pointId ? null : pointId);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: NOVALINE_THEME.background,
        padding: '16px',
      }}
    >
      {/* Title */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: NOVALINE_THEME.text,
            fontFamily: 'Georgia, serif',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          Fil Narratif
        </h3>
        {data.daysTracked > 0 && (
          <span
            style={{
              fontSize: '11px',
              color: NOVALINE_THEME.textSecondary,
            }}
          >
            {data.daysTracked}j
          </span>
        )}
      </div>

      {/* Vertical timeline */}
      <div style={{ position: 'relative', paddingLeft: '24px' }}>
        {/* Vertical line */}
        <div
          style={{
            position: 'absolute',
            left: '7px',
            top: '8px',
            bottom: '8px',
            width: '2px',
            backgroundColor: NOVALINE_THEME.linePast,
          }}
        />

        {/* Points */}
        {allPoints.map((point, index) => {
          const isExpanded = expandedPoint === point.id;
          const phaseConfig = PHASE_CONFIG[point.phase];
          const tensionLevel = getTensionLevel(point.tension);
          const isLast = index === allPoints.length - 1;

          return (
            <div
              key={point.id}
              style={{
                position: 'relative',
                paddingBottom: isLast ? '0' : '20px',
              }}
            >
              {/* Point marker */}
              <div
                style={{
                  position: 'absolute',
                  left: '-24px',
                  top: '4px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: point.isPresent
                    ? NOVALINE_THEME.pointPresent
                    : point.isFuture
                    ? NOVALINE_THEME.pointFuture
                    : NOVALINE_THEME.pointPast,
                  border: `2px solid ${NOVALINE_THEME.background}`,
                  boxShadow: point.isPresent
                    ? `0 0 0 3px ${NOVALINE_THEME.pointPresent}40`
                    : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                className={point.isPresent ? 'novaline-present' : ''}
                onClick={() => toggleExpand(point.id)}
              />

              {/* Future line style */}
              {point.isFuture && index > 0 && !allPoints[index - 1].isFuture && (
                <div
                  style={{
                    position: 'absolute',
                    left: '-17px',
                    top: '-10px',
                    width: '2px',
                    height: '30px',
                    backgroundImage: `repeating-linear-gradient(
                      to bottom,
                      ${NOVALINE_THEME.lineFuture} 0,
                      ${NOVALINE_THEME.lineFuture} 4px,
                      transparent 4px,
                      transparent 8px
                    )`,
                  }}
                />
              )}

              {/* Contradiction marker */}
              {point.hasContradiction && (
                <div
                  style={{
                    position: 'absolute',
                    left: '-32px',
                    top: '0',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: NOVALINE_THEME.contradiction,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowContradiction(point)}
                >
                  ⚠️
                </div>
              )}

              {/* Content */}
              <div
                onClick={() => {
                  toggleExpand(point.id);
                  onPointClick?.(point);
                }}
                style={{
                  cursor: 'pointer',
                  padding: '8px 12px',
                  backgroundColor: isExpanded ? NOVALINE_THEME.grid : 'transparent',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s ease',
                }}
              >
                {/* Date and phase */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      color: NOVALINE_THEME.textSecondary,
                      textTransform: 'uppercase',
                    }}
                  >
                    {point.dateFormatted}
                  </span>
                  {point.isPresent && (
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 4px',
                        backgroundColor: NOVALINE_THEME.pointPresent,
                        color: '#fff',
                        borderRadius: '2px',
                        fontWeight: 600,
                      }}
                    >
                      MAINTENANT
                    </span>
                  )}
                  {point.isFuture && (
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 4px',
                        backgroundColor: NOVALINE_THEME.lineFuture,
                        color: '#fff',
                        borderRadius: '2px',
                      }}
                    >
                      {(point as NovaLinePoint & { scenarioLabel?: string }).scenarioLabel || 'FUTUR'}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h4
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: NOVALINE_THEME.text,
                    fontFamily: 'Georgia, serif',
                    lineHeight: 1.3,
                  }}
                >
                  {point.title.length > 60 && !isExpanded
                    ? `${point.title.substring(0, 60)}...`
                    : point.title}
                </h4>

                {/* Tension bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: '3px',
                      backgroundColor: NOVALINE_THEME.grid,
                      borderRadius: '2px',
                      overflow: 'hidden',
                      maxWidth: '100px',
                    }}
                  >
                    <div
                      style={{
                        width: `${point.tension}%`,
                        height: '100%',
                        backgroundColor: tensionLevel.color,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      color: tensionLevel.color,
                      fontWeight: 600,
                    }}
                  >
                    {point.tension}
                  </span>
                </div>

                {/* Expanded content */}
                {isExpanded && point.summary && (
                  <div
                    style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: `1px solid ${NOVALINE_THEME.grid}`,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        color: NOVALINE_THEME.textSecondary,
                        lineHeight: 1.5,
                      }}
                    >
                      {point.summary}
                    </p>
                    {point.sources && point.sources.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                          marginTop: '8px',
                        }}
                      >
                        {point.sources.map((source, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '9px',
                              padding: '2px 4px',
                              backgroundColor: NOVALINE_THEME.background,
                              color: NOVALINE_THEME.textSecondary,
                              borderRadius: '2px',
                              border: `1px solid ${NOVALINE_THEME.grid}`,
                            }}
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Contradiction modal */}
      {showContradiction && showContradiction.contradiction && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => setShowContradiction(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ContradictionTooltip contradiction={showContradiction.contradiction} />
            <button
              onClick={() => setShowContradiction(null)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '8px',
                padding: '8px',
                backgroundColor: NOVALINE_THEME.text,
                color: NOVALINE_THEME.background,
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NovaLineVertical;
