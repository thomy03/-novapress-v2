"use client";

import React, { memo, useState } from 'react';
import Link from 'next/link';
import { Article } from '../../types/Article';
import { useTheme } from '../../contexts/ThemeContext';

interface CompactArticleCardProps {
  article: Article;
  onArticleClick: (article: Article) => void;
  showImage?: boolean;
  index?: number;
}

export const CompactArticleCard = memo(function CompactArticleCard({
  article,
  onArticleClick,
  showImage = true,
  index = 0,
}: CompactArticleCardProps) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);

  const formatTimeAgo = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'JUST NOW';
    if (minutes < 60) return `${minutes}M AGO`;
    if (hours < 24) return `${hours}H AGO`;
    if (days < 7) return `${days}D AGO`;
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase();
  };

  const getIntelLevel = () => {
    const score = article.complianceScore;
    if (score === undefined || score === null) return 'INTEL: --';
    if (score >= 85) return 'INTEL: HIGH';
    if (score >= 60) return 'INTEL: MED';
    return 'INTEL: CRITICAL';
  };

  // Check if article has AI features (synthesis)
  const isSynthesis = article.source?.name === 'NovaPress AI' ||
                      article.complianceScore !== undefined;

  const href = isSynthesis ? `/synthesis/${article.id}` : `/article/${article.id}`;

  const displayNumber = String(index + 1).padStart(2, '0');

  return (
    <Link href={href} style={{ display: 'block', textDecoration: 'none' }}>
      <article
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          padding: '32px',
          backgroundColor: hovered ? theme.bgSecondary : theme.card,
          transition: 'background-color 300ms ease',
          cursor: 'pointer',
          overflow: 'hidden',
        }}
      >
        {/* Background image reveal on hover */}
        {article.featuredImage && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              opacity: hovered ? 0.15 : 0,
              transition: 'opacity 700ms ease',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.featuredImage}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'grayscale(100%)',
              }}
              loading="lazy"
            />
          </div>
        )}

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10 }}>
          {/* Large number */}
          <div
            style={{
              fontFamily: 'var(--font-label)',
              fontSize: '36px',
              color: theme.textTertiary || '#71717a',
              marginBottom: '24px',
              lineHeight: 1,
            }}
          >
            {displayNumber}
          </div>

          {/* Title */}
          <h3
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '18px',
              fontWeight: 700,
              color: theme.text,
              lineHeight: 1.3,
              margin: 0,
              marginBottom: '16px',
              transform: hovered ? 'translateX(4px)' : 'translateX(0)',
              transition: 'transform 200ms ease',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {article.title}
          </h3>

          {/* Bottom row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {/* Time ago */}
            <span
              style={{
                fontFamily: 'var(--font-label)',
                fontSize: '9px',
                color: theme.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {formatTimeAgo(article.publishedAt || article.createdAt)}
            </span>

            {/* Separator dot */}
            <div
              style={{
                width: '3px',
                height: '3px',
                borderRadius: '50%',
                backgroundColor: theme.borderStrong || '#3f3f46',
                flexShrink: 0,
              }}
            />

            {/* Intelligence level */}
            <span
              style={{
                fontFamily: 'var(--font-label)',
                fontSize: '9px',
                color: theme.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {getIntelLevel()}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
});

export default CompactArticleCard;
