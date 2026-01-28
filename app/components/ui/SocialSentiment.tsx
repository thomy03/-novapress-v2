'use client';

import React from 'react';
import { GrokEnrichment } from '@/app/types/api';

interface SocialSentimentProps {
  grok: GrokEnrichment;
}

export default function SocialSentiment({ grok }: SocialSentimentProps) {
  if (!grok.enabled) return null;

  const sentimentConfig = getSentimentConfig(grok.sentiment);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={{ fontSize: '18px' }}>🐦</span>
        <h3 style={styles.title}>Reaction sociale (X/Twitter)</h3>
      </div>

      {/* Sentiment Indicator */}
      <div style={styles.sentimentRow}>
        <span style={styles.sentimentLabel}>Sentiment general:</span>
        <span style={{
          ...styles.sentimentBadge,
          backgroundColor: sentimentConfig.bg,
          color: sentimentConfig.color,
        }}>
          {sentimentConfig.icon} {sentimentConfig.label}
        </span>
      </div>

      {/* Context */}
      {grok.context && (
        <p style={styles.context}>
          {grok.context}
        </p>
      )}

      {/* Trending Reactions */}
      {grok.trendingReactions && grok.trendingReactions.length > 0 && (
        <div style={styles.reactions}>
          <span style={styles.reactionsLabel}>Reactions tendance:</span>
          <div style={styles.reactionsList}>
            {grok.trendingReactions.map((reaction, i) => (
              <span key={i} style={styles.reactionTag}>
                {reaction}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getSentimentConfig(sentiment: string) {
  switch (sentiment) {
    case 'positive':
      return { icon: '👍', label: 'Positif', bg: '#DCFCE7', color: '#166534' };
    case 'negative':
      return { icon: '👎', label: 'Negatif', bg: '#FEE2E2', color: '#991B1B' };
    case 'neutral':
      return { icon: '😐', label: 'Neutre', bg: '#F3F4F6', color: '#374151' };
    case 'mixed':
      return { icon: '🤔', label: 'Mixte', bg: '#FEF3C7', color: '#92400E' };
    default:
      return { icon: '❓', label: 'Inconnu', bg: '#F3F4F6', color: '#6B7280' };
  }
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#F0F9FF',
    border: '1px solid #BAE6FD',
    borderRadius: '8px',
    padding: '20px',
    marginTop: '24px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#0369A1',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: 0,
  },
  sentimentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  sentimentLabel: {
    fontSize: '13px',
    color: '#6B7280',
  },
  sentimentBadge: {
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '13px',
    fontWeight: '600',
  },
  context: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#374151',
    margin: '12px 0',
    fontStyle: 'italic',
  },
  reactions: {
    marginTop: '16px',
  },
  reactionsLabel: {
    fontSize: '12px',
    color: '#6B7280',
    display: 'block',
    marginBottom: '8px',
  },
  reactionsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  reactionTag: {
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
  },
};
