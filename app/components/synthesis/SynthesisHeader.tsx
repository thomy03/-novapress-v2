'use client';

import React, { useState, useEffect } from 'react';
import { RecurringTopicBadge } from '@/app/components/topics';
import { SynthesisHeaderProps, sharedStyles } from '@/app/types/synthesis-page';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// SVG sanitizer (defense-in-depth, same pattern as GeoSvgWidget)
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
    if (parserError) return '';

    function sanitizeNode(node: Element) {
      for (const child of Array.from(node.children)) {
        if (DANGEROUS_ELEMENTS.has(child.tagName.toLowerCase())) {
          child.remove();
          continue;
        }
        for (const attr of Array.from(child.attributes)) {
          if (attr.name.toLowerCase().startsWith('on')) child.removeAttribute(attr.name);
          if ((attr.name === 'href' || attr.name === 'xlink:href') && /javascript\s*:/i.test(attr.value))
            child.removeAttribute(attr.name);
        }
        if (child.tagName.toLowerCase() === 'style' && child.textContent)
          child.textContent = child.textContent.replace(DANGEROUS_CSS_RE, '/* removed */');
        sanitizeNode(child);
      }
    }

    const svgEl = doc.querySelector('svg');
    if (!svgEl) return '';
    sanitizeNode(svgEl);
    return new XMLSerializer().serializeToString(svgEl);
  } catch {
    return '';
  }
}

/**
 * REF-012b: SynthesisHeader Component
 * Displays the header section of a synthesis page including:
 * - AI Badge
 * - RecurringTopicBadge
 * - Update Notice Banner (if applicable)
 * - Title
 * - Metadata (sources, reading time, date, accuracy)
 */
