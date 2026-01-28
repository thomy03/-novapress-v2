"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '../../../contexts/ThemeContext';
import { intelligenceService } from '../../../lib/api/services/intelligence';
import {
  TopicDetailResponse,
  TopicCausalGraphResponse,
  TopicTimelineResponse,
} from '../../../types/intelligence';
import { Header } from '../../../components/layout/Header';

// Narrative arc configuration
const ARC_CONFIG: Record<string, { color: string; label: string; emoji: string; description: string }> = {
  'emerging': { color: '#22C55E', label: 'Emergent', emoji: '🌱', description: 'Sujet nouveau, peu de couverture' },
  'developing': { color: '#3B82F6', label: 'En Cours', emoji: '📈', description: 'Sujet en developpement actif' },
  'peak': { color: '#EF4444', label: 'Point Culminant', emoji: '🔥', description: 'Maximum de couverture' },
  'declining': { color: '#F59E0B', label: 'Declin', emoji: '📉', description: 'Couverture en diminution' },
  'resolved': { color: '#6B7280', label: 'Resolu', emoji: '✓', description: 'Sujet clos ou resolu' }
};

// Category colors
const CATEGORY_CONFIG: Record<string, { color: string; emoji: string }> = {
  'MONDE': { color: '#2563EB', emoji: '🌍' },
  'TECH': { color: '#7C3AED', emoji: '💻' },
  'ECONOMIE': { color: '#059669', emoji: '📈' },
  'POLITIQUE': { color: '#DC2626', emoji: '🏛️' },
  'CULTURE': { color: '#D97706', emoji: '🎭' },
  'SPORT': { color: '#0891B2', emoji: '⚽' },
  'SCIENCES': { color: '#4F46E5', emoji: '🔬' }
};

