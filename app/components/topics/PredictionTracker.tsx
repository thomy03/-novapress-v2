'use client';

import React from 'react';
import Link from 'next/link';

interface Prediction {
  prediction: string;
  probability: number;
  type: string;
  timeframe: string;
  synthesis_id: string;
  synthesis_date: string;
}

interface PredictionTrackerProps {
  predictions: Prediction[];
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getProbabilityColor(prob: number): string {
  if (prob >= 0.7) return '#10B981';
  if (prob >= 0.4) return '#F59E0B';
  return '#DC2626';
}

export default function PredictionTracker({ predictions }: PredictionTrackerProps) {
  if (!predictions.length) return null;

  // Group by timeframe
  const grouped: Record<string, Prediction[]> = {};
  for (const pred of predictions) {
    const tf = pred.timeframe || 'Non specifie';
    if (!grouped[tf]) grouped[tf] = [];
    grouped[tf].push(pred);
  }

  return (
    <div style={styles.container}>
      {Object.entries(grouped).map(([timeframe, preds]) => (
        <div key={timeframe} style={styles.group}>
          <h3 style={styles.groupTitle}>{timeframe}</h3>
          <div style={styles.predList}>
            {preds.map((pred, i) => (
              <div key={i} style={styles.card}>
                <div style={styles.cardHeader}>
                  <span style={styles.type}>{pred.type}</span>
                  <span
                    style={{
                      ...styles.probability,
                      color: getProbabilityColor(pred.probability),
                    }}
                  >
                    {Math.round(pred.probability * 100)}%
                  </span>
                </div>

                <p style={styles.predictionText}>{pred.prediction}</p>

                {/* Progress bar */}
                <div style={styles.progressTrack}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${Math.round(pred.probability * 100)}%`,
                      backgroundColor: getProbabilityColor(pred.probability),
                    }}
                  />
                </div>

                <div style={styles.cardFooter}>
                  <span style={styles.meta}>
                    {formatDate(pred.synthesis_date)}
                  </span>
                  {pred.synthesis_id && (
                    <Link
                      href={`/synthesis/${pred.synthesis_id}`}
                      style={styles.sourceLink}
                    >
                      Source
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  group: {},
  groupTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '12px',
    paddingBottom: '6px',
    borderBottom: '1px solid #E5E5E5',
  },
  predList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '12px',
  },
  card: {
    padding: '16px 20px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  type: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  probability: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '18px',
    fontWeight: 700,
  },
  predictionText: {
    fontSize: '14px',
    fontFamily: 'Georgia, serif',
    color: '#000000',
    lineHeight: 1.5,
    margin: '0 0 12px',
  },
  progressTrack: {
    width: '100%',
    height: '4px',
    backgroundColor: '#E5E5E5',
    marginBottom: '10px',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    fontSize: '12px',
    color: '#9CA3AF',
  },
  sourceLink: {
    fontSize: '12px',
    color: '#2563EB',
    textDecoration: 'none',
    fontWeight: 500,
  },
};
