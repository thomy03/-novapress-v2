'use client';

import React from 'react';
import Link from 'next/link';
import {
  TimelineEvent,
  NarrativePhase,
  PHASE_CONFIG
} from '@/app/types/timeline';

interface TimelineViewProps {
  events: TimelineEvent[];
  narrativeArc: NarrativePhase;
  daysTracked: number;
  compact?: boolean;
  showFactDensity?: boolean;
}

export default function TimelineView({
  events,
  narrativeArc,
  daysTracked,
  compact = false,
  showFactDensity = true,
}: TimelineViewProps) {
  const phaseConfig = PHASE_CONFIG[narrativeArc];

  if (events.length === 0) {
    return (
      <div style={styles.emptyState}>
        <span style={styles.emptyIcon}>🕰️</span>
        <p style={styles.emptyText}>Aucun historique disponible</p>
        <p style={styles.emptySubtext}>Cette synthèse est la première sur ce sujet</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header avec statut narratif */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>🕰️</span>
          <h3 style={styles.headerTitle}>Historique de l'affaire</h3>
        </div>
        <div style={{
          ...styles.phaseBadge,
          backgroundColor: phaseConfig.bgColor,
          color: phaseConfig.color,
        }}>
          {phaseConfig.icon} {phaseConfig.labelFr}
        </div>
      </div>

      {/* Statistiques */}
      <div style={styles.stats}>
        <span style={styles.statItem}>
          <strong>{daysTracked}</strong> jour{daysTracked > 1 ? 's' : ''} de suivi
        </span>
        <span style={styles.statDivider}>•</span>
        <span style={styles.statItem}>
          <strong>{events.length}</strong> mise{events.length > 1 ? 's' : ''} à jour
        </span>
      </div>

      {/* Timeline */}
      <div style={styles.timeline}>
        {events.map((event, index) => {
          const eventPhaseConfig = PHASE_CONFIG[event.narrative_phase];
          const isLast = index === events.length - 1;

          return (
            <div
              key={event.synthesis_id || index}
              style={styles.timelineItem}
            >
              {/* Ligne verticale */}
              {!isLast && <div style={styles.timelineLine} />}

              {/* Point */}
              <div style={{
                ...styles.timelineDot,
                backgroundColor: eventPhaseConfig.color,
                boxShadow: `0 0 0 4px ${eventPhaseConfig.bgColor}`,
              }} />

              {/* Contenu */}
              <div style={styles.timelineContent}>
                {/* Date et phase */}
                <div style={styles.timelineMeta}>
                  <span style={styles.timelineDate}>
                    {formatDate(event.date)}
                  </span>
                  {!compact && (
                    <span style={{
                      ...styles.phaseTag,
                      backgroundColor: eventPhaseConfig.bgColor,
                      color: eventPhaseConfig.color,
                    }}>
                      {eventPhaseConfig.labelFr}
                    </span>
                  )}
                </div>

                {/* Titre */}
                {event.synthesis_id ? (
                  <Link
                    href={`/synthesis/${event.synthesis_id}`}
                    style={styles.timelineTitle}
                  >
                    {event.title}
                  </Link>
                ) : (
                  <h4 style={styles.timelineTitleStatic}>{event.title}</h4>
                )}

                {/* Résumé */}
                {!compact && event.summary && (
                  <p style={styles.timelineSummary}>
                    {event.summary}
                  </p>
                )}

                {/* Score de fiabilité */}
                {showFactDensity && event.fact_density > 0 && !compact && (
                  <div style={styles.factDensity}>
                    <span style={styles.factLabel}>Fiabilité factuelle:</span>
                    <div style={styles.factBar}>
                      <div style={{
                        ...styles.factBarFill,
                        width: `${event.fact_density * 100}%`,
                        backgroundColor: getFactDensityColor(event.fact_density),
                      }} />
                    </div>
                    <span style={styles.factValue}>
                      {Math.round(event.fact_density * 100)}%
                    </span>
                  </div>
                )}

                {/* Similarité */}
                {!compact && event.similarity > 0 && (
                  <span style={styles.similarity}>
                    Pertinence: {Math.round(event.similarity * 100)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper functions
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function getFactDensityColor(density: number): string {
  if (density >= 0.8) return '#10B981'; // Vert
  if (density >= 0.6) return '#F59E0B'; // Orange
  return '#EF4444'; // Rouge
}

// Styles (newspaper style, no gradients)
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '2px solid #000000',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerIcon: {
    fontSize: '20px',
  },
  headerTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: '18px',
    fontWeight: 700,
    color: '#000000',
    margin: 0,
  },
  phaseBadge: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#6B7280',
  },
  statItem: {},
  statDivider: {
    color: '#D1D5DB',
  },
  timeline: {
    position: 'relative' as const,
  },
  timelineItem: {
    position: 'relative' as const,
    paddingLeft: '32px',
    paddingBottom: '24px',
  },
  timelineLine: {
    position: 'absolute' as const,
    left: '7px',
    top: '20px',
    bottom: '0',
    width: '2px',
    backgroundColor: '#E5E5E5',
  },
  timelineDot: {
    position: 'absolute' as const,
    left: '0',
    top: '4px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
  },
  timelineContent: {
    paddingTop: '0',
  },
  timelineMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  timelineDate: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  phaseTag: {
    padding: '2px 8px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  timelineTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    fontWeight: 600,
    color: '#000000',
    textDecoration: 'none',
    display: 'block',
    marginBottom: '8px',
    lineHeight: 1.4,
  },
  timelineTitleStatic: {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    fontWeight: 600,
    color: '#000000',
    margin: '0 0 8px 0',
    lineHeight: 1.4,
  },
  timelineSummary: {
    fontSize: '14px',
    color: '#4B5563',
    lineHeight: 1.6,
    margin: '0 0 12px 0',
  },
  factDensity: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  factLabel: {
    fontSize: '12px',
    color: '#6B7280',
  },
  factBar: {
    flex: 1,
    height: '4px',
    backgroundColor: '#E5E5E5',
    maxWidth: '100px',
  },
  factBarFill: {
    height: '100%',
  },
  factValue: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#4B5563',
  },
  similarity: {
    fontSize: '11px',
    color: '#9CA3AF',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '48px 24px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px',
  },
  emptyText: {
    fontFamily: 'Georgia, serif',
    fontSize: '18px',
    fontWeight: 600,
    color: '#000000',
    margin: '0 0 8px 0',
  },
  emptySubtext: {
    fontSize: '14px',
    color: '#6B7280',
    margin: 0,
  },
};
