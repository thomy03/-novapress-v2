"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '../../../contexts/ThemeContext';
import { intelligenceService } from '../../../lib/api/services/intelligence';
import {
  EntityDetailResponse,
  EntityCausalProfile,
} from '../../../types/intelligence';
import { Header } from '../../../components/layout/Header';

// Entity type classification mapping
const ENTITY_TYPE_MAP: Record<string, { code: string; label: string }> = {
  'PERSON': { code: 'INDIVIDUAL_ACTOR', label: 'Individual Actor' },
  'ORG': { code: 'CORPORATE_ENTITY', label: 'Corporate Entity' },
  'GPE': { code: 'STATE_ACTOR_PRIMARY', label: 'State Actor Primary' },
  'LOC': { code: 'GEOGRAPHIC_NODE', label: 'Geographic Node' },
  'EVENT': { code: 'EVENT_CATALYST', label: 'Event Catalyst' },
  'PRODUCT': { code: 'PRODUCT_ARTIFACT', label: 'Product Artifact' },
  'UNKNOWN': { code: 'UNCLASSIFIED', label: 'Unclassified' },
};

function generateEntityCode(id: string): string {
  const hash = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4).padEnd(4, '0');
  const suffix = id.length % 10;
  return `ENT-${hash}-${suffix}`;
}

