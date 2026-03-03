'use client';

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d').then((mod) => mod.default),
  { ssr: false }
);

// Node types → colors (cosmic palette)
const NODE_COLORS: Record<string, { core: string; glow: string }> = {
  event:    { core: '#DC2626', glow: '#FCA5A5' },
  entity:   { core: '#2563EB', glow: '#93C5FD' },
  decision: { core: '#F59E0B', glow: '#FDE68A' },
  keyword:  { core: '#10B981', glow: '#6EE7B7' },
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
}

export default function NexusForceGraph({
  nodes: rawNodes,
  edges: rawEdges,
  centralEntity,
  topic,
  height = 600,
}: NexusForceGraphProps) {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(Date.now());
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [hoveredNode, setHoveredNode] = useState<NexusNode | null>(null);
  const [, setTick] = useState(0);

  // Build graph data with source/target as IDs
  const graphData = useMemo(() => {
    const nodeMap = new Map(rawNodes.map(n => [n.id, n]));
    const labelToId = new Map(rawNodes.map(n => [n.label, n.id]));

    const graphNodes: NexusNode[] = rawNodes.map(n => ({
      id: n.id,
      label: n.label,
      node_type: n.node_type || 'event',
      mention_count: n.mention_count || 1,
      first_seen: n.first_seen,
      last_seen: n.last_seen,
    }));

    const graphEdges: NexusEdge[] = [];
    const edgeSet = new Set<string>();

    for (const e of rawEdges) {
      // Resolve source/target from cause_text/effect_text
      const sourceId = labelToId.get(e.cause_text);
      const targetId = labelToId.get(e.effect_text);

      if (!sourceId || !targetId || sourceId === targetId) continue;
      if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) continue;

      const edgeKey = `${sourceId}-${targetId}`;
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);

      graphEdges.push({
        id: e.id || edgeKey,
        source: sourceId,
        target: targetId,
        relation_type: e.relation_type || 'causes',
        confidence: e.confidence || 0.5,
        cause_text: e.cause_text,
        effect_text: e.effect_text,
      });
    }

    return { nodes: graphNodes, links: graphEdges };
  }, [rawNodes, rawEdges]);

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

  // Configure forces and freeze after simulation
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge')?.strength(-300);
      graphRef.current.d3Force('link')?.distance(100);
    }
  }, [graphData]);

  // Center on central entity after layout
  useEffect(() => {
    if (graphRef.current && centralEntity) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(500, 60);
      }, 800);
    }
  }, [centralEntity, graphData]);

  // Custom node renderer
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as NexusNode;
    const x = n.x || 0;
    const y = n.y || 0;
    const time = timeRef.current;

    const colors = NODE_COLORS[n.node_type] || NODE_COLORS.event;
    const { r, g, b } = hexToRgb(colors.core);

    const mentionSize = Math.min(20, 6 + Math.sqrt(n.mention_count || 1) * 3);
    const breathe = 1 + Math.sin(time / 1500 + n.id.charCodeAt(0) * 0.3) * 0.06;
    const size = mentionSize * breathe;

    // Outer glow
    const glowRadius = size * 3;
    const glowAlpha = 0.25 + Math.sin(time / 1000 + n.id.charCodeAt(0)) * 0.1;
    const glow = ctx.createRadialGradient(x, y, size * 0.5, x, y, glowRadius);
    glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
    glow.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Node body
    const bodyGrad = ctx.createRadialGradient(x - size * 0.2, y - size * 0.2, 0, x, y, size);
    bodyGrad.addColorStop(0, `rgba(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)}, 1)`);
    bodyGrad.addColorStop(0.6, colors.core);
    bodyGrad.addColorStop(1, `rgba(${Math.floor(r * 0.7)}, ${Math.floor(g * 0.7)}, ${Math.floor(b * 0.7)}, 1)`);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Inner highlight
    const coreAlpha = 0.5 + Math.sin(time / 600 + n.id.charCodeAt(0) * 2) * 0.2;
    const coreGrad = ctx.createRadialGradient(x - size * 0.15, y - size * 0.15, 0, x, y, size * 0.4);
    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`);
    coreGrad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Label (show when zoomed or hovered)
    const isHovered = hoveredNode?.id === n.id;
    const showLabel = globalScale > 1.2 || isHovered;
    if (showLabel && n.label) {
      const fontSize = Math.max(10, 12 / globalScale);
      ctx.font = `${isHovered ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const text = n.label.length > 40 ? n.label.slice(0, 37) + '...' : n.label;
      const textWidth = ctx.measureText(text).width;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.beginPath();
      ctx.roundRect(x - textWidth / 2 - 5, y + size + 4, textWidth + 10, fontSize + 6, 3);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text, x, y + size + fontSize / 2 + 7);
    }
  }, [hoveredNode]);

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

    const alpha = 0.15 + edge.confidence * 0.35;
    const width = 0.8 + edge.confidence * 2;

    // Glow
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`;
    ctx.lineWidth = width + 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke();

    // Arrow
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const nodeSize = 6 + Math.sqrt((target as NexusNode).mention_count || 1) * 3;
    const arrowLen = 8;
    const t = Math.max(0, 1 - (nodeSize + 2) / len);
    const ax = x1 + dx * t;
    const ay = y1 + dy * t;
    const angle = Math.atan2(dy, dx);

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(
      ax - arrowLen * Math.cos(angle - Math.PI / 6),
      ay - arrowLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      ax - arrowLen * Math.cos(angle + Math.PI / 6),
      ay - arrowLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha + 0.1})`;
    ctx.fill();

    // Flowing particle
    const time = timeRef.current;
    const particleT = ((time / 3000) + edge.id.charCodeAt(0) * 0.1) % 1;
    const px = x1 + dx * particleT;
    const py = y1 + dy * particleT;
    const pGrad = ctx.createRadialGradient(px, py, 0, px, py, 4);
    pGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
    pGrad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = pGrad;
    ctx.fill();
  }, []);

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node as NexusNode | null);
  }, []);

  const nodeCount = graphData.nodes.length;
  const edgeCount = graphData.links.length;

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
          const size = 6 + Math.sqrt(n.mention_count || 1) * 3 + 5;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x || 0, n.y || 0, size, 0, Math.PI * 2);
          ctx.fill();
        }}
        linkCanvasObject={linkCanvasObject}
        linkDirectionalParticles={0}
        onNodeHover={handleNodeHover}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        d3AlphaDecay={0.3}
        d3VelocityDecay={0.85}
        cooldownTicks={100}
        warmupTicks={80}
        cooldownTime={2000}
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

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '24px',
        display: 'flex',
        gap: '16px',
        zIndex: 10,
      }}>
        {Object.entries(NODE_COLORS).map(([type, colors]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: colors.core,
              boxShadow: `0 0 6px ${colors.glow}`,
            }} />
            <span style={{
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'capitalize',
            }}>
              {type}
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

      {/* Hover tooltip */}
      {hoveredNode && (
        <div style={{
          position: 'absolute',
          bottom: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(10, 10, 26, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '12px 16px',
          maxWidth: '400px',
          zIndex: 20,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#FFFFFF',
            marginBottom: '6px',
          }}>
            {hoveredNode.label}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: `${NODE_COLORS[hoveredNode.node_type]?.core || '#2563EB'}25`,
              color: NODE_COLORS[hoveredNode.node_type]?.glow || '#93C5FD',
            }}>
              {hoveredNode.node_type}
            </span>
            {(hoveredNode.mention_count || 0) > 1 && (
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
              }}>
                {hoveredNode.mention_count}x
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
