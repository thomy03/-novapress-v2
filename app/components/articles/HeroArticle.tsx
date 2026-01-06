"use client";

import React, { memo } from 'react';
import { Article } from '../../types/Article';
import { useTheme } from '../../contexts/ThemeContext';

interface HeroArticleProps {
  article: Article;
  onArticleClick: (article: Article) => void;
}

export const HeroArticle = memo(function HeroArticle({
  article,
  onArticleClick
}: HeroArticleProps) {
  const { theme } = useTheme();

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
      style={{
        position: 'relative',
        width: '100%',
        height: '70vh',
        minHeight: '500px',
        maxHeight: '700px',
        borderRadius: '0',
        overflow: 'hidden',
        cursor: 'pointer',
        marginBottom: '48px'
      }}
      onClick={() => onArticleClick(article)}
    >
      {/* Background Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={article.featuredImage || `https://picsum.photos/1600/900?random=${article.id}`}
        alt=""
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'transform 0.5s ease'
        }}
        loading="eager"
      />

      {/* Dark Overlay - Bottom gradient only */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '70%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)',
        pointerEvents: 'none'
      }} />

      {/* Category Badge - Top Left */}
      <div style={{
        position: 'absolute',
        top: '32px',
        left: '32px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        {article.trending && (
          <span style={{
            backgroundColor: '#DC2626',
            color: 'white',
            padding: '8px 16px',
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}>
            Breaking
          </span>
        )}
        <span style={{
          backgroundColor: 'rgba(255,255,255,0.95)',
          color: '#000000',
          padding: '8px 16px',
          fontSize: '11px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          {article.category?.name || 'Actualité'}
        </span>

        {/* AI Badge */}
        {isSynthesis && (
          <span style={{
            backgroundColor: '#2563EB',
            color: 'white',
            padding: '8px 16px',
            fontSize: '11px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ fontSize: '14px' }}>⚡</span> AI Synthèse
          </span>
        )}

        {/* Timeline Badge */}
        {hasTimeline && (
          <span style={{
            backgroundColor: '#059669',
            color: 'white',
            padding: '8px 12px',
            fontSize: '10px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ fontSize: '12px' }}>📅</span> Timeline
          </span>
        )}

        {/* Causal Badge */}
        {hasCausal && (
          <span style={{
            backgroundColor: '#7C3AED',
            color: 'white',
            padding: '8px 12px',
            fontSize: '10px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ fontSize: '12px' }}>🔗</span> Causal
          </span>
        )}
      </div>

      {/* Content Overlay - Bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '48px',
        color: 'white'
      }}>
        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(28px, 4vw, 48px)',
          fontWeight: '700',
          marginBottom: '16px',
          lineHeight: '1.15',
          fontFamily: 'Georgia, "Times New Roman", serif',
          maxWidth: '900px',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          {truncate(article.title, 120)}
        </h1>

        {/* Summary - 2 lines max */}
        <p style={{
          fontSize: '18px',
          lineHeight: '1.6',
          marginBottom: '24px',
          color: 'rgba(255,255,255,0.9)',
          maxWidth: '700px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {truncate(article.summary || article.subtitle || '', 180)}
        </p>

        {/* Meta Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          fontSize: '14px',
          color: 'rgba(255,255,255,0.8)'
        }}>
          {article.author?.name && (
            <span style={{ fontWeight: '500' }}>
              {article.author.name}
            </span>
          )}
          <span>{formatDate(article.publishedAt || article.createdAt)}</span>
          {article.readingTime && (
            <span>{article.readingTime} min de lecture</span>
          )}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginLeft: 'auto',
            padding: '8px 20px',
            border: '1px solid rgba(255,255,255,0.4)',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'all 0.2s ease'
          }}>
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
