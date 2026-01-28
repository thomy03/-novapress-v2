'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeType } from '@/app/types/causal';

export interface TangleNodeData {
  label: string;
  nodeType: NodeType;
  importance: number; // 0-1, affects size
  isHighlighted?: boolean;
  isSource?: boolean;
  connectionsCount?: number;
}

// Node colors by type
const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string }> = {
  entity: { bg: '#DBEAFE', border: '#1E40AF', text: '#1E40AF' },
  event: { bg: '#FEE2E2', border: '#DC2626', text: '#DC2626' },
  decision: { bg: '#D1FAE5', border: '#059669', text: '#059669' },
  keyword: { bg: '#FEF3C7', border: '#D97706', text: '#D97706' },  // Yellow/amber for keywords
};

function TangleNodeComponent({ data, selected }: NodeProps<TangleNodeData>) {
  const {
    label,
    nodeType = 'entity',
    importance = 0.5,
    isHighlighted = false,
    isSource = false,
    connectionsCount = 0,
  } = data;

  const colors = NODE_COLORS[nodeType] || NODE_COLORS.entity;

  // Size based on importance (like Neo4j - bigger = more important)
  const baseSize = 40;
  const size = baseSize + importance * 30 + connectionsCount * 3;

  // Truncate label if too long
  const displayLabel = label.length > 20 ? label.slice(0, 18) + '...' : label;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Glow for highlighted/source nodes */}
      {(isHighlighted || isSource) && (
        <div
          style={{
            position: 'absolute',
            width: size + 20,
            height: size + 20,
            borderRadius: '50%',
            background: isSource
              ? 'radial-gradient(circle, rgba(220,38,38,0.3) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(30,64,175,0.3) 0%, transparent 70%)',
            animation: 'pulse 2s ease-in-out infinite',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />
      )}

      {/* Main node circle */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: isHighlighted || selected ? colors.border : colors.bg,
          border: `3px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          transition: 'all 0.2s ease',
          boxShadow: isHighlighted || selected
            ? `0 0 20px ${colors.border}40`
            : '0 2px 8px rgba(0,0,0,0.1)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Inner content - icon or first letter */}
        <span
          style={{
            fontSize: Math.max(12, size / 3),
            fontWeight: 700,
            color: isHighlighted || selected ? '#FFFFFF' : colors.text,
            textTransform: 'uppercase',
          }}
        >
          {label.charAt(0)}
        </span>
      </div>

      {/* Label below node */}
      <div
        style={{
          marginTop: 8,
          maxWidth: 120,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 500,
          color: '#374151',
          lineHeight: 1.3,
          wordBreak: 'break-word',
          backgroundColor: isHighlighted ? '#FEF3C7' : 'transparent',
          padding: isHighlighted ? '2px 6px' : 0,
          borderRadius: 2,
        }}
      >
        {displayLabel}
      </div>

      {/* Connections badge */}
      {connectionsCount > 1 && (
        <div
          style={{
            position: 'absolute',
            top: -5,
            right: -5,
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: '#6B7280',
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #FFFFFF',
            zIndex: 2,
          }}
        >
          {connectionsCount}
        </div>
      )}

      {/* Connection handles - invisible but functional */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, width: 10, height: 10 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, width: 10, height: 10 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ opacity: 0, width: 10, height: 10 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ opacity: 0, width: 10, height: 10 }}
      />
    </div>
  );
}

export default memo(TangleNodeComponent);
