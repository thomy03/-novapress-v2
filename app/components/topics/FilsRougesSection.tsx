'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '@/app/contexts/ThemeContext';
import { intelligenceService } from '@/app/lib/api/services/intelligence';
import { TopicResponse } from '@/app/types/intelligence';
import { NarrativeArcIndicator, NarrativeArcProgress, NARRATIVE_ARC_CONFIG, NarrativeArc } from './NarrativeArcIndicator';

/**
 * UI-005c: FilsRougesSection Enhanced
 * Version améliorée avec NarrativeArcIndicator et hover expand
 */
export default function FilsRougesSection() {
  const { theme, darkMode } = useTheme();
  const [hotTopics, setHotTopics] = useState<TopicResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  useEffect(() => {
    const fetchHotTopics = async () => {
      try {
        setLoading(true);
        const topics = await intelligenceService.getHotTopics(8);
        setHotTopics(topics);
      } catch (err) {
        console.error('Error fetching hot topics:', err);
        setError('Unable to load trending topics');
      } finally {
        setLoading(false);
      }
    };

    fetchHotTopics();
  }, []);

  // Loading skeleton
  if (loading) {
    return (
      <section style={{
        marginBottom: '32px',
        padding: '20px 0',
        borderBottom: `1px solid ${theme.border}`
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <SectionLabel theme={theme} />
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: '100px',
                  height: '32px',
                  backgroundColor: theme.border,
                  borderRadius: '16px',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Error or empty state
  if (error || hotTopics.length === 0) {
    return (
      <section
        style={{
          marginBottom: '32px',
          padding: '20px 0',
          borderBottom: `1px solid ${theme.border}`
        }}
        aria-label="Thèmes récurrents"
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <SectionLabel theme={theme} />
          <span style={{
            fontSize: '13px',
            color: theme.textSecondary,
            fontStyle: 'italic'
          }}>
            {error ? 'Connexion API en cours...' : 'Aucun thème récurrent détecté'}
          </span>
          <Link
            href="/intelligence"
            style={{
              marginLeft: 'auto',
              fontSize: '12px',
              color: theme.brand.accent,
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            Intelligence Hub →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        marginBottom: '32px',
        padding: '20px 0',
        borderBottom: `1px solid ${theme.border}`
      }}
      aria-label="Thèmes récurrents"
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        {/* Section Label */}
        <SectionLabel theme={theme} />

        {/* Topic Chips */}
        <div style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          flex: 1
        }}>
          {hotTopics.map((topic) => (
            <TopicChip
              key={topic.id}
              topic={topic}
              isExpanded={expandedTopic === topic.id}
              onHover={(id) => setExpandedTopic(id)}
              darkMode={darkMode}
              theme={theme}
            />
          ))}
        </div>

        {/* View All Link */}
        <Link
          href="/intelligence"
          style={{
            fontSize: '12px',
            color: '#2563EB',
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            padding: '8px 0'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none';
          }}
        >
          Voir tous →
        </Link>
      </div>
    </section>
  );
}

// Section label component
function SectionLabel({ theme }: { theme: any }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 0'
    }}>
      <span style={{ fontSize: '18px' }}>🔗</span>
      <span style={{
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: theme.textSecondary
      }}>
        Fils Rouges
      </span>
    </div>
  );
}

// Enhanced Topic Chip with hover expand
interface TopicChipProps {
  topic: TopicResponse;
  isExpanded: boolean;
  onHover: (id: string | null) => void;
  darkMode: boolean;
  theme: any;
}

function TopicChip({ topic, isExpanded, onHover, darkMode, theme }: TopicChipProps) {
  const arc = (topic.narrative_arc || 'emerging') as NarrativeArc;
  const config = NARRATIVE_ARC_CONFIG[arc] || NARRATIVE_ARC_CONFIG.emerging;
  const count = topic.synthesis_count || 1;

  // Style variations based on popularity
  const isOutline = count <= 2;
  const isProminent = count >= 5;

  const bgColor = darkMode ? config.bgDark : config.bgLight;
  const borderColor = config.color;

  return (
    <div
      style={{
        position: 'relative',
      }}
      onMouseEnter={() => onHover(topic.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Main chip */}
      <Link
        href={`/topics/${encodeURIComponent(topic.name)}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: isProminent ? '10px 16px' : '8px 14px',
          backgroundColor: isOutline ? 'transparent' : bgColor,
          color: config.color,
          border: `1.5px solid ${borderColor}`,
          borderRadius: '20px',
          fontSize: isProminent ? '14px' : '13px',
          fontWeight: isProminent ? 600 : 500,
          textDecoration: 'none',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isExpanded ? 'translateY(-2px)' : 'translateY(0)',
          boxShadow: isExpanded
            ? `0 4px 12px ${darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)'}`
            : 'none',
        }}
      >
        {/* Topic name */}
        <span>{topic.name}</span>

        {/* Count badge */}
        {count > 1 && (
          <span style={{
            backgroundColor: config.color,
            color: '#fff',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600,
            minWidth: '20px',
            textAlign: 'center',
          }}>
            {count}
          </span>
        )}

        {/* Arc indicator (icon only on hover) */}
        {isExpanded && (
          <span style={{
            marginLeft: '2px',
            animation: 'fadeIn 0.2s ease',
          }}>
            {config.icon}
          </span>
        )}
      </Link>

      {/* Expanded panel with arc progress */}
      {isExpanded && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '8px',
            backgroundColor: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            padding: '12px 16px',
            minWidth: '180px',
            boxShadow: `0 8px 24px ${darkMode ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)'}`,
            zIndex: 100,
            animation: 'slideDown 0.2s ease',
          }}
        >
          {/* Arc phase */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}>
            <span style={{
              fontSize: '11px',
              color: theme.textSecondary,
              fontWeight: 500,
            }}>
              Phase narrative
            </span>
            <NarrativeArcIndicator arc={arc} size="small" showIcon={true} />
          </div>

          {/* Progress bar */}
          <NarrativeArcProgress arc={arc} width={150} />

          {/* Stats row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: `1px solid ${theme.border}`,
            fontSize: '11px',
            color: theme.textSecondary,
          }}>
            <span>📰 {count} synthèse{count > 1 ? 's' : ''}</span>
            <span style={{ color: config.color, fontWeight: 600 }}>
              {config.labelFr}
            </span>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export { FilsRougesSection };
