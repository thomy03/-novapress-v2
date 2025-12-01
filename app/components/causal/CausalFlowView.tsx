'use client';

import React, { useState } from 'react';
import {
  CausalEdge,
  CausalNode,
  RelationType,
  NarrativeFlow,
  RELATION_CONFIG,
  NARRATIVE_FLOW_CONFIG,
  getConfidenceLevel,
  formatConfidencePercent
} from '@/app/types/causal';

interface CausalFlowViewProps {
  nodes: CausalNode[];
  edges: CausalEdge[];
  centralEntity: string;
  narrativeFlow: NarrativeFlow;
  onEdgeClick?: (edge: CausalEdge) => void;
  compact?: boolean;
}

export default function CausalFlowView({
  nodes,
  edges,
  centralEntity,
  narrativeFlow,
  onEdgeClick,
  compact = false
}: CausalFlowViewProps) {
  const [selectedEdge, setSelectedEdge] = useState<CausalEdge | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  if (edges.length === 0) {
    return (
      <div style={styles.emptyState}>
        <p style={styles.emptyText}>Aucune relation causale detectee</p>
        <p style={styles.emptySubtext}>
          Les relations causales seront extraites lors de la prochaine execution du pipeline.
        </p>
      </div>
    );
  }

  const displayEdges = compact ? edges.slice(0, 3) : edges;
  const flowConfig = NARRATIVE_FLOW_CONFIG[narrativeFlow];

  const handleEdgeClick = (edge: CausalEdge) => {
    setSelectedEdge(selectedEdge === edge ? null : edge);
    onEdgeClick?.(edge);
  };

  const getEdgeKey = (edge: CausalEdge, idx: number) =>
    `${edge.cause_text.slice(0, 20)}-${edge.effect_text.slice(0, 20)}-${idx}`;

  return (
    <div style={styles.container}>
      {/* Header with narrative flow indicator */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h3 style={styles.title}>Nexus Causal</h3>
          {centralEntity && (
            <span style={styles.centralEntity}>
              Entite centrale: <strong>{centralEntity}</strong>
            </span>
          )}
        </div>
        <div
          style={{
            ...styles.flowBadge,
            backgroundColor: `${flowConfig.color}15`,
            color: flowConfig.color
          }}
        >
          <span style={styles.flowIcon}>{flowConfig.icon}</span>
          <span>{flowConfig.labelFr}</span>
        </div>
      </div>

      {/* Legend */}
      {!compact && (
        <div style={styles.legend}>
          {(Object.keys(RELATION_CONFIG) as RelationType[]).map((type) => {
            const config = RELATION_CONFIG[type];
            return (
              <div key={type} style={styles.legendItem}>
                <span
                  style={{
                    ...styles.legendDot,
                    backgroundColor: config.color
                  }}
                />
                <span style={styles.legendLabel}>{config.labelFr}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Causal Flow */}
      <div style={styles.flowContainer}>
        {displayEdges.map((edge, idx) => {
          const config = RELATION_CONFIG[edge.relation_type] || RELATION_CONFIG.causes;
          const confidence = getConfidenceLevel(edge.confidence);
          const edgeKey = getEdgeKey(edge, idx);
          const isHovered = hoveredEdge === edgeKey;
          const isSelected = selectedEdge === edge;

          return (
            <div
              key={edgeKey}
              style={{
                ...styles.relationCard,
                borderLeftColor: config.color,
                backgroundColor: isSelected ? config.bgColor : isHovered ? '#FAFAFA' : '#FFFFFF',
                transform: isHovered ? 'translateX(4px)' : 'none'
              }}
              onClick={() => handleEdgeClick(edge)}
              onMouseEnter={() => setHoveredEdge(edgeKey)}
              onMouseLeave={() => setHoveredEdge(null)}
            >
              {/* Relation type badge */}
              <div style={styles.relationHeader}>
                <span
                  style={{
                    ...styles.typeBadge,
                    backgroundColor: config.bgColor,
                    color: config.color
                  }}
                >
                  {config.icon} {config.labelFr}
                </span>
                <span
                  style={{
                    ...styles.confidenceBadge,
                    color: confidence.color
                  }}
                >
                  {formatConfidencePercent(edge.confidence)} confiance
                </span>
              </div>

              {/* Cause */}
              <div style={styles.causeBox}>
                <span style={styles.causeLabel}>CAUSE</span>
                <p style={styles.causeText}>{edge.cause_text}</p>
              </div>

              {/* Arrow */}
              <div style={styles.arrowContainer}>
                <svg width="24" height="24" viewBox="0 0 24 24" style={{ color: config.color }}>
                  <path
                    d="M12 4v16m0 0l-6-6m6 6l6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>

              {/* Effect */}
              <div style={styles.effectBox}>
                <span style={styles.effectLabel}>EFFET</span>
                <p style={styles.effectText}>{edge.effect_text}</p>
              </div>

              {/* Sources (if expanded) */}
              {isSelected && edge.source_articles && edge.source_articles.length > 0 && (
                <div style={styles.sourcesSection}>
                  <span style={styles.sourcesLabel}>Sources:</span>
                  <div style={styles.sourcesList}>
                    {edge.source_articles.map((source, sIdx) => (
                      <span key={sIdx} style={styles.sourceTag}>
                        {source}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence (if expanded) */}
              {isSelected && edge.evidence && edge.evidence.length > 0 && (
                <div style={styles.evidenceSection}>
                  <span style={styles.evidenceLabel}>Preuves:</span>
                  {edge.evidence.map((ev, eIdx) => (
                    <p key={eIdx} style={styles.evidenceText}>
                      "{ev}"
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Show more indicator */}
      {compact && edges.length > 3 && (
        <p style={styles.moreText}>
          +{edges.length - 3} autres relations causales
        </p>
      )}

      {/* Stats summary */}
      {!compact && (
        <div style={styles.statsBar}>
          <span style={styles.statItem}>
            <strong>{edges.length}</strong> relations
          </span>
          <span style={styles.statDivider}>|</span>
          <span style={styles.statItem}>
            <strong>{nodes.length}</strong> evenements
          </span>
          <span style={styles.statDivider}>|</span>
          <span style={styles.statItem}>
            Flux <strong>{flowConfig.labelFr.toLowerCase()}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

// Inline styles (newspaper professional design)
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    padding: '24px',
    marginTop: '24px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '2px solid #000000'
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: '18px',
    fontWeight: 700,
    color: '#000000',
    margin: 0
  },
  centralEntity: {
    fontSize: '13px',
    color: '#6B7280'
  },
  flowBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  flowIcon: {
    fontSize: '14px'
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '16px',
    marginBottom: '20px',
    padding: '12px',
    backgroundColor: '#F9FAFB',
    borderRadius: '4px'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%'
  },
  legendLabel: {
    fontSize: '12px',
    color: '#6B7280'
  },
  flowContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px'
  },
  relationCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    borderLeft: '4px solid',
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  relationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  confidenceBadge: {
    fontSize: '12px',
    fontWeight: 500
  },
  causeBox: {
    backgroundColor: '#F9FAFB',
    padding: '12px',
    marginBottom: '8px'
  },
  causeLabel: {
    display: 'block',
    fontSize: '10px',
    fontWeight: 700,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '6px'
  },
  causeText: {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#1F2937',
    margin: 0
  },
  arrowContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '4px 0'
  },
  effectBox: {
    backgroundColor: '#F0F9FF',
    padding: '12px'
  },
  effectLabel: {
    display: 'block',
    fontSize: '10px',
    fontWeight: 700,
    color: '#2563EB',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    marginBottom: '6px'
  },
  effectText: {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#1F2937',
    margin: 0
  },
  sourcesSection: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #E5E5E5'
  },
  sourcesLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: '#6B7280',
    marginBottom: '8px'
  },
  sourcesList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px'
  },
  sourceTag: {
    backgroundColor: '#E5E5E5',
    padding: '4px 8px',
    fontSize: '12px',
    color: '#374151'
  },
  evidenceSection: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #E5E5E5'
  },
  evidenceLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: '#6B7280',
    marginBottom: '8px'
  },
  evidenceText: {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    fontStyle: 'italic' as const,
    color: '#4B5563',
    margin: '0 0 8px 0',
    paddingLeft: '12px',
    borderLeft: '2px solid #E5E5E5'
  },
  moreText: {
    textAlign: 'center' as const,
    fontSize: '13px',
    color: '#2563EB',
    fontWeight: 500,
    marginTop: '16px',
    cursor: 'pointer'
  },
  statsBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #E5E5E5',
    fontSize: '13px',
    color: '#6B7280'
  },
  statItem: {},
  statDivider: {
    color: '#E5E5E5'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    backgroundColor: '#F9FAFB',
    border: '1px dashed #E5E5E5'
  },
  emptyText: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '0 0 8px 0'
  },
  emptySubtext: {
    fontSize: '12px',
    color: '#9CA3AF',
    margin: 0
  }
};
