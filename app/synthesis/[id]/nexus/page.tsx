'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTheme } from '@/app/contexts/ThemeContext';
import { causalService } from '@/app/lib/api/services/causal';
import type {
  CausalGraphResponse,
  CausalNode,
  CausalEdge,
  RelationType,
} from '@/app/types/causal';

// ============================================================================
// TYPES
// ============================================================================

type TerminalNodeType = 'focus' | 'event' | 'entity' | 'decision' | 'outcome';

interface TerminalNode {
  id: string;
  label: string;
  type: TerminalNodeType;
  x: number;
  y: number;
  confidence: number;
  description?: string;
}

interface TerminalEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  confidence: number;
  causeText: string;
  effectText: string;
}

interface CausalStep {
  id: string;
  label: string;
  stepType: 'origin' | 'critical' | 'decision' | 'outcome';
  description: string;
  confidence: number;
}

interface NarrativeEvent {
  id: string;
  label: string;
  timestamp: string;
  color: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const NODE_TYPE_CONFIG: Record<TerminalNodeType, {
  size: number;
  color: string;
  icon: string;
  label: string;
}> = {
  focus: { size: 64, color: '#2563EB', icon: 'hub', label: 'Focus' },
  event: { size: 48, color: '#DC2626', icon: 'priority_high', label: 'Event' },
  entity: { size: 40, color: '#2563EB', icon: 'person', label: 'Entity' },
  decision: { size: 56, color: '#F59E0B', icon: 'balance', label: 'Decision' },
  outcome: { size: 32, color: '#10B981', icon: 'check_circle', label: 'Outcome' },
};

const STEP_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  origin: { color: '#2563EB', label: 'Origin Nexus' },
  critical: { color: '#DC2626', label: 'Critical Event' },
  decision: { color: '#F59E0B', label: 'Human Decision' },
  outcome: { color: '#10B981', label: 'Final Outcome' },
};

const EDGE_STYLE: Record<RelationType, { dashArray: string }> = {
  causes: { dashArray: 'none' },
  triggers: { dashArray: '8,4' },
  enables: { dashArray: '2,4' },
  prevents: { dashArray: '12,4,2,4' },
  relates_to: { dashArray: '4,4' },
};

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_NODES: TerminalNode[] = [
  { id: 'n1', label: 'Policy Announcement', type: 'focus', x: 500, y: 300, confidence: 0.99, description: 'Central policy event triggering chain reaction' },
  { id: 'n2', label: 'Market Reaction', type: 'event', x: 300, y: 150, confidence: 0.87, description: 'Immediate market response to policy shift' },
  { id: 'n3', label: 'Key Decision Maker', type: 'entity', x: 700, y: 150, confidence: 0.92, description: 'Primary actor in the decision chain' },
  { id: 'n4', label: 'Regulatory Response', type: 'decision', x: 300, y: 450, confidence: 0.78, description: 'Regulatory framework adaptation' },
  { id: 'n5', label: 'Economic Impact', type: 'outcome', x: 700, y: 450, confidence: 0.65, description: 'Long-term economic consequences' },
  { id: 'n6', label: 'Public Opinion Shift', type: 'event', x: 150, y: 300, confidence: 0.71, description: 'Shift in public sentiment' },
  { id: 'n7', label: 'Legislative Action', type: 'decision', x: 850, y: 300, confidence: 0.83, description: 'Congressional response' },
];

