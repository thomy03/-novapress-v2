"use client";

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// ============================================================================
// TYPES
// ============================================================================

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'title' | 'circular' | 'rectangular' | 'rounded';
  animation?: 'shimmer' | 'pulse' | 'none';
  className?: string;
  style?: React.CSSProperties;
}

// ============================================================================
// BASE SKELETON
// ============================================================================

export function Skeleton({
  width,
  height,
  variant = 'text',
  animation = 'shimmer',
  className = '',
  style = {},
}: SkeletonProps) {
  const { theme } = useTheme();

  // Variant styles
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'text':
        return {
          height: height || '1em',
          width: width || '100%',
          borderRadius: '4px',
        };
      case 'title':
        return {
          height: height || '1.5em',
          width: width || '80%',
          borderRadius: '4px',
        };
      case 'circular':
        const size = width || height || 40;
        return {
          width: size,
          height: size,
          borderRadius: '50%',
        };
      case 'rectangular':
        return {
          height: height || 200,
          width: width || '100%',
          borderRadius: '0',
        };
      case 'rounded':
        return {
          height: height || 200,
          width: width || '100%',
          borderRadius: '12px',
        };
      default:
        return {};
    }
  };

  // Animation styles
  const getAnimationStyles = (): React.CSSProperties => {
    switch (animation) {
      case 'shimmer':
        return {
          background: `linear-gradient(90deg, ${theme.bgSecondary} 0%, ${theme.bgTertiary} 50%, ${theme.bgSecondary} 100%)`,
          backgroundSize: '1000px 100%',
          animation: 'shimmer 2s infinite linear',
        };
      case 'pulse':
        return {
          background: theme.bgTertiary,
          animation: 'pulse 1.5s infinite',
        };
      case 'none':
        return {
          background: theme.bgTertiary,
        };
      default:
        return {};
    }
  };

  return (
    <span
      className={className}
      style={{
        display: 'block',
        ...getVariantStyles(),
        ...getAnimationStyles(),
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

// ============================================================================
// SKELETON TEXT (Multiple lines)
// ============================================================================

interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  lastLineWidth?: string;
  className?: string;
}

export function SkeletonText({
  lines = 3,
  lineHeight = 16,
  gap = 8,
  lastLineWidth = '70%',
  className = '',
}: SkeletonTextProps) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={i === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
}

// ============================================================================
// SKELETON CARD
// ============================================================================

interface SkeletonCardProps {
  hasImage?: boolean;
  imageHeight?: number;
  lines?: number;
  className?: string;
}

export function SkeletonCard({
  hasImage = true,
  imageHeight = 180,
  lines = 2,
  className = '',
}: SkeletonCardProps) {
  const { theme } = useTheme();

  return (
    <div
      className={className}
      style={{
        background: theme.card,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${theme.border}`,
      }}
    >
      {hasImage && (
        <Skeleton
          variant="rectangular"
          height={imageHeight}
          style={{ borderRadius: 0 }}
        />
      )}
      <div style={{ padding: 16 }}>
        <Skeleton variant="title" width="90%" style={{ marginBottom: 12 }} />
        <SkeletonText lines={lines} lineHeight={14} gap={6} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Skeleton width={60} height={24} style={{ borderRadius: 6 }} />
          <Skeleton width={80} height={24} style={{ borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON ARTICLE (For article pages)
// ============================================================================

interface SkeletonArticleProps {
  className?: string;
}

export function SkeletonArticle({ className = '' }: SkeletonArticleProps) {
  const { theme } = useTheme();

  return (
    <div className={className} style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      {/* Category and date */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Skeleton width={80} height={24} style={{ borderRadius: 6 }} />
        <Skeleton width={120} height={24} style={{ borderRadius: 6 }} />
      </div>

      {/* Title */}
      <Skeleton variant="title" height={48} width="95%" style={{ marginBottom: 8 }} />
      <Skeleton variant="title" height={48} width="70%" style={{ marginBottom: 24 }} />

      {/* Author */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <Skeleton variant="circular" width={48} height={48} />
        <div>
          <Skeleton width={120} height={16} style={{ marginBottom: 4 }} />
          <Skeleton width={80} height={14} />
        </div>
      </div>

      {/* Hero image */}
      <Skeleton
        variant="rounded"
        height={400}
        style={{ marginBottom: 32 }}
      />

      {/* Content */}
      <SkeletonText lines={4} lineHeight={20} gap={12} />
      <div style={{ height: 24 }} />
      <SkeletonText lines={5} lineHeight={20} gap={12} />
      <div style={{ height: 24 }} />
      <SkeletonText lines={3} lineHeight={20} gap={12} />
    </div>
  );
}

// ============================================================================
// SKELETON HERO (For homepage hero)
// ============================================================================

interface SkeletonHeroProps {
  height?: string | number;
  className?: string;
}

export function SkeletonHero({ height = '70vh', className = '' }: SkeletonHeroProps) {
  const { theme, darkMode } = useTheme();

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height,
        background: theme.bgSecondary,
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Background shimmer */}
      <Skeleton
        variant="rectangular"
        height="100%"
        animation="shimmer"
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Content overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 40,
          background: darkMode
            ? 'linear-gradient(transparent, rgba(0,0,0,0.9))'
            : 'linear-gradient(transparent, rgba(255,255,255,0.95))',
        }}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Skeleton width={80} height={28} style={{ borderRadius: 6 }} />
          <Skeleton width={100} height={28} style={{ borderRadius: 6 }} />
        </div>
        <Skeleton height={48} width="80%" style={{ marginBottom: 12 }} />
        <Skeleton height={48} width="60%" style={{ marginBottom: 24 }} />
        <Skeleton height={20} width="50%" />
      </div>
    </div>
  );
}

// ============================================================================
// SKELETON BENTO GRID
// ============================================================================

interface SkeletonBentoGridProps {
  items?: number;
  className?: string;
}

export function SkeletonBentoGrid({ items = 6, className = '' }: SkeletonBentoGridProps) {
  return (
    <div
      className={`bento-grid ${className}`}
      style={{ gap: 16 }}
    >
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className={i === 0 ? 'bento-span-2 bento-row-2' : ''}
        >
          <SkeletonCard
            hasImage={i < 4}
            imageHeight={i === 0 ? 300 : 160}
            lines={i === 0 ? 3 : 2}
          />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
