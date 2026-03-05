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
import { Footer } from '../layout/Footer';
import { OfflineNotification } from '../ui/OfflineNotification';
import { TrendingTopics } from '../trending';
import { HeroSynthesis, SynthesisBrief } from '../articles/HeroSynthesis';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { SkeletonCard, SkeletonHero } from '../ui/Skeleton';
import { Badge, CategoryBadge, AIBadge } from '../ui/Badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const PAGE_SIZE = 10;

// ── Sidebar Dossiers (vertical list of trending entities) ────────────────────

function SidebarDossiers({ theme }: { theme: Record<string, any> }) {
  const [entities, setEntities] = useState<{ entity: string; count: number }[]>([]);
  useEffect(() => {
    fetch(`${API_URL}/api/trending/entities?hours=168&limit=8`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.data) setEntities(data.data); })
      .catch(() => {});
  }, []);
  if (entities.length === 0) return null;
  return (
    <div style={{
      marginBottom: '24px',
      padding: '16px',
      backgroundColor: theme.card,
      border: `1px solid ${theme.border}`,
    }}>
      <h3 style={{
        fontSize: '11px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '2px',
        color: theme.text,
        borderBottom: `2px solid ${theme.text}`,
        paddingBottom: '8px',
        marginBottom: '12px',
      }}>
        Dossiers
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {entities.map((item, i) => (
          <Link
            key={item.entity}
            href={`/topics/${encodeURIComponent(item.entity)}`}
            className="card-hover-lift"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < entities.length - 1 ? `1px solid ${theme.border}` : 'none',
              textDecoration: 'none',
              color: theme.text,
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <span>{item.entity}</span>
            <span style={{
              fontSize: '11px',
              color: theme.textSecondary,
              fontFamily: 'var(--font-mono)',
            }}>
              {item.count} synth.
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Featured Dossiers (promoted section with nexus causal preview) ───────────

interface DossierInfo {
  topic_name: string;
  synthesis_count: number;
  narrative_arc: string;
  is_active: boolean;
  key_entities: string[];
}

interface DossierCausalPreview {
  nodes: { id: string; label: string; type: string }[];
  edges: { source?: string; target?: string; cause_text?: string; effect_text?: string; relation_type?: string }[];
  total_nodes: number;
  total_edges: number;
}

function FeaturedDossiers({ theme }: { theme: Record<string, any> }) {
  const [dossiers, setDossiers] = useState<DossierInfo[]>([]);
  const [mainCausal, setMainCausal] = useState<DossierCausalPreview | null>(null);

  useEffect(() => {
    // Fetch top dossiers
    fetch(`${API_URL}/api/trending/recurring-topics`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const topics = (data?.topics || data || [])
          .filter((t: DossierInfo) => t.is_active)
          .sort((a: DossierInfo, b: DossierInfo) => b.synthesis_count - a.synthesis_count)
          .slice(0, 4);
        setDossiers(topics);

        // Fetch causal graph for top dossier
        if (topics.length > 0) {
          fetch(`${API_URL}/api/trending/topics/${encodeURIComponent(topics[0].topic_name)}/dashboard`)
            .then(r => r.ok ? r.json() : null)
            .then(dashboard => {
              if (dashboard?.aggregated_causal_graph?.total_nodes > 0) {
                setMainCausal(dashboard.aggregated_causal_graph);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  if (dossiers.length === 0) return null;

  const ARC_COLORS: Record<string, string> = {
    emerging: '#2563EB',
    developing: '#10B981',
    peak: '#DC2626',
    declining: '#F59E0B',
    resolved: '#6B7280',
  };

  const mainDossier = dossiers[0];
  const otherDossiers = dossiers.slice(1);

  return (
    <section style={{ marginBottom: '48px' }}>
      {/* Section header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '20px',
        paddingBottom: '10px',
        borderBottom: `3px solid ${theme.text}`,
      }}>
        <h2 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '20px',
          fontWeight: 700,
          color: theme.text,
          letterSpacing: '0.02em',
          margin: 0,
        }}>
          DOSSIERS
        </h2>
        <Link href="/topics" style={{
          fontSize: '13px',
          color: theme.textSecondary,
          textDecoration: 'none',
          fontWeight: 500,
        }}>
          Tous les dossiers &rarr;
        </Link>
      </div>

      {/* Grid: Main dossier with causal preview (2/3) + other dossiers (1/3) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mainCausal ? '2fr 1fr' : '1fr',
        gap: '24px',
      }}>
        {/* Main dossier with nexus causal */}
        <Link
          href={`/topics/${encodeURIComponent(mainDossier.topic_name)}`}
          style={{ textDecoration: 'none', color: theme.text, display: 'block' }}
        >
          <div
            className="card-hover-lift"
            style={{
              border: `1px solid ${theme.border}`,
              overflow: 'hidden',
              backgroundColor: theme.card,
            }}
          >
            {/* Nexus Causal Mini Preview */}
            {mainCausal && mainCausal.nodes.length > 0 && (
              <div style={{
                position: 'relative',
                height: '200px',
                backgroundColor: '#0A0F1A',
                overflow: 'hidden',
              }}>
                <svg
                  width="100%"
                  height="200"
                  viewBox="0 0 600 200"
                  style={{ display: 'block' }}
                >
                  {/* Grid pattern */}
                  <defs>
                    <pattern id="hp-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(59, 130, 246, 0.06)" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="600" height="200" fill="url(#hp-grid)" />

                  {/* Edges */}
                  {mainCausal.edges.slice(0, 12).map((edge, idx) => {
                    const srcNode = mainCausal.nodes.find(n => n.id === edge.source);
                    const tgtNode = mainCausal.nodes.find(n => n.id === edge.target);
                    if (!srcNode || !tgtNode) return null;
                    const srcIdx = mainCausal.nodes.indexOf(srcNode);
                    const tgtIdx = mainCausal.nodes.indexOf(tgtNode);
                    const total = Math.min(mainCausal.nodes.length, 12);
                    const sx = 50 + (srcIdx % total) * (500 / total);
                    const sy = 40 + Math.sin(srcIdx * 0.8) * 60 + 60;
                    const tx = 50 + (tgtIdx % total) * (500 / total);
                    const ty = 40 + Math.sin(tgtIdx * 0.8) * 60 + 60;
                    const edgeColor = edge.relation_type === 'causes' ? '#DC2626'
                      : edge.relation_type === 'triggers' ? '#F59E0B'
                      : edge.relation_type === 'enables' ? '#10B981' : '#6B7280';
                    return (
                      <line
                        key={idx}
                        x1={sx} y1={sy} x2={tx} y2={ty}
                        stroke={edgeColor}
                        strokeWidth={0.8}
                        opacity={0.4}
                      />
                    );
                  })}

                  {/* Nodes */}
                  {mainCausal.nodes.slice(0, 12).map((node, i) => {
                    const total = Math.min(mainCausal.nodes.length, 12);
                    const x = 50 + (i % total) * (500 / total);
                    const y = 40 + Math.sin(i * 0.8) * 60 + 60;
                    const color = node.type === 'event' ? '#DC2626'
                      : node.type === 'entity' ? '#3B82F6'
                      : node.type === 'decision' ? '#F59E0B' : '#10B981';
                    return (
                      <g key={node.id}>
                        <circle cx={x} cy={y} r={8} fill={color} opacity={0.2} />
                        <circle cx={x} cy={y} r={4} fill={color} opacity={0.8} />
                      </g>
                    );
                  })}

                  {/* Topic label */}
                  <text x="16" y="24" fill="rgba(255,255,255,0.5)" fontSize="10" fontWeight="700" letterSpacing="1.5">
                    NEXUS CAUSAL
                  </text>
                  <text x="16" y="42" fill="#FFFFFF" fontSize="16" fontWeight="700" fontFamily="Georgia, serif">
                    {mainDossier.topic_name}
                  </text>

                  {/* Stats */}
                  <text x="584" y="24" fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="end" fontFamily="monospace">
                    {mainCausal.total_nodes} noeuds  {mainCausal.total_edges} relations
                  </text>
                </svg>
              </div>
            )}

            {/* Dossier info */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}>
                <span style={{
                  backgroundColor: '#000',
                  color: '#FFF',
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                }}>
                  DOSSIER
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: ARC_COLORS[mainDossier.narrative_arc] || '#6B7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {mainDossier.narrative_arc === 'peak' ? 'Point culminant' :
                   mainDossier.narrative_arc === 'developing' ? 'En cours' :
                   mainDossier.narrative_arc === 'emerging' ? 'Emergent' : mainDossier.narrative_arc}
                </span>
              </div>
              <h3 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '22px',
                fontWeight: 700,
                color: theme.text,
                margin: '0 0 8px 0',
                lineHeight: 1.2,
              }}>
                {mainDossier.topic_name}
              </h3>
              <div style={{
                display: 'flex',
                gap: '12px',
                fontSize: '12px',
                color: theme.textSecondary,
              }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{mainDossier.synthesis_count} syntheses</span>
                {mainDossier.key_entities?.slice(0, 3).map((e, i) => (
                  <span key={i} style={{
                    padding: '1px 6px',
                    backgroundColor: `${theme.border}`,
                    fontSize: '11px',
                  }}>
                    {e}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Link>

        {/* Other dossiers list */}
        {otherDossiers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {otherDossiers.map((d, i) => (
              <Link
                key={d.topic_name}
                href={`/topics/${encodeURIComponent(d.topic_name)}`}
                className="card-hover-lift"
                style={{
                  display: 'block',
                  padding: '16px 0',
                  borderBottom: i < otherDossiers.length - 1 ? `1px solid ${theme.border}` : 'none',
                  textDecoration: 'none',
                  color: theme.text,
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px',
                }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: ARC_COLORS[d.narrative_arc] || '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {d.is_active ? 'EN COURS' : 'CLOS'}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: theme.textSecondary,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {d.synthesis_count} synth.
                  </span>
                </div>
                <h4 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: theme.text,
                  margin: '0 0 6px 0',
                  lineHeight: 1.3,
                }}>
                  {d.topic_name}
                </h4>
                {d.key_entities?.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {d.key_entities.slice(0, 3).map((e, ei) => (
                      <span key={ei} style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        backgroundColor: `${theme.border}`,
                        color: theme.textSecondary,
                      }}>
                        {e}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Editorial Card Variants ──────────────────────────────────────────────────

/** Featured card: large image (max 240px, 4:3), 20px Georgia title, 3-line summary, accent bar */
function FeaturedCategoryCard({ synthesis: s, theme, formatDate, accentColor }: {
  synthesis: SynthesisBrief;
  theme: Record<string, any>;
  formatDate: (d: string) => string;
  accentColor: string;
}) {
  return (
    <Link href={`/synthesis/${s.id}`} style={{ textDecoration: 'none' }}>
      <article
        className="card-hover-lift"
        style={{
          height: '100%',
          backgroundColor: theme.card,
          border: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {s.imageUrl && (
          <div style={{
            width: '100%',
            maxHeight: '240px',
            aspectRatio: '4 / 3',
            overflow: 'hidden',
            backgroundColor: '#F9FAFB',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.imageUrl}
              alt=""
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}
        <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${accentColor}` }}>
          <h3 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '20px',
            fontWeight: 700,
            lineHeight: 1.25,
            color: theme.text,
            margin: '0 0 10px 0',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {s.title}
          </h3>
          <p style={{
            fontSize: '14px',
            lineHeight: 1.55,
            color: theme.textSecondary,
            margin: '0 0 12px 0',
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {s.summary}
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
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

/** Text-only card: no image, 15px title + 2-line summary, borderBottom separator */
function TextOnlyCard({ synthesis: s, theme, formatDate }: {
  synthesis: SynthesisBrief;
  theme: Record<string, any>;
  formatDate: (d: string) => string;
}) {
  return (
    <Link href={`/synthesis/${s.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article
        className="card-hover-lift"
        style={{
          padding: '14px 0',
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <h3 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '15px',
          fontWeight: 600,
          lineHeight: 1.35,
          color: theme.text,
          margin: '0 0 6px 0',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {s.title}
        </h3>
        <p style={{
          fontSize: '13px',
          lineHeight: 1.5,
          color: theme.textSecondary,
          margin: '0 0 6px 0',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {s.summary}
        </p>
        <span style={{ fontSize: '11px', color: theme.textSecondary }}>{formatDate(s.createdAt)}</span>
      </article>
    </Link>
  );
}

/** Brief card: title only, 14px, vertical borderRight separator between siblings */
function BriefCard({ synthesis: s, theme, isLast }: {
  synthesis: SynthesisBrief;
  theme: Record<string, any>;
  isLast: boolean;
}) {
  return (
    <Link
      href={`/synthesis/${s.id}`}
      style={{
        textDecoration: 'none',
        flex: 1,
        padding: '12px 16px',
        borderRight: isLast ? 'none' : `1px solid ${theme.border}`,
        display: 'block',
      }}
    >
      <h4
        className="card-hover-lift"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '14px',
          fontWeight: 600,
          lineHeight: 1.35,
          color: theme.text,
          margin: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {s.title}
      </h4>
    </Link>
  );
}

/** EditorialCategoryGrid: L-shape pattern per category section */
function EditorialCategoryGrid({ items, theme, formatDate, accentColor }: {
  items: SynthesisBrief[];
  theme: Record<string, any>;
  formatDate: (d: string) => string;
  accentColor: string;
}) {
  // Fallback: if <= 2 items, just use CompactCards
  if (items.length <= 2) {
    return (
      <div className="category-grid">
        {items.map((s) => (
          <CompactCard key={s.id} synthesis={s} theme={theme} formatDate={formatDate} />
        ))}
      </div>
    );
  }

  const featured = items[0];
  const textCards = items.slice(1, 3);
  const briefs = items.slice(3);

  return (
    <div>
      {/* Top row: featured (2fr) + text-only stack (1fr) */}
      <div className="editorial-top-grid">
        <FeaturedCategoryCard
          synthesis={featured}
          theme={theme}
          formatDate={formatDate}
          accentColor={accentColor}
        />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {textCards.map((s) => (
            <TextOnlyCard key={s.id} synthesis={s} theme={theme} formatDate={formatDate} />
          ))}
        </div>
      </div>

      {/* Bottom row: briefs (title only, horizontal) */}
      {briefs.length > 0 && (
        <div className="editorial-briefs-row">
          {briefs.map((s, i) => (
            <BriefCard key={s.id} synthesis={s} theme={theme} isLast={i === briefs.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

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
            aspectRatio: '16 / 9',
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

        {/* Secondary Column (40%) - 2 text-only stacked cards */}
        <div className="flex flex-col gap-0">
          {secondarySyntheses.map((s) => (
            <Link key={s.id} href={`/synthesis/${s.id}`} style={{ textDecoration: 'none' }}>
              <article
                className="card-hover-lift"
                style={{
                  padding: '20px 0',
                  borderBottom: `1px solid ${theme.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Category */}
                {s.category && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: CATEGORY_COLORS[s.category] || theme.textSecondary,
                    marginBottom: '6px',
                  }}>
                    {s.category}
                  </span>
                )}

                {/* Title */}
                <h3 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '17px',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  color: theme.text,
                  margin: '0 0 8px 0',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
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
                  margin: '0 0 8px 0',
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
                  gap: '12px',
                  fontSize: '11px',
                  color: theme.textSecondary,
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{s.numSources} sources</span>
                  <span>{formatDate(s.createdAt)}</span>
                </div>
              </article>
            </Link>
          ))}

        </div>
      </section>

      {/* Featured Dossiers Section — Promote top dossiers with nexus preview */}
      <FeaturedDossiers theme={theme} />

      {/* Main content area: Categories (left) + Sidebar (right) */}
      {restSyntheses.length > 0 && (
        <section className="homepage-main-grid" style={{ marginBottom: '48px' }}>
          {/* Left: Syntheses grid */}
          <div>
            {apiCategory ? (
              /* Filtered view: flat grid */
              <>
                <div className="category-grid">
                  {restSyntheses.map((s) => (
                    <CompactCard key={s.id} synthesis={s} theme={theme} formatDate={formatDate} />
                  ))}
                </div>

                <div
                  ref={loadingRef}
                  style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', minHeight: '100px' }}
                >
                  {loadingMore && <LoadingSpinner theme={theme} />}
                  {!hasMore && syntheses.length > 7 && (
                    <p style={{ color: theme.textSecondary, fontSize: '14px' }}>Toutes les synthèses sont chargées</p>
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
                        <span style={{ fontSize: '13px', color: theme.textSecondary }}>
                          {categoryGroups[cat].length} analyse{categoryGroups[cat].length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <EditorialCategoryGrid
                        items={categoryGroups[cat]}
                        theme={theme}
                        formatDate={formatDate}
                        accentColor={CATEGORY_COLORS[cat] || theme.border}
                      />
                    </div>
                  ))}

                <div
                  ref={loadingRef}
                  style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', minHeight: '100px' }}
                >
                  {loadingMore && <LoadingSpinner theme={theme} />}
                  {!hasMore && syntheses.length > 7 && (
                    <p style={{ color: theme.textSecondary, fontSize: '14px' }}>Toutes les synthèses sont chargées</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right sidebar: Dossiers + Tendances (sticky) */}
          <aside className="homepage-sidebar" style={{ position: 'sticky', top: '100px', alignSelf: 'start' }}>
            {/* Dossiers section — vertical list of trending entities */}
            <SidebarDossiers theme={theme} />

            {/* Tendances */}
            <TrendingTopics />
          </aside>
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
