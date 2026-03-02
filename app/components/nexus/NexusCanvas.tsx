'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { causalService } from '@/app/lib/api/services/causal';
import NexusNode, { type NexusNodeData } from './NexusNode';
import NexusEdge, { type NexusEdgeData } from './NexusEdge';
import NexusPredictionBranch from './NexusPredictionBranch';
import NexusTimeline from './NexusTimeline';
import NexusTooltip from './NexusTooltip';
import type {
  CausalGraphResponse,
  HistoricalCausalGraphResponse,
  PredictionsResponse,
  CausalNode,
  CausalEdge,
  Prediction,
} from '@/app/types/causal';

// ===========================
// Color Palette
// ===========================
const NEXUS_COLORS = {
  bg: '#0A0F1A',
  bgGrid: 'rgba(59, 130, 246, 0.03)',
  text: '#E2E8F0',
  textMuted: '#64748B',
  panel: 'rgba(15, 23, 42, 0.8)',
};

interface NexusCanvasProps {
  synthesisId: string;
  onClose?: () => void;
}

interface LayoutState {
  nodes: NexusNodeData[];
  edges: NexusEdgeData[];
  predictionBranches: {
    prediction: Prediction;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    index: number;
    total: number;
  }[];
  timelineMarkers: {
    x: number;
    label: string;
    isNow?: boolean;
    zone: 'past' | 'present' | 'future';
  }[];
}

