import { API_CONFIG } from '../config';
import { apiClient } from '../client';
import { TrendingTopic, ArticleSynthesis } from '@/app/types/api';

export const trendingService = {
  async getTrendingTopics(limit: number = 10): Promise<TrendingTopic[]> {
    return apiClient.get<TrendingTopic[]>(
      API_CONFIG.ENDPOINTS.TRENDING,
      { limit }
    );
  },

  async getTrendingTopic(id: string): Promise<TrendingTopic> {
    return apiClient.get<TrendingTopic>(`${API_CONFIG.ENDPOINTS.TRENDING}/${id}`);
  },

  async getSynthesis(topicId: string): Promise<ArticleSynthesis> {
    return apiClient.get<ArticleSynthesis>(
      `${API_CONFIG.ENDPOINTS.SYNTHESIS}/${topicId}`
    );
  },

  async generateSynthesis(articleIds: string[]): Promise<ArticleSynthesis> {
    return apiClient.post<ArticleSynthesis>(
      API_CONFIG.ENDPOINTS.SYNTHESIS,
      { articleIds }
    );
  },

  async getTrendingByCategory(category: string): Promise<TrendingTopic[]> {
    return apiClient.get<TrendingTopic[]>(
      `${API_CONFIG.ENDPOINTS.TRENDING}/category/${category}`
    );
  },
};