"use client";

import React, { memo } from 'react';
import { Article } from '../../types/Article';
import { useTheme } from '../../contexts/ThemeContext';
import { Badge, BreakingBadge, AIBadge, CategoryBadge } from '../ui/Badge';

interface HeroArticleProps {
  article: Article;
  onArticleClick: (article: Article) => void;
}

export const HeroArticle = memo(function HeroArticle({
  article,
  onArticleClick
}: HeroArticleProps) {
  const { theme, darkMode, getGlass } = useTheme();

  // Check if article has AI features (synthesis)
  const isSynthesis = article.source?.name === 'NovaPress AI' ||
                      (article as any).complianceScore !== undefined;

  // Check for advanced AI features
  const hasTimeline = (article as any).timeline_events?.length > 0 ||
                      (article as any).narrative_arc;
  const hasCausal = (article as any).causal_graph?.edges?.length > 0 ||
                    (article as any).causal_chain?.length > 0;

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'À l\'instant';
    if (hours < 24) return `Il y a ${hours}h`;
    if (hours < 48) return 'Hier';
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Truncate text to specified length
  const truncate = (text: string, maxLength: number) => {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  };

  return (
    <article
      className="img-zoom"
      style={{
        position: 'relative',
        width: '100%',
        height: '70vh',
        minHeight: '500px',
        maxHeight: '700px',
        borderRadius: '16px',
        overflow: 'hidden',
        cursor: 'pointer',
        marginBottom: '48px',
      }}
      onClick={() => onArticleClick(article)}
    >
      {/* Background Image with zoom on hover */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={article.featuredImage || `https://picsum.photos/1600/900?random=${article.id}`}
        alt={article.title || 'Article image'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        loading="eager"
      />

      {/* Dark Overlay - Bottom gradient with glassmorphism hint */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '75%',
        background: darkMode
          ? 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, transparent 100%)'
          : 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 40%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Category Badge - Top Left with glassmorphism */}
      <div
        className="glass-subtle animate-fade-in-up"
        style={{
          position: 'absolute',
          top: '24px',
          left: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          borderRadius: '12px',
          ...getGlass(),
        }}
      >
        {article.trending && <BreakingBadge size="md" />}

        <CategoryBadge
          category={article.category?.name || 'Actualité'}
          size="md"
        />

        {/* AI Badge */}
        {isSynthesis && <AIBadge size="md" />}

        {/* Timeline Badge */}
        {hasTimeline && (
          <Badge variant="success" size="md">
            Timeline
          </Badge>
        )}

        {/* Causal Badge */}
        {hasCausal && (
          <Badge
            size="md"
            style={{
              backgroundColor: theme.brand.accent,
              color: '#FFFFFF',
            }}
          >
            Causal
          </Badge>
        )}
      </div>

      {/* Content Overlay - Bottom with animations */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '48px',
        color: 'white',
      }}>
        {/* Title with kinetic reveal animation */}
        <h1
          className="animate-title-reveal"
          style={{
            fontSize: 'clamp(32px, 4.5vw, 52px)',
            fontWeight: 800,
            marginBottom: '18px',
            lineHeight: 1.1,
            fontFamily: 'var(--font-serif)',
            maxWidth: '900px',
            textShadow: '0 4px 20px rgba(0,0,0,0.4)',
            letterSpacing: '-0.02em',
          }}
        >
          {truncate(article.title, 120)}
        </h1>

        {/* Summary - 2 lines max with fade animation */}
        <p
          className="animate-fade-in-up"
          style={{
            fontSize: '18px',
            lineHeight: 1.65,
            marginBottom: '28px',
            color: 'rgba(255,255,255,0.9)',
            maxWidth: '750px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            animationDelay: '0.2s',
          }}
        >
          {truncate(article.summary || article.subtitle || '', 180)}
        </p>

        {/* Meta Row with glassmorphism CTA */}
        <div
          className="animate-fade-in-up"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.8)',
            animationDelay: '0.3s',
          }}
        >
          {article.author?.name && (
            <span style={{ fontWeight: 500 }}>
              {article.author.name}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
            {formatDate(article.publishedAt || article.createdAt)}
          </span>
          {article.readingTime && (
            <span>{article.readingTime} min de lecture</span>
          )}
          <span
            className="btn-hover-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginLeft: 'auto',
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all 200ms ease',
            }}
          >
            Lire l'article
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </span>
        </div>
      </div>
    </article>
  );
});

export default HeroArticle;
