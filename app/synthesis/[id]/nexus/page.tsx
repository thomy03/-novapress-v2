'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { causalService } from '@/app/lib/api/services/causal';
import { getNodeIcon, getNodeSize } from '@/app/lib/causal-icons';
import type {
  CausalGraphResponse,
  CausalNode as ApiCausalNode,
  CausalEdge as ApiCausalEdge,
  RelationType,
  Prediction,
} from '@/app/types/causal';

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPE_COLORS: Record<string, string> = {
  event: '#DC2626',
  entity: '#2563EB',
  decision: '#F59E0B',
  outcome: '#10B981',
  keyword: '#10B981',
  focus: '#2563EB',
  prediction: '#8B5CF6',
  scenario: '#8B5CF6',
};


const EDGE_COLORS: Record<string, string> = {
  causes: '#DC2626',
  triggers: '#F59E0B',
  enables: '#10B981',
  prevents: '#6B7280',
  relates_to: '#6B7280',
};

const EDGE_DASH: Record<string, string | undefined> = {
  causes: undefined,
  triggers: '6 4',
  enables: '2 4',
  prevents: '4 4',
  relates_to: '2 2',
};

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_NODES = [
  { id: 'n1', label: 'Policy Announcement', type: 'event' },
  { id: 'n2', label: 'EU Commission', type: 'entity' },
  { id: 'n3', label: 'Market Reaction', type: 'event' },
  { id: 'n4', label: 'Sanctions Decision', type: 'decision' },
  { id: 'n5', label: 'Supply Chain Disruption', type: 'event' },
  { id: 'n6', label: 'Inflation Spike', type: 'outcome' },
  { id: 'n7', label: 'Central Bank', type: 'entity' },
];

const DEMO_EDGES = [
  { source: 'n1', target: 'n3', relation_type: 'causes' as RelationType, confidence: 0.92, cause_text: 'Policy Announcement', effect_text: 'Market Reaction' },
  { source: 'n2', target: 'n4', relation_type: 'triggers' as RelationType, confidence: 0.85, cause_text: 'EU Commission', effect_text: 'Sanctions Decision' },
  { source: 'n4', target: 'n5', relation_type: 'causes' as RelationType, confidence: 0.78, cause_text: 'Sanctions Decision', effect_text: 'Supply Chain Disruption' },
  { source: 'n5', target: 'n6', relation_type: 'enables' as RelationType, confidence: 0.71, cause_text: 'Supply Chain Disruption', effect_text: 'Inflation Spike' },
  { source: 'n7', target: 'n1', relation_type: 'triggers' as RelationType, confidence: 0.88, cause_text: 'Central Bank', effect_text: 'Policy Announcement' },
  { source: 'n3', target: 'n4', relation_type: 'enables' as RelationType, confidence: 0.65, cause_text: 'Market Reaction', effect_text: 'Sanctions Decision' },
];

const DEMO_CENTRAL = 'n1';

// ============================================================================
// CUSTOM NODE COMPONENT
// ============================================================================

interface CausalSquareNodeData {
  label: string;
  nodeType: string;
  isCentral: boolean;
  size: number;
  probability?: number;
  [key: string]: unknown;
}

