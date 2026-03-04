'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';

/**
 * MiniNexusPreview — Vertical SVG mini-nexus for synthesis sidebar.
 * Shows a topologically-sorted flow with distinct node shapes per type,
 * Bezier curve connections, predictions, and narrative arc indicator.
 */

interface MiniNode {
  id: string;
  label: string;
  type: string;
  source_syntheses?: string[];
  date?: string;
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
  narrativeArc?: string;
  timeline?: string[];
  relatedSyntheses?: { id: string; title: string; createdAt: string }[];
}

// Type colors (newspaper palette)
const TYPE_COLORS: Record<string, string> = {
  event: '#DC2626',
  entity: '#2563EB',
  decision: '#D97706',
  keyword: '#059669',
};

// Narrative arc phases
const ARC_PHASES = ['emerging', 'developing', 'peak', 'declining', 'resolved'];
const ARC_LABELS: Record<string, string> = {
  emerging: 'Emergent',
  developing: 'En cours',
  peak: 'Pic',
  declining: 'Declin',
  resolved: 'Resolu',
};

// Relation type colors for edges
const RELATION_COLORS: Record<string, string> = {
  causes: '#DC2626',
  triggers: '#D97706',
  enables: '#059669',
  prevents: '#6B7280',
  relates_to: '#9CA3AF',
};

function truncLabel(label: string, max: number = 28): string {
  if (!label) return '';
  return label.length > max ? label.slice(0, max - 1) + '\u2026' : label;
}

