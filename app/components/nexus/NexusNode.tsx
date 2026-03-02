'use client';

import React from 'react';

export interface NexusNodeData {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  zone: 'past' | 'present' | 'future';
  nodeType?: string;
  factDensity?: number;
  isSelected?: boolean;
  animationDelay?: number;
  futureVariant?: 'optimist' | 'realist' | 'pessimist';
}

const ZONE_COLORS = {
  past: { fill: '#06B6D4', glow: 'rgba(6, 182, 212, 0.4)', stroke: '#0E7490' },
  present: { fill: '#3B82F6', glow: 'rgba(59, 130, 246, 0.5)', stroke: '#2563EB' },
  future: { fill: '#F59E0B', glow: 'rgba(245, 158, 11, 0.4)', stroke: '#D97706' },
};

const FUTURE_COLORS = {
  optimist: { fill: '#10B981', glow: 'rgba(16, 185, 129, 0.4)', stroke: '#059669' },
  realist: { fill: '#F59E0B', glow: 'rgba(245, 158, 11, 0.4)', stroke: '#D97706' },
  pessimist: { fill: '#EF4444', glow: 'rgba(239, 68, 68, 0.4)', stroke: '#DC2626' },
};

const NODE_TYPE_ICONS: Record<string, string> = {
  event: '\u26A1',
  entity: '\u25C6',
  decision: '\u2726',
  keyword: '\u2022',
};

interface NexusNodeProps {
  node: NexusNodeData;
  onMouseEnter?: (node: NexusNodeData, e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onClick?: (node: NexusNodeData) => void;
}

export default function NexusNode({ node, onMouseEnter, onMouseLeave, onClick }: NexusNodeProps) {
  const colors = node.zone === 'future' && node.futureVariant
    ? FUTURE_COLORS[node.futureVariant]
    : ZONE_COLORS[node.zone];

  const icon = NODE_TYPE_ICONS[node.nodeType || 'event'] || '\u26A1';
  const glowId = `glow-${node.id}`;
  const pulseClass = node.zone === 'present' ? 'nexus-pulse' : '';
  const selectedScale = node.isSelected ? 1.3 : 1;
  const delay = node.animationDelay || 0;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      style={{ cursor: 'pointer' }}
      onMouseEnter={(e) => onMouseEnter?.(node, e)}
      onMouseLeave={onMouseLeave}
      onClick={() => onClick?.(node)}
      className="nexus-node-appear"
      data-delay={delay}
    >
      {/* SVG filter for glow */}
      <defs>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={node.isSelected ? 8 : 4} result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <radialGradient id={`grad-${node.id}`} cx="30%" cy="30%">
          <stop offset="0%" stopColor={colors.fill} stopOpacity="0.9" />
          <stop offset="100%" stopColor={colors.stroke} stopOpacity="1" />
        </radialGradient>
      </defs>

      {/* Outer glow ring */}
      <circle
        r={node.radius * 1.8 * selectedScale}
        fill={colors.glow}
        opacity={node.isSelected ? 0.6 : 0.25}
        className={pulseClass}
        style={{ animationDelay: `${delay}ms` }}
      />

      {/* Main circle */}
      <circle
        r={node.radius * selectedScale}
        fill={`url(#grad-${node.id})`}
        stroke={colors.stroke}
        strokeWidth={node.isSelected ? 2.5 : 1.5}
        filter={node.isSelected ? `url(#${glowId})` : undefined}
      />

      {/* Inner ring */}
      <circle
        r={node.radius * 0.65 * selectedScale}
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={0.8}
      />

      {/* Icon */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={node.radius * 0.7}
        fill="rgba(255,255,255,0.9)"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {icon}
      </text>

      {/* Label below node */}
      <text
        y={node.radius * selectedScale + 14}
        textAnchor="middle"
        fontSize="10"
        fill="#94A3B8"
        fontFamily="var(--font-sans)"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {node.label.length > 24 ? node.label.slice(0, 22) + '...' : node.label}
      </text>
    </g>
  );
}
