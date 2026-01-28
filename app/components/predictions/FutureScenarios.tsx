'use client';

/**
 * FutureScenarios - Displays future predictions/scenarios in the synthesis body
 *
 * Position: After the main body, before sources section
 * Style: Newspaper professional - subtle background, clear cards
 */

import React, { useState } from 'react';
import { useTheme } from '@/app/contexts/ThemeContext';
import {
  Prediction,
  PREDICTION_TYPE_CONFIG,
  TIMEFRAME_CONFIG,
  PredictionType,
  PredictionTimeframe
} from '@/app/types/causal';

interface FutureScenariosProps {
  predictions: Prediction[];
  sourceCount?: number;
  relatedCount?: number;
}

export function FutureScenarios({
  predictions,
  sourceCount = 0,
  relatedCount = 0
}: FutureScenariosProps) {
  const { theme } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!predictions || predictions.length === 0) {
    return null;
  }

  // Get probability color
  const getProbabilityColor = (probability: number): string => {
    if (probability >= 0.7) return '#059669'; // Green
    if (probability >= 0.4) return '#D97706'; // Amber
    return '#DC2626'; // Red
  };

  // Get probability label
  const getProbabilityLabel = (probability: number): string => {
    if (probability >= 0.7) return 'Probable';
    if (probability >= 0.4) return 'Possible';
    return 'Peu probable';
  };

  // Format timeframe
  const getTimeframeLabel = (timeframe: PredictionTimeframe): string => {
    const config = TIMEFRAME_CONFIG[timeframe];
    return config?.labelFr || timeframe;
  };

  // Get type config
  const getTypeConfig = (type: PredictionType) => {
    return PREDICTION_TYPE_CONFIG[type] || PREDICTION_TYPE_CONFIG.general;
  };

  return (
    <section
      style={{
        marginTop: '40px',
        marginBottom: '40px',
        padding: '24px 28px',
        backgroundColor: '#F9FAFB',
        border: `1px solid ${theme.border}`,
        borderRadius: '4px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span style={{ fontSize: '24px' }}>🔮</span>
        <div>
          <h2
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: theme.textSecondary,
              margin: 0,
              marginBottom: '4px',
            }}
          >
            Évolutions Probables
          </h2>
          <p
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: theme.text,
              fontFamily: 'Georgia, "Times New Roman", serif',
              margin: 0,
            }}
          >
            Scénarios & Anticipations
          </p>
        </div>
      </div>

      {/* Scenarios Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: predictions.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        {predictions.map((prediction, index) => {
          const typeConfig = getTypeConfig(prediction.type);
          const isExpanded = expandedIndex === index;
          const probabilityPercent = Math.round(prediction.probability * 100);
          const probabilityColor = getProbabilityColor(prediction.probability);

          return (
            <article
              key={index}
              style={{
                backgroundColor: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = probabilityColor;
                e.currentTarget.style.boxShadow = `0 2px 8px ${probabilityColor}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Badges Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                }}
              >
                {/* Type Badge */}
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '4px 8px',
                    borderRadius: '2px',
                    backgroundColor: typeConfig.bgColor,
                    color: typeConfig.color,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{typeConfig.icon}</span>
                  {typeConfig.labelFr}
                </span>

                {/* Timeframe Badge */}
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    padding: '4px 8px',
                    borderRadius: '2px',
                    backgroundColor: '#E5E7EB',
                    color: '#374151',
                  }}
                >
                  {getTimeframeLabel(prediction.timeframe)}
                </span>

                {/* Scenario Label */}
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: theme.textSecondary,
                    marginLeft: 'auto',
                  }}
                >
                  SCÉNARIO {String.fromCharCode(65 + index)}
                </span>
              </div>

              {/* Prediction Text */}
              <p
                style={{
                  fontSize: '15px',
                  fontWeight: 500,
                  lineHeight: 1.5,
                  color: theme.text,
                  margin: 0,
                  marginBottom: '16px',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {prediction.prediction}
              </p>

              {/* Probability Bar */}
              <div style={{ marginBottom: isExpanded ? '16px' : 0 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: theme.textSecondary,
                    }}
                  >
                    Probabilité
                  </span>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: probabilityColor,
                    }}
                  >
                    {probabilityPercent}%
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 500,
                        marginLeft: '6px',
                        color: theme.textSecondary,
                      }}
                    >
                      ({getProbabilityLabel(prediction.probability)})
                    </span>
                  </span>
                </div>

                {/* Progress Bar */}
                <div
                  style={{
                    height: '6px',
                    backgroundColor: '#E5E7EB',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${probabilityPercent}%`,
                      backgroundColor: probabilityColor,
                      borderRadius: '3px',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>

              {/* Expanded Rationale */}
              {isExpanded && prediction.rationale && (
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#F3F4F6',
                    borderRadius: '4px',
                    borderLeft: `3px solid ${probabilityColor}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: theme.textSecondary,
                      margin: 0,
                      marginBottom: '8px',
                    }}
                  >
                    Justification
                  </p>
                  <p
                    style={{
                      fontSize: '13px',
                      lineHeight: 1.6,
                      color: theme.text,
                      margin: 0,
                    }}
                  >
                    {prediction.rationale}
                  </p>
                </div>
              )}

              {/* Expand hint */}
              {!isExpanded && prediction.rationale && (
                <p
                  style={{
                    fontSize: '11px',
                    color: theme.textSecondary,
                    margin: 0,
                    marginTop: '12px',
                    textAlign: 'center',
                  }}
                >
                  Cliquer pour voir la justification →
                </p>
              )}
            </article>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '12px 0',
          borderTop: `1px solid ${theme.border}`,
          fontSize: '12px',
          color: theme.textSecondary,
        }}
      >
        <span>
          📊 Basé sur l'analyse de <strong>{sourceCount}</strong> sources
          {relatedCount > 0 && (
            <> et <strong>{relatedCount}</strong> synthèses précédentes</>
          )}
        </span>
      </div>
    </section>
  );
}

export default FutureScenarios;
