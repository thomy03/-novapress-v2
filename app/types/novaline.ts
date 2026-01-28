/**
 * NovaLine v3 - Types for Tension Narrative Visualization
 * The "Electrocardiogram of News"
 */

import { NarrativePhase, ContradictionItem } from './timeline';
import { Prediction, PredictionTimeframe } from './causal';

// ==========================================
// Core Types
// ==========================================

export interface NovaLinePoint {
  id: string;
  date: string;
  dateFormatted: string;
  title: string;
  summary?: string;
  tension: number;
  phase: NarrativePhase;
  factDensity: number;
  sources: string[];
  synthesisId: string;
  isPresent: boolean;
  isFuture: boolean;
  hasContradiction: boolean;
  contradiction?: ContradictionItem;
}

export interface NovaLinePrediction {
  id: string;
  label: string;
  tension: number;
  probability: number;
  timeframe: PredictionTimeframe;
  rationale: string;
  points: NovaLinePoint[];
}

export interface NovaLineData {
  synthesisId: string;
  category: string;
  currentTitle: string;
  points: NovaLinePoint[];
  predictions: NovaLinePrediction[];
  contradictions: ContradictionItem[];
  narrativeArc: NarrativePhase;
  daysTracked: number;
  minTension: number;
  maxTension: number;
}

// ==========================================
// Configuration Constants
// ==========================================

/**
 * Phase to tension score mapping
 * Based on narrative intensity
 */
export const PHASE_TENSION: Record<NarrativePhase, number> = {
  emerging: 25,
  developing: 50,
  peak: 90,
  declining: 60,
  resolved: 20,
};

/**
 * Category weight for tension calculation
 * Higher weight = higher global importance
 */
export const CATEGORY_WEIGHT: Record<string, number> = {
  MONDE: 1.0,
  POLITIQUE: 0.9,
  ECONOMIE: 0.8,
  SCIENCES: 0.7,
  TECH: 0.6,
  CULTURE: 0.5,
  SPORT: 0.4,
  DEFAULT: 0.6,
};

/**
 * NovaLine theme colors (Newspaper style)
 */
export const NOVALINE_THEME = {
  // Lines
  linePast: '#000000',
  lineFuture: '#9CA3AF',

  // Points
  pointPast: '#374151',
  pointPresent: '#DC2626',
  pointFuture: '#6B7280',

  // Cone of uncertainty
  coneBackground: 'rgba(0, 0, 0, 0.05)',
  coneBorder: '#E5E5E5',

  // Alerts
  contradiction: '#F59E0B',

  // Background
  background: '#FFFFFF',
  grid: '#F3F4F6',

  // Text
  text: '#000000',
  textSecondary: '#6B7280',
};

/**
 * Phase colors for NovaLine (Newspaper style - black/grey with red for peak)
 */
export const NOVALINE_PHASE_COLORS: Record<NarrativePhase, string> = {
  emerging: '#374151',
  developing: '#000000',
  peak: '#DC2626',
  declining: '#6B7280',
  resolved: '#9CA3AF',
};

// ==========================================
// Helper Functions
// ==========================================

/**
 * Calculate tension score for a timeline event
 * Formula: phase_tension * category_weight * fact_density
 */
export function calculateTension(
  phase: NarrativePhase,
  category: string,
  factDensity: number
): number {
  const phaseTension = PHASE_TENSION[phase] || PHASE_TENSION.developing;
  const categoryWeight = CATEGORY_WEIGHT[category.toUpperCase()] || CATEGORY_WEIGHT.DEFAULT;
  const density = Math.max(0.1, Math.min(1, factDensity || 0.7));

  return Math.round(phaseTension * categoryWeight * density);
}

/**
 * Calculate cone width for uncertainty visualization
 * The cone widens as we go further into the future
 */
export function calculateConeWidth(
  daysInFuture: number,
  probability: number
): number {
  const uncertaintyFactor = 1 - probability;
  return 10 + (daysInFuture * 5 * uncertaintyFactor);
}

/**
 * Format date for display on NovaLine
 */
export function formatNovaLineDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;

  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get tension level label (Newspaper style - black/grey with red for high)
 */
export function getTensionLevel(tension: number): {
  label: string;
  labelFr: string;
  color: string;
} {
  if (tension >= 70) {
    return { label: 'High', labelFr: 'Critique', color: '#DC2626' };
  } else if (tension >= 40) {
    return { label: 'Medium', labelFr: 'Modéré', color: '#374151' };
  } else {
    return { label: 'Low', labelFr: 'Faible', color: '#6B7280' };
  }
}