function CausalSquareNode({ data }: NodeProps) {
  const nodeData = data as unknown as CausalSquareNodeData;
  const { label, nodeType, isCentral, probability } = nodeData;
  const color = TYPE_COLORS[nodeType] || '#6B7280';
  const isPrediction = nodeType === 'prediction' || nodeType === 'scenario';
  const size = nodeData.size || (isCentral ? 80 : isPrediction ? 72 : 64);
  const icon = getNodeIcon(label, nodeType);
  const iconSize = Math.round(size * 0.4);

  // Probability-based styling for prediction nodes
  let borderStyle = isPrediction ? 'dashed' : 'solid';
  let borderWidth = 2;
  let borderColor = color;
  let labelColor = isPrediction ? color : '#FFFFFF';
  if (isPrediction && probability !== undefined) {
    if (probability >= 0.7) {
      borderStyle = 'solid';
      borderWidth = 3;
      borderColor = '#A855F7'; // bright purple
      labelColor = '#A855F7';
    } else if (probability < 0.4) {
      borderStyle = 'dashed';
      borderWidth = 1;
      borderColor = '#6B7280'; // muted
      labelColor = '#6B7280';
    }
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        background: isPrediction ? `${color}15` : '#141414',
        border: `${borderWidth}px ${borderStyle} ${borderColor}`,
        borderRadius: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'box-shadow 0.2s ease',
        transform: isPrediction ? 'rotate(45deg)' : 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${color}80, 0 0 40px ${color}30`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Handles: left=target, right=source for horizontal flow */}
      <Handle type="target" position={Position.Left} style={{ background: color, border: 'none', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ background: color, border: 'none', width: 6, height: 6 }} />

      <svg viewBox={icon.viewBox} width={iconSize} height={iconSize} fill={isPrediction ? color : '#FFFFFF'} style={{ transform: isPrediction ? 'rotate(-45deg)' : 'none' }}>
        <path d={icon.path} />
      </svg>

      {/* Label below the node */}
      <div style={{
        position: 'absolute',
        top: size + 6,
        left: '50%',
        transform: `translateX(-50%) ${isPrediction ? 'rotate(-45deg)' : ''}`,
        whiteSpace: 'nowrap',
        fontSize: isPrediction ? 9 : 10,
        fontWeight: isPrediction && probability !== undefined && probability >= 0.7 ? 700 : 600,
        fontFamily: "'Space Grotesk', sans-serif",
        color: labelColor,
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 160,
      }}>
        {label.length > 30 ? label.substring(0, 28) + '...' : label}
      </div>
      {/* Probability badge for predictions */}
      {isPrediction && probability !== undefined && (
        <div style={{
          position: 'absolute',
          top: -10,
          right: -10,
          transform: isPrediction ? 'rotate(-45deg)' : 'none',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
          color: '#FFFFFF',
          backgroundColor: probability >= 0.7 ? '#10B981' : probability >= 0.4 ? '#F59E0B' : '#DC2626',
          padding: '2px 6px',
          minWidth: 32,
          textAlign: 'center',
        }}>
          {Math.round(probability * 100)}%
        </div>
      )}
    </div>
  );
}

const MemoizedCausalSquareNode = React.memo(CausalSquareNode);

// nodeTypes must be defined outside component to avoid re-renders
const nodeTypes = {
  causalSquare: MemoizedCausalSquareNode,
};

// ============================================================================
// LAYOUT HELPERS
// ============================================================================

interface RawNode {
  id: string;
  label: string;
  type: string;
  mention_count?: number;
}

interface RawEdge {
  source: string;
  target: string;
  relation_type: RelationType;
  confidence: number;
  cause_text?: string;
  effect_text?: string;
}

function computePositions(
  rawNodes: RawNode[],
  rawEdges: RawEdge[],
  centralId: string,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Build directed adjacency (source → targets) for proper left→right flow
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  for (const n of rawNodes) {
    children.set(n.id, []);
    parents.set(n.id, []);
  }
  for (const e of rawEdges) {
    children.get(e.source)?.push(e.target);
    parents.get(e.target)?.push(e.source);
  }

  // Find root nodes (no incoming edges) or use central
  let roots = rawNodes.filter(n => (parents.get(n.id) || []).length === 0).map(n => n.id);
  if (roots.length === 0) roots = [centralId || rawNodes[0]?.id].filter(Boolean);

  // BFS from roots to assign levels (left-to-right depth)
  const levels = new Map<string, number>();
  const queue: string[] = [];
  for (const root of roots) {
    if (!levels.has(root)) {
      levels.set(root, 0);
      queue.push(root);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels.get(current)!;
    for (const child of children.get(current) || []) {
      if (!levels.has(child) || levels.get(child)! < currentLevel + 1) {
        levels.set(child, currentLevel + 1);
        queue.push(child);
      }
    }
  }
  // Unvisited nodes get placed at level 1
  for (const n of rawNodes) {
    if (!levels.has(n.id)) levels.set(n.id, 1);
  }

  // Group by level
  const byLevel = new Map<number, string[]>();
  for (const [id, level] of levels) {
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(id);
  }

  // Layout: X = level * horizontal spacing, Y = evenly distributed vertically
  const HORIZONTAL_SPACING = 320;
  const VERTICAL_SPACING = 180;

  const sortedLevels = Array.from(byLevel.keys()).sort((a, b) => a - b);
  for (const level of sortedLevels) {
    const ids = byLevel.get(level)!;
    const totalHeight = (ids.length - 1) * VERTICAL_SPACING;
    const startY = -totalHeight / 2;

    ids.forEach((id, index) => {
      positions.set(id, {
        x: level * HORIZONTAL_SPACING,
        y: startY + index * VERTICAL_SPACING,
      });
    });
  }

  return positions;
}

// ============================================================================
// SIDEBAR STEP COMPONENT
// ============================================================================

interface SidebarStep {
  id: string;
  index: number;
  causeText: string;
  effectText: string;
  relationType: RelationType;
  confidence: number;
}

function CausalStep({
  step,
  isHighlighted,
  onClick,
}: {
  step: SidebarStep;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  const color = EDGE_COLORS[step.relationType] || '#6B7280';

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '10px 12px',
        background: isHighlighted ? `${color}15` : 'transparent',
        border: isHighlighted ? `1px solid ${color}40` : '1px solid transparent',
        borderRadius: 4,
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 9,
          fontFamily: "'Space Grotesk', monospace",
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.05em',
        }}>
          STEP {String(step.index + 1).padStart(2, '0')}
        </span>
        <span style={{
          fontSize: 9,
          fontFamily: "'Space Grotesk', monospace",
          color: color,
          marginLeft: 'auto',
          textTransform: 'uppercase',
        }}>
          {step.relationType}
        </span>
      </div>

      <div style={{
        fontSize: 12,
        fontFamily: "'Space Grotesk', sans-serif",
        color: '#FFFFFF',
        lineHeight: 1.3,
      }}>
        {step.causeText} <span style={{ color: 'rgba(255,255,255,0.3)' }}>&rarr;</span> {step.effectText}
      </div>

      {/* Confidence bar */}
      <div style={{
        width: '100%',
        height: 2,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 1,
        marginTop: 2,
      }}>
        <div style={{
          width: `${step.confidence * 100}%`,
          height: '100%',
          background: color,
          borderRadius: 1,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </button>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT (inner, needs ReactFlowProvider)
// ============================================================================

function NexusGraphInner() {
  const params = useParams();
  const synthesisId = params?.id as string;

  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState<{
    label: string;
    type: string;
    connections: string[];
    prediction?: { text: string; probability: number; timeframe?: string; rationale?: string };
  } | null>(null);

  // Raw data from API or demo
  const [rawNodes, setRawNodes] = useState<RawNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RawEdge[]>([]);
  const [centralEntity, setCentralEntity] = useState('');
  const [apiPredictions, setApiPredictions] = useState<Prediction[]>([]);

  // React Flow state
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([] as Node[]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  // Fetch data
  useEffect(() => {
    if (!synthesisId) return;

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [data, predResponse] = await Promise.all([
          causalService.getCausalGraph(synthesisId),
          causalService.getPredictions(synthesisId).catch(() => ({ predictions: [], has_predictions: false } as { predictions: Prediction[]; has_predictions: boolean })),
        ]);

        if (cancelled) return;

        if (predResponse?.predictions?.length > 0) {
          setApiPredictions(predResponse.predictions);
        }

        const hasData = data.nodes && data.nodes.length > 0 && data.edges && data.edges.length > 0;

        if (hasData) {
          setTitle(data.title || '');
          setCentralEntity(data.central_entity || data.nodes[0]?.id || '');

          const nodes: RawNode[] = data.nodes.map((n: ApiCausalNode) => ({
            id: n.id,
            label: n.label,
            type: n.node_type === 'keyword' ? 'outcome' : n.node_type,
          }));

          // API edges don't have source/target IDs directly — map from cause_text/effect_text to node IDs
          const labelToId = new Map<string, string>();
          for (const n of data.nodes) {
            labelToId.set(n.label.toLowerCase(), n.id);
          }

          const edges: RawEdge[] = data.edges.map((e: ApiCausalEdge, i: number) => {
            const sourceId = labelToId.get(e.cause_text.toLowerCase()) || nodes[0]?.id || 'n1';
            const targetId = labelToId.get(e.effect_text.toLowerCase()) || nodes[Math.min(1, nodes.length - 1)]?.id || 'n2';
            return {
              source: sourceId,
              target: targetId,
              relation_type: e.relation_type,
              confidence: e.confidence,
              cause_text: e.cause_text,
              effect_text: e.effect_text,
            };
          });

          setRawNodes(nodes);
          setRawEdges(edges);
        } else {
          // Use demo data
          setTitle('Demo Causal Analysis');
          setCentralEntity(DEMO_CENTRAL);
          setRawNodes(DEMO_NODES);
          setRawEdges(DEMO_EDGES);
        }
      } catch (err) {
        if (cancelled) return;
        console.warn('Causal API unavailable, using demo data:', err);
        setTitle('Demo Causal Analysis');
        setCentralEntity(DEMO_CENTRAL);
        setRawNodes(DEMO_NODES);
        setRawEdges(DEMO_EDGES);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [synthesisId]);

  // Build React Flow nodes/edges when raw data changes
  useEffect(() => {
    if (rawNodes.length === 0) return;

    // Generate prediction/scenario nodes from leaf nodes (outcomes with no outgoing edges)
    const outgoing = new Set(rawEdges.map(e => e.source));
    const leafNodes = rawNodes.filter(n => !outgoing.has(n.id));
    const predictionNodes: RawNode[] = [];
    const predictionEdges: RawEdge[] = [];

    // If we have API predictions, use them
    if (apiPredictions.length > 0) {
      apiPredictions.forEach((pred, i) => {
        const predId = `pred-api-${i}`;
        predictionNodes.push({
          id: predId,
          label: pred.prediction,
          type: 'prediction',
          mention_count: Math.round(pred.probability * 10),
        });
        // Connect to the most relevant leaf node (or last node)
        const parentNode = leafNodes[i % leafNodes.length] || rawNodes[rawNodes.length - 1];
        predictionEdges.push({
          source: parentNode.id,
          target: predId,
          relation_type: 'enables' as RelationType,
          confidence: pred.probability,
          cause_text: parentNode.label,
          effect_text: pred.prediction,
        });
      });
    } else {
      // Fallback: generate differentiated scenarios
      leafNodes.slice(0, 3).forEach((leaf, i) => {
        const scenarios = [
          { id: `pred-esc-${i}`, label: `Escalade: ${leaf.label}`, conf: 0.65 },
          { id: `pred-res-${i}`, label: `Resolution: ${leaf.label}`, conf: 0.35 },
          { id: `pred-stq-${i}`, label: `Statu quo: ${leaf.label}`, conf: 0.50 },
        ];
        scenarios.forEach(s => {
          predictionNodes.push({ id: s.id, label: s.label, type: 'prediction' });
          predictionEdges.push({
            source: leaf.id, target: s.id,
            relation_type: 'enables' as RelationType, confidence: s.conf,
            cause_text: leaf.label, effect_text: s.label,
          });
        });
      });
    }

    const allNodes = [...rawNodes, ...predictionNodes];
    const allEdges = [...rawEdges, ...predictionEdges];

    const positions = computePositions(allNodes, allEdges, centralEntity);

    const nodes: Node[] = allNodes.map((n) => {
      const pos = positions.get(n.id) || { x: 0, y: 0 };
      const connectionCount = allEdges.filter(e => e.source === n.id || e.target === n.id).length;
      const mentionCount = n.mention_count || 1;
      const isPred = n.type === 'prediction' || n.type === 'scenario';
      const matchedApiPred = isPred ? apiPredictions.find((_p, idx) => `pred-api-${idx}` === n.id) : undefined;
      const nodeSize = getNodeSize(mentionCount, connectionCount, n.id === centralEntity, isPred, matchedApiPred ? matchedApiPred.probability : isPred ? 0.5 : undefined);
      return {
        id: n.id,
        type: 'causalSquare',
        position: { x: pos.x, y: pos.y },
        data: {
          label: n.label,
          nodeType: n.type,
          isCentral: n.id === centralEntity,
          size: nodeSize,
          probability: matchedApiPred?.probability,
        } as CausalSquareNodeData,
      };
    });

    const edges: Edge[] = allEdges.map((e, i) => {
      const edgeId = `edge-${i}`;
      const color = EDGE_COLORS[e.relation_type] || '#6B7280';
      const dash = EDGE_DASH[e.relation_type];
      const isHighlighted = highlightedEdgeId === edgeId;

      return {
        id: edgeId,
        source: e.source,
        target: e.target,
        animated: true,
        label: e.relation_type,
        labelStyle: {
          fontSize: 9,
          fontFamily: "'Space Grotesk', monospace",
          fill: isHighlighted ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
          letterSpacing: '0.04em',
        },
        labelBgStyle: {
          fill: isHighlighted ? color : '#1A1A1A',
          fillOpacity: 0.9,
        },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 2,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: color,
          width: 16,
          height: 16,
        },
        style: {
          stroke: color,
          strokeWidth: isHighlighted ? 3 : 1.5,
          strokeDasharray: dash,
          opacity: highlightedEdgeId && !isHighlighted ? 0.25 : 1,
          transition: 'all 0.3s ease',
        },
      };
    });

    setFlowNodes(nodes);
    setFlowEdges(edges);
  }, [rawNodes, rawEdges, centralEntity, highlightedEdgeId, apiPredictions, setFlowNodes, setFlowEdges]);

  // Sidebar steps
  const sidebarSteps: SidebarStep[] = useMemo(() => {
    return rawEdges.map((e, i) => ({
      id: `edge-${i}`,
      index: i,
      causeText: e.cause_text || e.source,
      effectText: e.effect_text || e.target,
      relationType: e.relation_type,
      confidence: e.confidence,
    }));
  }, [rawEdges]);

  // Path integrity
  const pathIntegrity = useMemo(() => {
    if (rawEdges.length === 0) return 0;
    const avg = rawEdges.reduce((sum, e) => sum + e.confidence, 0) / rawEdges.length;
    return Math.round(avg * 100);
  }, [rawEdges]);

  const handleStepClick = useCallback((edgeId: string) => {
    setHighlightedEdgeId(prev => prev === edgeId ? null : edgeId);
  }, []);

  // Legend items
  const legendItems = [
    { label: 'Event', color: TYPE_COLORS.event },
    { label: 'Entity', color: TYPE_COLORS.entity },
    { label: 'Decision', color: TYPE_COLORS.decision },
    { label: 'Outcome', color: TYPE_COLORS.outcome },
  ];

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#0A0A0A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 14,
      }}>
        Loading causal graph...
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#0A0A0A',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* ZONE 1 — TOP BAR */}
      <div style={{
        height: 48,
        minHeight: 48,
        background: '#111111',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
      }}>
        <Link
          href={`/synthesis/${synthesisId}`}
          style={{
            color: 'rgba(255,255,255,0.5)',
            textDecoration: 'none',
            fontSize: 18,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          &larr;
        </Link>

        <span style={{
          fontSize: 9,
          fontFamily: "'Space Grotesk', monospace",
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          NEXUS CAUSAL GRAPH
        </span>

        <span style={{
          fontSize: 14,
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          color: 'rgba(255,255,255,0.7)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </span>

        <span style={{
          fontSize: 10,
          fontFamily: "'Space Grotesk', monospace",
          color: pathIntegrity >= 70 ? '#10B981' : pathIntegrity >= 40 ? '#F59E0B' : '#DC2626',
          letterSpacing: '0.06em',
        }}>
          PATH INTEGRITY: {pathIntegrity}%
        </span>
      </div>

      {/* ZONE 2 + 3 — SIDEBAR + CANVAS */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* ZONE 2 — LEFT SIDEBAR */}
        <div style={{
          width: 280,
          minWidth: 280,
          background: '#111111',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '16px 16px 8px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{
              fontSize: 9,
              fontFamily: "'Space Grotesk', monospace",
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              CAUSAL CHAIN
            </span>
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}>
            {sidebarSteps.map((step) => (
              <CausalStep
                key={step.id}
                step={step}
                isHighlighted={highlightedEdgeId === step.id}
                onClick={() => handleStepClick(step.id)}
              />
            ))}
          </div>

          {/* PREDICTIONS */}
          {apiPredictions.length > 0 && (
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '16px 16px 8px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{
                  fontSize: 9,
                  fontFamily: "'Space Grotesk', monospace",
                  color: '#8B5CF6',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  PREDICTIONS ({apiPredictions.length})
                </span>
              </div>
              <div style={{
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 200,
                overflowY: 'auto',
              }}>
                {apiPredictions.map((pred, i) => {
                  const probPct = Math.round(pred.probability * 100);
                  const probColor = pred.probability >= 0.7 ? '#A855F7' : pred.probability >= 0.4 ? '#8B5CF6' : '#6B7280';
                  return (
                    <div key={i} style={{
                      padding: '8px 10px',
                      background: 'rgba(139,92,246,0.06)',
                      borderRadius: 4,
                      borderLeft: `2px solid ${probColor}`,
                    }}>
                      <div style={{
                        fontSize: 11,
                        fontFamily: "'Space Grotesk', sans-serif",
                        color: '#FFFFFF',
                        lineHeight: 1.3,
                        marginBottom: 6,
                      }}>
                        {pred.prediction.length > 80 ? pred.prediction.substring(0, 80) + '...' : pred.prediction}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          flex: 1,
                          height: 4,
                          background: 'rgba(255,255,255,0.08)',
                          borderRadius: 2,
                        }}>
                          <div style={{
                            width: `${probPct}%`,
                            height: '100%',
                            background: probColor,
                            borderRadius: 2,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                        <span style={{
                          fontSize: 10,
                          fontFamily: "'Space Grotesk', monospace",
                          color: probColor,
                          fontWeight: 600,
                          minWidth: 32,
                          textAlign: 'right',
                        }}>
                          {probPct}%
                        </span>
                      </div>
                      <div style={{
                        fontSize: 9,
                        fontFamily: "'Space Grotesk', monospace",
                        color: 'rgba(255,255,255,0.35)',
                        marginTop: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {pred.timeframe.replace('_', ' ')} &middot; {pred.type}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEGEND */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{
              fontSize: 9,
              fontFamily: "'Space Grotesk', monospace",
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: 8,
            }}>
              LEGEND
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {legendItems.map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 10,
                    height: 10,
                    background: item.color,
                    borderRadius: 0,
                  }} />
                  <span style={{
                    fontSize: 10,
                    fontFamily: "'Space Grotesk', sans-serif",
                    color: 'rgba(255,255,255,0.6)',
                  }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ZONE 3 — REACT FLOW CANVAS */}
        <div style={{ flex: 1, height: '100%' }}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.1}
            maxZoom={3}
            style={{ background: '#0A0A0A' }}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_event, node) => {
              const data = node.data as unknown as CausalSquareNodeData;
              const nodeEdges = [...rawEdges, ...flowEdges.map(e => ({ source: e.source, target: e.target }))];
              const connected = nodeEdges
                .filter(e => e.source === node.id || e.target === node.id)
                .map(e => {
                  const otherId = e.source === node.id ? e.target : e.source;
                  const otherNode = [...rawNodes, ...(apiPredictions.map((p, i) => ({ id: `pred-api-${i}`, label: p.prediction })))].find(n => n.id === otherId);
                  return otherNode?.label || otherId;
                });
              const matchedPred = apiPredictions.find((_p, idx) => `pred-api-${idx}` === node.id);
              setSelectedNodeDetail({
                label: data.label,
                type: data.nodeType,
                connections: connected,
                prediction: matchedPred ? {
                  text: matchedPred.prediction,
                  probability: matchedPred.probability,
                  timeframe: matchedPred.timeframe,
                  rationale: matchedPred.rationale,
                } : undefined,
              });
            }}
            onPaneClick={() => setSelectedNodeDetail(null)}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="rgba(255,255,255,0.06)"
            />
            <MiniMap
              position="bottom-left"
              style={{
                background: '#141414',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              nodeColor={(node: Node) => {
                const data = node.data as unknown as CausalSquareNodeData;
                return TYPE_COLORS[data?.nodeType] || '#6B7280';
              }}
              maskColor="rgba(0,0,0,0.7)"
            />
            <Controls
              position="bottom-right"
              showInteractive={false}
              style={{
                background: '#1A1A1A',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            />
          </ReactFlow>

          {/* Node detail overlay */}
          {selectedNodeDetail && (
            <div style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 320,
              background: 'rgba(19,19,19,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: 20,
              zIndex: 50,
              backdropFilter: 'blur(10px)',
            }}>
              <button
                onClick={() => setSelectedNodeDetail(null)}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.4)', fontSize: 16, fontFamily: 'inherit', padding: 4,
                }}
              >
                ✕
              </button>

              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.15em',
                color: TYPE_COLORS[selectedNodeDetail.type] || '#6B7280',
                textTransform: 'uppercase' as const, marginBottom: 6,
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                {selectedNodeDetail.type}
              </div>

              <div style={{
                fontSize: 16, fontWeight: 700, color: '#FFFFFF',
                fontFamily: "'Newsreader', serif", fontStyle: 'italic',
                lineHeight: 1.3, marginBottom: 12,
              }}>
                {selectedNodeDetail.label}
              </div>

              {selectedNodeDetail.prediction && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                    color: '#8B5CF6', textTransform: 'uppercase' as const, marginBottom: 8,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    PREDICTION DETAIL
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 8, fontFamily: "'Newsreader', serif", fontStyle: 'italic' }}>
                    {selectedNodeDetail.prediction.text}
                  </p>
                  {/* Probability bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)' }}>
                      <div style={{
                        width: `${selectedNodeDetail.prediction.probability * 100}%`,
                        height: '100%',
                        background: selectedNodeDetail.prediction.probability >= 0.7 ? '#10B981' : selectedNodeDetail.prediction.probability >= 0.4 ? '#F59E0B' : '#DC2626',
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF', fontFamily: "'Space Grotesk', sans-serif" }}>
                      {Math.round(selectedNodeDetail.prediction.probability * 100)}%
                    </span>
                  </div>
                  {selectedNodeDetail.prediction.timeframe && (
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontFamily: "'Space Grotesk', sans-serif" }}>
                      {selectedNodeDetail.prediction.timeframe}
                    </span>
                  )}
                  {selectedNodeDetail.prediction.rationale && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, marginTop: 8 }}>
                      {selectedNodeDetail.prediction.rationale}
                    </p>
                  )}
                </div>
              )}

              {selectedNodeDetail.connections.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                    color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, marginBottom: 6,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}>
                    CONNEXIONS ({selectedNodeDetail.connections.length})
                  </div>
                  {selectedNodeDetail.connections.slice(0, 6).map((c, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', padding: '3px 0', fontFamily: "'Space Grotesk', sans-serif" }}>
                      → {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PAGE EXPORT (wrapped in ReactFlowProvider)
// ============================================================================

export default function NexusCausalPage() {
  return (
    <ReactFlowProvider>
      <NexusGraphInner />
    </ReactFlowProvider>
  );
}
