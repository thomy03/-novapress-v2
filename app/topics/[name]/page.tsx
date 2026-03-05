'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
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
import { Header } from '@/app/components/layout/Header';

// Lazy-load the interactive force graph (all nodes clickable)
const NexusForceGraph = dynamic(
  () => import('@/app/components/causal/NexusForceGraph'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: '#FFFFFF',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '3px solid #E5E5E5',
          borderTopColor: '#2563EB',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ color: '#6B7280', fontSize: '13px' }}>
          Chargement du nexus causal...
        </span>
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

// Node type legend config with distinct shapes
const NODE_TYPE_LEGEND: { type: string; label: string; color: string; shape: 'circle' | 'roundedRect' | 'diamond' | 'hexagon' }[] = [
  { type: 'event', label: 'Evenement', color: '#DC2626', shape: 'circle' },
  { type: 'entity', label: 'Entite', color: '#2563EB', shape: 'roundedRect' },
  { type: 'decision', label: 'Decision', color: '#D97706', shape: 'diamond' },
  { type: 'keyword', label: 'Mot-cle', color: '#059669', shape: 'hexagon' },
];

interface SelectedNodeInfo {
  id: string;
  label: string;
  type: string;
  mentionCount: number;
  sourceSyntheses: string[];
  causedBy: string[];
  causes: string[];
}

