export interface Article {
  id: string;
  title: string;
  summary: string;
  content?: string;
  category: string;
  imageUrl: string;
  publishedAt: string;
  source: string;
  author?: string;
  url?: string;
  // New backend aligned fields
  aiGenerated?: boolean; 
  originalLanguage?: string;
  complianceScore?: number;
  readingTime?: number;
  clusterId?: number;
}

export type Theme = 'light' | 'dark';

export interface ArticlesState {
  articles: Article[];
  loading: boolean;
  error: string | null;
  trending: Article[];
}

export type PipelineStep = 'IDLE' | 'COLLECTING' | 'TRANSLATING' | 'EMBEDDING' | 'CLUSTERING' | 'BUILDING_GRAPH' | 'GENERATING' | 'COMPLIANCE' | 'COMPLETED';

export interface PipelineLog {
  id: string;
  timestamp: string;
  message: string;
  step: PipelineStep;
  type: 'info' | 'success' | 'warning' | 'error';
}

// GraphRAG Types
export interface GraphNode {
  id: string;
  label: string;
  type: 'PERSON' | 'ORG' | 'LOCATION' | 'EVENT' | 'TOPIC';
  val: number; // Size/Importance
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string; // Relationship type (e.g., "IS_CEO_OF")
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}