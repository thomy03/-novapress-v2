'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface SynthesisTimelineItem {
  id: string;
  title: string;
  date: string;
  sentiment: string;
  num_sources: number;
  summary: string;
  category: string;
}

interface TopicTimelineProps {
  syntheses: SynthesisTimelineItem[];
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#10B981',
  negative: '#DC2626',
  neutral: '#6B7280',
  mixed: '#F59E0B',
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

export default function TopicTimeline({ syntheses }: TopicTimelineProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Sort chronologically (oldest first for timeline)
  const sorted = [...syntheses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div style={styles.container}>
      <div style={styles.track}>
        {sorted.map((s, idx) => {
          const color = SENTIMENT_COLORS[s.sentiment] || SENTIMENT_COLORS.neutral;
          const size = Math.min(16, 8 + s.num_sources * 2);
          const isHovered = hoveredId === s.id;

          return (
            <div key={s.id} style={styles.pointWrapper}>
              {/* Connecting line */}
              {idx < sorted.length - 1 && <div style={styles.connector} />}

              {/* Timeline point */}
              <Link
                href={`/synthesis/${s.id}`}
                style={{
                  ...styles.point,
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: color,
                  boxShadow: isHovered ? `0 0 0 4px ${color}30` : 'none',
                }}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <span style={styles.srOnly}>{s.title}</span>
              </Link>

              {/* Date label */}
              <span style={styles.dateLabel}>{formatDate(s.date)}</span>

              {/* Tooltip on hover */}
              {isHovered && (
                <div style={styles.tooltip}>
                  <span style={styles.tooltipCategory}>{s.category}</span>
                  <p style={styles.tooltipTitle}>{s.title}</p>
                  <p style={styles.tooltipSummary}>
                    {s.summary.length > 120 ? s.summary.substring(0, 120) + '...' : s.summary}
                  </p>
                  <div style={styles.tooltipMeta}>
                    <span style={{ color }}>{s.sentiment}</span>
                    <span>{s.num_sources} sources</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    overflowX: 'auto',
    padding: '16px 0 32px',
  },
  track: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0',
    minWidth: 'max-content',
    padding: '0 24px',
  },
  pointWrapper: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '80px',
  },
  connector: {
    position: 'absolute',
    top: '8px',
    left: '50%',
    width: '80px',
    height: '2px',
    backgroundColor: '#E5E5E5',
    zIndex: 0,
  },
  point: {
    display: 'block',
    borderRadius: '50%',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    zIndex: 1,
    textDecoration: 'none',
    border: '2px solid #FFFFFF',
    flexShrink: 0,
  },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
  },
  dateLabel: {
    marginTop: '8px',
    fontSize: '11px',
    color: '#9CA3AF',
    whiteSpace: 'nowrap',
  },
  tooltip: {
    position: 'absolute',
    top: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '260px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    padding: '12px 16px',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  tooltipCategory: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#DC2626',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  tooltipTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#000000',
    fontFamily: 'Georgia, serif',
    margin: '4px 0 6px',
    lineHeight: 1.3,
  },
  tooltipSummary: {
    fontSize: '12px',
    color: '#6B7280',
    margin: '0 0 8px',
    lineHeight: 1.4,
  },
  tooltipMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#9CA3AF',
  },
};
