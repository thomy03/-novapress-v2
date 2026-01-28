'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { causalService } from '@/app/lib/api/services/causal';
import {
  HistoricalCausalGraphResponse,
  HistoricalLayer,
  InterLayerConnection,
  CausalNode,
  CausalEdge,
  RELATION_CONFIG,
  RelationType,
  InterLayerConnectionType
} from '@/app/types/causal';

// ==========================================
// Types
// ==========================================

interface HistoricalCausalGraphProps {
  synthesisId: string;
  focusNodeId?: string | null;  // Node ID to focus on initially
  onNodeClick?: (node: PositionedNode) => void;
}

interface PositionedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  layerIndex: number;
  nodeIndex: number;
  synthesisTitle: string;
  synthesisDate: string;
  nodeType: string;
  factDensity: number;
  isCurrent: boolean;
  isEffect: boolean;
  isCause: boolean;
}

interface PositionedEdge {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  relationType: RelationType | InterLayerConnectionType;
  confidence: number;
  isInterLayer: boolean;
  label: string;
}

// ==========================================
// Constants
// ==========================================

const LAYER_HEIGHT = 220;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const NODE_GAP = 30;
const LAYER_PADDING = 80;
const SVG_PADDING = 40;

// ==========================================
// Main Component
// ==========================================

