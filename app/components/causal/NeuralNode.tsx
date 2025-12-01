'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export interface NeuralNodeData {
  label: string;
  nodeType: 'event' | 'entity' | 'decision';
  factDensity: number;
  sourcesCount: number;
  isActivated?: boolean;
  isSource?: boolean;
  activationLevel?: number;
  confidence?: number;
}

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

function NeuralNodeComponent({ data, selected }: NodeProps<NeuralNodeData>) {
  const isActive = selected || data.isActivated;
  const isSource = data.isSource;
  const activationLevel = data.activationLevel || 0;

  // DYNAMIC: More sources = More dendrites (3-8)
  const dendritesCount = Math.min(8, Math.max(3, data.sourcesCount || 4));

  // Node size based on importance (fact density)
  const baseSize = 60;
  const nodeSize = baseSize + (data.factDensity || 0.5) * 20;

  // Color based on activation level
  const activeColor = isSource ? '#DC2626' : getCascadeColor(activationLevel);

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
        position={Position.Top}
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
                : 'linear-gradient(90deg, #9CA3AF 0%, transparent 100%)',
              transformOrigin: '0 50%',
              transform: `rotate(${angle}deg)`,
              transition: 'all 0.4s ease',
              opacity: isActive ? 1 : 0.4,
            }}
          />
        );
      })}

      {/* Soma (central circle) */}
      <div
        className={isActive ? 'neural-node-activated' : ''}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${nodeSize}px`,
          height: `${nodeSize}px`,
          borderRadius: '50%',
          background: isActive
            ? `radial-gradient(circle, ${activeColor} 0%, ${adjustColor(activeColor, -30)} 100%)`
            : 'radial-gradient(circle, #F9FAFB 0%, #E5E7EB 100%)',
          border: `3px solid ${isActive ? adjustColor(activeColor, -20) : '#D1D5DB'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isActive
            ? `0 0 30px ${hexToRgba(activeColor, 0.6)}, inset 0 0 15px rgba(255,255,255,0.3)`
            : '0 4px 12px rgba(0,0,0,0.1)',
          transition: 'all 0.4s ease',
          cursor: 'pointer',
          zIndex: 10,
        }}
      >
        <span
          style={{
            color: isActive ? '#FFFFFF' : '#374151',
            fontSize: nodeSize < 70 ? '9px' : '10px',
            fontFamily: 'Georgia, serif',
            textAlign: 'center',
            padding: '4px',
            lineHeight: 1.2,
            fontWeight: isActive ? 600 : 400,
            maxWidth: `${nodeSize - 10}px`,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const,
          }}
        >
          {data.label?.length > 30 ? `${data.label.slice(0, 30)}...` : data.label}
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

      {/* Node type indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '8px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: isActive ? activeColor : '#9CA3AF',
          backgroundColor: '#FFFFFF',
          padding: '2px 6px',
          borderRadius: '2px',
          border: `1px solid ${isActive ? activeColor : '#E5E5E5'}`,
        }}
      >
        {data.nodeType === 'event' ? 'EVT' : data.nodeType === 'entity' ? 'ENT' : 'DEC'}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
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
