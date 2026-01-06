'use client';

import React, { useCallback, useState, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Link from 'next/link';

import {
  CausalNode,
  CausalEdge,
  NarrativeFlow,
  RELATION_CONFIG,
} from '@/app/types/causal';

// Related synthesis type
interface RelatedSynthesis {
  id: string;
  title: string;
  similarity: number;
}

interface TreeCausalGraphProps {
  nodes: CausalNode[];
  edges: CausalEdge[];
  centralEntity: string;
  narrativeFlow: NarrativeFlow;
  synthesisId?: string;
  relatedSyntheses?: RelatedSynthesis[];
  isFullScreen?: boolean;
  onNodeClick?: (nodeId: string, nodeData: CausalNode) => void;
}

// Edge colors - VERY VISIBLE
const EDGE_COLORS = {
  causes: '#1E40AF',
  triggers: '#DC2626',
  enables: '#059669',
  prevents: '#7C3AED',
};

// Simple node component with letter
function SimpleNode({ data }: { data: { label: string; isRevealed: boolean; isActive: boolean; nodeType: string } }) {
  const colors = {
    entity: { bg: '#DBEAFE', border: '#1E40AF' },
    event: { bg: '#FEE2E2', border: '#DC2626' },
    decision: { bg: '#D1FAE5', border: '#059669' },
  };
  const c = colors[data.nodeType as keyof typeof colors] || colors.entity;

  return (
    <div
      style={{
        width: 50,
        height: 50,
        borderRadius: '50%',
        backgroundColor: data.isActive ? c.border : c.bg,
        border: `3px solid ${c.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        opacity: data.isRevealed ? 1 : 0.3,
        transition: 'all 0.5s ease',
        boxShadow: data.isActive ? `0 0 20px ${c.border}` : '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <span style={{
        fontWeight: 700,
        fontSize: 18,
        color: data.isActive ? '#FFF' : c.border
      }}>
        {data.label.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

// Simple edge component - THICK and VISIBLE
function SimpleEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  markerEnd
}: any) {
  const isRevealed = data?.isRevealed ?? true;
  const color = EDGE_COLORS[data?.relationType as keyof typeof EDGE_COLORS] || EDGE_COLORS.causes;

  // Calculate control points for curved line
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const curvature = 0.3;
  const controlX = midX - dy * curvature;
  const controlY = midY + dx * curvature;

  const path = `M ${sourceX} ${sourceY} Q ${controlX} ${controlY} ${targetX} ${targetY}`;

  return (
    <g>
      {/* Thick background for visibility */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={isRevealed ? 8 : 2}
        strokeOpacity={isRevealed ? 0.3 : 0.1}
        strokeLinecap="round"
      />
      {/* Main line */}
      <path
        id={id}
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={isRevealed ? 4 : 1}
        strokeOpacity={isRevealed ? 1 : 0.3}
        strokeLinecap="round"
        markerEnd={markerEnd}
        style={{ transition: 'all 0.5s ease' }}
      />
      {/* Animated dash for revealed edges */}
      {isRevealed && (
        <path
          d={path}
          fill="none"
          stroke="#FFF"
          strokeWidth={2}
          strokeDasharray="8,12"
          strokeLinecap="round"
          style={{
            animation: 'flowDash 1s linear infinite',
          }}
        />
      )}
    </g>
  );
}

const nodeTypes = { simple: SimpleNode };
const edgeTypes = { simple: SimpleEdge };

function TreeCausalGraphInner({
  nodes: causalNodes,
  edges: causalEdges,
  centralEntity,
  synthesisId,
  relatedSyntheses = [],
  isFullScreen = false,
  onNodeClick,
}: TreeCausalGraphProps) {
  // State for progressive reveal
  const [revealedCount, setRevealedCount] = useState(3);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Sort edges by confidence to show most important first
  const sortedEdges = useMemo(() => {
    return [...causalEdges].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  }, [causalEdges]);

  // Calculate tree layout (top to bottom)
  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const width = isFullScreen ? 1000 : 500;
    const levelHeight = 120;

    // Build adjacency
    const childrenOf: Record<string, string[]> = {};
    const parentOf: Record<string, string> = {};

    sortedEdges.forEach(edge => {
      const source = causalNodes.find(n => n.label === edge.cause_text);
      const target = causalNodes.find(n => n.label === edge.effect_text);
      if (source && target) {
        if (!childrenOf[source.id]) childrenOf[source.id] = [];
        childrenOf[source.id].push(target.id);
        parentOf[target.id] = source.id;
      }
    });

    // Find root nodes (no parent)
    const roots = causalNodes.filter(n => !parentOf[n.id]);

    // BFS to assign levels
    const levels: Record<string, number> = {};
    const queue = roots.map(r => ({ id: r.id, level: 0 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      levels[id] = level;

      const children = childrenOf[id] || [];
      children.forEach(childId => {
        if (!visited.has(childId)) {
          queue.push({ id: childId, level: level + 1 });
        }
      });
    }

    // Assign unvisited nodes
    causalNodes.forEach(n => {
      if (!visited.has(n.id)) {
        levels[n.id] = Object.keys(levels).length > 0
          ? Math.max(...Object.values(levels)) + 1
          : 0;
      }
    });

    // Group by level and position
    const nodesByLevel: Record<number, string[]> = {};
    Object.entries(levels).forEach(([id, level]) => {
      if (!nodesByLevel[level]) nodesByLevel[level] = [];
      nodesByLevel[level].push(id);
    });

    Object.entries(nodesByLevel).forEach(([levelStr, nodeIds]) => {
      const level = parseInt(levelStr);
      const count = nodeIds.length;
      nodeIds.forEach((id, idx) => {
        pos[id] = {
          x: (width / (count + 1)) * (idx + 1),
          y: 80 + level * levelHeight,
        };
      });
    });

    return pos;
  }, [causalNodes, sortedEdges, isFullScreen]);

  // Convert to React Flow format with reveal state
  const flowNodes: Node[] = useMemo(() => {
    return causalNodes.map((node, idx) => ({
      id: node.id,
      type: 'simple',
      position: positions[node.id] || { x: 100, y: 100 },
      data: {
        label: node.label,
        nodeType: node.node_type,
        isRevealed: idx < revealedCount || activeNodeId === node.id,
        isActive: activeNodeId === node.id,
      },
    }));
  }, [causalNodes, positions, revealedCount, activeNodeId]);

  const flowEdges: Edge[] = useMemo(() => {
    return sortedEdges.slice(0, revealedCount).map((edge, idx) => {
      const source = causalNodes.find(n => n.label === edge.cause_text);
      const target = causalNodes.find(n => n.label === edge.effect_text);

      return {
        id: `edge-${idx}`,
        source: source?.id || '',
        target: target?.id || '',
        type: 'simple',
        data: {
          relationType: edge.relation_type,
          confidence: edge.confidence,
          isRevealed: true,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: EDGE_COLORS[edge.relation_type] || EDGE_COLORS.causes,
        },
      };
    });
  }, [sortedEdges, causalNodes, revealedCount]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update when reveal count changes
  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  // Handle node click - reveal connected edges
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setActiveNodeId(node.id);

    // Find connected edges and reveal one more
    if (revealedCount < sortedEdges.length) {
      setRevealedCount(prev => Math.min(prev + 1, sortedEdges.length));
    }

    // Callback
    const causalNode = causalNodes.find(n => n.id === node.id);
    if (causalNode && onNodeClick) {
      onNodeClick(node.id, causalNode);
    }
  }, [causalNodes, onNodeClick, revealedCount, sortedEdges.length]);

  // Reveal all
  const handleRevealAll = () => {
    setRevealedCount(sortedEdges.length);
  };

  // Reset
  const handleReset = () => {
    setRevealedCount(3);
    setActiveNodeId(null);
  };

  if (causalNodes.length === 0) {
    return (
      <div style={styles.emptyState}>
        <p>Graphe causal en attente</p>
      </div>
    );
  }

  return (
    <div style={isFullScreen ? styles.containerFull : styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Arbre Causal</h3>
        {synthesisId && !isFullScreen && (
          <Link href={`/synthesis/${synthesisId}/causal`} style={styles.expandBtn}>
            Agrandir
          </Link>
        )}
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <span><strong>{revealedCount}</strong>/{sortedEdges.length} relations</span>
        <span style={styles.divider}>|</span>
        <span><strong>{causalNodes.length}</strong> entites</span>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(EDGE_COLORS).map(([key, color]) => (
          <div key={key} style={styles.legendItem}>
            <div style={{ ...styles.legendLine, backgroundColor: color }} />
            <span>{RELATION_CONFIG[key as keyof typeof RELATION_CONFIG]?.labelFr || key}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <button onClick={handleReset} style={styles.controlBtn}>
          Reset
        </button>
        <button onClick={handleRevealAll} style={styles.controlBtnPrimary}>
          Tout reveler
        </button>
        {revealedCount < sortedEdges.length && (
          <button
            onClick={() => setRevealedCount(prev => prev + 1)}
            style={styles.controlBtnPrimary}
          >
            +1 relation
          </button>
        )}
      </div>

      {/* Graph */}
      <div style={styles.graphArea}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#E5E5E5" gap={30} />
          <Controls showInteractive={false} position="bottom-left" />
          <Panel position="top-left" style={styles.focusPanel}>
            <span style={styles.focusLabel}>Focus:</span>
            <span style={styles.focusValue}>{centralEntity}</span>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node labels */}
      <div style={styles.labelsList}>
        <h4 style={styles.labelsTitle}>Entites ({causalNodes.length})</h4>
        <div style={styles.labelsGrid}>
          {causalNodes.slice(0, revealedCount + 2).map((node, idx) => (
            <div
              key={node.id}
              style={{
                ...styles.labelItem,
                opacity: idx < revealedCount ? 1 : 0.4,
                backgroundColor: activeNodeId === node.id ? '#DBEAFE' : '#F9FAFB',
              }}
              onClick={() => {
                setActiveNodeId(node.id);
                if (idx >= revealedCount) {
                  setRevealedCount(idx + 1);
                }
              }}
            >
              <span style={styles.labelLetter}>{node.label.charAt(0)}</span>
              <span style={styles.labelText}>{node.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Related Syntheses */}
      {relatedSyntheses && relatedSyntheses.length > 0 && (
        <div style={styles.relatedSection}>
          <h4 style={styles.relatedTitle}>Syntheses liees</h4>
          <div style={styles.relatedList}>
            {relatedSyntheses.map(syn => (
              <Link
                key={syn.id}
                href={`/synthesis/${syn.id}`}
                style={styles.relatedItem}
              >
                <span style={styles.relatedDot} />
                <span style={styles.relatedText}>{syn.title}</span>
                <span style={styles.relatedScore}>{Math.round(syn.similarity * 100)}%</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <p style={styles.instructions}>
        Cliquez sur un noeud pour reveler la relation suivante
      </p>

      {/* CSS for animation */}
      <style jsx global>{`
        @keyframes flowDash {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}

export default function TreeCausalGraph(props: TreeCausalGraphProps) {
  return (
    <ReactFlowProvider>
      <TreeCausalGraphInner {...props} />
    </ReactFlowProvider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#FFF',
    border: '1px solid #E5E5E5',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  containerFull: {
    backgroundColor: '#FFF',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '2px solid #000',
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: 15,
    fontWeight: 700,
    margin: 0,
  },
  expandBtn: {
    fontSize: 11,
    color: '#1E40AF',
    textDecoration: 'none',
    padding: '4px 8px',
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
  },
  stats: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    padding: '8px 16px',
    backgroundColor: '#F9FAFB',
    fontSize: 12,
    color: '#6B7280',
    borderBottom: '1px solid #E5E5E5',
  },
  divider: { color: '#D1D5DB' },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    padding: '8px 16px',
    fontSize: 10,
    color: '#6B7280',
    borderBottom: '1px solid #E5E5E5',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  legendLine: {
    width: 20,
    height: 4,
    borderRadius: 2,
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    padding: '8px 16px',
    borderBottom: '1px solid #E5E5E5',
  },
  controlBtn: {
    padding: '4px 12px',
    fontSize: 11,
    border: '1px solid #E5E5E5',
    borderRadius: 4,
    backgroundColor: '#FFF',
    cursor: 'pointer',
  },
  controlBtnPrimary: {
    padding: '4px 12px',
    fontSize: 11,
    border: 'none',
    borderRadius: 4,
    backgroundColor: '#1E40AF',
    color: '#FFF',
    cursor: 'pointer',
  },
  graphArea: {
    flex: 1,
    minHeight: 300,
  },
  focusPanel: {
    backgroundColor: '#F0F9FF',
    padding: '6px 12px',
    borderRadius: 4,
    border: '1px solid #BFDBFE',
    display: 'flex',
    gap: 8,
  },
  focusLabel: {
    fontSize: 10,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  focusValue: {
    fontSize: 12,
    fontWeight: 600,
    color: '#1E40AF',
  },
  labelsList: {
    padding: '12px 16px',
    borderTop: '1px solid #E5E5E5',
    maxHeight: 150,
    overflow: 'auto',
  },
  labelsTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6B7280',
    margin: '0 0 8px 0',
    textTransform: 'uppercase',
  },
  labelsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  labelItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  labelLetter: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: '#1E40AF',
    color: '#FFF',
    fontSize: 10,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 11,
    color: '#374151',
  },
  relatedSection: {
    padding: '12px 16px',
    borderTop: '1px solid #E5E5E5',
    backgroundColor: '#FAFAFA',
  },
  relatedTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#6B7280',
    margin: '0 0 8px 0',
    textTransform: 'uppercase',
  },
  relatedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  relatedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    backgroundColor: '#FFF',
    borderRadius: 4,
    textDecoration: 'none',
    border: '1px solid #E5E5E5',
    transition: 'all 0.2s',
  },
  relatedDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#10B981',
  },
  relatedText: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  relatedScore: {
    fontSize: 10,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    padding: '2px 6px',
    borderRadius: 4,
  },
  instructions: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    padding: '8px 16px',
    borderTop: '1px solid #E5E5E5',
    margin: 0,
    fontStyle: 'italic',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: 300,
    color: '#9CA3AF',
  },
};