// ===========================
// Layout Algorithm
// ===========================
function computeLayout(
  causal: CausalGraphResponse | null,
  historical: HistoricalCausalGraphResponse | null,
  predictions: PredictionsResponse | null,
  width: number,
  height: number
): LayoutState {
  const nodes: NexusNodeData[] = [];
  const edges: NexusEdgeData[] = [];
  const timelineMarkers: LayoutState['timelineMarkers'] = [];
  const predictionBranches: LayoutState['predictionBranches'] = [];

  const timelineY = height - 60;
  const nodeAreaTop = 80;
  const nodeAreaBottom = timelineY - 60;
  const nodeAreaHeight = nodeAreaBottom - nodeAreaTop;

  // ---- Zone 1: Historical (x: 5% - 30%) ----
  const pastStartX = width * 0.05;
  const pastEndX = width * 0.30;
  const nodeIdMap = new Map<string, NexusNodeData>();

  if (historical && historical.layers.length > 0) {
    const pastLayers = historical.layers.filter((l) => !l.is_current);
    const layerCount = pastLayers.length || 1;

    pastLayers.forEach((layer, layerIdx) => {
      const layerX = pastStartX + ((pastEndX - pastStartX) * (layerIdx + 0.5)) / layerCount;
      const nodeCount = layer.nodes.length || 1;

      // Timeline marker for this layer
      const dateStr = layer.date ? new Date(layer.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
      timelineMarkers.push({ x: layerX, label: dateStr, zone: 'past' });

      layer.nodes.forEach((node, nodeIdx) => {
        const nodeY = nodeAreaTop + ((nodeAreaHeight) * (nodeIdx + 0.5)) / nodeCount;
        const age = pastLayers.length - layerIdx;
        const radius = Math.max(12, 20 - age * 2);
        const nData: NexusNodeData = {
          id: `past-${layer.synthesis_id}-${node.id}`,
          label: node.label,
          x: layerX,
          y: nodeY,
          radius,
          zone: 'past',
          nodeType: node.node_type,
          factDensity: node.fact_density,
          animationDelay: layerIdx * 100 + nodeIdx * 50,
        };
        nodes.push(nData);
        nodeIdMap.set(nData.id, nData);
        // Also map by original node.id for edge lookup
        nodeIdMap.set(`hist-${layer.synthesis_id}-${node.id}`, nData);
      });

      // Intra-layer edges
      layer.edges.forEach((edge, eIdx) => {
        const sourceNode = nodes.find(
          (n) => n.id === `past-${layer.synthesis_id}-${edge.cause_text}` || n.label === edge.cause_text
        );
        const targetNode = nodes.find(
          (n) => n.id === `past-${layer.synthesis_id}-${edge.effect_text}` || n.label === edge.effect_text
        );
        if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
          edges.push({
            id: `past-edge-${layerIdx}-${eIdx}`,
            sourceX: sourceNode.x,
            sourceY: sourceNode.y,
            targetX: targetNode.x,
            targetY: targetNode.y,
            relationType: edge.relation_type,
            confidence: edge.confidence,
            causeText: edge.cause_text,
            effectText: edge.effect_text,
            animationDelay: layerIdx * 200,
          });
        }
      });
    });

    // Inter-layer connections
    if (historical.inter_layer_connections) {
      historical.inter_layer_connections.forEach((conn, cIdx) => {
        // Find source in past layers
        const fromLayer = historical.layers[conn.from_layer];
        const toLayer = historical.layers[conn.to_layer];
        if (!fromLayer || !toLayer) return;

        const sourceNode = nodes.find(
          (n) => n.label === conn.from_effect && n.id.includes(fromLayer.synthesis_id)
        );
        const targetNode = nodes.find(
          (n) => n.label === conn.to_cause && n.id.includes(toLayer.synthesis_id)
        );
        if (sourceNode && targetNode) {
          edges.push({
            id: `inter-${cIdx}`,
            sourceX: sourceNode.x,
            sourceY: sourceNode.y,
            targetX: targetNode.x,
            targetY: targetNode.y,
            relationType: 'leads_to',
            confidence: conn.similarity,
            isInterLayer: true,
            causeText: conn.from_effect,
            effectText: conn.to_cause,
            animationDelay: 300 + cIdx * 100,
          });
        }
      });
    }
  }

  // ---- Zone 2: Present Causal Chain (x: 35% - 65%) ----
  const presentStartX = width * 0.35;
  const presentEndX = width * 0.65;
  const presentCenterX = (presentStartX + presentEndX) / 2;

  if (causal && causal.nodes.length > 0) {
    // Topological sort: build adjacency from edges
    const adjMap = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    causal.nodes.forEach((n) => {
      adjMap.set(n.id, []);
      inDegree.set(n.id, 0);
    });

    causal.edges.forEach((e) => {
      const sourceNode = causal.nodes.find((n) => n.label === e.cause_text);
      const targetNode = causal.nodes.find((n) => n.label === e.effect_text);
      if (sourceNode && targetNode) {
        const adj = adjMap.get(sourceNode.id) || [];
        adj.push(targetNode.id);
        adjMap.set(sourceNode.id, adj);
        inDegree.set(targetNode.id, (inDegree.get(targetNode.id) || 0) + 1);
      }
    });

    // BFS topological levels
    const levels: string[][] = [];
    const visited = new Set<string>();
    let queue = causal.nodes.filter((n) => (inDegree.get(n.id) || 0) === 0).map((n) => n.id);
    if (queue.length === 0) queue = [causal.nodes[0].id]; // fallback

    while (queue.length > 0 && visited.size < causal.nodes.length) {
      const level: string[] = [];
      const nextQueue: string[] = [];
      for (const nodeId of queue) {
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        level.push(nodeId);
        const neighbors = adjMap.get(nodeId) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            nextQueue.push(neighbor);
          }
        }
      }
      if (level.length > 0) levels.push(level);
      queue = nextQueue;

      // Safety: add unvisited nodes
      if (nextQueue.length === 0 && visited.size < causal.nodes.length) {
        const unvisited = causal.nodes.find((n) => !visited.has(n.id));
        if (unvisited) queue = [unvisited.id];
      }
    }

    // Position nodes level by level
    const levelCount = levels.length || 1;
    const nowX = presentCenterX;

    // NOW timeline marker
    timelineMarkers.push({ x: nowX, label: 'NOW', isNow: true, zone: 'present' });

    levels.forEach((level, levelIdx) => {
      const levelX = presentStartX + ((presentEndX - presentStartX) * (levelIdx + 0.5)) / levelCount;
      const nodeCount = level.length;

      level.forEach((nodeId, nodeIdx) => {
        const causalNode = causal.nodes.find((n) => n.id === nodeId);
        if (!causalNode) return;

        const isCentral = causalNode.label === causal.central_entity;
        const baseRadius = isCentral ? 28 : 18 + (causalNode.fact_density || 0.5) * 10;
        const nodeY = nodeAreaTop + ((nodeAreaHeight) * (nodeIdx + 0.5)) / Math.max(nodeCount, 1);

        const nData: NexusNodeData = {
          id: `present-${causalNode.id}`,
          label: causalNode.label,
          x: levelX,
          y: nodeY,
          radius: baseRadius,
          zone: 'present',
          nodeType: causalNode.node_type,
          factDensity: causalNode.fact_density,
          animationDelay: 200 + levelIdx * 100 + nodeIdx * 60,
        };
        nodes.push(nData);
        nodeIdMap.set(nData.id, nData);
        nodeIdMap.set(causalNode.id, nData);
      });
    });

    // Present edges
    causal.edges.forEach((edge, eIdx) => {
      const sourceNode = nodes.find(
        (n) => n.zone === 'present' && n.label === edge.cause_text
      );
      const targetNode = nodes.find(
        (n) => n.zone === 'present' && n.label === edge.effect_text
      );
      if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
        edges.push({
          id: `present-edge-${eIdx}`,
          sourceX: sourceNode.x,
          sourceY: sourceNode.y,
          targetX: targetNode.x,
          targetY: targetNode.y,
          relationType: edge.relation_type,
          confidence: edge.confidence,
          causeText: edge.cause_text,
          effectText: edge.effect_text,
          animationDelay: 300 + eIdx * 80,
        });
      }
    });

    // Historical → Present convergence edges
    if (historical?.inter_layer_connections) {
      const currentLayer = historical.layers.find((l) => l.is_current);
      if (currentLayer) {
        historical.inter_layer_connections.forEach((conn, cIdx) => {
          const toLayer = historical.layers[conn.to_layer];
          if (!toLayer?.is_current) return;

          const fromLayer = historical.layers[conn.from_layer];
          if (!fromLayer) return;

          const sourceNode = nodes.find(
            (n) => n.zone === 'past' && n.label === conn.from_effect
          );
          const targetNode = nodes.find(
            (n) => n.zone === 'present' && n.label === conn.to_cause
          );
          if (sourceNode && targetNode) {
            edges.push({
              id: `convergence-${cIdx}`,
              sourceX: sourceNode.x,
              sourceY: sourceNode.y,
              targetX: targetNode.x,
              targetY: targetNode.y,
              relationType: 'leads_to',
              confidence: conn.similarity,
              isInterLayer: true,
              causeText: conn.from_effect,
              effectText: conn.to_cause,
              animationDelay: 400 + cIdx * 100,
            });
          }
        });
      }
    }
  }

  // ---- Zone 3: Predictions (x: 70% - 95%) ----
  const futureStartX = width * 0.70;
  const futureEndX = width * 0.93;

  if (predictions && predictions.predictions.length > 0) {
    const preds = predictions.predictions;
    const predCount = preds.length;

    // Each prediction connects back to cause nodes
    preds.forEach((pred, i) => {
      const angle = ((i - (predCount - 1) / 2) / Math.max(predCount - 1, 1)) * 0.6;
      const endX = futureEndX - 10;
      const endY = nodeAreaTop + nodeAreaHeight * (0.15 + (0.7 * i) / Math.max(predCount - 1, 1));

      // Find a present node to connect from (try to match by prediction type or use center node)
      const presentNodes = nodes.filter((n) => n.zone === 'present');
      const connectFrom = presentNodes.length > 0
        ? presentNodes[Math.min(i, presentNodes.length - 1)]
        : null;

      const startX = connectFrom ? connectFrom.x + connectFrom.radius + 5 : futureStartX - 20;
      const startY = connectFrom ? connectFrom.y : endY;

      // Prediction node
      const variant = pred.probability >= 0.6 ? 'optimist' : pred.probability >= 0.3 ? 'realist' : 'pessimist';
      const pNodeId = `future-${i}`;
      const pNode: NexusNodeData = {
        id: pNodeId,
        label: pred.prediction.slice(0, 30),
        x: futureStartX + (futureEndX - futureStartX) * 0.3,
        y: endY,
        radius: 10 + pred.probability * 10,
        zone: 'future',
        futureVariant: variant,
        animationDelay: 600 + i * 150,
      };
      nodes.push(pNode);

      predictionBranches.push({
        prediction: pred,
        startX,
        startY,
        endX: pNode.x + pNode.radius + 8,
        endY: pNode.y,
        index: i,
        total: predCount,
      });

      // Timeline marker for future
      const timeframeLabel = pred.timeframe === 'court_terme' ? 'Sem.' : pred.timeframe === 'moyen_terme' ? 'Mois' : 'An';
      if (i === 0 || i === predCount - 1) {
        timelineMarkers.push({
          x: pNode.x,
          label: timeframeLabel,
          zone: 'future',
        });
      }
    });
  }

  return { nodes, edges, predictionBranches, timelineMarkers };
}

