// Types for Time-Traveler feature - Historical context for syntheses

export type NarrativePhase = 'emerging' | 'developing' | 'peak' | 'declining' | 'resolved';
export type EntityType = 'person' | 'organization' | 'location';
export type ContradictionType = 'factual' | 'temporal' | 'sentiment';
export type EntityTrend = 'new' | 'constant' | 'declining';
export type TimelineStatus = 'evolving' | 'resolved';

export interface TimelineEvent {
  date: string;
  title: string;
  summary: string;
  narrative_phase: NarrativePhase;
  fact_density: number;
  sources: string[];
  synthesis_id: string;
  similarity: number;
}

export interface EntityEvolutionItem {
  entity_name: string;
  entity_type: EntityType;
  first_appearance: string;
  mentions: string[];
  trend: EntityTrend;
}

export interface ContradictionItem {
  date: string;
  type: ContradictionType;
  claim_a: string;
  claim_b: string;
  source_a: string;
  source_b: string;
}

export interface TimelineResponse {
  synthesis_id: string;
  current_title: string;
  timeline: TimelineEvent[];
  narrative_arc: NarrativePhase;
  days_tracked: number;
  entity_evolution: EntityEvolutionItem[];
  contradictions: ContradictionItem[];
  status: TimelineStatus;
  previous_key_points: string[];
}

export interface TimelinePreviewResponse {
  synthesis_id: string;
  narrative_arc: NarrativePhase;
  days_tracked: number;
  recent_events: TimelineEvent[];
  status: TimelineStatus;
  has_contradictions: boolean;
}

// Phase display configuration (Newspaper style - black/grey)
export const PHASE_CONFIG: Record<NarrativePhase, {
  label: string;
  labelFr: string;
  color: string;
  bgColor: string;
  icon: string;
}> = {
  emerging: {
    label: 'Emerging',
    labelFr: 'Émergent',
    color: '#374151',
    bgColor: '#F3F4F6',
    icon: '●'
  },
  developing: {
    label: 'Developing',
    labelFr: 'En cours',
    color: '#000000',
    bgColor: '#E5E5E5',
    icon: '●●'
  },
  peak: {
    label: 'Peak',
    labelFr: 'Pic',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    icon: '●●●'
  },
  declining: {
    label: 'Declining',
    labelFr: 'En déclin',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: '○'
  },
  resolved: {
    label: 'Resolved',
    labelFr: 'Résolu',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: '✓'
  }
};

// Entity type display configuration
export const ENTITY_TYPE_CONFIG: Record<EntityType, {
  label: string;
  labelFr: string;
  icon: string;
}> = {
  person: {
    label: 'Person',
    labelFr: 'Personne',
    icon: '👤'
  },
  organization: {
    label: 'Organization',
    labelFr: 'Organisation',
    icon: '🏢'
  },
  location: {
    label: 'Location',
    labelFr: 'Lieu',
    icon: '📍'
  }
};