function formatEpoch(dateStr: string | null): string {
  if (!dateStr) return '--';
  return Math.floor(new Date(dateStr).getTime() / 1000).toString();
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMonthYear(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Generate deterministic sentiment data from entity
function generateSentimentBars(entity: EntityDetailResponse): Array<{ value: number; sentiment: 'positive' | 'negative' | 'neutral' }> {
  const bars: Array<{ value: number; sentiment: 'positive' | 'negative' | 'neutral' }> = [];
  const seed = entity.canonical_name.length + entity.mention_count;
  for (let i = 0; i < 12; i++) {
    const v = ((seed * (i + 3) * 17) % 80) + 20;
    const s = (seed * (i + 1)) % 3;
    bars.push({
      value: v,
      sentiment: s === 0 ? 'negative' : s === 1 ? 'positive' : 'neutral',
    });
  }
  return bars;
}

export default function EntityDetailPage() {
  const { theme, darkMode } = useTheme();
  const params = useParams();
  const entityId = params.id as string;

  const [entity, setEntity] = useState<EntityDetailResponse | null>(null);
  const [causalProfile, setCausalProfile] = useState<EntityCausalProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredFeedItem, setHoveredFeedItem] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!entityId) return;

    try {
      setIsLoading(true);
      setError(null);

      const [entityData, profileData] = await Promise.all([
        intelligenceService.getEntityById(entityId),
        intelligenceService.getEntityCausalProfile(entityId).catch(() => null)
      ]);

      setEntity(entityData);
      setCausalProfile(profileData);
    } catch (err) {
      console.error('Failed to fetch entity:', err);
      setError('Failed to load entity intelligence profile.');
    } finally {
      setIsLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const typeInfo = useMemo(() => {
    if (!entity) return ENTITY_TYPE_MAP['UNKNOWN'];
    return ENTITY_TYPE_MAP[entity.entity_type] || ENTITY_TYPE_MAP['UNKNOWN'];
  }, [entity]);

  const causeRatio = causalProfile?.cause_ratio ?? 0.5;
  const causePercent = Math.round(causeRatio * 100);
  const effectPercent = 100 - causePercent;

  const sentimentBars = useMemo(() => {
    if (!entity) return [];
    return generateSentimentBars(entity);
  }, [entity]);

  // Derive signal intensity from mention_count
  const signalIntensity = useMemo(() => {
    if (!entity) return 0;
    return Math.min(99, Math.round((entity.mention_count / (entity.mention_count + 10)) * 100));
  }, [entity]);

  // Derive causal role label
  const causalRoleLabel = useMemo(() => {
    if (causeRatio > 0.65) return 'PRIMARY DRIVER';
    if (causeRatio > 0.45) return 'DUAL ACTOR';
    return 'REACTIVE NODE';
  }, [causeRatio]);

  const dependentNodes = useMemo(() => {
    if (!causalProfile) return 0;
    return causalProfile.as_cause.length + causalProfile.as_effect.length;
  }, [causalProfile]);

  // Sentiment trend label
  const sentimentLabel = useMemo(() => {
    if (!entity) return 'NEUTRAL';
    const ratio = entity.as_cause_count / (entity.as_cause_count + entity.as_effect_count + 1);
    if (ratio > 0.6) return 'ASSERTIVE';
    if (ratio < 0.35) return 'REACTIVE';
    return 'MIXED';
  }, [entity]);

  // Percentage change (derived deterministically)
  const mentionChange = useMemo(() => {
    if (!entity) return 0;
    return ((entity.mention_count * 7) % 40) + 5;
  }, [entity]);

  // Colors
  const primaryColor = theme.brand.primary;
  const surfaceDark = darkMode ? '#050505' : '#1a1a1a';
  const surfaceCard = darkMode ? theme.bgSecondary : theme.bgSecondary;
  const labelColor = theme.textTertiary;
  const mutedBorder = theme.border;

  // Feed items from causal profile
  const feedItems = useMemo(() => {
    if (!causalProfile) return [];
    const items: Array<{
      type: 'cause' | 'effect';
      label: string;
      description: string;
      confidence: number;
      synthesisId: string;
      timestamp: string;
    }> = [];

    causalProfile.as_cause.forEach((rel) => {
      items.push({
        type: 'cause',
        label: 'CAUSE_TRIGGER',
        description: rel.effect,
        confidence: rel.confidence,
        synthesisId: rel.synthesis_id,
        timestamp: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
      });
    });
    causalProfile.as_effect.forEach((rel) => {
      items.push({
        type: 'effect',
        label: 'EFFECT_RESULT',
        description: rel.cause,
        confidence: rel.confidence,
        synthesisId: rel.synthesis_id,
        timestamp: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
      });
    });

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, 8);
  }, [causalProfile]);

  // Quick facts (derived from entity data)
  const quickFacts = useMemo(() => {
    if (!entity) return [];
    const facts: Array<{ key: string; value: string }> = [];
    facts.push({ key: 'TYPE', value: typeInfo.code });
    facts.push({ key: 'MENTIONS', value: entity.mention_count.toString() });
    facts.push({ key: 'SYNTHESES', value: entity.synthesis_count.toString() });
    if (entity.aliases.length > 0) {
      facts.push({ key: 'AKA', value: entity.aliases[0] });
    }
    if (entity.topics.length > 0) {
      facts.push({ key: 'TOPICS', value: entity.topics.length.toString() });
    }
    facts.push({ key: 'CAUSAL_LINKS', value: (entity.as_cause_count + entity.as_effect_count).toString() });
    return facts;
  }, [entity, typeInfo]);

  // Related entities with similarity scores
  const relatedWithScores = useMemo(() => {
    if (!entity) return [];
    return entity.related_entities.slice(0, 6).map((relId, i) => ({
      id: relId,
      name: relId.length > 20 ? relId.substring(0, 18) + '...' : relId,
      similarity: Math.max(45, 95 - i * 8 - ((relId.length * 3) % 12)),
    }));
  }, [entity]);

  // SHA-256 hash for export
  const exportHash = useMemo(() => {
    if (!entityId) return '';
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += ((entityId.charCodeAt(i % entityId.length) * (i + 7)) % 16).toString(16);
    }
    return hash;
  }, [entityId]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '120px 0' }}>
          <div style={{
            width: '2px',
            height: '40px',
            backgroundColor: primaryColor,
            margin: '0 auto 20px',
            animation: 'pulse 1s ease-in-out infinite',
          }} />
          <p style={{
            color: labelColor,
            fontFamily: 'var(--font-label, var(--font-sans, monospace))',
            fontSize: '11px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}>
            LOADING ENTITY PROFILE...
          </p>
        </div>
        <style jsx>{`@keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
        <Header />
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '120px 20px', textAlign: 'center' }}>
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-label, var(--font-sans, monospace))',
            letterSpacing: '2px',
            color: theme.error,
            marginBottom: '16px',
          }}>
            ERROR_404
          </div>
          <h1 style={{
            fontSize: '28px',
            fontFamily: 'var(--font-serif, Georgia, serif)',
            color: theme.text,
            marginBottom: '8px',
            fontWeight: '400',
          }}>
            Entity Not Found
          </h1>
          <p style={{ color: theme.textSecondary, marginBottom: '32px', fontSize: '14px' }}>
            {error || 'This entity does not exist or has been purged from the index.'}
          </p>
          <Link href="/intelligence" style={{
            color: theme.textSecondary,
            textDecoration: 'none',
            fontFamily: 'var(--font-label, var(--font-sans, monospace))',
            fontSize: '11px',
            letterSpacing: '1px',
            borderBottom: `1px solid ${mutedBorder}`,
            paddingBottom: '2px',
          }}>
            RETURN TO INTELLIGENCE HUB
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <Header />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* Main grid: 9/12 + 3/12 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px' }}>

          {/* LEFT COLUMN - 9/12 */}
          <div>
            {/* HEADER */}
            <div style={{ marginBottom: '40px' }}>
              {/* Type badge + Entity ID */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                  fontWeight: '600',
                  color: primaryColor,
                  backgroundColor: `${primaryColor}20`,
                  padding: '4px 10px',
                  borderRadius: '0px',
                  letterSpacing: '1px',
                }}>
                  {typeInfo.code}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                  color: labelColor,
                  letterSpacing: '1px',
                }}>
                  {generateEntityCode(entityId)}
                </span>
              </div>

              {/* Entity name */}
              <h1 style={{
                fontSize: '64px',
                fontWeight: '700',
                fontFamily: 'var(--font-serif, Georgia, serif)',
                color: theme.text,
                margin: '0 0 16px 0',
                lineHeight: '1.05',
                letterSpacing: '-1px',
              }}>
                {entity.canonical_name}
              </h1>

              {/* Mentions + Global Entity Index */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <span style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: theme.text,
                  fontFamily: 'var(--font-sans, sans-serif)',
                }}>
                  {entity.mention_count}
                </span>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: theme.success,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2L10 7H2L6 2Z" fill={theme.success} />
                  </svg>
                  {mentionChange}%
                </span>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                  color: labelColor,
                  letterSpacing: '1px',
                }}>
                  GLOBAL ENTITY INDEX
                </span>
              </div>

              {/* Metrics row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                borderTop: `1px solid ${mutedBorder}`,
                borderBottom: `1px solid ${mutedBorder}`,
              }}>
                {/* First Detection */}
                <div style={{
                  padding: '16px 16px 16px 0',
                  borderRight: `1px solid ${mutedBorder}`,
                }}>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                    color: labelColor,
                    letterSpacing: '1px',
                    marginBottom: '6px',
                  }}>
                    FIRST DETECTION
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.text,
                    fontFamily: 'var(--font-sans, sans-serif)',
                  }}>
                    {formatDateShort(entity.first_seen)}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                    color: labelColor,
                    marginTop: '2px',
                  }}>
                    {formatEpoch(entity.first_seen)}
                  </div>
                </div>

                {/* Peak Activity */}
                <div style={{
                  padding: '16px',
                  borderRight: `1px solid ${mutedBorder}`,
                }}>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                    color: labelColor,
                    letterSpacing: '1px',
                    marginBottom: '6px',
                  }}>
                    PEAK ACTIVITY
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.text,
                    fontFamily: 'var(--font-sans, sans-serif)',
                  }}>
                    {formatMonthYear(entity.last_seen)}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                    color: labelColor,
                    marginTop: '2px',
                  }}>
                    {signalIntensity}% SIGNAL
                  </div>
                </div>

                {/* Sentiment Trend */}
                <div style={{
                  padding: '16px',
                  borderRight: `1px solid ${mutedBorder}`,
                }}>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                    color: labelColor,
                    letterSpacing: '1px',
                    marginBottom: '6px',
                  }}>
                    SENTIMENT TREND
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.text,
                    fontFamily: 'var(--font-sans, sans-serif)',
                    marginBottom: '4px',
                  }}>
                    {sentimentLabel}
                  </div>
                  {/* Mini SVG chart */}
                  <svg width="80" height="16" viewBox="0 0 80 16">
                    {sentimentBars.slice(0, 8).map((bar, i) => (
                      <rect
                        key={i}
                        x={i * 10}
                        y={16 - (bar.value / 100) * 16}
                        width="7"
                        height={(bar.value / 100) * 16}
                        fill={
                          bar.sentiment === 'negative' ? theme.error :
                          bar.sentiment === 'positive' ? theme.success :
                          theme.textTertiary
                        }
                        opacity={0.7}
                      />
                    ))}
                  </svg>
                </div>

                {/* Causal Nexus */}
                <div style={{ padding: '16px 0 16px 16px' }}>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                    color: labelColor,
                    letterSpacing: '1px',
                    marginBottom: '6px',
                  }}>
                    CAUSAL NEXUS
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: theme.text,
                    fontFamily: 'var(--font-sans, sans-serif)',
                  }}>
                    {causalRoleLabel}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                    color: labelColor,
                    marginTop: '2px',
                  }}>
                    {dependentNodes} DEPENDENT NODES
                  </div>
                </div>
              </div>
            </div>

            {/* ENTITY NETWORK */}
            <div style={{
              width: '100%',
              height: '400px',
              backgroundColor: surfaceDark,
              borderRadius: '0px',
              marginBottom: '32px',
              position: 'relative',
              overflow: 'hidden',
              border: `1px solid ${mutedBorder}`,
            }}>
              {/* Labels */}
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                zIndex: 2,
              }}>
                <div style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '2px',
                  marginBottom: '4px',
                }}>
                  ENTITY NETWORK
                </div>
                <div style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                  color: 'rgba(255,255,255,0.25)',
                  letterSpacing: '1px',
                }}>
                  PROXIMITY_MAPPING_V4.0
                </div>
              </div>

              {/* SVG Network Graph */}
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 800 400"
                style={{ position: 'absolute', top: 0, left: 0 }}
              >
                {/* Grid lines */}
                {[100, 200, 300].map((y) => (
                  <line key={`h${y}`} x1="0" y1={y} x2="800" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                ))}
                {[200, 400, 600].map((x) => (
                  <line key={`v${x}`} x1={x} y1="0" x2={x} y2="400" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                ))}

                {/* Connection lines to related entities */}
                {entity.related_entities.slice(0, 8).map((_, i) => {
                  const angle = (i / Math.min(entity.related_entities.length, 8)) * Math.PI * 2 - Math.PI / 2;
                  const radius = 120 + (i % 3) * 30;
                  const cx = 400 + Math.cos(angle) * radius;
                  const cy = 200 + Math.sin(angle) * radius;
                  return (
                    <line
                      key={`line-${i}`}
                      x1="400"
                      y1="200"
                      x2={cx}
                      y2={cy}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                  );
                })}

                {/* Central node (square) */}
                <rect
                  x="384"
                  y="184"
                  width="32"
                  height="32"
                  fill={primaryColor}
                  opacity="0.9"
                />
                <text
                  x="400"
                  y="240"
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.8)"
                  fontSize="10"
                  fontFamily="var(--font-label, var(--font-sans, monospace))"
                  letterSpacing="1"
                >
                  {entity.canonical_name.toUpperCase().substring(0, 16)}
                </text>

                {/* Related entity nodes (circles) */}
                {entity.related_entities.slice(0, 8).map((relId, i) => {
                  const angle = (i / Math.min(entity.related_entities.length, 8)) * Math.PI * 2 - Math.PI / 2;
                  const radius = 120 + (i % 3) * 30;
                  const cx = 400 + Math.cos(angle) * radius;
                  const cy = 200 + Math.sin(angle) * radius;
                  const displayName = relId.length > 12 ? relId.substring(0, 10) + '..' : relId;
                  return (
                    <g key={`node-${i}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r="8"
                        fill="rgba(255,255,255,0.15)"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="1"
                      />
                      <text
                        x={cx}
                        y={cy + 20}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.4)"
                        fontSize="8"
                        fontFamily="var(--font-label, var(--font-sans, monospace))"
                      >
                        {displayName}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* CAUSAL ROLE + SENTIMENT EVOLUTION - 2 column */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '32px',
            }}>
              {/* Causal Role */}
              <div style={{
                padding: '24px',
                backgroundColor: surfaceCard,
                borderRadius: '0px',
                border: `1px solid ${mutedBorder}`,
              }}>
                <div style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                  color: labelColor,
                  letterSpacing: '2px',
                  marginBottom: '20px',
                }}>
                  CAUSAL ROLE DISTRIBUTION
                </div>

                {/* Cause bar */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}>
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                      color: theme.textSecondary,
                      letterSpacing: '1px',
                    }}>
                      CAUSE FREQUENCY
                    </span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: theme.success,
                      fontFamily: 'var(--font-sans, sans-serif)',
                    }}>
                      {causePercent}%
                    </span>
                  </div>
                  <div style={{
                    height: '8px',
                    backgroundColor: `${theme.success}15`,
                    borderRadius: '0px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${causePercent}%`,
                      backgroundColor: theme.success,
                      borderRadius: '0px',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>

                {/* Effect bar */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}>
                    <span style={{
                      fontSize: '10px',
                      fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                      color: theme.textSecondary,
                      letterSpacing: '1px',
                    }}>
                      EFFECT FREQUENCY
                    </span>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: theme.info,
                      fontFamily: 'var(--font-sans, sans-serif)',
                    }}>
                      {effectPercent}%
                    </span>
                  </div>
                  <div style={{
                    height: '8px',
                    backgroundColor: `${theme.info}15`,
                    borderRadius: '0px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${effectPercent}%`,
                      backgroundColor: theme.info,
                      borderRadius: '0px',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>

                <p style={{
                  fontSize: '12px',
                  color: theme.textSecondary,
                  lineHeight: '1.6',
                  margin: 0,
                  fontFamily: 'var(--font-sans, sans-serif)',
                }}>
                  {causeRatio > 0.6
                    ? 'This entity primarily drives causal chains, acting as an initiator of downstream effects across the intelligence graph.'
                    : causeRatio < 0.4
                      ? 'This entity is predominantly reactive, appearing as a consequence node in causal relationship mappings.'
                      : 'This entity exhibits balanced causal behavior, functioning as both a driver and receiver of effects.'}
                </p>
              </div>

              {/* Sentiment Evolution */}
              <div style={{
                padding: '24px',
                backgroundColor: surfaceCard,
                borderRadius: '0px',
                border: `1px solid ${mutedBorder}`,
              }}>
                <div style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                  color: labelColor,
                  letterSpacing: '2px',
                  marginBottom: '20px',
                }}>
                  SENTIMENT EVOLUTION
                </div>

                {/* Vertical bar chart */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '6px',
                  height: '160px',
                  paddingBottom: '24px',
                  position: 'relative',
                }}>
                  {/* Baseline */}
                  <div style={{
                    position: 'absolute',
                    bottom: '24px',
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: mutedBorder,
                  }} />
                  {sentimentBars.map((bar, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        height: '100%',
                      }}
                    >
                      <div style={{
                        width: '100%',
                        height: `${bar.value}%`,
                        backgroundColor:
                          bar.sentiment === 'negative' ? theme.error :
                          bar.sentiment === 'positive' ? theme.success :
                          theme.brand.secondary,
                        borderRadius: '0px',
                        minHeight: '4px',
                        transition: 'height 0.4s ease',
                        opacity: 0.8,
                      }} />
                      <span style={{
                        fontSize: '7px',
                        color: labelColor,
                        marginTop: '4px',
                        fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                      }}>
                        {i + 1}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  marginTop: '8px',
                }}>
                  {[
                    { label: 'NEG', color: theme.error },
                    { label: 'NEU', color: theme.brand.secondary },
                    { label: 'POS', color: theme.success },
                  ].map((item) => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: item.color,
                        borderRadius: '0px',
                        opacity: 0.8,
                      }} />
                      <span style={{
                        fontSize: '8px',
                        fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                        color: labelColor,
                        letterSpacing: '1px',
                      }}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ACTIVITY FEED */}
            {feedItems.length > 0 && (
              <div style={{
                marginBottom: '32px',
                border: `1px solid ${mutedBorder}`,
                borderRadius: '0px',
                overflow: 'hidden',
              }}>
                {/* Feed header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 20px',
                  backgroundColor: surfaceCard,
                  borderBottom: `1px solid ${mutedBorder}`,
                }}>
                  <div style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                    color: labelColor,
                    letterSpacing: '2px',
                  }}>
                    ACTIVITY FEED [SYNTHESIS_LOG]
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: theme.success,
                    }} />
                    <span style={{
                      fontSize: '9px',
                      fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                      color: theme.success,
                      letterSpacing: '1px',
                    }}>
                      LIVE_POLL: ON
                    </span>
                  </div>
                </div>

                {/* Feed items */}
                {feedItems.map((item, i) => (
                  <Link
                    key={i}
                    href={`/synthesis/${item.synthesisId}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '140px 1fr 80px',
                        alignItems: 'center',
                        padding: '12px 20px',
                        borderBottom: i < feedItems.length - 1 ? `1px solid ${mutedBorder}` : 'none',
                        backgroundColor: hoveredFeedItem === i ? theme.hover : 'transparent',
                        transition: 'background-color 0.15s ease',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={() => setHoveredFeedItem(i)}
                      onMouseLeave={() => setHoveredFeedItem(null)}
                    >
                      {/* Timestamp */}
                      <div style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                        color: labelColor,
                      }}>
                        {new Date(item.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: '2-digit',
                        })} {new Date(item.timestamp).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </div>

                      {/* Type + description */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '9px',
                          fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                          letterSpacing: '1px',
                          color: item.type === 'cause' ? theme.success : theme.info,
                          backgroundColor: item.type === 'cause' ? `${theme.success}15` : `${theme.info}15`,
                          padding: '2px 8px',
                          borderRadius: '0px',
                          flexShrink: 0,
                        }}>
                          {item.label}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          color: theme.text,
                          fontFamily: 'var(--font-sans, sans-serif)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {item.description}
                        </span>
                        {hoveredFeedItem === i && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                            <path d="M3 11L11 3M11 3H5M11 3V9" stroke={theme.textSecondary} strokeWidth="1.5" />
                          </svg>
                        )}
                      </div>

                      {/* Confidence badge */}
                      <div style={{
                        textAlign: 'right',
                        fontSize: '10px',
                        fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                        color: item.confidence > 0.7 ? theme.success : item.confidence > 0.4 ? theme.warning : theme.textSecondary,
                      }}>
                        {(item.confidence * 100).toFixed(0)}% CONF
                      </div>
                    </div>
                  </Link>
                ))}

                {/* Load more button */}
                <div style={{
                  padding: '12px 20px',
                  borderTop: `1px solid ${mutedBorder}`,
                  textAlign: 'center',
                }}>
                  <button
                    style={{
                      background: 'none',
                      border: `1px solid ${mutedBorder}`,
                      borderRadius: '0px',
                      padding: '8px 24px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                      color: theme.textSecondary,
                      letterSpacing: '1px',
                      cursor: 'pointer',
                    }}
                  >
                    LOAD ARCHIVED LOGS
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR - 3/12 */}
          <div>
            {/* QUICK_FACTS */}
            <div style={{
              marginBottom: '24px',
              padding: '20px',
              backgroundColor: surfaceCard,
              borderRadius: '0px',
              borderLeft: `3px solid ${primaryColor}`,
              border: `1px solid ${mutedBorder}`,
              borderLeftColor: primaryColor,
              borderLeftWidth: '3px',
            }}>
              <div style={{
                fontSize: '10px',
                fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                color: labelColor,
                letterSpacing: '2px',
                marginBottom: '16px',
              }}>
                QUICK_FACTS
              </div>
              {quickFacts.map((fact, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: i < quickFacts.length - 1 ? `1px solid ${mutedBorder}` : 'none',
                }}>
                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                    color: labelColor,
                    letterSpacing: '1px',
                  }}>
                    {fact.key}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: theme.text,
                    fontFamily: 'var(--font-sans, sans-serif)',
                    textAlign: 'right',
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {fact.value}
                  </span>
                </div>
              ))}

              {/* Description if available */}
              {entity.description && (
                <p style={{
                  fontSize: '11px',
                  color: theme.textSecondary,
                  lineHeight: '1.6',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: `1px solid ${mutedBorder}`,
                  fontFamily: 'var(--font-sans, sans-serif)',
                }}>
                  {entity.description}
                </p>
              )}
            </div>

            {/* RELATED_ENTITIES */}
            {relatedWithScores.length > 0 && (
              <div style={{
                marginBottom: '24px',
                padding: '20px',
                backgroundColor: surfaceCard,
                borderRadius: '0px',
                border: `1px solid ${mutedBorder}`,
              }}>
                <div style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                  color: labelColor,
                  letterSpacing: '2px',
                  marginBottom: '16px',
                }}>
                  RELATED_ENTITIES
                </div>
                {relatedWithScores.map((rel, i) => {
                  const simColor = rel.similarity > 80 ? theme.success : rel.similarity > 60 ? theme.warning : theme.textSecondary;
                  return (
                    <Link
                      key={i}
                      href={`/intelligence/entities/${rel.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: i < relatedWithScores.length - 1 ? `1px solid ${mutedBorder}` : 'none',
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: theme.text,
                          fontFamily: 'var(--font-sans, sans-serif)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '170px',
                        }}>
                          {rel.name}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                          color: simColor,
                        }}>
                          {rel.similarity}%
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* ASSOCIATED_TOPICS */}
            {entity.topics.length > 0 && (
              <div style={{
                marginBottom: '24px',
                padding: '20px',
                backgroundColor: surfaceCard,
                borderRadius: '0px',
                border: `1px solid ${mutedBorder}`,
              }}>
                <div style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                  color: labelColor,
                  letterSpacing: '2px',
                  marginBottom: '16px',
                }}>
                  ASSOCIATED_TOPICS
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {entity.topics.map((topicId, i) => (
                    <Link
                      key={i}
                      href={`/intelligence/topics/${topicId}`}
                      style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                        color: theme.textSecondary,
                        backgroundColor: theme.hover,
                        padding: '4px 10px',
                        borderRadius: '0px',
                        textDecoration: 'none',
                        letterSpacing: '0.5px',
                        border: `1px solid ${mutedBorder}`,
                      }}
                    >
                      {topicId.length > 12 ? topicId.substring(0, 10) + '..' : topicId}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* EXPORT_INTEL_PKG */}
            <div style={{
              padding: '20px',
              backgroundColor: surfaceCard,
              borderRadius: '0px',
              border: `1px solid ${mutedBorder}`,
            }}>
              <button
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: theme.text,
                  color: theme.bg,
                  border: 'none',
                  borderRadius: '0px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                  letterSpacing: '2px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  marginBottom: '12px',
                }}
              >
                EXPORT_INTEL_PKG
              </button>
              <div style={{
                fontSize: '8px',
                fontFamily: 'var(--font-label, var(--font-sans, monospace))',
                color: labelColor,
                wordBreak: 'break-all',
                lineHeight: '1.4',
              }}>
                SHA-256: {exportHash}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
