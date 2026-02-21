"use client";

import React, { memo } from 'react';
import { Article } from '../../types/Article';
import { useTheme } from '../../contexts/ThemeContext';
import { AIBadge, CategoryBadge, Badge } from '../ui/Badge';

interface CompactArticleCardProps {
  article: Article;
  onArticleClick: (article: Article) => void;
  showImage?: boolean;
}

export const CompactArticleCard = memo(function CompactArticleCard({
  article,
  onArticleClick,
  showImage = true
}: CompactArticleCardProps) {
  const { theme } = useTheme();

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'À l\'instant';
    if (hours < 24) return `${hours}h`;
    if (hours < 48) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // Get source name from source object or author
  const getSourceName = () => {
    if (article.source?.name) return article.source.name;
    if (article.source?.url) {
      try {
        const url = new URL(article.source.url);
        return url.hostname.replace('www.', '');
      } catch {
        return 'Source';
      }
    }
    if (article.author?.name) return article.author.name;
    return 'NovaPress';
  };

  // Check if article has AI features
  const isSynthesis = article.source?.name === 'NovaPress AI' ||
                      article.complianceScore !== undefined;

  // Check for advanced AI features
  const hasTimeline = (article.timeline_events?.length ?? 0) > 0 ||
                      !!article.narrative_arc;
  const hasCausal = (article.causal_graph?.edges?.length ?? 0) > 0 ||
                    (article.causal_chain?.length ?? 0) > 0;

  return (
    <article
      className="card-interactive"
      style={{
        backgroundColor: theme.card,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '12px',
        border: `1px solid ${theme.border}`,
      }}
      onClick={() => onArticleClick(article)}
    >
      {/* Image with zoom on hover */}
      <div
        className="img-zoom"
        style={{
          width: '100%',
          height: '160px',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: theme.bgSecondary,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={article.featuredImage || `https://picsum.photos/400/300?random=${article.id}`}
          alt={article.title || 'Article image'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          loading="lazy"
        />

        {/* Top badges */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
        }}>
          {/* Category */}
          {article.trending ? (
            <Badge variant="breaking" size="sm">
              {article.category?.name || 'Breaking'}
            </Badge>
          ) : (
            <CategoryBadge category={article.category?.name || 'Actualité'} size="sm" />
          )}

          {/* AI Badge */}
          {isSynthesis && <AIBadge size="sm" />}

          {/* Timeline Badge */}
          {hasTimeline && (
            <Badge variant="success" size="sm">
              Timeline
            </Badge>
          )}

          {/* Causal Badge */}
          {hasCausal && (
            <Badge
              size="sm"
              style={{
                backgroundColor: theme.brand.accent,
                color: '#FFFFFF',
              }}
            >
              Causal
            </Badge>
          )}
        </div>

        {/* Reading time */}
        <div
          className="glass-subtle"
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            fontSize: '10px',
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: '6px',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {article.readingTime || 3} min
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
      }}>
        {/* Title */}
        <h3 style={{
          fontSize: '16px',
          fontWeight: 600,
          lineHeight: 1.4,
          color: theme.text,
          fontFamily: 'var(--font-serif)',
          margin: 0,
          marginBottom: '14px',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1,
        }}>
          {article.title}
        </h3>

        {/* Bottom meta */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: theme.textSecondary,
          borderTop: `1px solid ${theme.border}`,
          paddingTop: '12px',
          marginTop: 'auto',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isSynthesis ? theme.brand.secondary : theme.success,
            }} />
            <span style={{
              maxWidth: '100px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {getSourceName()}
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {formatDate(article.publishedAt || article.createdAt)}
          </span>
        </div>
      </div>

      {/* Accent line reveal on hover */}
      <div
        className="accent-line-reveal"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: isSynthesis
            ? `linear-gradient(90deg, ${theme.brand.secondary}, ${theme.brand.accent})`
            : theme.brand.primary,
        }}
      />
    </article>
  );
});

export default CompactArticleCard;
