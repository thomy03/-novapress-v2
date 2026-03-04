'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { NexusForceGraphProps } from './NexusForceGraph';

const NexusForceGraph = dynamic(
  () => import('./NexusForceGraph'),
  { ssr: false }
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ==========================================
// Types
// ==========================================

interface NexusSvg {
  svg_content: string;
  timestamp: number;
  synthesis_id: string;
  synthesis_title: string;
  node_count: number;
  edge_count?: number;
  topic: string;
  has_geo?: boolean;
  has_metrics?: boolean;
}

interface NexusScrollViewerProps {
  topic: string;
  nodes: NexusForceGraphProps['nodes'];
  edges: NexusForceGraphProps['edges'];
  centralEntity?: string;
  height?: number;
}

// ==========================================
// SVG Sanitizer (client-side defense in depth)
// ==========================================

const DANGEROUS_ELEMENTS = new Set([
  'script', 'foreignobject', 'iframe', 'embed', 'object',
  'applet', 'form', 'input', 'textarea', 'button',
  'link', 'meta', 'base',
]);

const DANGEROUS_CSS_RE = /url\s*\(|expression\s*\(|@import|behavior\s*:|javascript:/gi;

function sanitizeSvg(raw: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'image/svg+xml');

    // Check for parse errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.warn('SVG parse error:', parserError.textContent);
      return '';
    }

    // Recursive sanitizer
    function sanitizeNode(node: Element) {
      const children = Array.from(node.children);
      for (const child of children) {
        const tag = child.tagName.toLowerCase();

        // Remove dangerous elements
        if (DANGEROUS_ELEMENTS.has(tag)) {
          child.remove();
          continue;
        }

        // Remove on* event handler attributes
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          if (attr.name.toLowerCase().startsWith('on')) {
            child.removeAttribute(attr.name);
          }
          // Remove href with javascript:
          if (
            (attr.name === 'href' || attr.name === 'xlink:href') &&
            /javascript\s*:/i.test(attr.value)
          ) {
            child.removeAttribute(attr.name);
          }
        }

        // Sanitize <style> content
        if (tag === 'style' && child.textContent) {
          child.textContent = child.textContent.replace(DANGEROUS_CSS_RE, '/* removed */');
        }

        // Recurse
        sanitizeNode(child);
      }
    }

    const svg = doc.documentElement;
    sanitizeNode(svg);

    // Ensure viewBox and preserveAspectRatio
    if (!svg.getAttribute('viewBox')) {
      svg.setAttribute('viewBox', '0 0 1280 720');
    }
    if (!svg.getAttribute('preserveAspectRatio')) {
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    // Make SVG fill its container
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  } catch (err) {
    console.error('SVG sanitization failed:', err);
    return '';
  }
}

// ==========================================
// Component
// ==========================================

