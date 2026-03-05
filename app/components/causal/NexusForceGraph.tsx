'use client';

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d').then((mod) => mod.default),
  { ssr: false }
);

// Node types → colors (cosmic palette — distinct & vivid)
const NODE_COLORS: Record<string, { core: string; glow: string; label: string }> = {
  event:    { core: '#DC2626', glow: '#FCA5A5', label: 'Événement' },
  entity:   { core: '#2563EB', glow: '#93C5FD', label: 'Entité' },
  decision: { core: '#F59E0B', glow: '#FDE68A', label: 'Décision' },
  keyword:  { core: '#10B981', glow: '#6EE7B7', label: 'Concept' },
};

// Relation types → edge color
const EDGE_COLORS: Record<string, string> = {
  causes:   '#DC2626',
  triggers: '#F59E0B',
  enables:  '#10B981',
  prevents: '#6B7280',
  relates_to: '#8B5CF6',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 59, g: 130, b: 246 };
}

interface NexusNode {
  id: string;
  label: string;
  node_type: string;
  mention_count?: number;
  first_seen?: number;
  last_seen?: number;
  _connectionCount?: number;
  _depth?: number; // topological depth (0 = root causes)
  // Force graph internal
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface NexusEdge {
  id: string;
  source: string | NexusNode;
  target: string | NexusNode;
  relation_type: string;
  confidence: number;
  cause_text: string;
  effect_text: string;
}

export interface NexusForceGraphProps {
  nodes: {
    id: string;
    label: string;
    node_type: string;
    mention_count?: number;
    first_seen?: number;
    last_seen?: number;
    source_syntheses?: string[];
  }[];
  edges: {
    id?: string;
    cause_text: string;
    effect_text: string;
    relation_type: string;
    confidence: number;
    mention_count?: number;
    source_syntheses?: string[];
  }[];
  centralEntity?: string;
  topic: string;
  height?: number;
  onNodeSelect?: (node: {
    id: string;
    label: string;
    type: string;
    mentionCount: number;
    connections: { label: string; direction: 'cause' | 'effect'; relationType: string }[];
  } | null) => void;
}

/**
 * Intelligent node classification based on graph structure.
 * Uses connection patterns, edge roles, and label structure — NOT word lists.
 *
 * Logic:
 * - Nodes that appear as BOTH cause AND effect across multiple edges → entity (recurring actor)
 * - Nodes that appear ONLY as cause (root sources) → decision or entity
 * - Nodes that appear ONLY as effect (terminal outcomes) → event
 * - Short labels (1-2 words) with no verb-like structure → keyword
 * - Nodes matching the central entity / topic → entity
 */
function classifyNodesByGraphStructure(
  nodes: { id: string; label: string; node_type: string }[],
  edges: { cause_text: string; effect_text: string }[],
  centralEntity?: string,
): Map<string, string> {
  const types = new Map<string, string>();
  const labelToId = new Map(nodes.map(n => [n.label, n.id]));

  // Count how often each node appears as cause vs effect
  const asCause = new Map<string, number>();
  const asEffect = new Map<string, number>();

  for (const e of edges) {
    const srcId = labelToId.get(e.cause_text);
    const tgtId = labelToId.get(e.effect_text);
    if (srcId) asCause.set(srcId, (asCause.get(srcId) || 0) + 1);
    if (tgtId) asEffect.set(tgtId, (asEffect.get(tgtId) || 0) + 1);
  }

  const centralLower = centralEntity?.toLowerCase().trim();

  for (const n of nodes) {
    const causeCount = asCause.get(n.id) || 0;
    const effectCount = asEffect.get(n.id) || 0;
    const totalEdges = causeCount + effectCount;
    const label = n.label;
    const words = label.trim().split(/\s+/);

    // 1. Central entity match → entity
    if (centralLower && label.toLowerCase().includes(centralLower)) {
      types.set(n.id, 'entity');
      continue;
    }

    // 2. Hub nodes (connected to many edges, both as cause and effect) → entity
    //    These are recurring actors in the causal chain
    if (causeCount >= 1 && effectCount >= 1 && totalEdges >= 3) {
      types.set(n.id, 'entity');
      continue;
    }

    // 3. Pure root causes (only cause, never effect) → decision
    //    These are originating actions/decisions that trigger chains
    if (causeCount >= 1 && effectCount === 0) {
      types.set(n.id, 'decision');
      continue;
    }

    // 4. Terminal effects (only effect, never cause) with short labels → keyword
    if (effectCount >= 1 && causeCount === 0 && words.length <= 2) {
      types.set(n.id, 'keyword');
      continue;
    }

    // 5. Short proper noun patterns → entity (person names, orgs)
    const capitalizedWords = words.filter(w => w.length > 1 && /^[A-ZÀ-Ü]/.test(w));
    if (words.length <= 3 && capitalizedWords.length >= Math.ceil(words.length * 0.6)) {
      types.set(n.id, 'entity');
      continue;
    }

    // 6. Default: event
    types.set(n.id, 'event');
  }

  return types;
}

/**
 * Compute topological depth: root causes get depth 0, their effects get 1, etc.
 */
function computeDepths(
  nodeIds: string[],
  edges: { source: string; target: string }[]
): Map<string, number> {
  const depths = new Map<string, number>();
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();

  for (const id of nodeIds) {
    incoming.set(id, new Set());
    outgoing.set(id, new Set());
  }

  for (const e of edges) {
    incoming.get(e.target)?.add(e.source);
    outgoing.get(e.source)?.add(e.target);
  }

  // Find roots (no incoming edges)
  const queue: string[] = [];
  for (const id of nodeIds) {
    if ((incoming.get(id)?.size || 0) === 0) {
      depths.set(id, 0);
      queue.push(id);
    }
  }

  // BFS
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depths.get(current) || 0;
    for (const next of outgoing.get(current) || []) {
      const existing = depths.get(next);
      if (existing === undefined || existing < currentDepth + 1) {
        depths.set(next, currentDepth + 1);
        queue.push(next);
      }
    }
  }

