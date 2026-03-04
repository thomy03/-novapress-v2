'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';

/**
 * MiniNexusPreview — Pure SVG mini-graph for synthesis sidebar.
 * Replaces the ReactFlow compact graph with a lightweight circular layout.
 * Highlights nodes linked to the current synthesis in red.
 */

interface MiniNode {
  id: string;
  label: string;
  type: string;
  source_syntheses?: string[];
}

interface MiniEdge {
  source?: string;
  target?: string;
  cause_text?: string;
  effect_text?: string;
  relation_type?: string;
  confidence?: number;
  source_syntheses?: string[];
}

interface MiniNexusPreviewProps {
  nodes: MiniNode[];
  edges: MiniEdge[];
  topicName: string;
  synthesisId: string;
  height?: number;
}

// Truncate label to max chars
function truncLabel(label: string, max: number = 22): string {
  if (!label) return '';
  return label.length > max ? label.slice(0, max - 1) + '\u2026' : label;
}

// Type colors (newspaper palette)
const TYPE_COLORS: Record<string, string> = {
  event: '#DC2626',
  entity: '#2563EB',
  decision: '#D97706',
  keyword: '#059669',
};

export default function MiniNexusPreview({
  nodes,
  edges,
  topicName,
  synthesisId,
  height = 300,
}: MiniNexusPreviewProps) {
  const router = useRouter();

  // Build positions for circular layout
  const layout = useMemo(() => {
    const displayNodes = nodes.slice(0, 25);
    const n = displayNodes.length;
    if (n === 0) return { nodes: [], edges: [] };

    const cx = 200;
    const cy = height / 2;
    const rx = 150;
    const ry = (height / 2) - 40;

    // Build label-to-id map for edge resolution
    const labelToId = new Map(displayNodes.map(nd => [nd.label, nd.id]));
    const idSet = new Set(displayNodes.map(nd => nd.id));

    const positioned = displayNodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);

      // Check if this node is linked to the current synthesis
      const isHighlighted = node.source_syntheses?.includes(synthesisId) ?? false;

      return { ...node, x, y, isHighlighted };
    });

    // Resolve edges
    const posById = new Map(positioned.map(p => [p.id, p]));

    const resolvedEdges = edges
      .map(e => {
        // Edges can reference by id (source/target) or by label (cause_text/effect_text)
        let srcId = e.source || '';
        let tgtId = e.target || '';

        if (!idSet.has(srcId) && e.cause_text) {
          srcId = labelToId.get(e.cause_text) || '';
        }
        if (!idSet.has(tgtId) && e.effect_text) {
          tgtId = labelToId.get(e.effect_text) || '';
        }

        const src = posById.get(srcId);
        const tgt = posById.get(tgtId);
        if (!src || !tgt || srcId === tgtId) return null;

        const isHighlighted = e.source_syntheses?.includes(synthesisId) ?? false;

        return {
          x1: src.x,
          y1: src.y,
          x2: tgt.x,
          y2: tgt.y,
          confidence: e.confidence || 0.5,
          isHighlighted,
        };
      })
      .filter(Boolean) as { x1: number; y1: number; x2: number; y2: number; confidence: number; isHighlighted: boolean }[];

    return { nodes: positioned, edges: resolvedEdges };
  }, [nodes, edges, synthesisId, height]);

  if (layout.nodes.length === 0) {
    return (
      <div style={{
        height: `${height}px`,
        backgroundColor: '#F9FAFB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        color: '#9CA3AF',
        fontStyle: 'italic',
      }}>
        Pas de donnees causales
      </div>
    );
  }

  const handleClick = () => {
    router.push(`/topics/${encodeURIComponent(topicName)}?tab=causal`);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        cursor: 'pointer',
        backgroundColor: '#F9FAFB',
        border: '1px solid #E5E5E5',
        position: 'relative',
      }}
      title={`Voir le Nexus Causal : ${topicName}`}
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 400 ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        {/* Edges */}
        {layout.edges.map((edge, i) => (
          <line
            key={`e-${i}`}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke={edge.isHighlighted ? '#DC2626' : '#D1D5DB'}
            strokeWidth={edge.isHighlighted ? 1.5 : 0.8}
            strokeOpacity={edge.isHighlighted ? 0.7 : 0.3}
          />
        ))}

        {/* Nodes */}
        {layout.nodes.map((node) => {
          const color = node.isHighlighted
            ? '#DC2626'
            : (TYPE_COLORS[node.type] || '#6B7280');

          return (
            <g key={node.id}>
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.isHighlighted ? 7 : 5}
                fill={node.isHighlighted ? color : '#FFFFFF'}
                stroke={color}
                strokeWidth={node.isHighlighted ? 2 : 1.5}
              />
              {/* Label */}
              <text
                x={node.x}
                y={node.y + (node.isHighlighted ? 16 : 14)}
                textAnchor="middle"
                fontSize="9"
                fontFamily="Georgia, serif"
                fill={node.isHighlighted ? '#000' : '#6B7280'}
                fontWeight={node.isHighlighted ? 600 : 400}
              >
                {truncLabel(node.label)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Overlay hint */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '0',
        right: '0',
        textAlign: 'center',
        fontSize: '10px',
        color: '#9CA3AF',
        letterSpacing: '0.5px',
      }}>
        Cliquer pour explorer le nexus complet
      </div>
    </div>
  );
}