export default function NexusScrollViewer({
  topic,
  nodes,
  edges,
  centralEntity,
  height = 600,
}: NexusScrollViewerProps) {
  const [svgs, setSvgs] = useState<NexusSvg[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch timeline SVGs
  useEffect(() => {
    const fetchSvgs = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/causal/topics/${encodeURIComponent(topic)}/nexus-timeline`
        );
        if (response.ok) {
          const data = await response.json();
          setSvgs(data.entries || []);
        }
      } catch (err) {
        console.error('Failed to fetch nexus timeline:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSvgs();
  }, [topic]);

  // Pre-sanitize SVGs
  const sanitizedSvgs = useMemo(() => {
    return svgs.map(svg => ({
      ...svg,
      _sanitized: sanitizeSvg(svg.svg_content),
    }));
  }, [svgs]);

  // Scroll-driven animation handler
  const handleScroll = useCallback(() => {
    if (!scrollAreaRef.current || sanitizedSvgs.length < 2) return;

    const el = scrollAreaRef.current;
    const scrollTop = el.scrollTop;
    const maxScroll = el.scrollHeight - el.clientHeight;

    if (maxScroll <= 0) return;

    const progress = Math.min(1, Math.max(0, scrollTop / maxScroll));
    setScrollProgress(progress);

    const idx = Math.min(
      sanitizedSvgs.length - 1,
      Math.floor(progress * sanitizedSvgs.length)
    );
    setCurrentIndex(idx);
  }, [sanitizedSvgs.length]);

  // Format timestamp
  const formatDate = (ts: number) => {
    try {
      return new Date(ts * 1000).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div style={{
        height: `${height}px`,
        backgroundColor: '#0A0A1A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.8) 0%, rgba(37, 99, 235, 0.2) 70%, transparent 100%)',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>
          Chargement du nexus...
        </span>
      </div>
    );
  }

  // No SVGs → fallback to force graph
  if (sanitizedSvgs.length === 0 || sanitizedSvgs.every(s => !s._sanitized)) {
    return (
      <NexusForceGraph
        nodes={nodes}
        edges={edges}
        centralEntity={centralEntity}
        topic={topic}
        height={height}
      />
    );
  }

  // Scroll-driven viewer mode
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
      {/* Scrollable area (invisible — drives the animation) */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'scroll',
          zIndex: 5,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none' as React.CSSProperties['msOverflowStyle'],
        }}
      >
        {/* Spacer to create scroll room */}
        <div style={{ height: `${sanitizedSvgs.length * 100}%`, pointerEvents: 'none' }} />
      </div>

      {/* Stacked SVGs with opacity crossfade */}
      {sanitizedSvgs.map((svg, idx) => {
        if (!svg._sanitized) return null;

        let opacity = 0;
        if (idx === currentIndex) {
          opacity = 1;
        } else if (idx === currentIndex - 1) {
          const segmentSize = 1 / sanitizedSvgs.length;
          const segmentProgress = (scrollProgress - idx * segmentSize) / segmentSize;
          opacity = Math.max(0, 1 - segmentProgress);
        } else if (idx === currentIndex + 1) {
          const segmentSize = 1 / sanitizedSvgs.length;
          const segmentProgress = (scrollProgress - currentIndex * segmentSize) / segmentSize;
          opacity = Math.max(0, segmentProgress);
        }

        return (
          <div
            key={svg.synthesis_id + idx}
            style={{
              position: 'absolute',
              inset: 0,
              opacity,
              transition: 'opacity 0.15s ease-out',
              pointerEvents: 'none',
            }}
            dangerouslySetInnerHTML={{ __html: svg._sanitized }}
          />
        );
      })}

      {/* Title + metadata overlay */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '24px',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: 'rgba(255, 255, 255, 0.5)',
          textTransform: 'uppercase',
        }}>
          NEXUS CAUSAL
        </div>
        <div style={{
          fontSize: '22px',
          fontWeight: 700,
          color: '#FFFFFF',
          fontFamily: 'Georgia, "Times New Roman", serif',
          marginTop: '4px',
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          {topic}
        </div>
      </div>

      {/* Current SVG info */}
      {sanitizedSvgs[currentIndex] && (
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '24px',
          zIndex: 10,
          textAlign: 'right',
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.7)',
          }}>
            {sanitizedSvgs[currentIndex].node_count} noeuds
            {sanitizedSvgs[currentIndex].edge_count ? `  ${sanitizedSvgs[currentIndex].edge_count} relations` : ''}
          </div>
          <div style={{
            fontSize: '13px',
            color: '#FFFFFF',
            maxWidth: '300px',
            lineHeight: 1.3,
            marginTop: '4px',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}>
            {sanitizedSvgs[currentIndex].synthesis_title.length > 80
              ? sanitizedSvgs[currentIndex].synthesis_title.slice(0, 77) + '...'
              : sanitizedSvgs[currentIndex].synthesis_title}
          </div>
        </div>
      )}

      {/* Timeline bar at bottom */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '24px',
        right: '24px',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        {/* Track */}
        <div style={{
          position: 'relative',
          height: '2px',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '1px',
        }}>
          {/* Progress fill */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${scrollProgress * 100}%`,
            backgroundColor: '#2563EB',
            borderRadius: '1px',
            transition: 'width 0.1s ease-out',
          }} />
          {/* Dot markers */}
          {sanitizedSvgs.map((svg, idx) => {
            const dotLeft = sanitizedSvgs.length > 1
              ? (idx / (sanitizedSvgs.length - 1)) * 100
              : 50;
            const isActive = idx === currentIndex;
            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${dotLeft}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: isActive ? '10px' : '6px',
                  height: isActive ? '10px' : '6px',
                  borderRadius: '50%',
                  backgroundColor: isActive ? '#2563EB' : 'rgba(255, 255, 255, 0.4)',
                  boxShadow: isActive ? '0 0 8px rgba(37, 99, 235, 0.6)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              />
            );
          })}
        </div>

        {/* Date labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
        }}>
          {sanitizedSvgs.length > 0 && (
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)' }}>
              {formatDate(sanitizedSvgs[0].timestamp)}
            </span>
          )}
          {sanitizedSvgs.length > 1 && (
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)' }}>
              {formatDate(sanitizedSvgs[sanitizedSvgs.length - 1].timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Scroll hint */}
      <div style={{
        position: 'absolute',
        bottom: '60px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        opacity: scrollProgress < 0.05 ? 0.6 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      }}>
        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
          Scrollez pour naviguer
        </span>
        <div style={{
          width: '1px',
          height: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          animation: 'scrollHint 1.5s ease-in-out infinite',
        }} />
      </div>

      {/* SVG counter */}
      <div style={{
        position: 'absolute',
        bottom: '52px',
        right: '24px',
        zIndex: 10,
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.4)',
        pointerEvents: 'none',
      }}>
        {currentIndex + 1} / {sanitizedSvgs.length}
      </div>

      <style jsx>{`
        @keyframes scrollHint {
          0%, 100% { transform: translateY(0); opacity: 0.3; }
          50% { transform: translateY(8px); opacity: 0.8; }
        }
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
