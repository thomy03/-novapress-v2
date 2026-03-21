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
  Prediction,
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
  icon: string;
  isPrediction?: boolean;
  probability?: number;
}

interface TerminalEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  confidence: number;
  causeText: string;
  effectText: string;
  isPrediction?: boolean;
}

interface CausalStep {
  id: string;
  number: string;
  label: string;
  stepType: TerminalNodeType;
  description: string;
  confidence: number;
}

interface PredictionCard {
  id: string;
  probability: number;
  text: string;
  icon: string;
  timeframe: string;
}

interface NarrativeEvent {
  id: string;
  label: string;
  timeLabel: string;
  type: 'past' | 'now' | 'future';
  color: string;
}

type ViewMode = 'GRAPH' | 'TIMELINE' | 'MATRIX';

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPE_COLORS: Record<TerminalNodeType, string> = {
  focus: '#2563EB',
  event: '#DC2626',
  entity: '#2563EB',
  decision: '#F59E0B',
  outcome: '#10B981',
};

const TYPE_ICONS: Record<TerminalNodeType, string> = {
  focus: 'hub',
  event: 'bolt',
  entity: 'person',
  decision: 'balance',
  outcome: 'check_circle',
};

const PURPLE = '#8B5CF6';

// ============================================================================
// DEMO DATA
// ============================================================================

const DEMO_NODES: TerminalNode[] = [
  { id: 'n1', label: 'POLICY SHIFT', type: 'event', x: 0.15, y: 0.25, confidence: 0.94, description: 'Central authority announces sweeping regulatory changes', icon: 'gavel' },
  { id: 'n2', label: 'MARKET CRASH', type: 'event', x: 0.10, y: 0.55, confidence: 0.89, description: 'Immediate 4.2% market downturn across sectors', icon: 'trending_down' },
  { id: 'n3', label: 'KEY ACTOR', type: 'entity', x: 0.30, y: 0.15, confidence: 0.92, description: 'Primary decision-maker in the causal chain', icon: 'person' },
  { id: 'n4', label: 'REGULATION', type: 'decision', x: 0.35, y: 0.50, confidence: 0.78, description: 'Emergency regulatory framework activated', icon: 'balance' },
  { id: 'n5', label: 'PUBLIC SHIFT', type: 'event', x: 0.22, y: 0.75, confidence: 0.71, description: 'Public opinion pivots on the matter', icon: 'groups' },
  { id: 'n6', label: 'LEGISLATION', type: 'decision', x: 0.42, y: 0.30, confidence: 0.83, description: 'Congressional fast-track response bill', icon: 'description' },
];

const DEMO_PREDICTIONS: TerminalNode[] = [
  { id: 'p1', label: 'TRADE SHIFT', type: 'outcome', x: 0.70, y: 0.20, confidence: 0.78, description: 'Probable restructuring of trade agreements', icon: 'analytics', isPrediction: true, probability: 78 },
  { id: 'p2', label: 'MARKET RECOVERY', type: 'outcome', x: 0.80, y: 0.50, confidence: 0.62, description: 'Gradual market normalization expected', icon: 'trending_up', isPrediction: true, probability: 62 },
  { id: 'p3', label: 'SOCIAL UNREST', type: 'event', x: 0.72, y: 0.78, confidence: 0.45, description: 'Possible public demonstrations', icon: 'grain', isPrediction: true, probability: 45 },
];