export function SynthesisHeader({ synthesis, formatDate }: SynthesisHeaderProps) {
  const [editorialSvg, setEditorialSvg] = useState<string>('');
  const [templateSvg, setTemplateSvg] = useState<string>('');

  useEffect(() => {
    if (!synthesis.id) return;
    // Fetch editorial SVG (causal graph)
    fetch(`${API_URL}/api/syntheses/by-id/${synthesis.id}/editorial-svg`)
      .then(res => res.ok ? res.text() : '')
      .then(svg => {
        if (svg) setEditorialSvg(sanitizeSvg(svg));
      })
      .catch(() => {});

    // Fetch template SVG (category fallback) if applicable
    if (synthesis.hasTemplateSvg) {
      fetch(`${API_URL}/api/syntheses/by-id/${synthesis.id}/template-svg`)
        .then(res => res.ok ? res.text() : '')
        .then(svg => {
          if (svg) setTemplateSvg(sanitizeSvg(svg));
        })
        .catch(() => {});
    }
  }, [synthesis.id, synthesis.hasTemplateSvg]);

  return (
    <>
      {/* AI Badge */}
      <div style={styles.badgeContainer}>
        <div style={styles.aiBadge}>
          AI SYNTHESIS
        </div>
        <RecurringTopicBadge synthesisId={synthesis.id} />
      </div>

      {/* Update Notice Banner */}
      {synthesis.isUpdate && synthesis.updateNotice && (
        <div style={styles.updateNoticeBanner}>
          <span style={styles.updateIcon}>🔄</span>
          <span>{synthesis.updateNotice}</span>
        </div>
      )}

      {/* Title */}
      <h1 style={styles.title}>
        {synthesis.title}
      </h1>

      {/* FIX-002: Persona Byline */}
      {(synthesis.persona || synthesis.author) && (
        <p style={styles.byline}>
          Par{' '}
          <span style={styles.personaName}>
            {synthesis.author?.name || synthesis.persona?.name || 'NovaPress'}
          </span>
          {(synthesis.author?.persona_type || synthesis.persona?.displayName) && (
            <span style={styles.personaType}>
              {' '}({synthesis.author?.persona_type || synthesis.persona?.displayName})
            </span>
          )}
        </p>
      )}

      {/* Metadata */}
      <div style={styles.metadata}>
        <span>{synthesis.numSources} sources</span>
        <span style={styles.separator}>|</span>
        <span>{synthesis.readingTime} min de lecture</span>
        <span style={styles.separator}>|</span>
        <span>{formatDate(synthesis.createdAt)}</span>
        <span style={styles.separator}>|</span>
        <span style={styles.accuracyBadge}>
          <span
            style={{
              ...styles.accuracyDot,
              backgroundColor: synthesis.complianceScore >= 90
                ? sharedStyles.accentGreen
                : sharedStyles.accentYellow
            }}
          />
          {synthesis.complianceScore}% accuracy
        </span>
        {synthesis.avgRating !== undefined && synthesis.avgRating > 0 && (
          <>
            <span style={styles.separator}>|</span>
            <span style={{ color: '#F59E0B' }}>&#9733;</span>
            <span> {synthesis.avgRating.toFixed(1)}/5</span>
            <span style={{ color: '#9CA3AF', fontSize: '12px' }}> ({synthesis.feedbackCount})</span>
          </>
        )}
      </div>

      {/* Editorial Illustration: editorial SVG > Wikimedia image > template SVG */}
      {editorialSvg ? (
        <div style={styles.imageContainer}>
          <div
            style={styles.editorialSvg}
            dangerouslySetInnerHTML={{ __html: editorialSvg }}
          />
          <span style={styles.imageCaption}>Infographie editoriale NovaPress</span>
        </div>
      ) : synthesis.imageUrl ? (
        <div style={styles.imageContainer}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={synthesis.imageUrl}
            alt={`Illustration: ${synthesis.title}`}
            style={styles.editorialImage}
          />
          <span style={styles.imageCaption}>
            {synthesis.imageSource === 'wikimedia'
              ? 'Photo: Wikimedia Commons (CC)'
              : 'Illustration generee par IA'}
          </span>
        </div>
      ) : templateSvg ? (
        <div style={styles.imageContainer}>
          <div
            style={styles.editorialSvg}
            dangerouslySetInnerHTML={{ __html: templateSvg }}
          />
          <span style={styles.imageCaption}>Illustration NovaPress</span>
        </div>
      ) : null}

      {/* Phase 2D: Source Images Gallery */}
      {synthesis.sourceImages && synthesis.sourceImages.length > 0 && (
        <div style={styles.sourceImagesContainer}>
          <span style={styles.sourceImagesLabel}>IMAGES DES SOURCES</span>
          <div style={styles.sourceImagesGrid}>
            {synthesis.sourceImages.slice(0, 4).map((img, i) => (
              <div key={i} style={styles.sourceImageItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.title || img.source}
                  style={styles.sourceImageThumb}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span style={styles.sourceImageCredit}>{img.source}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  badgeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  aiBadge: {
    display: 'inline-block',
    backgroundColor: sharedStyles.accentBlue,
    color: sharedStyles.bgWhite,
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    marginBottom: '24px',
  },
  updateNoticeBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    backgroundColor: '#FEF3C7',
    borderLeft: `4px solid ${sharedStyles.accentYellow}`,
    borderRadius: '0 4px 4px 0',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#92400E',
    fontWeight: '500',
  },
  updateIcon: {
    fontSize: '16px',
  },
  title: {
    fontFamily: sharedStyles.fontSerif,
    fontSize: '36px',
    fontWeight: '700',
    lineHeight: '1.2',
    color: sharedStyles.textPrimary,
    marginBottom: '12px',
  },
  byline: {
    fontStyle: 'italic',
    fontSize: '15px',
    color: sharedStyles.textSecondary,
    marginBottom: '16px',
    marginTop: '0',
  },
  personaName: {
    fontWeight: '600',
    color: sharedStyles.textPrimary,
  },
  personaType: {
    color: sharedStyles.accentBlue,
    fontWeight: '500',
  },
  metadata: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '16px',
    fontSize: '14px',
    color: sharedStyles.textSecondary,
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: `1px solid ${sharedStyles.border}`,
  },
  separator: {
    color: sharedStyles.border,
  },
  accuracyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  accuracyDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  imageContainer: {
    marginBottom: '32px',
    position: 'relative',
  },
  editorialSvg: {
    width: '100%',
    maxHeight: '450px',
    overflow: 'hidden',
    borderRadius: '2px',
  },
  editorialImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '400px',
    objectFit: 'cover' as const,
    display: 'block',
  },
  imageCaption: {
    display: 'block',
    fontSize: '11px',
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: '6px',
    textAlign: 'right' as const,
  },
  sourceImagesContainer: {
    marginBottom: '24px',
    paddingTop: '16px',
    borderTop: `1px solid ${sharedStyles.border}`,
  },
  sourceImagesLabel: {
    display: 'block',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: sharedStyles.textMuted,
    marginBottom: '10px',
  },
  sourceImagesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  sourceImageItem: {
    position: 'relative' as const,
    overflow: 'hidden',
  },
  sourceImageThumb: {
    width: '100%',
    height: '80px',
    objectFit: 'cover' as const,
    display: 'block',
    filter: 'grayscale(30%)',
  },
  sourceImageCredit: {
    display: 'block',
    fontSize: '9px',
    color: sharedStyles.textMuted,
    marginTop: '3px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export default SynthesisHeader;
