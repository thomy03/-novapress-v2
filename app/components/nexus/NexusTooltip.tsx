'use client';

import React from 'react';
import type { NexusNodeData } from './NexusNode';
import type { NexusEdgeData } from './NexusEdge';

interface NexusTooltipProps {
  node?: NexusNodeData | null;
  edge?: NexusEdgeData | null;
  x: number;
  y: number;
  visible: boolean;
}

const RELATION_LABELS: Record<string, string> = {
  causes: 'Cause',
  triggers: 'Declenche',
  enables: 'Permet',
  prevents: 'Empeche',
  leads_to: 'Mene a',
  relates_to: 'Lie a',
};

const ZONE_LABELS: Record<string, string> = {
  past: 'Fondation historique',
  present: 'Chaine causale actuelle',
  future: 'Scenario predictif',
};

export default function NexusTooltip({ node, edge, x, y, visible }: NexusTooltipProps) {
  if (!visible || (!node && !edge)) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: x + 16,
        top: y - 10,
        zIndex: 1000,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(4px)',
        transition: 'opacity 0.15s ease, transform 0.15s ease',
      }}
    >
      <div style={styles.card}>
        {node && (
          <>
            <div style={styles.header}>
              <span style={styles.badge}>{node.nodeType || 'event'}</span>
              <span style={{
                ...styles.zone,
                color: node.zone === 'past' ? '#06B6D4' : node.zone === 'present' ? '#3B82F6' : '#F59E0B'
              }}>
                {ZONE_LABELS[node.zone]}
              </span>
            </div>
            <div style={styles.label}>{node.label}</div>
            {node.factDensity !== undefined && (
              <div style={styles.meta}>
                Densite factuelle: {Math.round(node.factDensity * 100)}%
              </div>
            )}
          </>
        )}
        {edge && (
          <>
            <div style={styles.header}>
              <span style={styles.badge}>
                {RELATION_LABELS[edge.relationType] || edge.relationType}
              </span>
              <span style={styles.confidence}>
                {Math.round(edge.confidence * 100)}% confiance
              </span>
            </div>
            {edge.causeText && (
              <div style={styles.edgeLabel}>
                <span style={styles.edgeCause}>{edge.causeText}</span>
                <span style={styles.edgeArrow}> → </span>
                <span style={styles.edgeEffect}>{edge.effectText}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '8px',
    padding: '10px 14px',
    maxWidth: '280px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
  },
  badge: {
    fontSize: '9px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: '#94A3B8',
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    padding: '2px 6px',
    borderRadius: '3px',
  },
  zone: {
    fontSize: '9px',
    fontWeight: 500,
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#E2E8F0',
    lineHeight: 1.3,
    marginBottom: '4px',
  },
  meta: {
    fontSize: '10px',
    color: '#64748B',
  },
  confidence: {
    fontSize: '9px',
    color: '#94A3B8',
  },
  edgeLabel: {
    fontSize: '11px',
    color: '#CBD5E1',
    lineHeight: 1.4,
  },
  edgeCause: {
    color: '#93C5FD',
  },
  edgeArrow: {
    color: '#64748B',
  },
  edgeEffect: {
    color: '#FDE68A',
  },
};
