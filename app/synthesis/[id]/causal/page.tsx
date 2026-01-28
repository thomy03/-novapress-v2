'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { causalService } from '@/app/lib/api/services/causal';
import HistoricalCausalGraph from '@/app/components/causal/HistoricalCausalGraph';
import {
  CausalGraphResponse,
  CausalStatsResponse,
  NARRATIVE_FLOW_CONFIG
} from '@/app/types/causal';

export default function CausalPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusNodeId = searchParams.get('focus');

  const [data, setData] = useState<CausalGraphResponse | null>(null);
  const [stats, setStats] = useState<CausalStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!params?.id) return;

      try {
        setLoading(true);

        // Fetch causal graph and stats in parallel
        const [graphData, statsData] = await Promise.all([
          causalService.getCausalGraph(params.id as string),
          causalService.getCausalStats().catch(() => null) // Stats are optional
        ]);

        setData(graphData);
        setStats(statsData);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch causal data:', err);
        setError('Unable to load causal graph');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params?.id]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingContent}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Chargement du graphe causal...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={styles.errorContainer}>
        <h1 style={styles.errorTitle}>Graphe causal non disponible</h1>
        <p style={styles.errorText}>{error || 'Donnees non trouvees'}</p>
        <Link href={`/synthesis/${params?.id}`} style={styles.backLink}>
          ← Retour a la synthese
        </Link>
      </div>
    );
  }

  const flowConfig = NARRATIVE_FLOW_CONFIG[data.narrative_flow] || NARRATIVE_FLOW_CONFIG.linear;

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <Link href={`/synthesis/${params?.id}`} style={styles.backButton}>
            <span style={styles.backArrow}>←</span>
            <span>Retour a la synthese</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Page Title */}
        <div style={styles.titleSection}>
          <div style={styles.titleBadge}>
            NEXUS CAUSAL
          </div>
          <h1 style={styles.pageTitle}>{data.title}</h1>

          {/* Meta info */}
          <div style={styles.metaRow}>
            <span style={styles.metaItem}>
              {data.total_relations} relations causales
            </span>
            <span style={styles.metaDivider}>|</span>
            <span style={styles.metaItem}>
              {data.nodes.length} evenements
            </span>
            <span style={styles.metaDivider}>|</span>
            <span
              style={{
                ...styles.flowIndicator,
                color: flowConfig.color
              }}
            >
              {flowConfig.icon} Flux {flowConfig.labelFr.toLowerCase()}
            </span>
          </div>
        </div>

        {/* Explanation Box */}
        <div style={styles.explanationBox}>
          <h3 style={styles.explanationTitle}>Comment lire ce graphe</h3>
          <p style={styles.explanationText}>
            Ce graphe montre les relations de cause a effet extraites automatiquement
            de la synthese. Chaque carte represente une relation causale detectee dans
            les sources. Le score de confiance indique la fiabilite de la relation
            basee sur le nombre de sources et la densite factuelle.
          </p>
        </div>

        {/* Full-Screen Historical Causal Graph */}
        <div style={styles.graphWrapper}>
          <HistoricalCausalGraph
            synthesisId={params?.id as string}
            focusNodeId={focusNodeId}
          />
        </div>

        {/* Global Stats (if available) */}
        {stats && (
          <div style={styles.globalStats}>
            <h3 style={styles.statsTitle}>Statistiques globales</h3>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <span style={styles.statValue}>{stats.total_syntheses}</span>
                <span style={styles.statLabel}>Syntheses totales</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statValue}>{stats.syntheses_with_causal_data}</span>
                <span style={styles.statLabel}>Avec donnees causales</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statValue}>{stats.total_causal_relations}</span>
                <span style={styles.statLabel}>Relations detectees</span>
              </div>
              <div style={styles.statCard}>
                <span style={styles.statValue}>{stats.avg_relations_per_synthesis}</span>
                <span style={styles.statLabel}>Moy. par synthese</span>
              </div>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div style={styles.bottomNav}>
          <Link href={`/synthesis/${params?.id}`} style={styles.bottomBackLink}>
            <span>←</span>
            <span>Retour a la synthese</span>
          </Link>
          <Link href="/" style={styles.homeLink}>
            Accueil
          </Link>
        </div>
      </main>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF'
  },
  loadingContainer: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingContent: {
    textAlign: 'center' as const
  },
  spinner: {
    display: 'inline-block',
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5E5',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '14px',
    color: '#6B7280'
  },
  errorContainer: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px'
  },
  errorTitle: {
    fontSize: '24px',
    color: '#DC2626',
    marginBottom: '16px'
  },
  errorText: {
    fontSize: '14px',
    color: '#6B7280',
    marginBottom: '24px'
  },
  backLink: {
    color: '#2563EB',
    textDecoration: 'none',
    fontSize: '14px'
  },
  header: {
    borderBottom: '1px solid #E5E5E5',
    padding: '16px 0'
  },
  headerInner: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '0 24px'
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6B7280',
    textDecoration: 'none',
    fontSize: '14px'
  },
  backArrow: {
    fontSize: '18px'
  },
  main: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '40px 24px 80px'
  },
  titleSection: {
    marginBottom: '32px'
  },
  titleBadge: {
    display: 'inline-block',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    marginBottom: '16px'
  },
  pageTitle: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '32px',
    fontWeight: 700,
    lineHeight: 1.2,
    color: '#000000',
    marginBottom: '16px'
  },
  metaRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    color: '#6B7280'
  },
  metaItem: {},
  metaDivider: {
    color: '#E5E5E5'
  },
  flowIndicator: {
    fontWeight: 500
  },
  explanationBox: {
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
    padding: '20px',
    marginBottom: '24px'
  },
  explanationTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#000000',
    margin: '0 0 8px 0'
  },
  explanationText: {
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#6B7280',
    margin: 0
  },
  globalStats: {
    marginTop: '40px',
    padding: '24px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5'
  },
  statsTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#000000',
    margin: '0 0 16px 0',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px'
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    padding: '16px',
    textAlign: 'center' as const
  },
  statValue: {
    display: 'block',
    fontSize: '24px',
    fontWeight: 700,
    color: '#2563EB',
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '12px',
    color: '#6B7280'
  },
  bottomNav: {
    marginTop: '60px',
    paddingTop: '24px',
    borderTop: '1px solid #E5E5E5',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  bottomBackLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#2563EB',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500
  },
  homeLink: {
    color: '#6B7280',
    textDecoration: 'none',
    fontSize: '14px'
  },
  graphWrapper: {
    height: '70vh',
    minHeight: '600px',
    border: '1px solid #E5E5E5',
    borderRadius: '4px',
    overflow: 'hidden'
  }
};
