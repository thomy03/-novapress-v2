'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface FlowchartNodeData {
  label: string;
  nodeType: 'event' | 'entity' | 'decision' | 'keyword';
  mentionCount: number;
  firstSeen?: number;
  lastSeen?: number;
  isNew?: boolean;
  [key: string]: unknown;
}

const NODE_TYPE_STYLES: Record<string, { borderColor: string; bgColor: string }> = {
  event:    { borderColor: '#DC2626', bgColor: '#FFF5F5' },
  entity:   { borderColor: '#2563EB', bgColor: '#EFF6FF' },
  decision: { borderColor: '#6B7280', bgColor: '#F9FAFB' },
  keyword:  { borderColor: '#F59E0B', bgColor: '#FFFBEB' },
};

function formatTimestamp(ts: number | undefined): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return null;
  }
}

function FlowchartNode({ data }: NodeProps) {
  const nodeData = data as unknown as FlowchartNodeData;
  const { label, nodeType, mentionCount, firstSeen, lastSeen, isNew } = nodeData;
  const typeStyle = NODE_TYPE_STYLES[nodeType] || NODE_TYPE_STYLES.event;
  const borderWidth = Math.min(4, 1 + (mentionCount || 1));
  const firstSeenStr = formatTimestamp(firstSeen);
  const lastSeenStr = formatTimestamp(lastSeen);

  return (
    <div
      style={{
        backgroundColor: typeStyle.bgColor,
        borderLeft: `${borderWidth}px solid ${typeStyle.borderColor}`,
        borderTop: '1px solid #E5E5E5',
        borderRight: '1px solid #E5E5E5',
        borderBottom: '1px solid #E5E5E5',
        padding: '10px 14px',
        minWidth: '140px',
        maxWidth: '220px',
        position: 'relative',
        fontFamily: 'Georgia, "Times New Roman", serif',
        animation: isNew ? 'flowchartPulse 2s ease-in-out infinite' : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#6B7280', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ background: '#6B7280', width: 6, height: 6 }} />

      {/* Mention count badge */}
      {mentionCount > 1 && (
        <span style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          backgroundColor: '#000',
          color: '#FFF',
          fontSize: '10px',
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
          minWidth: '18px',
          height: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '9px',
          padding: '0 4px',
        }}>
          {mentionCount}
        </span>
      )}

      {/* Label */}
      <div style={{
        fontSize: '14px',
        fontWeight: 600,
        color: '#000',
        lineHeight: 1.3,
        marginBottom: (firstSeenStr || lastSeenStr) ? '6px' : 0,
        wordBreak: 'break-word',
      }}>
        {label}
      </div>

      {/* Dates */}
      {(firstSeenStr || lastSeenStr) && (
        <div style={{
          fontSize: '10px',
          color: '#9CA3AF',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          gap: '8px',
        }}>
          {firstSeenStr && <span>Apparu {firstSeenStr}</span>}
          {lastSeenStr && lastSeenStr !== firstSeenStr && <span>Confirm\u00e9 {lastSeenStr}</span>}
        </div>
      )}
    </div>
  );
}

export default memo(FlowchartNode);
