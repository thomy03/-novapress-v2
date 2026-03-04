'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';

export interface NeuralNodeData {
  label: string;
  nodeType: 'event' | 'entity' | 'decision' | 'keyword';
  factDensity: number;
  sourcesCount: number;
  isActivated?: boolean;
  isSource?: boolean;
  activationLevel?: number;
  confidence?: number;
}

// Shape configuration per node type
const NODE_SHAPE_CONFIG: Record<string, {
  borderRadius: string;
  clipPath?: string;
  inactiveBg: string;
  inactiveBorder: string;
  activeColor: string;
  labelFr: string;
}> = {
  event: {
    borderRadius: '50%',
    inactiveBg: '#FEF2F2',
    inactiveBorder: '#FCA5A5',
    activeColor: '#DC2626',
    labelFr: 'Evenement',
  },
  entity: {
    borderRadius: '8px',
    inactiveBg: '#EFF6FF',
    inactiveBorder: '#93C5FD',
    activeColor: '#2563EB',
    labelFr: 'Entite',
  },
  decision: {
    borderRadius: '4px',
    clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    inactiveBg: '#FFFBEB',
    inactiveBorder: '#FCD34D',
    activeColor: '#D97706',
    labelFr: 'Decision',
  },
  keyword: {
    borderRadius: '4px',
    clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
    inactiveBg: '#ECFDF5',
    inactiveBorder: '#6EE7B7',
    activeColor: '#059669',
    labelFr: 'Mot-cle',
  },
};

// Color gradient for cascade depth
const CASCADE_COLORS = [
  '#DC2626', // Red - source
  '#F97316', // Orange
  '#FBBF24', // Yellow
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Violet - furthest
];

function getCascadeColor(depth: number): string {
  return CASCADE_COLORS[Math.min(depth, CASCADE_COLORS.length - 1)];
}

