'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import EnrichmentBadge from '@/app/components/ui/EnrichmentBadge';
import { RecurringTopicBadge } from '@/app/components/topics';
import { EnrichmentData } from '@/app/types/api';
import { AIBadge, Badge } from '../ui/Badge';

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
}

interface SynthesisCardProps {
  synthesis: Synthesis;
}

export default function SynthesisCard({ synthesis }: SynthesisCardProps) {
  const { theme } = useTheme();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get preview content (first 2 paragraphs)
  const fullContent = synthesis.body || synthesis.summary || '';
  const paragraphs = fullContent.split('\n\n').filter(p => p.trim());
  const previewParagraphs = paragraphs.slice(0, 2);

  return (
    <article
      className="card-interactive"
      style={{
        backgroundColor: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: '12px',
        padding: '28px',
        marginBottom: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent line on hover */}
      <div
        className="accent-line-reveal"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: theme.brand.secondary,
        }}
      />

      {/* AI Badge + Enrichment Badge */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        {/* Enrichment Badge (compact) */}
        {synthesis.enrichment && (
          <EnrichmentBadge enrichment={synthesis.enrichment} compact />
        )}
        {/* AI Badge */}
        <AIBadge size="md" />
      </div>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <Link
          href={`/synthesis/${synthesis.id}`}
          style={{ textDecoration: 'none' }}
        >
          <h3
            className="opacity-hover"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '24px',
              fontWeight: 700,
              lineHeight: 1.3,
              color: theme.text,
              marginBottom: '10px',
              paddingRight: '120px',
              cursor: 'pointer',
              transition: 'color 200ms ease',
            }}
          >
            {synthesis.title}
          </h3>
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '12px',
            color: theme.textSecondary,
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
            {synthesis.numSources} sources
          </span>
          <span style={{ color: theme.border }}>|</span>
          <span>{synthesis.readingTime} min read</span>
          <span style={{ color: theme.border }}>|</span>
          <span>{formatDate(synthesis.createdAt)}</span>
        </div>

        {/* Phase 10: Topic Tags / Fils Rouges - styled by popularity */}
        {synthesis.topics && synthesis.topics.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '14px',
            flexWrap: 'wrap'
          }}>
            {synthesis.topics.map((topic) => {
              const arcColors: Record<string, { bg: string; text: string; border: string }> = {
                emerging: { bg: theme.infoBg, text: theme.info, border: `${theme.info}40` },
                developing: { bg: theme.successBg, text: theme.success, border: `${theme.success}40` },
                peak: { bg: theme.warningBg, text: theme.warning, border: `${theme.warning}40` },
                declining: { bg: theme.errorBg, text: theme.error, border: `${theme.error}40` },
                resolved: { bg: theme.bgTertiary, text: theme.textSecondary, border: theme.border }
              };
              const colors = arcColors[topic.narrative_arc || 'emerging'];
              const count = topic.synthesis_count || 1;
              const isProminent = count >= 4;

              return (
                <Link
                  key={topic.id}
                  href={`/topics/${encodeURIComponent(topic.name)}`}
                  className="card-lift"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: isProminent ? '6px 12px' : '5px 10px',
                    fontSize: isProminent ? '12px' : '11px',
                    fontWeight: isProminent ? 600 : 500,
                    backgroundColor: colors.bg,
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    textDecoration: 'none',
                    transition: 'all 200ms ease',
                  }}
                  title={`${count} synthèse${count > 1 ? 's' : ''} sur ce sujet`}
                >
                  <span>#{topic.name}</span>
                  {isProminent && (
                    <span style={{
                      backgroundColor: colors.text,
                      color: '#fff',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      fontSize: '9px',
                      fontWeight: 700,
                      marginLeft: '2px'
                    }}>
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Fallback: RecurringTopicBadge if no topics in response */}
        {(!synthesis.topics || synthesis.topics.length === 0) && (
          <div style={{ marginTop: '10px' }}>
            <RecurringTopicBadge synthesisId={synthesis.id} />
          </div>
        )}
      </div>

      {/* Introduction (chapo) - always visible */}
      {synthesis.introduction && (
        <p
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '17px',
            fontWeight: 500,
            lineHeight: 1.65,
            color: theme.text,
            marginBottom: '20px',
            borderLeft: `3px solid ${theme.brand.secondary}`,
            paddingLeft: '18px',
          }}
        >
          {synthesis.introduction}
        </p>
      )}

      {/* Body preview (first 2 paragraphs) */}
      <div
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '15px',
          lineHeight: 1.8,
          color: theme.textSecondary,
          marginBottom: '20px',
        }}
      >
        {previewParagraphs.map((paragraph, idx) => (
          <p key={idx} style={{ marginBottom: '14px' }}>
            {paragraph}
          </p>
        ))}
      </div>

      {/* Read More Link */}
      <Link
        href={`/synthesis/${synthesis.id}`}
        className="btn-hover-primary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          color: theme.brand.secondary,
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
          marginBottom: '20px',
          padding: '8px 0',
          transition: 'gap 200ms ease',
        }}
      >
        <span>Lire l'article complet</span>
        <span style={{ fontSize: '14px' }}>&rarr;</span>
      </Link>

      {/* Key Points Preview */}
      {synthesis.keyPoints && synthesis.keyPoints.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '12px',
            }}
          >
            Points Clés
          </h4>
          <ul
            style={{
              margin: 0,
              paddingLeft: '20px',
            }}
          >
            {synthesis.keyPoints.slice(0, 3).map((point, index) => (
              <li
                key={index}
                style={{
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: theme.text,
                  marginBottom: '8px',
                }}
              >
                {point}
              </li>
            ))}
            {synthesis.keyPoints.length > 3 && (
              <li
                style={{
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: theme.textSecondary,
                  fontStyle: 'italic',
                }}
              >
                + {synthesis.keyPoints.length - 3} autres points...
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Sources */}
      {synthesis.sources && synthesis.sources.length > 0 && (
        <div
          style={{
            borderTop: `1px solid ${theme.border}`,
            paddingTop: '14px',
            marginTop: '20px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: theme.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            Sources:{' '}
          </span>
          <span
            style={{
              fontSize: '12px',
              color: theme.textSecondary,
            }}
          >
            {synthesis.sources.join(', ')}
          </span>
        </div>
      )}

      {/* Compliance Score */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: synthesis.complianceScore >= 90 ? theme.success : theme.warning,
          }}
        />
        <span
          style={{
            fontSize: '11px',
            color: theme.textSecondary,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {synthesis.complianceScore}% accuracy
        </span>
      </div>
    </article>
  );
}
