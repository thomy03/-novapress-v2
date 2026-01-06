'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { TimelineView, EntityEvolution, ContradictionsList } from '@/app/components/timeline';
import { timelineService } from '@/app/lib/api/services';
import { TimelineResponse } from '@/app/types/timeline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function TimelinePage() {
  const params = useParams();
  const synthesisId = params?.id as string;

  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [synthesisTitle, setSynthesisTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!synthesisId) return;

      try {
        setLoading(true);

        // Fetch timeline data
        const timelineData = await timelineService.getTimeline(synthesisId);
        setTimeline(timelineData);
        setSynthesisTitle(timelineData.current_title);

      } catch (err) {
        console.error('Failed to fetch timeline:', err);
        setError(err instanceof Error ? err.message : 'Erreur de chargement');

        // Try to at least get the synthesis title
        try {
          const response = await fetch(`${API_URL}/api/syntheses/by-id/${synthesisId}`);
          if (response.ok) {
            const synthesis = await response.json();
            setSynthesisTitle(synthesis.title);
          }
        } catch {
          // Ignore
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [synthesisId]);

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingContent}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Chargement de l'historique...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link href={`/synthesis/${synthesisId}`} style={styles.backLink}>
            <span style={styles.backArrow}>&larr;</span>
            <span>Retour à la synthèse</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Page Title */}
        <div style={styles.pageHeader}>
          <span style={styles.badge}>TIME-TRAVELER</span>
          <h1 style={styles.pageTitle}>
            Historique de l'affaire
          </h1>
          {synthesisTitle && (
            <p style={styles.synthesisTitle}>
              {synthesisTitle}
            </p>
          )}
        </div>

        {error ? (
          <div style={styles.errorContainer}>
            <div style={styles.errorIcon}>🕰️</div>
            <h2 style={styles.errorTitle}>Aucun historique disponible</h2>
            <p style={styles.errorText}>
              Cette synthèse est la première sur ce sujet.
              L'historique sera disponible lorsque de nouvelles synthèses
              seront générées sur le même thème.
            </p>
            <Link href={`/synthesis/${synthesisId}`} style={styles.errorLink}>
              ← Retour à la synthèse
            </Link>
          </div>
        ) : timeline ? (
          <div style={styles.content}>
            {/* Main Timeline */}
            <TimelineView
              events={timeline.timeline}
              narrativeArc={timeline.narrative_arc}
              daysTracked={timeline.days_tracked}
              showFactDensity={true}
            />

            {/* Two-column layout for entities and contradictions */}
            <div style={styles.columnsContainer}>
              {/* Entity Evolution */}
              {timeline.entity_evolution.length > 0 && (
                <div style={styles.column}>
                  <EntityEvolution entities={timeline.entity_evolution} />
                </div>
              )}

              {/* Contradictions */}
              {timeline.contradictions.length > 0 && (
                <div style={styles.column}>
                  <ContradictionsList contradictions={timeline.contradictions} />
                </div>
              )}
            </div>

            {/* Previous Key Points */}
            {timeline.previous_key_points.length > 0 && (
              <div style={styles.keyPointsSection}>
                <h3 style={styles.sectionTitle}>
                  <span style={styles.sectionIcon}>📌</span>
                  Points clés établis précédemment
                </h3>
                <ul style={styles.keyPointsList}>
                  {timeline.previous_key_points.map((point, index) => (
                    <li key={index} style={styles.keyPoint}>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <div style={styles.footer}>
          <Link href={`/synthesis/${synthesisId}`} style={styles.footerLink}>
            <span>&larr;</span>
            <span>Retour à la synthèse</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    textAlign: 'center',
    color: '#6B7280',
  },
  spinner: {
    display: 'inline-block',
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5E5',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    fontSize: '14px',
  },
  header: {
    borderBottom: '1px solid #E5E5E5',
    padding: '16px 0',
  },
  headerContent: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '0 24px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6B7280',
    textDecoration: 'none',
    fontSize: '14px',
  },
  backArrow: {
    fontSize: '18px',
  },
  main: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '40px 24px 80px',
  },
  pageHeader: {
    marginBottom: '40px',
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    marginBottom: '16px',
  },
  pageTitle: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '32px',
    fontWeight: 700,
    lineHeight: 1.2,
    color: '#000000',
    margin: '0 0 12px 0',
  },
  synthesisTitle: {
    fontSize: '18px',
    color: '#6B7280',
    margin: 0,
    lineHeight: 1.5,
  },
  errorContainer: {
    textAlign: 'center' as const,
    padding: '80px 24px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
  },
  errorIcon: {
    fontSize: '64px',
    marginBottom: '24px',
  },
  errorTitle: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '24px',
    fontWeight: 700,
    color: '#000000',
    margin: '0 0 16px 0',
  },
  errorText: {
    fontSize: '16px',
    color: '#6B7280',
    maxWidth: '500px',
    margin: '0 auto 24px',
    lineHeight: 1.6,
  },
  errorLink: {
    color: '#2563EB',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 600,
  },
  content: {},
  columnsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    marginTop: '24px',
  },
  column: {},
  keyPointsSection: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    padding: '24px',
    marginTop: '24px',
  },
  sectionTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    fontWeight: 700,
    color: '#000000',
    margin: '0 0 16px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingBottom: '12px',
    borderBottom: '1px solid #E5E5E5',
  },
  sectionIcon: {
    fontSize: '18px',
  },
  keyPointsList: {
    margin: 0,
    paddingLeft: '24px',
  },
  keyPoint: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.6,
    marginBottom: '8px',
  },
  footer: {
    marginTop: '60px',
    paddingTop: '24px',
    borderTop: '1px solid #E5E5E5',
  },
  footerLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#2563EB',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
  },
};
