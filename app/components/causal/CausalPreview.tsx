'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { causalService } from '@/app/lib/api/services/causal';
import {
  CausalPreviewResponse,
  RELATION_CONFIG,
  NARRATIVE_FLOW_CONFIG,
  formatConfidencePercent
} from '@/app/types/causal';

interface CausalPreviewProps {
  synthesisId: string;
  onError?: (error: Error) => void;
}

export default function CausalPreview({ synthesisId, onError }: CausalPreviewProps) {
  const [data, setData] = useState<CausalPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        setLoading(true);
        const result = await causalService.getCausalPreview(synthesisId, 2);
        setData(result);
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load causal preview';
        setError(errorMsg);
        onError?.(err instanceof Error ? err : new Error(errorMsg));
      } finally {
        setLoading(false);
      }
    };

    if (synthesisId) {
      fetchPreview();
    }
  }, [synthesisId, onError]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Chargement...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null; // Silently hide if no data
  }

  if (!data.has_causal_data || data.total_relations === 0) {
    return null; // Don't show if no causal data
  }

  const flowConfig = NARRATIVE_FLOW_CONFIG[data.narrative_flow];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>
          <span style={styles.titleIcon}>⛓️</span>
          Nexus Causal
        </h3>
        <span
          style={{
            ...styles.flowBadge,
            backgroundColor: `${flowConfig.color}15`,
            color: flowConfig.color
          }}
        >
          {flowConfig.icon} {flowConfig.labelFr}
        </span>
      </div>

      {/* Central Entity */}
      {data.central_entity && (
        <p style={styles.centralEntity}>
          Entite centrale: <strong>{data.central_entity}</strong>
        </p>
      )}

      {/* Top Relations Preview */}
      <div style={styles.relationsPreview}>
        {data.top_relations.slice(0, 2).map((edge, idx) => {
          const config = RELATION_CONFIG[edge.relation_type] || RELATION_CONFIG.causes;
          return (
            <div key={idx} style={styles.relationItem}>
              <span
                style={{
                  ...styles.relationBadge,
                  backgroundColor: config.bgColor,
                  color: config.color
                }}
              >
                {config.icon}
              </span>
              <div style={styles.relationText}>
                <span style={styles.causeText}>{edge.cause_text.slice(0, 50)}...</span>
                <span style={styles.arrow}>→</span>
                <span style={styles.effectText}>{edge.effect_text.slice(0, 50)}...</span>
              </div>
              <span style={styles.confidence}>
                {formatConfidencePercent(edge.confidence)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <span style={styles.statItem}>
          <strong>{data.total_relations}</strong> relations
        </span>
      </div>

      {/* Link to full view */}
      <Link href={`/synthesis/${synthesisId}/causal`} style={styles.viewLink}>
        Voir le graphe causal complet →
      </Link>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
    padding: '20px',
    marginTop: '24px'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '20px'
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #E5E5E5',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '13px',
    color: '#6B7280'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    fontWeight: 700,
    color: '#000000',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  titleIcon: {
    fontSize: '16px'
  },
  flowBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const
  },
  centralEntity: {
    fontSize: '12px',
    color: '#6B7280',
    margin: '0 0 12px 0'
  },
  relationsPreview: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    marginBottom: '12px'
  },
  relationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    backgroundColor: '#FFFFFF',
    padding: '8px',
    border: '1px solid #E5E5E5'
  },
  relationBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    fontSize: '10px',
    flexShrink: 0
  },
  relationText: {
    flex: 1,
    fontSize: '12px',
    color: '#374151',
    lineHeight: 1.4
  },
  causeText: {
    fontWeight: 500
  },
  arrow: {
    color: '#9CA3AF',
    margin: '0 4px'
  },
  effectText: {
    color: '#6B7280'
  },
  confidence: {
    fontSize: '11px',
    color: '#9CA3AF',
    flexShrink: 0
  },
  stats: {
    display: 'flex',
    justifyContent: 'center',
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '12px'
  },
  statItem: {},
  viewLink: {
    display: 'block',
    textAlign: 'center' as const,
    fontSize: '13px',
    color: '#2563EB',
    textDecoration: 'none',
    fontWeight: 500
  }
};
