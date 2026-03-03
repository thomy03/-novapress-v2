'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import FlowchartNode from './FlowchartNode';
import FlowchartEdge from './FlowchartEdge';
import NodeEvidencePanel from './NodeEvidencePanel';
import type {
  CausalNode,
  CausalEdge,
  AggregatedCausalNode,
  AggregatedCausalEdge,
  NarrativeFlow,
} from '@/app/types/causal';

const nodeTypes = { flowchart: FlowchartNode };
const edgeTypes = { flowchart: FlowchartEdge };

// ==========================================
// BFS Layout Algorithm
// ==========================================

function bfsLayout(
  nodes: CausalNode[],
  edges: CausalEdge[],
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  if (nodes.length === 0) return positions;

  // Build adjacency list (cause_text -> effect_text)
  const nodeByLabel = new Map<string, CausalNode>();
  for (const n of nodes) nodeByLabel.set(n.label, n);

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }

  for (const edge of edges) {
    const src = nodes.find(n => n.label === edge.cause_text);
    const tgt = nodes.find(n => n.label === edge.effect_text);
    if (src && tgt) {
      outgoing.get(src.id)?.push(tgt.id);
      incoming.get(tgt.id)?.push(src.id);
    }
  }

  // Find root nodes (no incoming edges)
  const roots = nodes.filter(n => (incoming.get(n.id)?.length || 0) === 0);
  if (roots.length === 0) roots.push(nodes[0]); // fallback

  // BFS to assign layers
  const layers: Map<string, number> = new Map();
  const queue: string[] = [];
  for (const r of roots) {
    layers.set(r.id, 0);
    queue.push(r.id);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current) || 0;
    for (const next of (outgoing.get(current) || [])) {
      if (!layers.has(next) || layers.get(next)! < currentLayer + 1) {
        layers.set(next, currentLayer + 1);
        queue.push(next);
      }
    }
  }

  // Assign remaining unvisited nodes
  for (const n of nodes) {
    if (!layers.has(n.id)) {
      layers.set(n.id, 0);
    }
  }

  // Group by layer
  const layerGroups: Map<number, string[]> = new Map();
  for (const [nodeId, layer] of layers) {
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(nodeId);
  }

  // Position: x = layer * 300, y centered per layer
  const COL_WIDTH = 300;
  const ROW_HEIGHT = 120;
  for (const [layer, nodeIds] of layerGroups) {
    const totalHeight = nodeIds.length * ROW_HEIGHT;
    const startY = -totalHeight / 2;
    nodeIds.forEach((id, idx) => {
      positions[id] = {
        x: layer * COL_WIDTH,
        y: startY + idx * ROW_HEIGHT,
      };
    });
  }

  return positions;
}

// ==========================================
// Props
// ==========================================

interface LivingCausalGraphProps {
  nodes: (CausalNode | AggregatedCausalNode)[];
  edges: (CausalEdge | AggregatedCausalEdge)[];
  centralEntity?: string;
  narrativeFlow?: NarrativeFlow;
  syntheses?: { id: string; title: string; date: string }[];
}

// ==========================================
// Inner component
// ==========================================

