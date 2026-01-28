'use client';

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  ConnectionMode,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import NeuralNodeComponent, { NeuralNodeData } from './NeuralNode';
import AnimatedEdgeComponent, { AnimatedEdgeData } from './AnimatedEdge';
import {
  CausalNode,
  CausalEdge,
  NarrativeFlow,
  RELATION_CONFIG,
  NARRATIVE_FLOW_CONFIG,
} from '@/app/types/causal';

// Custom node and edge types
const nodeTypes = {
  neural: NeuralNodeComponent,
};

const edgeTypes = {
  animated: AnimatedEdgeComponent,
};

interface NeuralCausalGraphProps {
  nodes: CausalNode[];
  edges: CausalEdge[];
  centralEntity: string;
  narrativeFlow: NarrativeFlow;
  onNodeClick?: (nodeId: string, nodeData: CausalNode) => void;
  onEdgeClick?: (edge: CausalEdge) => void;
}

// Calculate graph complexity based on data richness
function calculateGraphComplexity(nodes: CausalNode[], edges: CausalEdge[]) {
  const avgSources = edges.length > 0
    ? edges.reduce((sum, e) => sum + (e.source_articles?.length || 1), 0) / edges.length
    : 1;

  return {
    dendritesPerNode: Math.min(8, Math.max(3, Math.floor(avgSources))),
    cascadeDepth: Math.min(6, Math.max(2, Math.floor(nodes.length / 3))),
    edgeThickness: (edge: CausalEdge) => 1 + (edge.confidence || 0.5) * 3,
  };
}

// Calculate neural layout (concentric circles)
function calculateNeuralLayout(
  nodes: CausalNode[],
  edges: CausalEdge[],
  centralEntity: string,
  containerWidth: number = 400
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const centerX = containerWidth / 2;
  const centerY = 200;

  // Find central node
  const centralNode = nodes.find(n =>
    n.label.toLowerCase().includes(centralEntity.toLowerCase())
  );

  // Place central node at center
  if (centralNode) {
    positions[centralNode.id] = { x: centerX, y: centerY };
  }

  // Find nodes that are causes (point TO central)
  const causeNodeIds = new Set<string>();
  const effectNodeIds = new Set<string>();

  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.label === edge.cause_text);
    const targetNode = nodes.find(n => n.label === edge.effect_text);

    if (sourceNode && targetNode) {
      if (targetNode.label.toLowerCase().includes(centralEntity.toLowerCase())) {
        causeNodeIds.add(sourceNode.id);
      }
      if (sourceNode.label.toLowerCase().includes(centralEntity.toLowerCase())) {
        effectNodeIds.add(targetNode.id);
      }
    }
  });

  // Circle 1: Causes (radius 120px, upper half)
  const causeNodes = nodes.filter(n => causeNodeIds.has(n.id));
  causeNodes.forEach((node, i) => {
    const angle = Math.PI + (Math.PI * (i + 1)) / (causeNodes.length + 1);
    positions[node.id] = {
      x: centerX + Math.cos(angle) * 120,
      y: centerY + Math.sin(angle) * 100,
    };
  });

  // Circle 2: Effects (radius 140px, lower half)
  const effectNodes = nodes.filter(n => effectNodeIds.has(n.id));
  effectNodes.forEach((node, i) => {
    const angle = (Math.PI * (i + 1)) / (effectNodes.length + 1);
    positions[node.id] = {
      x: centerX + Math.cos(angle) * 140,
      y: centerY + Math.sin(angle) * 110,
    };
  });

  // Remaining nodes in outer circle
  const placedIds = new Set([
    ...Object.keys(positions),
    ...causeNodeIds,
    ...effectNodeIds,
  ]);
  const remainingNodes = nodes.filter(n => !placedIds.has(n.id));
  remainingNodes.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / remainingNodes.length;
    positions[node.id] = {
      x: centerX + Math.cos(angle) * 180,
      y: centerY + Math.sin(angle) * 150,
    };
  });

  return positions;
}

