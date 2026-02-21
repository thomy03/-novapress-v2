"use client";

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from '../../contexts/ThemeContext';
import {
  CortexNode,
  CortexEdge,
  CortexData,
  CortexGraphProps,
  CATEGORY_COLORS,
  DEMO_CORTEX_DATA,
} from '@/app/types/cortex';

// Dynamic import for force-graph (client-side only)
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d').then((mod) => mod.default),
  { ssr: false }
);

// ============================================================================
// ORGANIC COLOR PALETTE - Gradients for the living organism effect
// ============================================================================
const ORGANIC_COLORS: Record<string, { core: string; glow: string; dark: string }> = {
  POLITIQUE: { core: '#DC2626', glow: '#FCA5A5', dark: '#991B1B' },
  ECONOMIE: { core: '#F59E0B', glow: '#FDE68A', dark: '#B45309' },
  TECH: { core: '#3B82F6', glow: '#93C5FD', dark: '#1D4ED8' },
  MONDE: { core: '#10B981', glow: '#6EE7B7', dark: '#047857' },
  CULTURE: { core: '#8B5CF6', glow: '#C4B5FD', dark: '#6D28D9' },
  SPORT: { core: '#06B6D4', glow: '#67E8F9', dark: '#0E7490' },
  SCIENCES: { core: '#EC4899', glow: '#F9A8D4', dark: '#BE185D' },
};

// Node size constants
const NODE_BASE_SIZE = 8;
const NODE_MAX_SIZE = 28;

// Helper functions
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 59, g: 130, b: 246 };
}

function lightenColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const newR = Math.min(255, r + (255 - r) * (percent / 100));
  const newG = Math.min(255, g + (255 - g) * (percent / 100));
  const newB = Math.min(255, b + (255 - b) * (percent / 100));
  return `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`;
}

function darkenColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const newR = r * (1 - percent / 100);
  const newG = g * (1 - percent / 100);
  const newB = b * (1 - percent / 100);
  return `rgb(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)})`;
}

