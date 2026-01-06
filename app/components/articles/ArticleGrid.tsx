"use client";

import React, { memo, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useArticles } from '../../contexts/ArticlesContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { useIsMobile, useIsTablet } from '../../hooks/useMediaQuery';
import SkeletonCard from '../SkeletonCard';
import LoadingSpinner from '../LoadingSpinner';

// Lazy load new components
const HeroArticle = dynamic(() => import('./HeroArticle'), {
  loading: () => <SkeletonCard darkMode={false} variant="featured" />,
  ssr: true
});

const SecondaryArticleRow = dynamic(() => import('./SecondaryArticleRow'), {
  loading: () => <div style={{ height: '150px' }} />,
  ssr: true
});

const CompactArticleCard = dynamic(() => import('./CompactArticleCard'), {
  loading: () => <SkeletonCard darkMode={false} variant="default" />,
  ssr: true
});

// Legacy ArticleCard for filtered views
const ArticleCard = dynamic(() => import('../ArticleCard'), {
  loading: () => <SkeletonCard darkMode={false} variant="default" />,
  ssr: true
});

export const ArticleGrid = memo(function ArticleGrid() {
  const { state, loadMoreArticles, handleArticleClick, toggleTag } = useArticles();
  const { theme, darkMode } = useTheme();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // Setup infinite scroll
  const { loadingRef } = useInfiniteScroll({
    hasNextPage: state.hasMore,
    isFetching: state.isLoading,
    fetchNextPage: loadMoreArticles,
    threshold: 100
  });

  // Responsive grid columns for compact cards - 3 columns on desktop for larger cards
  const gridColumns = useMemo(() => {
    if (isMobile) return 'repeat(1, 1fr)';
    if (isTablet) return 'repeat(2, 1fr)';
    return 'repeat(3, 1fr)';
  }, [isMobile, isTablet]);

  // Show featured layout only on home page with no filters
  const showFeaturedLayout = useMemo(() => {
    return state.selectedCategory === 'ACCUEIL' &&
           state.selectedTags.length === 0 &&
           !state.searchQuery;
  }, [state.selectedCategory, state.selectedTags.length, state.searchQuery]);

  // Empty state
  if (state.filteredArticles.length === 0) {
    return (
      <div style={{
        gridColumn: '1 / -1',
        textAlign: 'center',
        padding: '80px 20px',
        backgroundColor: theme.bgSecondary,
        border: `1px solid ${theme.border}`
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: theme.textSecondary,
          marginBottom: '16px'
        }}>
          Aucun résultat
        </div>
        <h3 style={{
          fontSize: '24px',
          fontWeight: '600',
          marginBottom: '12px',
          color: theme.text,
          fontFamily: 'Georgia, "Times New Roman", serif'
        }}>
          Aucun article trouvé
        </h3>
        <p style={{
          fontSize: '15px',
          color: theme.textSecondary,
          maxWidth: '400px',
          margin: '0 auto'
        }}>
          Essayez de modifier vos critères de recherche ou sélectionnez d'autres filtres
        </p>
      </div>
    );
  }

  // Featured layout (Home page, no filters)
  if (showFeaturedLayout) {
    const heroArticle = state.filteredArticles[0];
    const secondaryArticles = state.filteredArticles.slice(1, 3);
    const gridArticles = state.filteredArticles.slice(3, state.articlesLoaded + 3);

    return (
      <>
        {/* Section Title */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
          paddingBottom: '16px',
          borderBottom: `2px solid ${theme.text}`
        }}>
          <h2 style={{
            fontSize: '13px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: theme.text,
            margin: 0
          }}>
            À la une
          </h2>
          <span style={{
            fontSize: '12px',
            color: theme.textSecondary
          }}>
            {state.filteredArticles.length} articles
          </span>
        </div>

        {/* Hero Article */}
        {heroArticle && (
          <HeroArticle
            article={heroArticle}
            onArticleClick={handleArticleClick}
          />
        )}

        {/* Secondary Articles Row */}
        {secondaryArticles.length > 0 && (
          <SecondaryArticleRow
            articles={secondaryArticles}
            onArticleClick={handleArticleClick}
          />
        )}

        {/* Section divider */}
        {gridArticles.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            paddingBottom: '12px',
            borderBottom: `1px solid ${theme.border}`
          }}>
            <h2 style={{
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: theme.textSecondary,
              margin: 0
            }}>
              Plus d'actualités
            </h2>
          </div>
        )}

        {/* Compact Article Grid - Modern layout with proper spacing */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: gridColumns,
          gap: '24px',
          marginBottom: '48px'
        }}>
          {gridArticles.map((article) => (
            <CompactArticleCard
              key={article.id}
              article={article}
              onArticleClick={handleArticleClick}
            />
          ))}
        </div>

        {/* Infinite Scroll Loading Indicator */}
        <div ref={loadingRef} style={{ height: '1px' }} />

        {state.isLoading && (
          <div
            role="status"
            aria-live="polite"
            aria-label="Chargement en cours"
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '40px'
            }}>
            <LoadingSpinner
              darkMode={darkMode}
              size="medium"
              text="Chargement..."
            />
          </div>
        )}

        {/* End of Content */}
        {!state.hasMore && state.filteredArticles.length > 3 && (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            borderTop: `1px solid ${theme.border}`
          }}>
            <p style={{
              fontSize: '14px',
              color: theme.textSecondary,
              marginBottom: '16px'
            }}>
              Vous avez parcouru tous les articles
            </p>
            <button
              style={{
                padding: '12px 32px',
                backgroundColor: 'transparent',
                color: theme.text,
                border: `1px solid ${theme.text}`,
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.text;
                e.currentTarget.style.color = theme.card;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.text;
              }}
            >
              Retour en haut
            </button>
          </div>
        )}
      </>
    );
  }

  // Filtered view (search, category, tags) - use legacy cards
  return (
    <>
      {/* Filter results header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: `1px solid ${theme.border}`
      }}>
        <h2 style={{
          fontSize: '12px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: theme.textSecondary,
          margin: 0
        }}>
          {state.searchQuery ? `Résultats pour "${state.searchQuery}"` :
           state.selectedCategory !== 'ACCUEIL' ? state.selectedCategory :
           'Articles filtrés'}
        </h2>
        <span style={{
          fontSize: '12px',
          color: theme.textSecondary
        }}>
          {state.filteredArticles.length} article{state.filteredArticles.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Standard Grid with legacy ArticleCard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
        gap: '24px'
      }}>
        {state.filteredArticles
          .slice(0, state.articlesLoaded)
          .map((article, index) => (
            <div
              key={article.id}
              style={{
                animation: 'fadeIn 0.4s ease-out',
                animationDelay: `${index * 0.05}s`,
                animationFillMode: 'both'
              }}
            >
              <ArticleCard
                article={article}
                darkMode={darkMode}
                onTagClick={toggleTag}
                onArticleClick={handleArticleClick}
              />
            </div>
          ))
        }
      </div>

      {/* Infinite Scroll Loading Indicator */}
      <div ref={loadingRef} style={{ height: '1px' }} />

      {state.isLoading && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '40px'
          }}>
          <LoadingSpinner
            darkMode={darkMode}
            size="medium"
            text="Chargement..."
          />
        </div>
      )}

      {/* End of Content */}
      {!state.hasMore && state.filteredArticles.length > 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          marginTop: '32px'
        }}>
          <button
            style={{
              padding: '10px 24px',
              backgroundColor: theme.text,
              color: theme.card,
              border: 'none',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Retour en haut
          </button>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
});
