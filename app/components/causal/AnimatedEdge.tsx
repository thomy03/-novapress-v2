'use client';

import React, { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { RelationType, RELATION_CONFIG } from '@/app/types/causal';

export interface AnimatedEdgeData {
  relationType?: RelationType;
  confidence?: number;
  sourceArticlesCount?: number;
  isAnimated?: boolean;
  cascadeLevel?: number;
}

// Edge style configurations
const EDGE_DASH_PATTERNS: Record<RelationType, string> = {
  causes: '0',           // Solid line
  triggers: '8,4',       // Dashed
  enables: '4,2',        // Short dashes
  prevents: '12,4,4,4',  // Double dash
  relates_to: '2,2',     // Dotted line
};

// Cascade colors for propagation effect
const CASCADE_COLORS = [
  '#DC2626', // Red
  '#F97316', // Orange
  '#FBBF24', // Yellow
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
];

function AnimatedEdgeComponent({
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
}: EdgeProps<AnimatedEdgeData>) {
  const relationType = data?.relationType || 'causes';
  const confidence = data?.confidence || 0.5;
  const sourcesCount = data?.sourceArticlesCount || 1;
  const isAnimated = data?.isAnimated || false;
  const cascadeLevel = data?.cascadeLevel || 0;

  // Dynamic thickness based on confidence and sources count (2-5px) - MORE VISIBLE
  const strokeWidth = Math.min(5, Math.max(2, 2 + confidence * 2 + sourcesCount * 0.3));

  // Get color - use cascade color if animated, otherwise relation color
  const relationConfig = RELATION_CONFIG[relationType];
  const edgeColor = isAnimated
    ? CASCADE_COLORS[Math.min(cascadeLevel, CASCADE_COLORS.length - 1)]
    : relationConfig?.color || '#374151';

  // Calculate path
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  // Opacity based on confidence - HIGHER MINIMUM for visibility
  const opacity = 0.6 + confidence * 0.4;

  // Highlight high-confidence edges
  const isHighConfidence = confidence >= 0.7;

  return (
    <>
      {/* Background glow for ALL edges - base visibility */}
      <path
        d={edgePath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={strokeWidth + 6}
        strokeOpacity={isAnimated ? 0.25 : isHighConfidence ? 0.15 : 0.08}
        strokeLinecap="round"
        className={isAnimated ? 'neural-edge-glow' : ''}
      />

      {/* Secondary glow for high-confidence or animated edges */}
      {(isAnimated || isHighConfidence) && (
        <path
          d={edgePath}
          fill="none"
          stroke={edgeColor}
          strokeWidth={strokeWidth + 3}
          strokeOpacity={isAnimated ? 0.4 : 0.2}
          strokeLinecap="round"
        />
      )}

      {/* Main edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={opacity}
        strokeDasharray={isAnimated ? '8,4' : EDGE_DASH_PATTERNS[relationType]}
        strokeLinecap="round"
        className={isAnimated ? 'neural-edge-active' : ''}
        markerEnd={markerEnd}
        style={{
          ...style,
          transition: 'all 0.3s ease',
        }}
      />

      {/* Animated particles along the edge */}
      {isAnimated && (
        <>
          <circle r={4} fill={edgeColor} className="neural-edge-particle">
            <animateMotion dur="1s" repeatCount="indefinite">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          <circle r={3} fill={edgeColor} opacity={0.6} className="neural-edge-particle">
            <animateMotion dur="1s" repeatCount="indefinite" begin="0.33s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
          <circle r={2} fill={edgeColor} opacity={0.4} className="neural-edge-particle">
            <animateMotion dur="1s" repeatCount="indefinite" begin="0.66s">
              <mpath href={`#${id}`} />
            </animateMotion>
          </circle>
        </>
      )}

      {/* Edge label with relation type */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: isAnimated ? edgeColor : '#FFFFFF',
              color: isAnimated ? '#FFFFFF' : edgeColor,
              border: `1px solid ${edgeColor}`,
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '9px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: isAnimated
                ? `0 0 10px ${edgeColor}40`
                : '0 1px 3px rgba(0,0,0,0.1)',
              transition: 'all 0.3s ease',
            }}
          >
            <span>{relationConfig?.icon || '→'}</span>
            <span>{Math.round(confidence * 100)}%</span>
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(AnimatedEdgeComponent);