const DEMO_EDGES: TerminalEdge[] = [
  { id: 'e1', sourceId: 'n1', targetId: 'n2', relationType: 'causes', confidence: 0.92, causeText: 'Policy Shift', effectText: 'Market Crash' },
  { id: 'e2', sourceId: 'n3', targetId: 'n1', relationType: 'triggers', confidence: 0.88, causeText: 'Key Actor', effectText: 'Policy Shift' },
  { id: 'e3', sourceId: 'n1', targetId: 'n4', relationType: 'causes', confidence: 0.81, causeText: 'Policy Shift', effectText: 'Regulation' },
  { id: 'e4', sourceId: 'n2', targetId: 'n5', relationType: 'triggers', confidence: 0.67, causeText: 'Market Crash', effectText: 'Public Shift' },
  { id: 'e5', sourceId: 'n4', targetId: 'n6', relationType: 'enables', confidence: 0.73, causeText: 'Regulation', effectText: 'Legislation' },
  { id: 'e6', sourceId: 'n6', targetId: 'p1', relationType: 'causes', confidence: 0.78, causeText: 'Legislation', effectText: 'Trade Shift', isPrediction: true },
  { id: 'e7', sourceId: 'n4', targetId: 'p2', relationType: 'enables', confidence: 0.62, causeText: 'Regulation', effectText: 'Market Recovery', isPrediction: true },
  { id: 'e8', sourceId: 'n5', targetId: 'p3', relationType: 'triggers', confidence: 0.45, causeText: 'Public Shift', effectText: 'Social Unrest', isPrediction: true },
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

function getNodeIcon(type: TerminalNodeType, label: string): string {
  const labelLower = label.toLowerCase();
  if (labelLower.includes('market') || labelLower.includes('economic') || labelLower.includes('trade')) return 'trending_up';
  if (labelLower.includes('policy') || labelLower.includes('law') || labelLower.includes('regulat')) return 'gavel';
  if (labelLower.includes('war') || labelLower.includes('conflict') || labelLower.includes('military')) return 'shield';
  if (labelLower.includes('tech') || labelLower.includes('ai') || labelLower.includes('cyber')) return 'memory';
  if (labelLower.includes('climate') || labelLower.includes('environment')) return 'eco';
  if (labelLower.includes('election') || labelLower.includes('vote')) return 'how_to_vote';
  if (labelLower.includes('health') || labelLower.includes('pandemic')) return 'health_and_safety';
  return TYPE_ICONS[type];
}

function computePathIntegrity(edges: TerminalEdge[]): number {
  if (edges.length === 0) return 0;
  const pastEdges = edges.filter(e => !e.isPrediction);
  if (pastEdges.length === 0) return 0;
  const avg = pastEdges.reduce((s, e) => s + e.confidence, 0) / pastEdges.length;
  return Math.round(avg * 100);
}

function buildStepsFromData(nodes: TerminalNode[], edges: TerminalEdge[]): CausalStep[] {
  const pastNodes = nodes.filter(n => !n.isPrediction);
  if (pastNodes.length === 0) return [];

  const nodeMap = new Map(pastNodes.map(n => [n.id, n]));
  const targetIds = new Set(edges.filter(e => !e.isPrediction).map(e => e.targetId));
  const sourceIds = new Set(edges.filter(e => !e.isPrediction).map(e => e.sourceId));
  const roots = [...sourceIds].filter(id => !targetIds.has(id));

  const visited = new Set<string>();
  const queue = roots.length > 0 ? [...roots] : [pastNodes[0]?.id].filter(Boolean);
  const steps: CausalStep[] = [];
  let stepNum = 1;

  while (queue.length > 0 && steps.length < 8) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    steps.push({
      id: node.id,
      number: String(stepNum).padStart(2, '0'),
      label: node.label,
      stepType: node.type,
      description: node.description || node.label,
      confidence: node.confidence,
    });
    stepNum++;

    edges.filter(e => e.sourceId === nodeId && !e.isPrediction).forEach(e => {
      if (!visited.has(e.targetId)) queue.push(e.targetId);
    });
  }

  return steps;
}

function buildPredictions(nodes: TerminalNode[], apiPredictions?: Prediction[]): PredictionCard[] {
  if (apiPredictions && apiPredictions.length > 0) {
    return apiPredictions.slice(0, 4).map((p, i) => ({
      id: `pred-${i}`,
      probability: Math.round(p.probability * 100),
      text: p.prediction,
      icon: p.probability >= 0.7 ? 'auto_awesome' : 'shutter_speed',
      timeframe: p.timeframe === 'court_terme' ? 'T+24H' : p.timeframe === 'moyen_terme' ? 'T+7D' : 'T+30D',
    }));
  }

  const predNodes = nodes.filter(n => n.isPrediction);
  return predNodes.map(n => ({
    id: n.id,
    probability: n.probability || Math.round(n.confidence * 100),
    text: n.description || n.label,
    icon: (n.probability || n.confidence * 100) >= 70 ? 'auto_awesome' : 'shutter_speed',
    timeframe: (n.probability || n.confidence * 100) >= 70 ? 'T+24H' : 'T+7D',
  }));
}