function NeuralCausalGraphInner({
  nodes: causalNodes,
  edges: causalEdges,
  centralEntity,
  narrativeFlow,
  onNodeClick,
  onEdgeClick,
}: NeuralCausalGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const complexity = useMemo(
    () => calculateGraphComplexity(causalNodes, causalEdges),
    [causalNodes, causalEdges]
  );

  // Convert causal data to React Flow format
  const initialNodes: Node<NeuralNodeData>[] = useMemo(() => {
    const positions = calculateNeuralLayout(causalNodes, causalEdges, centralEntity);

    return causalNodes.map((node) => ({
      id: node.id,
      type: 'neural',
      position: positions[node.id] || { x: 200, y: 200 },
      data: {
        label: node.label,
        nodeType: node.node_type,
        factDensity: node.fact_density,
        sourcesCount: complexity.dendritesPerNode,
        isActivated: false,
        isSource: false,
        activationLevel: 0,
      },
    }));
  }, [causalNodes, causalEdges, centralEntity, complexity.dendritesPerNode]);

  const initialEdges: Edge<AnimatedEdgeData>[] = useMemo(() => {
    return causalEdges.map((edge, idx) => {
      const sourceNode = causalNodes.find(n => n.label === edge.cause_text);
      const targetNode = causalNodes.find(n => n.label === edge.effect_text);

      return {
        id: `edge-${idx}`,
        source: sourceNode?.id || `node-${idx}`,
        target: targetNode?.id || `node-${idx + 1}`,
        type: 'animated',
        data: {
          relationType: edge.relation_type,
          confidence: edge.confidence,
          sourceArticlesCount: edge.source_articles?.length || 1,
          isAnimated: false,
          cascadeLevel: 0,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: RELATION_CONFIG[edge.relation_type]?.color || '#374151',
        },
        style: {
          strokeWidth: 2,
        },
        animated: false,
      };
    });
  }, [causalNodes, causalEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Reset cascade effect
  const resetCascade = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isActivated: false,
          isSource: false,
          activationLevel: 0,
        },
      }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        data: {
          ...e.data,
          isAnimated: false,
          cascadeLevel: 0,
        },
      }))
    );
  }, [setNodes, setEdges]);

  // Cascade propagation function
  const propagateCascade = useCallback(
    (nodeId: string, currentDepth: number = 0, visitedNodes: Set<string> = new Set()) => {
      if (currentDepth >= complexity.cascadeDepth || visitedNodes.has(nodeId)) {
        return;
      }

      visitedNodes.add(nodeId);
      const activationDelay = currentDepth * 400;

      setTimeout(() => {
        // Activate the current node
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    isActivated: true,
                    isSource: currentDepth === 0,
                    activationLevel: currentDepth,
                  },
                }
              : n
          )
        );

        // Find outgoing edges
        const outgoingEdges = edges.filter((e) => e.source === nodeId);

        outgoingEdges.forEach((edge, index) => {
          const edgeDelay = 200 + (1 - (edge.data?.confidence || 0.5)) * 300;

          setTimeout(() => {
            // Animate the edge
            setEdges((eds) =>
              eds.map((e) =>
                e.id === edge.id
                  ? {
                      ...e,
                      data: {
                        ...e.data,
                        isAnimated: true,
                        cascadeLevel: currentDepth,
                      },
                    }
                  : e
              )
            );

            // Propagate to target node
            propagateCascade(edge.target, currentDepth + 1, visitedNodes);
          }, edgeDelay);
        });
      }, activationDelay);
    },
    [edges, complexity.cascadeDepth, setNodes, setEdges]
  );

  // Handle node click
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Reset previous cascade
      resetCascade();

      // Set selected node
      setSelectedNodeId(node.id);

      // Start new cascade
      propagateCascade(node.id);

      // Callback to parent
      const causalNode = causalNodes.find((n) => n.id === node.id);
      if (causalNode && onNodeClick) {
        onNodeClick(node.id, causalNode);
      }
    },
    [resetCascade, propagateCascade, causalNodes, onNodeClick]
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

  if (causalNodes.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <p style={styles.emptyText}>Graphe neuronal en attente</p>
        <p style={styles.emptySubtext}>
          Les relations causales seront affichees ici apres l'execution du pipeline.
        </p>
      </div>
    );
  }

  const flowConfig = NARRATIVE_FLOW_CONFIG[narrativeFlow];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Nexus Causal</h3>
        <div
          style={{
            ...styles.flowBadge,
            backgroundColor: flowConfig?.color ? `${flowConfig.color}15` : '#F3F4F6',
            color: flowConfig?.color || '#6B7280',
          }}
        >
          <span>{flowConfig?.icon || '→'}</span>
          <span>{flowConfig?.labelFr || 'Lineaire'}</span>
        </div>
      </div>

      {/* Graph stats */}
      <div style={styles.statsBar}>
        <span style={styles.statItem}>
          <strong>{causalNodes.length}</strong> noeuds
        </span>
        <span style={styles.statDivider}>|</span>
        <span style={styles.statItem}>
          <strong>{causalEdges.length}</strong> relations
        </span>
        <span style={styles.statDivider}>|</span>
        <span style={styles.statItem}>
          Max <strong>{complexity.cascadeDepth}</strong> niveaux
        </span>
      </div>

      {/* React Flow Graph */}
      <div style={styles.graphContainer}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#E5E5E5" gap={20} />
          <Controls
            showZoom={true}
            showFitView={true}
            showInteractive={false}
            style={{ bottom: 10, left: 10 }}
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.data?.isSource) return '#DC2626';
              if (node.data?.isActivated) return '#3B82F6';
              return '#E5E7EB';
            }}
            maskColor="rgba(255, 255, 255, 0.8)"
            style={{ bottom: 10, right: 10 }}
          />
        </ReactFlow>
      </div>

      {/* Instructions */}
      <p style={styles.instructions}>
        Cliquez sur un noeud pour declencher la cascade d'effets
      </p>

      {/* Central entity info */}
      {centralEntity && (
        <div style={styles.centralInfo}>
          <span style={styles.centralLabel}>Entite centrale:</span>
          <span style={styles.centralValue}>{centralEntity}</span>
        </div>
      )}
    </div>
  );
}

