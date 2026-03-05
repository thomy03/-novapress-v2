'use client';

/**
 * HeroSynthesis - Large hero card for the main synthesis on homepage
 * Features: Editorial SVG illustration, Category badge, Georgia title, MiniNovaLine sparkline, chapo, metadata, CTA
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/app/contexts/ThemeContext';
import { MiniNovaLine } from '@/app/components/novaline/MiniNovaLine';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Minimal SVG sanitizer
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
    if (doc.querySelector('parsererror')) return '';

    function sanitizeNode(node: Element) {
      for (const child of Array.from(node.children)) {
        if (DANGEROUS_ELEMENTS.has(child.tagName.toLowerCase())) { child.remove(); continue; }
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
  } catch { return ''; }
}

// Category colors (newspaper style - same as TrendingTopics)
const CATEGORY_COLORS: Record<string, string> = {
  MONDE: '#DC2626',
  POLITIQUE: '#DC2626',
  ECONOMIE: '#F59E0B',
  TECH: '#2563EB',
  CULTURE: '#8B5CF6',
  SPORT: '#10B981',
  SCIENCES: '#06B6D4',
};

export interface SynthesisBrief {
  id: string;
  title: string;
  summary: string;
  category?: string;
  numSources: number;
  readingTime: number;
  createdAt: string;
  complianceScore?: number;
  imageUrl?: string;
}

interface HeroSynthesisProps {
  synthesis: SynthesisBrief;
}

export function HeroSynthesis({ synthesis }: HeroSynthesisProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const [editorialSvg, setEditorialSvg] = useState<string>('');

  useEffect(() => {
    if (!synthesis.id) return;
    fetch(`${API_URL}/api/syntheses/by-id/${synthesis.id}/editorial-svg`)
      .then(res => res.ok ? res.text() : '')
      .then(svg => { if (svg) setEditorialSvg(sanitizeSvg(svg)); })
      .catch(() => {});
  }, [synthesis.id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const categoryColor = CATEGORY_COLORS[synthesis.category || ''] || '#6B7280';

  return (
    <article
      onClick={() => router.push(`/synthesis/${synthesis.id}`)}
      style={{
        backgroundColor: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: '4px',
        padding: 'clamp(16px, 4vw, 32px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        cursor: 'pointer',
      }}
    >
      {/* Hero illustration: editorial SVG first, fallback to fal.ai image */}
      {editorialSvg ? (
        <div style={{
          width: '100%',
          maxHeight: '320px',
          overflow: 'hidden',
          borderRadius: '2px',
        }}>
          <div
            dangerouslySetInnerHTML={{ __html: editorialSvg }}
            style={{ width: '100%' }}
          />
        </div>
      ) : synthesis.imageUrl ? (
        <div style={{
          width: '100%',
          maxHeight: '260px',
          aspectRatio: '3 / 2',
          overflow: 'hidden',
          borderRadius: '2px',
          backgroundColor: '#F9FAFB',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={synthesis.imageUrl}
            alt={synthesis.title}
            loading="eager"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      ) : null}

      {/* Category badge */}
      {synthesis.category && (
        <span
          style={{
            alignSelf: 'flex-start',
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            padding: '6px 12px',
            borderRadius: '2px',
            backgroundColor: `${categoryColor}15`,
            color: categoryColor,
          }}
        >
          {synthesis.category}
        </span>
      )}

      {/* Title - Georgia font, large */}
      <h1
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 'clamp(22px, 5vw, 32px)',
          fontWeight: 700,
          lineHeight: 1.25,
          color: theme.text,
          margin: 0,
        }}
      >
        {synthesis.title}
      </h1>

      {/* MiniNovaLine sparkline */}
      <MiniNovaLine
        synthesisId={synthesis.id}
        category={synthesis.category || 'DEFAULT'}
        height={45}
        showLabel={true}
      />

      {/* Chapo - summary preview */}
      <p
        style={{
          fontSize: '17px',
          lineHeight: 1.7,
          color: theme.textSecondary,
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {synthesis.summary}
      </p>

      {/* Metadata row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          paddingTop: '16px',
          borderTop: `1px solid ${theme.border}`,
          fontSize: '13px',
          color: theme.textSecondary,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#2563EB' }}>&#128196;</span>
          {synthesis.numSources} sources
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#10B981' }}>&#9201;</span>
          {synthesis.readingTime} min de lecture
        </span>
        <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
          {formatDate(synthesis.createdAt)}
        </span>
      </div>

    </article>
  );
}

export default HeroSynthesis;