// ============================================================================
// NEURAL NODE RENDERER - Breathing, glowing neurons
// ============================================================================
function drawNeuralNode(
  node: CortexNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  time: number,
  isActive: boolean,
  activationIntensity: number,
  isHovered: boolean,
  theme: { text: string; bg: string }
) {
  const x = node.x || 0;
  const y = node.y || 0;

  // Get phase for this node (use id hash if no phase provided)
  const nodePhase = node.phase || (node.id.charCodeAt(0) * 0.5);

  // BREATHING EFFECT: subtle size pulse based on time + node's unique phase
  const breathe = 1 + Math.sin(time / 1200 + nodePhase) * 0.04;

  // Base size calculation
  const baseSize = Math.min(
    NODE_MAX_SIZE,
    NODE_BASE_SIZE + Math.sqrt(node.synthesis_count || 1) * 2.5
  );
  const size = baseSize * breathe * (isActive ? 1.15 : 1);

  // Get organic colors for category
  const colors = ORGANIC_COLORS[node.category] || ORGANIC_COLORS['MONDE'];

  // 1. OUTER GLOW - Large ambient glow that pulses
  const glowPulse = 0.3 + Math.sin(time / 800 + nodePhase) * 0.15;
  const glowRadius = size * (isActive ? 3.5 : 2.5) * (1 + activationIntensity * 0.5);

  const glowGradient = ctx.createRadialGradient(x, y, size * 0.3, x, y, glowRadius);
  const { r, g, b } = hexToRgb(colors.glow);
  glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${(glowPulse + activationIntensity * 0.3) * 0.6})`);
  glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${(glowPulse + activationIntensity * 0.2) * 0.3})`);
  glowGradient.addColorStop(1, 'transparent');

  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = glowGradient;
  ctx.fill();

  // 2. MAIN NODE BODY - Organic gradient from light center to dark edge
  const nodeGradient = ctx.createRadialGradient(x - size * 0.2, y - size * 0.2, 0, x, y, size);
  nodeGradient.addColorStop(0, lightenColor(colors.core, 35));
  nodeGradient.addColorStop(0.5, colors.core);
  nodeGradient.addColorStop(0.85, darkenColor(colors.core, 15));
  nodeGradient.addColorStop(1, colors.dark);

  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fillStyle = nodeGradient;
  ctx.fill();

  // 3. HIGHLIGHT RING for active/hovered nodes
  if (isActive || isHovered) {
    ctx.beginPath();
    ctx.arc(x, y, size + 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + activationIntensity * 0.4})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // 4. INNER CORE - Bright center that pulses stronger when active
  const corePulse = isActive ? 0.9 : (0.6 + Math.sin(time / 400 + nodePhase * 2) * 0.2);
  const coreGradient = ctx.createRadialGradient(
    x - size * 0.15, y - size * 0.15, 0,
    x, y, size * 0.45
  );
  coreGradient.addColorStop(0, `rgba(255, 255, 255, ${corePulse})`);
  coreGradient.addColorStop(0.7, `rgba(255, 255, 255, ${corePulse * 0.3})`);
  coreGradient.addColorStop(1, 'transparent');

  ctx.beginPath();
  ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = coreGradient;
  ctx.fill();

  // 5. LABEL - Show when zoomed in, hovered, or active
  const showLabel = globalScale > 1.0 || isActive || isHovered;
  if (showLabel && node.name) {
    const fontSize = Math.max(11, 13 / globalScale);
    ctx.font = `${isActive ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text background
    const textWidth = ctx.measureText(node.name).width;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(
      x - textWidth / 2 - 6,
      y + size + 6,
      textWidth + 12,
      fontSize + 8,
      4
    );
    ctx.fill();

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(node.name, x, y + size + fontSize / 2 + 10);
  }
}

// ============================================================================
// SYNAPSE LINK RENDERER - Glowing connections with particles
// ============================================================================
function drawSynapseLink(
  link: CortexEdge,
  ctx: CanvasRenderingContext2D,
  time: number,
  isHighlighted: boolean,
  hasActiveSelection: boolean,
  nodes: CortexNode[]
) {
  const source = typeof link.source === 'object' ? link.source : nodes.find(n => n.id === link.source);
  const target = typeof link.target === 'object' ? link.target : nodes.find(n => n.id === link.target);

  if (!source || !target || source.x === undefined || target.x === undefined) return;

  const x1 = source.x;
  const y1 = source.y || 0;
  const x2 = target.x;
  const y2 = target.y || 0;

  // Get source category color
  const colors = ORGANIC_COLORS[source.category] || ORGANIC_COLORS['MONDE'];
  const { r, g, b } = hexToRgb(colors.core);

  // Determine opacity and width based on state
  let opacity = 0.15 + link.similarity * 0.25;
  let lineWidth = 1 + link.similarity * 1.5;
  let particleCount = 2;

  if (isHighlighted) {
    opacity = 0.9;
    lineWidth = 2.5 + link.similarity * 2.5;
    particleCount = 5 + Math.floor(link.similarity * 4);
  } else if (hasActiveSelection) {
    opacity = 0.05;
    lineWidth = 0.5;
    particleCount = 0;
  }

  // 1. GLOW LINE (outer)
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.5})`;
  ctx.lineWidth = lineWidth + 4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // 2. MAIN LINE
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // 3. PARTICLES - Always flowing (the magic of the living organism!)
  if (particleCount > 0) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    for (let i = 0; i < particleCount; i++) {
      // Each particle has its own phase for varied animation
      const particlePhase = i / particleCount;
      const speed = isHighlighted ? 2000 : 4000; // Faster when highlighted
      const t = ((time / speed) + particlePhase) % 1;

      const px = x1 + dx * t;
      const py = y1 + dy * t;

      // Particle size varies
      const particleSize = isHighlighted ? 3 + Math.sin(time / 200 + i) * 1 : 2;

      // Draw particle with glow
      const particleGradient = ctx.createRadialGradient(px, py, 0, px, py, particleSize * 3);
      particleGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
      particleGradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.5)`);
      particleGradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(px, py, particleSize * 3, 0, Math.PI * 2);
      ctx.fillStyle = particleGradient;
      ctx.fill();

      // Core of particle
      ctx.beginPath();
      ctx.arc(px, py, particleSize, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
  }
}

// ============================================================================
// CORTEX GRAPH COMPONENT
// ============================================================================
export function CortexGraph({
  data = DEMO_CORTEX_DATA,
  compact = false,
  height = 450,
  width,
  onNodeClick,
  onNodeHover,
  onExploreClick,
  highlightNodeId,
  showLabels = true,
  enableDrag = true,
  enableZoom = true,
}: CortexGraphProps) {
  const { theme } = useTheme();
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const [hoveredNode, setHoveredNode] = useState<CortexNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<CortexNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const [activatedNodes, setActivatedNodes] = useState<Map<string, { time: number; intensity: number }>>(new Map());

  // Build highlight sets
  const { highlightedNodes, highlightedLinks } = useMemo(() => {
    const nodes = new Set<string>();
    const links = new Set<string>();

    const activeNode = selectedNode || hoveredNode;
    const effectiveHighlightId = highlightNodeId || activeNode?.id;

    if (effectiveHighlightId) {
      nodes.add(effectiveHighlightId);
      data.edges.forEach((edge) => {
        const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
        if (sourceId === effectiveHighlightId || targetId === effectiveHighlightId) {
          nodes.add(sourceId);
          nodes.add(targetId);
          links.add(`${sourceId}-${targetId}`);
          links.add(`${targetId}-${sourceId}`);
        }
      });
    }

    return { highlightedNodes: nodes, highlightedLinks: links };
  }, [data.edges, selectedNode, hoveredNode, highlightNodeId]);

  // ========================================================================
  // ANIMATION LOOP - The heartbeat of the organism (throttled for performance)
  // ========================================================================
  const [animationTick, setAnimationTick] = useState(0);
  const lastRenderRef = useRef(0);
  const ANIMATION_INTERVAL = 50; // 20fps for breathing is smooth enough

  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      timeRef.current = now;

      // Throttle re-renders to every 50ms for performance
      if (now - lastRenderRef.current >= ANIMATION_INTERVAL) {
        lastRenderRef.current = now;
        setAnimationTick(prev => (prev + 1) % 1000);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Configure forces when graph is ready
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge')?.strength(-350);
      graphRef.current.d3Force('link')?.distance(120);

      // Freeze nodes after a short delay to let initial layout settle
      setTimeout(() => {
        data.nodes.forEach((node: CortexNode) => {
          if (node.x !== undefined && node.y !== undefined) {
            node.fx = node.x;
            node.fy = node.y;
          }
        });
      }, 2000);
    }
  }, [data]);

  // Handle container resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: width || rect.width,
          height: height,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [width, height]);

  // Center graph on central node when data changes
  useEffect(() => {
    if (graphRef.current && data.central_node_id) {
      setTimeout(() => {
        const centralNode = data.nodes.find((n) => n.id === data.central_node_id);
        if (centralNode && centralNode.x !== undefined && centralNode.y !== undefined) {
          graphRef.current.centerAt(centralNode.x, centralNode.y, 1000);
          graphRef.current.zoom(compact ? 1.5 : 1.2, 1000);
        }
      }, 500);
    }
  }, [data, compact]);

  // CASCADE ACTIVATION - When clicking a node, activate neighbors in sequence
  const triggerCascade = useCallback((nodeId: string) => {
    const newActivated = new Map(activatedNodes);
    newActivated.set(nodeId, { time: Date.now(), intensity: 1.0 });

    // Find connected neighbors
    const neighbors: string[] = [];
    data.edges.forEach((edge) => {
      const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
      if (sourceId === nodeId && !neighbors.includes(targetId)) {
        neighbors.push(targetId);
      } else if (targetId === nodeId && !neighbors.includes(sourceId)) {
        neighbors.push(sourceId);
      }
    });

    // Activate neighbors with delay (cascade effect)
    neighbors.forEach((neighborId, index) => {
      setTimeout(() => {
        setActivatedNodes((prev) => {
          const updated = new Map(prev);
          updated.set(neighborId, { time: Date.now(), intensity: 0.7 - index * 0.08 });
          return updated;
        });
      }, 100 * (index + 1));
    });

    // Clear activations after 2 seconds
    setTimeout(() => {
      setActivatedNodes(new Map());
    }, 2500);

    setActivatedNodes(newActivated);
  }, [data.edges, activatedNodes]);

  // Node click handler
  const handleNodeClick = useCallback(
    (node: CortexNode) => {
      setSelectedNode(prev => prev?.id === node.id ? null : node);
      triggerCascade(node.id);

      if (onNodeClick) {
        onNodeClick(node);
      } else if (compact && onExploreClick) {
        onExploreClick();
      }
    },
    [onNodeClick, compact, onExploreClick, triggerCascade]
  );

  // Background click - deselect
  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setActivatedNodes(new Map());
  }, []);

  // Node hover handler
  const handleNodeHover = useCallback(
    (node: CortexNode | null) => {
      setHoveredNode(node);
      if (onNodeHover) {
        onNodeHover(node);
      }
    },
    [onNodeHover]
  );

  // Stats display
  const edgeCount = data.edges.length;
  const nodeCount = data.nodes.length;

  return (
    <div
      ref={containerRef}
      className="cortex-container"
      style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        backgroundColor: '#0a0a0f',
        borderRadius: compact ? '16px' : '0',
        overflow: 'hidden',
      }}
    >
      {/* Neural background with subtle animation */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, #12121f 0%, #0a0a0f 70%, #050508 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Stars/neurons background particles */}
      <div className="cortex-stars" style={{ opacity: 0.5 }} />

      {/* Title for compact mode */}
      {compact && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '24px',
            zIndex: 10,
          }}
        >
          <h2
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'rgba(255, 255, 255, 0.5)',
              margin: 0,
            }}
          >
            Cortex Thematique
          </h2>
          <p
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: '#FFFFFF',
              margin: '4px 0 0 0',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            Organisme Pensant
          </p>
        </div>
      )}

      {/* Stats overlay */}
      <div
        style={{
          position: 'absolute',
          top: compact ? '70px' : '16px',
          left: '24px',
          zIndex: 10,
          display: 'flex',
          gap: '16px',
        }}
      >
        <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
          {nodeCount} neurones
        </span>
        <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
          {edgeCount} synapses
        </span>
      </div>

      {/* Force Graph with custom rendering */}
      <ForceGraph2D
        ref={graphRef}
        graphData={{ nodes: data.nodes as any[], links: data.edges as any[] }}
        width={dimensions.width}
        height={height}
        backgroundColor="transparent"
        nodeRelSize={NODE_BASE_SIZE}
        nodeVal={(node: any) => Math.sqrt(((node as CortexNode).synthesis_count || 1) + 1) * 2.5}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const typedNode = node as CortexNode;
          const isActive = highlightedNodes.has(typedNode.id) || activatedNodes.has(typedNode.id);
          const activation = activatedNodes.get(typedNode.id);
          const intensity = activation ? activation.intensity : 0;
          const isHovered = hoveredNode?.id === typedNode.id;

          drawNeuralNode(
            typedNode,
            ctx,
            globalScale,
            timeRef.current,
            isActive,
            intensity,
            isHovered,
            { text: '#FFFFFF', bg: '#0a0a0f' }
          );
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const typedNode = node as CortexNode;
          const size = NODE_BASE_SIZE + Math.sqrt(typedNode.synthesis_count || 1) * 2.5;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(typedNode.x || 0, typedNode.y || 0, size * 2, 0, Math.PI * 2);
          ctx.fill();
        }}
        linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D) => {
          const typedLink = link as CortexEdge;
          const sourceId = typeof typedLink.source === 'string' ? typedLink.source : (typedLink.source as CortexNode).id;
          const targetId = typeof typedLink.target === 'string' ? typedLink.target : (typedLink.target as CortexNode).id;
          const linkId = `${sourceId}-${targetId}`;
          const reverseLinkId = `${targetId}-${sourceId}`;
          const isHighlighted = highlightedLinks.has(linkId) || highlightedLinks.has(reverseLinkId);

          drawSynapseLink(
            typedLink,
            ctx,
            timeRef.current,
            isHighlighted,
            selectedNode !== null && !isHighlighted,
            data.nodes
          );
        }}
        linkDirectionalParticles={0}
        onBackgroundClick={handleBackgroundClick}
        onNodeClick={(node: any) => {
          const typedNode = node as CortexNode;
          node.fx = node.x;
          node.fy = node.y;
          setTimeout(() => {
            node.fx = undefined;
            node.fy = undefined;
          }, 3000);
          handleNodeClick(typedNode);
        }}
        onNodeHover={(node: any) => handleNodeHover(node as CortexNode | null)}
        enableNodeDrag={enableDrag && !compact}
        enableZoomInteraction={enableZoom}
        enablePanInteraction={enableZoom}
        // STATIC GRAPH: Fast simulation then freeze
        d3AlphaDecay={0.3}
        d3VelocityDecay={0.9}
        cooldownTicks={50}
        warmupTicks={100}
        cooldownTime={1500}
        onEngineStop={() => {
          // Freeze all nodes in place after simulation
          data.nodes.forEach((node: CortexNode) => {
            if (node.x !== undefined && node.y !== undefined) {
              node.fx = node.x;
              node.fy = node.y;
            }
          });
        }}
        onNodeDragEnd={(node: any) => {
          // Keep node fixed after manual drag
          node.fx = node.x;
          node.fy = node.y;
        }}
      />

      {/* Explore button for compact mode */}
      {compact && onExploreClick && (
        <button
          onClick={onExploreClick}
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '24px',
            backgroundColor: 'rgba(37, 99, 235, 0.9)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            zIndex: 10,
            boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 1)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.9)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Explorer le Cortex
          <span style={{ fontSize: '16px' }}>→</span>
        </button>
      )}

      {/* Category Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '24px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          maxWidth: compact ? '60%' : '80%',
          zIndex: 10,
        }}
      >
        {Object.entries(ORGANIC_COLORS).map(([cat, colors]) => (
          <div
            key={cat}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: colors.core,
                boxShadow: `0 0 8px ${colors.glow}`,
              }}
            />
            <span
              style={{
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.6)',
                textTransform: 'capitalize',
              }}
            >
              {cat.toLowerCase()}
            </span>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredNode && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '24px',
            backgroundColor: 'rgba(10, 10, 15, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '14px 18px',
            maxWidth: '260px',
            zIndex: 20,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          }}
        >
          <h4
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              color: '#FFFFFF',
            }}
          >
            {hoveredNode.name}
          </h4>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '10px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '6px',
                backgroundColor: `${ORGANIC_COLORS[hoveredNode.category]?.core || '#3B82F6'}25`,
                color: ORGANIC_COLORS[hoveredNode.category]?.glow || '#93C5FD',
                fontWeight: 500,
              }}
            >
              {hoveredNode.category}
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
              }}
            >
              {hoveredNode.synthesis_count} syntheses
            </span>
            <span
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'rgba(255, 255, 255, 0.5)',
                textTransform: 'capitalize',
              }}
            >
              {hoveredNode.narrative_arc}
            </span>
          </div>
          <p
            style={{
              margin: '10px 0 0 0',
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.4)',
            }}
          >
            Cliquez pour voir les connexions
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CORTEX PREVIEW - Compact version for homepage
// ============================================================================
export function CortexPreview({
  onExploreClick,
}: {
  onExploreClick?: () => void;
}) {
  const [data, setData] = useState<CortexData>(DEMO_CORTEX_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const { getCortexData } = await import('@/app/lib/api/services/cortex');
        const cortexData = await getCortexData(20, 0.25);
        setData(cortexData);
      } catch (error) {
        console.error('Failed to fetch cortex data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          height: '450px',
          backgroundColor: '#0a0a0f',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          className="cortex-loading-pulse"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.8) 0%, rgba(59, 130, 246, 0.2) 70%, transparent 100%)',
          }}
        />
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '14px',
          }}
        >
          Eveil du Cortex...
        </div>
      </div>
    );
  }

  return (
    <CortexGraph
      data={data}
      compact={true}
      height={450}
      onExploreClick={onExploreClick}
      enableDrag={false}
      enableZoom={false}
    />
  );
}

export default CortexGraph;
