'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import { RecurringTopicBadge } from '@/app/components/topics';
import { EnrichmentData } from '@/app/types/api';

interface SynthesisTopic {
  id: string;
  name: string;
  narrative_arc?: 'emerging' | 'developing' | 'peak' | 'declining' | 'resolved';
  synthesis_count?: number;
}

interface Synthesis {
  id: string;
  title: string;
  summary: string;
  introduction?: string;
  body?: string;
  analysis?: string;
  keyPoints: string[];
  sources: string[];
  numSources: number;
  complianceScore: number;
  readingTime: number;
  createdAt: string;
  enrichment?: EnrichmentData;
  topics?: SynthesisTopic[];
  category?: string;
  imageUrl?: string;
}

interface SynthesisCardProps {
  synthesis: Synthesis;
  index?: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  MONDE: '#DC2626',
  TECH: '#2563EB',
  ECONOMIE: '#F59E0B',
  POLITIQUE: '#DC2626',
  CULTURE: '#8B5CF6',
  SPORT: '#10B981',
  SCIENCES: '#06B6D4',
};

export default function SynthesisCard({ synthesis, index }: SynthesisCardProps) {
  const { theme } = useTheme();

  const formatTimeAgo = (dateString: string) => {
    const d = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const category = synthesis.category || 'MONDE';
  const catColor = CATEGORY_COLORS[category] || '#DC2626';
  const scoreColor = synthesis.complianceScore >= 85 ? '#10B981'
    : synthesis.complianceScore >= 60 ? '#F59E0B' : '#DC2626';

  const preview = synthesis.introduction
    || synthesis.summary
    || (synthesis.body ? synthesis.body.substring(0, 200) : '');

  return (
    <Link href={`/synthesis/${synthesis.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article
        style={{
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          paddingBottom: '16px',
          borderBottom: `1px solid ${theme.border}`,
          marginBottom: '16px',
          transition: 'all 200ms ease',
        }}
      >
        {/* Background image reveal on hover — CSS handles this */}
        {synthesis.imageUrl && (
          <div
            className="card-bg-reveal"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              opacity: 0,
              transition: 'opacity 300ms ease',
              pointerEvents: 'none',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={synthesis.imageUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'grayscale(100%)',
                opacity: 0.15,
              }}
              loading="lazy"
            />
          </div>
        )}

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Top row: index + category + meta */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '10px',
          }}>
            {index !== undefined && (
              <span style={{
                fontFamily: 'var(--font-label, var(--font-mono))',
                fontSize: '9px',
                letterSpacing: '0.2em',
                color: theme.textSecondary,
                textTransform: 'uppercase',
              }}>
                {String(index + 1).padStart(2, '0')}
              </span>
            )}
            <span style={{
              backgroundColor: catColor,
              color: '#FFFFFF',
              padding: '2px 8px',
              fontSize: '9px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontFamily: 'var(--font-label, var(--font-mono))',
            }}>
              {category}
            </span>
            <span style={{
              fontFamily: 'var(--font-label, var(--font-mono))',
              fontSize: '9px',
              letterSpacing: '0.1em',
              color: theme.textSecondary,
              textTransform: 'uppercase',
            }}>
              {synthesis.numSources} SOURCES
            </span>
          </div>

          {/* Title */}
          <h3 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '20px',
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
            color: theme.text,
            margin: '0 0 8px 0',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            transition: 'color 200ms ease',
          }}>
            {synthesis.title}
          </h3>

          {/* Preview text */}
          <p style={{
            fontSize: '14px',
            lineHeight: 1.6,
            color: theme.textSecondary,
            margin: '0 0 12px 0',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {preview}
          </p>

          {/* Topic tags */}
          {synthesis.topics && synthesis.topics.length > 0 ? (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {synthesis.topics.slice(0, 3).map((topic) => (
                <span
                  key={topic.id}
                  style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-label, var(--font-mono))',
                    color: theme.textSecondary,
                    border: `1px solid ${theme.border}`,
                    padding: '2px 8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  #{topic.name}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ marginBottom: '8px' }}>
              <RecurringTopicBadge synthesisId={synthesis.id} />
            </div>
          )}

          {/* Bottom metrics row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            {/* Transparency score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${scoreColor}`,
                color: scoreColor,
                fontFamily: 'var(--font-label, var(--font-mono))',
                fontSize: '10px',
                fontWeight: 700,
              }}>
                {synthesis.complianceScore}
              </span>
            </div>

            <span style={{
              fontFamily: 'var(--font-label, var(--font-mono))',
              fontSize: '10px',
              color: theme.textSecondary,
              textTransform: 'uppercase',
            }}>
              {synthesis.readingTime} MIN READ
            </span>

            <span style={{
              fontFamily: 'var(--font-label, var(--font-mono))',
              fontSize: '10px',
              color: theme.textSecondary,
              textTransform: 'uppercase',
              marginLeft: 'auto',
            }}>
              {formatTimeAgo(synthesis.createdAt)} AGO
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
