'use client';

import React, { useState, useEffect } from 'react';
import { SynthesisData, GeographicLocation, sharedStyles } from '@/app/types/synthesis-page';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.warn('SVG parse error:', parserError.textContent);
      return '';
    }

    function sanitizeNode(node: Element) {
      const children = Array.from(node.children);
      for (const child of children) {
        const tag = child.tagName.toLowerCase();

        if (DANGEROUS_ELEMENTS.has(tag)) {
          child.remove();
          continue;
        }

        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          if (attr.name.toLowerCase().startsWith('on')) {
            child.removeAttribute(attr.name);
          }
          if (
            (attr.name === 'href' || attr.name === 'xlink:href') &&
            /javascript\s*:/i.test(attr.value)
          ) {
            child.removeAttribute(attr.name);
          }
        }

        if (tag === 'style' && child.textContent) {
          child.textContent = child.textContent.replace(DANGEROUS_CSS_RE, '/* removed */');
        }

        sanitizeNode(child);
      }
    }

    const svg = doc.documentElement;
    sanitizeNode(svg);

    return new XMLSerializer().serializeToString(svg);
  } catch {
    return '';
  }
}

// ==========================================
// Type badge mapping
// ==========================================

const TYPE_BADGES: Record<string, string> = {
  city: 'ville',
  country: 'pays',
  region: 'r\u00e9gion',
  waterway: 'voie maritime',
  base: 'base',
};

// ==========================================
// Component
// ==========================================

interface GeoSvgWidgetProps {
  synthesis: SynthesisData;
}

export default function GeoSvgWidget({ synthesis }: GeoSvgWidgetProps) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const relevance = synthesis.geoRelevance || 'none';
  const locations = synthesis.geographicContext || [];
  const shouldFetch = relevance !== 'none' && locations.length >= 1;

  useEffect(() => {
    if (!shouldFetch) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchGeoSvg() {
      try {
        const res = await fetch(
          `${API_URL}/api/causal/syntheses/${synthesis.id}/geo-svg`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!cancelled && data.has_geo && data.svg_content) {
          const sanitized = sanitizeSvg(data.svg_content);
          setSvgContent(sanitized || null);
        }
      } catch {
        // Silently fail — widget just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchGeoSvg();
    return () => { cancelled = true; };
  }, [synthesis.id, shouldFetch]);

  // Don't render if no geo data or no SVG available
  if (!shouldFetch) return null;
  if (!loading && !svgContent) return null;

  return (
    <div style={styles.container}>
      <h3 style={styles.sectionTitle}>{'G\u00c9OGRAPHIE DE L\u2019\u00c9V\u00c9NEMENT'}</h3>

      {/* SVG Map */}
      <div style={styles.mapContainer}>
        {loading ? (
          <div style={styles.skeleton}>
            <div style={styles.skeletonPulse} />
          </div>
        ) : svgContent ? (
          <div
            style={styles.svgWrapper}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : null}
      </div>

      {/* Location list */}
      <div style={styles.locationList}>
        {locations.slice(0, 6).map((loc, i) => (
          <div key={i} style={styles.locationItem}>
            <div style={styles.locationDot} />
            <div style={styles.locationText}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={styles.locationName}>{loc.place}</span>
                {TYPE_BADGES[loc.type] && (
                  <span style={styles.locationBadge}>
                    {TYPE_BADGES[loc.type]}
                  </span>
                )}
              </div>
              {loc.role && (
                <span style={styles.locationRole}>{loc.role}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// Styles
// ==========================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '32px',
    padding: '20px',
    backgroundColor: '#fff',
    border: `1px solid ${sharedStyles.border}`,
    position: 'relative',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: sharedStyles.textPrimary,
    fontFamily: sharedStyles.fontSans,
    borderBottom: '2px solid #000',
    paddingBottom: '8px',
  },
  mapContainer: {
    width: '100%',
    marginBottom: '16px',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  svgWrapper: {
    width: '100%',
    lineHeight: 0,
  },
  skeleton: {
    width: '100%',
    height: '200px',
    backgroundColor: '#0F1118',
    borderRadius: '4px',
    overflow: 'hidden',
    position: 'relative',
  },
  skeletonPulse: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
    animation: 'shimmer 1.5s infinite',
  },
  locationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  locationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '6px 0',
    borderBottom: `1px solid ${sharedStyles.border}`,
  },
  locationDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#DC2626',
    flexShrink: 0,
    marginTop: '5px',
  },
  locationText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  locationName: {
    fontSize: '13px',
    fontWeight: 700,
    color: sharedStyles.textPrimary,
    fontFamily: sharedStyles.fontSans,
  },
  locationBadge: {
    fontSize: '9px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    padding: '1px 5px',
  },
  locationRole: {
    fontSize: '11px',
    color: sharedStyles.textSecondary,
    lineHeight: '1.3',
    fontFamily: sharedStyles.fontSans,
  },
};
