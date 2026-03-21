"use client";

/**
 * HomePage - Intelligence Terminal design
 * Features: StatusBar, Hero synthesis, Secondary grid, Compact numbered grid,
 * Right sidebar with trending entities + intel reports + signal card
 * Supports infinite scroll for loading more syntheses
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import { useArticles } from '../../contexts/ArticlesContext';
import { Header } from '../layout/Header';
import { StatusBar } from '../layout/StatusBar';
import { NewsTicker } from '../layout/NewsTicker';
import { Footer } from '../layout/Footer';
import { OfflineNotification } from '../ui/OfflineNotification';
import { TrendingTopics } from '../trending';
import { HeroSynthesis, SynthesisBrief } from '../articles/HeroSynthesis';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { SkeletonCard, SkeletonHero } from '../ui/Skeleton';
import { Badge, CategoryBadge, AIBadge } from '../ui/Badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const PAGE_SIZE = 10;

const CATEGORY_COLORS: Record<string, string> = {
  MONDE: '#DC2626',
  POLITIQUE: '#DC2626',
  ECONOMIE: '#F59E0B',
  TECH: '#2563EB',
  CULTURE: '#8B5CF6',
  SPORT: '#10B981',
  SCIENCES: '#06B6D4',
};

// ── Helper: time ago ──────────────────────────────────────────────────────────

function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "NOW";
  if (minutes < 60) return `${minutes}m AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h AGO`;
  const days = Math.floor(hours / 24);
  return `${days}d AGO`;
}

function getIntelLevel(score?: number): { label: string; color: string } {
  const s = score ?? 0;
  if (s >= 70) return { label: 'HIGH', color: '#10B981' };
  if (s >= 40) return { label: 'MED', color: '#F59E0B' };
  return { label: 'LOW', color: '#6B7280' };
}

// ── Secondary Card (grid-cols-2) ──────────────────────────────────────────────

function SecondaryCard({ synthesis: s, theme }: {
  synthesis: SynthesisBrief;
  theme: Record<string, any>;
}) {
  const [hovered, setHovered] = useState(false);
  const catColor = CATEGORY_COLORS[s.category || ''] || '#6B7280';
  const intel = getIntelLevel(s.complianceScore ?? s.transparencyScore);

  return (
    <Link href={`/synthesis/${s.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          backgroundColor: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: '0px',
          overflow: 'hidden',
          transition: 'border-color 300ms ease',
          borderColor: hovered ? (theme.brand?.primary || '#2563EB') : theme.border,
        }}
      >
        {/* Image with grayscale effect */}
        {s.imageUrl && (
          <div style={{
            width: '100%',
            aspectRatio: '16 / 9',
            overflow: 'hidden',
            backgroundColor: theme.bgSecondary,
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
                filter: hovered ? 'grayscale(0%)' : 'grayscale(100%)',
                transform: hovered ? 'scale(1.05)' : 'scale(1)',
                transition: 'filter 0.5s ease, transform 700ms ease',
              }}
            />
          </div>
        )}

        {/* Category pill + score badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px 0 16px',
        }}>
          {s.category && (
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: 'var(--font-label)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#FFF',
              backgroundColor: catColor,
              padding: '2px 8px',
              borderRadius: '0px',
            }}>
              {s.category}
            </span>
          )}
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            fontFamily: 'var(--font-label)',
            color: intel.color,
            letterSpacing: '0.05em',
          }}>
            INTEL: {intel.label}
          </span>
        </div>

        {/* Title */}
        <h3 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '24px',
          fontWeight: 700,
          lineHeight: 1.25,
          color: hovered ? (theme.brand?.primary || '#2563EB') : theme.text,
          margin: '0',
          padding: '8px 16px 0 16px',
          transition: 'color 300ms ease',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {s.title}
        </h3>

        {/* Short description */}
        <p style={{
          fontSize: '14px',
          lineHeight: 1.55,
          color: theme.textSecondary,
          margin: '0',
          padding: '8px 16px 16px 16px',
          fontFamily: 'var(--font-sans)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {s.summary}
        </p>
      </article>
    </Link>
  );
}

// ── Compact Numbered Item (grid-cols-3) ───────────────────────────────────────

