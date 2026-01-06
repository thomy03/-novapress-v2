"use client";

import React, { memo, useState } from 'react';
import { Article } from '../../types/Article';
import { useTheme } from '../../contexts/ThemeContext';

interface CompactArticleCardProps {
  article: Article;
  onArticleClick: (article: Article) => void;
  showImage?: boolean;
}

export const CompactArticleCard = memo(function CompactArticleCard({
  article,
  onArticleClick,
  showImage = true // Now default to true for always visible images
}: CompactArticleCardProps) {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

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
                      (article as any).complianceScore !== undefined;

  // Check for advanced AI features
  const hasTimeline = (article as any).timeline_events?.length > 0 ||
                      (article as any).narrative_arc;
  const hasCausal = (article as any).causal_graph?.edges?.length > 0 ||
                    (article as any).causal_chain?.length > 0;

  return (
    <article
      style={{
        backgroundColor: theme.card,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        transform: isHovered ? 'translateY(-4px)' : 'none',
        boxShadow: isHovered ? '0 12px 40px rgba(0,0,0,0.1)' : 'none'
      }}
      onClick={() => onArticleClick(article)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image - Always visible now */}
      <div style={{
        width: '100%',
        height: '160px',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: theme.border
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={article.featuredImage || `https://picsum.photos/400/300?random=${article.id}`}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.5s ease',
            transform: isHovered ? 'scale(1.08)' : 'scale(1)'
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
          flexWrap: 'wrap'
        }}>
          {/* Category */}
          <span style={{
            backgroundColor: article.trending ? '#DC2626' : 'rgba(0,0,0,0.8)',
            color: '#FFFFFF',
            fontSize: '9px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '4px 8px'
          }}>
            {article.category?.name || 'Actualité'}
          </span>

          {/* AI Badge */}
          {isSynthesis && (
            <span style={{
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: '9px',
              fontWeight: '700',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              ⚡ AI
            </span>
          )}

          {/* Timeline Badge */}
          {hasTimeline && (
            <span style={{
              backgroundColor: '#059669',
              color: '#FFFFFF',
              fontSize: '9px',
              fontWeight: '700',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              📅
            </span>
          )}

          {/* Causal Badge */}
          {hasCausal && (
            <span style={{
              backgroundColor: '#7C3AED',
              color: '#FFFFFF',
              fontSize: '9px',
              fontWeight: '700',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              🔗
            </span>
          )}
        </div>

        {/* Reading time */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          backgroundColor: 'rgba(255,255,255,0.95)',
          color: '#000',
          fontSize: '10px',
          fontWeight: '600',
          padding: '3px 8px'
        }}>
          {article.readingTime || 3} min
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1
      }}>
        {/* Title */}
        <h3 style={{
          fontSize: '16px',
          fontWeight: '600',
          lineHeight: '1.4',
          color: theme.text,
          fontFamily: 'Georgia, "Times New Roman", serif',
          margin: 0,
          marginBottom: '12px',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1
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
          marginTop: 'auto'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isSynthesis ? '#2563EB' : '#10B981'
            }} />
            <span style={{
              maxWidth: '100px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {getSourceName()}
            </span>
          </div>
          <span>{formatDate(article.publishedAt || article.createdAt)}</span>
        </div>
      </div>

      {/* Hover indicator line */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '3px',
        backgroundColor: isSynthesis ? '#2563EB' : '#000000',
        transform: isHovered ? 'scaleX(1)' : 'scaleX(0)',
        transformOrigin: 'left',
        transition: 'transform 0.3s ease'
      }} />
    </article>
  );
});

export default CompactArticleCard;
