'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TimelinePreviewResponse,
  NarrativePhase,
  PHASE_CONFIG
} from '@/app/types/timeline';
import { timelineService } from '@/app/lib/api/services';

interface TimelinePreviewProps {
  synthesisId: string;
  onError?: (error: Error) => void;
}

export default function TimelinePreview({
  synthesisId,
  onError,
}: TimelinePreviewProps) {
  const [data, setData] = useState<TimelinePreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPreview() {
      try {
        setLoading(true);
        const response = await timelineService.getTimelinePreview(synthesisId);
        setData(response);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur de chargement';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    }

    fetchPreview();
  }, [synthesisId, onError]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.skeleton}>
          <div style={styles.skeletonHeader} />
          <div style={styles.skeletonLine} />
          <div style={styles.skeletonLine} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null; // Silently hide if no timeline data
  }

  if (data.recent_events.length === 0) {
    return null; // No history to show
  }

  const phaseConfig = PHASE_CONFIG[data.narrative_arc];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.icon}>🕰️</span>
          <span style={styles.title}>Historique</span>
        </div>
        <div style={{
          ...styles.phaseBadge,
          backgroundColor: phaseConfig.bgColor,
          color: phaseConfig.color,
        }}>
          {phaseConfig.icon} {phaseConfig.labelFr}
        </div>
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <strong>{data.days_tracked}</strong> jour{data.days_tracked > 1 ? 's' : ''} de suivi
        {data.has_contradictions && (
          <span style={styles.contradictionWarning}>
            • ⚠️ Contradictions détectées
          </span>
        )}
      </div>

      {/* Compact timeline */}
      <div style={styles.timeline}>
        {data.recent_events.slice(0, 3).map((event, index) => (
          <div key={event.synthesis_id || index} style={styles.timelineItem}>
            <div style={{
              ...styles.dot,
              backgroundColor: PHASE_CONFIG[event.narrative_phase].color,
            }} />
            <div style={styles.eventContent}>
              <span style={styles.eventDate}>{formatDateShort(event.date)}</span>
              <span style={styles.eventTitle}>{truncate(event.title, 50)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Link to full timeline */}
      <Link
        href={`/synthesis/${synthesisId}/timeline`}
        style={styles.viewAllLink}
      >
        Voir l'historique complet →
      </Link>
    </div>
  );
}

// Helper functions
function formatDateShort(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateString;
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
    padding: '16px',
    marginTop: '24px',
  },
  skeleton: {
    opacity: 0.5,
  },
  skeletonHeader: {
    height: '20px',
    width: '60%',
    backgroundColor: '#E5E5E5',
    marginBottom: '12px',
  },
  skeletonLine: {
    height: '14px',
    width: '100%',
    backgroundColor: '#E5E5E5',
    marginBottom: '8px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  icon: {
    fontSize: '16px',
  },
  title: {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    fontWeight: 700,
    color: '#000000',
  },
  phaseBadge: {
    padding: '4px 8px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  stats: {
    fontSize: '12px',
    color: '#6B7280',
    marginBottom: '12px',
  },
  contradictionWarning: {
    color: '#F59E0B',
    marginLeft: '4px',
  },
  timeline: {
    marginBottom: '12px',
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '8px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginTop: '4px',
    flexShrink: 0,
  },
  eventContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
  },
  eventDate: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#9CA3AF',
    textTransform: 'uppercase' as const,
  },
  eventTitle: {
    fontSize: '13px',
    color: '#374151',
    lineHeight: 1.3,
  },
  viewAllLink: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: '#2563EB',
    textDecoration: 'none',
    paddingTop: '8px',
    borderTop: '1px solid #E5E5E5',
  },
};
