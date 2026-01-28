'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { EntityFrequencyChart, SentimentChart } from '@/app/components/charts';
import { GeoMentionMap } from '@/app/components/maps';

interface SynthesisSummary {
  id: string;
  title: string;
  date: string;
  category: string;
  summary: string;
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
  nodes: any[];
  edges: any[];
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

const NARRATIVE_ARC_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  emerging: { label: 'Émergent', color: '#10B981', icon: '🌱' },
  developing: { label: 'En développement', color: '#3B82F6', icon: '📈' },
  peak: { label: 'Point culminant', color: '#EF4444', icon: '🔥' },
  declining: { label: 'En déclin', color: '#F59E0B', icon: '📉' },
  resolved: { label: 'Résolu', color: '#6B7280', icon: '✓' }
};

export default function TopicDashboardPage() {
  const params = useParams();
  const topicName = decodeURIComponent(params.name as string);

  const [dashboard, setDashboard] = useState<TopicDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_URL}/api/trending/topics/${encodeURIComponent(topicName)}/dashboard`
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Topic non trouvé ou pas assez de synthèses (minimum 3 requis)');
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
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Topic non disponible</h1>
          <p style={{ color: '#6B7280', marginBottom: '24px' }}>{error}</p>
          <Link href="/" style={styles.backLink}>
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  const arcConfig = NARRATIVE_ARC_CONFIG[dashboard.narrative_arc] || NARRATIVE_ARC_CONFIG.developing;

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <Link href="/" style={styles.backLink}>
          ← Retour
        </Link>
      </header>

      {/* Hero Section */}
      <div style={styles.hero}>
        <div style={styles.badges}>
          <span style={{
            ...styles.badge,
            backgroundColor: arcConfig.color + '20',
            color: arcConfig.color
          }}>
            {arcConfig.icon} {arcConfig.label}
          </span>
          {dashboard.is_active && (
            <span style={{ ...styles.badge, backgroundColor: '#FEE2E2', color: '#DC2626' }}>
              🔴 Actif
            </span>
          )}
          <span style={{ ...styles.badge, backgroundColor: '#F3F4F6', color: '#374151' }}>
            {dashboard.synthesis_count} synthèses
          </span>
        </div>

        <h1 style={styles.title}>{dashboard.topic}</h1>

        <p style={styles.subtitle}>
          Thème récurrent couvrant {dashboard.synthesis_count} synthèses avec{' '}
          {dashboard.aggregated_causal_graph.total_nodes} nœuds causaux et{' '}
          {dashboard.key_entities.length} entités clés.
        </p>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Key Entities */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Entités Clés</h2>
          <div style={styles.entityGrid}>
            {dashboard.key_entities.slice(0, 12).map((entity, index) => (
              <div key={index} style={styles.entityCard}>
                <span style={styles.entityName}>{entity.name}</span>
                <span style={styles.entityCount}>{entity.count}x</span>
                <span style={styles.entityType}>{entity.type}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Charts Row */}
        <div style={styles.chartsRow}>
          {/* Sentiment Evolution */}
          {dashboard.sentiment_evolution.length > 0 && (
            <div style={styles.chartCard}>
              <SentimentChart
                synthesisId=""
                data={dashboard.sentiment_evolution}
                title="Évolution du Sentiment"
              />
            </div>
          )}

          {/* Entity Frequency */}
          <div style={styles.chartCard}>
            <EntityFrequencyChart
              synthesisId=""
              entities={dashboard.key_entities.map(e => ({
                name: e.name,
                count: e.count,
                type: e.type
              }))}
              title="Fréquence des Entités"
            />
          </div>
        </div>

        {/* Geographic Focus */}
        {dashboard.geo_focus.length > 0 && (
          <section style={styles.section}>
            <GeoMentionMap
              synthesisId=""
              mentions={dashboard.geo_focus.map(g => ({
                country: g.country,
                country_code: '',  // Will be resolved by component
                count: g.count
              }))}
              title="Focus Géographique"
              height={350}
            />
          </section>
        )}

        {/* Predictions */}
        {dashboard.predictions_summary.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Prédictions Agrégées</h2>
            <div style={styles.predictionsGrid}>
              {dashboard.predictions_summary.slice(0, 6).map((pred, index) => (
                <div key={index} style={styles.predictionCard}>
                  <div style={styles.predictionHeader}>
                    <span style={{
                      ...styles.predictionType,
                      backgroundColor: getPredictionColor(pred.type) + '20',
                      color: getPredictionColor(pred.type)
                    }}>
                      {pred.type}
                    </span>
                    <span style={styles.predictionProb}>
                      {Math.round(pred.probability * 100)}%
                    </span>
                  </div>
                  <p style={styles.predictionText}>{pred.prediction}</p>
                  <span style={styles.predictionSource}>
                    Source: {pred.synthesis_date}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Syntheses List */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Synthèses Liées</h2>
          <div style={styles.synthesesList}>
            {dashboard.syntheses.map((synthesis) => (
              <Link
                key={synthesis.id}
                href={`/synthesis/${synthesis.id}`}
                style={styles.synthesisCard}
              >
                <div style={styles.synthesisHeader}>
                  <span style={styles.synthesisCategory}>{synthesis.category}</span>
                  <span style={styles.synthesisDate}>{synthesis.date}</span>
                </div>
                <h3 style={styles.synthesisTitle}>{synthesis.title}</h3>
                <p style={styles.synthesisSummary}>{synthesis.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function getPredictionColor(type: string): string {
  const colors: Record<string, string> = {
    economic: '#10B981',
    political: '#3B82F6',
    social: '#8B5CF6',
    geopolitical: '#F59E0B',
    tech: '#06B6D4',
    general: '#6B7280'
  };
  return colors[type] || colors.general;
}

// Dark Mode Theme
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0A0A0A',
    color: '#FFFFFF'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '16px',
    color: '#9CA3AF'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #374151',
    borderTopColor: '#6366F1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    textAlign: 'center',
    padding: '24px',
    color: '#FFFFFF'
  },
  header: {
    padding: '16px 24px',
    borderBottom: '1px solid #374151',
    backgroundColor: '#111827'
  },
  backLink: {
    color: '#6366F1',
    textDecoration: 'none',
    fontSize: '14px'
  },
  hero: {
    padding: '48px 24px',
    maxWidth: '1200px',
    margin: '0 auto',
    textAlign: 'center'
  },
  badges: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap'
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 500
  },
  title: {
    fontSize: '36px',
    fontWeight: 700,
    fontFamily: 'Georgia, serif',
    margin: '0 0 16px 0',
    color: '#FFFFFF'
  },
  subtitle: {
    fontSize: '16px',
    color: '#9CA3AF',
    maxWidth: '600px',
    margin: '0 auto'
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px 48px'
  },
  section: {
    marginTop: '48px'
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: 600,
    fontFamily: 'Georgia, serif',
    marginBottom: '24px',
    color: '#FFFFFF'
  },
  entityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px'
  },
  entityCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: '#111827',
    borderRadius: '8px',
    border: '1px solid #374151'
  },
  entityName: {
    flex: 1,
    fontWeight: 500,
    fontSize: '14px',
    color: '#FFFFFF'
  },
  entityCount: {
    fontSize: '12px',
    color: '#9CA3AF',
    backgroundColor: '#1F2937',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  entityType: {
    fontSize: '10px',
    color: '#9CA3AF',
    textTransform: 'uppercase'
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
    marginTop: '48px'
  },
  chartCard: {
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  predictionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '16px'
  },
  predictionCard: {
    padding: '16px',
    backgroundColor: '#111827',
    borderRadius: '8px',
    border: '1px solid #374151'
  },
  predictionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  predictionType: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'capitalize'
  },
  predictionProb: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#FFFFFF'
  },
  predictionText: {
    fontSize: '14px',
    color: '#E5E7EB',
    margin: '0 0 8px 0',
    lineHeight: 1.5
  },
  predictionSource: {
    fontSize: '11px',
    color: '#6B7280'
  },
  synthesesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  synthesisCard: {
    display: 'block',
    padding: '20px',
    backgroundColor: '#111827',
    border: '1px solid #374151',
    borderRadius: '8px',
    textDecoration: 'none',
    transition: 'all 0.2s ease'
  },
  synthesisHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  synthesisCategory: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#EF4444',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  synthesisDate: {
    fontSize: '12px',
    color: '#6B7280'
  },
  synthesisTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#FFFFFF',
    margin: '0 0 8px 0',
    fontFamily: 'Georgia, serif'
  },
  synthesisSummary: {
    fontSize: '14px',
    color: '#9CA3AF',
    margin: 0,
    lineHeight: 1.5
  }
};
