'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { causalService } from '@/app/lib/api/services/causal';
import {
  CausalNode,
  CausalEdge,
  RELATION_CONFIG,
  RelationType,
} from '@/app/types/causal';

// ==========================================
// Types
// ==========================================

interface Prediction {
  prediction: string;
  probability: number;
  type: 'economic' | 'political' | 'social' | 'geopolitical' | 'tech' | 'general';
  timeframe: 'court_terme' | 'moyen_terme' | 'long_terme';
  rationale: string;
}

interface CausalGraphData {
  nodes: CausalNode[];
  edges: CausalEdge[];
  central_entity: string;
  narrative_flow: string;
  predictions?: Prediction[];
}

interface TimelineCausalGraphProps {
  synthesisId: string;
  synthesisTitle?: string;
  onNodeClick?: (nodeId: string, label: string, type: 'past' | 'present' | 'future') => void;
  onPredictionClick?: (prediction: Prediction) => void;
}

interface PositionedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  section: 'past' | 'present' | 'future';
  probability?: number;
  type?: string;
}

// ==========================================
// Constants & Design Tokens
// ==========================================

const DESIGN = {
  // Dark theme palette
  colors: {
    bgDark: '#0f172a',
    bgCard: 'rgba(30, 41, 59, 0.7)',
    borderGlass: 'rgba(255, 255, 255, 0.1)',
    past: '#06B6D4',       // Cyan
    pastGlow: 'rgba(6, 182, 212, 0.3)',
    present: '#FFFFFF',    // White
    presentGlow: 'rgba(255, 255, 255, 0.4)',
    future: '#A855F7',     // Violet
    futureGlow: 'rgba(168, 85, 247, 0.3)',
    text: '#E2E8F0',
    textMuted: '#94A3B8',
    success: '#10B981',
    warning: '#F59E0B',
  },
  // Layout
  nodeWidth: 200,
  nodeHeight: 80,
  centerNodeWidth: 280,
  centerNodeHeight: 100,
  sectionPadding: 60,
  verticalGap: 30,
};

// Prediction type colors
const PREDICTION_COLORS: Record<string, string> = {
  economic: '#10B981',    // Green
  political: '#EF4444',   // Red
  social: '#F59E0B',      // Orange
  geopolitical: '#3B82F6', // Blue
  tech: '#8B5CF6',        // Purple
  general: '#6B7280',     // Gray
};

// ==========================================
// Main Component
// ==========================================

