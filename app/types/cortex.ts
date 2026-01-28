/**
 * Types pour le Cortex Thématique - Visualisation neurale interactive
 */

// Sentiments possibles d'un topic
export type CortexSentiment = 'positive' | 'negative' | 'neutral';

// Phases narratives d'un topic
export type NarrativeArc = 'emerging' | 'developing' | 'peak' | 'declining' | 'resolved';

// Catégories de topics
export type TopicCategory =
  | 'POLITIQUE'
  | 'ECONOMIE'
  | 'TECH'
  | 'MONDE'
  | 'CULTURE'
  | 'SPORT'
  | 'SCIENCES';

// Noeud du graphe Cortex - "Neurone" de l'Organisme Pensant
export interface CortexNode {
  id: string;
  name: string;
  category: TopicCategory | string;
  synthesis_count: number;
  sentiment: CortexSentiment;
  narrative_arc: NarrativeArc;
  hot_score: number;
  // Animation properties for "Organisme Pensant"
  phase?: number;  // Unique phase for breathing animation (0-2π)
  activationTime?: number;  // Timestamp when node was last activated
  activationIntensity?: number;  // Intensity of current activation (0-1)
  // Propriétés calculées par force-graph
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
  // Allow additional properties for force-graph
  [others: string]: unknown;
}

// Connexion entre deux topics
export interface CortexEdge {
  source: string | CortexNode;
  target: string | CortexNode;
  similarity: number;
  shared_entities: string[];
  // Allow additional properties for force-graph
  [others: string]: unknown;
}

// Données complètes du Cortex
export interface CortexData {
  nodes: CortexNode[];
  edges: CortexEdge[];
  central_node_id: string;
  last_updated: string;
  is_demo?: boolean;  // True if using demo/fallback data
}

// Réponse API du Cortex
export interface CortexResponse {
  nodes: CortexNode[];
  edges: CortexEdge[];
  central_node_id: string;
  last_updated: string;
}

// Configuration des couleurs par catégorie
export const CATEGORY_COLORS: Record<TopicCategory | string, string> = {
  POLITIQUE: '#DC2626',   // Rouge
  ECONOMIE: '#F59E0B',    // Orange
  TECH: '#2563EB',        // Bleu
  MONDE: '#10B981',       // Vert
  CULTURE: '#8B5CF6',     // Violet
  SPORT: '#06B6D4',       // Cyan
  SCIENCES: '#EC4899',    // Rose
};

// Couleurs de glow par sentiment
export const SENTIMENT_GLOW: Record<CortexSentiment, string> = {
  positive: 'rgba(16, 185, 129, 0.6)',  // Vert
  negative: 'rgba(220, 38, 38, 0.6)',   // Rouge
  neutral: 'rgba(107, 114, 128, 0.4)',  // Gris
};

// Couleurs de fond par sentiment
export const SENTIMENT_BG: Record<CortexSentiment, string> = {
  positive: 'rgba(16, 185, 129, 0.15)',
  negative: 'rgba(220, 38, 38, 0.15)',
  neutral: 'rgba(107, 114, 128, 0.15)',
};

// Labels français des narrative arcs
export const NARRATIVE_ARC_LABELS: Record<NarrativeArc, string> = {
  emerging: 'Émergent',
  developing: 'En développement',
  peak: 'Au pic',
  declining: 'En déclin',
  resolved: 'Résolu',
};

// Couleurs des narrative arcs
export const NARRATIVE_ARC_COLORS: Record<NarrativeArc, { bg: string; text: string }> = {
  emerging: { bg: '#EFF6FF', text: '#1D4ED8' },
  developing: { bg: '#F0FDF4', text: '#15803D' },
  peak: { bg: '#FEF3C7', text: '#B45309' },
  declining: { bg: '#FDF2F8', text: '#BE185D' },
  resolved: { bg: '#F3F4F6', text: '#6B7280' },
};

