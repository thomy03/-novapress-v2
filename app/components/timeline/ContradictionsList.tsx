'use client';

import React from 'react';
import { ContradictionItem, ContradictionType } from '@/app/types/timeline';

interface ContradictionsListProps {
  contradictions: ContradictionItem[];
  compact?: boolean;
}

const CONTRADICTION_CONFIG: Record<ContradictionType, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  factual: {
    label: 'Factuel',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    icon: '❌',
  },
  temporal: {
    label: 'Temporel',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    icon: '⏱️',
  },
  sentiment: {
    label: 'Sentiment',
    color: '#8B5CF6',
    bgColor: '#EDE9FE',
    icon: '💭',
  },
};

export default function ContradictionsList({
  contradictions,
  compact = false,
}: ContradictionsListProps) {
  if (contradictions.length === 0) {
    return null;
  }

  const displayItems = compact ? contradictions.slice(0, 3) : contradictions;

  return (
    <div style={styles.container}>
      <h3 style={styles.header}>
        <span style={styles.headerIcon}>⚠️</span>
        Contradictions détectées
        <span style={styles.count}>{contradictions.length}</span>
      </h3>

      <div style={styles.list}>
        {displayItems.map((item, index) => {
          const config = CONTRADICTION_CONFIG[item.type];

          return (
            <div key={index} style={styles.item}>
              {/* Type badge */}
              <div style={{
                ...styles.typeBadge,
                backgroundColor: config.bgColor,
                color: config.color,
              }}>
                {config.icon} {config.label}
              </div>

              {/* Date */}
              <span style={styles.date}>
                {formatDate(item.date)}
              </span>

              {/* Claims comparison */}
              {!compact && (
                <div style={styles.claims}>
                  {item.claim_a && (
                    <div style={styles.claim}>
                      <span style={styles.claimLabel}>Source A:</span>
                      <span style={styles.claimText}>"{item.claim_a}"</span>
                      {item.source_a && (
                        <span style={styles.claimSource}>— {item.source_a}</span>
                      )}
                    </div>
                  )}

                  {item.claim_b && (
                    <div style={styles.claim}>
                      <span style={styles.claimLabel}>Source B:</span>
                      <span style={styles.claimText}>"{item.claim_b}"</span>
                      {item.source_b && (
                        <span style={styles.claimSource}>— {item.source_b}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {compact && contradictions.length > 3 && (
        <p style={styles.moreText}>
          +{contradictions.length - 3} autres contradictions
        </p>
      )}

      <p style={styles.disclaimer}>
        Les contradictions sont détectées automatiquement et peuvent nécessiter une vérification manuelle.
      </p>
    </div>
  );
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#FEF2F2',
    border: '1px solid #FECACA',
    padding: '20px',
    marginTop: '16px',
  },
  header: {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    fontWeight: 700,
    color: '#991B1B',
    margin: '0 0 16px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingBottom: '12px',
    borderBottom: '1px solid #FECACA',
  },
  headerIcon: {
    fontSize: '18px',
  },
  count: {
    marginLeft: 'auto',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  item: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #FECACA',
    padding: '12px',
  },
  typeBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  date: {
    display: 'block',
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '8px',
  },
  claims: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  claim: {
    padding: '8px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
  },
  claimLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
  },
  claimText: {
    display: 'block',
    fontSize: '13px',
    color: '#374151',
    fontStyle: 'italic' as const,
    lineHeight: 1.5,
  },
  claimSource: {
    display: 'block',
    fontSize: '12px',
    color: '#9CA3AF',
    marginTop: '4px',
  },
  moreText: {
    marginTop: '12px',
    fontSize: '13px',
    color: '#991B1B',
    textAlign: 'center' as const,
    fontWeight: 500,
  },
  disclaimer: {
    marginTop: '16px',
    fontSize: '11px',
    color: '#6B7280',
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
    margin: '16px 0 0 0',
  },
};