export default function TimelineCausalGraph({
  synthesisId,
  synthesisTitle,
  onNodeClick,
  onPredictionClick
}: TimelineCausalGraphProps) {
  const [data, setData] = useState<CausalGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Fetch causal graph data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await causalService.getCausalGraph(synthesisId);
        setData({
          nodes: result.nodes || [],
          edges: result.edges || [],
          central_entity: result.central_entity || '',
          narrative_flow: result.narrative_flow || 'linear',
          predictions: (result as unknown as CausalGraphData).predictions || []
        });
      } catch (err) {
        console.error('Failed to load causal graph:', err);
        setError('Impossible de charger le graphe causal');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [synthesisId]);

  // Handle container resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Categorize nodes into past (causes) and identify the central event
  const { pastNodes, centerNode, futureNodes } = useMemo(() => {
    if (!data) return { pastNodes: [], centerNode: null, futureNodes: [] };

    // Find cause nodes (they appear as cause_text in edges)
    const causeTexts = new Set(data.edges.map(e => e.cause_text));
    const effectTexts = new Set(data.edges.map(e => e.effect_text));

    // Causes are nodes that are only causes, not effects
    const pureCauses = data.nodes.filter(n =>
      causeTexts.has(n.label) && !effectTexts.has(n.label)
    );

    // Center is the most connected node or the one that's both cause and effect
    const connectionCount: Record<string, number> = {};
    data.edges.forEach(e => {
      const cause = data.nodes.find(n => n.label === e.cause_text);
      const effect = data.nodes.find(n => n.label === e.effect_text);
      if (cause) connectionCount[cause.id] = (connectionCount[cause.id] || 0) + 1;
      if (effect) connectionCount[effect.id] = (connectionCount[effect.id] || 0) + 1;
    });

    const sortedByConnections = [...data.nodes].sort(
      (a, b) => (connectionCount[b.id] || 0) - (connectionCount[a.id] || 0)
    );

    const center = sortedByConnections[0] || data.nodes[0];

    // Everything else that's not a pure cause goes to the "middle"
    const otherNodes = data.nodes.filter(n =>
      n.id !== center?.id && !pureCauses.includes(n)
    );

    // Predictions become future nodes
    const predictions = data.predictions || [];
    const futureFromPredictions = predictions.map((p, i) => ({
      id: `prediction-${i}`,
      label: p.prediction,
      probability: p.probability,
      type: p.type,
      timeframe: p.timeframe,
      rationale: p.rationale
    }));

    return {
      pastNodes: pureCauses.slice(0, 5), // Max 5 past causes
      centerNode: center,
      futureNodes: futureFromPredictions.slice(0, 4) // Max 4 predictions
    };
  }, [data]);

  // Calculate positions for horizontal timeline layout
  const positions = useMemo(() => {
    const result: Record<string, PositionedNode> = {};
    const sectionWidth = containerWidth / 3;
    const centerX = containerWidth / 2;
    const centerY = 200;

    // Position past nodes (left side)
    pastNodes.forEach((node, i) => {
      const y = centerY + (i - (pastNodes.length - 1) / 2) * (DESIGN.nodeHeight + DESIGN.verticalGap);
      result[node.id] = {
        id: node.id,
        label: node.label,
        x: sectionWidth / 2,
        y,
        section: 'past'
      };
    });

    // Position center node
    if (centerNode) {
      result[centerNode.id] = {
        id: centerNode.id,
        label: centerNode.label,
        x: centerX,
        y: centerY,
        section: 'present'
      };
    }

    // Position future nodes (right side)
    futureNodes.forEach((node, i) => {
      const y = centerY + (i - (futureNodes.length - 1) / 2) * (DESIGN.nodeHeight + DESIGN.verticalGap);
      result[node.id] = {
        id: node.id,
        label: node.label,
        x: containerWidth - sectionWidth / 2,
        y,
        section: 'future',
        probability: node.probability,
        type: node.type
      };
    });

    return result;
  }, [pastNodes, centerNode, futureNodes, containerWidth]);

  // Handle node click
  const handleNodeClick = useCallback((nodeId: string, label: string, section: 'past' | 'present' | 'future') => {
    setSelectedNode(nodeId === selectedNode ? null : nodeId);
    onNodeClick?.(nodeId, label, section);

    if (section === 'future' && data?.predictions) {
      const pred = data.predictions.find((_, i) => `prediction-${i}` === nodeId);
      if (pred) onPredictionClick?.(pred);
    }
  }, [selectedNode, onNodeClick, onPredictionClick, data]);

  // Render loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Chargement du Nexus Causal...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error || !data) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <span style={styles.errorIcon}>⚠️</span>
          <span style={styles.errorText}>{error || 'Aucune donnée disponible'}</span>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!centerNode && pastNodes.length === 0 && futureNodes.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyContainer}>
          <div style={styles.emptyIcon}>🔮</div>
          <span style={styles.emptyText}>Graphe causal en attente de données</span>
          <span style={styles.emptySubtext}>
            Les relations causales apparaîtront après la génération de la synthèse.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h3 style={styles.title}>🔮 Nexus Causal</h3>
          <span style={styles.subtitle}>Flux temporel : Passé → Présent → Futur</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.legend}>
            <span style={styles.legendItem}>
              <span style={{...styles.legendDot, backgroundColor: DESIGN.colors.past}} />
              Causes
            </span>
            <span style={styles.legendItem}>
              <span style={{...styles.legendDot, backgroundColor: DESIGN.colors.present}} />
              Présent
            </span>
            <span style={styles.legendItem}>
              <span style={{...styles.legendDot, backgroundColor: DESIGN.colors.future}} />
              Prédictions
            </span>
          </div>
        </div>
      </div>

      {/* Timeline Labels */}
      <div style={styles.timelineLabels}>
        <span style={{...styles.timelineLabel, color: DESIGN.colors.past}}>PASSÉ</span>
        <span style={{...styles.timelineLabel, color: DESIGN.colors.present}}>PRÉSENT</span>
        <span style={{...styles.timelineLabel, color: DESIGN.colors.future}}>FUTUR</span>
      </div>

      {/* Graph Area */}
      <div style={styles.graphContainer}>
        <svg
          width={containerWidth}
          height={450}
          style={styles.svg}
        >
          {/* Gradient definitions */}
          <defs>
            {/* Past to Center gradient */}
            <linearGradient id="gradientPastCenter" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={DESIGN.colors.past} />
              <stop offset="100%" stopColor={DESIGN.colors.present} />
            </linearGradient>
            {/* Center to Future gradient */}
            <linearGradient id="gradientCenterFuture" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={DESIGN.colors.present} />
              <stop offset="100%" stopColor={DESIGN.colors.future} />
            </linearGradient>
            {/* Glow filters */}
            <filter id="glowPast" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feFlood floodColor={DESIGN.colors.past} floodOpacity="0.5" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glowPresent" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feFlood floodColor={DESIGN.colors.present} floodOpacity="0.6" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glowFuture" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feFlood floodColor={DESIGN.colors.future} floodOpacity="0.5" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background timeline axis */}
          <line
            x1={80}
            y1={200}
            x2={containerWidth - 80}
            y2={200}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={2}
            strokeDasharray="10,5"
          />

          {/* Edges: Past → Center */}
          {pastNodes.map((node, i) => {
            const from = positions[node.id];
            const to = centerNode ? positions[centerNode.id] : null;
            if (!from || !to) return null;

            return (
              <EdgeLine
                key={`edge-past-${i}`}
                x1={from.x + DESIGN.nodeWidth / 2}
                y1={from.y}
                x2={to.x - DESIGN.centerNodeWidth / 2}
                y2={to.y}
                type="past"
                animated={hoveredNode === node.id || hoveredNode === centerNode?.id}
              />
            );
          })}

          {/* Edges: Center → Future */}
          {futureNodes.map((node, i) => {
            const from = centerNode ? positions[centerNode.id] : null;
            const to = positions[node.id];
            if (!from || !to) return null;

            return (
              <EdgeLine
                key={`edge-future-${i}`}
                x1={from.x + DESIGN.centerNodeWidth / 2}
                y1={from.y}
                x2={to.x - DESIGN.nodeWidth / 2}
                y2={to.y}
                type="future"
                probability={node.probability}
                animated={hoveredNode === centerNode?.id || hoveredNode === node.id}
              />
            );
          })}

          {/* Past Nodes */}
          {pastNodes.map(node => {
            const pos = positions[node.id];
            if (!pos) return null;
            return (
              <CausalNodeComponent
                key={node.id}
                x={pos.x}
                y={pos.y}
                label={node.label}
                section="past"
                isHovered={hoveredNode === node.id}
                isSelected={selectedNode === node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => handleNodeClick(node.id, node.label, 'past')}
              />
            );
          })}

          {/* Center Node */}
          {centerNode && positions[centerNode.id] && (
            <CausalNodeComponent
              key={centerNode.id}
              x={positions[centerNode.id].x}
              y={positions[centerNode.id].y}
              label={synthesisTitle || centerNode.label}
              section="present"
              isHovered={hoveredNode === centerNode.id}
              isSelected={selectedNode === centerNode.id}
              onMouseEnter={() => setHoveredNode(centerNode.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => handleNodeClick(centerNode.id, centerNode.label, 'present')}
              isCenter
            />
          )}

          {/* Future Nodes (Predictions) */}
          {futureNodes.map(node => {
            const pos = positions[node.id];
            if (!pos) return null;
            return (
              <PredictionNode
                key={node.id}
                x={pos.x}
                y={pos.y}
                label={node.label}
                probability={node.probability || 0.5}
                type={node.type || 'general'}
                isHovered={hoveredNode === node.id}
                isSelected={selectedNode === node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => handleNodeClick(node.id, node.label, 'future')}
              />
            );
          })}
        </svg>
      </div>

      {/* Stats Footer */}
      <div style={styles.footer}>
        <span style={styles.stat}>
          <strong>{pastNodes.length}</strong> causes identifiées
        </span>
        <span style={styles.statDivider}>•</span>
        <span style={styles.stat}>
          <strong>{data.edges.length}</strong> relations causales
        </span>
        <span style={styles.statDivider}>•</span>
        <span style={styles.stat}>
          <strong>{futureNodes.length}</strong> prédictions
        </span>
      </div>
    </div>
  );
}

