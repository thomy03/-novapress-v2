import { API_CONFIG } from '../config';
import { apiClient } from '../client';
import { Article, PaginatedResponse, SearchQuery } from '@/app/types/api';

export const articlesService = {
  async getArticles(params?: {
    page?: number;
    limit?: number;
    category?: string;
    featured?: boolean;
  }): Promise<PaginatedResponse<Article>> {
    return apiClient.get<PaginatedResponse<Article>>(
      API_CONFIG.ENDPOINTS.ARTICLES,
      params
    );
  },

  async getArticle(id: string): Promise<Article> {
    return apiClient.get<Article>(`${API_CONFIG.ENDPOINTS.ARTICLES}/${id}`);
  },

  async getFeaturedArticles(): Promise<Article[]> {
    const response = await apiClient.get<PaginatedResponse<Article>>(
      API_CONFIG.ENDPOINTS.ARTICLES,
      { featured: true, limit: 5 }
    );
    return response.data;
  },

  async getBreakingNews(): Promise<Article[]> {
    return apiClient.get<Article[]>(`${API_CONFIG.ENDPOINTS.ARTICLES}/breaking`);
  },

  async getArticlesByCategory(
    category: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Article>> {
    return apiClient.get<PaginatedResponse<Article>>(
      API_CONFIG.ENDPOINTS.ARTICLES,
      { ...params, category }
    );
  },

  async getRelatedArticles(id: string): Promise<Article[]> {
    return apiClient.get<Article[]>(
      `${API_CONFIG.ENDPOINTS.ARTICLES}/${id}/related`
    );
  },

  async searchArticles(query: string, params?: {
    category?: string;
    limit?: number;
  }): Promise<PaginatedResponse<Article>> {
    return apiClient.get<PaginatedResponse<Article>>(
      API_CONFIG.ENDPOINTS.SEARCH,
      { q: query, ...params }
    );
  },

  async incrementViewCount(id: string): Promise<void> {
    return apiClient.post(`${API_CONFIG.ENDPOINTS.ARTICLES}/${id}/view`);
  },
};