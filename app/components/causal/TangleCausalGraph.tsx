'use client';

import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Link from 'next/link';

import TangleNodeComponent, { TangleNodeData } from './TangleNode';
import TangleEdgeComponent, { TangleEdgeData } from './TangleEdge';
import {
  CausalNode,
  CausalEdge,
  NarrativeFlow,
  RELATION_CONFIG,
} from '@/app/types/causal';

// Custom node and edge types
const nodeTypes = {
  tangle: TangleNodeComponent,
};

const edgeTypes = {
  tangle: TangleEdgeComponent,
};

interface TangleCausalGraphProps {
  nodes: CausalNode[];
  edges: CausalEdge[];
  centralEntity: string;
  narrativeFlow: NarrativeFlow;
  synthesisId?: string;
  isFullScreen?: boolean;
  onNodeClick?: (nodeId: string, nodeData: CausalNode) => void;
  onEdgeClick?: (edge: CausalEdge) => void;
}

// Force-directed layout simulation
function forceDirectedLayout(
  nodes: CausalNode[],
  edges: CausalEdge[],
  width: number,
  height: number,
  iterations: number = 100
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  // Initialize random positions
  nodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const radius = Math.min(width, height) * 0.3;
    positions[node.id] = {
      x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
      y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
    };
  });

  // Build adjacency for edge lookup
  const edgeMap = new Map<string, string[]>();
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.label === edge.cause_text);
    const targetNode = nodes.find(n => n.label === edge.effect_text);
    if (sourceNode && targetNode) {
      if (!edgeMap.has(sourceNode.id)) edgeMap.set(sourceNode.id, []);
      if (!edgeMap.has(targetNode.id)) edgeMap.set(targetNode.id, []);
      edgeMap.get(sourceNode.id)!.push(targetNode.id);
      edgeMap.get(targetNode.id)!.push(sourceNode.id);
    }
  });

  // Force simulation
  const k = Math.sqrt((width * height) / nodes.length) * 0.5; // Optimal distance
  const cooling = 0.95;
  let temperature = width / 10;

  for (let iter = 0; iter < iterations; iter++) {
    const forces: Record<string, { fx: number; fy: number }> = {};
    nodes.forEach(n => (forces[n.id] = { fx: 0, fy: 0 }));

    // Repulsive forces between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];
        const dx = positions[n2.id].x - positions[n1.id].x;
        const dy = positions[n2.id].y - positions[n1.id].y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (k * k) / dist;

        forces[n1.id].fx -= (force * dx) / dist;
        forces[n1.id].fy -= (force * dy) / dist;
        forces[n2.id].fx += (force * dx) / dist;
        forces[n2.id].fy += (force * dy) / dist;
      }
    }

    // Attractive forces along edges
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.label === edge.cause_text);
      const targetNode = nodes.find(n => n.label === edge.effect_text);
      if (sourceNode && targetNode) {
        const dx = positions[targetNode.id].x - positions[sourceNode.id].x;
        const dy = positions[targetNode.id].y - positions[sourceNode.id].y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (dist * dist) / k;

        forces[sourceNode.id].fx += (force * dx) / dist;
        forces[sourceNode.id].fy += (force * dy) / dist;
        forces[targetNode.id].fx -= (force * dx) / dist;
        forces[targetNode.id].fy -= (force * dy) / dist;
      }
    });

    // Apply forces with temperature
    nodes.forEach(node => {
      const f = forces[node.id];
      const mag = Math.sqrt(f.fx * f.fx + f.fy * f.fy);
      if (mag > 0) {
        const limitedMag = Math.min(mag, temperature);
        positions[node.id].x += (f.fx / mag) * limitedMag;
        positions[node.id].y += (f.fy / mag) * limitedMag;
      }

      // Keep within bounds
      positions[node.id].x = Math.max(80, Math.min(width - 80, positions[node.id].x));
      positions[node.id].y = Math.max(80, Math.min(height - 80, positions[node.id].y));
    });

    temperature *= cooling;
  }

  return positions;
}

