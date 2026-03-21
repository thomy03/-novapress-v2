'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { causalService } from '@/app/lib/api/services/causal';
import type { CausalGraphResponse } from '@/app/types/causal';

interface NexusMiniPreviewProps {
  synthesisId: string;
  causalData?: CausalGraphResponse | null;
  causalLoading?: boolean;
}

export default function NexusMiniPreview({ synthesisId, causalData, causalLoading }: NexusMiniPreviewProps) {
  const [data, setData] = useState<CausalGraphResponse | null>(causalData || null);
  const [loading, setLoading] = useState(causalLoading ?? !causalData);

  useEffect(() => {
    if (causalData !== undefined) {
      setData(causalData);
      setLoading(causalLoading ?? false);
      return;
    }
    const fetch = async () => {
      try {
        const result = await causalService.getCausalGraph(synthesisId);
        setData(result);
      } catch {
        // Silently fail — preview is optional
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [synthesisId, causalData, causalLoading]);

  // Compute mini-node positions
  const miniNodes = useMemo(() => {
    if (!data || data.nodes.length === 0) return [];
    const w = 280;
    const h = 160;
    const cx = w / 2;
    const cy = h / 2;
    return data.nodes.slice(0, 8).map((node, i) => {
      const angle = (2 * Math.PI * i) / Math.min(data.nodes.length, 8);
      const r = 40 + Math.random() * 20;
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        radius: 3 + node.fact_density * 4,
        isCentral: node.label === data.central_entity,
      };
    });
  }, [data]);

  // Compute mini-edges
  const miniEdges = useMemo(() => {
    if (!data || data.edges.length === 0 || miniNodes.length === 0) return [];
    return data.edges.slice(0, 6).map((edge, i) => {
      const srcIdx = data.nodes.findIndex((n) => n.label === edge.cause_text);
      const tgtIdx = data.nodes.findIndex((n) => n.label === edge.effect_text);
      const src = miniNodes[Math.min(srcIdx, miniNodes.length - 1)] || miniNodes[0];
      const tgt = miniNodes[Math.min(tgtIdx, miniNodes.length - 1)] || miniNodes[1 % miniNodes.length];
      return { id: i, x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y };
    });
  }, [data, miniNodes]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingShimmer} />
        <p style={styles.loadingText}>Chargement du Nexus...</p>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1">
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="18" r="3" />
            <path d="M9 6h6M6 9v6M18 9v6M9 18h6" />
          </svg>
          <p style={styles.emptyText}>Nexus causal en attente</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Mini SVG preview */}
      <div style={styles.previewWrapper}>
        <svg width="100%" height="160" viewBox="0 0 280 160">
          {/* Background grid */}
          <defs>
            <pattern id="mini-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(59, 130, 246, 0.05)" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="mini-vignette" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
            </radialGradient>
          </defs>
          <rect width="280" height="160" fill="url(#mini-grid)" />
          <rect width="280" height="160" fill="url(#mini-vignette)" />

          {/* Mini edges */}
          {miniEdges.map((edge) => (
            <line
              key={edge.id}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke="#3B82F6"
              strokeWidth={0.8}
              opacity={0.3}
            />
          ))}

          {/* Mini nodes */}
          {miniNodes.map((node, i) => (
            <g key={i}>
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius * 2}
                fill={node.isCentral ? 'rgba(59, 130, 246, 0.2)' : 'rgba(6, 182, 212, 0.15)'}
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill={node.isCentral ? '#3B82F6' : '#06B6D4'}
                opacity={0.8}
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Stats bar */}
      <div style={styles.stats}>
        <span>{data.nodes.length} noeuds</span>
        <span style={styles.statDivider}>&middot;</span>
        <span>{data.edges.length} relations</span>
      </div>

      {/* CTA */}
      <Link href={`/synthesis/${synthesisId}/nexus`} style={styles.cta}>
        Explorer le Nexus Causal
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#0A0F1A',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid rgba(59, 130, 246, 0.15)',
  },
  previewWrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    fontSize: '10px',
    color: '#64748B',
    fontFamily: 'var(--font-label)',
    borderTop: '1px solid rgba(59, 130, 246, 0.1)',
  },
  statDivider: {
    color: '#334155',
  },
  cta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 14px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#3B82F6',
    textDecoration: 'none',
    borderTop: '1px solid rgba(59, 130, 246, 0.1)',
    transition: 'background-color 0.2s ease',
    backgroundColor: 'transparent',
    minHeight: '44px',
  },
  loadingShimmer: {
    height: '160px',
    background: 'linear-gradient(90deg, #0A0F1A 0%, #111827 50%, #0A0F1A 100%)',
    backgroundSize: '1000px 100%',
    animation: 'shimmer 2s infinite linear',
  },
  loadingText: {
    padding: '10px',
    fontSize: '10px',
    color: '#475569',
    textAlign: 'center' as const,
    fontFamily: 'var(--font-label)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px',
    gap: '12px',
  },
  emptyText: {
    fontSize: '12px',
    color: '#475569',
  },
};
