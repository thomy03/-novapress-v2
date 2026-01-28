"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  CortexNode,
  CortexDetailPanelProps,
  CATEGORY_COLORS,
  NARRATIVE_ARC_LABELS,
  NARRATIVE_ARC_COLORS,
} from '@/app/types/cortex';

interface RelatedSynthesis {
  id: string;
  title: string;
  summary: string;
  created_at: string;
  category?: string;
}

/**
 * CortexDetailPanel - Sidebar panel showing topic details
 */
export function CortexDetailPanel({ node, onClose }: CortexDetailPanelProps) {
  const { theme } = useTheme();
  const [syntheses, setSyntheses] = useState<RelatedSynthesis[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch related syntheses for this topic
  useEffect(() => {
    async function fetchSyntheses() {
      setLoading(true);
      try {
        // TODO: Replace with actual API call when available
        // const response = await fetch(`/api/intelligence/topics/${node.id}/syntheses`);
        // const data = await response.json();
        // setSyntheses(data.syntheses || []);

        // For now, use mock data
        setSyntheses([
          {
            id: '1',
            title: `Synthese liee a ${node.name}`,
            summary: 'Resume de la synthese concernant ce sujet...',
            created_at: new Date().toISOString(),
            category: node.category,
          },
        ]);
      } catch (error) {
        console.error('Failed to fetch syntheses:', error);
      } finally {
        setLoading(false);
      }
    }

    if (node) {
      fetchSyntheses();
    }
  }, [node]);

  const categoryColor = CATEGORY_COLORS[node.category] || CATEGORY_COLORS['MONDE'];
  const arcStyle = NARRATIVE_ARC_COLORS[node.narrative_arc] || NARRATIVE_ARC_COLORS['emerging'];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '400px',
        height: '100vh',
        backgroundColor: theme.bg,
        borderLeft: `1px solid ${theme.border}`,
        overflow: 'auto',
        zIndex: 50,
        boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          backgroundColor: theme.bg,
          borderBottom: `1px solid ${theme.border}`,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: categoryColor,
              }}
            />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: categoryColor,
              }}
            >
              {node.category}
            </span>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: theme.text,
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {node.name}
          </h2>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            color: theme.textSecondary,
            fontSize: '20px',
            lineHeight: 1,
          }}
          aria-label="Fermer"
        >
          x
        </button>
      </div>

      {/* Stats */}
      <div
        style={{
          padding: '20px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: theme.text,
            }}
          >
            {node.synthesis_count}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Syntheses
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: theme.text,
            }}
          >
            {Math.round(node.hot_score * 100)}%
          </div>
          <div
            style={{
              fontSize: '11px',
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Hot Score
          </div>
        </div>
        <div>
          <div
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: arcStyle.bg,
              color: arcStyle.text,
              fontSize: '12px',
              fontWeight: 500,
              display: 'inline-block',
            }}
          >
            {NARRATIVE_ARC_LABELS[node.narrative_arc]}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginTop: '4px',
            }}
          >
            Phase
          </div>
        </div>
      </div>

      {/* Sentiment indicator */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: theme.textSecondary,
            marginBottom: '8px',
          }}
        >
          Sentiment
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor:
                node.sentiment === 'positive'
                  ? '#10B981'
                  : node.sentiment === 'negative'
                  ? '#DC2626'
                  : '#6B7280',
            }}
          />
          <span
            style={{
              fontSize: '14px',
              color: theme.text,
              textTransform: 'capitalize',
            }}
          >
            {node.sentiment === 'positive'
              ? 'Positif'
              : node.sentiment === 'negative'
              ? 'Negatif'
              : 'Neutre'}
          </span>
        </div>
      </div>

      {/* Related syntheses */}
      <div style={{ padding: '20px 24px' }}>
        <h3
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: theme.textSecondary,
            marginBottom: '16px',
          }}
        >
          Syntheses liees
        </h3>

        {loading ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.textSecondary,
              fontSize: '14px',
            }}
          >
            Chargement...
          </div>
        ) : syntheses.length === 0 ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.textSecondary,
              fontSize: '14px',
              border: `1px dashed ${theme.border}`,
              borderRadius: '8px',
            }}
          >
            Aucune synthese liee
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {syntheses.map((synthesis) => (
              <a
                key={synthesis.id}
                href={`/synthesis/${synthesis.id}`}
                style={{
                  display: 'block',
                  padding: '16px',
                  backgroundColor: theme.card || theme.bg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = categoryColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.border;
                }}
              >
                <h4
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.text,
                    lineHeight: 1.4,
                  }}
                >
                  {synthesis.title}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: theme.textSecondary,
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {synthesis.summary}
                </p>
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    color: theme.textSecondary,
                  }}
                >
                  {new Date(synthesis.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* View all button */}
      <div
        style={{
          padding: '16px 24px 32px',
        }}
      >
        <a
          href={`/topics/${encodeURIComponent(node.name)}`}
          style={{
            display: 'block',
            width: '100%',
            padding: '12px',
            textAlign: 'center',
            backgroundColor: categoryColor,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          Voir toutes les syntheses sur ce sujet
        </a>
      </div>
    </div>
  );
}

export default CortexDetailPanel;
