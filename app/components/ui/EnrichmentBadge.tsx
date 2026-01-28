'use client';

import React from 'react';
import { EnrichmentData } from '@/app/types/api';

interface EnrichmentBadgeProps {
  enrichment?: EnrichmentData;
  compact?: boolean;
}

export default function EnrichmentBadge({ enrichment, compact = false }: EnrichmentBadgeProps) {
  if (!enrichment) return null;

  const { isEnriched, perplexity, grok, factCheck } = enrichment;

  if (!isEnriched) {
    return compact ? null : (
      <span style={styles.notEnriched}>
        Non enrichi
      </span>
    );
  }

  return (
    <div style={compact ? styles.compactContainer : styles.container}>
      {perplexity.enabled && (
        <span style={styles.perplexityBadge} title="Enrichi avec des sources web supplementaires via Perplexity AI">
          {compact ? '🔍' : '🔍 Recherche web temps reel'}
        </span>
      )}
      {grok.enabled && (
        <span style={styles.grokBadge} title={`Analyse des reactions sur les reseaux sociaux (X/Twitter)`}>
          {compact ? '🐦' : `🐦 Reseaux sociaux: ${formatSentiment(grok.sentiment)}`}
        </span>
      )}
      {factCheck.count > 0 && (
        <span style={styles.factCheckBadge} title={`${factCheck.count} fait(s) verifie(s) via sources externes`}>
          {compact ? '✓' : `✓ ${factCheck.count} fait${factCheck.count > 1 ? 's' : ''} verifie${factCheck.count > 1 ? 's' : ''}`}
        </span>
      )}
    </div>
  );
}

function formatSentiment(sentiment: string): string {
  const map: Record<string, string> = {
    'positive': 'Positif',
    'negative': 'Negatif',
    'neutral': 'Neutre',
    'mixed': 'Mixte',
    'unknown': 'N/A',
    '': 'N/A',
  };
  return map[sentiment] || sentiment;
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
  },
  compactContainer: {
    display: 'inline-flex',
    gap: '4px',
    alignItems: 'center',
  },
  perplexityBadge: {
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  grokBadge: {
    backgroundColor: '#F0FDF4',
    color: '#166534',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  factCheckBadge: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  notEnriched: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '11px',
  },
};
