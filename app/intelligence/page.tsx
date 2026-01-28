"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from '../contexts/ThemeContext';
import { intelligenceService } from '../lib/api/services/intelligence';
import {
  TopicResponse,
  EntityResponse,
  IntelligenceStats,
  GlobalGraphResponse
} from '../types/intelligence';
import { Header } from '../components/layout/Header';
import { NewsTicker } from '../components/layout/NewsTicker';

// Narrative arc colors and labels
const ARC_CONFIG: Record<string, { color: string; label: string; emoji: string }> = {
  'emerging': { color: '#22C55E', label: 'Emergent', emoji: '🌱' },
  'developing': { color: '#3B82F6', label: 'En Cours', emoji: '📈' },
  'peak': { color: '#EF4444', label: 'Point Culminant', emoji: '🔥' },
  'declining': { color: '#F59E0B', label: 'Declin', emoji: '📉' },
  'resolved': { color: '#6B7280', label: 'Resolu', emoji: '✓' }
};

// Entity type colors
const ENTITY_TYPE_CONFIG: Record<string, { color: string; emoji: string }> = {
  'PERSON': { color: '#8B5CF6', emoji: '👤' },
  'ORG': { color: '#3B82F6', emoji: '🏢' },
  'GPE': { color: '#10B981', emoji: '🌍' },
  'LOC': { color: '#F59E0B', emoji: '📍' },
  'EVENT': { color: '#EF4444', emoji: '📅' },
  'PRODUCT': { color: '#EC4899', emoji: '📦' },
  'UNKNOWN': { color: '#6B7280', emoji: '❓' }
};

// Category colors
const CATEGORY_CONFIG: Record<string, { color: string }> = {
  'MONDE': { color: '#2563EB' },
  'TECH': { color: '#7C3AED' },
  'ECONOMIE': { color: '#059669' },
  'POLITIQUE': { color: '#DC2626' },
  'CULTURE': { color: '#D97706' },
  'SPORT': { color: '#0891B2' },
  'SCIENCES': { color: '#4F46E5' }
};