const DEMO_EDGES: TerminalEdge[] = [
  { id: 'e1', sourceId: 'n1', targetId: 'n2', relationType: 'causes', confidence: 0.92, causeText: 'Policy Announcement', effectText: 'Market Reaction' },
  { id: 'e2', sourceId: 'n3', targetId: 'n1', relationType: 'triggers', confidence: 0.88, causeText: 'Key Decision Maker', effectText: 'Policy Announcement' },
  { id: 'e3', sourceId: 'n1', targetId: 'n4', relationType: 'causes', confidence: 0.81, causeText: 'Policy Announcement', effectText: 'Regulatory Response' },
  { id: 'e4', sourceId: 'n4', targetId: 'n5', relationType: 'enables', confidence: 0.73, causeText: 'Regulatory Response', effectText: 'Economic Impact' },
  { id: 'e5', sourceId: 'n2', targetId: 'n6', relationType: 'triggers', confidence: 0.67, causeText: 'Market Reaction', effectText: 'Public Opinion Shift' },
  { id: 'e6', sourceId: 'n1', targetId: 'n7', relationType: 'causes', confidence: 0.85, causeText: 'Policy Announcement', effectText: 'Legislative Action' },
  { id: 'e7', sourceId: 'n7', targetId: 'n5', relationType: 'enables', confidence: 0.62, causeText: 'Legislative Action', effectText: 'Economic Impact' },
];

const DEMO_STEPS: CausalStep[] = [
  { id: 's1', label: 'Origin Nexus', stepType: 'origin', description: 'Initial policy framework proposed by central authority', confidence: 0.99 },
  { id: 's2', label: 'Critical Event', stepType: 'critical', description: 'Immediate market downturn following announcement', confidence: 0.87 },
  { id: 's3', label: 'Human Decision', stepType: 'decision', description: 'Regulatory body initiates emergency framework review', confidence: 0.78 },
  { id: 's4', label: 'Final Outcome', stepType: 'outcome', description: 'Long-term economic restructuring begins across sectors', confidence: 0.65 },
];

const DEMO_NARRATIVE: NarrativeEvent[] = [
  { id: 'ne1', label: 'Initialization', timestamp: 'T-00:00:00', color: '#2563EB' },
  { id: 'ne2', label: 'Anomaly Detected', timestamp: 'T+02:45:12', color: '#DC2626' },
  { id: 'ne3', label: 'Decision Point', timestamp: 'T+06:12:33', color: '#F59E0B' },
  { id: 'ne4', label: 'Cascade Effect', timestamp: 'T+14:30:00', color: '#DC2626' },
  { id: 'ne5', label: 'Resolution', timestamp: 'T+23:59:59', color: '#10B981' },
];

// ============================================================================
// HELPERS
// ============================================================================

function mapNodeType(apiType: string): TerminalNodeType {
  switch (apiType) {
    case 'event': return 'event';
    case 'entity': return 'entity';
    case 'decision': return 'decision';
    case 'keyword': return 'outcome';
    default: return 'event';
  }
}

function buildStepsFromEdges(edges: TerminalEdge[], nodes: TerminalNode[]): CausalStep[] {
  if (edges.length === 0) return DEMO_STEPS;
  const steps: CausalStep[] = [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Find root nodes (appear as source but not target)
  const targetIds = new Set(edges.map(e => e.targetId));
  const sourceIds = new Set(edges.map(e => e.sourceId));
  const roots = [...sourceIds].filter(id => !targetIds.has(id));

  // BFS to build ordered steps
  const visited = new Set<string>();
  const queue = roots.length > 0 ? [...roots] : [nodes[0]?.id].filter(Boolean);

  while (queue.length > 0 && steps.length < 8) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    let stepType: CausalStep['stepType'] = 'critical';
    if (steps.length === 0) stepType = 'origin';
    else if (node.type === 'decision') stepType = 'decision';
    else if (node.type === 'outcome') stepType = 'outcome';

    steps.push({
      id: node.id,
      label: STEP_TYPE_CONFIG[stepType].label,
      stepType,
      description: node.description || node.label,
      confidence: node.confidence,
    });

    // Add children
    edges.filter(e => e.sourceId === nodeId).forEach(e => {
      if (!visited.has(e.targetId)) queue.push(e.targetId);
    });
  }

  return steps.length > 0 ? steps : DEMO_STEPS;
}

