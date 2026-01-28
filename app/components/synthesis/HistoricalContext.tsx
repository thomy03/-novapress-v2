'use client';

/**
 * HistoricalContext - Displays "Previously on..." section
 *
 * Position: After introduction/chapo, before main body
 * Style: Newspaper professional - encadré with subtle background
 */

import React from 'react';
import Link from 'next/link';
import { useTheme } from '@/app/contexts/ThemeContext';

interface RelatedSynthesis {
  id: string;
  title: string;
  createdAt: string;
}

interface HistoricalContextProps {
  daysTracked: number;
  narrativeArc: string;
  relatedSyntheses: RelatedSynthesis[];
  hasContradictions?: boolean;
  contradictionsCount?: number;
  synthesisId?: string;
}

// Narrative arc configuration
const NARRATIVE_ARC_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  emerging: {
    label: 'Émergent',
    color: '#059669',
    bgColor: '#ECFDF5',
    description: 'Sujet en développement initial'
  },
  developing: {
    label: 'En développement',
    color: '#2563EB',
    bgColor: '#EFF6FF',
    description: 'Couverture croissante'
  },
  peak: {
    label: 'Point culminant',
    color: '#DC2626',
    bgColor: '#FEF2F2',
    description: 'Maximum de couverture médiatique'
  },
  declining: {
    label: 'En déclin',
    color: '#D97706',
    bgColor: '#FFFBEB',
    description: 'Attention médiatique décroissante'
  },
  resolved: {
    label: 'Résolu',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    description: 'Sujet conclu'
  }
};

export function HistoricalContext({
  daysTracked,
  narrativeArc,
  relatedSyntheses,
  hasContradictions = false,
  contradictionsCount = 0,
  synthesisId
}: HistoricalContextProps) {
  const { theme } = useTheme();

  // Don't render if no historical context
  if ((!relatedSyntheses || relatedSyntheses.length === 0) && daysTracked <= 1) {
    return null;
  }

  const arcConfig = NARRATIVE_ARC_CONFIG[narrativeArc] || NARRATIVE_ARC_CONFIG.emerging;

  // Format date for display
  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return '';
    }
  };

  return (
    <section
      style={{
        margin: '24px 0',
        padding: '20px 24px',
        backgroundColor: '#FAFAFA',
        border: `1px solid ${theme.border}`,
        borderLeft: `4px solid ${arcConfig.color}`,
        borderRadius: '0 4px 4px 0',
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px' }}>📜</span>
          <h3
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: theme.textSecondary,
              margin: 0,
            }}
          >
            Contexte & Précédents
          </h3>
        </div>

        {/* Narrative Arc Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '12px',
              backgroundColor: arcConfig.bgColor,
              color: arcConfig.color,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title={arcConfig.description}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: arcConfig.color,
              }}
            />
            {arcConfig.label}
          </span>

          {/* Contradiction Warning */}
          {hasContradictions && contradictionsCount > 0 && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '12px',
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title={`${contradictionsCount} contradiction(s) détectée(s) entre les sources`}
            >
              ⚠️ {contradictionsCount} contradiction{contradictionsCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Context Description */}
      <p
        style={{
          fontSize: '14px',
          lineHeight: 1.6,
          color: theme.text,
          margin: 0,
          marginBottom: relatedSyntheses.length > 0 ? '16px' : 0,
        }}
      >
        Cette analyse s'inscrit dans un suivi de{' '}
        <strong>{daysTracked}</strong> jour{daysTracked > 1 ? 's' : ''}.
        {relatedSyntheses.length > 0 && (
          <> {relatedSyntheses.length} synthèse{relatedSyntheses.length > 1 ? 's' : ''} précédente{relatedSyntheses.length > 1 ? 's' : ''} ont contribué au contexte.</>
        )}
      </p>

      {/* Related Syntheses Links */}
      {relatedSyntheses.length > 0 && (
        <div
          style={{
            borderTop: `1px solid ${theme.border}`,
            paddingTop: '16px',
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
              marginBottom: '12px',
            }}
          >
            Précédemment dans ce dossier :
          </p>

          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {relatedSyntheses.map((synthesis, index) => (
              <li key={synthesis.id || index}>
                <Link
                  href={`/synthesis/${synthesis.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    backgroundColor: theme.card,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    textDecoration: 'none',
                    color: theme.text,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2563EB';
                    e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.border;
                    e.currentTarget.style.backgroundColor = theme.card;
                  }}
                >
                  <span
                    style={{
                      fontSize: '16px',
                      opacity: 0.7,
                    }}
                  >
                    →
                  </span>
                  <div style={{ flex: 1 }}>
                    {synthesis.createdAt && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: theme.textSecondary,
                          marginRight: '8px',
                        }}
                      >
                        [{formatDate(synthesis.createdAt)}]
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '14px',
                        lineHeight: 1.4,
                        fontFamily: 'Georgia, "Times New Roman", serif',
                      }}
                    >
                      {synthesis.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#2563EB',
                      opacity: 0.8,
                    }}
                  >
                    ↗
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Link to full timeline */}
      {synthesisId && (
        <div
          style={{
            marginTop: '16px',
            textAlign: 'right',
          }}
        >
          <Link
            href={`/synthesis/${synthesisId}/timeline`}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#2563EB',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            🔗 Voir l'historique complet →
          </Link>
        </div>
      )}
    </section>
  );
}

export default HistoricalContext;
