"use client";

import React, { memo } from 'react';
// Using native img tag for external images from news sources
import { Article } from '../../types/Article';
import { useTheme } from '../../contexts/ThemeContext';

interface FeaturedArticleProps {
  article: Article;
  onArticleClick: (article: Article) => void;
  onTagClick: (tagId: string) => void;
}

export const FeaturedArticle = memo(function FeaturedArticle({
  article,
  onArticleClick,
  onTagClick
}: FeaturedArticleProps) {
  const { theme } = useTheme();

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

  return (
    <article 
      style={{ 
        backgroundColor: theme.card,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${theme.border}`,
        boxShadow: `0 2px 8px ${theme.shadow}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginBottom: '32px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 6px 20px ${theme.shadow}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = `0 2px 8px ${theme.shadow}`;
      }}
      onClick={() => onArticleClick(article)}
    >
      {/* Featured Image */}
      <div style={{ position: 'relative', width: '100%', height: '400px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={article.featuredImage || `https://picsum.photos/1200/400?random=${article.id}`}
          alt={article.title}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
          loading="eager"
        />
        
        {/* Category Badge */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '600',
          textTransform: 'uppercase'
        }}>
          {article.category?.name || 'Actualité'}
        </div>

        {/* Indicators */}
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          gap: '8px'
        }}>
          {article.factCheckStatus === 'verified' && (
            <div style={{
              backgroundColor: '#000000',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              ✓ Vérifié
            </div>
          )}
          {article.trending && (
            <div style={{
              backgroundColor: '#dc2626',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 'bold'
            }}>
              🔥 Tendance
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '32px' }}>
        {/* Tags */}
        <div style={{ marginBottom: '16px' }}>
          {article.tags?.slice(0, 3).map(tag => (
            <button
              key={tag.id}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(tag.id);
              }}
              style={{
                display: 'inline-block',
                color: tag.color || '#dc2626',
                fontSize: '12px',
                marginRight: '12px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              #{tag.name}
            </button>
          ))}
        </div>

        {/* Title */}
        <h1 style={{ 
          fontSize: '36px', 
          fontWeight: '900', 
          marginBottom: '16px', 
          lineHeight: '1.2',
          color: theme.text,
          fontFamily: 'Georgia, "Times New Roman", serif'
        }}>
          {article.title}
        </h1>
        
        {/* Subtitle */}
        {article.subtitle && (
          <h2 style={{ 
            fontSize: '20px', 
            color: theme.textSecondary,
            marginBottom: '16px',
            fontStyle: 'italic',
            fontWeight: '400'
          }}>
            {article.subtitle}
          </h2>
        )}
        
        {/* Summary */}
        <p style={{ 
          fontSize: '18px', 
          lineHeight: '1.6', 
          marginBottom: '24px', 
          color: theme.textSecondary 
        }}>
          {article.summary}
        </p>

        {/* Meta Information */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '20px',
          borderTop: `1px solid ${theme.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {article.author?.avatar && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={article.author.avatar}
                alt={`Photo de profil de ${article.author.name}`}
                width={32}
                height={32}
                style={{ borderRadius: '50%' }}
              />
            )}
            <div>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '600',
                color: theme.text 
              }}>
                {article.author?.name || 'Rédaction'}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: theme.textSecondary 
              }}>
                {formatDate(article.publishedAt || article.createdAt)}
              </div>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px',
            fontSize: '12px',
            color: theme.textSecondary
          }}>
            {article.readingTime && (
              <span>📚 {article.readingTime} min de lecture</span>
            )}
            {article.viewCount && (
              <span>👁 {article.viewCount.toLocaleString('fr-FR')} vues</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});

export default FeaturedArticle;