function buildNarrativeFromNodes(nodes: TerminalNode[], edges: TerminalEdge[]): NarrativeEvent[] {
  if (nodes.length === 0) return DEMO_NARRATIVE;
  const typeColors: Record<TerminalNodeType, string> = {
    focus: '#2563EB',
    event: '#DC2626',
    entity: '#2563EB',
    decision: '#F59E0B',
    outcome: '#10B981',
  };

  return nodes.slice(0, 7).map((n, i) => ({
    id: n.id,
    label: n.label,
    timestamp: `T+${String(i * 3).padStart(2, '0')}:${String(i * 15).padStart(2, '0')}:00`,
    color: typeColors[n.type] || '#2563EB',
  }));
}

function layoutNodes(apiNodes: CausalNode[], centralEntity: string): TerminalNode[] {
  if (apiNodes.length === 0) return DEMO_NODES;

  const cx = 500;
  const cy = 300;
  const radius = 220;

  return apiNodes.map((node, i) => {
    const isCentral = node.label.toLowerCase() === centralEntity.toLowerCase() || i === 0;
    let type: TerminalNodeType = mapNodeType(node.node_type);
    let x: number, y: number;

    if (isCentral && i === 0) {
      type = 'focus';
      x = cx;
      y = cy;
    } else {
      const angle = ((i - 1) / Math.max(apiNodes.length - 1, 1)) * Math.PI * 2 - Math.PI / 2;
      const r = radius + (i % 2 === 0 ? 40 : -20);
      x = cx + Math.cos(angle) * r;
      y = cy + Math.sin(angle) * r;
    }

    return {
      id: node.id,
      label: node.label,
      type,
      x,
      y,
      confidence: node.fact_density,
      description: node.label,
    };
  });
}

function layoutEdges(apiEdges: CausalEdge[], nodes: TerminalNode[]): TerminalEdge[] {
  if (apiEdges.length === 0) return DEMO_EDGES;
  const nodeIds = new Set(nodes.map(n => n.id));

  return apiEdges.map((edge, i) => {
    // Find source and target nodes by matching cause_text/effect_text to node labels
    const sourceNode = nodes.find(n => n.label === edge.cause_text) || nodes[0];
    const targetNode = nodes.find(n => n.label === edge.effect_text) || nodes[Math.min(i + 1, nodes.length - 1)];

    return {
      id: `edge-${i}`,
      sourceId: sourceNode?.id || nodes[0]?.id || 'n1',
      targetId: targetNode?.id || nodes[1]?.id || 'n2',
      relationType: edge.relation_type,
      confidence: edge.confidence,
      causeText: edge.cause_text,
      effectText: edge.effect_text,
    };
  }).filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));
}

// ============================================================================
// PULSE ANIMATION CSS
// ============================================================================