interface SelectedEdgeInfo {
  id: string;
  causeLabel: string;
  effectLabel: string;
  relationType: string;
  confidence: number;
  mentionCount: number;
  sourceSyntheses: string[];
}

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
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdgeInfo | null>(null);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

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
      // Fetch hero image for background
      fetch(`${API_URL}/api/trending/topics/${encodeURIComponent(topicName)}/hero-image`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.image_url) setHeroImageUrl(data.image_url); })
        .catch(() => {});
      // Fetch LLM narrative
      setNarrativeLoading(true);
      fetch(`${API_URL}/api/trending/topics/${encodeURIComponent(topicName)}/narrative`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.narrative) setNarrative(data.narrative); })
        .catch(() => {})
        .finally(() => setNarrativeLoading(false));
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

  // Transform causal graph data
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

  // Callback for NexusForceGraph node clicks
  const handleGraphNodeSelect = useCallback((node: {
    id: string;
    label: string;
    type: string;
    mentionCount: number;
    connections: { label: string; direction: 'cause' | 'effect'; relationType: string }[];
  } | null) => {
    if (!node) {
      setSelectedNode(null);
      return;
    }
    const causedBy = node.connections.filter(c => c.direction === 'cause').map(c => c.label);
    const causes = node.connections.filter(c => c.direction === 'effect').map(c => c.label);
    // Collect source syntheses from edges
    const sourceSynths: string[] = [];
    for (const e of causalEdges) {
      if (e.cause_text === node.label || e.effect_text === node.label) {
        for (const sid of (e.source_syntheses || [])) {
          if (!sourceSynths.includes(sid)) sourceSynths.push(sid);
        }
      }
    }
    const rawNode = causalNodes.find(n => n.id === node.id);
    setSelectedNode({
      id: node.id,
      label: node.label,
      type: node.type,
      mentionCount: node.mentionCount,
      sourceSyntheses: [...sourceSynths, ...(rawNode?.source_syntheses || [])],
      causedBy,
      causes,
    });
    setSelectedEdge(null);
  }, [causalEdges, causalNodes]);

  return (
    <div style={{ ...styles.page, position: 'relative' }}>
      {/* Full-page background image */}
      {heroImageUrl && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.22,
              filter: 'grayscale(40%) contrast(0.9)',
            }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.85) 100%)',
          }} />
        </div>
      )}

      {/* Shared Header */}
      <Header />

      {/* Hero — above background */}
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
        firstDate={dashboard.first_date}
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
      <div style={{ ...styles.content, position: 'relative', zIndex: 1 }}>

        {/* === TAB: Causal Graph === */}
        {activeTab === 'causal' && (
          <section style={styles.section}>
            {/* 2-column: Sidebar (narrative or node detail) + Graph */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr',
              gap: '0',
              border: '1px solid #E5E5E5',
              position: 'relative',
              overflow: 'hidden',
            }}>

              {/* LEFT: Sidebar — narrative (default) or node detail (when selected) */}
              <div style={{
                position: 'relative',
                zIndex: 1,
                borderRight: '1px solid #E5E5E5',
                backgroundColor: 'rgba(255,255,255,0.95)',
                padding: '24px 20px',
                overflowY: 'auto',
                maxHeight: '800px',
              }}>
                {selectedNode ? (
                  /* ---- Node detail view ---- */
                  <div>
                    <button
                      onClick={() => setSelectedNode(null)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0',
                        marginBottom: '16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#2563EB',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      &larr; Retour au narratif
                    </button>

                    <div style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      color: NODE_TYPE_LEGEND.find(l => l.type === selectedNode.type)?.color || '#6B7280',
                      textTransform: 'uppercase' as const,
                      marginBottom: '4px',
                    }}>
                      {NODE_TYPE_LEGEND.find(l => l.type === selectedNode.type)?.label || selectedNode.type}
                    </div>
                    <h3 style={{
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      fontSize: '20px',
                      fontWeight: 700,
                      color: '#000',
                      margin: '0 0 12px 0',
                      lineHeight: 1.3,
                    }}>
                      {selectedNode.label}
                    </h3>

                    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px' }}>
                      {selectedNode.mentionCount} mention{selectedNode.mentionCount > 1 ? 's' : ''}
                      {selectedNode.causedBy.length + selectedNode.causes.length > 0 && (
                        <> &middot; {selectedNode.causedBy.length + selectedNode.causes.length} connexion{(selectedNode.causedBy.length + selectedNode.causes.length) > 1 ? 's' : ''}</>
                      )}
                    </div>

                    {selectedNode.causedBy.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: '#DC2626', marginBottom: '6px' }}>
                          ORIGINES
                        </div>
                        {selectedNode.causedBy.map((c, i) => (
                          <div key={i} style={{ fontSize: '13px', color: '#000', padding: '4px 0', borderBottom: '1px solid #F3F4F6' }}>
                            {c}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedNode.causes.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: '#10B981', marginBottom: '6px' }}>
                          CONSEQUENCES
                        </div>
                        {selectedNode.causes.map((c, i) => (
                          <div key={i} style={{ fontSize: '13px', color: '#000', padding: '4px 0', borderBottom: '1px solid #F3F4F6' }}>
                            {c}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedNode.sourceSyntheses.length > 0 && (
                      <div style={{ paddingTop: '12px', borderTop: '1px solid #E5E5E5' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: '#6B7280', marginBottom: '6px' }}>
                          SYNTHESES LIEES
                        </div>
                        {selectedNode.sourceSyntheses.slice(0, 5).map((sid, i) => {
                          const synth = dashboard.syntheses.find(s => s.id === sid);
                          return synth ? (
                            <Link key={i} href={`/synthesis/${sid}`} style={{ display: 'block', fontSize: '12px', color: '#2563EB', textDecoration: 'none', padding: '4px 0' }}>
                              {synth.title.length > 70 ? synth.title.slice(0, 70) + '\u2026' : synth.title}
                            </Link>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ---- Narrative view (default) ---- */
                  <div>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      letterSpacing: '2px',
                      color: '#6B7280',
                      textTransform: 'uppercase' as const,
                      marginBottom: '16px',
                    }}>
                      COMPRENDRE CE DOSSIER
                    </div>

                    <div style={{
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      fontSize: '14.5px',
                      color: '#1F2937',
                      lineHeight: 1.75,
                      marginBottom: '24px',
                    }}>
                      {narrativeLoading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9CA3AF', fontSize: '13px', marginBottom: '12px' }}>
                          <div style={{
                            width: '14px', height: '14px', borderRadius: '50%',
                            border: '2px solid #E5E5E5', borderTopColor: '#2563EB',
                            animation: 'spin 1s linear infinite',
                          }} />
                          Generation de l&apos;analyse...
                        </div>
                      )}
                      {narrative ? (
                        narrative.split('\n').filter(p => p.trim()).map((para, i) => (
                          <p key={i} style={{ margin: '0 0 12px 0' }}>{para}</p>
                        ))
                      ) : !narrativeLoading ? (
                        <>
                          <p style={{ margin: '0 0 12px 0' }}>
                            Le dossier <strong>{dashboard.topic}</strong> est suivi depuis le{' '}
                            {formatDate(dashboard.first_date)}.
                            {' '}En <strong>{dashboard.duration_days || 0} jours</strong>,{' '}
                            <strong>{dashboard.synthesis_count} syntheses</strong> ont ete produites
                            a partir de <strong>{dashboard.sources_total || 0} sources</strong> differentes.
                          </p>
                          {dashboard.key_entities.length > 0 && (
                            <p style={{ margin: '0 0 12px 0' }}>
                              Acteurs cles:{' '}
                              {dashboard.key_entities.slice(0, 4).map(e => e.name).join(', ')}.
                            </p>
                          )}
                          <p style={{ margin: '0' }}>
                            Phase: <strong style={{ color: arcConfig.color }}>{arcConfig.label}</strong>.
                          </p>
                        </>
                      ) : null}
                    </div>

                    <div style={{
                      borderTop: '1px solid #E5E5E5',
                      paddingTop: '16px',
                    }}>
                      <div style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '1.5px',
                        color: '#6B7280',
                        textTransform: 'uppercase' as const,
                        marginBottom: '10px',
                      }}>
                        DERNIERES SYNTHESES
                      </div>
                      {dashboard.syntheses.slice(0, 5).map((s, i) => (
                        <Link
                          key={s.id}
                          href={`/synthesis/${s.id}`}
                          style={{
                            display: 'block',
                            padding: '8px 0',
                            borderBottom: i < 4 ? '1px solid #F3F4F6' : 'none',
                            textDecoration: 'none',
                            color: '#000',
                          }}
                        >
                          <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '2px' }}>
                            {formatDate(s.date)}
                          </div>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            lineHeight: 1.3,
                            color: '#1F2937',
                          }}>
                            {s.title.length > 80 ? s.title.slice(0, 80) + '\u2026' : s.title}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: Graph + connections */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Legend bar */}
                {hasCausalData && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '24px',
                    padding: '10px 16px',
                    backgroundColor: 'rgba(249,250,251,0.9)',
                    borderBottom: '1px solid #E5E5E5',
                  }}>
                    {NODE_TYPE_LEGEND.map(item => (
                      <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 14 14">
                          {item.shape === 'circle' && (
                            <circle cx="7" cy="7" r="6" fill={item.color} opacity={0.7} />
                          )}
                          {item.shape === 'roundedRect' && (
                            <rect x="1" y="1" width="12" height="12" rx="3" fill={item.color} opacity={0.7} />
                          )}
                          {item.shape === 'diamond' && (
                            <polygon points="7,0.5 13.5,7 7,13.5 0.5,7" fill={item.color} opacity={0.7} />
                          )}
                          {item.shape === 'hexagon' && (
                            <polygon points="3.5,0.5 10.5,0.5 14,7 10.5,13.5 3.5,13.5 0,7" fill={item.color} opacity={0.7} />
                          )}
                        </svg>
                        <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Interactive Force Graph */}
                <div style={{ minWidth: 0 }}>
                  {hasCausalData ? (
                    <NexusForceGraph
                      topic={dashboard.topic}
                      nodes={causalNodes}
                      edges={causalEdges}
                      centralEntity={dashboard.topic}
                      height={600}
                      onNodeSelect={handleGraphNodeSelect}
                    />
                  ) : (
                    <div style={styles.emptyState}>
                      {'Pas de donnees causales disponibles. Le graphe se remplira automatiquement a mesure que de nouvelles syntheses sont generees.'}
                    </div>
                  )}
                </div>

                {/* Connections list below graph */}
                {hasCausalData && (
                  <div style={{
                    padding: '16px',
                    borderTop: '1px solid #E5E5E5',
                    backgroundColor: 'rgba(255,255,255,0.95)',
                  }}>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '1.5px',
                      color: '#6B7280',
                      textTransform: 'uppercase' as const,
                      marginBottom: '10px',
                    }}>
                      CONNEXIONS CAUSALES ({causalEdges.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {causalEdges.slice(0, 12).map((edge, idx) => {
                        const isSelected = selectedEdge?.id === (edge.id || `edge-${idx}`);
                        const typeColor = edge.relation_type === 'causes' ? '#DC2626'
                          : edge.relation_type === 'triggers' ? '#F59E0B'
                          : edge.relation_type === 'enables' ? '#10B981'
                          : edge.relation_type === 'prevents' ? '#6B7280'
                          : '#8B5CF6';
                        return (
                          <button
                            key={edge.id || `edge-${idx}`}
                            onClick={() => {
                              setSelectedEdge({
                                id: edge.id || `edge-${idx}`,
                                causeLabel: edge.cause_text,
                                effectLabel: edge.effect_text,
                                relationType: edge.relation_type,
                                confidence: edge.confidence,
                                mentionCount: edge.mention_count || 1,
                                sourceSyntheses: edge.source_syntheses || [],
                              });
                              setSelectedNode(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              fontSize: '13px',
                              backgroundColor: isSelected ? '#F9FAFB' : '#FFFFFF',
                              color: '#000',
                              border: `1px solid ${isSelected ? typeColor : '#E5E5E5'}`,
                              borderLeft: `3px solid ${typeColor}`,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              textAlign: 'left' as const,
                              width: '100%',
                            }}
                          >
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontWeight: 600 }}>
                                {edge.cause_text.length > 35 ? edge.cause_text.slice(0, 35) + '\u2026' : edge.cause_text}
                              </span>
                              <span style={{ color: typeColor, fontWeight: 700, margin: '0 6px', fontSize: '11px' }}>
                                {'\u2192'}
                              </span>
                              <span>
                                {edge.effect_text.length > 35 ? edge.effect_text.slice(0, 35) + '\u2026' : edge.effect_text}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Inline edge detail panel (below connections) */}
                {selectedEdge && !selectedNode && (
                  <div style={{
                    margin: '16px',
                    padding: '20px',
                    border: '1px solid #E5E5E5',
                    backgroundColor: '#F9FAFB',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '1px',
                        color: '#6B7280',
                        textTransform: 'uppercase' as const,
                      }}>
                        RELATION CAUSALE
                      </div>
                      <button
                        onClick={() => setSelectedEdge(null)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '18px',
                          color: '#9CA3AF',
                          padding: '0',
                          fontFamily: 'inherit',
                        }}
                      >
                        &times;
                      </button>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 1fr',
                      gap: '16px',
                      alignItems: 'center',
                    }}>
                      {/* Cause */}
                      <div>
                        <div style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '1px',
                          color: '#DC2626',
                          textTransform: 'uppercase' as const,
                          marginBottom: '6px',
                        }}>
                          CAUSE
                        </div>
                        <div style={{
                          fontFamily: 'Georgia, "Times New Roman", serif',
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#000',
                          lineHeight: 1.3,
                        }}>
                          {selectedEdge.causeLabel}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div style={{
                        textAlign: 'center',
                        color: (() => {
                          if (selectedEdge.relationType === 'causes') return '#DC2626';
                          if (selectedEdge.relationType === 'triggers') return '#F59E0B';
                          if (selectedEdge.relationType === 'enables') return '#10B981';
                          if (selectedEdge.relationType === 'prevents') return '#6B7280';
                          return '#8B5CF6';
                        })(),
                        fontSize: '20px',
                        fontWeight: 700,
                      }}>
                        &rarr;
                        <div style={{ fontSize: '9px', letterSpacing: '1px', fontWeight: 700, marginTop: '2px' }}>
                          {selectedEdge.relationType === 'causes' ? 'CAUSE' :
                           selectedEdge.relationType === 'triggers' ? 'DECLENCHE' :
                           selectedEdge.relationType === 'enables' ? 'PERMET' :
                           selectedEdge.relationType === 'prevents' ? 'EMPECHE' : 'LIE A'}
                        </div>
                      </div>

                      {/* Effect */}
                      <div>
                        <div style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '1px',
                          color: '#2563EB',
                          textTransform: 'uppercase' as const,
                          marginBottom: '6px',
                        }}>
                          EFFET
                        </div>
                        <div style={{
                          fontFamily: 'Georgia, "Times New Roman", serif',
                          fontSize: '16px',
                          fontWeight: 700,
                          color: '#000',
                          lineHeight: 1.3,
                        }}>
                          {selectedEdge.effectLabel}
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{
                      display: 'flex',
                      gap: '24px',
                      marginTop: '16px',
                      paddingTop: '12px',
                      borderTop: '1px solid #E5E5E5',
                      fontSize: '12px',
                      color: '#6B7280',
                    }}>
                      <span>Confiance: <strong style={{ color: '#000' }}>{Math.round(selectedEdge.confidence * 100)}%</strong></span>
                      <span>Mentions: <strong style={{ color: '#000' }}>{selectedEdge.mentionCount}</strong></span>
                      {selectedEdge.sourceSyntheses.length > 0 && (
                        <span>{selectedEdge.sourceSyntheses.length} synthese{selectedEdge.sourceSyntheses.length > 1 ? 's' : ''} liee{selectedEdge.sourceSyntheses.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

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
                  {'SC\u00c9NARIOS PROSPECTIFS'}
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
            {/* Dossier Summary */}
            <div style={{
              borderLeft: '3px solid #000',
              padding: '16px 20px',
              marginBottom: '32px',
              backgroundColor: '#F9FAFB',
            }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '2px',
                color: '#6B7280',
                textTransform: 'uppercase' as const,
                marginBottom: '8px',
              }}>
                RESUME DU DOSSIER
              </div>
              <p style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: '16px',
                color: '#374151',
                lineHeight: 1.6,
                margin: 0,
              }}>
                Ce dossier suit <strong>{dashboard.topic}</strong> depuis le{' '}
                {formatDate(dashboard.first_date)} a travers{' '}
                <strong>{dashboard.synthesis_count} syntheses</strong>.
                {dashboard.key_entities.length > 0 && (
                  <>
                    {' '}Les acteurs principaux sont{' '}
                    <strong>
                      {dashboard.key_entities.slice(0, 3).map(e => e.name).join(', ')}
                    </strong>.
                  </>
                )}
                {' '}Le sujet est actuellement{' '}
                <strong style={{ color: arcConfig.color }}>
                  {arcConfig.label.toLowerCase()}
                </strong>.
              </p>
            </div>

            {/* 2-column layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '40px',
            }}>
              {/* Left column — entities + recent syntheses */}
              <div>
                {/* Entities */}
                {dashboard.key_entities.length > 0 && (
                  <div style={{ marginBottom: '32px' }}>
                    <h2 style={styles.sectionTitle}>{'Entit\u00e9s cl\u00e9s'}</h2>
                    <TopicEntityCards entities={dashboard.key_entities} />
                  </div>
                )}

                {/* Recent Syntheses */}
                <div>
                  <h2 style={styles.sectionTitle}>{'Derni\u00e8res synth\u00e8ses'}</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {dashboard.syntheses.slice(0, 5).map((synthesis) => (
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

              {/* Right column — sentiment, geo, arc */}
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
                      {'FOCUS G\u00c9OGRAPHIQUE'}
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
              {'Chaque point repr\u00e9sente une synth\u00e8se. La taille est proportionnelle au nombre de sources,'}
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
            <h2 style={styles.sectionTitle}>{'Suivi des Pr\u00e9dictions'}</h2>
            {dashboard.predictions_summary.length > 0 ? (
              <PredictionTracker predictions={dashboard.predictions_summary} />
            ) : (
              <div style={styles.emptyState}>
                {'Aucune pr\u00e9diction disponible pour ce dossier.'}
              </div>
            )}
          </section>
        )}

        {/* Back Link */}
        <div style={styles.backSection}>
          <Link href="/" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
            {'\u2190 Retour \u00e0 la page d\u0027accueil'}
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
  tabBar: {
    borderBottom: '1px solid #E5E5E5',
    backgroundColor: '#FFFFFF',
    position: 'sticky',
    top: '0px',
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
