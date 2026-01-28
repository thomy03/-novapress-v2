'use client';

import React, { useState } from 'react';
import { useTheme } from '@/app/contexts/ThemeContext';
import { BentoCardProps, BentoCardSize, BENTO_SIZE_CONFIG } from '@/app/types/bento';

/**
 * UI-002b: BentoCard Component
 * Carte individuelle pour le système Bento Grid
 * Variantes: small (1x1), medium (2x1), large (2x2), featured (4x2)
 */
export function BentoCard({
  size = 'small',
  children,
  style,
  className,
  onClick,
  backgroundImage,
  overlay = true,
  title,
  disableHover = false,
}: BentoCardProps) {
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const sizeConfig = BENTO_SIZE_CONFIG[size];

  // Styles de base selon la taille
  const baseStyles: React.CSSProperties = {
    gridColumn: `span ${sizeConfig.colSpan}`,
    gridRow: `span ${sizeConfig.rowSpan}`,
    backgroundColor: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: '12px',
    overflow: 'hidden',
    position: 'relative',
    cursor: onClick ? 'pointer' : 'default',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    minHeight: getMinHeight(size),
  };

  // Styles hover
  const hoverStyles: React.CSSProperties = !disableHover && isHovered ? {
    transform: 'translateY(-4px)',
    boxShadow: `0 12px 40px ${theme.shadow}`,
    borderColor: theme.brand.accent,
  } : {};

  // Styles avec image de fond
  const backgroundStyles: React.CSSProperties = backgroundImage ? {
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } : {};

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={title}
      className={className}
      style={{
        ...baseStyles,
        ...backgroundStyles,
        ...hoverStyles,
        ...style,
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Overlay gradient pour lisibilité du texte sur image */}
      {backgroundImage && overlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Contenu */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: getPadding(size),
        }}
      >
        {children}
      </div>

      {/* Indicateur hover subtil */}
      {!disableHover && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: theme.brand.accent,
            transform: isHovered ? 'scaleX(1)' : 'scaleX(0)',
            transformOrigin: 'left',
            transition: 'transform 0.3s ease',
          }}
        />
      )}
    </div>
  );
}

// Helper: hauteur minimale selon la taille
function getMinHeight(size: BentoCardSize): string {
  switch (size) {
    case 'featured': return '400px';
    case 'large': return '320px';
    case 'medium': return '180px';
    case 'small': return '160px';
    default: return '160px';
  }
}

// Helper: padding selon la taille
function getPadding(size: BentoCardSize): string {
  switch (size) {
    case 'featured': return '32px';
    case 'large': return '24px';
    case 'medium': return '20px';
    case 'small': return '16px';
    default: return '16px';
  }
}

export default BentoCard;
