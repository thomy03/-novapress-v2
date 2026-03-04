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

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'Positif',
  negative: 'Negatif',
  neutral: 'Neutre',
  mixed: 'Mixte',
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

function formatYear(dateStr: string) {
  try {
    return new Date(dateStr).getFullYear().toString();
  } catch {
    return '';
  }
}

export default function TopicTimeline({ syntheses }: TopicTimelineProps) {
  const [showAll, setShowAll] = useState(false);

  // Sort chronologically (newest first for timeline)
  const sorted = [...syntheses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const MAX_VISIBLE = 10;
  const visible = showAll ? sorted : sorted.slice(0, MAX_VISIBLE);
  const hasMore = sorted.length > MAX_VISIBLE;

  return (
    <div style={{ padding: '8px 0' }}>
      {visible.map((s, idx) => {
        const color = SENTIMENT_COLORS[s.sentiment] || SENTIMENT_COLORS.neutral;
        const sentimentLabel = SENTIMENT_LABELS[s.sentiment] || s.sentiment;

        return (
          <div key={s.id} style={{
            display: 'flex',
            gap: '0',
            position: 'relative',
          }}>
            {/* Left: Date column */}
            <div style={{
              width: '80px',
              flexShrink: 0,
              textAlign: 'right',
              paddingRight: '16px',
              paddingTop: '16px',
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#000',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}>
                {formatDate(s.date)}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#9CA3AF',
              }}>
                {formatYear(s.date)}
              </div>
            </div>

            {/* Center: Vertical line + dot */}
            <div style={{
              width: '24px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}>
              {/* Vertical line */}
              {idx < visible.length - 1 && (
                <div style={{
                  position: 'absolute',
                  top: '24px',
                  bottom: '-1px',
                  width: '2px',
                  backgroundColor: '#E5E5E5',
                }} />
              )}
              {/* Dot */}
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: color,
                border: '3px solid #FFFFFF',
                boxShadow: `0 0 0 2px ${color}40`,
                marginTop: '18px',
                zIndex: 1,
                flexShrink: 0,
              }} />
            </div>

            {/* Right: Card */}
            <div style={{
              flex: 1,
              minWidth: 0,
              padding: '12px 0 24px 12px',
            }}>
              <Link
                href={`/synthesis/${s.id}`}
                style={{
                  display: 'block',
                  padding: '16px',
                  border: '1px solid #E5E5E5',
                  backgroundColor: '#FFFFFF',
                  textDecoration: 'none',
                  color: '#000',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#000';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E5E5';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Badge row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#DC2626',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {s.category}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: '16px',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  color: '#000',
                  margin: '0 0 8px 0',
                }}>
                  {s.title}
                </h3>

                {/* Summary (2 lines) */}
                <p style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  lineHeight: 1.5,
                  margin: '0 0 10px 0',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical' as const,
                }}>
                  {s.summary}
                </p>

                {/* Meta row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontSize: '11px',
                  color: '#9CA3AF',
                }}>
                  <span>{s.num_sources} sources</span>
                  <span style={{ color }}>
                    {sentimentLabel}
                  </span>
                </div>
              </Link>
            </div>
          </div>
        );
      })}

      {/* Show more button */}
      {hasMore && !showAll && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            onClick={() => setShowAll(true)}
            style={{
              padding: '10px 24px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#000',
              backgroundColor: 'transparent',
              border: '1px solid #000',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Voir les {sorted.length - MAX_VISIBLE} syntheses restantes
          </button>
        </div>
      )}
    </div>
  );
}
