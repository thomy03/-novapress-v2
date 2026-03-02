'use client';

import React from 'react';
import { KeyMetric, sharedStyles } from '@/app/types/synthesis-page';

/**
 * KeyMetricCallout — Axios/Bloomberg-style callout cards
 * Displays up to 3 key metrics with big numbers, short labels, and source attribution.
 * Newspaper design: blue left border, gray background, no gradients.
 */

interface KeyMetricCalloutProps {
  metrics: KeyMetric[];
}

export default function KeyMetricCallout({ metrics }: KeyMetricCalloutProps) {
  if (!metrics || metrics.length === 0) return null;

  // Show max 3 metrics
  const displayMetrics = metrics.slice(0, 3);

  return (
    <div style={styles.container}>
      <h3 style={styles.sectionLabel}>Chiffres Cles</h3>
      <div style={styles.grid}>
        {displayMetrics.map((metric, idx) => (
          <div key={idx} style={styles.card}>
            <div style={styles.value}>{metric.value}</div>
            <div style={styles.label}>{metric.label}</div>
            {metric.source && (
              <div style={styles.source}>{metric.source}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '32px',
    marginBottom: '32px',
  },
  sectionLabel: {
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: sharedStyles.textSecondary,
    marginBottom: '12px',
    fontFamily: sharedStyles.fontSans,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderLeft: `4px solid ${sharedStyles.accentBlue}`,
    padding: '20px 16px',
  },
  value: {
    fontSize: '32px',
    fontWeight: 800,
    color: sharedStyles.textPrimary,
    lineHeight: 1.1,
    fontFamily: sharedStyles.fontSans,
    marginBottom: '6px',
  },
  label: {
    fontSize: '14px',
    lineHeight: 1.4,
    color: '#374151',
    fontFamily: sharedStyles.fontSerif,
  },
  source: {
    fontSize: '11px',
    color: sharedStyles.textMuted,
    marginTop: '8px',
    fontFamily: sharedStyles.fontSans,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};
