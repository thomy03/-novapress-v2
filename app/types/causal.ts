/**
 * Nexus Causal Types
 * Pre-computed causal relationships for NovaPress AI syntheses
 */

// ==========================================
// Relation Types
// ==========================================

export type RelationType = 'causes' | 'triggers' | 'enables' | 'prevents';

export type NarrativeFlow = 'linear' | 'branching' | 'circular';

export type NodeType = 'event' | 'entity' | 'decision';

// ==========================================
// Core Types
// ==========================================

export interface CausalNode {
  id: string;
  label: string;
  node_type: NodeType;
  date?: string;
  fact_density: number;
}

export interface CausalEdge {
  cause_text: string;
  effect_text: string;
  relation_type: RelationType;
  confidence: number;
  evidence: string[];
  source_articles: string[];
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  central_entity: string;
  narrative_flow: NarrativeFlow;
}

// ==========================================
// API Response Types
// ==========================================

export interface CausalGraphResponse {
  synthesis_id: string;
  title: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  central_entity: string;
  narrative_flow: NarrativeFlow;
  total_relations: number;
}

export interface CausalPreviewResponse {
  synthesis_id: string;
  has_causal_data: boolean;
  total_relations: number;
  top_relations: CausalEdge[];
  central_entity: string;
  narrative_flow: NarrativeFlow;
}

export interface EntityCausalProfileResponse {
  entity_name: string;
  appearances_count: number;
  as_cause_count: number;
  as_effect_count: number;
  syntheses: {
    synthesis_id: string;
    title: string;
    date: string;
  }[];
  related_entities: string[];
}

export interface CausalStatsResponse {
  total_syntheses: number;
  syntheses_with_causal_data: number;
  total_causal_relations: number;
  avg_relations_per_synthesis: number;
  relation_types: {
    causes: number;
    triggers: number;
    enables: number;
    prevents: number;
  };
  narrative_flows: {
    linear: number;
    branching: number;
    circular: number;
  };
}

// ==========================================
// Historical Causal Graph Types (Multi-Layer DAG)
// ==========================================

export type InterLayerConnectionType = 'leads_to';

/**
 * A single layer in the historical causal graph (one synthesis)
 */
export interface HistoricalLayer {
  synthesis_id: string;
  title: string;
  date: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  is_current: boolean;
}

/**
 * Connection between two layers (leads_to relationship)
 * Shows how an effect in one synthesis led to a cause in the next
 */
export interface InterLayerConnection {
  from_layer: number;
  to_layer: number;
  from_node_id: string;
  to_node_id: string;
  from_effect: string;
  to_cause: string;
  similarity: number;
  connection_type: InterLayerConnectionType;
}

/**
 * Complete historical causal graph response
 * Contains multiple layers (syntheses) and inter-layer connections
 */
export interface HistoricalCausalGraphResponse {
  synthesis_id: string;
  layers: HistoricalLayer[];
  inter_layer_connections: InterLayerConnection[];
  total_nodes: number;
  total_edges: number;
  total_layers: number;
}

/**
 * Positioned node for rendering (with x, y coordinates)
 */
export interface PositionedNode extends CausalNode {
  x: number;
  y: number;
  layerIndex: number;
  synthesisTitle: string;
  synthesisDate: string;
  isCurrent: boolean;
}

/**
 * Positioned edge for rendering
 */
export interface PositionedEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: RelationType | InterLayerConnectionType;
  confidence: number;
  isInterLayer: boolean;
  causeText: string;
  effectText: string;
}

// ==========================================
// UI Configuration
// ==========================================

export const RELATION_CONFIG: Record<RelationType | InterLayerConnectionType, {
  label: string;
  labelFr: string;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
  isDashed?: boolean;
}> = {
  causes: {
    label: 'Causes',
    labelFr: 'Cause',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    icon: '→',
    description: 'Direct causal relationship'
  },
  triggers: {
    label: 'Triggers',
    labelFr: 'Déclenche',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    icon: '⚡',
    description: 'Event that initiates another'
  },
  enables: {
    label: 'Enables',
    labelFr: 'Permet',
    color: '#10B981',
    bgColor: '#D1FAE5',
    icon: '✓',
    description: 'Makes something possible'
  },
  prevents: {
    label: 'Prevents',
    labelFr: 'Empêche',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: '✕',
    description: 'Blocks or stops something'
  },
  leads_to: {
    label: 'Leads to',
    labelFr: 'Mène à',
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    icon: '⤵',
    description: 'Inter-synthesis connection (effect becomes cause)',
    isDashed: true
  }
};

export const NARRATIVE_FLOW_CONFIG: Record<NarrativeFlow, {
  label: string;
  labelFr: string;
  color: string;
  icon: string;
  description: string;
}> = {
  linear: {
    label: 'Linear',
    labelFr: 'Linéaire',
    color: '#2563EB',
    icon: '→',
    description: 'Events follow a straight cause-effect chain'
  },
  branching: {
    label: 'Branching',
    labelFr: 'Ramifié',
    color: '#8B5CF6',
    icon: '⑂',
    description: 'Multiple effects from single causes'
  },
  circular: {
    label: 'Circular',
    labelFr: 'Circulaire',
    color: '#EC4899',
    icon: '↻',
    description: 'Effects feed back into causes'
  }
};

// ==========================================
// Helper Functions
// ==========================================

export function getConfidenceLevel(confidence: number): {
  label: string;
  labelFr: string;
  color: string;
} {
  if (confidence >= 0.8) {
    return { label: 'High', labelFr: 'Élevé', color: '#10B981' };
  } else if (confidence >= 0.5) {
    return { label: 'Medium', labelFr: 'Moyen', color: '#F59E0B' };
  } else {
    return { label: 'Low', labelFr: 'Faible', color: '#EF4444' };
  }
}

export function formatConfidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
