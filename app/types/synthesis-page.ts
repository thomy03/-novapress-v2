/**
 * REF-012a: Shared types for Synthesis Page components
 * These types are used by Server Component and Client Components
 */

import { CausalNode, CausalEdge, CausalGraphResponse, Prediction } from './causal';
import { EnrichmentData } from './api';

// ========== Historical Context Types ==========

export interface RelatedSynthesisBrief {
  id: string;
  title: string;
  createdAt: string;
}

export interface HistoricalContext {
  daysTracked: number;
  narrativeArc: string;
  relatedSyntheses: RelatedSynthesisBrief[];
  hasContradictions: boolean;
  contradictionsCount: number;
}

// ========== Source Types ==========

export interface SourceArticle {
  name: string;
  url: string;
  title: string;
}

// ========== Persona Types ==========

export interface PersonaInfo {
  id: string;
  name: string;
  displayName: string;
  tone?: string;
}

export interface AuthorDisplay {
  name: string;
  persona_id: string;
  persona_type: string;
  display: string;  // "par Edouard Vaillant > Le Cynique"
  signature: string;
}

// ========== Synthesis Core Type ==========

export interface SynthesisData {
  id: string;
  title: string;
  summary: string;
  introduction?: string;
  body?: string;
  analysis?: string;
  keyPoints: string[];
  sources: string[];
  sourceArticles?: SourceArticle[];
  numSources: number;
  complianceScore: number;
  readingTime: number;
  createdAt: string;
  category?: string; // MONDE, TECH, POLITIQUE, etc.
  persona?: PersonaInfo;
  author?: AuthorDisplay;
  signature?: string;
  isPersonaVersion?: boolean;
  enrichment?: EnrichmentData;
  // Update tracking (Phase 6)
  updateNotice?: string;
  originalCreatedAt?: string;
  lastUpdatedAt?: string;
  isUpdate?: boolean;
  // Predictions & Historical Context (Phase 11)
  predictions?: Prediction[];
  historicalContext?: HistoricalContext;
  // Transparency Score (Phase 2)
  transparencyScore?: number;
  transparencyLabel?: string;
  transparencyBreakdown?: Record<string, { score: number; weight: number; detail: string }>;
}

// ========== Related Synthesis Type ==========

export interface RelatedSynthesis {
  id: string;
  title: string;
  similarity: number;
}

// ========== Component Props ==========

export interface SynthesisHeaderProps {
  synthesis: SynthesisData;
  formatDate: (dateString: string) => string;
}

export interface SynthesisBodyProps {
  synthesis: SynthesisData;
  // Note: renderTextWithCitations is handled internally by SynthesisBody
}

export interface PersonaSectionProps {
  synthesis: SynthesisData;
  currentPersona: string;
  personaLoading: boolean;
  onPersonaChange: (personaId: string) => void;
}

export interface CausalSectionProps {
  synthesisId: string;
  synthesisTitle: string;
  causalData: CausalGraphResponse | null;
  causalLoading: boolean;
  onNodeClick?: (nodeId: string, nodeData: CausalNode) => void;
  onEdgeClick?: (edge: CausalEdge) => void;
}

export interface SourcesSectionProps {
  synthesis: SynthesisData;
}

export interface EnrichmentSectionProps {
  enrichment: EnrichmentData;
}

// ========== Shared Styles ==========

export const sharedStyles = {
  // Typography
  fontSerif: 'Georgia, "Times New Roman", serif',
  fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

  // Colors
  textPrimary: '#000000',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  accentBlue: '#2563EB',
  accentRed: '#DC2626',
  accentGreen: '#10B981',
  accentYellow: '#F59E0B',
  bgWhite: '#FFFFFF',
  bgGray: '#F9FAFB',
  bgMuted: '#F3F4F6',
  border: '#E5E5E5',

  // Spacing
  sectionGap: '40px',
  contentPadding: '24px',
} as const;

// ========== Utility Functions ==========

export function formatSynthesisDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getParagraphs(content: string): string[] {
  return content.split('\n\n').filter(p => p.trim());
}