function CompactNumberedItem({ synthesis: s, index, theme }: {
  synthesis: SynthesisBrief;
  index: number;
  theme: Record<string, any>;
}) {
  const [hovered, setHovered] = useState(false);
  const intel = getIntelLevel(s.complianceScore ?? s.transparencyScore);
  const number = String(index + 1).padStart(2, '0');

  return (
    <Link href={`/synthesis/${s.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          padding: '20px 16px',
          overflow: 'hidden',
          borderRadius: '0px',
        }}
      >
        {/* Background image on hover */}
        {s.imageUrl && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${s.imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: hovered ? 0.15 : 0,
            transition: 'opacity 500ms ease',
            pointerEvents: 'none',
          }} />
        )}

        {/* Number */}
        <span style={{
          fontFamily: 'var(--font-label)',
          fontSize: '36px',
          fontWeight: 700,
          color: theme.textSecondary,
          opacity: 0.4,
          lineHeight: 1,
          display: 'block',
          marginBottom: '8px',
          position: 'relative',
        }}>
          {number}
        </span>

        {/* Headline */}
        <h4 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '18px',
          fontWeight: 700,
          lineHeight: 1.3,
          color: theme.text,
          margin: '0 0 12px 0',
          position: 'relative',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical' as const,
          overflow: 'hidden',
        }}>
          {s.title}
        </h4>

        {/* Bottom: time + intel */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0',
          fontSize: '11px',
          fontFamily: 'var(--font-label)',
          color: theme.textSecondary,
          position: 'relative',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <span>{formatTimeAgo(s.createdAt)}</span>
          <span style={{ margin: '0 8px', opacity: 0.4 }}>&bull;</span>
          <span style={{ color: intel.color }}>INTEL: {intel.label}</span>
        </div>
      </article>
    </Link>
  );
}

// ── Sidebar: Trending Entities ────────────────────────────────────────────────

function SidebarEntities({ theme }: { theme: Record<string, any> }) {
  const [entities, setEntities] = useState<{ entity: string; count: number }[]>([]);
  useEffect(() => {
    fetch(`${API_URL}/api/trending/entities?hours=168&limit=6`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.data) setEntities(data.data); })
      .catch(() => {});
  }, []);

  if (entities.length === 0) return null;

  const maxCount = Math.max(...entities.map(e => e.count), 1);

  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Section header with extending line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <span style={{
          fontFamily: 'var(--font-label)',
          fontSize: '10px',
          color: theme.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          whiteSpace: 'nowrap',
          fontWeight: 600,
        }}>
          TRENDING ENTITIES
        </span>
        <div style={{
          flex: 1,
          height: '1px',
          backgroundColor: theme.border,
        }} />
      </div>

      {/* Entity cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {entities.map((item) => {
          const pct = Math.round((item.count / maxCount) * 100);
          // Generate 6 bar heights based on entity hash
          const bars = Array.from({ length: 6 }, (_, i) => {
            const seed = item.entity.charCodeAt(i % item.entity.length) + i;
            return 20 + (seed % 80);
          });

          return (
            <Link
              key={item.entity}
              href={`/topics/${encodeURIComponent(item.entity)}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div style={{
                backgroundColor: theme.bgSecondary,
                padding: '16px',
                borderRadius: '0px',
                border: `1px solid ${theme.border}`,
                transition: 'border-color 200ms ease',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-label)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: theme.text,
                  }}>
                    {item.entity}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-label)',
                    fontSize: '11px',
                    color: theme.brand?.secondary || '#2563EB',
                    fontWeight: 600,
                  }}>
                    {pct}%
                  </span>
                </div>

                {/* Mini bar chart */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '3px',
                  height: '24px',
                }}>
                  {bars.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${h}%`,
                        backgroundColor: theme.brand?.primary || '#2563EB',
                        opacity: 0.15 + (i * 0.12),
                        borderRadius: '0px',
                        transition: 'height 300ms ease',
                      }}
                    />
                  ))}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Sidebar: Intel Reports ────────────────────────────────────────────────────

interface DossierInfo {
  topic_name: string;
  synthesis_count: number;
  narrative_arc: string;
  is_active: boolean;
  key_entities: (string | { name: string; count?: number; type?: string })[];
}

function SidebarIntelReports({ theme }: { theme: Record<string, any> }) {
  const [dossiers, setDossiers] = useState<DossierInfo[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/trending/recurring-topics`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const rawTopics = data?.data || data?.topics || data || [];
        const topics = (Array.isArray(rawTopics) ? rawTopics : [])
          .filter((t: DossierInfo) => t.is_active)
          .sort((a: DossierInfo, b: DossierInfo) => b.synthesis_count - a.synthesis_count)
          .slice(0, 4);
        setDossiers(topics);
      })
      .catch(() => {});
  }, []);

  if (dossiers.length === 0) return null;

  return (
    <div style={{ marginBottom: '32px' }}>
      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <span style={{
          fontFamily: 'var(--font-label)',
          fontSize: '10px',
          color: theme.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          whiteSpace: 'nowrap',
          fontWeight: 600,
        }}>
          INTEL REPORTS
        </span>
        <div style={{
          flex: 1,
          height: '1px',
          backgroundColor: theme.border,
        }} />
      </div>

      {/* Report items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {dossiers.map((d, i) => {
          // Generate a simple SVG line graph for visual interest
          const points = Array.from({ length: 5 }, (_, j) => {
            const seed = d.topic_name.charCodeAt(j % d.topic_name.length) + j;
            return 10 + (seed % 30);
          });
          const pathD = points.map((y, j) => {
            const x = j * 60;
            return j === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
          }).join(' ');

          const ARC_LABELS: Record<string, string> = {
            emerging: 'EMERGING',
            developing: 'DEVELOPING',
            peak: 'PEAK',
            declining: 'DECLINING',
            resolved: 'RESOLVED',
          };

          return (
            <Link
              key={d.topic_name}
              href={`/topics/${encodeURIComponent(d.topic_name)}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div style={{
                padding: '12px 0',
                borderBottom: i < dossiers.length - 1 ? `1px solid ${theme.border}` : 'none',
              }}>
                {/* Mini SVG line graph */}
                <svg
                  width="100%"
                  height="40"
                  viewBox="0 0 240 50"
                  style={{ display: 'block', marginBottom: '8px' }}
                >
                  <path
                    d={pathD}
                    fill="none"
                    stroke={theme.brand?.primary || '#2563EB'}
                    strokeWidth="1.5"
                    opacity="0.6"
                  />
                  {/* Endpoint circles */}
                  <circle
                    cx={0}
                    cy={points[0]}
                    r="3"
                    fill={theme.brand?.primary || '#2563EB'}
                    opacity="0.4"
                  />
                  <circle
                    cx={(points.length - 1) * 60}
                    cy={points[points.length - 1]}
                    r="3"
                    fill={theme.brand?.primary || '#2563EB'}
                    opacity="0.8"
                  />
                </svg>

                {/* Labels */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-label)',
                    fontSize: '9px',
                    fontWeight: 700,
                    color: theme.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    {ARC_LABELS[d.narrative_arc] || d.narrative_arc}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-label)',
                    fontSize: '9px',
                    color: theme.textSecondary,
                    opacity: 0.6,
                  }}>
                    {d.synthesis_count} synth.
                  </span>
                </div>
                <span style={{
                  fontFamily: 'var(--font-label)',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.text,
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const,
                  overflow: 'hidden',
                }}>
                  {d.topic_name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Sidebar: Signal Detected Card ─────────────────────────────────────────────

function SignalDetectedCard({ theme }: { theme: Record<string, any> }) {
  const primaryColor = theme.brand?.primary || '#2563EB';

  return (
    <div style={{
      backgroundColor: `${primaryColor}10`,
      borderLeft: `2px solid ${primaryColor}`,
      padding: '16px',
      borderRadius: '0px',
    }}>
      <span style={{
        fontFamily: 'var(--font-label)',
        fontSize: '10px',
        fontWeight: 700,
        color: primaryColor,
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        display: 'block',
        marginBottom: '8px',
      }}>
        SIGNAL DETECTED
      </span>
      <p style={{
        fontSize: '13px',
        lineHeight: 1.5,
        color: theme.textSecondary,
        margin: '0 0 12px 0',
        fontFamily: 'var(--font-sans)',
      }}>
        Emerging patterns detected across multiple intelligence streams. Cross-referencing active sources.
      </p>
      <Link
        href="/live"
        style={{
          display: 'inline-block',
          fontFamily: 'var(--font-label)',
          fontSize: '11px',
          fontWeight: 700,
          color: primaryColor,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          textDecoration: 'none',
          padding: '8px 16px',
          border: `1px solid ${primaryColor}`,
          borderRadius: '0px',
          transition: 'all 200ms ease',
        }}
      >
        VIEW RAW STREAM
      </Link>
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────

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
      Chargement des syntheses...
    </div>
  );
}

// ── Main Content ──────────────────────────────────────────────────────────────

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
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '0 24px',
      }}>
        <div style={{ display: 'flex', gap: '32px' }}>
          <div style={{ flex: 1 }}>
            <SkeletonHero height="400px" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px' }}>
              <SkeletonCard hasImage={false} lines={4} />
              <SkeletonCard hasImage={false} lines={4} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '32px' }}>
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} hasImage={false} lines={3} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Split into sections
  const heroSynthesis = sortedSyntheses[0];
  const secondarySyntheses = sortedSyntheses.slice(1, 3);
  const compactSyntheses = sortedSyntheses.slice(3);

  return (
    <div style={{
      maxWidth: '1600px',
      margin: '0 auto',
      padding: '32px 24px',
    }}>
      {/* Two-column layout: main + sidebar */}
      <div style={{
        display: 'flex',
        gap: '40px',
        alignItems: 'flex-start',
      }}>
        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* (a) Hero Synthesis */}
          {heroSynthesis ? (
            <div style={{ marginBottom: '40px' }}>
              <HeroSynthesis synthesis={heroSynthesis} />
            </div>
          ) : (
            <div style={{
              backgroundColor: theme.card,
              border: `1px solid ${theme.border}`,
              borderRadius: '0px',
              padding: '60px 40px',
              textAlign: 'center',
              minHeight: '300px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '40px',
            }}>
              <p style={{ fontSize: '18px', color: theme.text, marginBottom: '8px' }}>
                Aucune synthese disponible
              </p>
              <p style={{ fontSize: '14px', color: theme.textSecondary }}>
                Lancez le pipeline pour generer des syntheses IA
              </p>
            </div>
          )}

          {/* (b) Secondary Row - grid-cols-2 */}
          {secondarySyntheses.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px',
              marginBottom: '48px',
            }}>
              {secondarySyntheses.map((s) => (
                <SecondaryCard key={s.id} synthesis={s} theme={theme} />
              ))}
            </div>
          )}

          {/* (c) Compact Grid - grid-cols-3 with numbered items */}
          {compactSyntheses.length > 0 && (
            <>
              {/* Section divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px',
              }}>
                <span style={{
                  fontFamily: 'var(--font-label)',
                  fontSize: '10px',
                  color: theme.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                }}>
                  MORE INTELLIGENCE
                </span>
                <div style={{
                  flex: 1,
                  height: '1px',
                  backgroundColor: theme.border,
                }} />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0',
              }}>
                {compactSyntheses.map((s, i) => {
                  // Column index for divider lines
                  const col = i % 3;
                  return (
                    <div
                      key={s.id}
                      style={{
                        borderLeft: col > 0 ? `1px solid ${theme.border}` : 'none',
                        borderBottom: `1px solid ${theme.border}`,
                      }}
                    >
                      <CompactNumberedItem
                        synthesis={s}
                        index={i}
                        theme={theme}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* (d) Infinite scroll trigger */}
          <div
            ref={loadingRef}
            style={{
              display: 'flex',
              justifyContent: 'center',
              padding: '40px 0',
              minHeight: '80px',
            }}
          >
            {loadingMore && <LoadingSpinner theme={theme} />}
            {!hasMore && syntheses.length > 7 && (
              <p style={{
                color: theme.textSecondary,
                fontSize: '13px',
                fontFamily: 'var(--font-label)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                END OF TRANSMISSION
              </p>
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <aside style={{
          width: '320px',
          flexShrink: 0,
          position: 'sticky',
          top: '112px',
          alignSelf: 'flex-start',
        }} className="homepage-sidebar">

          {/* Trending Entities */}
          <SidebarEntities theme={theme} />

          {/* Intel Reports */}
          <SidebarIntelReports theme={theme} />

          {/* Signal Detected */}
          <SignalDetectedCard theme={theme} />
        </aside>
      </div>
    </div>
  );
}

// ── Exported HomePage Component ───────────────────────────────────────────────

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
