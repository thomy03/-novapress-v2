'use client';

/**
 * HeroSynthesis - Large hero card for the main synthesis on homepage
 * Features: Category badge, Georgia title, MiniNovaLine sparkline, chapo, metadata, CTA
 */

import React from 'react';
import Link from 'next/link';
import { useTheme } from '@/app/contexts/ThemeContext';
import { MiniNovaLine } from '@/app/components/novaline/MiniNovaLine';

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
}

interface HeroSynthesisProps {
  synthesis: SynthesisBrief;
}

export function HeroSynthesis({ synthesis }: HeroSynthesisProps) {
  const { theme } = useTheme();

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
      style={{
        backgroundColor: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: '4px',
        padding: 'clamp(16px, 4vw, 32px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
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

      {/* CTA Button */}
      <Link
        href={`/synthesis/${synthesis.id}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          alignSelf: 'flex-start',
          padding: '14px 24px',
          backgroundColor: theme.text,
          color: theme.bg,
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
          borderRadius: '4px',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.85';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        Lire la synthèse
        <span style={{ fontSize: '16px' }}>&rarr;</span>
      </Link>
    </article>
  );
}

export default HeroSynthesis;