// ===========================
// Main Component
// ===========================
export default function NexusCanvas({ synthesisId, onClose }: NexusCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Data state
  const [causalData, setCausalData] = useState<CausalGraphResponse | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalCausalGraphResponse | null>(null);
  const [predictionsData, setPredictionsData] = useState<PredictionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    node?: NexusNodeData | null;
    edge?: NexusEdgeData | null;
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });

  // Pan/zoom state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1400, h: 800 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Canvas dimensions
  const [canvasSize, setCanvasSize] = useState({ width: 1400, height: 800 });

  // Fetch data
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [causal, historical, preds] = await Promise.all([
          causalService.getCausalGraph(synthesisId).catch(() => null),
          causalService.getHistoricalGraph(synthesisId, 5).catch(() => null),
          causalService.getPredictions(synthesisId).catch(() => null),
        ]);
        setCausalData(causal);
        setHistoricalData(historical);
        setPredictionsData(preds);
        setError(null);
      } catch (err) {
        console.error('NexusCanvas: Failed to fetch data', err);
        setError('Impossible de charger le Nexus');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [synthesisId]);

  // Resize handler
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        setCanvasSize({ width: Math.max(w, 800), height: Math.max(h, 500) });
        setViewBox({ x: 0, y: 0, w: Math.max(w, 800), h: Math.max(h, 500) });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Compute layout
  const layout = useMemo(
    () => computeLayout(causalData, historicalData, predictionsData, canvasSize.width, canvasSize.height),
    [causalData, historicalData, predictionsData, canvasSize]
  );

  // Determine highlighted edges (connected to selected node)
  const highlightedEdgeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const selected = layout.nodes.find((n) => n.id === selectedNodeId);
    if (!selected) return new Set<string>();
    const ids = new Set<string>();
    layout.edges.forEach((e) => {
      // Approximate: check if source/target coords match selected node
      const nearSource = Math.abs(e.sourceX - selected.x) < 5 && Math.abs(e.sourceY - selected.y) < 5;
      const nearTarget = Math.abs(e.targetX - selected.x) < 5 && Math.abs(e.targetY - selected.y) < 5;
      if (nearSource || nearTarget) ids.add(e.id);
    });
    return ids;
  }, [selectedNodeId, layout]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest('g[style*="cursor: pointer"]')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = (e.clientX - panStart.x) * (viewBox.w / canvasSize.width);
      const dy = (e.clientY - panStart.y) * (viewBox.h / canvasSize.height);
      setViewBox((prev) => ({ ...prev, x: prev.x - dx, y: prev.y - dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
    },
    [isPanning, panStart, viewBox.w, viewBox.h, canvasSize]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Zoom handler
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaY > 0 ? 1.1 : 0.9;
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;

      const mouseX = ((e.clientX - svgRect.left) / svgRect.width) * viewBox.w + viewBox.x;
      const mouseY = ((e.clientY - svgRect.top) / svgRect.height) * viewBox.h + viewBox.y;

      const newW = Math.max(400, Math.min(4000, viewBox.w * scale));
      const newH = Math.max(250, Math.min(2500, viewBox.h * scale));

      setViewBox({
        x: mouseX - (mouseX - viewBox.x) * (newW / viewBox.w),
        y: mouseY - (mouseY - viewBox.y) * (newH / viewBox.h),
        w: newW,
        h: newH,
      });
    },
    [viewBox]
  );

  // Node interactions
  const handleNodeHover = useCallback((node: NexusNodeData, e: React.MouseEvent) => {
    setTooltip({ node, edge: null, x: e.clientX, y: e.clientY, visible: true });
  }, []);

  const handleNodeLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleNodeClick = useCallback((node: NexusNodeData) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  }, []);

  // Edge interactions
  const handleEdgeHover = useCallback((edge: NexusEdgeData, e: React.MouseEvent) => {
    setTooltip({ node: null, edge, x: e.clientX, y: e.clientY, visible: true });
  }, []);

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: canvasSize.width, h: canvasSize.height });
  }, [canvasSize]);

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div style={{ ...styles.container, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={styles.loadingOrb}>
            <div style={styles.loadingOrbInner} />
          </div>
          <p style={{ color: '#64748B', fontSize: '13px', marginTop: '16px', fontFamily: 'var(--font-mono)' }}>
            INITIALISATION DU NEXUS...
          </p>
        </div>
      </div>
    );
  }

  // ---- ERROR STATE ----
  if (error || (!causalData && !historicalData && !predictionsData)) {
    return (
      <div style={{ ...styles.container, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#EF4444', fontSize: '16px', marginBottom: '12px' }}>
            {error || 'Aucune donnee causale disponible'}
          </p>
          <button onClick={onClose} style={styles.closeBtn}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  const hasData = layout.nodes.length > 0;

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Header overlay */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerBadge}>INTELLIGENCE NEXUS</span>
          <span style={styles.headerStats}>
            {layout.nodes.length} noeuds &middot; {layout.edges.length} relations
            {predictionsData && predictionsData.predictions.length > 0 && (
              <> &middot; {predictionsData.predictions.length} predictions</>
            )}
          </span>
        </div>
        <div style={styles.headerRight}>
          <button onClick={handleResetZoom} style={styles.controlBtn} title="Reset zoom">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
              <path d="M8 11h6M11 8v6" />
            </svg>
          </button>
          <button onClick={onClose} style={styles.closeBtn} title="Fermer (Echap)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      {hasData ? (
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Background grid */}
          <defs>
            <pattern id="nexus-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={NEXUS_COLORS.bgGrid} strokeWidth="0.5" />
            </pattern>
            <radialGradient id="nexus-vignette" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
            </radialGradient>
          </defs>
          <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#nexus-grid)" />
          <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#nexus-vignette)" />

          {/* Zone separator lines (subtle) */}
          <line
            x1={canvasSize.width * 0.32}
            y1={60}
            x2={canvasSize.width * 0.32}
            y2={canvasSize.height - 40}
            stroke="rgba(59, 130, 246, 0.08)"
            strokeWidth="1"
            strokeDasharray="4 8"
          />
          <line
            x1={canvasSize.width * 0.68}
            y1={60}
            x2={canvasSize.width * 0.68}
            y2={canvasSize.height - 40}
            stroke="rgba(59, 130, 246, 0.08)"
            strokeWidth="1"
            strokeDasharray="4 8"
          />

          {/* Zone headers */}
          <text x={canvasSize.width * 0.15} y={45} textAnchor="middle" fontSize="11" fill="#06B6D4" fontFamily="var(--font-mono)" letterSpacing="0.15em" opacity={0.5}>
            FONDATIONS HISTORIQUES
          </text>
          <text x={canvasSize.width * 0.50} y={45} textAnchor="middle" fontSize="11" fill="#3B82F6" fontFamily="var(--font-mono)" letterSpacing="0.15em" opacity={0.5}>
            CHAINES CAUSALES
          </text>
          <text x={canvasSize.width * 0.82} y={45} textAnchor="middle" fontSize="11" fill="#F59E0B" fontFamily="var(--font-mono)" letterSpacing="0.15em" opacity={0.5}>
            SCENARIOS PREDICTIFS
          </text>

          {/* Edges (rendered first, behind nodes) */}
          {layout.edges.map((edge) => (
            <NexusEdge
              key={edge.id}
              edge={{
                ...edge,
                isHighlighted: highlightedEdgeIds.size === 0 || highlightedEdgeIds.has(edge.id),
              }}
              onMouseEnter={handleEdgeHover}
              onMouseLeave={handleNodeLeave}
            />
          ))}

          {/* Prediction branches */}
          <NexusPredictionBranch branches={layout.predictionBranches} />

          {/* Timeline */}
          <NexusTimeline
            markers={layout.timelineMarkers}
            y={canvasSize.height - 50}
            width={canvasSize.width}
            paddingX={canvasSize.width * 0.04}
          />

          {/* Nodes (rendered last, on top) */}
          {layout.nodes.map((node) => (
            <NexusNode
              key={node.id}
              node={{ ...node, isSelected: selectedNodeId === node.id }}
              onMouseEnter={handleNodeHover}
              onMouseLeave={handleNodeLeave}
              onClick={handleNodeClick}
            />
          ))}
        </svg>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <p style={{ color: '#64748B', fontSize: '14px' }}>
            Aucune donnee causale pour cette synthese.
          </p>
        </div>
      )}

      {/* Tooltip */}
      <NexusTooltip
        node={tooltip.node}
        edge={tooltip.edge}
        x={tooltip.x}
        y={tooltip.y}
        visible={tooltip.visible}
      />

      {/* Legend */}
      <div style={styles.legend}>
        <div style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#06B6D4' }} /> Historique</div>
        <div style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#3B82F6' }} /> Actuel</div>
        <div style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#10B981' }} /> Probable</div>
        <div style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#F59E0B' }} /> Possible</div>
        <div style={styles.legendItem}><span style={{ ...styles.legendDot, backgroundColor: '#EF4444' }} /> Risque</div>
      </div>
    </div>
  );
}

