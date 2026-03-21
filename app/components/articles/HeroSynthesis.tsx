'use client';

/**
 * HeroSynthesis - "Intelligence Terminal" premium hero card
 * Two-column layout: 60% content + 40% image, sharp editorial style
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/app/contexts/ThemeContext';

// Category colors (editorial palette)
const CATEGORY_COLORS: Record<string, string> = {
  MONDE: '#2563EB',
  POLITIQUE: '#DC2626',
  ECONOMIE: '#059669',
  TECH: '#7C3AED',
  CULTURE: '#D97706',
  SPORT: '#0891B2',
  SCIENCES: '#4F46E5',
};

function getTransparencyColor(score: number): string {
  if (score >= 70) return '#059669';
  if (score >= 40) return '#D97706';
  return '#DC2626';
}

function formatTimeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return "A L'INSTANT";
  if (minutes < 60) return `${minutes}m AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h AGO`;
  const days = Math.floor(hours / 24);
  return `${days}d AGO`;
}

export interface SynthesisBrief {
  id: string;
  title: string;
  summary: string;
  category?: string;
  numSources: number;
  readingTime: number;
  createdAt: string;
  complianceScore?: number;
  transparencyScore?: number;
  transparencyLabel?: string;
  imageUrl?: string;
}

interface HeroSynthesisProps {
  synthesis: SynthesisBrief;
}

const LABEL_FONT =
  "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export function HeroSynthesis({ synthesis }: HeroSynthesisProps) {
  const { theme, darkMode } = useTheme();
  const [hovered, setHovered] = useState(false);

  const categoryColor = CATEGORY_COLORS[synthesis.category || ''] || '#6B7280';
  const transparencyScore = synthesis.transparencyScore ?? synthesis.complianceScore ?? 0;
  const transparencyColor = getTransparencyColor(transparencyScore);

  return (
    <Link
      href={`/synthesis/${synthesis.id}`}
      style={{ display: 'block', textDecoration: 'none', marginBottom: '48px' }}
    >
      <article
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          minHeight: '420px',
          border: `1px solid ${theme.border}`,
          borderRadius: 0,
          overflow: 'hidden',
          backgroundColor: theme.bgSecondary,
          cursor: 'pointer',
          transition: 'box-shadow 400ms ease, transform 400ms ease',
          boxShadow: hovered
            ? darkMode
              ? '0 8px 32px rgba(0,0,0,0.5)'
              : '0 8px 32px rgba(0,0,0,0.08)'
            : 'none',
          transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        }}
      >
        {/* LEFT COLUMN - Content (60%) */}
        <div
          style={{
            flex: '0 0 60%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '48px 52px',
          }}
        >
          {/* Category Badge */}
          <div style={{ marginBottom: '16px' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                fontSize: '10px',
                fontFamily: LABEL_FONT,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#FFFFFF',
                backgroundColor: categoryColor,
                lineHeight: 1.6,
              }}
            >
              {synthesis.category || 'ACTUALITE'}
            </span>
          </div>

          {/* Source Count */}
          <p
            style={{
              margin: '0 0 14px 0',
              fontSize: '10px',
              fontFamily: LABEL_FONT,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: theme.textTertiary,
            }}
          >
            SYNTHESE DE {synthesis.numSources} SOURCE
            {synthesis.numSources > 1 ? 'S' : ''}
          </p>

          {/* Title */}
          <h1
            style={{
              margin: '0 0 18px 0',
              fontSize: 'clamp(32px, 3.5vw, 56px)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: theme.text,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {synthesis.title}
          </h1>

          {/* Summary */}
          {synthesis.summary && (
            <p
              style={{
                margin: '0 0 32px 0',
                fontSize: '16px',
                fontFamily: 'Georgia, "Times New Roman", serif',
                lineHeight: 1.6,
                color: theme.textSecondary,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                maxWidth: '580px',
              }}
            >
              {synthesis.summary}
            </p>
          )}

          {/* Bottom Metrics Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '28px',
              marginTop: 'auto',
              paddingTop: '12px',
            }}
          >
            {/* Transparency Score */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  border: `2px solid ${transparencyColor}`,
                  fontSize: '14px',
                  fontFamily: LABEL_FONT,
                  fontWeight: 700,
                  color: transparencyColor,
                  lineHeight: 1,
                }}
              >
                {transparencyScore}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: LABEL_FONT,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: theme.textTertiary,
                }}
              >
                TRANSPARENCY
              </span>
            </div>

            {/* Separator */}
            <span
              style={{
                width: '1px',
                height: '20px',
                backgroundColor: theme.border,
              }}
            />

            {/* Reading Time */}
            {synthesis.readingTime > 0 && (
              <>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: LABEL_FONT,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: theme.textTertiary,
                  }}
                >
                  {synthesis.readingTime} MINS
                </span>

                <span
                  style={{
                    width: '1px',
                    height: '20px',
                    backgroundColor: theme.border,
                  }}
                />
              </>
            )}

            {/* Last Updated */}
            <span
              style={{
                fontSize: '10px',
                fontFamily: LABEL_FONT,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: theme.textTertiary,
              }}
            >
              {formatTimeAgo(synthesis.createdAt)}
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN - Image (40%) */}
        <div
          style={{
            flex: '0 0 40%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              synthesis.imageUrl ||
              `https://picsum.photos/800/600?random=${synthesis.id}`
            }
            alt={synthesis.title || 'Synthesis image'}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)',
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
            }}
            loading="eager"
          />

          {/* Dark mode subtle overlay */}
          {darkMode && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.15)',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </article>
    </Link>
  );
}

export default HeroSynthesis;
