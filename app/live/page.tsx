"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useTheme } from '../contexts/ThemeContext';
import { synthesesService } from '../lib/api/services/syntheses';
import { Synthesis, SynthesisCategory } from '../types/api';
import { Header } from '../components/layout/Header';
import { NewsTicker } from '../components/layout/NewsTicker';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

const PAGE_SIZE = 20;

// Category colors
const CATEGORY_CONFIG: Record<SynthesisCategory, { emoji: string; color: string }> = {
  'MONDE': { emoji: '\u{1F30D}', color: '#2563EB' },
  'TECH': { emoji: '\u{1F4BB}', color: '#7C3AED' },
  'ECONOMIE': { emoji: '\u{1F4C8}', color: '#059669' },
  'POLITIQUE': { emoji: '\u{1F3DB}\u{FE0F}', color: '#DC2626' },
  'CULTURE': { emoji: '\u{1F3AD}', color: '#D97706' },
  'SPORT': { emoji: '\u{26BD}', color: '#0891B2' },
  'SCIENCES': { emoji: '\u{1F52C}', color: '#4F46E5' }
};

// Terminal message types and colors
const TERMINAL_TYPES = {
  SYS_POLL: '#2563EB',
  API_GATE: '#F59E0B',
  AUTH_SRV: '#06B6D4',
  WATCH_DOG: '#DC2626',
  PROC_MGR: '#71717A',
};

type TerminalType = keyof typeof TERMINAL_TYPES;

interface TerminalMessage {
  time: string;
  type: TerminalType;
  message: string;
  isResponse?: boolean;
}

function generateTerminalMessages(): TerminalMessage[] {
  const now = new Date();
  const messages: TerminalMessage[] = [];

  const templates: { type: TerminalType; msg: string; resp?: string }[] = [
    { type: 'SYS_POLL', msg: 'Scanning node cluster_09...', resp: 'Response received: 200 OK' },
    { type: 'API_GATE', msg: 'Validating ingress token [0xFA29]', resp: 'Token valid. TTL: 3584s' },
    { type: 'AUTH_SRV', msg: 'Session refresh for uid_8827', resp: 'JWT rotated. Exp: +1h' },
    { type: 'WATCH_DOG', msg: 'Heartbeat check: qdrant_primary', resp: 'Latency: 12ms | Status: HEALTHY' },
    { type: 'SYS_POLL', msg: 'Indexing new embeddings batch_412...', resp: 'Indexed 847 vectors in 2.3s' },
    { type: 'PROC_MGR', msg: 'Pipeline worker_03 utilization: 78%' },
    { type: 'API_GATE', msg: 'Rate limit check: 142/500 req/min' },
    { type: 'AUTH_SRV', msg: 'CORS preflight: novapressai.com', resp: 'Origin allowed. Methods: GET,POST' },
    { type: 'WATCH_DOG', msg: 'Memory probe: redis_cache', resp: 'Used: 1.2GB/4GB | Keys: 24,891' },
    { type: 'SYS_POLL', msg: 'Dedup scan: checking hash_table_07...', resp: 'Duplicates purged: 3' },
    { type: 'PROC_MGR', msg: 'Cron job synthesis_gen: next run in 847s' },
    { type: 'API_GATE', msg: 'Webhook delivery: event_new_synthesis', resp: 'Delivered to 2/2 subscribers' },
    { type: 'SYS_POLL', msg: 'BGE-M3 model health: inference test', resp: 'Cosine sim: 0.9412 | PASS' },
    { type: 'WATCH_DOG', msg: 'SSL cert expiry check: novapressai.com', resp: 'Valid. Expires: 2026-09-14' },
    { type: 'PROC_MGR', msg: 'Scraper pool: 12/16 workers active' },
  ];

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const msgTime = new Date(now.getTime() - (templates.length - i) * 17000);
    const timeStr = msgTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    messages.push({ time: timeStr, type: t.type, message: t.msg });
    if (t.resp) {
      messages.push({ time: timeStr, type: t.type, message: t.resp, isResponse: true });
    }
  }

  return messages;
}

// Time filter config
const TIME_FILTERS = [
  { label: '24H', hours: 24 },
  { label: '72H', hours: 72 },
  { label: '7D', hours: 168 },
];