function buildNarrativeEvents(nodes: TerminalNode[]): NarrativeEvent[] {
  const pastNodes = nodes.filter(n => !n.isPrediction).slice(0, 4);
  const futureNodes = nodes.filter(n => n.isPrediction).slice(0, 3);

  const events: NarrativeEvent[] = [];
  const timeLabels = ['T-24H', 'T-12H', 'T-6H', 'T-2H'];

  pastNodes.forEach((n, i) => {
    events.push({
      id: n.id,
      label: n.label,
      timeLabel: timeLabels[i] || `T-${(pastNodes.length - i) * 3}H`,
      type: 'past',
      color: TYPE_COLORS[n.type],
    });
  });

  events.push({ id: 'now', label: 'NOW', timeLabel: 'T+0', type: 'now', color: '#FFFFFF' });

  const futureLabels = ['T+24H', 'T+3D', 'T+7D'];
  futureNodes.forEach((n, i) => {
    events.push({
      id: n.id,
      label: n.label,
      timeLabel: futureLabels[i] || `T+${(i + 1) * 7}D`,
      type: 'future',
      color: PURPLE,
    });
  });

  return events;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NexusCausalPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const synthesisId = params.id as string;
  const canvasRef = useRef<HTMLDivElement>(null);

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('GRAPH');
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [nodes, setNodes] = useState<TerminalNode[]>([...DEMO_NODES, ...DEMO_PREDICTIONS]);
  const [edges, setEdges] = useState<TerminalEdge[]>(DEMO_EDGES);
  const [predictions, setPredictions] = useState<PredictionCard[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [clock, setClock] = useState('');
  const [bottomTab, setBottomTab] = useState<'NARRATIVE' | 'MATRIX'>('NARRATIVE');

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        const data = await causalService.getCausalGraph(synthesisId);
        setTitle(data.title || '');

        if (data.nodes && data.nodes.length > 0) {
          const totalNodes = data.nodes.length;
          const pastMapped: TerminalNode[] = data.nodes.map((n, i) => {
            const type = mapNodeType(n.node_type);
            const angle = (i / totalNodes) * Math.PI * 0.8 + Math.PI * 0.1;
            const radius = 0.15 + Math.random() * 0.15;
            return {
              id: n.id,
              label: n.label.toUpperCase(),
              type,
              x: 0.05 + radius * Math.cos(angle) + Math.random() * 0.08,
              y: 0.15 + (i / totalNodes) * 0.65 + (Math.random() - 0.5) * 0.1,
              confidence: n.fact_density || 0.7 + Math.random() * 0.25,
              description: n.label,
              icon: getNodeIcon(type, n.label),
            };
          });

          // Generate prediction nodes from the last nodes in chain
          const predictionNodes: TerminalNode[] = [];
          const predictionEdges: TerminalEdge[] = [];
          const lastNodes = pastMapped.slice(-Math.min(3, pastMapped.length));

          if (data.predictions && data.predictions.length > 0) {
            data.predictions.slice(0, 3).forEach((p, i) => {
              const predNode: TerminalNode = {
                id: `pred-${i}`,
                label: p.prediction.substring(0, 30).toUpperCase(),
                type: 'outcome',
                x: 0.65 + (i % 2) * 0.15,
                y: 0.2 + i * 0.28,
                confidence: p.probability,
                description: p.prediction,
                icon: p.probability >= 0.7 ? 'analytics' : 'grain',
                isPrediction: true,
                probability: Math.round(p.probability * 100),
              };
              predictionNodes.push(predNode);

              const sourceNode = lastNodes[i % lastNodes.length];
              if (sourceNode) {
                predictionEdges.push({
                  id: `pe-${i}`,
                  sourceId: sourceNode.id,
                  targetId: predNode.id,
                  relationType: 'enables',
                  confidence: p.probability,
                  causeText: sourceNode.label,
                  effectText: predNode.label,
                  isPrediction: true,
                });
              }
            });
          } else {
            lastNodes.forEach((n, i) => {
              const predNode: TerminalNode = {
                id: `pred-auto-${i}`,
                label: `PROJECTED ${['OUTCOME', 'SHIFT', 'RESPONSE'][i] || 'IMPACT'}`,
                type: 'outcome',
                x: 0.68 + (i % 2) * 0.12,
                y: 0.2 + i * 0.3,
                confidence: Math.max(0.3, n.confidence - 0.2),
                description: `Probable outcome from ${n.label}`,
                icon: ['analytics', 'trending_up', 'grain'][i] || 'analytics',
                isPrediction: true,
                probability: Math.round(Math.max(30, (n.confidence - 0.2) * 100)),
              };
              predictionNodes.push(predNode);
              predictionEdges.push({
                id: `pe-auto-${i}`,
                sourceId: n.id,
                targetId: predNode.id,
                relationType: 'enables',
                confidence: predNode.confidence,
                causeText: n.label,
                effectText: predNode.label,
                isPrediction: true,
              });
            });
          }

          const mappedEdges: TerminalEdge[] = data.edges.map((e, i) => {
            const sourceNode = pastMapped.find(n => n.label.toLowerCase().includes(e.cause_text.toLowerCase().substring(0, 10)));
            const targetNode = pastMapped.find(n => n.label.toLowerCase().includes(e.effect_text.toLowerCase().substring(0, 10)));
            return {
              id: `edge-${i}`,
              sourceId: sourceNode?.id || pastMapped[Math.min(i, pastMapped.length - 1)]?.id || 'n1',
              targetId: targetNode?.id || pastMapped[Math.min(i + 1, pastMapped.length - 1)]?.id || 'n2',
              relationType: e.relation_type,
              confidence: e.confidence,
              causeText: e.cause_text,
              effectText: e.effect_text,
            };
          });

          setNodes([...pastMapped, ...predictionNodes]);
          setEdges([...mappedEdges, ...predictionEdges]);
          setPredictions(buildPredictions([...pastMapped, ...predictionNodes], data.predictions));
        } else {
          setNodes([...DEMO_NODES, ...DEMO_PREDICTIONS]);
          setEdges(DEMO_EDGES);
          setPredictions(buildPredictions([...DEMO_NODES, ...DEMO_PREDICTIONS]));
        }
      } catch {
        setNodes([...DEMO_NODES, ...DEMO_PREDICTIONS]);
        setEdges(DEMO_EDGES);
        setPredictions(buildPredictions([...DEMO_NODES, ...DEMO_PREDICTIONS]));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [synthesisId]);

  // Clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')} ZULU`
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Derived data
  const pathIntegrity = useMemo(() => computePathIntegrity(edges), [edges]);
  const causalSteps = useMemo(() => buildStepsFromData(nodes, edges), [nodes, edges]);
  const narrativeEvents = useMemo(() => buildNarrativeEvents(nodes), [nodes]);
  const predictionCards = useMemo(() => {
    if (predictions.length > 0) return predictions;
    return buildPredictions(nodes);
  }, [predictions, nodes]);

  // Handlers
  const handleZoom = useCallback((dir: 'in' | 'out') => {
    setZoom(z => Math.max(0.5, Math.min(2, dir === 'in' ? z + 0.15 : z - 0.15)));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // SVG line helper
  const getNodeCenter = useCallback((nodeId: string, canvasW: number, canvasH: number) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    return { x: node.x * canvasW, y: node.y * canvasH };
  }, [nodes]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: PURPLE, animation: 'spin 2s linear infinite' }}>hub</span>
          <div style={{ fontFamily: 'var(--font-label)', fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', marginTop: 16, fontWeight: 700 }}>
            INITIALIZING NEXUS GRAPH
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const canvasWidth = 900;
  const canvasHeight = 600;
  const nowLineX = 0.55;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0A0A0A', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-label)', zIndex: 9999, overflow: 'hidden' }}>

      <style>{`
        .nexus-dot-grid {
          background-image: radial-gradient(#1A1A1A 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .nexus-rhombus {
          clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
        }
        .nexus-scrollbar::-webkit-scrollbar { width: 3px; }
        .nexus-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .nexus-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 0; }
        @keyframes nexusPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.3); }
          50% { box-shadow: 0 0 12px 4px rgba(139,92,246,0.15); }
        }
        @keyframes nowGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(255,255,255,0.3); }
          50% { box-shadow: 0 0 20px rgba(255,255,255,0.15); }
        }
        @keyframes flowDash {
          to { stroke-dashoffset: -20; }
        }
      `}</style>

      {/* ================================================================ */}
      {/* ZONE 1 - TOP BAR                                                 */}
      {/* ================================================================ */}
      <div style={{
        height: 40, minHeight: 40, background: '#131313', borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', gap: 16,
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>arrow_back</span>
          </button>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
            NEXUS CAUSAL GRAPH
          </span>
          <span style={{ fontSize: 14, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title || 'Causal Intelligence Analysis'}
          </span>
        </div>

        {/* Center - View mode tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {(['GRAPH', 'TIMELINE', 'MATRIX'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                background: viewMode === mode ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: 'none', borderBottom: viewMode === mode ? `2px solid ${PURPLE}` : '2px solid transparent',
                color: viewMode === mode ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', fontFamily: 'var(--font-label)',
                padding: '10px 16px', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)' }}>PATH INTEGRITY:</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: pathIntegrity >= 70 ? '#10B981' : pathIntegrity >= 40 ? '#F59E0B' : '#DC2626', fontFamily: 'var(--font-label)' }}>
              {pathIntegrity}%
            </span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={() => handleZoom('in')} style={{ width: 28, height: 28, background: '#131313', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            </button>
            <button onClick={() => handleZoom('out')} style={{ width: 28, height: 28, background: '#131313', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>remove</span>
            </button>
          </div>
          <button onClick={toggleFullscreen} style={{ width: 28, height: 28, background: '#131313', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* MIDDLE SECTION: LEFT PANEL + CANVAS                              */}
      {/* ================================================================ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ============================================================== */}
        {/* ZONE 2 - LEFT PANEL                                             */}
        {/* ============================================================== */}
        <div className="nexus-scrollbar" style={{
          width: 320, minWidth: 320, background: '#131313', borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div className="nexus-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px 16px' }}>

            {/* Section A - CAUSAL CHAIN */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>account_tree</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)' }}>CAUSAL CHAIN</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {causalSteps.map((step, i) => {
                  const color = TYPE_COLORS[step.stepType] || '#2563EB';
                  const isLast = i === causalSteps.length - 1;
                  return (
                    <div key={step.id} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                      {/* Vertical connector line */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16 }}>
                        <div style={{ width: 8, height: 8, background: color, borderRadius: 0, flexShrink: 0, marginTop: 3 }} />
                        {!isLast && (
                          <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.08)', minHeight: 32 }} />
                        )}
                      </div>

                      {/* Step content */}
                      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-label)' }}>{step.number}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>arrow_forward</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3, marginBottom: 4 }}>
                          {step.description}
                        </div>
                        {/* Confidence bar */}
                        <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', width: '100%', borderRadius: 0 }}>
                          <div style={{ height: '100%', width: `${Math.round(step.confidence * 100)}%`, background: color, borderRadius: 0 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {causalSteps.length === 0 && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No causal chain data available</div>
                )}
              </div>
            </div>

            {/* Section B - PREDICTIONS */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: PURPLE }}>PROBABLE FUTURES</span>
                <span style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', color: PURPLE,
                  border: `1px solid ${PURPLE}40`, padding: '2px 6px', borderRadius: 0,
                }}>AI PROJECTED</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {predictionCards.map(pred => {
                  const probColor = pred.probability >= 70 ? '#10B981' : pred.probability >= 45 ? '#F59E0B' : '#DC2626';
                  const probLabel = pred.probability >= 70 ? 'HIGH PROBABILITY' : pred.probability >= 45 ? 'MODERATE' : 'LOW CONFIDENCE';
                  return (
                    <div key={pred.id} style={{
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                      padding: '10px 12px', borderRadius: 0,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: probColor, fontFamily: 'var(--font-label)' }}>
                          {pred.probability}%
                        </span>
                        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color: probColor, opacity: 0.8 }}>
                          {probLabel}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: `${PURPLE}99`, marginTop: 1, flexShrink: 0 }}>
                          {pred.icon}
                        </span>
                        <span style={{ fontSize: 13, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                          {pred.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {predictionCards.length === 0 && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>No predictions generated</div>
                )}
              </div>
            </div>
          </div>

          {/* Section C - LEGEND (at bottom) */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 8 }}>
              {([
                { label: 'EVENT', color: '#DC2626' },
                { label: 'ENTITY', color: '#2563EB' },
                { label: 'DECISION', color: '#F59E0B' },
                { label: 'OUTCOME', color: '#10B981' },
              ]).map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, background: item.color, borderRadius: 0, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, border: `1px dashed ${PURPLE}`, borderRadius: 0, transform: 'rotate(45deg)', flexShrink: 0 }} />
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>PREDICTION PATH</span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* ZONE 3 - MAIN CANVAS                                            */}
        {/* ============================================================== */}
        <div
          ref={canvasRef}
          className="nexus-dot-grid"
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            background: '#0A0A0A',
          }}
        >
          {/* Canvas inner (zoomable) */}
          <div style={{
            position: 'absolute', inset: 0,
            transform: `scale(${zoom})`, transformOrigin: 'center center',
            transition: 'transform 0.2s ease',
          }}>

            {/* SVG Connections */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <marker id="arrow-solid" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 3 L 0 6 z" fill="rgba(255,255,255,0.3)" />
                </marker>
                <marker id="arrow-purple" viewBox="0 0 10 6" refX="9" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 3 L 0 6 z" fill={`${PURPLE}80`} />
                </marker>
              </defs>
              {edges.map(edge => {
                const source = nodes.find(n => n.id === edge.sourceId);
                const target = nodes.find(n => n.id === edge.targetId);
                if (!source || !target) return null;

                const x1 = `${source.x * 100}%`;
                const y1 = `${source.y * 100}%`;
                const x2 = `${target.x * 100}%`;
                const y2 = `${target.y * 100}%`;

                const isP = edge.isPrediction;
                const edgeColor = isP ? PURPLE : TYPE_COLORS[source.type] || 'rgba(255,255,255,0.2)';

                return (
                  <line
                    key={edge.id}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={edgeColor}
                    strokeWidth={isP ? 1 : 1.5}
                    strokeOpacity={isP ? 0.4 : 0.25}
                    strokeDasharray={isP ? '6,4' : 'none'}
                    markerEnd={isP ? 'url(#arrow-purple)' : 'url(#arrow-solid)'}
                    style={isP ? { animation: 'flowDash 1.5s linear infinite' } : undefined}
                  />
                );
              })}
            </svg>

            {/* "NOW" Divider */}
            <div style={{
              position: 'absolute', left: `${nowLineX * 100}%`, top: 0, bottom: 0, width: 0,
              borderLeft: '1.5px dashed rgba(255,255,255,0.15)', zIndex: 10, pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                background: '#FFFFFF', padding: '3px 10px', borderRadius: 0,
                animation: 'nowGlow 3s ease-in-out infinite',
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#000000', letterSpacing: '0.1em', fontFamily: 'var(--font-label)', whiteSpace: 'nowrap' }}>
                  NOW — T+0
                </span>
              </div>
            </div>

            {/* PAST NODES — squares */}
            {nodes.filter(n => !n.isPrediction).map(node => {
              const color = TYPE_COLORS[node.type];
              const size = node.type === 'focus' ? 56 : 48;
              const isSelected = selectedNode === node.id;
              const isHovered = hoveredNode === node.id;

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(isSelected ? null : node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{
                    position: 'absolute',
                    left: `${node.x * 100}%`, top: `${node.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer', zIndex: 20,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  }}
                >
                  <div style={{
                    width: size, height: size,
                    background: isSelected ? color : `${color}CC`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 0,
                    border: isSelected ? '2px solid #FFFFFF' : `1px solid ${color}`,
                    boxShadow: isHovered ? `0 0 16px ${color}40` : 'none',
                    transition: 'all 0.15s',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#FFFFFF' }}>
                      {node.icon}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em',
                    textAlign: 'center', maxWidth: 80, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {node.label}
                  </span>

                  {/* Tooltip on hover */}
                  {isHovered && node.description && (
                    <div style={{
                      position: 'absolute', top: size + 24, left: '50%', transform: 'translateX(-50%)',
                      background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
                      padding: '8px 10px', minWidth: 160, maxWidth: 220, zIndex: 100, borderRadius: 0,
                    }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, fontFamily: 'var(--font-serif)' }}>
                        {node.description}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                        CONFIDENCE: {Math.round(node.confidence * 100)}%
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* PREDICTION NODES — diamonds */}
            {nodes.filter(n => n.isPrediction).map(node => {
              const size = 52;
              const isSelected = selectedNode === node.id;
              const isHovered = hoveredNode === node.id;

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(isSelected ? null : node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{
                    position: 'absolute',
                    left: `${node.x * 100}%`, top: `${node.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer', zIndex: 20,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  }}
                >
                  <div className="nexus-rhombus" style={{
                    width: size, height: size,
                    background: `${PURPLE}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1.5px dashed ${PURPLE}80`,
                    boxShadow: isHovered ? `0 0 10px rgba(139,92,246,0.2)` : 'none',
                    animation: isSelected ? 'nexusPulse 2s ease-in-out infinite' : 'none',
                    transition: 'box-shadow 0.15s',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: PURPLE }}>
                      {node.icon}
                    </span>
                  </div>
                  {/* Probability badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: `${PURPLE}CC`, fontFamily: 'var(--font-label)' }}>
                      {node.probability || Math.round(node.confidence * 100)}%
                    </span>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: `${PURPLE}CC`, letterSpacing: '0.15em',
                    textAlign: 'center', maxWidth: 80, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {node.label}
                  </span>

                  {/* Tooltip on hover */}
                  {isHovered && node.description && (
                    <div style={{
                      position: 'absolute', top: size + 30, left: '50%', transform: 'translateX(-50%)',
                      background: '#1A1A1A', border: `1px solid ${PURPLE}30`,
                      padding: '8px 10px', minWidth: 160, maxWidth: 220, zIndex: 100, borderRadius: 0,
                    }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4, fontFamily: 'var(--font-serif)' }}>
                        {node.description}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 9, color: `${PURPLE}99`, fontWeight: 700 }}>
                        PROBABILITY: {node.probability || Math.round(node.confidence * 100)}%
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Overlay: Zoom controls (top-right) */}
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 50 }}>
            <button onClick={() => handleZoom('in')} style={{ width: 32, height: 32, background: '#131313', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0, fontSize: 16, fontFamily: 'var(--font-label)' }}>+</button>
            <button onClick={() => handleZoom('out')} style={{ width: 32, height: 32, background: '#131313', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0, fontSize: 16, fontFamily: 'var(--font-label)' }}>-</button>
          </div>

          {/* Overlay: Minimap (bottom-left) */}
          <div style={{
            position: 'absolute', bottom: 12, left: 12, width: 160, height: 120,
            background: '#0D0D0D', border: '1px solid rgba(255,255,255,0.08)', zIndex: 50,
            overflow: 'hidden', borderRadius: 0,
          }}>
            {/* Mini dots */}
            {nodes.map(n => (
              <div key={`mini-${n.id}`} style={{
                position: 'absolute',
                left: `${n.x * 100}%`, top: `${n.y * 100}%`,
                width: n.isPrediction ? 3 : 4, height: n.isPrediction ? 3 : 4,
                background: n.isPrediction ? PURPLE : TYPE_COLORS[n.type],
                borderRadius: n.isPrediction ? 0 : 0,
                transform: n.isPrediction ? 'rotate(45deg) translate(-50%, -50%)' : 'translate(-50%, -50%)',
                opacity: 0.8,
              }} />
            ))}
            {/* NOW line */}
            <div style={{ position: 'absolute', left: `${nowLineX * 100}%`, top: 0, bottom: 0, width: 0, borderLeft: '1px dashed rgba(255,255,255,0.2)' }} />
            {/* Viewport rectangle */}
            <div style={{
              position: 'absolute',
              left: `${Math.max(0, 50 - 50 / zoom)}%`,
              top: `${Math.max(0, 50 - 50 / zoom)}%`,
              width: `${Math.min(100, 100 / zoom)}%`,
              height: `${Math.min(100, 100 / zoom)}%`,
              border: '1px solid #2563EB',
              opacity: 0.6,
            }} />
          </div>

          {/* Overlay: Export buttons (bottom-right) */}
          <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 6, zIndex: 50 }}>
            <button style={{
              background: '#131313', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              padding: '6px 12px', cursor: 'pointer', borderRadius: 0, fontFamily: 'var(--font-label)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>download</span>
              EXPORT SVG
            </button>
            <button style={{
              background: '#131313', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              padding: '6px 12px', cursor: 'pointer', borderRadius: 0, fontFamily: 'var(--font-label)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>share</span>
              SHARE ANALYSIS
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* ZONE 4 - BOTTOM PANEL                                            */}
      {/* ================================================================ */}
      <div style={{
        height: 180, minHeight: 180, background: '#131313', borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px',
        }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {([
              { id: 'NARRATIVE' as const, label: 'NARRATIVE FLOW' },
              { id: 'MATRIX' as const, label: 'SCENARIO MATRIX' },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setBottomTab(tab.id)}
                style={{
                  background: 'transparent', border: 'none',
                  borderBottom: bottomTab === tab.id ? `2px solid ${PURPLE}` : '2px solid transparent',
                  color: bottomTab === tab.id ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
                  padding: '10px 14px', cursor: 'pointer', fontFamily: 'var(--font-label)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, background: '#10B981', borderRadius: '50%' }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>LIVE SYSTEM</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-label)', letterSpacing: '0.05em' }}>
              T-CLOCK: {clock}
            </span>
          </div>
        </div>

        {/* Timeline content */}
        <div style={{ flex: 1, position: 'relative', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
          {bottomTab === 'NARRATIVE' ? (
            <div style={{ width: '100%', position: 'relative' }}>
              {/* Horizontal line */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.1)', transform: 'translateY(-50%)' }} />

              {/* Event dots */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                {narrativeEvents.map(evt => {
                  const isNow = evt.type === 'now';
                  const isFuture = evt.type === 'future';

                  return (
                    <div key={evt.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 60 }}>
                      {/* Dot */}
                      {isNow ? (
                        <div style={{
                          width: 12, height: 12, background: '#FFFFFF', transform: 'rotate(45deg)',
                          boxShadow: '0 0 12px rgba(255,255,255,0.4)',
                        }} />
                      ) : isFuture ? (
                        <div style={{
                          width: 10, height: 10, background: 'transparent',
                          border: `1.5px dashed ${PURPLE}`, transform: 'rotate(45deg)',
                        }} />
                      ) : (
                        <div style={{ width: 8, height: 8, background: evt.color, borderRadius: 0 }} />
                      )}

                      {/* Time label */}
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                        color: isNow ? '#FFFFFF' : isFuture ? `${PURPLE}CC` : 'rgba(255,255,255,0.4)',
                        fontFamily: 'var(--font-label)',
                      }}>
                        {isNow ? 'T+0 [NOW]' : evt.timeLabel}
                      </span>

                      {/* Event label */}
                      <span style={{
                        fontSize: 8, fontWeight: 600, letterSpacing: '0.1em',
                        color: isNow ? 'rgba(255,255,255,0.7)' : isFuture ? `${PURPLE}99` : 'rgba(255,255,255,0.35)',
                        textAlign: 'center', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {evt.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', fontWeight: 700 }}>
                SCENARIO MATRIX — COMING SOON
              </span>
            </div>
          )}
        </div>

        {/* Bottom info bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 24px', borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.1em' }}>
              DATA ORIGIN: {nodes.filter(n => !n.isPrediction).length} NODES
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.1em' }}>
              CONFIDENCE: {pathIntegrity}%
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.1em' }}>
              PREDICTIONS: {nodes.filter(n => n.isPrediction).length}
            </span>
          </div>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'rgba(255,255,255,0.35)', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title ? `Causal analysis of: ${title}` : 'Intelligence causal graph — synthesized from multi-source data'}
          </span>
        </div>
      </div>
    </div>
  );
}
