/**
 * UI-002a: Bento Grid Types
 * Types pour le système de grille asymétrique Bento
 */

// Tailles des cartes Bento
export type BentoCardSize = 'small' | 'medium' | 'large' | 'featured';

// Configuration des tailles en CSS Grid
export const BENTO_SIZE_CONFIG: Record<BentoCardSize, { colSpan: number; rowSpan: number }> = {
  small: { colSpan: 1, rowSpan: 1 },      // 1x1
  medium: { colSpan: 2, rowSpan: 1 },     // 2x1
  large: { colSpan: 2, rowSpan: 2 },      // 2x2
  featured: { colSpan: 4, rowSpan: 2 },   // 4x2 (full width)
};

// Props pour une carte Bento individuelle
export interface BentoCardProps {
  /** Taille de la carte */
  size?: BentoCardSize;
  /** Contenu de la carte */
  children: React.ReactNode;
  /** Style personnalisé */
  style?: React.CSSProperties;
  /** Classe CSS personnalisée */
  className?: string;
  /** Callback au clic */
  onClick?: () => void;
  /** Image de fond optionnelle */
  backgroundImage?: string;
  /** Overlay gradient pour lisibilité */
  overlay?: boolean;
  /** Titre de la carte (pour accessibilité) */
  title?: string;
  /** Désactiver les animations hover */
  disableHover?: boolean;
}

// Props pour le conteneur BentoGrid
export interface BentoGridProps {
  /** Cartes à afficher */
  children: React.ReactNode;
  /** Gap entre les cartes (en pixels) */
  gap?: number;
  /** Nombre de colonnes sur desktop */
  columns?: number;
  /** Style personnalisé */
  style?: React.CSSProperties;
  /** Classe CSS personnalisée */
  className?: string;
}

// Configuration responsive breakpoints
export const BENTO_BREAKPOINTS = {
  sm: 640,   // Mobile
  md: 768,   // Tablet
  lg: 1024,  // Desktop
  xl: 1280,  // Large desktop
} as const;

// Configuration colonnes par breakpoint
export const BENTO_COLUMNS_CONFIG = {
  mobile: 1,    // < 640px
  tablet: 2,    // 640px - 1023px
  desktop: 4,   // >= 1024px
} as const;

// Types pour les items de synthèse dans Bento
export interface BentoSynthesisItem {
  id: string;
  title: string;
  summary?: string;
  category?: string;
  imageUrl?: string;
  createdAt?: string;
  sourceCount?: number;
  size?: BentoCardSize;
}

// Helper pour déterminer la taille d'une carte basée sur l'importance
export function determineBentoSize(index: number, total: number): BentoCardSize {
  if (index === 0 && total >= 5) return 'featured';
  if (index === 0) return 'large';
  if (index <= 2) return 'medium';
  return 'small';
}
