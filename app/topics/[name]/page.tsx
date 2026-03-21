'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTheme } from '@/app/contexts/ThemeContext';
import { getNodeIcon, getNodeSize, condensLabel } from '@/app/lib/causal-icons';
import { Header } from '@/app/components/layout/Header';

// Lazy-load the interactive force graph
const NexusForceGraph = dynamic(
  () => import('@/app/components/causal/NexusForceGraph'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: '#2563EB',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
          Loading causal graph...
        </span>
      </div>
    ),
  }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const NARRATIVE_ARC_CONFIG: Record<string, { label: string; labelEN: string; color: string }> = {
  emerging:   { label: 'Emergent',         labelEN: 'EMERGING',   color: '#2563EB' },
  developing: { label: 'En developpement', labelEN: 'DEVELOPING', color: '#10B981' },
  peak:       { label: 'Point culminant',  labelEN: 'PEAK',       color: '#DC2626' },
  declining:  { label: 'En declin',        labelEN: 'DECLINING',  color: '#F59E0B' },
  resolved:   { label: 'Resolu',           labelEN: 'RESOLVED',   color: '#6B7280' },
};

const NODE_TYPE_COLORS: Record<string, string> = {
  event: '#DC2626',
  entity: '#2563EB',
  decision: '#D97706',
  keyword: '#059669',
};

// ---------------------------------------------------------------------------
// Page wrapper with Suspense
// ---------------------------------------------------------------------------

export default function TopicDashboardPageWrapper() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', color: '#FFF' }}>Loading...</div>}>
      <TopicDashboardPage />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

function TopicDashboardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { theme, darkMode } = useTheme();
  const topicName = decodeURIComponent(params.name as string);

  const [dashboard, setDashboard] = useState<TopicDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdgeInfo | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const relatedScrollRef = useRef<HTMLDivElement | null>(null);

  // ---- surface color helpers (Stitch terminal palette) ----
  const surface = {
    lowest:        darkMode ? '#050505' : '#F0F0F0',
    low:           darkMode ? '#0D0D0D' : '#F5F5F5',
    base:          darkMode ? '#111111' : '#FAFAFA',
    container:     darkMode ? '#181818' : '#F3F3F3',
    containerHigh: darkMode ? '#1E1E1E' : '#EDEDED',
    text:          darkMode ? '#FAFAFA' : '#0A0A0A',
    text90:        darkMode ? 'rgba(250,250,250,0.9)' : 'rgba(10,10,10,0.9)',
    text70:        darkMode ? 'rgba(250,250,250,0.7)' : 'rgba(10,10,10,0.7)',
    text50:        darkMode ? 'rgba(250,250,250,0.5)' : 'rgba(10,10,10,0.5)',
    text30:        darkMode ? 'rgba(250,250,250,0.3)' : 'rgba(10,10,10,0.3)',
    text10:        darkMode ? 'rgba(250,250,250,0.1)' : 'rgba(10,10,10,0.1)',
    border:        darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    primary:       '#2563EB',
    red:           '#DC2626',
    cyan:          '#06B6D4',
    amber:         '#F59E0B',
    emerald:       '#10B981',
  };

  // ---- Data fetching (unchanged) ----
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
      // Hero image
      fetch(`${API_URL}/api/trending/topics/${encodeURIComponent(topicName)}/hero-image`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.image_url) setHeroImageUrl(data.image_url); })
        .catch(() => {});
      // Narrative
      setNarrativeLoading(true);
      fetch(`${API_URL}/api/trending/topics/${encodeURIComponent(topicName)}/narrative`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.narrative) setNarrative(data.narrative); })
        .catch(() => {})
        .finally(() => setNarrativeLoading(false));
    }
  }, [topicName, searchParams]);

  // ---- Graph callbacks ----
  const handleGraphNodeSelect = useCallback((node: {
    id: string;
    label: string;
    type: string;
    mentionCount: number;
    connections: { label: string; direction: 'cause' | 'effect'; relationType: string }[];
  } | null) => {
    if (!node || !dashboard) { setSelectedNode(null); return; }
    const causedBy = node.connections.filter(c => c.direction === 'cause').map(c => c.label);
    const causes = node.connections.filter(c => c.direction === 'effect').map(c => c.label);
    const rawEdges = dashboard.aggregated_causal_graph.edges;
    const rawNodes = dashboard.aggregated_causal_graph.nodes;
    const nodeLabels = Object.fromEntries(rawNodes.map(n => [n.id, n.label]));
    const sourceSynths: string[] = [];
    for (const e of rawEdges) {
      const causeText = e.cause_text || nodeLabels[e.source || ''] || '';
      const effectText = e.effect_text || nodeLabels[e.target || ''] || '';
      if (causeText === node.label || effectText === node.label) {
        for (const sid of (e.source_syntheses || [])) {
          if (!sourceSynths.includes(sid)) sourceSynths.push(sid);
        }
      }
    }
    const rawNode = rawNodes.find(n => n.id === node.id);
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
  }, [dashboard]);

  const handleGraphEdgeSelect = useCallback((edge: {
    id: string;
    causeLabel: string;
    effectLabel: string;
    relationType: string;
    confidence: number;
    mentionCount: number;
    sourceSyntheses: string[];
  } | null) => {
    if (!edge) { setSelectedEdge(null); return; }
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  // ---- Loading state ----
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: surface.lowest, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `2px solid ${surface.border}`, borderTopColor: surface.primary, animation: 'spin 1s linear infinite' }} />
          <span style={{ color: surface.text50, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>Loading dossier...</span>
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error || !dashboard) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: surface.lowest, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', padding: '48px' }}>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-serif, Georgia, serif)', color: surface.text, margin: 0 }}>Dossier non disponible</h1>
          <p style={{ color: surface.text50, fontSize: '14px', margin: 0 }}>{error}</p>
          <Link href="/" style={{ color: surface.primary, textDecoration: 'none', fontSize: '13px', marginTop: '8px' }}>
            &larr; Retour
          </Link>
        </div>
      </div>
    );
  }

  const arcConfig = NARRATIVE_ARC_CONFIG[dashboard.narrative_arc] || NARRATIVE_ARC_CONFIG.developing;
  const hasCausalData = dashboard.aggregated_causal_graph.total_nodes > 0;
  const dossierId = `NVP-${topicName.replace(/[^A-Za-z0-9]/g, '').substring(0, 6).toUpperCase()}-${dashboard.synthesis_count}`;

  // Transform causal graph data for NexusForceGraph
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

  // Build fact cards from narrative + entities
  const factCards: { label: string; body: string; color: string }[] = [];
  if (dashboard.key_entities.length > 0) {
    factCards.push({
      label: 'KEY ACTORS',
      body: dashboard.key_entities.slice(0, 4).map(e => e.name).join(', '),
      color: surface.cyan,
    });
  }
  factCards.push({
    label: 'TRAJECTORY',
    body: `${arcConfig.label} — ${dashboard.duration_days} day${dashboard.duration_days !== 1 ? 's' : ''} tracked since ${formatDate(dashboard.first_date)}`,
    color: surface.amber,
  });
  if (dashboard.geo_focus.length > 0) {
    factCards.push({
      label: 'GEO FOCUS',
      body: dashboard.geo_focus.slice(0, 3).map(g => `${g.country} (${g.count})`).join(', '),
      color: surface.cyan,
    });
  }
  if (dashboard.predictions_summary.length > 0) {
    const topPred = dashboard.predictions_summary[0];
    factCards.push({
      label: 'TOP PREDICTION',
      body: `${Math.round(topPred.probability * 100)}% — ${topPred.prediction.length > 80 ? topPred.prediction.slice(0, 80) + '...' : topPred.prediction}`,
      color: surface.amber,
    });
  }

  // Build narrative summary text
  const summaryText = narrative
    ? narrative.split('\n').filter(p => p.trim()).slice(0, 3).join(' ')
    : `Le dossier ${dashboard.topic} est suivi depuis le ${formatDate(dashboard.first_date)}. En ${dashboard.duration_days} jours, ${dashboard.synthesis_count} syntheses ont ete produites a partir de ${dashboard.sources_total} sources.${dashboard.key_entities.length > 0 ? ` Acteurs cles: ${dashboard.key_entities.slice(0, 3).map(e => e.name).join(', ')}.` : ''}`;

  // Get unique categories from related syntheses for "related dossiers" simulation
  const relatedTopicCards = dashboard.syntheses
    .filter((s, i, arr) => arr.findIndex(x => x.category === s.category) === i)
    .slice(0, 6)
    .map(s => ({
      category: s.category,
      title: s.title,
      id: s.id,
      entityCount: dashboard.key_entities.filter(e => s.title.toLowerCase().includes(e.name.toLowerCase())).length || Math.floor(Math.random() * 5) + 1,
    }));

  const categoryColor = (cat: string): string => {
    const map: Record<string, string> = {
      MONDE: '#3B82F6', TECH: '#8B5CF6', ECONOMIE: '#10B981',
      POLITIQUE: '#EF4444', CULTURE: '#F59E0B', SPORT: '#06B6D4',
      SCIENCES: '#8B5CF6',
    };
    return map[cat] || surface.primary;
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: surface.lowest, color: surface.text }}>
      <Header />

      {/* ================================================================== */}
      {/* HERO SECTION                                                        */}
      {/* ================================================================== */}
      <section style={{
        backgroundColor: surface.low,
        borderBottom: `1px solid ${surface.border}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Faint hero background image */}
        {heroImageUrl && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.06, filter: 'grayscale(100%)' }} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 0%, ${surface.low} 100%)` }} />
          </div>
        )}

        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '48px 48px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '48px',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Left: badge + topic name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Narrative arc badge + dossier ID */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{
                display: 'inline-block',
                padding: '3px 10px',
                backgroundColor: arcConfig.color,
                color: '#FFFFFF',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase' as const,
                fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
              }}>
                {arcConfig.labelEN}
              </span>
              <span style={{
                fontSize: '10px',
                color: surface.text30,
                letterSpacing: '0.1em',
                fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
              }}>
                {dossierId}
              </span>
            </div>

            {/* Topic name */}
            <h1 style={{
              fontFamily: 'var(--font-serif, Georgia, serif)',
              fontSize: 'clamp(36px, 5vw, 64px)',
              fontWeight: 400,
              fontStyle: 'italic',
              color: surface.text,
              margin: 0,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}>
              {dashboard.topic}
            </h1>
          </div>

          {/* Right: metrics */}
          <div style={{
            display: 'flex',
            borderLeft: `1px solid ${surface.border}`,
            paddingLeft: '32px',
            gap: '32px',
            flexShrink: 0,
          }}>
            <div>
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase' as const,
                color: surface.text50,
                marginBottom: '4px',
                fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
              }}>Syntheses</div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: surface.text,
                fontFamily: 'var(--font-sans, system-ui)',
              }}>{dashboard.synthesis_count}</div>
            </div>
            <div>
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.2em',
                textTransform: 'uppercase' as const,
                color: surface.text50,
                marginBottom: '4px',
                fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
              }}>Entities</div>
              <div style={{
                fontSize: '24px',
                fontWeight: 700,
                color: surface.text,
                fontFamily: 'var(--font-sans, system-ui)',
              }}>{dashboard.key_entities.length}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* MAIN CONTENT: 2-column grid                                        */}
      {/* ================================================================== */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 48px 80px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '7fr 5fr',
          gap: '48px',
        }}>

          {/* ============================================================ */}
          {/* LEFT COLUMN                                                   */}
          {/* ============================================================ */}
          <div>

            {/* ---- INTELLIGENCE BRIEF ---- */}
            <section style={{ marginBottom: '48px' }}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase' as const,
                  color: surface.primary,
                  fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                  whiteSpace: 'nowrap',
                }}>INTELLIGENCE BRIEF</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: surface.border }} />
              </div>

              {/* Summary text */}
              <div style={{
                fontSize: '18px',
                lineHeight: 1.7,
                color: surface.text90,
                fontFamily: 'var(--font-serif, Georgia, serif)',
                marginBottom: '24px',
              }}>
                {narrativeLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: surface.text30, fontSize: '11px', marginBottom: '12px', fontFamily: 'var(--font-sans, system-ui)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${surface.border}`, borderTopColor: surface.primary, animation: 'spin 1s linear infinite' }} />
                    Generating analysis...
                  </div>
                )}
                {narrative ? (
                  narrative.split('\n').filter(p => p.trim()).slice(0, 3).map((para, i) => (
                    <p key={i} style={{ margin: i === 0 ? '0 0 12px 0' : '0 0 12px 0' }}>{para}</p>
                  ))
                ) : !narrativeLoading ? (
                  <p style={{ margin: 0 }}>{summaryText}</p>
                ) : null}
              </div>

              {/* Fact cards — 2-column grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}>
                {factCards.map((card, i) => (
                  <div key={i} style={{
                    backgroundColor: surface.container,
                    borderLeft: `3px solid ${card.color}`,
                    padding: '14px 16px',
                  }}>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase' as const,
                      color: card.color,
                      marginBottom: '6px',
                      fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                    }}>{card.label}</div>
                    <div style={{
                      fontSize: '13px',
                      lineHeight: 1.5,
                      color: surface.text70,
                      fontFamily: 'var(--font-sans, system-ui)',
                    }}>{card.body}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ---- AGGREGATED CAUSAL GRAPH ---- */}
            <section>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase' as const,
                  color: surface.primary,
                  fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                  whiteSpace: 'nowrap',
                }}>AGGREGATED CAUSAL GRAPH</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: surface.border }} />
              </div>

              {/* Graph container */}
              <div style={{
                position: 'relative',
                aspectRatio: '16 / 9',
                backgroundColor: surface.lowest,
                border: `1px solid ${surface.border}`,
                overflow: 'hidden',
              }}>
                {hasCausalData ? (
                  <>
                    {/* Intelligence Terminal SVG Causal Graph */}
                    <div style={{
                      position: 'relative',
                      width: '100%',
                      height: '400px',
                      background: `radial-gradient(#1A1A1A 1px, transparent 1px)`,
                      backgroundSize: '24px 24px',
                      backgroundColor: '#0A0A0A',
                    }}>
                      {/* Header labels */}
                      <div style={{ position: 'absolute', top: '12px', left: '16px', zIndex: 5 }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' as const, fontFamily: 'var(--font-label)' }}>NEXUS CAUSAL</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>{dashboard.topic}</div>
                      </div>
                      <div style={{ position: 'absolute', top: '12px', right: '16px', zIndex: 5, textAlign: 'right' }}>
                        <span style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-label)' }}>
                          {dashboard.aggregated_causal_graph.total_nodes} noeuds&nbsp;&nbsp;{dashboard.aggregated_causal_graph.total_edges} relations
                        </span>
                      </div>

                      {/* SVG Graph with radial layout */}
                      <svg width="100%" height="400" viewBox="0 0 800 400" style={{ display: 'block' }}>
                        <defs>
                          <marker id="tg-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                            <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.4)" />
                          </marker>
                        </defs>
                        {(() => {
                          // Compute radial positions for nodes
                          const nodes = causalNodes.slice(0, 16);
                          const rawEdges = dashboard.aggregated_causal_graph.edges;
                          const cx = 400, cy = 200;
                          const positions: Record<string, {x: number; y: number}> = {};

                          // BFS from first node to determine levels
                          const levels: Record<string, number> = {};
                          const queue = [nodes[0]?.id];
                          if (queue[0]) levels[queue[0]] = 0;
                          const adjacency: Record<string, string[]> = {};
                          rawEdges.forEach(e => {
                            const s = e.source || '', t = e.target || '';
                            if (!adjacency[s]) adjacency[s] = [];
                            if (!adjacency[t]) adjacency[t] = [];
                            adjacency[s].push(t);
                            adjacency[t].push(s);
                          });
                          while (queue.length > 0) {
                            const current = queue.shift()!;
                            for (const neighbor of (adjacency[current] || [])) {
                              if (levels[neighbor] === undefined) {
                                levels[neighbor] = (levels[current] || 0) + 1;
                                queue.push(neighbor);
                              }
                            }
                          }
                          // Assign positions - center node + radial rings
                          const levelGroups: Record<number, typeof nodes> = {};
                          nodes.forEach(n => {
                            const lvl = levels[n.id] ?? 99;
                            if (!levelGroups[lvl]) levelGroups[lvl] = [];
                            levelGroups[lvl].push(n);
                          });
                          Object.entries(levelGroups).forEach(([lvlStr, group]) => {
                            const lvl = parseInt(lvlStr);
                            if (lvl === 0) {
                              positions[group[0].id] = { x: cx, y: cy };
                            } else {
                              const radius = Math.min(lvl * 140, 340);
                              group.forEach((n, i) => {
                                const angle = (i / group.length) * 2 * Math.PI - Math.PI / 2;
                                positions[n.id] = {
                                  x: cx + radius * Math.cos(angle),
                                  y: cy + radius * Math.sin(angle),
                                };
                              });
                            }
                          });
                          // Fallback: any unpositioned nodes
                          nodes.forEach((n, i) => {
                            if (!positions[n.id]) {
                              const angle = (i / nodes.length) * 2 * Math.PI;
                              positions[n.id] = { x: cx + 200 * Math.cos(angle), y: cy + 150 * Math.sin(angle) };
                            }
                          });

                          const typeColor = (t: string) => t === 'event' ? '#DC2626' : t === 'entity' ? '#2563EB' : t === 'decision' ? '#F59E0B' : '#10B981';

                          return (
                            <>
                              {/* Edges with curves */}
                              {rawEdges.slice(0, 30).map((edge, idx) => {
                                const sp = positions[edge.source || ''];
                                const tp = positions[edge.target || ''];
                                if (!sp || !tp) return null;
                                const relType = edge.relation_type || edge.type || 'causes';
                                const color = relType === 'causes' ? '#DC2626' : relType === 'triggers' ? '#F59E0B' : relType === 'enables' ? '#10B981' : '#6B7280';
                                const dash = relType === 'triggers' ? '6,4' : relType === 'enables' ? '2,4' : 'none';
                                // Curved path
                                const mx = (sp.x + tp.x) / 2 + (sp.y - tp.y) * 0.15;
                                const my = (sp.y + tp.y) / 2 + (tp.x - sp.x) * 0.15;
                                return (
                                  <path key={`e${idx}`}
                                    d={`M ${sp.x} ${sp.y} Q ${mx} ${my} ${tp.x} ${tp.y}`}
                                    stroke={color} strokeWidth={1.5} fill="none" opacity={0.6}
                                    strokeDasharray={dash} markerEnd="url(#tg-arrow)"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleGraphEdgeSelect?.({
                                      id: edge.id || `e-${idx}`,
                                      causeLabel: edge.cause_text || nodeLabelsById[edge.source || ''] || '',
                                      effectLabel: edge.effect_text || nodeLabelsById[edge.target || ''] || '',
                                      relationType: relType,
                                      confidence: edge.confidence || 0.7,
                                      mentionCount: edge.mention_count || 1,
                                      sourceSyntheses: edge.source_syntheses || [],
                                    })}
                                  />
                                );
                              })}
                              {/* Nodes */}
                              {nodes.map((node, i) => {
                                const p = positions[node.id];
                                if (!p) return null;
                                const color = typeColor(node.node_type || 'event');
                                const mentionCount = node.mention_count || 1;
                                const connections = rawEdges.filter(e => (e.source === node.id || e.target === node.id)).length;
                                const size = 12 + Math.min(mentionCount * 2, 12) + Math.min(connections * 3, 9);
                                const iconDef = getNodeIcon(node.label, node.node_type || 'event');
                                return (
                                  <g key={node.id} style={{ cursor: 'pointer' }}
                                    onClick={() => {
                                      const connections = [
                                        ...causalEdges.filter(e => e.effect_text === node.label).map(e => ({ label: e.cause_text, direction: 'cause' as const, relationType: e.relation_type })),
                                        ...causalEdges.filter(e => e.cause_text === node.label).map(e => ({ label: e.effect_text, direction: 'effect' as const, relationType: e.relation_type })),
                                      ];
                                      handleGraphNodeSelect?.({ id: node.id, label: node.label, type: node.node_type || 'event', mentionCount: node.mention_count || 1, connections });
                                    }}>
                                    <rect x={p.x - size} y={p.y - size} width={size * 2} height={size * 2} fill={color} opacity={0.9} />
                                    <g transform={`translate(${p.x - size * 0.4}, ${p.y - size * 0.4})`}>
                                      <svg viewBox={iconDef.viewBox} width={size * 0.8} height={size * 0.8}>
                                        <path d={iconDef.path} fill="white" />
                                      </svg>
                                    </g>
                                    <text x={p.x} y={p.y + size + 12} fill="rgba(255,255,255,0.7)" fontSize={Math.max(8, Math.min(size * 0.5, 11))} fontWeight="600" textAnchor="middle" fontFamily="var(--font-label)">
                                      {condensLabel(node.label, 24)}
                                    </text>
                                  </g>
                                );
                              })}
                            </>
                          );
                        })()}
                      </svg>

                      {/* Legend */}
                      <div style={{ position: 'absolute', bottom: '12px', left: '16px', display: 'flex', gap: '16px', zIndex: 5 }}>
                        {[
                          { color: '#DC2626', label: `Evenement (${causalNodes.filter(n => n.node_type === 'event').length})` },
                          { color: '#2563EB', label: `Entite (${causalNodes.filter(n => n.node_type === 'entity').length})` },
                          { color: '#F59E0B', label: `Decision (${causalNodes.filter(n => n.node_type === 'decision').length})` },
                        ].map(item => (
                          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '8px', height: '8px', backgroundColor: item.color }} />
                            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-label)', letterSpacing: '0.05em' }}>{item.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Edge type legend */}
                      <div style={{ position: 'absolute', bottom: '12px', right: '16px', display: 'flex', gap: '16px', zIndex: 5 }}>
                        {[
                          { color: '#DC2626', dash: 'none', label: 'causes' },
                          { color: '#F59E0B', dash: '6,4', label: 'triggers' },
                          { color: '#10B981', dash: '2,4', label: 'enables' },
                        ].map(item => (
                          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="20" height="2"><line x1="0" y1="1" x2="20" y2="1" stroke={item.color} strokeWidth="1.5" strokeDasharray={item.dash} /></svg>
                            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-label)' }}>{item.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* LIVE indicator */}
                      <div style={{ position: 'absolute', bottom: '40px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 5 }}>
                        <span className="terminal-pulse" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
                        <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const }}>LIVE RECONSTRUCTION ACTIVE</span>
                      </div>

                      {/* Link to full Nexus page */}
                      {dashboard.syntheses?.[0]?.id && (
                        <Link
                          href={`/synthesis/${dashboard.syntheses[0].id}/nexus`}
                          style={{
                            position: 'absolute', top: '12px', right: '16px', marginTop: '20px',
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            backgroundColor: '#2563EB', color: '#FFFFFF', padding: '6px 12px',
                            fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em',
                            fontFamily: 'var(--font-label)', textDecoration: 'none', textTransform: 'uppercase' as const,
                            zIndex: 10,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_full</span>
                          OPEN FULL NEXUS
                        </Link>
                      )}
                    </div>

                    {/* Node/Edge detail overlay */}
                    {(selectedNode || selectedEdge) && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        backgroundColor: darkMode ? 'rgba(10,10,10,0.92)' : 'rgba(255,255,255,0.95)',
                        border: `1px solid ${surface.border}`,
                        padding: '16px',
                        maxWidth: '280px',
                        zIndex: 10,
                      }}>
                        <button
                          onClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
                          style={{
                            position: 'absolute', top: '8px', right: '8px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: surface.text50, fontSize: '16px', fontFamily: 'inherit',
                            padding: '4px',
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                        </button>

                        {selectedNode && (
                          <>
                            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', color: NODE_TYPE_COLORS[selectedNode.type] || surface.text50, textTransform: 'uppercase' as const, marginBottom: '4px' }}>
                              {selectedNode.type}
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: surface.text, fontFamily: 'var(--font-serif, Georgia, serif)', lineHeight: 1.3, marginBottom: '8px' }}>
                              {selectedNode.label}
                            </div>
                            <div style={{ fontSize: '11px', color: surface.text50, marginBottom: '8px' }}>
                              {selectedNode.mentionCount} mention{selectedNode.mentionCount > 1 ? 's' : ''} &middot; {selectedNode.causedBy.length + selectedNode.causes.length} connections
                            </div>
                            {selectedNode.causedBy.length > 0 && (
                              <div style={{ marginBottom: '6px' }}>
                                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: surface.red, marginBottom: '4px' }}>CAUSED BY</div>
                                {selectedNode.causedBy.slice(0, 3).map((c, i) => (
                                  <div key={i} style={{ fontSize: '12px', color: surface.text70, padding: '2px 0' }}>{c}</div>
                                ))}
                              </div>
                            )}
                            {selectedNode.causes.length > 0 && (
                              <div>
                                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: surface.emerald, marginBottom: '4px' }}>LEADS TO</div>
                                {selectedNode.causes.slice(0, 3).map((c, i) => (
                                  <div key={i} style={{ fontSize: '12px', color: surface.text70, padding: '2px 0' }}>{c}</div>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {selectedEdge && (
                          <>
                            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.15em', color: surface.text50, textTransform: 'uppercase' as const, marginBottom: '8px' }}>CAUSAL RELATION</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: surface.text, marginBottom: '4px' }}>{selectedEdge.causeLabel}</div>
                            <div style={{ fontSize: '10px', color: (() => {
                              if (selectedEdge.relationType === 'causes') return surface.red;
                              if (selectedEdge.relationType === 'triggers') return surface.amber;
                              if (selectedEdge.relationType === 'enables') return surface.emerald;
                              return surface.text50;
                            })(), fontWeight: 700, letterSpacing: '0.1em', margin: '4px 0' }}>
                              {selectedEdge.relationType === 'causes' ? 'CAUSES' :
                               selectedEdge.relationType === 'triggers' ? 'TRIGGERS' :
                               selectedEdge.relationType === 'enables' ? 'ENABLES' :
                               selectedEdge.relationType === 'prevents' ? 'PREVENTS' : 'RELATES TO'} &darr;
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: surface.text, marginBottom: '8px' }}>{selectedEdge.effectLabel}</div>
                            <div style={{ fontSize: '11px', color: surface.text50 }}>
                              Confidence: {Math.round(selectedEdge.confidence * 100)}% &middot; {selectedEdge.mentionCount} mention{selectedEdge.mentionCount > 1 ? 's' : ''}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '32px', color: surface.text10 }}>hub</span>
                    <span style={{ fontSize: '12px', color: surface.text30, letterSpacing: '0.1em' }}>No causal data available yet</span>
                  </div>
                )}

                {/* LIVE RECONSTRUCTION label */}
                {hasCausalData && (
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    zIndex: 5,
                  }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: surface.red,
                      animation: 'pulse 2s ease-in-out infinite',
                    }} />
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.15em',
                      color: surface.text30,
                      textTransform: 'uppercase' as const,
                      fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                    }}>LIVE RECONSTRUCTION ACTIVE</span>
                  </div>
                )}
              </div>

              {/* Node type legend below graph */}
              {hasCausalData && (
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                  {Object.entries(NODE_TYPE_COLORS).map(([type, color]) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, opacity: 0.7 }} />
                      <span style={{ fontSize: '10px', color: surface.text50, textTransform: 'capitalize' as const }}>{type}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ============================================================ */}
          {/* RIGHT COLUMN                                                  */}
          {/* ============================================================ */}
          <div>

            {/* ---- TALKSHOW player card ---- */}
            {dashboard.synthesis_count >= 2 && (
              <div style={{
                backgroundColor: surface.containerHigh,
                borderLeft: `4px solid ${surface.primary}`,
                padding: '20px',
                marginBottom: '32px',
              }}>
                <div style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  color: surface.primary,
                  textTransform: 'uppercase' as const,
                  marginBottom: '8px',
                  fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                }}>TALKSHOW</div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: surface.text,
                  marginBottom: '16px',
                  lineHeight: 1.3,
                  fontFamily: 'var(--font-serif, Georgia, serif)',
                }}>
                  {dashboard.topic} — Debate entre experts IA
                </div>

                {/* Play button + waveform row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                  <Link
                    href={`/topics/${encodeURIComponent(topicName)}/talkshow`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '40px',
                      height: '40px',
                      backgroundColor: surface.text,
                      color: surface.lowest,
                      textDecoration: 'none',
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>play_arrow</span>
                  </Link>

                  {/* SVG Waveform visualization */}
                  <div style={{ flex: 1 }}>
                    <svg width="100%" height="32" viewBox="0 0 200 32" preserveAspectRatio="none">
                      {Array.from({ length: 40 }).map((_, i) => {
                        const h = Math.random() * 24 + 4;
                        return (
                          <rect
                            key={i}
                            x={i * 5}
                            y={(32 - h) / 2}
                            width="3"
                            height={h}
                            fill={surface.primary}
                            opacity={0.4 + Math.random() * 0.4}
                          />
                        );
                      })}
                    </svg>
                  </div>
                </div>

                {/* Time markers */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: surface.text30,
                  fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                  letterSpacing: '0.05em',
                }}>
                  <span>0:00</span>
                  <span>~12:00</span>
                </div>

                {/* Link to talkshow */}
                <Link
                  href={`/topics/${encodeURIComponent(topicName)}/talkshow`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginTop: '12px',
                    fontSize: '11px',
                    color: surface.primary,
                    textDecoration: 'none',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                  }}
                >
                  Open full talkshow
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                </Link>
              </div>
            )}

            {/* ---- TIMELINE ---- */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase' as const,
                  color: surface.primary,
                  fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                  whiteSpace: 'nowrap',
                }}>TIMELINE</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: surface.border }} />
              </div>

              <div style={{ position: 'relative', paddingLeft: '24px' }}>
                {/* Vertical line */}
                <div style={{
                  position: 'absolute',
                  left: '7px',
                  top: '0',
                  bottom: '0',
                  width: '1px',
                  backgroundColor: surface.text10,
                }} />

                {dashboard.syntheses.slice(0, 8).map((synthesis, idx) => {
                  const isFirst = idx === 0;
                  const opacity = Math.max(0.4, 1 - idx * 0.1);
                  const dotColor = isFirst ? surface.primary : surface.text30;
                  const sentimentColor = synthesis.sentiment === 'positive' ? surface.emerald
                    : synthesis.sentiment === 'negative' ? surface.red : surface.amber;

                  return (
                    <Link
                      key={synthesis.id}
                      href={`/synthesis/${synthesis.id}`}
                      style={{
                        display: 'block',
                        position: 'relative',
                        paddingBottom: '24px',
                        textDecoration: 'none',
                        opacity,
                      }}
                    >
                      {/* Dot */}
                      <div style={{
                        position: 'absolute',
                        left: '-24px',
                        top: '2px',
                        width: '14px',
                        height: '14px',
                        backgroundColor: dotColor,
                        border: isFirst ? `2px solid ${surface.primary}` : 'none',
                      }} />

                      {/* Timestamp */}
                      <div style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        color: isFirst ? surface.primary : surface.text30,
                        marginBottom: '4px',
                        fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                        textTransform: 'uppercase' as const,
                      }}>
                        {formatDate(synthesis.date)}
                      </div>

                      {/* Title */}
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: surface.text,
                        lineHeight: 1.3,
                        marginBottom: '6px',
                        fontFamily: 'var(--font-sans, system-ui)',
                      }}>
                        {synthesis.title.length > 80 ? synthesis.title.slice(0, 80) + '...' : synthesis.title}
                      </div>

                      {/* Category pills */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          backgroundColor: surface.container,
                          fontSize: '9px',
                          fontWeight: 600,
                          letterSpacing: '0.1em',
                          color: categoryColor(synthesis.category),
                          textTransform: 'uppercase' as const,
                          fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                        }}>
                          {synthesis.category}
                        </span>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          backgroundColor: surface.container,
                          fontSize: '9px',
                          fontWeight: 600,
                          color: sentimentColor,
                          textTransform: 'uppercase' as const,
                          fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                        }}>
                          {synthesis.sentiment}
                        </span>
                      </div>
                    </Link>
                  );
                })}

                {dashboard.syntheses.length > 8 && (
                  <div style={{
                    paddingLeft: '0',
                    fontSize: '11px',
                    color: surface.text30,
                    fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                    letterSpacing: '0.05em',
                  }}>
                    + {dashboard.syntheses.length - 8} more syntheses
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* ================================================================ */}
        {/* RELATED DOSSIERS (full width, below main grid)                   */}
        {/* ================================================================ */}
        {relatedTopicCards.length > 1 && (
          <section style={{ marginTop: '56px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase' as const,
                color: surface.primary,
                fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                whiteSpace: 'nowrap',
              }}>RELATED DOSSIERS</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: surface.border }} />
            </div>

            <div
              ref={relatedScrollRef}
              style={{
                display: 'flex',
                gap: '16px',
                overflowX: 'auto',
                paddingBottom: '8px',
                scrollbarWidth: 'thin',
              }}
            >
              {relatedTopicCards.map((card, idx) => {
                const catCol = categoryColor(card.category);
                return (
                  <Link
                    key={idx}
                    href={`/synthesis/${card.id}`}
                    style={{
                      display: 'block',
                      minWidth: '280px',
                      maxWidth: '320px',
                      backgroundColor: surface.container,
                      borderTop: `3px solid ${catCol}`,
                      padding: '20px',
                      textDecoration: 'none',
                      flexShrink: 0,
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget.querySelector('[data-topic-title]') as HTMLElement | null)?.style.setProperty('color', catCol);
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget.querySelector('[data-topic-title]') as HTMLElement | null)?.style.setProperty('color', surface.text);
                    }}
                  >
                    {/* Category label */}
                    <div style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.15em',
                      color: catCol,
                      textTransform: 'uppercase' as const,
                      marginBottom: '10px',
                      fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                    }}>
                      {card.category}
                    </div>

                    {/* Title */}
                    <div
                      data-topic-title=""
                      style={{
                        fontSize: '18px',
                        fontFamily: 'var(--font-serif, Georgia, serif)',
                        fontStyle: 'italic',
                        color: surface.text,
                        lineHeight: 1.3,
                        marginBottom: '16px',
                        transition: 'color 0.15s',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {card.title}
                    </div>

                    {/* Bottom: entity count + arrow */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{
                        fontSize: '10px',
                        color: surface.text30,
                        letterSpacing: '0.05em',
                        fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
                      }}>
                        {card.entityCount} entit{card.entityCount > 1 ? 'ies' : 'y'}
                      </span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px', color: surface.text30 }}>arrow_forward</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Back link */}
        <div style={{ marginTop: '56px', paddingTop: '24px', borderTop: `1px solid ${surface.border}` }}>
          <Link href="/" style={{
            color: surface.text50,
            textDecoration: 'none',
            fontSize: '12px',
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            letterSpacing: '0.05em',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_back</span>
            Back to home
          </Link>
        </div>
      </div>

      {/* ================================================================== */}
      {/* BOTTOM TICKER (desktop only)                                       */}
      {/* ================================================================== */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '32px',
        backgroundColor: surface.base,
        borderTop: `1px solid ${surface.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: '24px',
        zIndex: 100,
        fontSize: '10px',
        fontFamily: 'var(--font-label, var(--font-sans, system-ui))',
        color: surface.text30,
        letterSpacing: '0.1em',
      }}>
        {/* LIVE dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: surface.red, animation: 'pulse 2s ease-in-out infinite' }} />
          <span style={{ fontWeight: 700, textTransform: 'uppercase' as const }}>LIVE</span>
        </div>
        <span>{dashboard.synthesis_count} syntheses</span>
        <span>{dashboard.key_entities.length} entities tracked</span>
        <span>{dashboard.aggregated_causal_graph.total_nodes} causal nodes</span>
        <span>{dashboard.aggregated_causal_graph.total_edges} relations</span>
        <span style={{ marginLeft: 'auto' }}>{dossierId}</span>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 900px) {
          /* Stack columns on mobile */
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