// Wrap with ReactFlowProvider
export default function NeuralCausalGraph(props: NeuralCausalGraphProps) {
  return (
    <ReactFlowProvider>
      <NeuralCausalGraphInner {...props} />
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
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderBottom: '2px solid #000000',
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    fontWeight: 700,
    color: '#000000',
    margin: 0,
  },
  flowBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderRadius: '2px',
  },
  statsBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    backgroundColor: '#F9FAFB',
    fontSize: '11px',
    color: '#6B7280',
    borderBottom: '1px solid #E5E5E5',
  },
  statItem: {},
  statDivider: {
    color: '#D1D5DB',
  },
  graphContainer: {
    flex: 1,
    minHeight: '400px',
  },
  instructions: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#9CA3AF',
    padding: '8px',
    borderTop: '1px solid #E5E5E5',
    margin: 0,
    fontStyle: 'italic',
  },
  centralInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#F0F9FF',
    borderTop: '1px solid #E5E5E5',
  },
  centralLabel: {
    fontSize: '11px',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  centralValue: {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
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
    minHeight: '400px',
  },
  emptyIcon: {
    marginBottom: '16px',
    opacity: 0.5,
  },
  emptyText: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '0 0 8px 0',
    fontFamily: 'Georgia, serif',
  },
  emptySubtext: {
    fontSize: '12px',
    color: '#9CA3AF',
    margin: 0,
    textAlign: 'center',
    maxWidth: '250px',
  },
};
