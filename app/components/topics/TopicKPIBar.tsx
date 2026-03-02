'use client';

import React from 'react';

interface TopicKPIBarProps {
  synthesisCount: number;
  durationDays: number;
  transparencyAvg: number;
  sourcesTotal: number;
  entitiesCount: number;
  causalNodes: number;
}

export default function TopicKPIBar({
  synthesisCount,
  durationDays,
  transparencyAvg,
  sourcesTotal,
  entitiesCount,
  causalNodes,
}: TopicKPIBarProps) {
  const kpis = [
    { label: 'Syntheses', value: synthesisCount, icon: '\u{1F4F0}' },
    { label: 'Jours de suivi', value: durationDays, icon: '\u{1F4C5}' },
    { label: 'Transparence', value: `${transparencyAvg}/100`, icon: '\u{1F50D}' },
    { label: 'Sources uniques', value: sourcesTotal, icon: '\u{1F310}' },
    { label: 'Entites', value: entitiesCount, icon: '\u{1F465}' },
    { label: 'Noeuds causaux', value: causalNodes, icon: '\u{1F9E0}' },
  ];

  return (
    <div style={styles.bar}>
      {kpis.map((kpi, i) => (
        <div key={i} style={styles.kpiItem}>
          <span style={styles.kpiIcon}>{kpi.icon}</span>
          <span style={styles.kpiValue}>{kpi.value}</span>
          <span style={styles.kpiLabel}>{kpi.label}</span>
        </div>
      ))}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  bar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '1px',
    backgroundColor: '#E5E5E5',
    border: '1px solid #E5E5E5',
    marginTop: '32px',
  },
  kpiItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '20px 12px',
    backgroundColor: '#FFFFFF',
  },
  kpiIcon: {
    fontSize: '18px',
  },
  kpiValue: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '24px',
    fontWeight: 700,
    color: '#000000',
  },
  kpiLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    textAlign: 'center' as const,
  },
};