export default function MiniNexusPreview({
  nodes,
  edges,
  topicName,
  synthesisId,
  height = 550,
  narrativeArc,
  timeline,
  relatedSyntheses,
}: MiniNexusPreviewProps) {
  const router = useRouter();

  const layout = useMemo(() => {
    if (nodes.length === 0) return null;

    // Build adjacency
    const labelToId = new Map(nodes.map(nd => [nd.label, nd.id]));
    const idSet = new Set(nodes.map(nd => nd.id));

    // Resolve edges
    const resolvedEdges = edges
      .map(e => {
        let srcId = e.source || '';
        let tgtId = e.target || '';
        if (!idSet.has(srcId) && e.cause_text) srcId = labelToId.get(e.cause_text) || '';
        if (!idSet.has(tgtId) && e.effect_text) tgtId = labelToId.get(e.effect_text) || '';
        if (!srcId || !tgtId || srcId === tgtId) return null;
        return { srcId, tgtId, confidence: e.confidence || 0.5, type: e.relation_type || 'causes' };
      })
      .filter(Boolean) as { srcId: string; tgtId: string; confidence: number; type: string }[];

    // Compute in-degree for topological sort
    const incoming = new Map<string, Set<string>>();
    const outgoing = new Map<string, Set<string>>();
    for (const n of nodes) {
      incoming.set(n.id, new Set());
      outgoing.set(n.id, new Set());
    }
    for (const e of resolvedEdges) {
      outgoing.get(e.srcId)?.add(e.tgtId);
      incoming.get(e.tgtId)?.add(e.srcId);
    }

    // BFS topological sort
    const depth = new Map<string, number>();
    const queue: string[] = [];
    for (const n of nodes) {
      if ((incoming.get(n.id)?.size || 0) === 0) {
        depth.set(n.id, 0);
        queue.push(n.id);
      }
    }
    while (queue.length > 0) {
      const current = queue.shift()!;
      const d = depth.get(current) || 0;
      for (const next of outgoing.get(current) || []) {
        const existing = depth.get(next);
        if (existing === undefined || existing < d + 1) {
          depth.set(next, d + 1);
          queue.push(next);
        }
      }
    }
    // Unplaced nodes
    const maxDepth = Math.max(0, ...Array.from(depth.values()));
    for (const n of nodes) {
      if (!depth.has(n.id)) depth.set(n.id, Math.floor(maxDepth / 2));
    }

    // Find longest chain (main path) — max 8 nodes
    const chainNodes: string[] = [];
    const roots = nodes.filter(n => (incoming.get(n.id)?.size || 0) === 0);
    if (roots.length > 0) {
      // DFS for longest path from first root
      function findLongest(id: string, visited: Set<string>): string[] {
        if (visited.has(id)) return [];
        visited.add(id);
        let best: string[] = [id];
        for (const next of outgoing.get(id) || []) {
          const path = [id, ...findLongest(next, new Set(visited))];
          if (path.length > best.length) best = path;
        }
        return best;
      }
      const longestPath = findLongest(roots[0].id, new Set());
      chainNodes.push(...longestPath.slice(0, 8));
    }

    // If no chain found, take first 8 nodes by depth
    if (chainNodes.length === 0) {
      const sorted = [...nodes].sort((a, b) => (depth.get(a.id) || 0) - (depth.get(b.id) || 0));
      chainNodes.push(...sorted.slice(0, 8).map(n => n.id));
    }

    // Find branch nodes (connected to chain but not in it)
    const chainSet = new Set(chainNodes);
    const branchNodes: { id: string; parentIdx: number; side: 'left' | 'right' }[] = [];
    let branchSide: 'left' | 'right' = 'right';
    for (let i = 0; i < chainNodes.length && branchNodes.length < 4; i++) {
      const nodeId = chainNodes[i];
      for (const child of outgoing.get(nodeId) || []) {
        if (!chainSet.has(child) && branchNodes.length < 4) {
          branchNodes.push({ id: child, parentIdx: i, side: branchSide });
          branchSide = branchSide === 'right' ? 'left' : 'right';
        }
      }
    }

    // Position nodes vertically
    const viewWidth = 400;
    const topMargin = 40;
    const bottomReserved = narrativeArc ? 80 : 30;
    const availableHeight = height - topMargin - bottomReserved;
    const ySpacing = Math.min(60, availableHeight / (chainNodes.length + 1));
    const centerX = viewWidth / 2;

    const positioned: { id: string; x: number; y: number; node: MiniNode; isHighlighted: boolean; isBranch: boolean }[] = [];

    // Main chain
    chainNodes.forEach((nodeId, i) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      const isHighlighted = node.source_syntheses?.includes(synthesisId) ?? false;
      positioned.push({
        id: nodeId,
        x: centerX,
        y: topMargin + (i + 1) * ySpacing,
        node,
        isHighlighted,
        isBranch: false,
      });
    });

    // Branch nodes
    branchNodes.forEach(({ id: branchId, parentIdx, side }) => {
      const node = nodes.find(n => n.id === branchId);
      if (!node) return;
      const parentPos = positioned.find(p => p.id === chainNodes[parentIdx]);
      if (!parentPos) return;
      const isHighlighted = node.source_syntheses?.includes(synthesisId) ?? false;
      positioned.push({
        id: branchId,
        x: side === 'right' ? centerX + 120 : centerX - 120,
        y: parentPos.y + ySpacing * 0.6,
        node,
        isHighlighted,
        isBranch: true,
      });
    });

    // Filter edges to only positioned nodes
    const posById = new Map(positioned.map(p => [p.id, p]));
    const visibleEdges = resolvedEdges
      .filter(e => posById.has(e.srcId) && posById.has(e.tgtId))
      .map(e => {
        const src = posById.get(e.srcId)!;
        const tgt = posById.get(e.tgtId)!;
        return { ...e, x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y };
      });

    return { positioned, edges: visibleEdges };
  }, [nodes, edges, synthesisId, height, narrativeArc]);

  if (!layout || layout.positioned.length === 0) {
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

  // Current arc phase index
  const arcIdx = narrativeArc ? ARC_PHASES.indexOf(narrativeArc) : -1;

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
        {/* Title */}
        <text x="200" y="20" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="2" fill="#6B7280" fontFamily="Georgia, serif">
          NEXUS CAUSAL
        </text>

        {/* Edges — Bezier curves */}
        {layout.edges.map((edge, i) => {
          const dx = edge.x2 - edge.x1;
          const dy = edge.y2 - edge.y1;
          const cx1 = edge.x1 + dx * 0.1;
          const cy1 = edge.y1 + dy * 0.5;
          const cx2 = edge.x2 - dx * 0.1;
          const cy2 = edge.y2 - dy * 0.5;
          const isHighlighted = layout.positioned.find(p => p.id === edge.srcId)?.isHighlighted;
          const edgeColor = isHighlighted
            ? RELATION_COLORS[edge.type] || '#DC2626'
            : '#D1D5DB';
          const strokeW = 1 + edge.confidence * 1.5;

          return (
            <g key={`e-${i}`}>
              <path
                d={`M ${edge.x1} ${edge.y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${edge.x2} ${edge.y2}`}
                fill="none"
                stroke={edgeColor}
                strokeWidth={strokeW}
                strokeOpacity={isHighlighted ? 0.7 : 0.35}
                markerEnd="url(#arrow)"
              />
            </g>
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9CA3AF" />
          </marker>
        </defs>

        {/* Nodes */}
        {layout.positioned.map((item) => {
          const color = item.isHighlighted
            ? '#DC2626'
            : (TYPE_COLORS[item.node.type] || '#6B7280');
          const r = item.isHighlighted ? 8 : 6;

          return (
            <g key={item.id}>
              {/* Node shape by type */}
              {item.node.type === 'event' && (
                <circle cx={item.x} cy={item.y} r={r}
                  fill={item.isHighlighted ? color : '#FFFFFF'}
                  stroke={color} strokeWidth={item.isHighlighted ? 2 : 1.5}
                />
              )}
              {item.node.type === 'entity' && (
                <rect x={item.x - r} y={item.y - r} width={r * 2} height={r * 2} rx={3}
                  fill={item.isHighlighted ? color : '#FFFFFF'}
                  stroke={color} strokeWidth={item.isHighlighted ? 2 : 1.5}
                />
              )}
              {item.node.type === 'decision' && (
                <polygon
                  points={`${item.x},${item.y - r} ${item.x + r},${item.y} ${item.x},${item.y + r} ${item.x - r},${item.y}`}
                  fill={item.isHighlighted ? color : '#FFFFFF'}
                  stroke={color} strokeWidth={item.isHighlighted ? 2 : 1.5}
                />
              )}
              {(item.node.type === 'keyword' || !['event', 'entity', 'decision'].includes(item.node.type)) && (
                <polygon
                  points={`${item.x - r * 0.5},${item.y - r} ${item.x + r * 0.5},${item.y - r} ${item.x + r},${item.y} ${item.x + r * 0.5},${item.y + r} ${item.x - r * 0.5},${item.y + r} ${item.x - r},${item.y}`}
                  fill={item.isHighlighted ? color : '#FFFFFF'}
                  stroke={color} strokeWidth={item.isHighlighted ? 2 : 1.5}
                />
              )}

              {/* Label */}
              <text
                x={item.isBranch ? (item.x > 200 ? item.x + 14 : item.x - 14) : item.x + 14}
                y={item.y + 4}
                textAnchor={item.isBranch && item.x < 200 ? 'end' : 'start'}
                fontSize="12"
                fontFamily="Georgia, serif"
                fill={item.isHighlighted ? '#000' : '#374151'}
                fontWeight={item.isHighlighted ? 600 : 400}
              >
                {truncLabel(item.node.label)}
              </text>
            </g>
          );
        })}

        {/* Narrative Arc indicator at bottom */}
        {narrativeArc && arcIdx >= 0 && (
          <g>
            {/* Separator */}
            <line x1="40" y1={height - 55} x2="360" y2={height - 55} stroke="#E5E5E5" strokeWidth="1" strokeDasharray="4,3" />

            {/* Arc dots */}
            {ARC_PHASES.map((phase, i) => {
              const dotX = 80 + i * 60;
              const dotY = height - 35;
              const isActive = i <= arcIdx;
              const isCurrent = i === arcIdx;
              return (
                <g key={phase}>
                  <circle
                    cx={dotX}
                    cy={dotY}
                    r={isCurrent ? 6 : 4}
                    fill={isActive ? '#000' : '#D1D5DB'}
                    stroke={isCurrent ? '#000' : 'none'}
                    strokeWidth={isCurrent ? 2 : 0}
                  />
                  {isCurrent && (
                    <text x={dotX} y={dotY + 16} textAnchor="middle" fontSize="9" fill="#000" fontWeight="600" fontFamily="Georgia, serif">
                      {ARC_LABELS[phase] || phase}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Connecting line between dots */}
            <line x1="80" y1={height - 35} x2={80 + 4 * 60} y2={height - 35} stroke="#E5E5E5" strokeWidth="1" />
          </g>
        )}
      </svg>

      {/* Overlay hint */}
      <div style={{
        position: 'absolute',
        bottom: '4px',
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