  // Nodes without depth (cycles or disconnected) → assign median
  const maxDepth = Math.max(0, ...Array.from(depths.values()));
  for (const id of nodeIds) {
    if (!depths.has(id)) {
      depths.set(id, Math.floor(maxDepth / 2));
    }
  }

  return depths;
}

export default function NexusForceGraph({
  nodes: rawNodes,
  edges: rawEdges,
  centralEntity,
  topic,
  height = 600,
  onNodeSelect,
}: NexusForceGraphProps) {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(Date.now());
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [hoveredNode, setHoveredNode] = useState<NexusNode | null>(null);
  const [focusedNode, setFocusedNode] = useState<NexusNode | null>(null);
  const [, setTick] = useState(0);

  // Build graph data with auto-classification and topological depth
  const graphData = useMemo(() => {
    const nodeMap = new Map(rawNodes.map(n => [n.id, n]));
    const labelToId = new Map(rawNodes.map(n => [n.label, n.id]));

    // Check if all nodes are the same type (monochrome problem)
    const uniqueTypes = new Set(rawNodes.map(n => n.node_type || 'event'));
    const needsAutoClassify = uniqueTypes.size <= 1;

    // Build edges first to compute connection counts and depths
    const validEdges: { source: string; target: string; edge: typeof rawEdges[0] }[] = [];
    const connectionCount = new Map<string, number>();

    for (const e of rawEdges) {
      const sourceId = labelToId.get(e.cause_text);
      const targetId = labelToId.get(e.effect_text);
      if (!sourceId || !targetId || sourceId === targetId) continue;
      if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) continue;

      validEdges.push({ source: sourceId, target: targetId, edge: e });
      connectionCount.set(sourceId, (connectionCount.get(sourceId) || 0) + 1);
      connectionCount.set(targetId, (connectionCount.get(targetId) || 0) + 1);
    }

    // Compute topological depths
    const depths = computeDepths(
      rawNodes.map(n => n.id),
      validEdges.map(e => ({ source: e.source, target: e.target }))
    );

    // Auto-classify using graph structure if backend provides monochrome types
    const structuralTypes = needsAutoClassify
      ? classifyNodesByGraphStructure(rawNodes, rawEdges, centralEntity)
      : null;

    let graphNodes: NexusNode[] = rawNodes.map(n => {
      const nodeType = structuralTypes
        ? (structuralTypes.get(n.id) || 'event')
        : (n.node_type || 'event');

      return {
        id: n.id,
        label: n.label,
        node_type: nodeType,
        mention_count: n.mention_count || 1,
        first_seen: n.first_seen,
        last_seen: n.last_seen,
        _connectionCount: connectionCount.get(n.id) || 0,
        _depth: depths.get(n.id) || 0,
      };
    });

    // Cap at 12 most-connected nodes for readability
    const MAX_VISIBLE_NODES = 12;
    if (graphNodes.length > MAX_VISIBLE_NODES) {
      graphNodes.sort((a, b) => (b._connectionCount || 0) - (a._connectionCount || 0));
      graphNodes = graphNodes.slice(0, MAX_VISIBLE_NODES);
    }
    const keptNodeIds = new Set(graphNodes.map(n => n.id));

    const edgeSet = new Set<string>();
    const graphEdges: NexusEdge[] = [];

    for (const { source, target, edge: e } of validEdges) {
      if (!keptNodeIds.has(source) || !keptNodeIds.has(target)) continue;
      const edgeKey = `${source}-${target}`;
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);

      graphEdges.push({
        id: e.id || edgeKey,
        source,
        target,
        relation_type: e.relation_type || 'causes',
        confidence: e.confidence || 0.5,
        cause_text: e.cause_text,
        effect_text: e.effect_text,
      });
    }

    return { nodes: graphNodes, links: graphEdges };
  }, [rawNodes, rawEdges]);

  // Max depth for positioning
  const maxDepth = useMemo(() => {
    return Math.max(1, ...graphData.nodes.map(n => n._depth || 0));
  }, [graphData]);

  // Animation loop (20fps)
  useEffect(() => {
    let lastRender = 0;
    const animate = () => {
      const now = Date.now();
      timeRef.current = now;
      if (now - lastRender >= 50) {
        lastRender = now;
        setTick(t => (t + 1) % 1000);
      }
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationRef.current);
  }, []);

  // Container resize
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [height]);

  // Configure forces: strong repulsion + temporal X positioning
  useEffect(() => {
    if (!graphRef.current) return;

    const nodeCount = graphData.nodes.length;
    const repulsion = Math.max(-800, -200 - nodeCount * 25);

    graphRef.current.d3Force('charge')?.strength(repulsion);
    graphRef.current.d3Force('link')?.distance(140).strength(0.3);

    // Temporal X positioning via the built-in forceX
    // react-force-graph-2d exposes d3Force which includes forceX/Y
    // We configure the existing 'center' force and add manual positioning
    graphRef.current.d3Force('center', null); // Remove center force for temporal layout

    // Use the graph's d3Force API to set initial positions based on depth
    // This gives a left-to-right causal flow
    graphData.nodes.forEach((node: NexusNode) => {
      if (node.x === undefined) {
        const depth = node._depth || 0;
        const ratio = maxDepth > 0 ? depth / maxDepth : 0.5;
        node.x = (ratio - 0.5) * dimensions.width * 0.5;
        node.y = (Math.random() - 0.5) * height * 0.4;
      }
    });
  }, [graphData, dimensions.width, maxDepth]);

  // Center on graph after layout
  useEffect(() => {
    if (graphRef.current) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(500, 80);
      }, 1200);
    }
  }, [graphData]);

  // Word-wrap text helper
  const wrapText = useCallback((text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 3); // Max 3 lines
  }, []);

  // Custom node renderer
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as NexusNode;
    const x = n.x || 0;
    const y = n.y || 0;
    const time = timeRef.current;

    const colors = NODE_COLORS[n.node_type] || NODE_COLORS.event;
    const { r, g, b } = hexToRgb(colors.core);

    const connections = n._connectionCount || 0;
    const mentionSize = Math.min(22, 7 + Math.sqrt((n.mention_count || 1) + connections) * 2.5);
    const breathe = 1 + Math.sin(time / 1500 + n.id.charCodeAt(0) * 0.3) * 0.04;
    const size = mentionSize * breathe;
    const isHovered = hoveredNode?.id === n.id;
    const isFocused = focusedNode?.id === n.id;

    // When a node is focused, dim non-connected nodes
    let dimmed = false;
    if (focusedNode && !isFocused) {
      const isConnected = graphData.links.some(edge => {
        const srcId = typeof edge.source === 'object' ? edge.source.id : edge.source;
        const tgtId = typeof edge.target === 'object' ? edge.target.id : edge.target;
        return (srcId === focusedNode.id && tgtId === n.id) || (tgtId === focusedNode.id && srcId === n.id);
      });
      if (!isConnected) dimmed = true;
    }

    if (dimmed) {
      ctx.globalAlpha = 0.15;
    }

    // Outer glow (stronger for hovered/focused)
    const glowRadius = size * (isFocused ? 5 : isHovered ? 4 : 2.5);
    const glowAlpha = isFocused ? 0.7 : isHovered ? 0.5 : (0.2 + Math.sin(time / 1000 + n.id.charCodeAt(0)) * 0.08);
    const glow = ctx.createRadialGradient(x, y, size * 0.3, x, y, glowRadius);
    glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
    glow.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Node body with shape based on type
    if (n.node_type === 'decision') {
      // Diamond shape for decisions
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size, y);
      ctx.closePath();
    } else if (n.node_type === 'keyword') {
      // Rounded square for keywords
      const s = size * 0.85;
      ctx.beginPath();
      ctx.roundRect(x - s, y - s, s * 2, s * 2, s * 0.3);
    } else {
      // Circle for events and entities
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
    }

    const bodyGrad = ctx.createRadialGradient(x - size * 0.2, y - size * 0.2, 0, x, y, size);
    bodyGrad.addColorStop(0, `rgba(${Math.min(255, r + 60)}, ${Math.min(255, g + 60)}, ${Math.min(255, b + 60)}, 1)`);
    bodyGrad.addColorStop(0.5, colors.core);
    bodyGrad.addColorStop(1, `rgba(${Math.floor(r * 0.6)}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.6)}, 1)`);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // White ring for entities (distinguishing marker)
    if (n.node_type === 'entity') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Inner core highlight
    const coreAlpha = 0.4 + Math.sin(time / 600 + n.id.charCodeAt(0) * 2) * 0.15;
    const coreGrad = ctx.createRadialGradient(x - size * 0.15, y - size * 0.15, 0, x, y, size * 0.35);
    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`);
    coreGrad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Label — always visible, with background pill
    if (n.label) {
      const baseFontSize = isHovered ? 13 : 11;
      const fontSize = Math.max(8, baseFontSize / Math.max(1, globalScale * 0.7));
      ctx.font = `${isHovered ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const maxLabelWidth = isHovered ? 200 : 120;
      const truncated = n.label.length > 50 ? n.label.slice(0, 47) + '...' : n.label;
      const lines = wrapText(truncated, maxLabelWidth, ctx);
      const lineHeight = fontSize + 2;
      const totalHeight = lines.length * lineHeight;
      const maxLineWidth = Math.max(...lines.map(l => ctx.measureText(l).width));

      const labelY = y + size + 6;
      const padX = 6;
      const padY = 3;

      // Background pill
      ctx.fillStyle = `rgba(10, 10, 26, ${isHovered ? 0.92 : 0.75})`;
      ctx.beginPath();
      ctx.roundRect(
        x - maxLineWidth / 2 - padX,
        labelY - padY,
        maxLineWidth + padX * 2,
        totalHeight + padY * 2,
        4
      );
      ctx.fill();

      // Text
      ctx.fillStyle = isHovered ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)';
      lines.forEach((line, i) => {
        ctx.fillText(line, x, labelY + i * lineHeight);
      });
    }

    // Focused node: pulsing selection ring
    if (isFocused) {
      const pulseScale = 1 + Math.sin(time / 300) * 0.15;
      ctx.beginPath();
      ctx.arc(x, y, size * 1.6 * pulseScale, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, 0.6)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (dimmed) {
      ctx.globalAlpha = 1;
    }
  }, [hoveredNode, focusedNode, graphData.links, wrapText]);

  // Custom edge renderer
  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    const edge = link as NexusEdge;
    const source = typeof edge.source === 'object' ? edge.source : null;
    const target = typeof edge.target === 'object' ? edge.target : null;
    if (!source || !target || source.x === undefined || target.x === undefined) return;

    const x1 = source.x;
    const y1 = source.y || 0;
    const x2 = target.x;
    const y2 = target.y || 0;

    const edgeColor = EDGE_COLORS[edge.relation_type] || '#6B7280';
    const { r, g, b } = hexToRgb(edgeColor);

    const alpha = 0.2 + edge.confidence * 0.4;
    const width = 1 + edge.confidence * 2;

    // Curved line (quadratic bezier for visual interest)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    // Control point offset perpendicular to the line
    const curvature = 0.15;
    const midX = (x1 + x2) / 2 - dy * curvature;
    const midY = (y1 + y2) / 2 + dx * curvature;

    // Glow
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`;
    ctx.lineWidth = width + 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Main line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();

    // Arrow at target end
    const nodeSize = 7 + Math.sqrt((target as NexusNode).mention_count || 1) * 2.5;
    const arrowLen = 10;
    // Get angle at the end of the curve
    const t = Math.max(0, 1 - (nodeSize + 4) / len);
    // Point on quadratic bezier at parameter t
    const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
    const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;
    // Tangent at t
    const tx = 2 * (1 - t) * (midX - x1) + 2 * t * (x2 - midX);
    const ty = 2 * (1 - t) * (midY - y1) + 2 * t * (y2 - midY);
    const angle = Math.atan2(ty, tx);

    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(
      bx - arrowLen * Math.cos(angle - Math.PI / 7),
      by - arrowLen * Math.sin(angle - Math.PI / 7)
    );
    ctx.lineTo(
      bx - arrowLen * Math.cos(angle + Math.PI / 7),
      by - arrowLen * Math.sin(angle + Math.PI / 7)
    );
    ctx.closePath();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha + 0.15})`;
    ctx.fill();

    // Flowing particle
    const time = timeRef.current;
    const particleT = ((time / 4000) + (edge.id?.charCodeAt(0) || 0) * 0.1) % 1;
    const px = (1 - particleT) * (1 - particleT) * x1 + 2 * (1 - particleT) * particleT * midX + particleT * particleT * x2;
    const py = (1 - particleT) * (1 - particleT) * y1 + 2 * (1 - particleT) * particleT * midY + particleT * particleT * y2;
    const pGrad = ctx.createRadialGradient(px, py, 0, px, py, 5);
    pGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
    pGrad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = pGrad;
    ctx.fill();
  }, []);

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node as NexusNode | null);
  }, []);

  // Click on node: zoom in + show detail dialog + highlight connections
  const handleNodeClick = useCallback((node: any) => {
    const n = node as NexusNode;
    if (focusedNode?.id === n.id) {
      // Clicking same node again: deselect and zoom out
      setFocusedNode(null);
      onNodeSelect?.(null);
      graphRef.current?.zoomToFit(500, 80);
      return;
    }

    setFocusedNode(n);

    // Zoom into the clicked node
    if (graphRef.current && n.x !== undefined && n.y !== undefined) {
      graphRef.current.centerAt(n.x, n.y, 600);
      graphRef.current.zoom(3, 600);
    }

    // Find all connections for this node
    const connections: { label: string; direction: 'cause' | 'effect'; relationType: string }[] = [];
    for (const edge of graphData.links) {
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
      if (sourceId === n.id) {
        const targetNode = graphData.nodes.find(nd => nd.id === targetId);
        if (targetNode) {
          connections.push({ label: targetNode.label, direction: 'effect', relationType: edge.relation_type });
        }
      } else if (targetId === n.id) {
        const sourceNode = graphData.nodes.find(nd => nd.id === sourceId);
        if (sourceNode) {
          connections.push({ label: sourceNode.label, direction: 'cause', relationType: edge.relation_type });
        }
      }
    }

    onNodeSelect?.({
      id: n.id,
      label: n.label,
      type: n.node_type,
      mentionCount: n.mention_count || 1,
      connections,
    });
  }, [focusedNode, graphData, onNodeSelect]);

  const nodeCount = graphData.nodes.length;
  const edgeCount = graphData.links.length;

  // Count types for legend (only show types that exist)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of graphData.nodes) {
      counts[n.node_type] = (counts[n.node_type] || 0) + 1;
    }
    return counts;
  }, [graphData]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        backgroundColor: '#0A0A1A',
        overflow: 'hidden',
      }}
    >
      {/* Cosmic background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, #10101f 0%, #0A0A1A 70%, #050510 100%)',
        pointerEvents: 'none',
      }} />

      {/* Title overlay */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '24px',
        zIndex: 10,
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: 'rgba(255, 255, 255, 0.4)',
          textTransform: 'uppercase',
        }}>
          NEXUS CAUSAL
        </div>
        <div style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#FFFFFF',
          fontFamily: 'Georgia, "Times New Roman", serif',
          marginTop: '4px',
        }}>
          {topic}
        </div>
      </div>

      {/* Stats */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '24px',
        zIndex: 10,
        display: 'flex',
        gap: '12px',
      }}>
        <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
          {nodeCount} noeuds
        </span>
        <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
          {edgeCount} relations
        </span>
      </div>

      {/* Temporal flow indicator */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '12px',
        transform: 'translateY(-50%)',
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      }}>
        <span style={{
          fontSize: '9px',
          color: 'rgba(255, 255, 255, 0.25)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
        }}>
          CAUSES
        </span>
      </div>
      <div style={{
        position: 'absolute',
        top: '50%',
        right: '12px',
        transform: 'translateY(-50%)',
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      }}>
        <span style={{
          fontSize: '9px',
          color: 'rgba(255, 255, 255, 0.25)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
        }}>
          EFFETS
        </span>
      </div>

      {/* Subtle flow arrow at bottom */}
      <div style={{
        position: 'absolute',
        bottom: '44px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          width: '80px',
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)',
        }} />
        <span style={{
          fontSize: '9px',
          color: 'rgba(255, 255, 255, 0.2)',
          letterSpacing: '1px',
        }}>
          FLUX CAUSAL →
        </span>
        <div style={{
          width: '80px',
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)',
        }} />
      </div>

      {/* Force Graph */}
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={height}
        backgroundColor="transparent"
        nodeRelSize={8}
        nodeVal={(node: any) => Math.sqrt(((node as NexusNode).mention_count || 1) + 1) * 2}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const n = node as NexusNode;
          const size = 7 + Math.sqrt(n.mention_count || 1) * 2.5 + 8;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x || 0, n.y || 0, size, 0, Math.PI * 2);
          ctx.fill();
        }}
        linkCanvasObject={linkCanvasObject}
        linkDirectionalParticles={0}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        d3AlphaDecay={0.08}
        d3VelocityDecay={0.6}
        cooldownTicks={200}
        warmupTicks={100}
        cooldownTime={4000}
        onEngineStop={() => {
          graphData.nodes.forEach((node: NexusNode) => {
            if (node.x !== undefined && node.y !== undefined) {
              node.fx = node.x;
              node.fy = node.y;
            }
          });
        }}
        onNodeDragEnd={(node: any) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
      />

      {/* Legend — only show types that exist */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '24px',
        display: 'flex',
        gap: '16px',
        zIndex: 10,
      }}>
        {Object.entries(NODE_COLORS)
          .filter(([type]) => typeCounts[type])
          .map(([type, colors]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: type === 'decision' ? '10px' : '8px',
              height: type === 'decision' ? '10px' : '8px',
              borderRadius: type === 'keyword' ? '2px' : '50%',
              backgroundColor: colors.core,
              boxShadow: `0 0 6px ${colors.glow}`,
              transform: type === 'decision' ? 'rotate(45deg)' : undefined,
            }} />
            <span style={{
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.5)',
            }}>
              {colors.label} ({typeCounts[type]})
            </span>
          </div>
        ))}
      </div>

      {/* Edge type legend */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        right: '24px',
        display: 'flex',
        gap: '12px',
        zIndex: 10,
      }}>
        {Object.entries(EDGE_COLORS).slice(0, 4).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '16px',
              height: '2px',
              backgroundColor: color,
              boxShadow: `0 0 4px ${color}`,
            }} />
            <span style={{
              fontSize: '9px',
              color: 'rgba(255, 255, 255, 0.4)',
            }}>
              {type}
            </span>
          </div>
        ))}
      </div>

      {/* Focused node detail dialog */}
      {focusedNode && (
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '24px',
          width: '280px',
          backgroundColor: 'rgba(10, 10, 26, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          padding: '16px',
          zIndex: 25,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
        }}>
          {/* Close button */}
          <button
            onClick={() => {
              setFocusedNode(null);
              onNodeSelect?.(null);
              graphRef.current?.zoomToFit(500, 80);
            }}
            style={{
              position: 'absolute',
              top: '8px',
              right: '10px',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0',
              fontFamily: 'inherit',
            }}
          >
            &times;
          </button>

          {/* Node type badge */}
          <div style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: `${NODE_COLORS[focusedNode.node_type]?.core || '#2563EB'}30`,
            color: NODE_COLORS[focusedNode.node_type]?.glow || '#93C5FD',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase' as const,
            marginBottom: '8px',
          }}>
            {NODE_COLORS[focusedNode.node_type]?.label || focusedNode.node_type}
          </div>

          {/* Node label */}
          <div style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#FFFFFF',
            lineHeight: 1.3,
            marginBottom: '12px',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}>
            {focusedNode.label}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
            {(focusedNode.mention_count || 0) > 0 && (
              <div style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.6)',
              }}>
                <span style={{ fontWeight: 700, color: '#FFF', fontSize: '14px' }}>{focusedNode.mention_count}</span> mentions
              </div>
            )}
            {(focusedNode._connectionCount || 0) > 0 && (
              <div style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.6)',
              }}>
                <span style={{ fontWeight: 700, color: '#FFF', fontSize: '14px' }}>{focusedNode._connectionCount}</span> connexions
              </div>
            )}
          </div>

          {/* Connected nodes list */}
          {(() => {
            const causes: string[] = [];
            const effects: string[] = [];
            for (const edge of graphData.links) {
              const srcId = typeof edge.source === 'object' ? edge.source.id : edge.source;
              const tgtId = typeof edge.target === 'object' ? edge.target.id : edge.target;
              if (srcId === focusedNode.id) {
                const t = graphData.nodes.find(nd => nd.id === tgtId);
                if (t) effects.push(t.label);
              } else if (tgtId === focusedNode.id) {
                const s = graphData.nodes.find(nd => nd.id === srcId);
                if (s) causes.push(s.label);
              }
            }
            return (
              <>
                {causes.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: '4px',
                    }}>
                      CAUSES
                    </div>
                    {causes.map((c, i) => (
                      <div key={i} style={{
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.8)',
                        padding: '3px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        cursor: 'pointer',
                      }}
                        onClick={() => {
                          const targetNode = graphData.nodes.find(nd => nd.label === c);
                          if (targetNode) handleNodeClick(targetNode);
                        }}
                      >
                        <span style={{ color: '#DC2626', marginRight: '6px' }}>&#8592;</span>
                        {c}
                      </div>
                    ))}
                  </div>
                )}
                {effects.length > 0 && (
                  <div>
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '1px',
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: '4px',
                    }}>
                      EFFETS
                    </div>
                    {effects.map((e, i) => (
                      <div key={i} style={{
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.8)',
                        padding: '3px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        cursor: 'pointer',
                      }}
                        onClick={() => {
                          const targetNode = graphData.nodes.find(nd => nd.label === e);
                          if (targetNode) handleNodeClick(targetNode);
                        }}
                      >
                        <span style={{ color: '#10B981', marginRight: '6px' }}>&#8594;</span>
                        {e}
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}

          {/* Hint */}
          <div style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.3)',
            marginTop: '12px',
            textAlign: 'center',
          }}>
            Cliquez sur un lien pour naviguer
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredNode && !focusedNode && (
        <div style={{
          position: 'absolute',
          bottom: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(10, 10, 26, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '12px 16px',
          maxWidth: '450px',
          zIndex: 20,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#FFFFFF',
            marginBottom: '6px',
            lineHeight: 1.4,
          }}>
            {hoveredNode.label}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: `${NODE_COLORS[hoveredNode.node_type]?.core || '#2563EB'}25`,
              color: NODE_COLORS[hoveredNode.node_type]?.glow || '#93C5FD',
            }}>
              {NODE_COLORS[hoveredNode.node_type]?.label || hoveredNode.node_type}
            </span>
            {(hoveredNode.mention_count || 0) > 1 && (
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
              }}>
                {hoveredNode.mention_count}x mentions
              </span>
            )}
            {(hoveredNode._connectionCount || 0) > 0 && (
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
              }}>
                {hoveredNode._connectionCount} connexions
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
