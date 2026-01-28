'use client';

import React, { useState, useMemo } from 'react';
import { useTheme } from '@/app/contexts/ThemeContext';

/**
 * UI-004c: MiniCausalGraph Component
 * Version simplifiée du graphe causal pour la homepage (5-7 noeuds max)
 * Design minimaliste avec animation subtile
 */

interface MiniNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'cause' | 'effect' | 'entity';
}

interface MiniEdge {
  from: string;
  to: string;
  type: 'causes' | 'triggers' | 'enables';
}

interface MiniCausalGraphProps {
  /** Données du graphe (optionnel, utilise démo si absent) */
  nodes?: MiniNode[];
  edges?: MiniEdge[];
  /** Largeur du composant */
  width?: number;
  /** Hauteur du composant */
  height?: number;
  /** Animation activée */
  animated?: boolean;
}

// Données de démonstration
const DEMO_NODES: MiniNode[] = [
  { id: '1', label: 'IA Générative', x: 50, y: 30, type: 'cause' },
  { id: '2', label: 'Emploi Tech', x: 20, y: 60, type: 'effect' },
  { id: '3', label: 'Régulation UE', x: 80, y: 60, type: 'effect' },
  { id: '4', label: 'Startups', x: 35, y: 85, type: 'entity' },
  { id: '5', label: 'Éthique', x: 65, y: 85, type: 'entity' },
];

const DEMO_EDGES: MiniEdge[] = [
  { from: '1', to: '2', type: 'triggers' },
  { from: '1', to: '3', type: 'causes' },
  { from: '2', to: '4', type: 'enables' },
  { from: '3', to: '5', type: 'triggers' },
];

export function MiniCausalGraph({
  nodes = DEMO_NODES,
  edges = DEMO_EDGES,
  width = 280,
  height = 180,
  animated = true,
}: MiniCausalGraphProps) {
  const { theme, darkMode } = useTheme();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeAnimation, setActiveAnimation] = useState<string | null>(null);

  // Couleurs des types de relations
  const edgeColors = {
    causes: darkMode ? '#3B82F6' : '#2563EB',
    triggers: darkMode ? '#F59E0B' : '#D97706',
    enables: darkMode ? '#10B981' : '#059669',
  };

  // Couleurs des types de noeuds
  const nodeColors = {
    cause: { bg: darkMode ? '#1E3A5F' : '#DBEAFE', border: '#3B82F6' },
    effect: { bg: darkMode ? '#1F2937' : '#F3F4F6', border: theme.border },
    entity: { bg: darkMode ? '#312E2A' : '#FEF3C7', border: '#F59E0B' },
  };

  // Convertir % en pixels
  const getNodePosition = (node: MiniNode) => ({
    x: (node.x / 100) * width,
    y: (node.y / 100) * height,
  });

  // Animation de pulsation
  const startPulse = (nodeId: string) => {
    if (!animated) return;
    setActiveAnimation(nodeId);
    setTimeout(() => setActiveAnimation(null), 1000);
  };

  return (
    <div
      style={{
        width,
        height,
        position: 'relative',
        backgroundColor: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* SVG pour les edges */}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          {/* Gradients pour les edges */}
          {edges.map((edge, i) => (
            <linearGradient
              key={`gradient-${i}`}
              id={`edge-gradient-${i}`}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={edgeColors[edge.type]} stopOpacity="0.3" />
              <stop offset="50%" stopColor={edgeColors[edge.type]} stopOpacity="0.8" />
              <stop offset="100%" stopColor={edgeColors[edge.type]} stopOpacity="0.3" />
            </linearGradient>
          ))}
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const fromNode = nodes.find((n) => n.id === edge.from);
          const toNode = nodes.find((n) => n.id === edge.to);
          if (!fromNode || !toNode) return null;

          const from = getNodePosition(fromNode);
          const to = getNodePosition(toNode);

          const isActive = hoveredNode === edge.from || hoveredNode === edge.to;

          return (
            <g key={`edge-${i}`}>
              {/* Edge line */}
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={`url(#edge-gradient-${i})`}
                strokeWidth={isActive ? 2 : 1}
                opacity={isActive ? 1 : 0.6}
                style={{
                  transition: 'all 0.3s ease',
                }}
              />
              {/* Animated dot on edge */}
              {animated && (
                <circle r="2" fill={edgeColors[edge.type]}>
                  <animateMotion
                    dur="3s"
                    repeatCount="indefinite"
                    path={`M${from.x},${from.y} L${to.x},${to.y}`}
                  />
                </circle>
              )}
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      {nodes.map((node) => {
        const pos = getNodePosition(node);
        const colors = nodeColors[node.type];
        const isHovered = hoveredNode === node.id;
        const isPulsing = activeAnimation === node.id;

        return (
          <div
            key={node.id}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={() => startPulse(node.id)}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              transform: `translate(-50%, -50%) scale(${isHovered ? 1.1 : 1})`,
              backgroundColor: colors.bg,
              border: `2px solid ${colors.border}`,
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '10px',
              fontWeight: 500,
              color: theme.text,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isHovered
                ? `0 4px 12px ${theme.shadow}`
                : 'none',
              animation: isPulsing ? 'miniPulse 0.5s ease' : 'none',
            }}
          >
            {node.label}
          </div>
        );
      })}

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          display: 'flex',
          gap: '8px',
          fontSize: '9px',
          color: theme.textSecondary,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ width: '8px', height: '2px', backgroundColor: edgeColors.causes }} />
          cause
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ width: '8px', height: '2px', backgroundColor: edgeColors.triggers }} />
          trigger
        </span>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes miniPulse {
          0% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.15); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}

export default MiniCausalGraph;