export default function HistoricalCausalGraph({
  synthesisId,
  focusNodeId,
  onNodeClick
}: HistoricalCausalGraphProps) {
  const [data, setData] = useState<HistoricalCausalGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(focusNodeId || null);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await causalService.getHistoricalGraph(synthesisId, 5);
        setData(result);
      } catch (err) {
        console.error('Failed to load historical graph:', err);
        setError('Impossible de charger le graphe historique');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [synthesisId]);

  // Set focused node when focusNodeId prop changes
  useEffect(() => {
    if (focusNodeId) {
      setSelectedNode(focusNodeId);
    }
  }, [focusNodeId]);

  // Calculate positioned nodes
  const positionedNodes = useMemo(() => {
    if (!data) return [];

    const nodes: PositionedNode[] = [];

    data.layers.forEach((layer, layerIndex) => {
      // Collect all unique labels from edges (causes and effects)
      const nodeLabels = new Set<string>();
      layer.edges.forEach(edge => {
        nodeLabels.add(edge.cause_text);
        nodeLabels.add(edge.effect_text);
      });

      // Also add nodes from the nodes array
      layer.nodes.forEach(node => {
        if (node.label) nodeLabels.add(node.label);
      });

      const uniqueLabels = Array.from(nodeLabels);
      const nodesInLayer = uniqueLabels.length || 1;
      const totalWidth = nodesInLayer * (NODE_WIDTH + NODE_GAP) - NODE_GAP;
      const startX = SVG_PADDING + LAYER_PADDING;

      uniqueLabels.forEach((label, nodeIndex) => {
        // Check if this label is a cause or effect
        const isCause = layer.edges.some(e => e.cause_text === label);
        const isEffect = layer.edges.some(e => e.effect_text === label);

        nodes.push({
          id: `layer${layerIndex}_node${nodeIndex}`,
          label,
          x: startX + nodeIndex * (NODE_WIDTH + NODE_GAP) + NODE_WIDTH / 2,
          y: SVG_PADDING + layerIndex * LAYER_HEIGHT + NODE_HEIGHT / 2 + 60,
          layerIndex,
          nodeIndex,
          synthesisTitle: layer.title,
          synthesisDate: layer.date,
          nodeType: 'event',
          factDensity: 0.5,
          isCurrent: layer.is_current,
          isEffect,
          isCause
        });
      });
    });

    return nodes;
  }, [data]);

  // Calculate positioned edges (intra-layer)
  const positionedEdges = useMemo(() => {
    if (!data) return [];

    const edges: PositionedEdge[] = [];

    data.layers.forEach((layer, layerIndex) => {
      layer.edges.forEach((edge, edgeIndex) => {
        // Find source and target nodes
        const sourceNode = positionedNodes.find(
          n => n.layerIndex === layerIndex && n.label === edge.cause_text
        );
        const targetNode = positionedNodes.find(
          n => n.layerIndex === layerIndex && n.label === edge.effect_text
        );

        if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
          edges.push({
            id: `edge_layer${layerIndex}_${edgeIndex}`,
            sourceX: sourceNode.x,
            sourceY: sourceNode.y + NODE_HEIGHT / 2,
            targetX: targetNode.x,
            targetY: targetNode.y - NODE_HEIGHT / 2,
            relationType: edge.relation_type as RelationType,
            confidence: edge.confidence,
            isInterLayer: false,
            label: edge.relation_type
          });
        }
      });
    });

    return edges;
  }, [data, positionedNodes]);

  // Calculate inter-layer connections
  const interLayerEdges = useMemo(() => {
    if (!data) return [];

    return data.inter_layer_connections.map((conn, idx) => {
      // Find the last node of from_layer and first node of to_layer
      const fromLayerNodes = positionedNodes.filter(n => n.layerIndex === conn.from_layer);
      const toLayerNodes = positionedNodes.filter(n => n.layerIndex === conn.to_layer);

      // Find best matching nodes
      const fromNode = fromLayerNodes.find(n => n.label.toLowerCase().includes(conn.from_effect.toLowerCase().slice(0, 20))) || fromLayerNodes[fromLayerNodes.length - 1];
      const toNode = toLayerNodes.find(n => n.label.toLowerCase().includes(conn.to_cause.toLowerCase().slice(0, 20))) || toLayerNodes[0];

      if (fromNode && toNode) {
        return {
          id: `inter_${idx}`,
          sourceX: fromNode.x,
          sourceY: fromNode.y + NODE_HEIGHT / 2,
          targetX: toNode.x,
          targetY: toNode.y - NODE_HEIGHT / 2,
          relationType: 'leads_to' as InterLayerConnectionType,
          confidence: conn.similarity,
          isInterLayer: true,
          label: 'mène à'
        };
      }
      return null;
    }).filter(Boolean) as PositionedEdge[];
  }, [data, positionedNodes]);

  // Calculate SVG dimensions
  const svgDimensions = useMemo(() => {
    if (!data || positionedNodes.length === 0) {
      return { width: 600, height: 400 };
    }

    const maxX = Math.max(...positionedNodes.map(n => n.x)) + NODE_WIDTH / 2 + SVG_PADDING;
    const maxY = data.layers.length * LAYER_HEIGHT + SVG_PADDING * 2;

    return {
      width: Math.max(600, maxX + 100),
      height: Math.max(400, maxY)
    };
  }, [data, positionedNodes]);

  // Handle node click
  const handleNodeClick = useCallback((node: PositionedNode) => {
    setSelectedNode(node.id === selectedNode ? null : node.id);
    onNodeClick?.(node);
  }, [selectedNode, onNodeClick]);

  // Render loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Chargement du graphe historique...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <span style={styles.errorText}>{error}</span>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!data || data.layers.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyContainer}>
          <span style={styles.emptyText}>Aucune donnée causale historique disponible</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Chaîne Causale Historique</h3>
        <div style={styles.stats}>
          <span>{data.total_layers} synthèses</span>
          <span style={styles.statDivider}>•</span>
          <span>{data.total_nodes} événements</span>
          <span style={styles.statDivider}>•</span>
          <span>{data.total_edges} relations</span>
        </div>
      </div>

      {/* Graph Container */}
      <div style={styles.graphContainer}>
        <svg
          width={svgDimensions.width}
          height={svgDimensions.height}
          style={styles.svg}
        >
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#9CA3AF" />
            </marker>
            <marker
              id="arrowhead-blue"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#3B82F6" />
            </marker>
          </defs>

          {/* Layer backgrounds and labels */}
          {data.layers.map((layer, idx) => (
            <g key={`layer-bg-${idx}`}>
              {/* Layer background */}
              <rect
                x={0}
                y={SVG_PADDING + idx * LAYER_HEIGHT}
                width={svgDimensions.width}
                height={LAYER_HEIGHT - 20}
                fill={layer.is_current ? '#EFF6FF' : idx % 2 === 0 ? '#FAFAFA' : '#FFFFFF'}
                rx={8}
              />

              {/* Date label */}
              <text
                x={20}
                y={SVG_PADDING + idx * LAYER_HEIGHT + 25}
                style={{ ...styles.layerDate, fill: '#9CA3AF' }}
              >
                {formatDate(layer.date)}
              </text>

              {/* Title label */}
              <text
                x={20}
                y={SVG_PADDING + idx * LAYER_HEIGHT + 45}
                style={{ ...styles.layerTitle, fill: layer.is_current ? '#1D4ED8' : '#374151' }}
              >
                {truncateText(layer.title, 60)}
              </text>

              {/* Current badge */}
              {layer.is_current && (
                <g>
                  <rect
                    x={svgDimensions.width - 100}
                    y={SVG_PADDING + idx * LAYER_HEIGHT + 15}
                    width={70}
                    height={22}
                    rx={11}
                    fill="#DC2626"
                  />
                  <text
                    x={svgDimensions.width - 65}
                    y={SVG_PADDING + idx * LAYER_HEIGHT + 30}
                    style={{ fontSize: '10px', fill: '#FFFFFF', fontWeight: 600, textAnchor: 'middle' }}
                  >
                    ACTUEL
                  </text>
                </g>
              )}
            </g>
          ))}

          {/* Intra-layer edges */}
          {positionedEdges.map(edge => (
            <EdgeComponent
              key={edge.id}
              edge={edge}
              isHighlighted={false}
            />
          ))}

          {/* Inter-layer edges (leads_to) */}
          {interLayerEdges.map(edge => (
            <EdgeComponent
              key={edge.id}
              edge={edge}
              isHighlighted={false}
            />
          ))}

          {/* Nodes */}
          {positionedNodes.map(node => (
            <NodeComponent
              key={node.id}
              node={node}
              isSelected={selectedNode === node.id}
              isHovered={hoveredNode === node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => handleNodeClick(node)}
            />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendLine, background: RELATION_CONFIG.causes.color }} />
          <span>cause</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendLine, background: RELATION_CONFIG.triggers.color }} />
          <span>déclenche</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendLine, background: RELATION_CONFIG.enables.color }} />
          <span>permet</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendLineDashed, background: RELATION_CONFIG.leads_to.color }} />
          <span>mène à</span>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Sub-components