// ===========================
// Styles
// ===========================
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    backgroundColor: NEXUS_COLORS.bg,
    overflow: 'hidden',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    background: 'linear-gradient(180deg, rgba(10, 15, 26, 0.9) 0%, transparent 100%)',
    zIndex: 10,
    pointerEvents: 'none',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    pointerEvents: 'auto',
  },
  headerBadge: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: '#3B82F6',
    fontFamily: 'var(--font-mono)',
    padding: '4px 10px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '4px',
  },
  headerStats: {
    fontSize: '11px',
    color: '#64748B',
    fontFamily: 'var(--font-mono)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    pointerEvents: 'auto',
  },
  controlBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(100, 116, 139, 0.2)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(100, 116, 139, 0.2)',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#94A3B8',
    fontSize: '13px',
  },
  legend: {
    position: 'absolute',
    bottom: '16px',
    left: '20px',
    display: 'flex',
    gap: '16px',
    padding: '8px 14px',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(100, 116, 139, 0.15)',
    borderRadius: '6px',
    zIndex: 10,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10px',
    color: '#94A3B8',
    fontFamily: 'var(--font-mono)',
  },
  legendDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  loadingOrb: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: '2px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    animation: 'spin 2s linear infinite',
  },
  loadingOrbInner: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#3B82F6',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
};
