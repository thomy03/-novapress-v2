"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useTheme } from '../contexts/ThemeContext';
import { synthesesService } from '../lib/api/services/syntheses';
import { Synthesis, SynthesisCategory } from '../types/api';
import { Header } from '../components/layout/Header';
import { NewsTicker } from '../components/layout/NewsTicker';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

const PAGE_SIZE = 20;

// Category emoji and colors
const CATEGORY_CONFIG: Record<SynthesisCategory, { emoji: string; color: string }> = {
  'MONDE': { emoji: '🌍', color: '#2563EB' },
  'TECH': { emoji: '💻', color: '#7C3AED' },
  'ECONOMIE': { emoji: '📈', color: '#059669' },
  'POLITIQUE': { emoji: '🏛️', color: '#DC2626' },
  'CULTURE': { emoji: '🎭', color: '#D97706' },
  'SPORT': { emoji: '⚽', color: '#0891B2' },
  'SCIENCES': { emoji: '🔬', color: '#4F46E5' }
};

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG) as SynthesisCategory[];

export default function LivePage() {
  const { theme } = useTheme();
  const [syntheses, setSyntheses] = useState<Synthesis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHours, setSelectedHours] = useState(24);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Read initial category from URL param (e.g. /live?category=TECH)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('category');
      if (cat && ALL_CATEGORIES.includes(cat as SynthesisCategory)) {
        setSelectedCategory(cat);
      }
    }
  }, []);

  const fetchLiveSyntheses = useCallback(async (
    currentOffset: number,
    hours: number,
    append: boolean = false,
    signal?: AbortSignal
  ) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await synthesesService.getLiveSynthesesPaginated(hours, PAGE_SIZE, currentOffset);

      // Don't update state if aborted
      if (signal?.aborted) return;

      if (response.data) {
        if (append) {
          setSyntheses(prev => [...prev, ...response.data]);
        } else {
          setSyntheses(response.data);
        }
        setHasMore(response.hasMore || false);
        setOffset(response.nextOffset || currentOffset + PAGE_SIZE);
      }
      setLastRefresh(new Date());
    } catch (err) {
      if (signal?.aborted) return;
      console.error('Failed to fetch live syntheses:', err);
      setError('Impossible de charger les actualités en direct. Veuillez réessayer.');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // Initial fetch and when hours change
  useEffect(() => {
    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Reset state when hours change
    setOffset(0);
    setHasMore(true);
    fetchLiveSyntheses(0, selectedHours, false, abortController.signal);

    // Auto-refresh every 2 minutes (only first page)
    const interval = setInterval(() => {
      if (!abortController.signal.aborted) {
        setOffset(0);
        setHasMore(true);
        fetchLiveSyntheses(0, selectedHours, false, abortController.signal);
      }
    }, 2 * 60 * 1000);

    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, [selectedHours, fetchLiveSyntheses]);

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchLiveSyntheses(offset, selectedHours, true, abortControllerRef.current?.signal);
    }
  }, [offset, selectedHours, loadingMore, hasMore, fetchLiveSyntheses]);

  // Infinite scroll hook
  const { loadingRef } = useInfiniteScroll({
    hasNextPage: hasMore,
    isFetching: loadingMore,
    fetchNextPage: loadMore,
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Hier";
    }
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // Filter by selected category (client-side)
  const filteredSyntheses = selectedCategory === 'ALL'
    ? syntheses
    : syntheses.filter(s => s.category === selectedCategory);

  // Group filtered syntheses by date
  const groupedSyntheses = filteredSyntheses.reduce((groups, synthesis) => {
    const dateKey = formatDate(synthesis.createdAt);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(synthesis);
    return groups;
  }, {} as Record<string, Synthesis[]>);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <Header />
      <NewsTicker />

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                backgroundColor: '#DC2626',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}
            />
            <h1 style={{
              fontSize: '32px',
              fontWeight: '900',
              fontFamily: 'Georgia, serif',
              color: theme.text,
              margin: 0
            }}>
              EN DIRECT
            </h1>
          </div>
          <p style={{
            fontSize: '16px',
            color: theme.textSecondary,
            margin: 0
          }}>
            Toutes les actualités en temps réel, analysées par notre IA
          </p>

          {/* Time filter and refresh */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: `1px solid ${theme.border}`
          }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[6, 12, 24, 48].map(hours => (
                <button
                  key={hours}
                  onClick={() => setSelectedHours(hours)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: selectedHours === hours ? 'none' : `1px solid ${theme.border}`,
                    backgroundColor: selectedHours === hours ? '#DC2626' : 'transparent',
                    color: selectedHours === hours ? 'white' : theme.text,
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {hours}h
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: theme.textSecondary }}>
                Dernière MAJ: {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                onClick={() => fetchLiveSyntheses(0, selectedHours, false)}
                disabled={isLoading}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: `1px solid ${theme.border}`,
                  backgroundColor: 'transparent',
                  color: theme.text,
                  cursor: isLoading ? 'wait' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isLoading ? 'Chargement...' : 'Actualiser'}
              </button>
            </div>
          </div>

          {/* Category filter strip */}
          <div
            className="mobile-nav-scroll"
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '16px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            <button
              onClick={() => setSelectedCategory('ALL')}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: '20px',
                border: selectedCategory === 'ALL' ? 'none' : `1px solid ${theme.border}`,
                backgroundColor: selectedCategory === 'ALL' ? '#111' : 'transparent',
                color: selectedCategory === 'ALL' ? '#FFF' : theme.text,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Toutes
            </button>
            {ALL_CATEGORIES.map(cat => {
              const cfg = CATEGORY_CONFIG[cat];
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(isActive ? 'ALL' : cat)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: isActive ? 'none' : `1px solid ${theme.border}`,
                    backgroundColor: isActive ? cfg.color : 'transparent',
                    color: isActive ? '#FFF' : theme.text,
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cfg.emoji} {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            padding: '20px',
            backgroundColor: '#FEE2E2',
            borderRadius: '8px',
            color: '#DC2626',
            marginBottom: '24px'
          }}>
            {error}
          </div>
        )}

        {/* Loading state */}
        {isLoading && syntheses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #E5E5E5',
              borderTopColor: '#DC2626',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: theme.textSecondary }}>Chargement des actualités...</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && syntheses.length === 0 && !error && (
          <div style={{
            textAlign: 'center',
            padding: '60px 0',
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px'
          }}>
            <p style={{ fontSize: '48px', marginBottom: '16px' }}>📰</p>
            <p style={{ color: theme.text, fontWeight: '600', marginBottom: '8px' }}>
              Aucune actualité pour cette période
            </p>
            <p style={{ color: theme.textSecondary, fontSize: '14px' }}>
              Essayez d'élargir la période de recherche
            </p>
          </div>
        )}

        {/* Timeline of syntheses */}
        {Object.entries(groupedSyntheses).map(([dateLabel, daySyntheses]) => (
          <div key={dateLabel} style={{ marginBottom: '40px' }}>
            {/* Date header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '20px'
            }}>
              <span style={{
                fontSize: '14px',
                fontWeight: '700',
                color: theme.text,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {dateLabel}
              </span>
              <div style={{
                flex: 1,
                height: '1px',
                backgroundColor: theme.border
              }} />
              <span style={{
                fontSize: '13px',
                color: theme.textSecondary
              }}>
                {daySyntheses.length} article{daySyntheses.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Timeline items */}
            <div style={{ position: 'relative' }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute',
                left: '20px',
                top: 0,
                bottom: 0,
                width: '2px',
                backgroundColor: theme.border
              }} />

              {daySyntheses.map((synthesis, index) => {
                const config = CATEGORY_CONFIG[synthesis.category] || CATEGORY_CONFIG['MONDE'];

                return (
                  <Link
                    key={synthesis.id}
                    href={`/synthesis/${synthesis.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <article
                      style={{
                        position: 'relative',
                        paddingLeft: '60px',
                        paddingBottom: index === daySyntheses.length - 1 ? 0 : '24px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      {/* Timeline dot */}
                      <div style={{
                        position: 'absolute',
                        left: '12px',
                        top: '4px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: config.color,
                        border: `3px solid ${theme.bg}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px'
                      }}>
                        {config.emoji}
                      </div>

                      {/* Time */}
                      <div style={{
                        fontSize: '12px',
                        color: theme.textSecondary,
                        marginBottom: '6px',
                        fontWeight: '600'
                      }}>
                        {formatTime(synthesis.createdAt)}
                      </div>

                      {/* Category badge */}
                      <span style={{
                        display: 'inline-block',
                        fontSize: '10px',
                        fontWeight: '700',
                        color: config.color,
                        backgroundColor: `${config.color}15`,
                        padding: '3px 10px',
                        borderRadius: '12px',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {synthesis.category}
                      </span>

                      {/* Title */}
                      <h2 style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        fontFamily: 'Georgia, serif',
                        color: theme.text,
                        margin: '0 0 8px 0',
                        lineHeight: '1.3'
                      }}>
                        {synthesis.title}
                      </h2>

                      {/* Summary preview */}
                      <p style={{
                        fontSize: '14px',
                        color: theme.textSecondary,
                        margin: 0,
                        lineHeight: '1.5',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {synthesis.summary}
                      </p>

                      {/* Meta info */}
                      <div style={{
                        marginTop: '10px',
                        fontSize: '12px',
                        color: theme.textSecondary
                      }}>
                        {synthesis.numSources} source{synthesis.numSources > 1 ? 's' : ''} • {synthesis.readingTime} min de lecture
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Infinite Scroll Trigger & Loading Indicator */}
        <div
          ref={loadingRef}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '32px 0',
            minHeight: '80px',
          }}
        >
          {loadingMore && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              color: theme.textSecondary,
              fontSize: '14px',
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: `2px solid ${theme.border}`,
                borderTopColor: '#DC2626',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              Chargement...
            </div>
          )}
          {!hasMore && syntheses.length > 0 && (
            <p style={{
              color: theme.textSecondary,
              fontSize: '14px',
            }}>
              Fin du fil d'actualités
            </p>
          )}
        </div>

        {/* Back to home link */}
        <div style={{
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: `1px solid ${theme.border}`,
          textAlign: 'center'
        }}>
          <Link
            href="/"
            style={{
              color: '#DC2626',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            ← Retour à l'accueil
          </Link>
        </div>
      </main>

      {/* Animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