// ==========================================
// Sub-components
// ==========================================

interface EdgeLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'past' | 'future';
  probability?: number;
  animated?: boolean;
}

function EdgeLine({ x1, y1, x2, y2, type, probability = 1, animated }: EdgeLineProps) {
  const isFuture = type === 'future';
  const color = isFuture ? DESIGN.colors.future : DESIGN.colors.past;
  const gradientId = isFuture ? 'gradientCenterFuture' : 'gradientPastCenter';

  // Bezier curve control points
  const midX = (x1 + x2) / 2;
  const path = `M ${x1} ${y1} Q ${midX} ${y1}, ${midX} ${(y1 + y2) / 2} Q ${midX} ${y2}, ${x2} ${y2}`;

  return (
    <g>
      {/* Background glow */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={animated ? 6 : 3}
        strokeOpacity={0.2}
        strokeLinecap="round"
      />
      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={animated ? 3 : 2}
        strokeDasharray={isFuture ? '8,4' : '0'}
        strokeOpacity={isFuture ? probability : 1}
        strokeLinecap="round"
      />
      {/* Animated particle */}
      {animated && (
        <circle r={4} fill={color}>
          <animateMotion dur="2s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </g>
  );
}

interface CausalNodeComponentProps {
  x: number;
  y: number;
  label: string;
  section: 'past' | 'present' | 'future';
  isHovered: boolean;
  isSelected: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  isCenter?: boolean;
}

function CausalNodeComponent({
  x, y, label, section, isHovered, isSelected, onMouseEnter, onMouseLeave, onClick, isCenter
}: CausalNodeComponentProps) {
  const width = isCenter ? DESIGN.centerNodeWidth : DESIGN.nodeWidth;
  const height = isCenter ? DESIGN.centerNodeHeight : DESIGN.nodeHeight;

  const colors = {
    past: { bg: DESIGN.colors.past, glow: DESIGN.colors.pastGlow, filter: 'url(#glowPast)' },
    present: { bg: DESIGN.colors.present, glow: DESIGN.colors.presentGlow, filter: 'url(#glowPresent)' },
    future: { bg: DESIGN.colors.future, glow: DESIGN.colors.futureGlow, filter: 'url(#glowFuture)' }
  };

  const style = colors[section];
  const textColor = section === 'present' ? DESIGN.colors.bgDark : DESIGN.colors.text;

  return (
    <g
      transform={`translate(${x - width / 2}, ${y - height / 2})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Glassmorphism card */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={isCenter ? 16 : 12}
        fill={isCenter ? style.bg : DESIGN.colors.bgCard}
        stroke={isHovered || isSelected ? style.bg : DESIGN.colors.borderGlass}
        strokeWidth={isHovered || isSelected ? 2 : 1}
        filter={isHovered || isSelected || isCenter ? style.filter : undefined}
        style={{
          transition: 'all 0.3s ease'
        }}
      />

      {/* Breathing animation for center node */}
      {isCenter && (
        <rect
          x={-4}
          y={-4}
          width={width + 8}
          height={height + 8}
          rx={20}
          fill="none"
          stroke={style.bg}
          strokeWidth={2}
          strokeOpacity={0.3}
        >
          <animate
            attributeName="stroke-opacity"
            values="0.3;0.6;0.3"
            dur="2s"
            repeatCount="indefinite"
          />
        </rect>
      )}

      {/* Label */}
      <foreignObject x={8} y={8} width={width - 16} height={height - 16}>
        <div
          style={{
            fontSize: isCenter ? '13px' : '11px',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: isCenter ? 600 : 400,
            color: textColor,
            lineHeight: 1.3,
            overflow: 'hidden',
            textAlign: 'center',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            wordBreak: 'break-word' as const,
            textOverflow: 'ellipsis'
          }}
        >
          {label.length > 80 ? label.slice(0, 77) + '...' : label}
        </div>
      </foreignObject>
    </g>
  );
}

interface PredictionNodeProps {
  x: number;
  y: number;
  label: string;
  probability: number;
  type: string;
  isHovered: boolean;
  isSelected: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

function PredictionNode({
  x, y, label, probability, type, isHovered, isSelected, onMouseEnter, onMouseLeave, onClick
}: PredictionNodeProps) {
  const width = DESIGN.nodeWidth;
  const height = DESIGN.nodeHeight;
  const typeColor = PREDICTION_COLORS[type] || PREDICTION_COLORS.general;

  // Opacity based on probability (more probable = more visible)
  const opacity = 0.4 + probability * 0.6;

  return (
    <g
      transform={`translate(${x - width / 2}, ${y - height / 2})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Dashed border card */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        rx={12}
        fill={DESIGN.colors.bgCard}
        fillOpacity={opacity}
        stroke={DESIGN.colors.future}
        strokeWidth={isHovered || isSelected ? 2 : 1}
        strokeDasharray="6,3"
        filter={isHovered || isSelected ? 'url(#glowFuture)' : undefined}
      />

      {/* Probability badge */}
      <rect
        x={width - 50}
        y={-10}
        width={45}
        height={20}
        rx={10}
        fill={typeColor}
      />
      <text
        x={width - 27}
        y={5}
        textAnchor="middle"
        style={{ fontSize: '10px', fill: '#FFFFFF', fontWeight: 600 }}
      >
        {Math.round(probability * 100)}%
      </text>

      {/* Type indicator */}
      <circle
        cx={15}
        cy={15}
        r={6}
        fill={typeColor}
      />

      {/* Label */}
      <foreignObject x={8} y={20} width={width - 16} height={height - 28}>
        <div
          style={{
            fontSize: '10px',
            fontFamily: 'system-ui, sans-serif',
            color: DESIGN.colors.text,
            lineHeight: 1.2,
            overflow: 'hidden',
            textAlign: 'center',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            wordBreak: 'break-word' as const,
            opacity: opacity
          }}
        >
          {label.length > 60 ? label.slice(0, 57) + '...' : label}
        </div>
      </foreignObject>
    </g>
  );
}

// ==========================================
// Styles
// ==========================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: DESIGN.colors.bgDark,
    borderRadius: '16px',
    overflow: 'hidden',
    border: `1px solid ${DESIGN.colors.borderGlass}`,
    minHeight: '550px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: `1px solid ${DESIGN.colors.borderGlass}`,
    background: 'linear-gradient(180deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0) 100%)'
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  headerRight: {},
  title: {
    fontSize: '16px',
    fontWeight: 700,
    color: DESIGN.colors.text,
    margin: 0
  },
  subtitle: {
    fontSize: '11px',
    color: DESIGN.colors.textMuted
  },
  legend: {
    display: 'flex',
    gap: '16px',
    fontSize: '10px',
    color: DESIGN.colors.textMuted
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  timelineLabels: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '12px 60px',
    borderBottom: `1px solid ${DESIGN.colors.borderGlass}`
  },
  timelineLabel: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '1px',
    textTransform: 'uppercase'
  },
  graphContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '20px'
  },
  svg: {
    display: 'block'
  },
  footer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderTop: `1px solid ${DESIGN.colors.borderGlass}`,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    fontSize: '11px',
    color: DESIGN.colors.textMuted
  },
  stat: {},
  statDivider: {
    opacity: 0.3
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    gap: '16px'
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: `3px solid ${DESIGN.colors.borderGlass}`,
    borderTopColor: DESIGN.colors.future,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '12px',
    color: DESIGN.colors.textMuted
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    gap: '12px'
  },
  errorIcon: {
    fontSize: '32px'
  },
  errorText: {
    fontSize: '12px',
    color: '#EF4444'
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    gap: '12px'
  },
  emptyIcon: {
    fontSize: '48px'
  },
  emptyText: {
    fontSize: '14px',
    color: DESIGN.colors.text
  },
  emptySubtext: {
    fontSize: '12px',
    color: DESIGN.colors.textMuted,
    textAlign: 'center'
  }
};