const PULSE_KEYFRAMES = `
@keyframes terminalPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0); }
}
@keyframes particleMove {
  0% { offset-distance: 0%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { offset-distance: 100%; opacity: 0; }
}
`;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NexusPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const synthesisId = params?.id as string;

  // State
  const [nodes, setNodes] = useState<TerminalNode[]>(DEMO_NODES);
  const [edges, setEdges] = useState<TerminalEdge[]>(DEMO_EDGES);
  const [steps, setSteps] = useState<CausalStep[]>(DEMO_STEPS);
  const [narrative, setNarrative] = useState<NarrativeEvent[]>(DEMO_NARRATIVE);
  const [title, setTitle] = useState<string>('Intelligence Terminal');
  const [pathIntegrity, setPathIntegrity] = useState<number>(87);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Fetch data
  useEffect(() => {
    if (!synthesisId) return;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const data: CausalGraphResponse = await causalService.getCausalGraph(synthesisId);
        if (cancelled) return;

        if (data && data.nodes && data.nodes.length > 0) {
          const terminalNodes = layoutNodes(data.nodes, data.central_entity || '');
          const terminalEdges = layoutEdges(data.edges, terminalNodes);
          setNodes(terminalNodes);
          setEdges(terminalEdges);
          setSteps(buildStepsFromEdges(terminalEdges, terminalNodes));
          setNarrative(buildNarrativeFromNodes(terminalNodes, terminalEdges));
          setTitle(data.title || 'Intelligence Terminal');

          // Compute path integrity from average confidence
          const avgConf = data.edges.length > 0
            ? data.edges.reduce((s, e) => s + e.confidence, 0) / data.edges.length
            : 0.87;
          setPathIntegrity(Math.round(avgConf * 100));
        }
      } catch {
        // Keep demo data on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [synthesisId]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && e.target === canvasRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  // Node map for edge lookups
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Minimap viewport
  const minimapScale = 0.15;
  const viewportW = 160;
  const viewportH = 160;

  if (!synthesisId) {
    return (
      <div style={{
        height: '100vh',
        backgroundColor: '#0A0A0A',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#64748B',
        fontFamily: 'system-ui, sans-serif',
      }}>
        Synthesis ID missing
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0A0A0A',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#E2E8F0',
      position: 'relative',
    }}>
      {/* Inject keyframes */}
      <style dangerouslySetInnerHTML={{ __html: PULSE_KEYFRAMES }} />

      {/* Material Symbols */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        rel="stylesheet"
      />

      {/* ================================================================ */}
      {/* FIXED HEADER BAR */}
      {/* ================================================================ */}
      <div style={{
        height: 40,
        minHeight: 40,
        backgroundColor: '#111111',
        borderBottom: '1px solid #1E1E1E',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push(`/synthesis/${synthesisId}`)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: 11,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              borderRadius: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
            Back
          </button>
          <div style={{ width: 1, height: 16, backgroundColor: '#1E1E1E' }} />
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#2563EB',
          }}>
            Nexus Terminal
          </span>
          <span style={{ fontSize: 10, color: '#64748B', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && (
            <span style={{ fontSize: 9, color: '#F59E0B', letterSpacing: '0.05em' }}>LOADING...</span>
          )}
          <span style={{ fontSize: 9, color: '#64748B' }}>
            {nodes.length} nodes / {edges.length} edges
          </span>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MAIN CONTENT: LEFT PANEL + CANVAS */}
      {/* ================================================================ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ============================================================== */}
        {/* LEFT PANEL - CAUSAL CHAIN */}
        {/* ============================================================== */}
        {leftPanelOpen && (
          <div style={{
            width: 300,
            minWidth: 300,
            backgroundColor: 'rgba(17, 17, 17, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRight: '1px solid #1E1E1E',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 50,
          }}>
            {/* Panel Header */}
            <div style={{
              padding: '16px 16px 12px',
              borderBottom: '1px solid #1E1E1E',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontFamily: 'Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: 20,
                  color: '#E2E8F0',
                }}>
                  Causal Chain
                </span>
                <button
                  onClick={() => setLeftPanelOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    cursor: 'pointer',
                    padding: 2,
                    borderRadius: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
              <div style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ fontSize: 9, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Path Integrity:
                </span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: pathIntegrity >= 80 ? '#10B981' : pathIntegrity >= 50 ? '#F59E0B' : '#DC2626',
                }}>
                  {pathIntegrity}%
                </span>
              </div>
            </div>

            {/* Steps List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
            }}>
              {steps.map((step, i) => {
                const cfg = STEP_TYPE_CONFIG[step.stepType];
                return (
                  <div key={step.id} style={{
                    position: 'relative',
                    paddingLeft: 20,
                    paddingBottom: 16,
                    borderLeft: `2px solid ${cfg.color}`,
                    marginLeft: 6,
                  }}>
                    {/* Square dot */}
                    <div style={{
                      position: 'absolute',
                      left: -4.5,
                      top: 2,
                      width: 7,
                      height: 7,
                      backgroundColor: cfg.color,
                      borderRadius: 0,
                    }} />

                    {/* Step header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: cfg.color,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}>
                        {cfg.label}
                      </span>
                      <span style={{
                        fontSize: 9,
                        color: '#64748B',
                        fontFamily: 'monospace',
                      }}>
                        {Math.round(step.confidence * 100)}%
                      </span>
                    </div>

                    {/* Description */}
                    <p style={{
                      fontSize: 11,
                      color: '#94A3B8',
                      lineHeight: 1.5,
                      margin: '0 0 6px 0',
                    }}>
                      {step.description}
                    </p>

                    {/* Confidence bar */}
                    <div style={{
                      height: 2,
                      backgroundColor: '#1E1E1E',
                      borderRadius: 0,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${step.confidence * 100}%`,
                        backgroundColor: cfg.color,
                        borderRadius: 0,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Toggle left panel button (when closed) */}
        {!leftPanelOpen && (
          <button
            onClick={() => setLeftPanelOpen(true)}
            style={{
              position: 'absolute',
              left: 0,
              top: 12,
              zIndex: 50,
              backgroundColor: 'rgba(17, 17, 17, 0.9)',
              border: '1px solid #1E1E1E',
              borderLeft: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: '8px 6px',
              borderRadius: 0,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
          </button>
        )}

        {/* ============================================================== */}
        {/* MAIN CANVAS */}
        {/* ============================================================== */}
        <div
          ref={canvasRef}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            cursor: isPanning ? 'grabbing' : 'grab',
            backgroundImage: 'radial-gradient(circle, #1a1a1a 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            backgroundColor: '#0A0A0A',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* SVG Layer - Edges */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <defs>
              <marker
                id="arrowCauses"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#64748B" />
              </marker>
              <marker
                id="arrowTriggers"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#DC2626" />
              </marker>
              <marker
                id="arrowEnables"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="#10B981" />
              </marker>
            </defs>

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {edges.map(edge => {
                const source = nodeMap.get(edge.sourceId);
                const target = nodeMap.get(edge.targetId);
                if (!source || !target) return null;

                const style = EDGE_STYLE[edge.relationType] || EDGE_STYLE.causes;
                const markerEnd = edge.relationType === 'triggers'
                  ? 'url(#arrowTriggers)'
                  : edge.relationType === 'enables'
                    ? 'url(#arrowEnables)'
                    : 'url(#arrowCauses)';

                const edgeColor = edge.relationType === 'triggers' ? '#DC2626'
                  : edge.relationType === 'enables' ? '#10B981'
                  : edge.relationType === 'prevents' ? '#F59E0B'
                  : '#64748B';

                // Curved path
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const cx1 = source.x + dx * 0.3;
                const cy1 = source.y + dy * 0.1;
                const cx2 = source.x + dx * 0.7;
                const cy2 = target.y - dy * 0.1;

                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${source.x} ${source.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${target.x} ${target.y}`}
                      fill="none"
                      stroke={edgeColor}
                      strokeWidth={1.5}
                      strokeDasharray={style.dashArray}
                      strokeOpacity={0.6}
                      markerEnd={markerEnd}
                    />
                    {/* Particle dots along path */}
                    {[0.25, 0.5, 0.75].map((t, pi) => {
                      const px = (1-t)*(1-t)*(1-t)*source.x + 3*(1-t)*(1-t)*t*cx1 + 3*(1-t)*t*t*cx2 + t*t*t*target.x;
                      const py = (1-t)*(1-t)*(1-t)*source.y + 3*(1-t)*(1-t)*t*cy1 + 3*(1-t)*t*t*cy2 + t*t*t*target.y;
                      return (
                        <circle
                          key={pi}
                          cx={px}
                          cy={py}
                          r={1.5}
                          fill={edgeColor}
                          opacity={0.4}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Nodes Layer */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            <div style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'relative',
              width: '100%',
              height: '100%',
            }}>
              {nodes.map(node => {
                const cfg = NODE_TYPE_CONFIG[node.type];
                const isHovered = hoveredNode === node.id;
                const isFocus = node.type === 'focus';

                return (
                  <div
                    key={node.id}
                    style={{
                      position: 'absolute',
                      left: node.x - cfg.size / 2,
                      top: node.y - cfg.size / 2,
                      width: cfg.size,
                      height: cfg.size,
                      backgroundColor: cfg.color,
                      borderRadius: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      transform: isHovered ? 'scale(1.15)' : 'scale(1)',
                      animation: isFocus ? 'terminalPulse 2s ease-in-out infinite' : 'none',
                      border: isFocus ? '2px solid rgba(37, 99, 235, 0.6)' : '1px solid rgba(255,255,255,0.1)',
                      zIndex: isHovered ? 10 : 1,
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: cfg.size * 0.45,
                        color: '#FFFFFF',
                      }}
                    >
                      {cfg.icon}
                    </span>

                    {/* Node label */}
                    <div style={{
                      position: 'absolute',
                      top: cfg.size + 6,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      whiteSpace: 'nowrap',
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: cfg.color,
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      padding: '2px 6px',
                      borderRadius: 0,
                      maxWidth: 120,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {node.label}
                    </div>

                    {/* Tooltip on hover */}
                    {isHovered && node.description && (
                      <div style={{
                        position: 'absolute',
                        bottom: cfg.size + 8,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(17, 17, 17, 0.95)',
                        border: '1px solid #1E1E1E',
                        padding: '8px 12px',
                        borderRadius: 0,
                        maxWidth: 200,
                        zIndex: 20,
                      }}>
                        <div style={{ fontSize: 10, color: '#E2E8F0', marginBottom: 4 }}>{node.description}</div>
                        <div style={{ fontSize: 9, color: '#64748B' }}>
                          Confidence: {Math.round(node.confidence * 100)}%
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ============================================================ */}
          {/* LEGEND - TOP RIGHT */}
          {/* ============================================================ */}
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: 'rgba(17, 17, 17, 0.9)',
            border: '1px solid #1E1E1E',
            padding: '10px 14px',
            zIndex: 20,
            borderRadius: 0,
          }}>
            <div style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#64748B',
              marginBottom: 8,
            }}>
              Node Types
            </div>
            {(['event', 'entity', 'decision', 'outcome'] as TerminalNodeType[]).map(type => {
              const cfg = NODE_TYPE_CONFIG[type];
              return (
                <div key={type} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                }}>
                  <div style={{
                    width: 10,
                    height: 10,
                    backgroundColor: cfg.color,
                    borderRadius: 0,
                  }} />
                  <span style={{ fontSize: 9, color: '#94A3B8' }}>{cfg.label}</span>
                </div>
              );
            })}
            <div style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid #1E1E1E',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#64748B',
              marginBottom: 6,
            }}>
              Edge Types
            </div>
            {(['causes', 'triggers', 'enables'] as RelationType[]).map(type => {
              const color = type === 'triggers' ? '#DC2626' : type === 'enables' ? '#10B981' : '#64748B';
              const style = EDGE_STYLE[type];
              return (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <svg width="20" height="6">
                    <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="1.5" strokeDasharray={style.dashArray} />
                  </svg>
                  <span style={{ fontSize: 9, color: '#94A3B8', textTransform: 'capitalize' }}>{type}</span>
                </div>
              );
            })}
          </div>

          {/* ============================================================ */}
          {/* ZOOM CONTROLS - BOTTOM RIGHT */}
          {/* ============================================================ */}
          <div style={{
            position: 'absolute',
            bottom: bottomPanelOpen ? 212 : 12,
            right: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 20,
            transition: 'bottom 0.3s ease',
          }}>
            {[
              { icon: 'add', action: () => setZoom(z => Math.min(3, z + 0.2)) },
              { icon: 'remove', action: () => setZoom(z => Math.max(0.3, z - 0.2)) },
              { icon: 'fullscreen', action: () => { setZoom(1); setPan({ x: 0, y: 0 }); } },
            ].map(({ icon, action }) => (
              <button
                key={icon}
                onClick={action}
                style={{
                  width: 28,
                  height: 28,
                  backgroundColor: 'rgba(17, 17, 17, 0.9)',
                  border: '1px solid #1E1E1E',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 0,
                  padding: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span>
              </button>
            ))}
          </div>

          {/* ============================================================ */}
          {/* MINIMAP - BOTTOM LEFT */}
          {/* ============================================================ */}
          <div style={{
            position: 'absolute',
            bottom: bottomPanelOpen ? 212 : 12,
            left: leftPanelOpen ? 12 : 40,
            width: viewportW,
            height: viewportH,
            backgroundColor: 'rgba(10, 10, 10, 0.9)',
            border: '1px solid #1E1E1E',
            zIndex: 20,
            overflow: 'hidden',
            borderRadius: 0,
            transition: 'bottom 0.3s ease, left 0.3s ease',
          }}>
            {/* Mini nodes */}
            <svg width={viewportW} height={viewportH}>
              {nodes.map(node => {
                const cfg = NODE_TYPE_CONFIG[node.type];
                const mx = node.x * minimapScale + 10;
                const my = node.y * minimapScale + 10;
                return (
                  <rect
                    key={node.id}
                    x={mx - 2}
                    y={my - 2}
                    width={4}
                    height={4}
                    fill={cfg.color}
                    opacity={0.8}
                  />
                );
              })}
              {edges.map(edge => {
                const s = nodeMap.get(edge.sourceId);
                const t = nodeMap.get(edge.targetId);
                if (!s || !t) return null;
                return (
                  <line
                    key={edge.id}
                    x1={s.x * minimapScale + 10}
                    y1={s.y * minimapScale + 10}
                    x2={t.x * minimapScale + 10}
                    y2={t.y * minimapScale + 10}
                    stroke="#333"
                    strokeWidth={0.5}
                  />
                );
              })}
              {/* Viewport rectangle */}
              <rect
                x={(-pan.x / zoom) * minimapScale + 10}
                y={(-pan.y / zoom) * minimapScale + 10}
                width={(viewportW / zoom) * minimapScale}
                height={(viewportH / zoom) * minimapScale}
                fill="rgba(37, 99, 235, 0.05)"
                stroke="#2563EB"
                strokeWidth={1}
              />
            </svg>
            {/* Label */}
            <div style={{
              position: 'absolute',
              bottom: 4,
              right: 6,
              fontSize: 7,
              color: '#333',
              letterSpacing: '0.05em',
              fontFamily: 'monospace',
            }}>
              MiniMap_Ref
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* NARRATIVE FLOW PANEL - BOTTOM */}
      {/* ================================================================ */}
      <div style={{
        height: bottomPanelOpen ? 200 : 32,
        minHeight: bottomPanelOpen ? 200 : 32,
        backgroundColor: '#111111',
        borderTop: '1px solid #1E1E1E',
        transition: 'height 0.3s ease, min-height 0.3s ease',
        overflow: 'hidden',
        zIndex: 40,
      }}>
        {/* Header bar */}
        <div
          onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
          style={{
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            cursor: 'pointer',
            borderBottom: bottomPanelOpen ? '1px solid #1E1E1E' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#E2E8F0',
            }}>
              Narrative Flow
            </span>
            <span style={{
              fontSize: 9,
              color: '#64748B',
              fontStyle: 'italic',
            }}>
              Sequence Analysis Active
            </span>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#64748B' }}>
            {bottomPanelOpen ? 'expand_more' : 'expand_less'}
          </span>
        </div>

        {/* Timeline content */}
        {bottomPanelOpen && (
          <div style={{
            padding: '24px 32px',
            overflowX: 'auto',
            overflowY: 'hidden',
            height: 'calc(100% - 32px)',
            display: 'flex',
            alignItems: 'center',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
              minWidth: narrative.length * 180,
            }}>
              {/* Connecting line */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: 20,
                right: 20,
                height: 1,
                backgroundColor: '#1E1E1E',
                transform: 'translateY(-50%)',
              }} />

              {narrative.map((event, i) => (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    width: 180,
                    flexShrink: 0,
                  }}
                >
                  {/* Dot */}
                  <div style={{
                    width: 10,
                    height: 10,
                    backgroundColor: event.color,
                    borderRadius: 0,
                    border: '2px solid #0A0A0A',
                    position: 'relative',
                    zIndex: 2,
                    marginBottom: 12,
                  }} />

                  {/* Label */}
                  <div style={{
                    fontSize: 9,
                    color: '#94A3B8',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                    maxWidth: 150,
                    wordBreak: 'break-word',
                  }}>
                    {event.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