export default function IntelligencePage() {
  const { theme } = useTheme();
  const [topics, setTopics] = useState<TopicResponse[]>([]);
  const [hotTopics, setHotTopics] = useState<TopicResponse[]>([]);
  const [topEntities, setTopEntities] = useState<EntityResponse[]>([]);
  const [stats, setStats] = useState<IntelligenceStats | null>(null);
  const [globalGraph, setGlobalGraph] = useState<GlobalGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [topicsRes, hotTopicsRes, entitiesRes, statsRes, graphRes] = await Promise.all([
        intelligenceService.getTopics({ limit: 20, category: selectedCategory || undefined }),
        intelligenceService.getHotTopics(5),
        intelligenceService.getEntities({ limit: 10 }),
        intelligenceService.getStats(),
        intelligenceService.getGlobalGraph().catch(() => null)
      ]);

      setTopics(topicsRes.topics);
      setHotTopics(hotTopicsRes);
      setTopEntities(entitiesRes.entities);
      setStats(statsRes);
      setGlobalGraph(graphRes);
    } catch (err) {
      console.error('Failed to fetch intelligence data:', err);
      setError('Impossible de charger les donnees Intelligence Hub.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <Header />
      <NewsTicker />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '32px' }}>🧠</span>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '900',
              fontFamily: 'Georgia, serif',
              color: theme.text,
              margin: 0
            }}>
              Intelligence Hub
            </h1>
          </div>
          <p style={{
            fontSize: '16px',
            color: theme.textSecondary,
            margin: 0
          }}>
            Explorez les sujets, entites et relations causales a travers toutes nos syntheses
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            marginBottom: '40px'
          }}>
            <div style={{
              padding: '20px',
              backgroundColor: theme.bgSecondary,
              borderRadius: '12px',
              border: `1px solid ${theme.border}`
            }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#2563EB' }}>
                {stats.total_topics}
              </div>
              <div style={{ fontSize: '13px', color: theme.textSecondary, marginTop: '4px' }}>
                Topics Detectes
              </div>
            </div>
            <div style={{
              padding: '20px',
              backgroundColor: theme.bgSecondary,
              borderRadius: '12px',
              border: `1px solid ${theme.border}`
            }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#22C55E' }}>
                {stats.active_topics}
              </div>
              <div style={{ fontSize: '13px', color: theme.textSecondary, marginTop: '4px' }}>
                Topics Actifs
              </div>
            </div>
            <div style={{
              padding: '20px',
              backgroundColor: theme.bgSecondary,
              borderRadius: '12px',
              border: `1px solid ${theme.border}`
            }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#8B5CF6' }}>
                {stats.total_entities}
              </div>
              <div style={{ fontSize: '13px', color: theme.textSecondary, marginTop: '4px' }}>
                Entites Uniques
              </div>
            </div>
            <div style={{
              padding: '20px',
              backgroundColor: theme.bgSecondary,
              borderRadius: '12px',
              border: `1px solid ${theme.border}`
            }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#F59E0B' }}>
                {Object.keys(stats.entities_by_type).length}
              </div>
              <div style={{ fontSize: '13px', color: theme.textSecondary, marginTop: '4px' }}>
                Types d'Entites
              </div>
            </div>
          </div>
        )}

        {/* UI-005: Global Graph Toggle */}
        {globalGraph && globalGraph.nodes.length > 0 && (
          <div style={{
            marginBottom: '32px',
            padding: '20px',
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: showGraph ? '20px' : 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🕸️</span>
                <div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: theme.text,
                    margin: 0
                  }}>
                    Graphe Global des Relations
                  </h3>
                  <p style={{
                    fontSize: '13px',
                    color: theme.textSecondary,
                    margin: '4px 0 0'
                  }}>
                    {globalGraph.nodes.length} noeuds • {globalGraph.edges.length} relations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGraph(!showGraph)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: showGraph ? '#2563EB' : 'transparent',
                  color: showGraph ? '#FFFFFF' : '#2563EB',
                  border: `1px solid #2563EB`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {showGraph ? 'Masquer' : 'Afficher le Graphe'}
              </button>
            </div>

            {showGraph && (
              <div style={{
                backgroundColor: theme.bg,
                borderRadius: '8px',
                padding: '20px',
                border: `1px solid ${theme.border}`
              }}>
                {/* Graph Visualization */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '12px',
                  marginBottom: '20px'
                }}>
                  {globalGraph.nodes.slice(0, 12).map((node, idx) => {
                    const isTopicNode = node.node_type === 'topic';
                    const categoryConfig = CATEGORY_CONFIG[node.category] || { color: '#6B7280' };
                    const connectedEdges = globalGraph.edges.filter(
                      e => e.source === node.id || e.target === node.id
                    );

                    return (
                      <Link
                        key={node.id}
                        href={isTopicNode ? `/intelligence/topics/${node.id.replace('topic_', '')}` : `/intelligence/entities/${node.id.replace('entity_', '')}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <div
                          style={{
                            padding: '14px',
                            backgroundColor: theme.bgSecondary,
                            borderRadius: '8px',
                            border: `2px solid ${isTopicNode ? categoryConfig.color : '#8B5CF6'}`,
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '8px'
                          }}>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: '700',
                              color: isTopicNode ? categoryConfig.color : '#8B5CF6',
                              backgroundColor: isTopicNode ? `${categoryConfig.color}15` : '#8B5CF615',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              textTransform: 'uppercase'
                            }}>
                              {isTopicNode ? 'Topic' : 'Entité'}
                            </span>
                          </div>
                          <h4 style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: theme.text,
                            margin: 0,
                            lineHeight: '1.3'
                          }}>
                            {node.label}
                          </h4>
                          <div style={{
                            fontSize: '11px',
                            color: theme.textSecondary,
                            marginTop: '6px'
                          }}>
                            {node.weight} {isTopicNode ? 'synthèses' : 'mentions'} • {connectedEdges.length} liens
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  padding: '12px',
                  backgroundColor: theme.bgSecondary,
                  borderRadius: '6px',
                  fontSize: '12px'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', backgroundColor: '#2563EB', borderRadius: '3px' }} />
                    Topics
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '12px', height: '12px', backgroundColor: '#8B5CF6', borderRadius: '3px' }} />
                    Entités
                  </span>
                  <span style={{ color: theme.textSecondary, marginLeft: 'auto' }}>
                    Cliquez sur un noeud pour voir les détails
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
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

        {/* Loading State */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #E5E5E5',
              borderTopColor: '#2563EB',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: theme.textSecondary }}>Chargement de l'Intelligence Hub...</p>
          </div>
        )}

        {!isLoading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '40px' }}>
            {/* Left Column: Topics */}
            <div>
              {/* Hot Topics */}
              {hotTopics.length > 0 && (
                <section style={{ marginBottom: '40px' }}>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: theme.text,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    🔥 Hot Topics
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {hotTopics.map(topic => {
                      const arcConfig = ARC_CONFIG[topic.narrative_arc] || ARC_CONFIG['emerging'];
                      const categoryConfig = CATEGORY_CONFIG[topic.category] || { color: '#6B7280' };

                      return (
                        <Link
                          key={topic.id}
                          href={`/intelligence/topics/${topic.id}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <div style={{
                            padding: '16px',
                            backgroundColor: theme.bgSecondary,
                            borderRadius: '12px',
                            border: `1px solid ${theme.border}`,
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateX(4px)';
                            e.currentTarget.style.borderColor = categoryConfig.color;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateX(0)';
                            e.currentTarget.style.borderColor = theme.border;
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '700',
                                color: categoryConfig.color,
                                backgroundColor: `${categoryConfig.color}15`,
                                padding: '3px 8px',
                                borderRadius: '10px',
                                textTransform: 'uppercase'
                              }}>
                                {topic.category}
                              </span>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                color: arcConfig.color,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                {arcConfig.emoji} {arcConfig.label}
                              </span>
                            </div>
                            <h3 style={{
                              fontSize: '16px',
                              fontWeight: '700',
                              fontFamily: 'Georgia, serif',
                              color: theme.text,
                              margin: '0 0 8px 0'
                            }}>
                              {topic.name}
                            </h3>
                            <p style={{
                              fontSize: '13px',
                              color: theme.textSecondary,
                              margin: '0 0 8px 0',
                              lineHeight: '1.4'
                            }}>
                              {topic.description.substring(0, 120)}...
                            </p>
                            <div style={{
                              display: 'flex',
                              gap: '12px',
                              fontSize: '12px',
                              color: theme.textSecondary
                            }}>
                              <span>{topic.synthesis_count} syntheses</span>
                              <span>{topic.entity_count} entites</span>
                              <span>{topic.days_tracked} jours</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Category Filter */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '20px'
              }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: theme.text }}>
                  Filtrer:
                </span>
                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '16px',
                    border: !selectedCategory ? 'none' : `1px solid ${theme.border}`,
                    backgroundColor: !selectedCategory ? '#2563EB' : 'transparent',
                    color: !selectedCategory ? 'white' : theme.text,
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  Tous
                </button>
                {Object.keys(CATEGORY_CONFIG).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '16px',
                      border: selectedCategory === cat ? 'none' : `1px solid ${theme.border}`,
                      backgroundColor: selectedCategory === cat ? CATEGORY_CONFIG[cat].color : 'transparent',
                      color: selectedCategory === cat ? 'white' : theme.text,
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* All Topics Grid */}
              <section>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: theme.text,
                  marginBottom: '16px'
                }}>
                  Tous les Topics
                </h2>
                {topics.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    backgroundColor: theme.bgSecondary,
                    borderRadius: '12px'
                  }}>
                    <p style={{ fontSize: '32px', marginBottom: '8px' }}>📭</p>
                    <p style={{ color: theme.textSecondary }}>
                      Aucun topic pour cette categorie
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    {topics.map(topic => {
                      const arcConfig = ARC_CONFIG[topic.narrative_arc] || ARC_CONFIG['emerging'];
                      const categoryConfig = CATEGORY_CONFIG[topic.category] || { color: '#6B7280' };

                      return (
                        <Link
                          key={topic.id}
                          href={`/intelligence/topics/${topic.id}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <div style={{
                            padding: '16px',
                            backgroundColor: theme.bg,
                            borderRadius: '8px',
                            border: `1px solid ${theme.border}`,
                            height: '100%',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = categoryConfig.color;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = theme.border;
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                              <span style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: arcConfig.color
                              }} />
                              <span style={{ fontSize: '11px', color: arcConfig.color, fontWeight: '600' }}>
                                {arcConfig.label}
                              </span>
                            </div>
                            <h3 style={{
                              fontSize: '14px',
                              fontWeight: '700',
                              color: theme.text,
                              margin: '0 0 6px 0',
                              lineHeight: '1.3'
                            }}>
                              {topic.name}
                            </h3>
                            <div style={{
                              fontSize: '11px',
                              color: theme.textSecondary
                            }}>
                              {topic.synthesis_count} syntheses
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Entities */}
            <div>
              <section style={{
                position: 'sticky',
                top: '100px'
              }}>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: theme.text,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  👥 Top Entites
                </h2>
                <div style={{
                  backgroundColor: theme.bgSecondary,
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  overflow: 'hidden'
                }}>
                  {topEntities.map((entity, index) => {
                    const typeConfig = ENTITY_TYPE_CONFIG[entity.entity_type] || ENTITY_TYPE_CONFIG['UNKNOWN'];

                    return (
                      <Link
                        key={entity.id}
                        href={`/intelligence/entities/${entity.id}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <div style={{
                          padding: '14px 16px',
                          borderBottom: index < topEntities.length - 1 ? `1px solid ${theme.border}` : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = theme.bg;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}>
                          <span style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: `${typeConfig.color}20`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px'
                          }}>
                            {typeConfig.emoji}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: theme.text
                            }}>
                              {entity.canonical_name}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: theme.textSecondary
                            }}>
                              {entity.entity_type} • {entity.mention_count} mentions
                            </div>
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: typeConfig.color,
                            fontWeight: '600'
                          }}>
                            {entity.synthesis_count} synth.
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Entity Type Distribution */}
                {stats && Object.keys(stats.entities_by_type).length > 0 && (
                  <div style={{
                    marginTop: '24px',
                    padding: '16px',
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
                      Distribution par Type
                    </h3>
                    {Object.entries(stats.entities_by_type).map(([type, count]) => {
                      const typeConfig = ENTITY_TYPE_CONFIG[type] || ENTITY_TYPE_CONFIG['UNKNOWN'];
                      const percentage = Math.round((count / stats.total_entities) * 100);

                      return (
                        <div key={type} style={{ marginBottom: '10px' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '4px'
                          }}>
                            <span style={{
                              fontSize: '12px',
                              color: theme.text,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {typeConfig.emoji} {type}
                            </span>
                            <span style={{ fontSize: '12px', color: theme.textSecondary }}>
                              {count} ({percentage}%)
                            </span>
                          </div>
                          <div style={{
                            height: '4px',
                            backgroundColor: theme.border,
                            borderRadius: '2px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${percentage}%`,
                              height: '100%',
                              backgroundColor: typeConfig.color,
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* Back to home link */}
        <div style={{
          marginTop: '60px',
          paddingTop: '20px',
          borderTop: `1px solid ${theme.border}`,
          textAlign: 'center'
        }}>
          <Link
            href="/"
            style={{
              color: '#2563EB',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            ← Retour a l'accueil
          </Link>
        </div>
      </main>

      {/* Animations */}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
