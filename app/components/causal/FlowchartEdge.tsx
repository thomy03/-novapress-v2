'use client';

import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { RelationType } from '@/app/types/causal';

export interface FlowchartEdgeData {
  relationType: RelationType;
  confidence: number;
  mentionCount: number;
  [key: string]: unknown;
}

const RELATION_LABELS_FR: Record<string, string> = {
  causes: 'cause',
  triggers: 'd\u00e9clenche',
  enables: 'permet',
  prevents: 'emp\u00eache',
  relates_to: 'li\u00e9 \u00e0',
};

const DASHED_TYPES = new Set(['enables', 'prevents', 'relates_to']);

function FlowchartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as unknown as FlowchartEdgeData;
  const { relationType, confidence, mentionCount } = edgeData;
  const opacity = 0.4 + (confidence || 0.5) * 0.6;
  const strokeWidth = Math.min(5, 1 + (mentionCount || 1) * 0.5);
  const isDashed = DASHED_TYPES.has(relationType);
  const labelFr = RELATION_LABELS_FR[relationType] || relationType;
  const confPct = Math.round((confidence || 0) * 100);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#374151',
          strokeWidth,
          opacity,
          strokeDasharray: isDashed ? '6 4' : undefined,
        }}
        markerEnd="url(#flowchart-arrow)"
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            fontSize: '10px',
            fontFamily: 'system-ui, sans-serif',
            color: '#374151',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '2px 6px',
            border: '1px solid #E5E5E5',
            whiteSpace: 'nowrap',
          }}
        >
          {labelFr} {confPct}%
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default FlowchartEdge;
