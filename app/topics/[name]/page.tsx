'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { EntityFrequencyChart, SentimentChart } from '@/app/components/charts';
import { NarrativeArcIndicator } from '@/app/components/topics';

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
  nodes: { id: string; label: string; type: string }[];
  edges: { source: string; target: string; type: string }[];
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

const NARRATIVE_ARC_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  emerging: { label: 'Emergent', color: '#2563EB', description: 'Sujet recent, peu de couverture' },
  developing: { label: 'En developpement', color: '#10B981', description: 'Attention mediatique croissante' },
  peak: { label: 'Point culminant', color: '#DC2626', description: 'Maximum de couverture mediatique' },
  declining: { label: 'En declin', color: '#F59E0B', description: 'Interet mediatique en baisse' },
  resolved: { label: 'Resolu', color: '#6B7280', description: 'Sujet clos ou resolu' }
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
            &larr; Retour a l'accueil
          </Link>
        </div>
      </div>
    );
  }

  const arcConfig = NARRATIVE_ARC_CONFIG[dashboard.narrative_arc] || NARRATIVE_ARC_CONFIG.developing;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

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
        {/* Badges Row */}
        <div style={styles.badgeRow}>
          <span style={styles.dossieBadge}>DOSSIER</span>
          <NarrativeArcIndicator arc={dashboard.narrative_arc as 'emerging' | 'developing' | 'peak' | 'declining' | 'resolved'} size="medium" />
          {dashboard.is_active && (
            <span style={styles.activeBadge}>EN COURS</span>
          )}
        </div>

        {/* Topic Title */}
        <h1 style={styles.title}>{dashboard.topic}</h1>

        {/* Stats Line */}
        <div style={styles.statsLine}>
          <span>{dashboard.synthesis_count} syntheses</span>
          <span style={styles.separator}>|</span>
          <span>{dashboard.key_entities.length} entites cles</span>
          <span style={styles.separator}>|</span>
          <span>{dashboard.aggregated_causal_graph.total_nodes} noeuds causaux</span>
          {dashboard.geo_focus.length > 0 && (
            <>
              <span style={styles.separator}>|</span>
              <span>{dashboard.geo_focus.length} pays</span>
            </>
          )}
        </div>

        {/* Arc Description */}
        <p style={styles.arcDescription}>
          <span style={{ color: arcConfig.color, fontWeight: 600 }}>{arcConfig.label}</span>
          {' — '}{arcConfig.description}
        </p>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {/* Key Entities Section */}
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

        {/* Predictions */}
        {dashboard.predictions_summary.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Predictions</h2>
            <div style={styles.predictionsGrid}>
              {dashboard.predictions_summary.slice(0, 6).map((pred, index) => (
                <div key={index} style={styles.predictionCard}>
                  <div style={styles.predictionHeader}>
                    <span style={styles.predictionType}>{pred.type}</span>
                    <span style={{
                      ...styles.predictionProb,
                      color: pred.probability >= 0.7 ? '#10B981' : pred.probability >= 0.4 ? '#F59E0B' : '#6B7280'
                    }}>
                      {Math.round(pred.probability * 100)}%
                    </span>
                  </div>
                  <p style={styles.predictionText}>{pred.prediction}</p>
                  <span style={styles.predictionMeta}>
                    {pred.timeframe} — {formatDate(pred.synthesis_date)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Syntheses List */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>
            Toutes les Syntheses ({dashboard.synthesis_count})
          </h2>
          <div style={styles.synthesesList}>
            {dashboard.syntheses.map((synthesis) => (
              <Link
                key={synthesis.id}
                href={`/synthesis/${synthesis.id}`}
                style={styles.synthesisCard}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#000000';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E5E5';
                }}
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

        {/* Back Link */}
        <div style={styles.backSection}>
          <Link href="/" style={{ color: '#000', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
            &larr; Retour a la page d'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

// Newspaper Style — Light Mode
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
    padding: '40px 24px 32px',
    borderBottom: '2px solid #000000',
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
    margin: '0 0 16px 0',
  },
  statsLine: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    color: '#6B7280',
    marginBottom: '12px',
  },
  separator: {
    color: '#E5E5E5',
  },
  arcDescription: {
    fontSize: '15px',
    color: '#6B7280',
    fontStyle: 'italic',
    margin: 0,
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px 80px',
  },
  section: {
    marginTop: '48px',
  },
  sectionTitle: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '20px',
    fontWeight: 700,
    color: '#000000',
    margin: '0 0 24px 0',
    paddingBottom: '8px',
    borderBottom: '1px solid #E5E5E5',
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
    textTransform: 'uppercase',
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
    marginTop: '48px',
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
  predictionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '16px',
  },
  predictionCard: {
    padding: '16px 20px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
  },
  predictionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  predictionType: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  predictionProb: {
    fontSize: '16px',
    fontWeight: 700,
    fontFamily: 'Georgia, serif',
  },
  predictionText: {
    fontSize: '14px',
    color: '#000000',
    margin: '0 0 8px 0',
    lineHeight: 1.6,
    fontFamily: 'Georgia, serif',
  },
  predictionMeta: {
    fontSize: '12px',
    color: '#9CA3AF',
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
    transition: 'border-color 0.2s ease',
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
    textTransform: 'uppercase',
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
  backSection: {
    marginTop: '60px',
    paddingTop: '24px',
    borderTop: '1px solid #E5E5E5',
  },
};
