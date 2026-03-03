'use client';

import React from 'react';
import { CausalEdge, Prediction, TIMEFRAME_CONFIG } from '@/app/types/causal';
import { sharedStyles } from '@/app/types/synthesis-page';

/**
 * MiniCausalWidget — Inline newspaper-style causal diagram.
 * Shows causal relations as a simple flowchart + predictions with probability bars.
 * Renders directly in the synthesis body (no separate page needed).
 * Only shows if there are relations or predictions available.
 */

interface MiniCausalWidgetProps {
  edges: CausalEdge[];
  predictions: Prediction[];
  centralEntity?: string;
}

const RELATION_LABELS: Record<string, string> = {
  causes: 'cause',
  triggers: 'declenche',
  enables: 'permet',
  prevents: 'empeche',
  relates_to: 'lie a',
};

const RELATION_ARROWS: Record<string, string> = {
  causes: '\u2192',
  triggers: '\u21DD',
  enables: '\u2192',
  prevents: '\u21AF',
  relates_to: '\u2194',
};

function getProbabilityColor(probability: number): string {
  if (probability >= 0.7) return '#000000';
  if (probability >= 0.4) return '#374151';
  return '#6B7280';
}

function getProbabilityBarColor(probability: number): string {
  if (probability >= 0.7) return '#000000';
  if (probability >= 0.4) return '#6B7280';
  return '#D1D5DB';
}

