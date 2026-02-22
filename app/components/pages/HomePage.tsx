"use client";

/**
 * HomePage - Main landing page with Bento Grid layout
 * Features: StatusBar, Hero 60/40 layout, TrendingTopics sidebar, Synthesis cards
 * Supports infinite scroll for loading more syntheses
 * Design: Modern UX 2025-2026 with glassmorphism, animations, dark mode
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import { Header } from '../layout/Header';
import { StatusBar } from '../layout/StatusBar';
import { NewsTicker } from '../layout/NewsTicker';
import { Footer } from '../layout/Footer';
import { OfflineNotification } from '../ui/OfflineNotification';
import { TrendingTopics } from '../trending';
import { HeroSynthesis, SynthesisBrief } from '../articles/HeroSynthesis';
import { RecurringTopicBadge } from '../topics';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { SkeletonCard, SkeletonHero } from '../ui/Skeleton';
import { Badge, CategoryBadge, AIBadge } from '../ui/Badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const PAGE_SIZE = 10;

function MainContent() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [syntheses, setSyntheses] = useState<SynthesisBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [keywordFilter, setKeywordFilter] = useState<string | null>(null);

  // Fetch syntheses with pagination
  const fetchSyntheses = useCallback(async (currentOffset: number, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(
        `${API_URL}/api/syntheses/live?hours=168&limit=${PAGE_SIZE}&offset=${currentOffset}`,
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
  }, []);

  // Initial fetch + sync category from URL params (MobileHeader → /?category=X)
  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    if (cat) setCategoryFilter(cat);
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

  // ⚠️ useMemo hooks MUST be before any early return (Rules of Hooks)
  // Apply category + keyword filters to all syntheses
  const filteredSyntheses = useMemo(() => {
    let result = syntheses;
    if (categoryFilter) result = result.filter(s => s.category === categoryFilter);
    if (keywordFilter) result = result.filter(s => s.title.toLowerCase().includes(keywordFilter.toLowerCase()));
    return result;
  }, [syntheses, categoryFilter, keywordFilter]);

  // Count all categories (from unfiltered syntheses, for stable filter button labels)
  const categoryCounts = useMemo(() => syntheses.reduce((acc, s) => {
    if (s.category) acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>), [syntheses]);

  // Trending keywords extracted from synthesis titles (min 2 occurrences)
  const trendingKeywords = useMemo(() => {
    const STOP_WORDS = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'en', 'et', 'est', 'au', 'aux', 'un', 'une', 'dans', 'sur', 'par', 'pour', 'avec', 'qui', 'que', 'se', 'si', 'ce', 'son', 'sa', 'ses', 'plus', 'pas', 'ne', 'ni', 'mais', 'leur', 'leurs', 'nous', 'vous', 'ils', 'elles', 'cette', 'sont', 'the', 'and', 'for', 'are', 'was', 'with', 'from', 'that', 'this', 'have', 'will', 'about', 'also', 'its', 'après', 'avant', 'sans', 'sous', 'vers']);
    const wordCount: Record<string, number> = {};
    syntheses.forEach(s => {
      s.title.toLowerCase()
        .replace(/[^a-zàâäéèêëïîôùûüç0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4 && !STOP_WORDS.has(w))
        .forEach(w => { wordCount[w] = (wordCount[w] || 0) + 1; });
    });
    return Object.entries(wordCount)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  }, [syntheses]);

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
  const heroSynthesis = filteredSyntheses[0];
  const secondarySyntheses = filteredSyntheses.slice(1, 3);
  const allGridSyntheses = filteredSyntheses.slice(3);
  const gridSyntheses = allGridSyntheses;

  return (
    <main
      role="main"
      aria-label="Contenu principal"
      className="max-w-[1400px] mx-auto px-6 py-8"
    >
      {/* Category Filter + Trending Keywords */}
      {syntheses.length > 0 && (
        <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: `1px solid ${theme.border}` }}>
          {/* Category pills */}
          {Object.keys(categoryCounts).length > 1 && (
            <div
              className="mobile-nav-scroll"
              style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}
            >
              <button
                onClick={() => { setCategoryFilter(null); setKeywordFilter(null); }}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: '20px',
                  border: !categoryFilter && !keywordFilter ? 'none' : `1px solid ${theme.border}`,
                  backgroundColor: !categoryFilter && !keywordFilter ? theme.text : 'transparent',
                  color: !categoryFilter && !keywordFilter ? theme.bg : theme.text,
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                Tout ({syntheses.length})
              </button>
              {Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                const isActive = categoryFilter === cat;
                const catColors: Record<string, string> = { MONDE: '#2563EB', TECH: '#7C3AED', ECONOMIE: '#059669', POLITIQUE: '#DC2626', CULTURE: '#D97706', SPORT: '#0891B2', SCIENCES: '#4F46E5' };
                const catEmoji: Record<string, string> = { MONDE: '🌍', TECH: '💻', ECONOMIE: '📈', POLITIQUE: '🏛️', CULTURE: '🎭', SPORT: '⚽', SCIENCES: '🔬' };
                const color = catColors[cat] || '#6B7280';
                return (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(isActive ? null : cat); setKeywordFilter(null); }}
                    style={{
                      flexShrink: 0, padding: '6px 14px', borderRadius: '20px',
                      border: isActive ? 'none' : `1px solid ${color}40`,
                      backgroundColor: isActive ? color : `${color}10`,
                      color: isActive ? '#FFF' : color,
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {catEmoji[cat] || ''} {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Trending keywords */}
          {trendingKeywords.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                🔥 Tendances
              </span>
              {trendingKeywords.map(kw => {
                const isActive = keywordFilter === kw;
                return (
                  <button
                    key={kw}
                    onClick={() => { setKeywordFilter(isActive ? null : kw); setCategoryFilter(null); }}
                    style={{
                      padding: '3px 10px', borderRadius: '12px',
                      border: `1px solid ${isActive ? theme.text : theme.border}`,
                      backgroundColor: isActive ? theme.text : 'transparent',
                      color: isActive ? theme.bg : theme.textSecondary,
                      fontSize: '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {kw}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

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

      {/* Recent Syntheses Grid */}
      {gridSyntheses.length > 0 && (
        <section style={{ marginBottom: '48px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '32px',
            paddingBottom: '20px',
            borderBottom: `2px solid ${theme.border}`,
          }}>
            <div>
              <p style={{
                fontSize: '26px',
                fontWeight: 700,
                color: theme.text,
                fontFamily: 'var(--font-serif)',
                letterSpacing: '-0.02em',
              }}>
                Les dernières analyses
              </p>
            </div>
            <Link
              href="/live"
              className="btn-hover-danger"
              style={{
                color: theme.brand.primary,
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                border: `1px solid ${theme.brand.primary}30`,
                borderRadius: '8px',
                transition: 'all 200ms ease',
              }}
            >
              <span
                className="animate-live-pulse"
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: theme.brand.primary,
                  borderRadius: '50%',
                }}
              />
              EN DIRECT
            </Link>
          </div>

          {/* Bento-style Grid: variable sizes with animations */}
          <div className="bento-grid" style={{ gap: '20px' }}>
            {gridSyntheses.map((s, index) => {
              // Bento layout: first item spans 2 cols on lg, every 4th item spans 2
              const isLarge = index === 0 || (index > 0 && index % 5 === 0);

              return (
                <Link
                  key={s.id}
                  href={`/synthesis/${s.id}`}
                  style={{ textDecoration: 'none' }}
                  className={isLarge ? 'bento-span-2' : ''}
                >
                  <article
                    className="card-interactive"
                    style={{
                      height: '100%',
                      minHeight: isLarge ? '280px' : '220px',
                      backgroundColor: theme.card,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '12px',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Accent line on hover */}
                    <div
                      className="accent-line-reveal"
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: `linear-gradient(90deg, ${theme.brand.primary}, ${theme.brand.secondary})`,
                      }}
                    />

                    {/* Badges row: Category + Recurring Topic */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '14px',
                      flexWrap: 'wrap',
                    }}>
                      {s.category && (
                        <CategoryBadge category={s.category} size="sm" />
                      )}
                      <RecurringTopicBadge synthesisId={s.id} />
                    </div>

                    {/* Title */}
                    <h3 style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: isLarge ? '20px' : '16px',
                      fontWeight: 600,
                      lineHeight: 1.35,
                      color: theme.text,
                      marginBottom: '14px',
                      display: '-webkit-box',
                      WebkitLineClamp: isLarge ? 3 : 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {s.title}
                    </h3>

                    {/* Summary preview */}
                    <p style={{
                      fontSize: '14px',
                      lineHeight: 1.6,
                      color: theme.textSecondary,
                      marginBottom: '16px',
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: isLarge ? 3 : 2,
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
                      fontSize: '12px',
                      color: theme.textSecondary,
                      borderTop: `1px solid ${theme.border}`,
                      paddingTop: '14px',
                      marginTop: 'auto',
                    }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                        {s.numSources} sources
                      </span>
                      <span>{formatDate(s.createdAt)}</span>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>

          {/* Infinite Scroll Trigger & Loading Indicator */}
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
            {loadingMore && (
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
                    borderTopColor: theme.brand.secondary,
                    borderRadius: '50%',
                  }}
                />
                Chargement des synthèses...
              </div>
            )}
            {!hasMore && syntheses.length > 7 && (
              <div
                className="glass-subtle"
                style={{
                  padding: '12px 24px',
                  borderRadius: '20px',
                  color: theme.textSecondary,
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Toutes les synthèses sont chargées
              </div>
            )}
          </div>
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
      <MainContent />
      <Footer />
      <OfflineNotification />
    </div>
  );
}
