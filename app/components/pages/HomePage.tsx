"use client";

/**
 * HomePage - Main landing page with Bento Grid layout
 * Features: StatusBar, Hero 60/40 layout, TrendingTopics sidebar, Synthesis cards
 * Supports infinite scroll for loading more syntheses
 * Design: Modern UX 2025-2026 with glassmorphism, animations, dark mode
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import { useArticles } from '../../contexts/ArticlesContext';
import { Header } from '../layout/Header';
import { StatusBar } from '../layout/StatusBar';
import { NewsTicker } from '../layout/NewsTicker';
import { DossiersBar } from '../layout/DossiersBar';
import { Footer } from '../layout/Footer';
import { OfflineNotification } from '../ui/OfflineNotification';
import { TrendingTopics } from '../trending';
import { HeroSynthesis, SynthesisBrief } from '../articles/HeroSynthesis';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { SkeletonCard, SkeletonHero } from '../ui/Skeleton';
import { Badge, CategoryBadge, AIBadge } from '../ui/Badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const PAGE_SIZE = 10;

// Compact card for category grids — newspaper-strict style
function CompactCard({ synthesis: s, theme, formatDate }: {
  synthesis: SynthesisBrief;
  theme: Record<string, any>;
  formatDate: (d: string) => string;
}) {
  return (
    <Link href={`/synthesis/${s.id}`} style={{ textDecoration: 'none' }}>
      <article
        className="card-hover-lift"
        style={{
          height: '100%',
          backgroundColor: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Thumbnail */}
        {s.imageUrl && (
          <div style={{
            width: '100%',
            height: '120px',
            overflow: 'hidden',
            backgroundColor: '#F9FAFB',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.imageUrl}
              alt=""
              loading="lazy"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Card content with padding */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Title — 2 lines max */}
          <h3 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '15px',
            fontWeight: 600,
            lineHeight: 1.35,
            color: theme.text,
            margin: 0,
            marginBottom: '8px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {s.title}
          </h3>

          {/* Summary — 2 lines max */}
          <p style={{
            fontSize: '13px',
            lineHeight: 1.5,
            color: theme.textSecondary,
            margin: 0,
            marginBottom: '12px',
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {s.summary}
          </p>

          {/* Meta footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: theme.textSecondary,
            borderTop: `1px solid ${theme.border}`,
            paddingTop: '8px',
            marginTop: 'auto',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{s.numSources} sources</span>
            <span>{formatDate(s.createdAt)}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

// Loading spinner for infinite scroll
function LoadingSpinner({ theme }: { theme: Record<string, any> }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      color: theme.textSecondary,
      fontSize: '14px',
      fontWeight: 500,
    }}>
      <div
        className="animate-spin"
        style={{
          width: '24px',
          height: '24px',
          border: `2px solid ${theme.border}`,
          borderTopColor: theme.brand?.secondary || '#2563EB',
          borderRadius: '50%',
        }}
      />
      Chargement des synthèses...
    </div>
  );
}

function MainContent() {
  const { theme } = useTheme();
  const { state: articlesState } = useArticles();
  const [mounted, setMounted] = useState(false);
  const [syntheses, setSyntheses] = useState<SynthesisBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  // Category comes from ArticlesContext (set by Header Navigation)
  const selectedCategory = articlesState.selectedCategory;
  const apiCategory = selectedCategory && selectedCategory !== 'ACCUEIL' ? selectedCategory : null;

  // Fetch syntheses with pagination
  const fetchSyntheses = useCallback(async (currentOffset: number, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const categoryParam = apiCategory ? `&category=${apiCategory}` : '';
      const res = await fetch(
        `${API_URL}/api/syntheses/live?hours=168&limit=${PAGE_SIZE}&offset=${currentOffset}${categoryParam}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        const newSyntheses = data.data || [];

        if (append) {
          setSyntheses(prev => [...prev, ...newSyntheses]);
        } else {
          setSyntheses(newSyntheses);
        }

        setHasMore(data.hasMore || false);
        setOffset(data.nextOffset || currentOffset + PAGE_SIZE);
      }
    } catch (err) {
      console.error('Failed to fetch syntheses:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [apiCategory]);

  // Mount + initial fetch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Re-fetch when category changes (from Header Navigation or MobileHeader)
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchSyntheses(0, false);
  }, [fetchSyntheses]);

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchSyntheses(offset, true);
    }
  }, [offset, loadingMore, hasMore, fetchSyntheses]);

  // Infinite scroll hook
  const { loadingRef } = useInfiniteScroll({
    hasNextPage: hasMore,
    isFetching: loadingMore,
    fetchNextPage: loadMore,
  });

  // Sort by complianceScore (best first), then by date
  const sortedSyntheses = [...syntheses].sort((a, b) => {
    const scoreDiff = (b.complianceScore ?? 0) - (a.complianceScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (!mounted || loading) {
    return (
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Hero Skeleton */}
        <section className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-12">
          <SkeletonHero height="400px" />
          <div className="flex flex-col gap-4">
            <SkeletonCard hasImage={false} lines={3} />
            <SkeletonCard hasImage={false} lines={3} />
          </div>
        </section>
        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <SkeletonCard key={i} hasImage={false} lines={4} />
          ))}
        </div>
      </main>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Split into sections (non-hook derived values, safe after early return)
  const heroSynthesis = sortedSyntheses[0];
  const secondarySyntheses = sortedSyntheses.slice(1, 3);
  const restSyntheses = sortedSyntheses.slice(3);

  // Group remaining syntheses by category (for ACCUEIL view)
  const CATEGORY_ORDER = ['MONDE', 'TECH', 'ECONOMIE', 'POLITIQUE', 'CULTURE', 'SPORT', 'SCIENCES'];
  const CATEGORY_COLORS: Record<string, string> = {
    MONDE: '#DC2626',
    POLITIQUE: '#DC2626',
    ECONOMIE: '#F59E0B',
    TECH: '#2563EB',
    CULTURE: '#8B5CF6',
    SPORT: '#10B981',
    SCIENCES: '#06B6D4',
  };
  const MAX_PER_CATEGORY = 6;

  const categoryGroups: Record<string, SynthesisBrief[]> = {};
  if (!apiCategory) {
    // ACCUEIL: group by category
    for (const s of restSyntheses) {
      const cat = s.category || 'AUTRES';
      if (!categoryGroups[cat]) categoryGroups[cat] = [];
      if (categoryGroups[cat].length < MAX_PER_CATEGORY) {
        categoryGroups[cat].push(s);
      }
    }
  }

  return (
    <main
      role="main"
      aria-label="Contenu principal"
      className="max-w-[1400px] mx-auto px-6 py-8"
    >
      {/* Hero Section: Asymmetric 60/40 Layout with 3 articles */}
      <section className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-12">
        {/* Hero Synthesis (60%) */}
        <div>
          {loading ? (
            <div
              style={{
                backgroundColor: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                padding: '60px 40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '400px',
              }}
            >
              <p style={{ color: theme.textSecondary }}>Chargement de la synthèse principale...</p>
            </div>
          ) : heroSynthesis ? (
            <HeroSynthesis synthesis={heroSynthesis} />
          ) : (
            <div
              style={{
                backgroundColor: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                padding: '60px 40px',
                textAlign: 'center',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <p style={{ fontSize: '18px', color: theme.text, marginBottom: '8px' }}>
                Aucune synthèse disponible
              </p>
              <p style={{ fontSize: '14px', color: theme.textSecondary }}>
                Lancez le pipeline pour générer des synthèses IA
              </p>
            </div>
          )}
        </div>

        {/* Secondary Column (40%) - 2 stacked cards */}
        <div className="flex flex-col gap-4">
          {secondarySyntheses.map((s, idx) => (
            <Link key={s.id} href={`/synthesis/${s.id}`} style={{ textDecoration: 'none' }}>
              <article
                className="card-interactive"
                style={{
                  backgroundColor: theme.card,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '12px',
                  padding: '20px',
                  minHeight: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {/* Thumbnail */}
                {s.imageUrl && (
                  <div style={{
                    width: '100%',
                    height: '80px',
                    overflow: 'hidden',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    backgroundColor: '#F9FAFB',
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl}
                      alt=""
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                )}

                {/* Accent line on hover */}
                <div
                  className="accent-line-reveal"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: theme.brand.secondary,
                  }}
                />

                {/* Category + Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                }}>
                  {s.category && (
                    <CategoryBadge category={s.category} size="sm" />
                  )}
                  <AIBadge size="sm" />
                </div>

                {/* Title */}
                <h3 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '16px',
                  fontWeight: 600,
                  lineHeight: 1.35,
                  color: theme.text,
                  margin: 0,
                  marginBottom: '10px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {s.title}
                </h3>

                {/* Summary */}
                <p style={{
                  fontSize: '13px',
                  lineHeight: 1.5,
                  color: theme.textSecondary,
                  margin: 0,
                  flex: 1,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {s.summary}
                </p>

                {/* Meta */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px',
                  color: theme.textSecondary,
                  borderTop: `1px solid ${theme.border}`,
                  paddingTop: '10px',
                  marginTop: 'auto',
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{s.numSources} sources</span>
                  <span>{formatDate(s.createdAt)}</span>
                </div>
              </article>
            </Link>
          ))}

          {/* Trending Topics - Compact version below secondary cards */}
          {secondarySyntheses.length < 2 && (
            <div className="lg:sticky lg:top-4">
              <TrendingTopics />
            </div>
          )}
        </div>
      </section>

      {/* Syntheses Grid — Category blocks (ACCUEIL) or flat list (filtered) */}
      {restSyntheses.length > 0 && (
        <section style={{ marginBottom: '48px' }}>
          {apiCategory ? (
            /* Filtered view: flat grid, no sub-headers */
            <>
              <div className="category-grid">
                {restSyntheses.map((s) => (
                  <CompactCard key={s.id} synthesis={s} theme={theme} formatDate={formatDate} />
                ))}
              </div>

              {/* Infinite Scroll Trigger */}
              <div
                ref={loadingRef}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '40px 0',
                  minHeight: '100px',
                }}
              >
                {loadingMore && <LoadingSpinner theme={theme} />}
                {!hasMore && syntheses.length > 7 && (
                  <p style={{ color: theme.textSecondary, fontSize: '14px' }}>
                    Toutes les synthèses sont chargées
                  </p>
                )}
              </div>
            </>
          ) : (
            /* ACCUEIL view: grouped by category */
            <>
              {CATEGORY_ORDER
                .filter(cat => categoryGroups[cat] && categoryGroups[cat].length > 0)
                .map(cat => (
                  <div key={cat} style={{ marginBottom: '40px' }}>
                    {/* Category Section Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: '20px',
                      paddingBottom: '10px',
                      borderBottom: `3px solid ${CATEGORY_COLORS[cat] || theme.border}`,
                    }}>
                      <h2 style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '20px',
                        fontWeight: 700,
                        color: theme.text,
                        letterSpacing: '0.02em',
                        margin: 0,
                      }}>
                        {cat}
                      </h2>
                      <span style={{
                        fontSize: '13px',
                        color: theme.textSecondary,
                      }}>
                        {categoryGroups[cat].length} analyse{categoryGroups[cat].length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Category Grid */}
                    <div className="category-grid">
                      {categoryGroups[cat].map((s) => (
                        <CompactCard key={s.id} synthesis={s} theme={theme} formatDate={formatDate} />
                      ))}
                    </div>
                  </div>
                ))}

              {/* Infinite Scroll Trigger */}
              <div
                ref={loadingRef}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '40px 0',
                  minHeight: '100px',
                }}
              >
                {loadingMore && <LoadingSpinner theme={theme} />}
                {!hasMore && syntheses.length > 7 && (
                  <p style={{ color: theme.textSecondary, fontSize: '14px' }}>
                    Toutes les synthèses sont chargées
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* Newsletter - Modern glassmorphism style */}
      <section
        className="glass-subtle"
        style={{
          padding: '56px 32px',
          textAlign: 'center',
          borderRadius: '16px',
          marginTop: '48px',
          border: `1px solid ${theme.border}`,
        }}
      >
        <Badge variant="ai" size="sm" style={{ marginBottom: '16px' }}>
          Newsletter IA
        </Badge>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: theme.text,
          fontFamily: 'var(--font-serif)',
          marginBottom: '12px',
          letterSpacing: '-0.02em',
        }}>
          Recevez notre sélection quotidienne
        </h2>
        <p style={{
          fontSize: '15px',
          color: theme.textSecondary,
          marginBottom: '28px',
          maxWidth: '400px',
          margin: '0 auto 28px',
        }}>
          Les meilleures synthèses IA directement dans votre boîte mail
        </p>
        <div className="flex gap-0 max-w-[480px] mx-auto">
          <input
            type="email"
            placeholder="Votre adresse email"
            style={{
              flex: 1,
              padding: '16px 20px',
              border: `1px solid ${theme.border}`,
              borderRight: 'none',
              fontSize: '14px',
              backgroundColor: theme.bg,
              color: theme.text,
              borderRadius: '10px 0 0 10px',
              transition: 'border-color 200ms ease',
            }}
          />
          <button
            className="btn-hover-primary"
            style={{
              backgroundColor: theme.brand.secondary,
              color: '#FFFFFF',
              padding: '16px 32px',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: '0 10px 10px 0',
              transition: 'all 200ms ease',
            }}
          >
            S'inscrire
          </button>
        </div>
      </section>
    </main>
  );
}

export function HomePage() {
  const { theme } = useTheme();

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bg,
      color: theme.text,
    }}>
      <Header />
      <StatusBar />
      <NewsTicker />
      <DossiersBar />
      <MainContent />
      <Footer />
      <OfflineNotification />
    </div>
  );
}
