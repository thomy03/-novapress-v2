"use client";

import { memo } from 'react';
import Image from 'next/image';
import { Article } from '../types/Article';

interface ArticleCardProps {
  article: Article;
  darkMode?: boolean;
  onTagClick?: (tagId: string) => void;
  onArticleClick?: (article: Article) => void;
}

const ArticleCard = memo(function ArticleCard({ 
  article, 
  darkMode = false,
  onTagClick,
  onArticleClick 
}: ArticleCardProps) {
  const theme = {
    bg: darkMode ? '#141414' : '#ffffff',
    text: darkMode ? '#e5e5e5' : '#000000',
    textSecondary: darkMode ? '#a3a3a3' : '#6b7280',
    border: darkMode ? '#333333' : '#e5e7eb',
    shadow: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)',
  };

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

  const getSentimentColor = (sentiment?: Article['sentiment']) => {
    switch(sentiment) {
      case 'positive': return '#000000';
      case 'negative': return '#ef4444';
      case 'mixed': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <article 
      style={{ 
        backgroundColor: theme.bg,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: `0 2px 10px ${theme.shadow}`,
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        border: `1px solid ${theme.border}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={() => onArticleClick?.(article)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-5px)';
        e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = `0 2px 10px ${theme.shadow}`;
      }}
    >
      {/* Image avec badges */}
      <div style={{ position: 'relative', height: '200px', overflow: 'hidden' }}>
        <Image 
          src={article.featuredImage || `https://picsum.photos/400/200?random=${article.id}`} 
          alt={article.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          style={{ 
            objectFit: 'cover',
          }}
          loading="lazy"
        />
        
        {/* Catégorie */}
        <div style={{ 
          position: 'absolute', 
          top: '10px', 
          left: '10px', 
          backgroundColor: article.category.icon ? '#4f46e5' : '#059669', 
          color: 'white', 
          padding: '4px 12px', 
          borderRadius: '15px',
          fontSize: '11px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {article.category.icon} {article.category.name}
        </div>

        {/* Indicateurs */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          display: 'flex',
          gap: '6px'
        }}>
          {article.factCheckStatus === 'verified' && (
            <div style={{
              backgroundColor: '#000000',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: 'bold'
            }}>
              ✓ Vérifié
            </div>
          )}
          {article.trending && (
            <div style={{
              backgroundColor: '#dc2626',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '10px',
              fontSize: '10px',
              fontWeight: 'bold'
            }}>
              🔥 Tendance
            </div>
          )}
        </div>
      </div>

      {/* Contenu */}
      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          marginBottom: '10px', 
          lineHeight: '1.3', 
          color: theme.text,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {article.title}
        </h3>
        
        {article.subtitle && (
          <p style={{ 
            fontSize: '14px', 
            color: theme.textSecondary, 
            marginBottom: '10px',
            fontStyle: 'italic' 
          }}>
            {article.subtitle}
          </p>
        )}
        
        <p style={{ 
          fontSize: '14px', 
          color: theme.textSecondary, 
          marginBottom: '15px', 
          lineHeight: '1.5',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1
        }}>
          {article.summary}
        </p>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '6px',
            marginBottom: '12px' 
          }}>
            {article.tags.slice(0, 3).map(tag => (
              <button
                key={tag.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(tag.id);
                }}
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '500',
                  border: `1px solid ${tag.color || '#dc2626'}`,
                  backgroundColor: (tag.color || '#dc2626') + '15',
                  color: tag.color || '#dc2626',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = (tag.color || '#dc2626') + '30';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = (tag.color || '#dc2626') + '15';
                }}
              >
                #{tag.name}
              </button>
            ))}
            {article.tags.length > 3 && (
              <span style={{
                padding: '3px 10px',
                fontSize: '11px',
                color: theme.textSecondary
              }}>
                +{article.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Métadonnées */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          fontSize: '12px',
          color: theme.textSecondary,
          borderTop: `1px solid ${theme.border}`,
          paddingTop: '12px',
          marginTop: 'auto'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {article.author && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {article.author.avatar && (
                  <Image 
                    src={article.author.avatar} 
                    alt={article.author.name}
                    width={20}
                    height={20}
                    style={{ 
                      borderRadius: '50%' 
                    }}
                  />
                )}
                {article.author.name}
              </span>
            )}
            <span>{formatDate(article.publishedAt || article.createdAt)}</span>
            {article.readingTime && (
              <span aria-label={`Temps de lecture: ${article.readingTime} minutes`}>
                <span role="img" aria-hidden="true">📖</span> {article.readingTime} min
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {article.sentiment && (
              <div 
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getSentimentColor(article.sentiment)
                }}
                title={article.sentiment}
              />
            )}
            {article.viewCount && (
              <span>👁 {article.viewCount.toLocaleString('fr-FR')}</span>
            )}
            {article.shareCount && (
              <span>🔗 {article.shareCount}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});

export default ArticleCard;