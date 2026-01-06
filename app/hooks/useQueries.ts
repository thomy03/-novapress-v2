'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient, API_CONFIG } from '../lib/api/client';

// Types
interface Synthesis {
  id: string;
  title: string;
  summary: string;
  introduction?: string;
  body?: string;
  category?: string;
  sources?: string[];
  sourceArticles?: Array<{ name: string; url: string; title?: string }>;
  num_sources?: number;
  created_at?: string;
  keyPoints?: string[];
  analysis?: string;
  readingTime?: number;
  causal_graph?: unknown;
  timeline_preview?: unknown;
}

interface Article {
  id: string;
  title: string;
  content?: string;
  summary?: string;
  source?: { name: string; url?: string };
  published_at?: string;
  image_url?: string;
  category?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

// Query Keys - centralized for cache invalidation
export const queryKeys = {
  syntheses: {
    all: ['syntheses'] as const,
    lists: () => [...queryKeys.syntheses.all, 'list'] as const,
    list: (params: { page?: number; limit?: number; category?: string }) =>
      [...queryKeys.syntheses.lists(), params] as const,
    details: () => [...queryKeys.syntheses.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.syntheses.details(), id] as const,
    breaking: () => [...queryKeys.syntheses.all, 'breaking'] as const,
    live: (hours?: number) => [...queryKeys.syntheses.all, 'live', hours] as const,
    category: (cat: string) => [...queryKeys.syntheses.all, 'category', cat] as const,
  },
  articles: {
    all: ['articles'] as const,
    lists: () => [...queryKeys.articles.all, 'list'] as const,
    list: (params: { page?: number; limit?: number }) =>
      [...queryKeys.articles.lists(), params] as const,
    details: () => [...queryKeys.articles.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.articles.details(), id] as const,
  },
  trending: {
    all: ['trending'] as const,
    categories: () => [...queryKeys.trending.all, 'categories'] as const,
    liveCount: () => [...queryKeys.trending.all, 'liveCount'] as const,
  },
};

// Fetch functions
async function fetchSyntheses(params: { page?: number; limit?: number; category?: string } = {}) {
  const { page = 1, limit = 10, category } = params;
  let url = `${API_CONFIG.ENDPOINTS.SYNTHESES}?page=${page}&limit=${limit}`;
  if (category) url += `&category=${category}`;
  return apiClient.get<PaginatedResponse<Synthesis>>(url);
}

async function fetchSynthesisById(id: string) {
  return apiClient.get<Synthesis>(`${API_CONFIG.ENDPOINTS.SYNTHESES}by-id/${id}`);
}

async function fetchBreakingSyntheses() {
  return apiClient.get<Synthesis[]>(`${API_CONFIG.ENDPOINTS.SYNTHESES}breaking`);
}

async function fetchLiveSyntheses(hours: number = 24) {
  return apiClient.get<Synthesis[]>(`${API_CONFIG.ENDPOINTS.SYNTHESES}live?hours=${hours}`);
}

async function fetchSynthesesByCategory(category: string) {
  return apiClient.get<Synthesis[]>(`${API_CONFIG.ENDPOINTS.SYNTHESES}category/${category}`);
}

async function fetchArticles(params: { page?: number; limit?: number } = {}) {
  const { page = 1, limit = 10 } = params;
  return apiClient.get<PaginatedResponse<Article>>(
    `${API_CONFIG.ENDPOINTS.ARTICLES}?page=${page}&limit=${limit}`
  );
}

async function fetchArticleById(id: string) {
  return apiClient.get<Article>(`${API_CONFIG.ENDPOINTS.ARTICLES}${id}`);
}

async function fetchTrendingCategories() {
  return apiClient.get<Array<{ category: string; count: number }>>(
    `${API_CONFIG.ENDPOINTS.TRENDING}categories`
  );
}

async function fetchLiveCount() {
  return apiClient.get<{ count: number }>(`${API_CONFIG.ENDPOINTS.TRENDING}live-count`);
}

// React Query Hooks

/**
 * Fetch paginated syntheses with caching
 */
export function useSyntheses(params: { page?: number; limit?: number; category?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.syntheses.list(params),
    queryFn: () => fetchSyntheses(params),
  });
}

/**
 * Fetch single synthesis by ID with caching
 * Returns cached data immediately if available
 */
export function useSynthesis(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.syntheses.detail(id || ''),
    queryFn: () => fetchSynthesisById(id!),
    enabled: !!id, // Only fetch if id is provided
    staleTime: 10 * 60 * 1000, // Synthesis data is stable, cache for 10 min
  });
}

/**
 * Fetch breaking news syntheses
 */
export function useBreakingSyntheses() {
  return useQuery({
    queryKey: queryKeys.syntheses.breaking(),
    queryFn: fetchBreakingSyntheses,
    staleTime: 2 * 60 * 1000, // Breaking news should refresh more often (2 min)
  });
}

/**
 * Fetch live syntheses (last N hours)
 */
export function useLiveSyntheses(hours: number = 24) {
  return useQuery({
    queryKey: queryKeys.syntheses.live(hours),
    queryFn: () => fetchLiveSyntheses(hours),
    staleTime: 60 * 1000, // Live data refreshes every minute
  });
}

/**
 * Fetch syntheses by category
 */
export function useSynthesesByCategory(category: string) {
  return useQuery({
    queryKey: queryKeys.syntheses.category(category),
    queryFn: () => fetchSynthesesByCategory(category),
    enabled: !!category,
  });
}

/**
 * Fetch paginated articles with caching
 */
export function useArticles(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.articles.list(params),
    queryFn: () => fetchArticles(params),
  });
}

/**
 * Fetch single article by ID with caching
 */
export function useArticle(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.articles.detail(id || ''),
    queryFn: () => fetchArticleById(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // Article data is stable
  });
}

/**
 * Fetch trending categories
 */
export function useTrendingCategories() {
  return useQuery({
    queryKey: queryKeys.trending.categories(),
    queryFn: fetchTrendingCategories,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch live count for badge
 */
export function useLiveCount() {
  return useQuery({
    queryKey: queryKeys.trending.liveCount(),
    queryFn: fetchLiveCount,
    staleTime: 60 * 1000, // Refresh every minute
    refetchInterval: 60 * 1000, // Auto-refetch
  });
}
