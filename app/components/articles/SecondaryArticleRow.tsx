"use client";

import React, { memo, useState } from 'react';
import { Article } from '../../types/Article';
import { useTheme } from '../../contexts/ThemeContext';

interface SecondaryArticleRowProps {
  articles: Article[];
  onArticleClick: (article: Article) => void;
}

// Individual secondary article card - REDESIGNED for larger, more modern look
const SecondaryCard = memo(function SecondaryCard({
  article,
  onArticleClick,
  theme
}: {
  article: Article;
  onArticleClick: (article: Article) => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const [isHovered, setIsHovered] = useState(false);

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'À l\'instant';
    if (hours < 24) return `Il y a ${hours}h`;
    if (hours < 48) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // Check if article has AI features (synthesis)
  const isSynthesis = article.source?.name === 'NovaPress AI' ||
                      (article as any).complianceScore !== undefined;

  // Check for advanced AI features
  const hasTimeline = (article as any).timeline_events?.length > 0 ||
                      (article as any).narrative_arc;
  const hasCausal = (article as any).causal_graph?.edges?.length > 0 ||
                    (article as any).causal_chain?.length > 0;

  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.card,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        transform: isHovered ? 'translateY(-4px)' : 'none',
        boxShadow: isHovered ? '0 12px 40px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}
      onClick={() => onArticleClick(article)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image - Larger and prominent */}
      <div style={{
        width: '100%',
        height: '200px',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: theme.border
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={article.featuredImage || `https://picsum.photos/600/400?random=${article.id}`}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.5s ease',
            transform: isHovered ? 'scale(1.05)' : 'scale(1)'
          }}
          loading="lazy"
        />
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '80px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
          pointerEvents: 'none'
        }} />

        {/* Category badge on image */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <span style={{
            backgroundColor: article.trending ? '#DC2626' : '#000000',
            color: '#FFFFFF',
            fontSize: '10px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '6px 12px'
          }}>
            {article.category?.name || 'Actualité'}
          </span>

          {/* AI Badge */}
          {isSynthesis && (
            <span style={{
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: '10px',
              fontWeight: '700',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ fontSize: '12px' }}>⚡</span> AI
            </span>
          )}

          {/* Timeline Badge */}
          {hasTimeline && (
            <span style={{
              backgroundColor: '#059669',
              color: '#FFFFFF',
              fontSize: '10px',
              fontWeight: '700',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ fontSize: '12px' }}>📅</span>
            </span>
          )}

          {/* Causal Badge */}
          {hasCausal && (
            <span style={{
              backgroundColor: '#7C3AED',
              color: '#FFFFFF',
              fontSize: '10px',
              fontWeight: '700',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ fontSize: '12px' }}>🔗</span>
            </span>
          )}
        </div>

        {/* Reading time on image */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          backgroundColor: 'rgba(255,255,255,0.95)',
          color: '#000000',
          fontSize: '11px',
          fontWeight: '600',
          padding: '4px 10px'
        }}>
          {article.readingTime || 3} min
        </div>
      </div>

      {/* Content - More spacious */}
      <div style={{
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1
      }}>
        {/* Title - Larger */}
        <h3 style={{
          fontSize: '20px',
          fontWeight: '700',
          lineHeight: '1.35',
          color: theme.text,
          fontFamily: 'Georgia, "Times New Roman", serif',
          margin: 0,
          marginBottom: '16px',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {article.title}
        </h3>

        {/* Summary preview */}
        {article.summary && (
          <p style={{
            fontSize: '14px',
            lineHeight: '1.6',
            color: theme.textSecondary,
            margin: 0,
            marginBottom: '16px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            flex: 1
          }}>
            {article.summary}
          </p>
        )}

        {/* Meta row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '16px',
          borderTop: `1px solid ${theme.border}`,
          marginTop: 'auto'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {/* Source indicator */}
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isSynthesis ? '#2563EB' : '#10B981'
            }} />
            <span style={{
              fontSize: '12px',
              color: theme.textSecondary,
              fontWeight: '500'
            }}>
              {article.source?.name || 'NovaPress'}
            </span>
          </div>

          <span style={{
            fontSize: '12px',
            color: theme.textSecondary
          }}>
            {formatDate(article.publishedAt || article.createdAt)}
          </span>
        </div>
      </div>

      {/* Hover accent line */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '3px',
        backgroundColor: '#2563EB',
        transform: isHovered ? 'scaleX(1)' : 'scaleX(0)',
        transformOrigin: 'left',
        transition: 'transform 0.3s ease'
      }} />
    </article>
  );
});

export const SecondaryArticleRow = memo(function SecondaryArticleRow({
  articles,
  onArticleClick
}: SecondaryArticleRowProps) {
  const { theme } = useTheme();

  if (articles.length === 0) return null;

  return (
    <section style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '24px',
      marginBottom: '48px'
    }}>
      {articles.slice(0, 2).map((article) => (
        <SecondaryCard
          key={article.id}
          article={article}
          onArticleClick={onArticleClick}
          theme={theme}
        />
      ))}
    </section>
  );
});

export default SecondaryArticleRow;
