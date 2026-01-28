'use client';

import React, { memo, useMemo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { RELATION_CONFIG } from '@/app/types/causal';

export interface TangleEdgeData {
  relationType?: 'causes' | 'triggers' | 'enables' | 'prevents' | 'relates_to';
  confidence?: number;
  sourceArticlesCount?: number;
  isHighlighted?: boolean;
  label?: string;
}

// Color scheme matching your reference images
const EDGE_COLORS: Record<string, string> = {
  causes: '#1E40AF',      // Blue (like the first image)
  triggers: '#DC2626',    // Red (like the first image)
  enables: '#059669',     // Green
  prevents: '#7C3AED',    // Purple
  relates_to: '#6B7280',  // Gray (neutral relation)
};

function TangleEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps<TangleEdgeData>) {
  const relationType = data?.relationType || 'causes';
  const confidence = data?.confidence || 0.5;
  const sourcesCount = data?.sourceArticlesCount || 1;
  const isHighlighted = data?.isHighlighted || false;

  // Calculate curved path with organic curvature
  const curvature = useMemo(() => {
    // Create organic curves by varying curvature based on distance
    const dx = Math.abs(targetX - sourceX);
    const dy = Math.abs(targetY - sourceY);
    const distance = Math.sqrt(dx * dx + dy * dy);

    // More curve for closer nodes, less for distant ones
    return Math.min(0.5, Math.max(0.15, 150 / distance));
  }, [sourceX, sourceY, targetX, targetY]);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature,
  });

  // Dynamic styling based on confidence and highlight
  const strokeWidth = isHighlighted
    ? 3 + confidence * 2
    : 1.5 + confidence * 1.5 + sourcesCount * 0.2;

  const opacity = isHighlighted ? 1 : 0.6 + confidence * 0.3;
  const edgeColor = EDGE_COLORS[relationType] || EDGE_COLORS.causes;

  return (
    <>
      {/* Glow effect for highlighted edges */}
      {isHighlighted && (
        <path
          d={edgePath}
          fill="none"
          stroke={edgeColor}
          strokeWidth={strokeWidth + 8}
          strokeOpacity={0.2}
          strokeLinecap="round"
          style={{ filter: 'blur(4px)' }}
        />
      )}

      {/* Shadow for depth */}
      <path
        d={edgePath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={strokeWidth + 2}
        strokeOpacity={isHighlighted ? 0.3 : 0.1}
        strokeLinecap="round"
      />

      {/* Main edge */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
        strokeLinecap="round"
        markerEnd={markerEnd}
        style={{
          ...style,
          transition: 'all 0.3s ease',
          cursor: 'pointer',
        }}
      />

      {/* Confidence label on hover - positioned along the edge */}
      {isHighlighted && data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              backgroundColor: edgeColor,
              color: '#FFFFFF',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              whiteSpace: 'nowrap',
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(TangleEdgeComponent);