// Props du composant CortexGraph
export interface CortexGraphProps {
  data?: CortexData;
  compact?: boolean;
  height?: number;
  width?: number;
  onNodeClick?: (node: CortexNode) => void;
  onNodeHover?: (node: CortexNode | null) => void;
  onExploreClick?: () => void;
  highlightNodeId?: string;
  showLabels?: boolean;
  enableDrag?: boolean;
  enableZoom?: boolean;
}

// Props du panneau de détail
export interface CortexDetailPanelProps {
  node: CortexNode;
  onClose: () => void;
}

// Props des contrôles
export interface CortexControlsProps {
  onSearch: (query: string) => void;
  onCategoryFilter?: (categories: TopicCategory[]) => void;
  selectedCategories?: TopicCategory[];
}

// Données demo pour fallback - "Organisme Pensant" avec phases uniques
export const DEMO_CORTEX_DATA: CortexData = {
  nodes: [
    { id: '1', name: 'Intelligence Artificielle', category: 'TECH', synthesis_count: 15, sentiment: 'neutral', narrative_arc: 'peak', hot_score: 0.95, phase: 0 },
    { id: '2', name: 'Guerre Ukraine', category: 'MONDE', synthesis_count: 12, sentiment: 'negative', narrative_arc: 'developing', hot_score: 0.88, phase: 0.8 },
    { id: '3', name: 'Inflation', category: 'ECONOMIE', synthesis_count: 10, sentiment: 'negative', narrative_arc: 'peak', hot_score: 0.82, phase: 1.5 },
    { id: '4', name: 'Élections', category: 'POLITIQUE', synthesis_count: 8, sentiment: 'neutral', narrative_arc: 'emerging', hot_score: 0.75, phase: 2.2 },
    { id: '5', name: 'Transition Énergétique', category: 'SCIENCES', synthesis_count: 9, sentiment: 'positive', narrative_arc: 'developing', hot_score: 0.72, phase: 3.0 },
    { id: '6', name: 'Climat COP', category: 'SCIENCES', synthesis_count: 7, sentiment: 'negative', narrative_arc: 'peak', hot_score: 0.68, phase: 3.8 },
    { id: '7', name: 'Startups Tech', category: 'TECH', synthesis_count: 6, sentiment: 'positive', narrative_arc: 'emerging', hot_score: 0.55, phase: 4.5 },
    { id: '8', name: 'Champions League', category: 'SPORT', synthesis_count: 8, sentiment: 'positive', narrative_arc: 'developing', hot_score: 0.60, phase: 5.2 },
    { id: '9', name: 'Festival Cannes', category: 'CULTURE', synthesis_count: 5, sentiment: 'positive', narrative_arc: 'peak', hot_score: 0.52, phase: 5.8 },
    { id: '10', name: 'Réforme Retraites', category: 'POLITIQUE', synthesis_count: 11, sentiment: 'negative', narrative_arc: 'declining', hot_score: 0.78, phase: 1.0 },
  ],
  edges: [
    { source: '1', target: '7', similarity: 0.85, shared_entities: ['OpenAI', 'Google'] },
    { source: '2', target: '5', similarity: 0.72, shared_entities: ['Russie', 'Gaz'] },
    { source: '3', target: '5', similarity: 0.68, shared_entities: ['Prix', 'Énergie'] },
    { source: '4', target: '10', similarity: 0.75, shared_entities: ['Macron', 'Gouvernement'] },
    { source: '5', target: '6', similarity: 0.82, shared_entities: ['CO2', 'Environnement'] },
    { source: '1', target: '3', similarity: 0.45, shared_entities: ['Emploi'] },
    { source: '6', target: '4', similarity: 0.42, shared_entities: ['Politique'] },
    { source: '2', target: '4', similarity: 0.55, shared_entities: ['Europe'] },
    { source: '7', target: '3', similarity: 0.48, shared_entities: ['Investissement'] },
    { source: '8', target: '9', similarity: 0.35, shared_entities: ['Événement'] },
    { source: '10', target: '3', similarity: 0.52, shared_entities: ['Social'] },
  ],
  central_node_id: '1',
  last_updated: new Date().toISOString(),
  is_demo: true,
};
