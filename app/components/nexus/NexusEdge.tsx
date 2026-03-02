'use client';

import React from 'react';
import type { RelationType, InterLayerConnectionType } from '@/app/types/causal';

export interface NexusEdgeData {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  relationType: RelationType | InterLayerConnectionType;
  confidence: number;
  isInterLayer?: boolean;
  isHighlighted?: boolean;
  animationDelay?: number;
  causeText?: string;
  effectText?: string;
}

const EDGE_COLORS: Record<string, string> = {
  causes: '#E2E8F0',
  triggers: '#60A5FA',
  enables: '#06B6D4',
  prevents: '#EF4444',
  leads_to: '#64748B',
  relates_to: '#475569',
};

interface NexusEdgeProps {
  edge: NexusEdgeData;
  onMouseEnter?: (edge: NexusEdgeData, e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

export default function NexusEdge({ edge, onMouseEnter, onMouseLeave }: NexusEdgeProps) {
  const color = EDGE_COLORS[edge.relationType] || '#64748B';
  const strokeWidth = Math.max(1, Math.min(4, edge.confidence * 4));
  const isDashed = edge.relationType === 'prevents' || edge.relationType === 'leads_to';
  const filterId = `edge-glow-${edge.id}`;

  // Bezier control points: curve towards center for visual flow
  const dx = edge.targetX - edge.sourceX;
  const dy = edge.targetY - edge.sourceY;
  const midX = (edge.sourceX + edge.targetX) / 2;
  const midY = (edge.sourceY + edge.targetY) / 2;

  // Offset control points perpendicular to the line
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const curvature = Math.min(50, len * 0.15);
  const nx = -dy / len;
  const ny = dx / len;

  const cx1 = midX + nx * curvature;
  const cy1 = midY + ny * curvature;

  const pathD = `M ${edge.sourceX} ${edge.sourceY} Q ${cx1} ${cy1} ${edge.targetX} ${edge.targetY}`;

  const delay = edge.animationDelay || 0;

  return (
    <g
      onMouseEnter={(e) => onMouseEnter?.(edge, e)}
      onMouseLeave={onMouseLeave}
    >
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
        </filter>
        <marker
          id={`arrow-${edge.id}`}
          viewBox="0 0 10 6"
          refX="9"
          refY="3"
          markerWidth="8"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 3 L 0 6 z" fill={color} opacity="0.7" />
        </marker>
      </defs>

      {/* Glow path (behind) */}
      {edge.isHighlighted && (
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 4}
          filter={`url(#${filterId})`}
          opacity={0.3}
        />
      )}

      {/* Main path */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={isDashed ? '8 4' : undefined}
        opacity={edge.isHighlighted ? 0.9 : 0.4}
        markerEnd={`url(#arrow-${edge.id})`}
        style={{ transition: 'opacity 0.3s ease' }}
      />

      {/* Animated particle overlay */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={Math.max(1, strokeWidth - 0.5)}
        strokeDasharray="3 12"
        opacity={edge.isHighlighted ? 0.8 : 0.3}
        className="nexus-particle"
        style={{ animationDelay: `${delay}ms` }}
      />
    </g>
  );
}
