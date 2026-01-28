'use client';

import React from 'react';
import {
  CausalNode,
  CausalEdge,
  RELATION_CONFIG,
  getConfidenceLevel,
  formatConfidencePercent,
} from '@/app/types/causal';

interface NodeDetailPanelProps {
  node: CausalNode | null;
  incomingEdges: CausalEdge[];
  outgoingEdges: CausalEdge[];
  onClose: () => void;
}

export default function NodeDetailPanel({
  node,
  incomingEdges,
  outgoingEdges,
  onClose,
}: NodeDetailPanelProps) {
  if (!node) return null;

  const nodeTypeLabels: Record<string, { label: string; color: string }> = {
    event: { label: 'Evenement', color: '#2563EB' },
    entity: { label: 'Entite', color: '#8B5CF6' },
    decision: { label: 'Decision', color: '#F59E0B' },
  };

  const typeConfig = nodeTypeLabels[node.node_type] || nodeTypeLabels.event;
  const confidenceLevel = getConfidenceLevel(node.fact_density);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <span
              style={{
                ...styles.typeBadge,
                backgroundColor: typeConfig.color,
              }}
            >
              {typeConfig.label}
            </span>
            <h3 style={styles.title}>{node.label}</h3>
          </div>
          <button style={styles.closeButton} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Metrics */}
        <div style={styles.metricsBar}>
          <div style={styles.metric}>
            <span style={styles.metricLabel}>Densite factuelle</span>
            <div style={styles.metricValue}>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${node.fact_density * 100}%`,
                    backgroundColor: confidenceLevel.color,
                  }}
                />
              </div>
              <span style={{ color: confidenceLevel.color }}>
                {formatConfidencePercent(node.fact_density)}
              </span>
            </div>
          </div>
          {node.date && (
            <div style={styles.metric}>
              <span style={styles.metricLabel}>Date</span>
              <span style={styles.metricDate}>{node.date}</span>
            </div>
          )}
        </div>

        {/* Incoming edges (CAUSES this node) */}
        {incomingEdges.length > 0 && (
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>↓</span>
              Causes ({incomingEdges.length})
            </h4>
            <div style={styles.edgesList}>
              {incomingEdges.map((edge, idx) => {
                const config = RELATION_CONFIG[edge.relation_type];
                return (
                  <div key={idx} style={styles.edgeCard}>
                    <div style={styles.edgeHeader}>
                      <span
                        style={{
                          ...styles.edgeType,
                          backgroundColor: config?.bgColor || '#F3F4F6',
                          color: config?.color || '#6B7280',
                        }}
                      >
                        {config?.icon} {config?.labelFr}
                      </span>
                      <span style={styles.edgeConfidence}>
                        {formatConfidencePercent(edge.confidence)}
                      </span>
                    </div>
                    <p style={styles.edgeText}>{edge.cause_text}</p>
                    {edge.source_articles && edge.source_articles.length > 0 && (
                      <div style={styles.sourceTags}>
                        {edge.source_articles.slice(0, 3).map((source, sIdx) => (
                          <span key={sIdx} style={styles.sourceTag}>
                            {source}
                          </span>
                        ))}
                        {edge.source_articles.length > 3 && (
                          <span style={styles.moreTag}>
                            +{edge.source_articles.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Outgoing edges (EFFECTS of this node) */}
        {outgoingEdges.length > 0 && (
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>↑</span>
              Effets ({outgoingEdges.length})
            </h4>
            <div style={styles.edgesList}>
              {outgoingEdges.map((edge, idx) => {
                const config = RELATION_CONFIG[edge.relation_type];
                return (
                  <div key={idx} style={styles.edgeCard}>
                    <div style={styles.edgeHeader}>
                      <span
                        style={{
                          ...styles.edgeType,
                          backgroundColor: config?.bgColor || '#F3F4F6',
                          color: config?.color || '#6B7280',
                        }}
                      >
                        {config?.icon} {config?.labelFr}
                      </span>
                      <span style={styles.edgeConfidence}>
                        {formatConfidencePercent(edge.confidence)}
                      </span>
                    </div>
                    <p style={styles.edgeText}>{edge.effect_text}</p>
                    {edge.evidence && edge.evidence.length > 0 && (
                      <div style={styles.evidenceSection}>
                        <span style={styles.evidenceLabel}>Preuves:</span>
                        {edge.evidence.slice(0, 2).map((ev, eIdx) => (
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
          </div>
        )}

        {/* No connections */}
        {incomingEdges.length === 0 && outgoingEdges.length === 0 && (
          <div style={styles.emptyConnections}>
            <p>Aucune connexion causale directe</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  panel: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    border: '1px solid #E5E5E5',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px',
    borderBottom: '2px solid #000000',
    backgroundColor: '#FAFAFA',
  },
  headerContent: {
    flex: 1,
  },
  typeBadge: {
    display: 'inline-block',
    color: '#FFFFFF',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    padding: '4px 8px',
    marginBottom: '8px',
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: '18px',
    fontWeight: 700,
    color: '#000000',
    margin: 0,
    lineHeight: 1.3,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    color: '#6B7280',
    marginLeft: '16px',
  },
  metricsBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px 20px',
    backgroundColor: '#F9FAFB',
    borderBottom: '1px solid #E5E5E5',
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  metricLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  metricValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  progressBar: {
    flex: 1,
    height: '6px',
    backgroundColor: '#E5E5E5',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  metricDate: {
    fontSize: '13px',
    color: '#374151',
  },
  section: {
    padding: '16px 20px',
    borderBottom: '1px solid #E5E5E5',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '0 0 12px 0',
  },
  sectionIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    backgroundColor: '#E5E5E5',
    borderRadius: '50%',
    fontSize: '12px',
  },
  edgesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  edgeCard: {
    padding: '12px',
    backgroundColor: '#FAFAFA',
    border: '1px solid #E5E5E5',
  },
  edgeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  edgeType: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  edgeConfidence: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#6B7280',
  },
  edgeText: {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    lineHeight: 1.5,
    color: '#1F2937',
    margin: 0,
  },
  sourceTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '10px',
  },
  sourceTag: {
    backgroundColor: '#E5E7EB',
    padding: '3px 8px',
    fontSize: '10px',
    color: '#4B5563',
  },
  moreTag: {
    backgroundColor: '#D1D5DB',
    padding: '3px 8px',
    fontSize: '10px',
    color: '#6B7280',
    fontStyle: 'italic',
  },
  evidenceSection: {
    marginTop: '10px',
    paddingTop: '10px',
    borderTop: '1px solid #E5E5E5',
  },
  evidenceLabel: {
    display: 'block',
    fontSize: '10px',
    fontWeight: 600,
    color: '#6B7280',
    marginBottom: '6px',
  },
  evidenceText: {
    fontFamily: 'Georgia, serif',
    fontSize: '12px',
    fontStyle: 'italic',
    color: '#4B5563',
    margin: '0 0 6px 0',
    paddingLeft: '10px',
    borderLeft: '2px solid #E5E5E5',
  },
  emptyConnections: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: '13px',
  },
};
