// Types pour la gestion des articles NovaPress AI

// REF-011: Import and re-export consolidated Category from api.ts
import type { Category } from './api';
export type { Category };

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color?: string;
  count?: number;
}

export interface Author {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  bio?: string;
  role?: string;
}

export interface ArticleSource {
  id: string;
  name: string;
  url: string;
  credibility?: number; // 0-100
  type: 'rss' | 'api' | 'scraper' | 'manual' | 'ai-generated';
}

export interface Article {
  id: string;
  
  // Contenu principal
  title: string;
  subtitle?: string;
  content: string;
  summary: string;
  
  // Métadonnées
  slug: string;
  status: 'draft' | 'published' | 'archived' | 'pending';
  publishedAt?: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  
  // Classification
  category: Category;
  tags: Tag[];
  keywords?: string[];
  
  // Auteur et source
  author?: Author;
  source?: ArticleSource;
  originalUrl?: string;
  
  // Médias
  featuredImage?: string;
  images?: string[];
  videos?: string[];
  
  // Engagement
  viewCount?: number;
  shareCount?: number;
  likeCount?: number;
  commentCount?: number;
  readingTime?: number; // en minutes
  
  // IA et analyse
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
  aiSummary?: string;
  aiTags?: Tag[];
  relevanceScore?: number; // 0-100
  factCheckStatus?: 'verified' | 'unverified' | 'disputed' | 'false';
  language?: string;
  trending?: boolean;
  
  // SEO
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;

  // AI Synthesis fields (present when article is a synthesis)
  complianceScore?: number;
  timeline_events?: Array<{ date: string; event: string; sources?: string[] }>;
  narrative_arc?: 'emerging' | 'developing' | 'peak' | 'declining' | 'resolved';
  causal_graph?: { nodes: Array<{ id: string; label: string }>; edges: Array<{ source: string; target: string; label?: string }> };
  causal_chain?: Array<{ cause: string; effect: string; type?: string }>;
}

export interface ArticleCluster {
  id: string;
  title: string;
  description: string;
  articles: Article[];
  tags: Tag[];
  createdAt: Date | string;
  similarity: number; // 0-1
  trending?: boolean;
}

export interface ArticleFilters {
  categories?: string[];
  tags?: string[];
  authors?: string[];
  sources?: string[];
  dateFrom?: Date | string;
  dateTo?: Date | string;
  status?: Article['status'];
  language?: string;
  sentiment?: Article['sentiment'];
  search?: string;
  sortBy?: 'date' | 'relevance' | 'popularity' | 'readingTime';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ArticleStats {
  totalArticles: number;
  publishedToday: number;
  totalViews: number;
  avgReadingTime: number;
  topCategories: { category: Category; count: number }[];
  topTags: { tag: Tag; count: number }[];
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
}