export default function MiniCausalWidget({ edges, predictions, centralEntity }: MiniCausalWidgetProps) {
  const hasEdges = edges && edges.length > 0;
  const hasPredictions = predictions && predictions.length > 0;

  if (!hasEdges && !hasPredictions) return null;

  // Take top 4 edges by confidence
  const topEdges = hasEdges
    ? [...edges].sort((a, b) => b.confidence - a.confidence).slice(0, 4)
    : [];

  // Take top 3 predictions by probability
  const topPredictions = hasPredictions
    ? [...predictions].sort((a, b) => b.probability - a.probability).slice(0, 3)
    : [];

  return (
    <div style={styles.container}>
      {/* Section title */}
      <div style={styles.header}>
        <h3 style={styles.title}>Nexus Causal</h3>
        {centralEntity && (
          <span style={styles.centralEntity}>{centralEntity}</span>
        )}
      </div>

      {/* Causal Relations */}
      {topEdges.length > 0 && (
        <div style={styles.relationsSection}>
          <div style={styles.sectionLabel}>Chaines Causales</div>
          <div style={styles.relationsGrid}>
            {topEdges.map((edge, idx) => (
              <div key={idx} style={styles.relationRow}>
                {/* Cause */}
                <div style={styles.causeBox}>
                  <span style={styles.causeText}>{edge.cause_text}</span>
                </div>
                {/* Arrow with label */}
                <div style={styles.arrowContainer}>
                  <span style={styles.arrowLine} />
                  <span style={styles.arrowLabel}>
                    {RELATION_LABELS[edge.relation_type] || edge.relation_type}
                  </span>
                  <span style={styles.arrowHead}>
                    {RELATION_ARROWS[edge.relation_type] || '\u2192'}
                  </span>
                </div>
                {/* Effect */}
                <div style={styles.effectBox}>
                  <span style={styles.effectText}>{edge.effect_text}</span>
                </div>
                {/* Confidence */}
                <div style={styles.confidenceBadge}>
                  {Math.round(edge.confidence * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider between sections */}
      {topEdges.length > 0 && topPredictions.length > 0 && (
        <div style={styles.divider} />
      )}

      {/* Predictions */}
      {topPredictions.length > 0 && (
        <div style={styles.predictionsSection}>
          <div style={styles.sectionLabel}>Scenarios Prospectifs</div>
          <div style={styles.predictionsGrid}>
            {topPredictions.map((pred, idx) => {
              const timeConfig = TIMEFRAME_CONFIG[pred.timeframe] || TIMEFRAME_CONFIG.moyen_terme;
              return (
                <div key={idx} style={styles.predictionCard}>
                  {/* Top row: probability + timeframe */}
                  <div style={styles.predictionHeader}>
                    <span style={{
                      ...styles.probabilityValue,
                      color: getProbabilityColor(pred.probability),
                    }}>
                      {Math.round(pred.probability * 100)}%
                    </span>
                    <span style={styles.timeframeBadge}>
                      {timeConfig.labelFr}
                    </span>
                  </div>
                  {/* Probability bar */}
                  <div style={styles.probabilityBar}>
                    <div style={{
                      ...styles.probabilityFill,
                      width: `${Math.round(pred.probability * 100)}%`,
                      backgroundColor: getProbabilityBarColor(pred.probability),
                    }} />
                  </div>
                  {/* Prediction text */}
                  <p style={styles.predictionText}>{pred.prediction}</p>
                  {/* Rationale */}
                  {pred.rationale && (
                    <p style={styles.rationaleText}>{pred.rationale}</p>
                  )}
                  {/* Signal */}
                  {pred.signal_watch && (
                    <p style={styles.signalText}>
                      Signal: {pred.signal_watch}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '32px',
    marginBottom: '32px',
    padding: '24px',
    backgroundColor: '#FFFFFF',
    border: `1px solid ${sharedStyles.border}`,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  title: {
    margin: 0,
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: sharedStyles.textSecondary,
    fontFamily: sharedStyles.fontSans,
  },
  centralEntity: {
    fontSize: '12px',
    fontWeight: 500,
    color: sharedStyles.textMuted,
    fontFamily: sharedStyles.fontSans,
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: sharedStyles.textMuted,
    marginBottom: '12px',
    fontFamily: sharedStyles.fontSans,
  },
  // === Relations ===
  relationsSection: {
    marginBottom: '0',
  },
  relationsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  relationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    minHeight: '40px',
  },
  causeBox: {
    flex: '1 1 35%',
    padding: '8px 12px',
    backgroundColor: '#F9FAFB',
    borderLeft: '3px solid #000000',
  },
  causeText: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#111827',
    fontFamily: sharedStyles.fontSans,
    lineHeight: '1.3',
  },
  arrowContainer: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '0 8px',
    position: 'relative',
  },
  arrowLine: {
    width: '20px',
    height: '1px',
    backgroundColor: '#D1D5DB',
    display: 'block',
  },
  arrowLabel: {
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#9CA3AF',
    fontFamily: sharedStyles.fontSans,
    whiteSpace: 'nowrap',
  },
  arrowHead: {
    fontSize: '14px',
    color: '#6B7280',
  },
  effectBox: {
    flex: '1 1 35%',
    padding: '8px 12px',
    backgroundColor: '#F9FAFB',
    borderLeft: '3px solid #6B7280',
  },
  effectText: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    fontFamily: sharedStyles.fontSans,
    lineHeight: '1.3',
  },
  confidenceBadge: {
    flex: '0 0 auto',
    fontSize: '11px',
    fontWeight: 700,
    color: '#9CA3AF',
    fontFamily: sharedStyles.fontSans,
    marginLeft: '8px',
    minWidth: '32px',
    textAlign: 'right' as const,
  },
  divider: {
    height: '1px',
    backgroundColor: sharedStyles.border,
    margin: '20px 0',
  },
  // === Predictions ===
  predictionsSection: {
    marginTop: '0',
  },
  predictionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  predictionCard: {
    padding: '16px',
    backgroundColor: '#FAFAFA',
    border: `1px solid ${sharedStyles.border}`,
  },
  predictionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  probabilityValue: {
    fontSize: '24px',
    fontWeight: 800,
    fontFamily: sharedStyles.fontSans,
    lineHeight: 1,
  },
  timeframeBadge: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#6B7280',
    padding: '3px 8px',
    border: '1px solid #E5E5E5',
    fontFamily: sharedStyles.fontSans,
  },
  probabilityBar: {
    width: '100%',
    height: '3px',
    backgroundColor: '#F3F4F6',
    marginBottom: '10px',
  },
  probabilityFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  predictionText: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
    fontFamily: sharedStyles.fontSerif,
    lineHeight: '1.5',
    margin: '0 0 6px 0',
  },
  rationaleText: {
    fontSize: '13px',
    color: '#6B7280',
    fontFamily: sharedStyles.fontSerif,
    lineHeight: '1.5',
    fontStyle: 'italic',
    margin: '0 0 4px 0',
  },
  signalText: {
    fontSize: '11px',
    color: '#9CA3AF',
    fontFamily: sharedStyles.fontSans,
    margin: 0,
  },
};
