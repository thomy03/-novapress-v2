import { API_CONFIG } from '../config';
import { apiClient } from '../client';
import {
  CausalGraphResponse,
  CausalPreviewResponse,
  EntityCausalProfileResponse,
  CausalStatsResponse,
  HistoricalCausalGraphResponse,
  PredictionsResponse
} from '@/app/types/causal';

export const causalService = {
  /**
   * Get complete causal graph for a synthesis
   * Returns pre-computed causal relationships (0 LLM calls)
   */
  async getCausalGraph(synthesisId: string): Promise<CausalGraphResponse> {
    return apiClient.get<CausalGraphResponse>(
      `${API_CONFIG.ENDPOINTS.CAUSAL}/syntheses/${synthesisId}/causal-graph`
    );
  },

  /**
   * Get historical causal graph showing how past events led to current synthesis
   * Returns multi-layer DAG with branches and inter-layer connections
   *
   * @param synthesisId - The current synthesis ID
   * @param maxDepth - Maximum number of related syntheses to include (default: 5)
   * @returns Multi-layer graph with inter-synthesis "leads_to" connections
   */
  async getHistoricalGraph(synthesisId: string, maxDepth: number = 5): Promise<HistoricalCausalGraphResponse> {
    return apiClient.get<HistoricalCausalGraphResponse>(
      `${API_CONFIG.ENDPOINTS.CAUSAL}/syntheses/${synthesisId}/historical-graph?max_depth=${maxDepth}`
    );
  },

  /**
   * Get compact causal preview for sidebar/card display
   * Returns only essential data for quick display
   */
  async getCausalPreview(synthesisId: string, maxRelations: number = 3): Promise<CausalPreviewResponse> {
    return apiClient.get<CausalPreviewResponse>(
      `${API_CONFIG.ENDPOINTS.CAUSAL}/syntheses/${synthesisId}/causal-preview?max_relations=${maxRelations}`
    );
  },

  /**
   * Get causal profile for an entity across all syntheses
   * Shows how many times the entity appears as cause vs effect
   */
  async getEntityCausalProfile(entityName: string, limit: number = 10): Promise<EntityCausalProfileResponse> {
    return apiClient.get<EntityCausalProfileResponse>(
      `${API_CONFIG.ENDPOINTS.CAUSAL}/entities/${encodeURIComponent(entityName)}/causal-profile?limit=${limit}`
    );
  },

  /**
   * Get overall causal graph statistics
   * Useful for dashboard displays and monitoring
   */
  async getCausalStats(): Promise<CausalStatsResponse> {
    return apiClient.get<CausalStatsResponse>(
      `${API_CONFIG.ENDPOINTS.CAUSAL}/stats`
    );
  },

  /**
   * Get predictions/future scenarios for a synthesis (Phase 7)
   * Returns pre-computed predictions generated during synthesis creation
   *
   * @param synthesisId - The synthesis ID
   * @returns Predictions with probability, type, timeframe, and rationale
   */
  async getPredictions(synthesisId: string): Promise<PredictionsResponse> {
    return apiClient.get<PredictionsResponse>(
      `${API_CONFIG.ENDPOINTS.CAUSAL}/syntheses/${synthesisId}/predictions`
    );
  },
};
