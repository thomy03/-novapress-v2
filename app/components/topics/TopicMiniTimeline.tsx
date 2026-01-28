'use client';

import React from 'react';
import { useTheme } from '@/app/contexts/ThemeContext';

/**
 * UI-005b: TopicMiniTimeline Component
 * Timeline horizontale compacte (3 points max) pour un topic
 */

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  type?: 'start' | 'update' | 'peak' | 'end';
}

interface TopicMiniTimelineProps {
  /** Événements à afficher (max 3) */
  events: TimelineEvent[];
  /** Largeur maximale */
  maxWidth?: number;
}

const EVENT_COLORS: Record<string, string> = {
  start: '#2563EB',
  update: '#10B981',
  peak: '#F59E0B',
  end: '#6B7280',
};

export function TopicMiniTimeline({
  events,
  maxWidth = 240,
}: TopicMiniTimelineProps) {
  const { theme, darkMode } = useTheme();

  // Limiter à 3 événements
  const displayEvents = events.slice(0, 3);

  if (displayEvents.length === 0) {
    return null;
  }

  // Formater la date
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth,
        width: '100%',
      }}
    >
      {/* Timeline line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          height: '20px',
        }}
      >
        {/* Background line */}
        <div
          style={{
            position: 'absolute',
            left: '10px',
            right: '10px',
            top: '50%',
            height: '2px',
            backgroundColor: darkMode ? '#374151' : '#E5E7EB',
            transform: 'translateY(-50%)',
          }}
        />

        {/* Event dots */}
        {displayEvents.map((event, index) => {
          const color = EVENT_COLORS[event.type || 'update'];
          const leftPercent = displayEvents.length === 1
            ? 50
            : (index / (displayEvents.length - 1)) * 100;

          return (
            <div
              key={event.id}
              style={{
                position: 'absolute',
                left: `calc(${leftPercent}% - 6px)`,
                top: '50%',
                transform: 'translateY(-50%)',
                width: '12px',
                height: '12px',
                backgroundColor: color,
                borderRadius: '50%',
                border: `2px solid ${theme.card}`,
                cursor: 'pointer',
                transition: 'transform 0.2s ease',
                zIndex: 1,
              }}
              title={`${formatDate(event.date)}: ${event.title}`}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
              }}
            />
          );
        })}
      </div>

      {/* Event labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '9px',
          color: theme.textSecondary,
        }}
      >
        {displayEvents.map((event, index) => (
          <span
            key={event.id}
            style={{
              textAlign: index === 0 ? 'left' : index === displayEvents.length - 1 ? 'right' : 'center',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={event.title}
          >
            {formatDate(event.date)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Version inline plus compacte pour les badges
 */
interface TopicMiniTimelineInlineProps {
  /** Nombre de jours depuis le début */
  daysSinceStart: number;
  /** Nombre total d'événements */
  eventCount: number;
}

export function TopicMiniTimelineInline({
  daysSinceStart,
  eventCount,
}: TopicMiniTimelineInlineProps) {
  const { theme, darkMode } = useTheme();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '10px',
        color: theme.textSecondary,
        padding: '2px 8px',
        backgroundColor: darkMode ? '#1F2937' : '#F3F4F6',
        borderRadius: '10px',
      }}
    >
      <span>📅 {daysSinceStart}j</span>
      <span style={{ opacity: 0.5 }}>•</span>
      <span>📊 {eventCount} évén.</span>
    </span>
  );
}

export default TopicMiniTimeline;