function TangleCausalGraphInner({
  nodes: causalNodes,
  edges: causalEdges,
  centralEntity,
  narrativeFlow,
  synthesisId,
  isFullScreen = false,
  onNodeClick,
  onEdgeClick,
}: TangleCausalGraphProps) {
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();

  // Build nodes from edges if nodes array is empty or insufficient
  // This fixes the issue where backend returns edges without matching nodes
  const effectiveNodes = useMemo(() => {
    // If we have enough nodes that match the edges, use them
    if (causalNodes.length > 0) {
      // Check if nodes actually match the edges
      let matchCount = 0;
      causalEdges.forEach(edge => {
        if (causalNodes.some(n => n.label === edge.cause_text || n.label.includes(edge.cause_text.substring(0, 30)))) matchCount++;
        if (causalNodes.some(n => n.label === edge.effect_text || n.label.includes(edge.effect_text.substring(0, 30)))) matchCount++;
      });
      // If at least 50% match, use existing nodes
      if (matchCount >= causalEdges.length) {
        return causalNodes;
      }
    }

    // Generate nodes from edges
    const nodeMap = new Map<string, CausalNode>();
    let nodeId = 0;

    causalEdges.forEach(edge => {
      // Add cause as node
      const causeLabel = edge.cause_text.substring(0, 80);
      if (!nodeMap.has(causeLabel)) {
        nodeMap.set(causeLabel, {
          id: `node_${nodeId++}`,
          label: causeLabel,
          node_type: 'event',
          fact_density: edge.confidence || 0.5,
        });
      }

      // Add effect as node
      const effectLabel = edge.effect_text.substring(0, 80);
      if (!nodeMap.has(effectLabel)) {
        nodeMap.set(effectLabel, {
          id: `node_${nodeId++}`,
          label: effectLabel,
          node_type: 'event',
          fact_density: edge.confidence || 0.5,
        });
      }
    });

    const generatedNodes = Array.from(nodeMap.values());
    console.log(`[TangleCausalGraph] Generated ${generatedNodes.length} nodes from ${causalEdges.length} edges`);
    return generatedNodes.length > 0 ? generatedNodes : causalNodes;
  }, [causalNodes, causalEdges]);

  // Calculate node connections count
  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    causalEdges.forEach(edge => {
      // Match by label or partial match
      const sourceNode = effectiveNodes.find(n =>
        n.label === edge.cause_text ||
        edge.cause_text.startsWith(n.label) ||
        n.label.startsWith(edge.cause_text.substring(0, 30))
      );
      const targetNode = effectiveNodes.find(n =>
        n.label === edge.effect_text ||
        edge.effect_text.startsWith(n.label) ||
        n.label.startsWith(edge.effect_text.substring(0, 30))
      );
      if (sourceNode) counts[sourceNode.id] = (counts[sourceNode.id] || 0) + 1;
      if (targetNode) counts[targetNode.id] = (counts[targetNode.id] || 0) + 1;
    });
    return counts;
  }, [effectiveNodes, causalEdges]);

  // Calculate layout using effectiveNodes
  const positions = useMemo(() => {
    const width = isFullScreen ? 1200 : 600;
    const height = isFullScreen ? 800 : 500;
    return forceDirectedLayout(effectiveNodes, causalEdges, width, height, 150);
  }, [effectiveNodes, causalEdges, isFullScreen]);

  // Convert to React Flow nodes using effectiveNodes
  const initialNodes: Node<TangleNodeData>[] = useMemo(() => {
    const maxConnections = Math.max(...Object.values(connectionCounts), 1);

    return effectiveNodes.map((node) => ({
      id: node.id,
      type: 'tangle',
      position: positions[node.id] || { x: 300, y: 300 },
      data: {
        label: node.label,
        nodeType: node.node_type,
        importance: (connectionCounts[node.id] || 0) / maxConnections,
        isHighlighted: node.id === highlightedNodeId,
        isSource: false,
        connectionsCount: connectionCounts[node.id] || 0,
      },
    }));
  }, [effectiveNodes, positions, connectionCounts, highlightedNodeId]);

  // Convert to React Flow edges using effectiveNodes
  const initialEdges: Edge<TangleEdgeData>[] = useMemo(() => {
    return causalEdges.map((edge, idx) => {
      // Find nodes with flexible matching (exact or partial)
      const sourceNode = effectiveNodes.find(n =>
        n.label === edge.cause_text ||
        edge.cause_text.startsWith(n.label) ||
        n.label.startsWith(edge.cause_text.substring(0, 30))
      );
      const targetNode = effectiveNodes.find(n =>
        n.label === edge.effect_text ||
        edge.effect_text.startsWith(n.label) ||
        n.label.startsWith(edge.effect_text.substring(0, 30))
      );
      const edgeId = `edge-${idx}`;

      return {
        id: edgeId,
        source: sourceNode?.id || `node_${idx * 2}`,
        target: targetNode?.id || `node_${idx * 2 + 1}`,
        type: 'tangle',
        data: {
          relationType: edge.relation_type,
          confidence: edge.confidence,
          sourceArticlesCount: edge.source_articles?.length || 1,
          isHighlighted: highlightedEdges.has(edgeId),
          label: RELATION_CONFIG[edge.relation_type]?.labelFr || edge.relation_type,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: RELATION_CONFIG[edge.relation_type]?.color || '#374151',
        },
      };
    });
  }, [effectiveNodes, causalEdges, highlightedEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when highlight changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Handle node hover - highlight connected edges
  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setHighlightedNodeId(node.id);

      // Find connected edges
      const connectedEdgeIds = new Set<string>();
      causalEdges.forEach((edge, idx) => {
        const sourceNode = effectiveNodes.find(n =>
          n.label === edge.cause_text ||
          edge.cause_text.startsWith(n.label) ||
          n.label.startsWith(edge.cause_text.substring(0, 30))
        );
        const targetNode = effectiveNodes.find(n =>
          n.label === edge.effect_text ||
          edge.effect_text.startsWith(n.label) ||
          n.label.startsWith(edge.effect_text.substring(0, 30))
        );
        if (sourceNode?.id === node.id || targetNode?.id === node.id) {
          connectedEdgeIds.add(`edge-${idx}`);
        }
      });
      setHighlightedEdges(connectedEdgeIds);
    },
    [effectiveNodes, causalEdges]
  );

  const handleNodeMouseLeave = useCallback(() => {
    setHighlightedNodeId(null);
    setHighlightedEdges(new Set());
  }, []);

  // Handle node click
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const causalNode = effectiveNodes.find((n) => n.id === node.id);
      if (causalNode && onNodeClick) {
        onNodeClick(node.id, causalNode);
      }
    },
    [effectiveNodes, onNodeClick]
  );

  // Handle edge click
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const causalEdge = causalEdges.find(
        (e, idx) => `edge-${idx}` === edge.id
      );
      if (causalEdge && onEdgeClick) {
        onEdgeClick(causalEdge);
      }
    },
    [causalEdges, onEdgeClick]
  );

  // Show empty state only if no edges (effectiveNodes is built from edges)
  if (effectiveNodes.length === 0 && causalEdges.length === 0) {
    return (
      <div style={styles.emptyState}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1">
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="18" r="3" />
          <path d="M9 6h6M6 9v6M18 9v6M9 18h6" />
        </svg>
        <p style={styles.emptyText}>Graphe causal en attente</p>
        <p style={styles.emptySubtext}>
          Les relations cause-effet seront visualisees ici.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={isFullScreen ? styles.containerFullScreen : styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h3 style={styles.title}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            Nexus Causal
          </h3>
        </div>
        <div style={styles.headerRight}>
          {!isFullScreen && synthesisId && (
            <Link href={`/synthesis/${synthesisId}/causal`} style={styles.expandButton}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              Agrandir
            </Link>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div style={styles.statsBar}>
        <span style={styles.statItem}>
          <span style={{ ...styles.dot, backgroundColor: '#1E40AF' }} />
          <strong>{effectiveNodes.length}</strong> entites
        </span>
        <span style={styles.statDivider}>|</span>
        <span style={styles.statItem}>
          <span style={{ ...styles.dot, backgroundColor: '#DC2626' }} />
          <strong>{causalEdges.length}</strong> relations
        </span>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(RELATION_CONFIG).map(([key, config]) => (
          <div key={key} style={styles.legendItem}>
            <div style={{ ...styles.legendLine, backgroundColor: config.color }} />
            <span>{config.labelFr}</span>
          </div>
        ))}
      </div>

      {/* React Flow Graph */}
      <div style={styles.graphContainer}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onEdgeClick={handleEdgeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
          maxZoom={2}
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnScroll={true}
          zoomOnScroll={true}
        >
          <Background color="#E5E5E5" gap={25} size={1} />
          <Controls
            showZoom={true}
            showFitView={true}
            showInteractive={false}
            position="bottom-left"
          />
          {isFullScreen && (
            <MiniMap
              nodeColor={(node) => {
                const data = node.data as TangleNodeData;
                if (data?.isHighlighted) return '#1E40AF';
                if (data?.nodeType === 'event') return '#DC2626';
                if (data?.nodeType === 'decision') return '#059669';
                return '#3B82F6';
              }}
              maskColor="rgba(255, 255, 255, 0.8)"
              position="bottom-right"
            />
          )}

          {/* Central entity indicator */}
          <Panel position="top-left" style={styles.centralPanel}>
            <span style={styles.centralLabel}>Focus:</span>
            <span style={styles.centralValue}>{centralEntity}</span>
          </Panel>
        </ReactFlow>
      </div>

      {/* Instructions */}
      <p style={styles.instructions}>
        Survolez un noeud pour voir ses connexions. Faites glisser pour reorganiser.
      </p>
    </div>
  );
}

// Wrapper with ReactFlowProvider
export default function TangleCausalGraph(props: TangleCausalGraphProps) {
  return (
    <ReactFlowProvider>
      <TangleCausalGraphInner {...props} />
    </ReactFlowProvider>
  );
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 500,
  },
  containerFullScreen: {
    backgroundColor: '#FFFFFF',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '2px solid #000000',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: '15px',
    fontWeight: 700,
    color: '#000000',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
  },
  expandButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#1E40AF',
    backgroundColor: '#EFF6FF',
    border: '1px solid #BFDBFE',
    borderRadius: 4,
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  statsBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    backgroundColor: '#F9FAFB',
    fontSize: '12px',
    color: '#6B7280',
    borderBottom: '1px solid #E5E5E5',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    color: '#D1D5DB',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    padding: '8px 16px',
    backgroundColor: '#FAFAFA',
    borderBottom: '1px solid #E5E5E5',
    fontSize: '10px',
    color: '#6B7280',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  graphContainer: {
    flex: 1,
    minHeight: 350,
  },
  instructions: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#9CA3AF',
    padding: '8px 16px',
    borderTop: '1px solid #E5E5E5',
    margin: 0,
    fontStyle: 'italic',
  },
  centralPanel: {
    backgroundColor: '#F0F9FF',
    padding: '6px 12px',
    borderRadius: 4,
    border: '1px solid #BFDBFE',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  centralLabel: {
    fontSize: '10px',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  centralValue: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#1E40AF',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    backgroundColor: '#F9FAFB',
    border: '1px dashed #E5E5E5',
    height: '100%',
    minHeight: 400,
  },
  emptyText: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '16px 0 8px 0',
    fontFamily: 'Georgia, serif',
  },
  emptySubtext: {
    fontSize: '12px',
    color: '#9CA3AF',
    margin: 0,
    textAlign: 'center',
    maxWidth: 250,
  },
};