export default function TopicDetailPage() {
  const { theme } = useTheme();
  const params = useParams();
  const router = useRouter();
  const topicId = params.id as string;

  const [topic, setTopic] = useState<TopicDetailResponse | null>(null);
  const [causalGraph, setCausalGraph] = useState<TopicCausalGraphResponse | null>(null);
  const [timeline, setTimeline] = useState<TopicTimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'graph' | 'timeline'>('overview');

  const fetchData = useCallback(async () => {
    if (!topicId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch topic details
      const topicData = await intelligenceService.getTopicById(topicId);
      setTopic(topicData);

      // Fetch causal graph and timeline in parallel
      const [graphData, timelineData] = await Promise.all([
        intelligenceService.getTopicCausalGraph(topicId).catch(() => null),
        intelligenceService.getTopicTimeline(topicId).catch(() => null)
      ]);

      setCausalGraph(graphData);
      setTimeline(timelineData);
    } catch (err) {
      console.error('Failed to fetch topic:', err);
      setError('Impossible de charger les details du topic.');
    } finally {
      setIsLoading(false);
    }
  }, [topicId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
        <Header />
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #E5E5E5',
            borderTopColor: '#2563EB',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: theme.textSecondary }}>Chargement du topic...</p>
        </div>
        <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
        <Header />
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '100px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>😕</p>
          <h1 style={{ fontSize: '24px', color: theme.text, marginBottom: '8px' }}>
            Topic introuvable
          </h1>
          <p style={{ color: theme.textSecondary, marginBottom: '24px' }}>
            {error || 'Ce topic n\'existe pas ou a ete supprime.'}
          </p>
          <Link href="/intelligence" style={{
            color: '#2563EB',
            textDecoration: 'none',
            fontWeight: '600'
          }}>
            ← Retour a l'Intelligence Hub
          </Link>
        </div>
      </div>
    );
  }

  const arcConfig = ARC_CONFIG[topic.narrative_arc] || ARC_CONFIG['emerging'];
  const categoryConfig = CATEGORY_CONFIG[topic.category] || { color: '#6B7280', emoji: '📰' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <Header />

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>
          <Link href="/intelligence" style={{
            color: theme.textSecondary,
            textDecoration: 'none',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            ← Retour a l'Intelligence Hub
          </Link>
        </div>

        {/* Topic Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              color: categoryConfig.color,
              backgroundColor: `${categoryConfig.color}15`,
              padding: '4px 12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {categoryConfig.emoji} {topic.category}
            </span>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: arcConfig.color,
              backgroundColor: `${arcConfig.color}15`,
              padding: '4px 12px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {arcConfig.emoji} {arcConfig.label}
            </span>
            {topic.is_active && (
              <span style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#22C55E',
                backgroundColor: '#22C55E15',
                padding: '4px 12px',
                borderRadius: '12px'
              }}>
                ● Actif
              </span>
            )}
          </div>

          <h1 style={{
            fontSize: '32px',
            fontWeight: '900',
            fontFamily: 'Georgia, serif',
            color: theme.text,
            margin: '0 0 12px 0',
            lineHeight: '1.2'
          }}>
            {topic.name}
          </h1>

          <p style={{
            fontSize: '16px',
            color: theme.textSecondary,
            margin: '0 0 20px 0',
            lineHeight: '1.5'
          }}>
            {topic.description}
          </p>

          {/* Stats Row */}
          <div style={{
            display: 'flex',
            gap: '24px',
            padding: '16px 0',
            borderTop: `1px solid ${theme.border}`,
            borderBottom: `1px solid ${theme.border}`
          }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: theme.text }}>
                {topic.synthesis_count}
              </div>
              <div style={{ fontSize: '12px', color: theme.textSecondary }}>Syntheses</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: theme.text }}>
                {topic.entity_count}
              </div>
              <div style={{ fontSize: '12px', color: theme.textSecondary }}>Entites</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: theme.text }}>
                {topic.days_tracked}
              </div>
              <div style={{ fontSize: '12px', color: theme.textSecondary }}>Jours suivis</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: arcConfig.color }}>
                {topic.hot_score.toFixed(1)}
              </div>
              <div style={{ fontSize: '12px', color: theme.textSecondary }}>Score chaleur</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '24px',
          borderBottom: `1px solid ${theme.border}`,
          paddingBottom: '0'
        }}>
          {(['overview', 'graph', 'timeline'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 20px',
                border: 'none',
                backgroundColor: 'transparent',
                color: activeTab === tab ? '#2563EB' : theme.textSecondary,
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                borderBottom: activeTab === tab ? '2px solid #2563EB' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'all 0.2s ease'
              }}
            >
              {tab === 'overview' && 'Vue d\'ensemble'}
              {tab === 'graph' && `Graphe Causal (${causalGraph?.nodes.length || 0})`}
              {tab === 'timeline' && `Timeline (${timeline?.syntheses.length || 0})`}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Keywords */}
            {topic.keywords.length > 0 && (
              <div style={{
                padding: '20px',
                backgroundColor: theme.bgSecondary,
                borderRadius: '12px',
                border: `1px solid ${theme.border}`
              }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: theme.text,
                  marginBottom: '12px'
                }}>
                  Mots-cles
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {topic.keywords.map((kw, i) => (
                    <span key={i} style={{
                      fontSize: '12px',
                      color: theme.text,
                      backgroundColor: theme.bg,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: `1px solid ${theme.border}`
                    }}>
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Entities */}
            {topic.preview_entities.length > 0 && (
              <div style={{
                padding: '20px',
                backgroundColor: theme.bgSecondary,
                borderRadius: '12px',
                border: `1px solid ${theme.border}`
              }}>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: theme.text,
                  marginBottom: '12px'
                }}>
                  Entites principales
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {topic.preview_entities.map((entity, i) => (
                    <span key={i} style={{
                      fontSize: '12px',
                      color: '#8B5CF6',
                      backgroundColor: '#8B5CF615',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontWeight: '600'
                    }}>
                      {entity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Narrative Arc Info */}
            <div style={{
              padding: '20px',
              backgroundColor: `${arcConfig.color}10`,
              borderRadius: '12px',
              border: `1px solid ${arcConfig.color}30`,
              gridColumn: topic.keywords.length > 0 && topic.preview_entities.length > 0 ? '1 / -1' : undefined
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '24px' }}>{arcConfig.emoji}</span>
                <div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: arcConfig.color,
                    margin: 0
                  }}>
                    Phase: {arcConfig.label}
                  </h3>
                  <p style={{
                    fontSize: '13px',
                    color: theme.textSecondary,
                    margin: '4px 0 0 0'
                  }}>
                    {arcConfig.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'graph' && causalGraph && (
          <div style={{
            padding: '20px',
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '700',
              color: theme.text,
              marginBottom: '16px'
            }}>
              Graphe Causal Agrege
            </h3>

            {causalGraph.nodes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>🕸️</p>
                <p style={{ color: theme.textSecondary }}>
                  Pas encore de donnees causales pour ce topic
                </p>
              </div>
            ) : (
              <div>
                {/* Graph Stats */}
                <div style={{
                  display: 'flex',
                  gap: '20px',
                  marginBottom: '20px',
                  padding: '12px 16px',
                  backgroundColor: theme.bg,
                  borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '13px', color: theme.textSecondary }}>
                    <strong style={{ color: theme.text }}>{causalGraph.nodes.length}</strong> noeuds
                  </span>
                  <span style={{ fontSize: '13px', color: theme.textSecondary }}>
                    <strong style={{ color: theme.text }}>{causalGraph.edges.length}</strong> relations
                  </span>
                  <span style={{ fontSize: '13px', color: theme.textSecondary }}>
                    <strong style={{ color: theme.text }}>{causalGraph.total_syntheses}</strong> syntheses
                  </span>
                </div>

                {/* Central Entities */}
                {causalGraph.central_entities.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: theme.text,
                      marginBottom: '8px'
                    }}>
                      Entites Centrales
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {causalGraph.central_entities.map((entity, i) => (
                        <span key={i} style={{
                          fontSize: '12px',
                          color: '#EF4444',
                          backgroundColor: '#EF444415',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontWeight: '600'
                        }}>
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Edges */}
                <div>
                  <h4 style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: theme.text,
                    marginBottom: '8px'
                  }}>
                    Relations Causales
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {causalGraph.edges.slice(0, 5).map((edge, i) => (
                      <div key={i} style={{
                        padding: '10px 14px',
                        backgroundColor: theme.bg,
                        borderRadius: '8px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: theme.text, fontWeight: '600' }}>
                          {edge.cause_text}
                        </span>
                        <span style={{ color: '#F59E0B', fontWeight: '700' }}>
                          →
                        </span>
                        <span style={{ color: theme.text }}>
                          {edge.effect_text}
                        </span>
                        <span style={{
                          marginLeft: 'auto',
                          fontSize: '11px',
                          color: theme.textSecondary,
                          backgroundColor: theme.bgSecondary,
                          padding: '2px 8px',
                          borderRadius: '10px'
                        }}>
                          {(edge.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && timeline && (
          <div style={{
            padding: '20px',
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '700',
              color: theme.text,
              marginBottom: '16px'
            }}>
              Timeline des Syntheses
            </h3>

            {timeline.syntheses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>📅</p>
                <p style={{ color: theme.textSecondary }}>
                  Pas encore de syntheses pour ce topic
                </p>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {/* Vertical line */}
                <div style={{
                  position: 'absolute',
                  left: '15px',
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  backgroundColor: theme.border
                }} />

                {timeline.syntheses.map((synth, index) => (
                  <Link
                    key={synth.id}
                    href={`/synthesis/${synth.id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      position: 'relative',
                      paddingLeft: '48px',
                      paddingBottom: index === timeline.syntheses.length - 1 ? 0 : '20px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}>
                      {/* Timeline dot */}
                      <div style={{
                        position: 'absolute',
                        left: '8px',
                        top: '4px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: categoryConfig.color,
                        border: `3px solid ${theme.bgSecondary}`
                      }} />

                      {/* Date */}
                      <div style={{
                        fontSize: '11px',
                        color: theme.textSecondary,
                        marginBottom: '4px'
                      }}>
                        {new Date(synth.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>

                      {/* Title */}
                      <h4 style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        fontFamily: 'Georgia, serif',
                        color: theme.text,
                        margin: '0 0 4px 0',
                        lineHeight: '1.3'
                      }}>
                        {synth.title}
                      </h4>

                      {/* Summary */}
                      <p style={{
                        fontSize: '13px',
                        color: theme.textSecondary,
                        margin: 0,
                        lineHeight: '1.4'
                      }}>
                        {synth.summary.substring(0, 150)}...
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
