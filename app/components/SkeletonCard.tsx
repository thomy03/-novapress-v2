"use client";

import { memo } from 'react';

interface SkeletonCardProps {
  darkMode?: boolean;
  variant?: 'default' | 'featured' | 'small';
}

const SkeletonCard = memo(function SkeletonCard({ 
  darkMode = false,
  variant = 'default' 
}: SkeletonCardProps) {
  const theme = {
    bg: darkMode ? '#1a1a1a' : '#ffffff',
    skeleton: darkMode ? '#2a2a2a' : '#f3f4f6',
    shimmer: darkMode ? '#3a3a3a' : '#e5e7eb',
    border: darkMode ? '#333333' : '#e5e7eb',
  };

  const heights = {
    default: '200px',
    featured: '300px',
    small: '120px'
  };

  return (
    <article 
      role="article"
      aria-label="Chargement d'un article en cours"
      aria-busy="true"
      style={{ 
        backgroundColor: theme.bg,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${theme.border}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      {/* Animation Shimmer */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
        
        .skeleton-shimmer {
          animation: shimmer 2s infinite linear;
          background: linear-gradient(
            90deg,
            ${theme.skeleton} 0%,
            ${theme.shimmer} 50%,
            ${theme.skeleton} 100%
          );
          background-size: 1000px 100%;
        }
      `}</style>

      {/* Image Skeleton */}
      <div 
        className="skeleton-shimmer"
        role="img"
        aria-label="Image en cours de chargement"
        style={{ 
          height: heights[variant],
          width: '100%',
          backgroundColor: theme.skeleton
        }}
      />

      {/* Content Skeleton */}
      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Category */}
        <div 
          className="skeleton-shimmer"
          role="text"
          aria-label="Catégorie en cours de chargement"
          style={{
            height: '20px',
            width: '80px',
            borderRadius: '10px',
            backgroundColor: theme.skeleton,
            marginBottom: '12px'
          }}
        />

        {/* Title */}
        <div 
          className="skeleton-shimmer"
          role="heading"
          aria-label="Titre en cours de chargement"
          style={{
            height: '24px',
            width: '100%',
            borderRadius: '4px',
            backgroundColor: theme.skeleton,
            marginBottom: '8px'
          }}
        />
        <div 
          className="skeleton-shimmer"
          aria-hidden="true"
          style={{
            height: '24px',
            width: '70%',
            borderRadius: '4px',
            backgroundColor: theme.skeleton,
            marginBottom: '12px'
          }}
        />

        {/* Summary */}
        <div 
          className="skeleton-shimmer"
          role="text"
          aria-label="Résumé en cours de chargement"
          style={{
            height: '16px',
            width: '100%',
            borderRadius: '4px',
            backgroundColor: theme.skeleton,
            marginBottom: '6px'
          }}
        />
        <div 
          className="skeleton-shimmer"
          aria-hidden="true"
          style={{
            height: '16px',
            width: '90%',
            borderRadius: '4px',
            backgroundColor: theme.skeleton,
            marginBottom: '6px'
          }}
        />
        <div 
          className="skeleton-shimmer"
          aria-hidden="true"
          style={{
            height: '16px',
            width: '60%',
            borderRadius: '4px',
            backgroundColor: theme.skeleton,
            marginBottom: '16px'
          }}
        />

        {/* Tags */}
        <div role="group" aria-label="Tags en cours de chargement" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <div 
            className="skeleton-shimmer"
            aria-hidden="true"
            style={{
              height: '24px',
              width: '60px',
              borderRadius: '12px',
              backgroundColor: theme.skeleton
            }}
          />
          <div 
            className="skeleton-shimmer"
            aria-hidden="true"
            style={{
              height: '24px',
              width: '80px',
              borderRadius: '12px',
              backgroundColor: theme.skeleton
            }}
          />
          <div 
            className="skeleton-shimmer"
            aria-hidden="true"
            style={{
              height: '24px',
              width: '50px',
              borderRadius: '12px',
              backgroundColor: theme.skeleton
            }}
          />
        </div>

        {/* Footer */}
        <div style={{ 
          marginTop: 'auto',
          paddingTop: '12px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div 
              className="skeleton-shimmer"
              role="img"
              aria-label="Avatar auteur en cours de chargement"
              style={{
                height: '20px',
                width: '20px',
                borderRadius: '50%',
                backgroundColor: theme.skeleton
              }}
            />
            <div 
              className="skeleton-shimmer"
              role="text"
              aria-label="Informations auteur en cours de chargement"
              style={{
                height: '14px',
                width: '80px',
                borderRadius: '4px',
                backgroundColor: theme.skeleton
              }}
            />
          </div>
          <div 
            className="skeleton-shimmer"
            role="text"
            aria-label="Métadonnées en cours de chargement"
            style={{
              height: '14px',
              width: '60px',
              borderRadius: '4px',
              backgroundColor: theme.skeleton
            }}
          />
        </div>
      </div>
    </article>
  );
});

export default SkeletonCard;