function NeuralNodeComponent({ data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as NeuralNodeData;
  const isActive = selected || data.isActivated;
  const isSource = data.isSource;
  const activationLevel = data.activationLevel || 0;

  const shapeConfig = NODE_SHAPE_CONFIG[data.nodeType] || NODE_SHAPE_CONFIG.event;

  // DYNAMIC: More sources = More dendrites (3-8)
  const dendritesCount = Math.min(8, Math.max(3, data.sourcesCount || 4));

  // Node size — increased for readability
  const nodeSize = 70 + Math.min(data.sourcesCount || 1, 6) * 7;

  // Color based on activation level
  const activeColor = isSource ? '#DC2626' : getCascadeColor(activationLevel);

  // For diamond/hexagon shapes, use a larger container to avoid clipping dendrites
  const hasClipPath = !!shapeConfig.clipPath;
  // Diamond needs more space due to rotation
  const somaSize = hasClipPath ? nodeSize + 10 : nodeSize;

  return (
    <div
      style={{
        position: 'relative',
        width: `${nodeSize + 40}px`,
        height: `${nodeSize + 40}px`,
      }}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: isActive ? activeColor : '#9CA3AF',
          width: 8,
          height: 8,
          border: 'none',
        }}
      />

      {/* Dendrites (small radiating lines) */}
      {Array.from({ length: dendritesCount }).map((_, i) => {
        const angle = (360 / dendritesCount) * i;
        const dendLength = isActive ? 35 : 25;

        return (
          <div
            key={i}
            className={isActive ? 'neural-dendrite-active' : ''}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: `${dendLength}px`,
              height: '2px',
              background: isActive
                ? `linear-gradient(90deg, ${activeColor} 0%, transparent 100%)`
                : `linear-gradient(90deg, ${shapeConfig.inactiveBorder} 0%, transparent 100%)`,
              transformOrigin: '0 50%',
              transform: `rotate(${angle}deg)`,
              transition: 'all 0.4s ease',
              opacity: isActive ? 1 : 0.4,
            }}
          />
        );
      })}

      {/* Soma (central shape — varies by type) */}
      <div
        className={isActive ? 'neural-node-activated' : ''}
        title={`${data.label}\n${shapeConfig.labelFr}${data.confidence ? ` | Confiance: ${Math.round(data.confidence * 100)}%` : ''}`}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${somaSize}px`,
          height: `${somaSize}px`,
          borderRadius: hasClipPath ? undefined : shapeConfig.borderRadius,
          clipPath: shapeConfig.clipPath || undefined,
          background: isActive
            ? `radial-gradient(circle, ${activeColor} 0%, ${adjustColor(activeColor, -30)} 100%)`
            : shapeConfig.inactiveBg,
          border: hasClipPath ? undefined : `3px solid ${isActive ? adjustColor(activeColor, -20) : shapeConfig.inactiveBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isActive
            ? `0 0 30px ${hexToRgba(activeColor, 0.6)}, inset 0 0 15px rgba(255,255,255,0.3)`
            : `0 4px 12px rgba(0,0,0,0.08)`,
          transition: 'all 0.4s ease',
          cursor: 'pointer',
          zIndex: 10,
        }}
      >
        <span
          style={{
            color: isActive ? '#FFFFFF' : '#374151',
            fontSize: '14px',
            fontFamily: 'Georgia, serif',
            textAlign: 'center',
            padding: '8px',
            lineHeight: 1.2,
            fontWeight: isActive ? 600 : 500,
            maxWidth: `${somaSize - 16}px`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const,
          }}
        >
          {data.label?.length > 70 ? `${data.label.slice(0, 70)}...` : data.label}
        </span>
      </div>

      {/* Ripple effect on activation */}
      {isActive && (
        <>
          <div
            className="neural-ripple"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${nodeSize + 20}px`,
              height: `${nodeSize + 20}px`,
              borderRadius: '50%',
              border: `2px solid ${hexToRgba(activeColor, 0.5)}`,
              pointerEvents: 'none',
            }}
          />
          <div
            className="neural-ripple-delayed"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${nodeSize + 20}px`,
              height: `${nodeSize + 20}px`,
              borderRadius: '50%',
              border: `2px solid ${hexToRgba(activeColor, 0.3)}`,
              pointerEvents: 'none',
              animationDelay: '0.3s',
            }}
          />
        </>
      )}

      {/* Node type indicator — mini colored shape instead of text badge */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          backgroundColor: '#FFFFFF',
          padding: '2px 6px',
          borderRadius: '2px',
          border: `1px solid ${isActive ? activeColor : '#E5E5E5'}`,
        }}
      >
        {/* Mini shape icon */}
        <svg width="12" height="12" viewBox="0 0 12 12">
          {data.nodeType === 'event' && (
            <circle cx="6" cy="6" r="5" fill={isActive ? activeColor : shapeConfig.activeColor} opacity={isActive ? 1 : 0.6} />
          )}
          {data.nodeType === 'entity' && (
            <rect x="1" y="1" width="10" height="10" rx="2" fill={isActive ? activeColor : shapeConfig.activeColor} opacity={isActive ? 1 : 0.6} />
          )}
          {data.nodeType === 'decision' && (
            <polygon points="6,0.5 11.5,6 6,11.5 0.5,6" fill={isActive ? activeColor : shapeConfig.activeColor} opacity={isActive ? 1 : 0.6} />
          )}
          {data.nodeType === 'keyword' && (
            <polygon points="3,0.5 9,0.5 12,6 9,11.5 3,11.5 0,6" fill={isActive ? activeColor : shapeConfig.activeColor} opacity={isActive ? 1 : 0.6} />
          )}
        </svg>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: isActive ? activeColor : '#9CA3AF',
          width: 8,
          height: 8,
          border: 'none',
        }}
      />
    </div>
  );
}

// Helper: Adjust hex color brightness
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Helper: Convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default memo(NeuralNodeComponent);