function LivingCausalGraphInner({
  nodes: causalNodes,
  edges: causalEdges,
  centralEntity,
  narrativeFlow,
  syntheses,
}: LivingCausalGraphProps) {
  const [selectedNode, setSelectedNode] = useState<(CausalNode | AggregatedCausalNode) | null>(null);

  // Derive the latest synthesis timestamp to detect "new" nodes
  const latestTimestamp = useMemo(() => {
    let max = 0;
    for (const n of causalNodes) {
      const agg = n as AggregatedCausalNode;
      if (agg.last_seen && agg.last_seen > max) max = agg.last_seen;
    }
    return max;
  }, [causalNodes]);

  // Build React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    const positions = bfsLayout(causalNodes, causalEdges);
    return causalNodes.map((node) => {
      const agg = node as AggregatedCausalNode;
      const isNew = latestTimestamp > 0 && agg.last_seen === latestTimestamp;
      return {
        id: node.id,
        type: 'flowchart',
        position: positions[node.id] || { x: 0, y: 0 },
        data: {
          label: node.label,
          nodeType: node.node_type,
          mentionCount: agg.mention_count || 1,
          firstSeen: agg.first_seen || undefined,
          lastSeen: agg.last_seen || undefined,
          isNew,
        },
      };
    });
  }, [causalNodes, causalEdges, latestTimestamp]);

  // Build React Flow edges — filter out edges with no matching source/target node
  const initialEdges: Edge[] = useMemo(() => {
    return causalEdges
      .map((edge, idx) => {
        const src = causalNodes.find(n => n.label === edge.cause_text);
        const tgt = causalNodes.find(n => n.label === edge.effect_text);
        if (!src || !tgt) return null; // Skip invalid edges
        const agg = edge as AggregatedCausalEdge;
        return {
          id: agg.id || `edge-${idx}`,
          source: src.id,
          target: tgt.id,
          type: 'flowchart',
          data: {
            relationType: edge.relation_type,
            confidence: edge.confidence,
            mentionCount: agg.mention_count || 1,
          },
        };
      })
      .filter(Boolean) as Edge[];
  }, [causalNodes, causalEdges]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Handle node click -> show evidence panel
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const causalNode = causalNodes.find(n => n.id === node.id) || null;
    setSelectedNode(causalNode);
  }, [causalNodes]);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  if (causalNodes.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        backgroundColor: '#F9FAFB',
        border: '1px dashed #E5E5E5',
        height: '100%',
        minHeight: '400px',
      }}>
        <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 8px 0', fontFamily: 'Georgia, serif' }}>
          Graphe causal en attente
        </p>
        <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0, textAlign: 'center', maxWidth: '300px' }}>
          Les relations causales apparaitront ici au fur et a mesure que le pipeline genere des syntheses.
        </p>
      </div>
    );
  }

  // Count unique entity nodes
  const entityCount = causalNodes.filter(n => n.node_type === 'entity').length;

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: '500px', position: 'relative' }}>
      {/* Graph area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Stats bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '10px 16px',
          borderBottom: '1px solid #E5E5E5',
          fontSize: '12px',
          color: '#6B7280',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#FFFFFF',
        }}>
          <span><strong style={{ color: '#000' }}>{causalNodes.length}</strong> noeuds</span>
          <span style={{ color: '#E5E5E5' }}>|</span>
          <span><strong style={{ color: '#000' }}>{causalEdges.length}</strong> relations</span>
          {entityCount > 0 && (
            <>
              <span style={{ color: '#E5E5E5' }}>|</span>
              <span><strong style={{ color: '#000' }}>{entityCount}</strong> entit\u00e9s</span>
            </>
          )}
          {centralEntity && (
            <>
              <span style={{ color: '#E5E5E5' }}>|</span>
              <span>Centre: <strong style={{ color: '#000' }}>{centralEntity}</strong></span>
            </>
          )}
          {narrativeFlow && (
            <>
              <span style={{ color: '#E5E5E5' }}>|</span>
              <span>Arc: <strong style={{ color: '#000' }}>{narrativeFlow}</strong></span>
            </>
          )}
        </div>

        {/* React Flow */}
        <div style={{ height: 'calc(100% - 38px)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            {/* Custom arrow marker */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
              <defs>
                <marker
                  id="flowchart-arrow"
                  viewBox="0 0 10 10"
                  refX="10"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
                </marker>
              </defs>
            </svg>
            <Background variant={BackgroundVariant.Dots} color="#E5E5E5" gap={20} size={1} />
            <Controls showInteractive={false} style={{ bottom: 10, left: 10 }} />
            <MiniMap
              nodeColor={() => '#D1D5DB'}
              maskColor="rgba(255, 255, 255, 0.85)"
              style={{ bottom: 10, right: 10, border: '1px solid #E5E5E5' }}
            />
          </ReactFlow>
        </div>
      </div>

      {/* Evidence Panel (slides in from right) */}
      {selectedNode && (
        <NodeEvidencePanel
          node={selectedNode}
          edges={causalEdges}
          allNodes={causalNodes}
          syntheses={syntheses}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

// ==========================================
// Wrapper with Provider
// ==========================================

export default function LivingCausalGraph(props: LivingCausalGraphProps) {
  return (
    <ReactFlowProvider>
      <LivingCausalGraphInner {...props} />
    </ReactFlowProvider>
  );
}