export default function LivePage() {
  const { theme, typography } = useTheme();
  const [syntheses, setSyntheses] = useState<Synthesis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHours, setSelectedHours] = useState(24);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [newAlertCount, setNewAlertCount] = useState(0);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  const terminalMessages = useMemo(() => generateTerminalMessages(), []);

  const serifFont = typography.fonts.serif;
  const monoFont = typography.fonts.mono;
  const sansFont = typography.fonts.sans;

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
      setError('Unable to load live intelligence feed. Please retry.');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // Initial fetch and when hours change
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setOffset(0);
    setHasMore(true);
    fetchLiveSyntheses(0, selectedHours, false, abortController.signal);

    // Auto-refresh every 15 seconds
    const interval = setInterval(() => {
      if (!abortController.signal.aborted) {
        setOffset(0);
        setHasMore(true);
        fetchLiveSyntheses(0, selectedHours, false, abortController.signal);
      }
    }, 15 * 1000);

    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, [selectedHours, fetchLiveSyntheses]);

  // Scroll terminal to bottom on mount
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalMessages]);

  // Track new alerts
  useEffect(() => {
    if (syntheses.length > 0) {
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const recent = syntheses.filter(s => new Date(s.createdAt).getTime() > fiveMinAgo);
      setNewAlertCount(recent.length);
    }
  }, [syntheses]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchLiveSyntheses(offset, selectedHours, true, abortControllerRef.current?.signal);
    }
  }, [offset, selectedHours, loadingMore, hasMore, fetchLiveSyntheses]);

  const { loadingRef } = useInfiniteScroll({
    hasNextPage: hasMore,
    isFetching: loadingMore,
    fetchNextPage: loadMore,
  });

  const formatTimeUTC = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
    }) + ' UTC';
  };

  const getConfidenceScore = (synthesis: Synthesis) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const score = (synthesis as any).transparencyScore || synthesis.numSources * 12 + 40;
    return Math.min(98, Math.max(60, score));
  };

  const getImpactLevel = (synthesis: Synthesis) => {
    const sources = synthesis.numSources || 1;
    if (sources >= 8) return 'Critical';
    if (sources >= 5) return 'High';
    if (sources >= 3) return 'Medium';
    return 'Low';
  };

  const isNewest = (synthesis: Synthesis, index: number) => index < 3;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <Header />
      <NewsTicker />

      {/* Page container */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '48px 24px 120px',
      }}>

        {/* ===== HEADER SECTION ===== */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '48px',
          flexWrap: 'wrap',
          gap: '24px',
        }}>
          {/* Left side */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#DC2626',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'livePulse 2s infinite',
              }} />
              <span style={{
                fontFamily: monoFont,
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                color: theme.textSecondary,
              }}>
                Live Intelligence Stream
              </span>
            </div>
            <h1 style={{
              fontFamily: serifFont,
              fontSize: '48px',
              fontWeight: '700',
              fontStyle: 'italic',
              color: theme.text,
              margin: 0,
              lineHeight: 1.1,
            }}>
              The Real-Time Briefing
            </h1>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
            <span style={{
              fontFamily: monoFont,
              fontSize: '10px',
              color: theme.textSecondary,
              letterSpacing: '1px',
            }}>
              Auto-refresh active: 15s
            </span>
            <div style={{
              display: 'flex',
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              padding: '2px',
              gap: '0',
            }}>
              {TIME_FILTERS.map((filter) => (
                <button
                  key={filter.hours}
                  onClick={() => setSelectedHours(filter.hours)}
                  style={{
                    padding: '6px 16px',
                    border: 'none',
                    borderRadius: '3px',
                    backgroundColor: selectedHours === filter.hours ? '#2563EB' : 'transparent',
                    color: selectedHours === filter.hours ? '#FFFFFF' : '#71717A',
                    fontFamily: monoFont,
                    fontSize: '11px',
                    fontWeight: '600',
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ===== TWO-COLUMN LAYOUT ===== */}
        <div style={{
          display: 'flex',
          gap: '32px',
          alignItems: 'flex-start',
        }}>

          {/* ===== MAIN FEED ===== */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Error state */}
            {error && (
              <div style={{
                padding: '16px 20px',
                backgroundColor: theme.errorBg,
                border: `1px solid ${theme.error}`,
                color: theme.error,
                fontFamily: monoFont,
                fontSize: '13px',
                marginBottom: '24px',
              }}>
                {error}
              </div>
            )}

            {/* Loading state */}
            {isLoading && syntheses.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 0' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: `2px solid ${theme.border}`,
                  borderTopColor: '#2563EB',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px',
                }} />
                <p style={{ color: theme.textSecondary, fontFamily: monoFont, fontSize: '12px' }}>
                  Initializing feed...
                </p>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && syntheses.length === 0 && !error && (
              <div style={{
                textAlign: 'center',
                padding: '80px 0',
                borderTop: `1px solid ${theme.border}`,
                borderBottom: `1px solid ${theme.border}`,
              }}>
                <p style={{
                  fontFamily: monoFont,
                  fontSize: '12px',
                  color: theme.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                }}>
                  No intelligence data for this period
                </p>
              </div>
            )}

            {/* ===== FEED CARDS ===== */}
            {syntheses.map((synthesis, index) => {
              const config = CATEGORY_CONFIG[synthesis.category] || CATEGORY_CONFIG['MONDE'];
              const isHovered = hoveredCardId === synthesis.id;
              const newest = isNewest(synthesis, index);

              return (
                <Link
                  key={synthesis.id}
                  href={`/synthesis/${synthesis.id}`}
                  style={{ textDecoration: 'none', display: 'block' }}
                >
                  <article
                    onMouseEnter={() => setHoveredCardId(synthesis.id)}
                    onMouseLeave={() => setHoveredCardId(null)}
                    style={{
                      display: 'flex',
                      gap: '32px',
                      padding: '28px 0',
                      borderBottom: `1px solid ${theme.border}`,
                      transition: 'all 0.2s ease',
                      opacity: isHovered ? 1 : 0.92,
                    }}
                  >
                    {/* Image */}
                    {synthesis.imageUrl && (
                      <div style={{
                        width: '192px',
                        minWidth: '192px',
                        aspectRatio: '4/3',
                        overflow: 'hidden',
                        backgroundColor: theme.bgSecondary,
                      }}>
                        <img
                          src={synthesis.imageUrl}
                          alt=""
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            filter: isHovered ? 'grayscale(0%)' : 'grayscale(100%)',
                            transition: 'filter 0.4s ease',
                          }}
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Timestamp row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '8px',
                      }}>
                        <span style={{
                          borderLeft: `2px solid ${config.color}`,
                          paddingLeft: '8px',
                          fontFamily: monoFont,
                          fontSize: '10px',
                          color: theme.textSecondary,
                          letterSpacing: '1px',
                        }}>
                          {formatTimeUTC(synthesis.createdAt)}
                        </span>
                        <span style={{
                          fontFamily: monoFont,
                          fontSize: '10px',
                          fontWeight: '600',
                          color: config.color,
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                        }}>
                          {synthesis.category}
                        </span>
                        {newest && (
                          <span style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: '#DC2626',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'livePulse 2s infinite',
                          }} />
                        )}
                      </div>

                      {/* Title */}
                      <h2 style={{
                        fontFamily: serifFont,
                        fontSize: '24px',
                        fontWeight: '700',
                        color: theme.text,
                        margin: '0 0 10px 0',
                        lineHeight: 1.3,
                        textDecoration: isHovered ? 'underline' : 'none',
                        textDecorationColor: isHovered ? config.color : 'transparent',
                        textDecorationThickness: '2px',
                        textUnderlineOffset: '4px',
                        transition: 'text-decoration-color 0.2s ease',
                      }}>
                        {synthesis.title}
                      </h2>

                      {/* Description */}
                      <p style={{
                        fontFamily: sansFont,
                        fontSize: '14px',
                        color: theme.textSecondary,
                        margin: '0 0 12px 0',
                        lineHeight: 1.6,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {synthesis.summary}
                      </p>

                      {/* Metrics */}
                      <div style={{
                        display: 'flex',
                        gap: '16px',
                      }}>
                        <span style={{
                          fontFamily: monoFont,
                          fontSize: '9px',
                          color: '#71717A',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                        }}>
                          Confidence: {getConfidenceScore(synthesis)}%
                        </span>
                        <span style={{
                          fontFamily: monoFont,
                          fontSize: '9px',
                          color: '#71717A',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                        }}>
                          Impact: {getImpactLevel(synthesis)}
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}

            {/* Infinite Scroll Trigger */}
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
                  fontFamily: monoFont,
                  fontSize: '11px',
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: `2px solid ${theme.border}`,
                    borderTopColor: '#2563EB',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  Loading more...
                </div>
              )}
              {!hasMore && syntheses.length > 0 && (
                <p style={{
                  color: theme.textSecondary,
                  fontFamily: monoFont,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                }}>
                  End of feed
                </p>
              )}
            </div>
          </div>

          {/* ===== TERMINAL SIDEBAR ===== */}
          <aside style={{
            width: '320px',
            minWidth: '320px',
            position: 'sticky',
            top: '100px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#0A0A0A',
            border: `1px solid ${theme.border}`,
            height: 'calc(100vh - 200px)',
            overflow: 'hidden',
          }}
            className="terminal-sidebar"
          >
            {/* Terminal header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #27272A',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#2563EB',
                  display: 'inline-block',
                }} />
                <span style={{
                  fontFamily: monoFont,
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#E4E4E7',
                  letterSpacing: '0.5px',
                }}>
                  Live Monitor
                </span>
              </div>
              <span style={{
                fontFamily: monoFont,
                fontSize: '9px',
                color: '#71717A',
                letterSpacing: '0.5px',
              }}>
                Buffer: 4.2GB/s
              </span>
            </div>

            {/* Terminal log area */}
            <div
              ref={terminalRef}
              className="terminal-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {terminalMessages.map((msg, i) => (
                <div key={i} style={{
                  fontFamily: monoFont,
                  fontSize: '10px',
                  lineHeight: 1.6,
                  color: msg.isResponse ? '#A1A1AA' : (TERMINAL_TYPES[msg.type] || '#71717A'),
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {msg.isResponse ? (
                    <span>{'  >> '}{msg.message}</span>
                  ) : (
                    <span>
                      <span style={{ color: '#52525B' }}>[{msg.time}]</span>
                      {' '}
                      <span style={{ color: TERMINAL_TYPES[msg.type] }}>{msg.type}</span>
                      {': '}
                      {msg.message}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Console footer */}
            <div style={{
              borderTop: '1px solid #27272A',
              padding: '10px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#22C55E',
                  borderRadius: '50%',
                  display: 'inline-block',
                }} />
                <span style={{
                  fontFamily: monoFont,
                  fontSize: '9px',
                  color: '#22C55E',
                  letterSpacing: '0.5px',
                }}>
                  Console Online
                </span>
              </div>
              <div style={{
                backgroundColor: '#000000',
                padding: '8px 12px',
                fontFamily: monoFont,
                fontSize: '11px',
                color: '#A1A1AA',
              }}>
                <span style={{ color: '#22C55E' }}>root@novapress_ai</span>
                <span style={{ color: '#71717A' }}>:</span>
                <span style={{ color: '#2563EB' }}>~</span>
                <span style={{ color: '#71717A' }}>$ </span>
                <span style={{ animation: 'blink 1s step-end infinite', color: '#E4E4E7' }}>_</span>
              </div>
            </div>
          </aside>
        </div>

        {/* Back to home */}
        <div style={{
          marginTop: '40px',
          paddingTop: '20px',
          borderTop: `1px solid ${theme.border}`,
          textAlign: 'center',
        }}>
          <Link
            href="/"
            style={{
              fontFamily: monoFont,
              color: theme.textSecondary,
              textDecoration: 'none',
              fontSize: '11px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            Back to home
          </Link>
        </div>
      </div>

      {/* ===== FAB BUTTON ===== */}
      {newAlertCount > 0 && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed',
            bottom: '32px',
            right: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 24px',
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '50px',
            fontFamily: monoFont,
            fontSize: '12px',
            fontWeight: '600',
            letterSpacing: '0.5px',
            cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(37, 99, 235, 0.4)',
            transition: 'all 0.2s ease',
            zIndex: 50,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          New Alert
        </button>
      )}

      {/* Animations */}
      <style jsx>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        /* Terminal scrollbar */
        .terminal-scroll::-webkit-scrollbar {
          width: 2px;
        }
        .terminal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .terminal-scroll::-webkit-scrollbar-thumb {
          background: #2563EB;
          border-radius: 1px;
        }

        /* Hide terminal sidebar on mobile */
        @media (max-width: 1024px) {
          .terminal-sidebar {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
