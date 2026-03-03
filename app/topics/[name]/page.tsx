'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { EntityFrequencyChart, SentimentChart } from '@/app/components/charts';
import {
  NarrativeArcIndicator,
  TopicKPIBar,
  TopicTimeline,
  SynthesisTable,
  PredictionTracker,
} from '@/app/components/topics';

// Lazy-load the causal graph (heavy dependency: reactflow)
const NeuralCausalGraph = dynamic(
  () => import('@/app/components/causal/NeuralCausalGraph'),
  { ssr: false, loading: () => <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: '14px' }}>Chargement du graphe causal...</div> }
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
  nodes: { id: string; label: string; type: string }[];
  edges: { source: string; target: string; type: string; confidence?: number }[];
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
  emerging: { label: 'Emergent', color: '#2563EB', description: 'Sujet recent, peu de couverture' },
  developing: { label: 'En developpement', color: '#10B981', description: 'Attention mediatique croissante' },
  peak: { label: 'Point culminant', color: '#DC2626', description: 'Maximum de couverture mediatique' },
  declining: { label: 'En declin', color: '#F59E0B', description: 'Interet mediatique en baisse' },
  resolved: { label: 'Resolu', color: '#6B7280', description: 'Sujet clos ou resolu' }
};

type TabId = 'overview' | 'timeline' | 'table' | 'causal' | 'predictions';

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
  // Support ?tab=causal from synthesis page link
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
            throw new Error('Topic non trouve ou pas assez de syntheses (minimum 3 requis)');
          }
          throw new Error('Erreur lors du chargement du dashboard');
        }

        const data = await response.json();
        setDashboard(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    if (topicName) {
      fetchDashboard();
    }
  }, [topicName]);

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

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Vue d\'ensemble' },
    { id: 'timeline', label: 'Chronologie', count: dashboard.synthesis_count },
    { id: 'table', label: 'Comparatif', count: dashboard.synthesis_count },
    { id: 'causal', label: 'Graphe causal', count: dashboard.aggregated_causal_graph.total_nodes },
    { id: 'predictions', label: 'Predictions', count: dashboard.predictions_summary.length },
  ];

  // Transform causal graph data for NeuralCausalGraph
  const causalNodes = dashboard.aggregated_causal_graph.nodes.map(n => ({
    id: n.id,
    label: n.label,
    node_type: (n.type || 'event') as 'event' | 'entity' | 'decision' | 'keyword',
    fact_density: 0.5,
  }));
  const nodeLabelsById = Object.fromEntries(causalNodes.map(n => [n.id, n.label]));
  const causalEdges = dashboard.aggregated_causal_graph.edges.map(e => ({
    cause_text: nodeLabelsById[e.source] || e.source,
    effect_text: nodeLabelsById[e.target] || e.target,
    relation_type: (e.type || 'causes') as 'causes' | 'triggers' | 'enables' | 'prevents' | 'relates_to',
    confidence: e.confidence || 0.7,
    evidence: [] as string[],
    source_articles: [] as string[],
  }));
  const hasCausalData = causalNodes.length > 0;

  return (
    <div style={styles.page}>
      {/* Header Bar */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link href="/" style={styles.backLink}>
            <span style={{ fontSize: '18px' }}>&larr;</span>
            <span>Retour aux actualites</span>
          </Link>
          <span style={styles.headerLabel}>DOSSIER</span>
        </div>
      </header>

      {/* Hero Section */}
      <div style={styles.hero}>
        <div style={styles.badgeRow}>
          <span style={styles.dossieBadge}>DOSSIER</span>
          <NarrativeArcIndicator arc={dashboard.narrative_arc as 'emerging' | 'developing' | 'peak' | 'declining' | 'resolved'} size="medium" />
          {dashboard.is_active && (
            <span style={styles.activeBadge}>EN COURS</span>
          )}
        </div>

        <h1 style={styles.title}>{dashboard.topic}</h1>

        <p style={styles.arcDescription}>
          <span style={{ color: arcConfig.color, fontWeight: 600 }}>{arcConfig.label}</span>
          {' \u2014 '}{arcConfig.description}
        </p>

        {/* KPI Bar */}
        <TopicKPIBar
          synthesisCount={dashboard.synthesis_count}
          durationDays={dashboard.duration_days || 0}
          transparencyAvg={dashboard.transparency_avg || 0}
          sourcesTotal={dashboard.sources_total || 0}
          entitiesCount={dashboard.key_entities.length}
          causalNodes={dashboard.aggregated_causal_graph.total_nodes}
        />
      </div>

      {/* Tab Navigation */}
      <div style={styles.tabBar}>
        <div style={styles.tabBarInner}>
          {tabs.map((tab) => (
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

      {/* Main Content */}
      <div style={styles.content}>

        {/* === TAB: Overview === */}
        {activeTab === 'overview' && (
          <>
            {/* Key Entities */}
            {dashboard.key_entities.length > 0 && (
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Entites Cles</h2>
                <div style={styles.entityGrid}>
                  {dashboard.key_entities.slice(0, 12).map((entity, index) => (
                    <div key={index} style={styles.entityCard}>
                      <span style={styles.entityType}>{entity.type}</span>
                      <span style={styles.entityName}>{entity.name}</span>
                      <span style={styles.entityCount}>{entity.count} mentions</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Charts Row */}
            {(dashboard.sentiment_evolution.length > 0 || dashboard.key_entities.length > 0) && (
              <div style={styles.chartsRow}>
                {dashboard.sentiment_evolution.length > 0 && (
                  <section style={styles.chartCard}>
                    <SentimentChart
                      synthesisId=""
                      data={dashboard.sentiment_evolution}
                      title="Evolution du Sentiment"
                    />
                  </section>
                )}
                {dashboard.key_entities.length > 0 && (
                  <section style={styles.chartCard}>
                    <EntityFrequencyChart
                      synthesisId=""
                      entities={dashboard.key_entities.map(e => ({
                        name: e.name,
                        count: e.count,
                        type: e.type
                      }))}
                      title="Frequence des Entites"
                    />
                  </section>
                )}
              </div>
            )}

            {/* Geographic Focus */}
            {dashboard.geo_focus.length > 0 && (
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Focus Geographique</h2>
                <div style={styles.geoGrid}>
                  {dashboard.geo_focus.map((g, index) => (
                    <div key={index} style={styles.geoCard}>
                      <span style={styles.geoCountry}>{g.country}</span>
                      <span style={styles.geoCount}>{g.count} mentions</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Syntheses */}
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>
                Dernieres Syntheses
              </h2>
              <div style={styles.synthesesList}>
                {dashboard.syntheses.slice(0, 5).map((synthesis) => (
                  <Link
                    key={synthesis.id}
                    href={`/synthesis/${synthesis.id}`}
                    style={styles.synthesisCard}
                  >
                    <div style={styles.synthesisTop}>
                      <span style={styles.synthesisCategory}>{synthesis.category}</span>
                      <span style={styles.synthesisDate}>{formatDate(synthesis.date)}</span>
                    </div>
                    <h3 style={styles.synthesisTitle}>{synthesis.title}</h3>
                    {synthesis.summary && (
                      <p style={styles.synthesisSummary}>
                        {synthesis.summary.length > 200
                          ? synthesis.summary.substring(0, 200) + '...'
                          : synthesis.summary}
                      </p>
                    )}
                    <span style={styles.readMore}>Lire la synthese &rarr;</span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        {/* === TAB: Timeline === */}
        {activeTab === 'timeline' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Chronologie du Dossier</h2>
            <p style={styles.sectionSubtitle}>
              Chaque point represente une synthese. La taille est proportionnelle au nombre de sources,
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

        {/* === TAB: Causal Graph (Phase 4B-4C redesign) === */}
        {activeTab === 'causal' && (
          <>
            {/* NEXUS CAUSAL Header */}
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
                <div style={{
                  display: 'flex',
                  gap: '24px',
                  fontSize: '13px',
                  color: '#6B7280',
                }}>
                  <span>{dashboard.synthesis_count} syntheses</span>
                  <span>{dashboard.aggregated_causal_graph.total_nodes} noeuds</span>
                  <span>{dashboard.aggregated_causal_graph.total_edges} relations</span>
                  <span>Arc: <strong style={{ color: arcConfig.color }}>{arcConfig.label}</strong></span>
                </div>
              </div>

              {/* Central Entities */}
              {dashboard.key_entities.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '2px',
                    color: '#6B7280',
                    marginBottom: '10px',
                    textTransform: 'uppercase' as const,
                  }}>
                    ENTITES CENTRALES
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {dashboard.key_entities.slice(0, 8).map((entity, i) => (
                      <span key={i} style={{
                        display: 'inline-block',
                        padding: '6px 14px',
                        backgroundColor: i < 3 ? '#000' : '#F9FAFB',
                        color: i < 3 ? '#FFF' : '#000',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: i >= 3 ? '1px solid #E5E5E5' : 'none',
                        letterSpacing: '0.3px',
                      }}>
                        {entity.name.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Causal Graph — White newspaper style */}
            <section style={styles.section}>
              <div style={{
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '2px',
                color: '#6B7280',
                marginBottom: '12px',
                textTransform: 'uppercase' as const,
              }}>
                GRAPHE CAUSAL
              </div>
              {hasCausalData ? (
                <div style={{
                  height: '500px',
                  border: '1px solid #E5E5E5',
                  backgroundColor: '#FFFFFF',
                }}>
                  <NeuralCausalGraph
                    nodes={causalNodes}
                    edges={causalEdges}
                    centralEntity={dashboard.topic}
                    narrativeFlow="linear"
                  />
                </div>
              ) : (
                <div style={styles.emptyState}>
                  Pas de donnees causales disponibles. Le graphe se remplira automatiquement
                  a mesure que de nouvelles syntheses sont generees.
                </div>
              )}
            </section>

            {/* Scenarios Prospectifs */}
            {dashboard.predictions_summary.length > 0 && (
              <section style={styles.section}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '2px',
                  color: '#6B7280',
                  marginBottom: '12px',
                  textTransform: 'uppercase' as const,
                }}>
                  SCENARIOS PROSPECTIFS
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
              </section>
            )}

            {/* Chronologie du Theme */}
            <section style={styles.section}>
              <div style={{
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '2px',
                color: '#6B7280',
                marginBottom: '12px',
                textTransform: 'uppercase' as const,
              }}>
                CHRONOLOGIE DU THEME
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {dashboard.syntheses.slice(0, 10).map((synthesis, i) => {
                  const isLast = i === 0;
                  return (
                    <Link
                      key={synthesis.id}
                      href={`/synthesis/${synthesis.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '12px 0',
                        borderBottom: '1px solid #E5E5E5',
                        textDecoration: 'none',
                        color: '#000',
                      }}
                    >
                      <span style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        minWidth: '60px',
                        whiteSpace: 'nowrap',
                      }}>
                        {formatDate(synthesis.date).split(' ').slice(0, 2).join(' ')}
                      </span>
                      <span style={{
                        flex: 1,
                        fontSize: '14px',
                        fontWeight: isLast ? 700 : 400,
                        color: isLast ? '#000' : '#374151',
                        lineHeight: 1.3,
                      }}>
                        {synthesis.title}
                      </span>
                      {isLast && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: '#DC2626',
                          backgroundColor: '#FEE2E2',
                          padding: '2px 8px',
                          letterSpacing: '0.5px',
                        }}>
                          ACTUEL
                        </span>
                      )}
                      <span style={{ fontSize: '12px', color: '#2563EB' }}>Lire &rarr;</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* === TAB: Predictions === */}
        {activeTab === 'predictions' && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Suivi des Predictions</h2>
            {dashboard.predictions_summary.length > 0 ? (
              <PredictionTracker predictions={dashboard.predictions_summary} />
            ) : (
              <div style={styles.emptyState}>
                Aucune prediction disponible pour ce dossier.
              </div>
            )}
          </section>
        )}

        {/* Back Link */}
        <div style={styles.backSection}>
          <Link href="/" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
            &larr; Retour a la page d&apos;accueil
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
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// Newspaper Style
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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6B7280',
    textDecoration: 'none',
    fontSize: '14px',
  },
  headerLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#2563EB',
  },
  hero: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 24px 0',
    borderBottom: '2px solid #000000',
    paddingBottom: '32px',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  dossieBadge: {
    display: 'inline-block',
    backgroundColor: '#000000',
    color: '#FFFFFF',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
  },
  activeBadge: {
    display: 'inline-block',
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.5px',
  },
  title: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '42px',
    fontWeight: 700,
    lineHeight: 1.15,
    color: '#000000',
    margin: '0 0 12px 0',
  },
  arcDescription: {
    fontSize: '15px',
    color: '#6B7280',
    fontStyle: 'italic',
    margin: 0,
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
  entityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  entityCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px 16px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
  },
  entityType: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  entityName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#000000',
  },
  entityCount: {
    fontSize: '12px',
    color: '#9CA3AF',
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
    marginTop: '40px',
  },
  chartCard: {
    border: '1px solid #E5E5E5',
    padding: '16px',
    backgroundColor: '#FFFFFF',
  },
  geoGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  geoCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
  },
  geoCountry: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#000000',
  },
  geoCount: {
    fontSize: '12px',
    color: '#6B7280',
  },
  synthesesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  synthesisCard: {
    display: 'block',
    padding: '20px 0',
    borderBottom: '1px solid #E5E5E5',
    textDecoration: 'none',
    color: '#000000',
  },
  synthesisTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  synthesisCategory: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#DC2626',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  synthesisDate: {
    fontSize: '12px',
    color: '#9CA3AF',
  },
  synthesisTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#000000',
    margin: '0 0 6px 0',
    fontFamily: 'Georgia, "Times New Roman", serif',
    lineHeight: 1.3,
  },
  synthesisSummary: {
    fontSize: '14px',
    color: '#6B7280',
    margin: '0 0 8px 0',
    lineHeight: 1.5,
  },
  readMore: {
    fontSize: '13px',
    color: '#2563EB',
    fontWeight: 500,
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
