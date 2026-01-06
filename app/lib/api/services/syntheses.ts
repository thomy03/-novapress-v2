import { API_CONFIG } from '../config';
import { apiClient } from '../client';
import {
  Synthesis,
  SynthesesResponse,
  BreakingSynthesesResponse,
  LiveSynthesesResponse,
  CategorySynthesesResponse,
  SynthesisCategory,
  TrendingTopicsResponse,
  CategoriesStatsResponse,
  LiveCountResponse
} from '@/app/types/api';

export const synthesesService = {
  /**
   * Get latest syntheses
   */
  async getSyntheses(limit: number = 10): Promise<SynthesesResponse> {
    return apiClient.get<SynthesesResponse>(
      API_CONFIG.ENDPOINTS.SYNTHESES,
      { limit }
    );
  },

  /**
   * Get a single synthesis by ID
   */
  async getSynthesis(id: string): Promise<Synthesis> {
    return apiClient.get<Synthesis>(`${API_CONFIG.ENDPOINTS.SYNTHESES}/by-id/${id}`);
  },

  /**
   * Get breaking news syntheses (for news ticker)
   */
  async getBreakingSyntheses(limit: number = 5): Promise<BreakingSynthesesResponse> {
    return apiClient.get<BreakingSynthesesResponse>(
      `${API_CONFIG.ENDPOINTS.SYNTHESES}/breaking`,
      { limit }
    );
  },

  /**
   * Get live syntheses from last X hours (for EN DIRECT page)
   */
  async getLiveSyntheses(hours: number = 24, limit: number = 50): Promise<LiveSynthesesResponse> {
    return apiClient.get<LiveSynthesesResponse>(
      `${API_CONFIG.ENDPOINTS.SYNTHESES}/live`,
      { hours, limit }
    );
  },

  /**
   * Get syntheses filtered by category
   */
  async getSynthesesByCategory(
    category: SynthesisCategory,
    limit: number = 20
  ): Promise<CategorySynthesesResponse> {
    return apiClient.get<CategorySynthesesResponse>(
      `${API_CONFIG.ENDPOINTS.SYNTHESES}/category/${category}`,
      { limit }
    );
  },

  /**
   * Get trending topics from recent syntheses
   */
  async getTrendingTopics(hours: number = 24, limit: number = 10): Promise<TrendingTopicsResponse> {
    return apiClient.get<TrendingTopicsResponse>(
      API_CONFIG.ENDPOINTS.TRENDING,
      { hours, limit }
    );
  },

  /**
   * Get category statistics
   */
  async getCategoriesStats(hours: number = 24): Promise<CategoriesStatsResponse> {
    return apiClient.get<CategoriesStatsResponse>(
      `${API_CONFIG.ENDPOINTS.TRENDING}/categories`,
      { hours }
    );
  },

  /**
   * Get live count (number of syntheses in last X hours)
   */
  async getLiveCount(hours: number = 24): Promise<LiveCountResponse> {
    return apiClient.get<LiveCountResponse>(
      `${API_CONFIG.ENDPOINTS.TRENDING}/live-count`,
      { hours }
    );
  }
};
