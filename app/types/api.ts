export interface Article {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  summary: string;
  author?: string;
  source: NewsSource;
  publishedAt: string;
  updatedAt?: string;
  imageUrl?: string;
  imageCaption?: string;
  category: Category;
  tags: string[];
  readTime: number;
  viewCount: number;
  isBreaking?: boolean;
  isFeatured?: boolean;
  relatedArticles?: string[];
  embeddings?: number[];
  url?: string;  // Original article URL
}

export interface NewsSource {
  id: string;
  name: string;
  domain?: string;
  url?: string;
  logo?: string;
  credibilityScore?: number;
  credibility?: number;
  bias?: 'left' | 'center-left' | 'center' | 'center-right' | 'right';
  type?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  color?: string;
  icon?: string;
  priority?: number;
}

export interface TrendingTopic {
  id: string;
  topic: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  percentageChange?: number;
  articles: Article[];
  sentiment?: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export interface ArticleSynthesis {
  id: string;
  topicId: string;
  title: string;
  summary: string;
  keyPoints: string[];
  sources: NewsSource[];
  articles: Article[];
  generatedAt: string;
  conflictingViews?: {
    source: NewsSource;
    viewpoint: string;
  }[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
  createdAt: string;
  lastLogin?: string;
  subscription?: {
    type: 'free' | 'premium' | 'enterprise';
    expiresAt?: string;
  };
}

export interface UserPreferences {
  categories: string[];
  sources: string[];
  language: string;
  notifications: {
    breaking: boolean;
    daily: boolean;
    weekly: boolean;
  };
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
}

export interface SearchQuery {
  q: string;
  categories?: string[];
  sources?: string[];
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'relevance' | 'date' | 'popularity';
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  lastUpdate: string;
}

// ========== Syntheses Types ==========

export interface SourceArticle {
  name: string;
  url: string;
  title: string;
}

export interface Synthesis {
  id: string;
  title: string;
  summary: string;
  introduction: string;
  body: string;
  analysis: string;
  keyPoints: string[];
  sources: string[];
  sourceArticles: SourceArticle[];
  numSources: number;
  clusterId: number;
  complianceScore: number;
  readingTime: number;
  createdAt: string;
  category: SynthesisCategory;
  categoryConfidence: number;
  type: 'synthesis';
}

export type SynthesisCategory =
  | 'MONDE'
  | 'TECH'
  | 'ECONOMIE'
  | 'POLITIQUE'
  | 'CULTURE'
  | 'SPORT'
  | 'SCIENCES';

export interface SynthesesResponse {
  data: Synthesis[];
  total: number;
  type: string;
}

export interface BreakingSynthesesResponse {
  data: Synthesis[];
  total: number;
  type: 'breaking';
}

export interface LiveSynthesesResponse {
  data: Synthesis[];
  total: number;
  hours: number;
  type: 'live';
}

export interface CategorySynthesesResponse {
  data: Synthesis[];
  total: number;
  category: SynthesisCategory;
  type: 'category';
}

// ========== Trending Types ==========

export interface TrendingTopicNew {
  topic: string;
  count: number;
  category: SynthesisCategory;
  synthesisCount: number;
  synthesisIds: string[];
}

export interface TrendingTopicsResponse {
  data: TrendingTopicNew[];
  total: number;
  hours: number;
  type: 'trending';
}

export interface CategoryStats {
  name: SynthesisCategory;
  displayName: string;
  count: number;
  latestAt: string;
  isHot: boolean;
  recentTitles: string[];
}

export interface CategoriesStatsResponse {
  data: CategoryStats[];
  total: number;
  hours: number;
  type: 'categories';
}

export interface LiveCountResponse {
  count: number;
  hours: number;
  type: 'live-count';
}

// ========== Persona Types ==========

export interface PersonaInfo {
  id: string;
  name: string;
  displayName: string;
  tone?: string;
  style?: string;
  signature?: string;
}

export interface RelatedSynthesis {
  id: string;
  title: string;
  similarity: number;
}

// ========== Causal Graph Types ==========

export interface CausalNode {
  id: string;
  label: string;
  type: 'event' | 'entity' | 'decision';
  date?: string;
  factDensity?: number;
}

export interface CausalEdge {
  source: string;
  target: string;
  type: 'causes' | 'triggers' | 'enables' | 'prevents';
  confidence: number;
  evidence?: string[];
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  centralEntity?: string;
  narrativeFlow?: 'linear' | 'branching' | 'circular';
}

// ========== Timeline Types ==========

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  synthesisId?: string;
}

export interface TimelineData {
  events: TimelineEvent[];
  startDate: string;
  endDate: string;
}