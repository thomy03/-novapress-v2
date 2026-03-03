'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  NarrativeArcIndicator,
  TopicTimeline,
  SynthesisTable,
  PredictionTracker,
  TopicHero,
  TopicEntityCards,
  TopicSentimentSparkline,
} from '@/app/components/topics';

// Lazy-load the Living Causal Graph (heavy dependency: @xyflow/react)
const LivingCausalGraph = dynamic(
  () => import('@/app/components/causal/LivingCausalGraph'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9CA3AF',
        fontSize: '14px',
        border: '1px solid #E5E5E5',
        backgroundColor: '#F9FAFB',
      }}>
        Chargement du graphe causal...
      </div>
    ),
  }
);

interface SynthesisSummary {
  id: string;
  title: string;
  date: string;
  category: string;
  summary: string;
  sentiment: string;
  num_sources: number;
  transparency_score: number;
  imageUrl?: string;
}

interface KeyEntity {
  name: string;
  count: number;
  type: string;
}

interface Prediction {
  prediction: string;
  probability: number;
  type: string;
  timeframe: string;
  synthesis_id: string;
  synthesis_date: string;
}

interface GeoFocus {
  country: string;
  count: number;
}

interface CausalGraph {
  nodes: { id: string; label: string; type: string; mention_count?: number; first_seen?: number; last_seen?: number; source_syntheses?: string[] }[];
  edges: {
    cause_text?: string;
    effect_text?: string;
    relation_type?: string;
    source?: string;
    target?: string;
    type?: string;
    confidence?: number;
    mention_count?: number;
    source_syntheses?: string[];
    id?: string;
  }[];
  total_nodes: number;
  total_edges: number;
}

interface SentimentPoint {
  date: string;
  sentiment: number;
  title: string;
}

interface TopicDashboard {
  topic: string;
  synthesis_count: number;
  duration_days: number;
  first_date: string;
  transparency_avg: number;
  sources_total: number;
  syntheses: SynthesisSummary[];
  aggregated_causal_graph: CausalGraph;
  sentiment_evolution: SentimentPoint[];
  key_entities: KeyEntity[];
  predictions_summary: Prediction[];
  geo_focus: GeoFocus[];
  narrative_arc: string;
  is_active: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const NARRATIVE_ARC_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  emerging: { label: '\u00c9mergent', color: '#2563EB', description: 'Sujet r\u00e9cent, peu de couverture' },
  developing: { label: 'En d\u00e9veloppement', color: '#10B981', description: 'Attention m\u00e9diatique croissante' },
  peak: { label: 'Point culminant', color: '#DC2626', description: 'Maximum de couverture m\u00e9diatique' },
  declining: { label: 'En d\u00e9clin', color: '#F59E0B', description: 'Int\u00e9r\u00eat m\u00e9diatique en baisse' },
  resolved: { label: 'R\u00e9solu', color: '#6B7280', description: 'Sujet clos ou r\u00e9solu' },
};

type TabId = 'causal' | 'overview' | 'timeline' | 'table' | 'predictions';

export default function TopicDashboardPageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Chargement...</div>}>
      <TopicDashboardPage />
    </Suspense>
  );
}

function TopicDashboardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const topicName = decodeURIComponent(params.name as string);

  const [dashboard, setDashboard] = useState<TopicDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialTab = (searchParams.get('tab') as TabId) || 'overview';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_URL}/api/trending/topics/${encodeURIComponent(topicName)}/dashboard`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Topic non trouv\u00e9 ou pas assez de synth\u00e8ses (minimum 3 requis)');
          }
          throw new Error('Erreur lors du chargement du dashboard');
        }

        const data = await response.json();
        setDashboard(data);

        // Auto-select causal tab if data available and no explicit tab
        if (!searchParams.get('tab') && data.aggregated_causal_graph?.total_nodes > 0) {
          setActiveTab('causal');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    if (topicName) {
      fetchDashboard();
    }
  }, [topicName, searchParams]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <p style={{ marginTop: '16px', fontSize: '14px', color: '#6B7280' }}>
            Chargement du dossier...
          </p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingContainer}>
          <h1 style={{ fontSize: '24px', fontFamily: 'Georgia, serif', marginBottom: '16px', color: '#000' }}>
            Dossier non disponible
          </h1>
          <p style={{ color: '#6B7280', marginBottom: '24px', fontSize: '14px' }}>{error}</p>
          <Link href="/" style={{ color: '#2563EB', textDecoration: 'none', fontSize: '14px' }}>
            &larr; Retour a l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  const arcConfig = NARRATIVE_ARC_CONFIG[dashboard.narrative_arc] || NARRATIVE_ARC_CONFIG.developing;
  const hasCausalData = dashboard.aggregated_causal_graph.total_nodes > 0;

  // Build tabs — put causal first if data exists
  const allTabs: { id: TabId; label: string; count?: number }[] = [];
  if (hasCausalData) {
    allTabs.push({ id: 'causal', label: 'Graphe causal', count: dashboard.aggregated_causal_graph.total_nodes });
  }
  allTabs.push({ id: 'overview', label: 'Vue d\'ensemble' });
  allTabs.push({ id: 'timeline', label: 'Chronologie', count: dashboard.synthesis_count });
  allTabs.push({ id: 'table', label: 'Comparatif', count: dashboard.synthesis_count });
  if (!hasCausalData) {
    allTabs.push({ id: 'causal', label: 'Graphe causal', count: 0 });
  }
  allTabs.push({ id: 'predictions', label: 'Pr\u00e9dictions', count: dashboard.predictions_summary.length });

  // Transform causal graph data for LivingCausalGraph
  const causalNodes = dashboard.aggregated_causal_graph.nodes.map(n => ({
    id: n.id,
    label: n.label,
    node_type: (n.type || 'event') as 'event' | 'entity' | 'decision' | 'keyword',
    fact_density: 0.5,
    mention_count: n.mention_count || 1,
    first_seen: n.first_seen || 0,
    last_seen: n.last_seen || 0,
    source_syntheses: n.source_syntheses || [],
  }));
  const nodeLabelsById = Object.fromEntries(causalNodes.map(n => [n.id, n.label]));
  const causalEdges = dashboard.aggregated_causal_graph.edges.map((e, idx) => ({
    id: e.id || `edge-${idx}`,
    cause_text: e.cause_text || nodeLabelsById[e.source || ''] || '',
    effect_text: e.effect_text || nodeLabelsById[e.target || ''] || '',
    relation_type: (e.relation_type || e.type || 'causes') as 'causes' | 'triggers' | 'enables' | 'prevents' | 'relates_to',
    confidence: e.confidence || 0.7,
    evidence: [] as string[],
    source_articles: [] as string[],
    mention_count: e.mention_count || 1,
    source_syntheses: e.source_syntheses || [],
  }));

  const synthesesForPanel = dashboard.syntheses.map(s => ({
    id: s.id,
    title: s.title,
    date: s.date,
  }));

  return (
    <div style={styles.page}>
      {/* Header Bar (sticky) */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <span style={styles.headerLabel}>DOSSIER</span>
        </div>
      </header>

      {/* Hero */}
      <TopicHero
        topic={dashboard.topic}
        narrativeArc={dashboard.narrative_arc}
        isActive={dashboard.is_active}
        synthesisCount={dashboard.synthesis_count}
        durationDays={dashboard.duration_days || 0}
        transparencyAvg={dashboard.transparency_avg || 0}
        sourcesTotal={dashboard.sources_total || 0}
        entitiesCount={dashboard.key_entities.length}
        causalNodes={dashboard.aggregated_causal_graph.total_nodes}
      />

      {/* Tab Navigation */}
      <div style={styles.tabBar}>
        <div style={styles.tabBarInner}>
          {allTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
              }}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span style={styles.tabCount}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>

        {/* === TAB: Causal Graph === */}
        {activeTab === 'causal' && (
          <section style={styles.section}>
            <div style={{
              borderBottom: '3px solid #000',
              paddingBottom: '12px',
              marginBottom: '24px',
            }}>
              <h2 style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: '28px',
                fontWeight: 700,
                color: '#000',
                margin: '0 0 8px 0',
              }}>
                NEXUS CAUSAL — {dashboard.topic}
              </h2>
              <p style={{
                fontSize: '13px',
                color: '#6B7280',
                margin: 0,
              }}>
                {'Organisme vivant : chaque synthèse enrichit le graphe. Les noeuds grandissent avec les confirmations, les nouveaux pulsent.'}
              </p>
            </div>

            {hasCausalData ? (
              <div style={{
                height: '600px',
                border: '1px solid #E5E5E5',
                backgroundColor: '#FFFFFF',
              }}>
                <LivingCausalGraph
                  nodes={causalNodes}
                  edges={causalEdges}
                  centralEntity={dashboard.topic}
                  narrativeFlow={(dashboard.narrative_arc === 'linear' || dashboard.narrative_arc === 'branching' || dashboard.narrative_arc === 'circular') ? dashboard.narrative_arc as 'linear' | 'branching' | 'circular' : 'linear'}
                  syntheses={synthesesForPanel}
                />
              </div>
            ) : (
              <div style={styles.emptyState}>
                {'Pas de données causales disponibles. Le graphe se remplira automatiquement à mesure que de nouvelles synthèses sont générées.'}
              </div>
            )}

            {/* Predictions below graph */}
            {dashboard.predictions_summary.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  color: '#6B7280',
                  marginBottom: '12px',
                  textTransform: 'uppercase' as const,
                }}>
                  {'SCÉNARIOS PROSPECTIFS'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {dashboard.predictions_summary.slice(0, 5).map((pred, i) => {
                    const horizonLabel = pred.timeframe === 'court_terme' ? 'CT'
                      : pred.timeframe === 'moyen_terme' ? 'MT' : 'LT';
                    const probPct = Math.round(pred.probability * 100);
                    return (
                      <div key={i} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '16px',
                        padding: '12px 16px',
                        borderLeft: `4px solid ${probPct >= 60 ? '#DC2626' : probPct >= 40 ? '#F59E0B' : '#6B7280'}`,
                        backgroundColor: '#F9FAFB',
                      }}>
                        <div style={{
                          fontSize: '20px',
                          fontWeight: 700,
                          color: probPct >= 60 ? '#DC2626' : probPct >= 40 ? '#F59E0B' : '#6B7280',
                          minWidth: '48px',
                        }}>
                          {probPct}%
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#6B7280',
                            letterSpacing: '0.5px',
                            marginBottom: '4px',
                          }}>
                            {horizonLabel} | {pred.type}
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#000',
                            lineHeight: 1.4,
                          }}>
                            {pred.prediction}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* === TAB: Overview === */}
        {activeTab === 'overview' && (
          <section style={styles.section}>
            {/* 2-column layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '40px',
            }}>
              {/* Left column (60%) — entities + recent syntheses */}
              <div>
                {/* Entities */}
                {dashboard.key_entities.length > 0 && (
                  <div style={{ marginBottom: '32px' }}>
                    <h2 style={styles.sectionTitle}>{'Entités clés'}</h2>
                    <TopicEntityCards entities={dashboard.key_entities} />
                  </div>
                )}

                {/* Recent Syntheses */}
                <div>
                  <h2 style={styles.sectionTitle}>{'Dernières synthèses'}</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {dashboard.syntheses.slice(0, 5).map((synthesis, i) => (
                      <Link
                        key={synthesis.id}
                        href={`/synthesis/${synthesis.id}`}
                        style={{
                          display: 'flex',
                          gap: '16px',
                          padding: '16px 0',
                          borderBottom: '1px solid #E5E5E5',
                          textDecoration: 'none',
                          color: '#000',
                          alignItems: 'flex-start',
                        }}
                      >
                        {/* Thumbnail */}
                        {synthesis.imageUrl && (
                          <div style={{
                            width: '80px',
                            height: '60px',
                            overflow: 'hidden',
                            flexShrink: 0,
                            backgroundColor: '#F9FAFB',
                          }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={synthesis.imageUrl}
                              alt=""
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '4px',
                          }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {synthesis.category}
                            </span>
                            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                              {formatDate(synthesis.date)}
                            </span>
                          </div>
                          <h3 style={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#000',
                            margin: 0,
                            fontFamily: 'Georgia, "Times New Roman", serif',
                            lineHeight: 1.3,
                          }}>
                            {synthesis.title}
                          </h3>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column (40%) — sentiment, geo, arc */}
              <div>
                {/* Sentiment Sparkline */}
                {dashboard.sentiment_evolution.length > 0 && (
                  <div style={{
                    marginBottom: '32px',
                    padding: '16px',
                    border: '1px solid #E5E5E5',
                    backgroundColor: '#FFFFFF',
                  }}>
                    <TopicSentimentSparkline data={dashboard.sentiment_evolution} />
                  </div>
                )}

                {/* Geographic Focus */}
                {dashboard.geo_focus.length > 0 && (
                  <div style={{ marginBottom: '32px' }}>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '1.5px',
                      color: '#6B7280',
                      textTransform: 'uppercase',
                      marginBottom: '10px',
                    }}>
                      {'FOCUS GÉOGRAPHIQUE'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {dashboard.geo_focus.map((g, i) => (
                        <span key={i} style={{
                          padding: '6px 14px',
                          backgroundColor: '#F9FAFB',
                          border: '1px solid #E5E5E5',
                          fontSize: '13px',
                          color: '#000',
                        }}>
                          {g.country} <span style={{ color: '#9CA3AF', fontSize: '11px' }}>({g.count})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Narrative Arc */}
                <div style={{
                  padding: '16px',
                  border: '1px solid #E5E5E5',
                  backgroundColor: '#FFFFFF',
                }}>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '1.5px',
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    marginBottom: '10px',
                  }}>
                    ARC NARRATIF
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: arcConfig.color,
                      fontFamily: 'Georgia, "Times New Roman", serif',
                    }}>
                      {arcConfig.label}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '13px',
                    color: '#6B7280',
                    margin: '8px 0 0 0',
                    lineHeight: 1.5,
                  }}>
                    {arcConfig.description}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === TAB: Timeline === */}
        {activeTab === 'timeline' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Chronologie du Dossier</h2>
            <p style={styles.sectionSubtitle}>
              {'Chaque point représente une synthèse. La taille est proportionnelle au nombre de sources,'}
              la couleur indique le sentiment.
            </p>
            <TopicTimeline syntheses={dashboard.syntheses} />
          </section>
        )}

        {/* === TAB: Comparison Table === */}
        {activeTab === 'table' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Tableau Comparatif</h2>
            <SynthesisTable syntheses={dashboard.syntheses} />
          </section>
        )}

        {/* === TAB: Predictions === */}
        {activeTab === 'predictions' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>{'Suivi des Prédictions'}</h2>
            {dashboard.predictions_summary.length > 0 ? (
              <PredictionTracker predictions={dashboard.predictions_summary} />
            ) : (
              <div style={styles.emptyState}>
                {'Aucune prédiction disponible pour ce dossier.'}
              </div>
            )}
          </section>
        )}

        {/* Back Link */}
        <div style={styles.backSection}>
          <Link href="/" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
            {'← Retour à la page d\u0027accueil'}
          </Link>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5E5',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  header: {
    borderBottom: '1px solid #E5E5E5',
    padding: '16px 0',
    backgroundColor: '#FFFFFF',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  headerLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#2563EB',
  },
  tabBar: {
    borderBottom: '1px solid #E5E5E5',
    backgroundColor: '#FFFFFF',
    position: 'sticky',
    top: '57px',
    zIndex: 99,
  },
  tabBarInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    gap: '0',
    overflowX: 'auto',
  },
  tab: {
    padding: '14px 20px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#6B7280',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'inherit',
    transition: 'color 0.15s, border-color 0.15s',
  },
  tabActive: {
    color: '#000000',
    borderBottomColor: '#000000',
  },
  tabCount: {
    fontSize: '11px',
    backgroundColor: '#F3F4F6',
    padding: '1px 6px',
    color: '#6B7280',
    fontWeight: 600,
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px 80px',
  },
  section: {
    marginTop: '40px',
  },
  sectionTitle: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '20px',
    fontWeight: 700,
    color: '#000000',
    margin: '0 0 16px 0',
    paddingBottom: '8px',
    borderBottom: '1px solid #E5E5E5',
  },
  sectionSubtitle: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '0 0 20px 0',
    lineHeight: 1.5,
  },
  emptyState: {
    padding: '48px 24px',
    textAlign: 'center' as const,
    color: '#9CA3AF',
    fontSize: '14px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
  },
  backSection: {
    marginTop: '60px',
    paddingTop: '24px',
    borderTop: '1px solid #E5E5E5',
  },
};
