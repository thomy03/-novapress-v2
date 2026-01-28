/**
 * TypeScript types for Intelligence Hub
 */

// =========================================================================
// ENTITY TYPES
// =========================================================================

export interface EntityResponse {
  id: string;
  canonical_name: string;
  entity_type: string;
  mention_count: number;
  synthesis_count: number;
  as_cause_count: number;
  as_effect_count: number;
  topics: string[];
}

export interface EntityDetailResponse extends EntityResponse {
  description: string;
  aliases: string[];
  first_seen: string | null;
  last_seen: string | null;
  related_entities: string[];
  synthesis_ids: string[];
}

export interface EntitySearchResult {
  entity: EntityResponse;
  similarity_score: number;
}

export interface EntityCausalProfile {
  entity_name: string;
  entity_type: string;
  as_cause: Array<{
    effect: string;
    confidence: number;
    synthesis_id: string;
    synthesis_title: string;
  }>;
  as_effect: Array<{
    cause: string;
    confidence: number;
    synthesis_id: string;
    synthesis_title: string;
  }>;
  total_causal_mentions: number;
  cause_ratio: number;
}

// =========================================================================
// TOPIC TYPES
// =========================================================================

export interface TopicResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  synthesis_count: number;
  entity_count: number;
  narrative_arc: 'emerging' | 'developing' | 'peak' | 'declining' | 'resolved';
  days_tracked: number;
  is_active: boolean;
  last_updated: string | null;
  preview_entities: string[];
}

export interface TopicDetailResponse extends TopicResponse {
  keywords: string[];
  synthesis_ids: string[];
  entity_ids: string[];
  first_seen: string | null;
  hot_score: number;
}

// =========================================================================
// CAUSAL GRAPH TYPES
// =========================================================================

export interface TimelineLayer {
  period: string;
  start_time: number;
  end_time: number;
  node_ids: string[];
  edge_ids: string[];
}

export interface CausalNode {
  id: string;
  label: string;
  node_type: string;
  fact_density: number;
  mention_count: number;
  source_syntheses: string[];
}

export interface CausalEdge {
  id: string;
  cause_text: string;
  effect_text: string;
  relation_type: string;
  confidence: number;
  mention_count: number;
  source_syntheses: string[];
}

export interface TopicCausalGraphResponse {
  topic_id: string;
  topic_name: string;
  nodes: CausalNode[];
  edges: CausalEdge[];
  timeline_layers: TimelineLayer[];
  central_entities: string[];
  narrative_arc: string;
  total_syntheses: number;
}

export interface TopicTimelineResponse {
  topic_id: string;
  topic_name: string;
  syntheses: Array<{
    id: string;
    title: string;
    created_at: string;
    summary: string;
  }>;
  timeline_layers: TimelineLayer[];
}

// =========================================================================
// GLOBAL GRAPH TYPES
// =========================================================================

export interface GlobalGraphNode {
  id: string;
  label: string;
  node_type: 'topic' | 'entity';
  weight: number;
  category: string;
}

export interface GlobalGraphEdge {
  source: string;
  target: string;
  weight: number;
  edge_type: string;
}

export interface GlobalGraphResponse {
  nodes: GlobalGraphNode[];
  edges: GlobalGraphEdge[];
  stats: {
    total_topics: number;
    total_entities: number;
    total_syntheses: number;
  };
}

// =========================================================================
// LIST RESPONSES
// =========================================================================

export interface TopicsListResponse {
  topics: TopicResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface EntitiesListResponse {
  entities: EntityResponse[];
  total: number;
  page: number;
  limit: number;
}

// =========================================================================
// STATS TYPES
// =========================================================================

export interface IntelligenceStats {
  total_topics: number;
  active_topics: number;
  total_entities: number;
  entities_by_type: Record<string, number>;
  topics_by_category: Record<string, number>;
  topics_by_arc: Record<string, number>;
}