// ==========================================

interface NodeComponentProps {
  node: PositionedNode;
  isSelected: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

function NodeComponent({
  node,
  isSelected,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick
}: NodeComponentProps) {
  const bgColor = node.isCurrent
    ? isSelected ? '#1E40AF' : isHovered ? '#2563EB' : '#3B82F6'
    : isSelected ? '#1F2937' : isHovered ? '#F3F4F6' : '#FFFFFF';

  const textColor = node.isCurrent || isSelected ? '#FFFFFF' : '#1F2937';
  const borderColor = isHovered ? '#2563EB' : node.isCurrent ? '#1D4ED8' : '#E5E5E5';

  return (
    <g
      transform={`translate(${node.x - NODE_WIDTH / 2}, ${node.y - NODE_HEIGHT / 2})`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Node rectangle */}
      <rect
        x={0}
        y={0}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={8}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={isHovered || isSelected ? 2 : 1}
        filter={isHovered ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' : 'none'}
      />

      {/* Node text */}
      <foreignObject x={8} y={8} width={NODE_WIDTH - 16} height={NODE_HEIGHT - 16}>
        <div
          style={{
            fontSize: '11px',
            fontFamily: 'Georgia, serif',
            color: textColor,
            lineHeight: 1.3,
            overflow: 'hidden',
            textAlign: 'center',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            wordBreak: 'break-word' as const
          }}
        >
          {node.label}
        </div>
      </foreignObject>
    </g>
  );
}

interface EdgeComponentProps {
  edge: PositionedEdge;
  isHighlighted: boolean;
}

function EdgeComponent({ edge, isHighlighted }: EdgeComponentProps) {
  const config = RELATION_CONFIG[edge.relationType] || RELATION_CONFIG.causes;
  const color = config.color;
  const strokeWidth = isHighlighted ? 3 : edge.isInterLayer ? 2.5 : 1.5;
  const dashArray = edge.isInterLayer ? '8,4' : '0';
  const markerId = edge.isInterLayer ? 'arrowhead-blue' : 'arrowhead';

  // Calculate control points for Bezier curve
  const midY = (edge.sourceY + edge.targetY) / 2;
  const path = `M ${edge.sourceX} ${edge.sourceY}
                C ${edge.sourceX} ${midY},
                  ${edge.targetX} ${midY},
                  ${edge.targetX} ${edge.targetY}`;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        markerEnd={`url(#${markerId})`}
        opacity={isHighlighted ? 1 : 0.7}
      />

      {/* Edge label */}
      {edge.isInterLayer && (
        <text
          x={(edge.sourceX + edge.targetX) / 2}
          y={(edge.sourceY + edge.targetY) / 2}
          style={{
            fontSize: '9px',
            fill: color,
            fontStyle: 'italic',
            textAnchor: 'middle'
          }}
        >
          {edge.label}
        </text>
      )}
    </g>
  );
}

// ==========================================
// Helper Functions
// ==========================================

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr.slice(0, 10);
  }
}

function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// ==========================================
// Styles
// ==========================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#FAFAFA',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #E5E5E5'
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid #E5E5E5',
    backgroundColor: '#FFFFFF'
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1F2937',
    marginBottom: '4px',
    margin: 0
  },
  stats: {
    fontSize: '12px',
    color: '#6B7280',
    display: 'flex',
    gap: '8px',
    marginTop: '4px'
  },
  statDivider: {
    color: '#D1D5DB'
  },
  graphContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '0'
  },
  svg: {
    minWidth: '100%',
    display: 'block'
  },
  layerDate: {
    fontSize: '11px',
    fontFamily: 'system-ui, sans-serif'
  },
  layerTitle: {
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'Georgia, serif'
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    padding: '12px 16px',
    borderTop: '1px solid #E5E5E5',
    backgroundColor: '#FFFFFF',
    fontSize: '11px',
    color: '#6B7280'
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  legendLine: {
    width: '20px',
    height: '3px',
    borderRadius: '2px'
  },
  legendLineDashed: {
    width: '20px',
    height: '3px',
    borderRadius: '2px',
    backgroundImage: 'repeating-linear-gradient(90deg, #3B82F6, #3B82F6 4px, transparent 4px, transparent 8px)'
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    gap: '12px'
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '2px solid #E5E5E5',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '12px',
    color: '#6B7280'
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px'
  },
  errorText: {
    fontSize: '12px',
    color: '#DC2626'
  },
  emptyContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px'
  },
  emptyText: {
    fontSize: '12px',
    color: '#6B7280'
  }
};
