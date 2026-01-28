import { API_CONFIG } from '../config';
import { apiClient } from '../client';
import {
  TopicsListResponse,
  TopicDetailResponse,
  TopicCausalGraphResponse,
  TopicTimelineResponse,
  EntitiesListResponse,
  EntityDetailResponse,
  EntityCausalProfile,
  GlobalGraphResponse,
  IntelligenceStats,
  TopicResponse,
  EntitySearchResult,
} from '@/app/types/intelligence';

export const intelligenceService = {
  // =========================================================================
  // TOPICS
  // =========================================================================

  /**
   * Get list of topics with pagination
   */
  async getTopics(params?: {
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<TopicsListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.category) queryParams.append('category', params.category);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const query = queryParams.toString();
    return apiClient.get<TopicsListResponse>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/topics${query ? `?${query}` : ''}`
    );
  },

  /**
   * Get hot/trending topics
   */
  async getHotTopics(limit: number = 5): Promise<TopicResponse[]> {
    return apiClient.get<TopicResponse[]>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/topics/hot?limit=${limit}`
    );
  },

  /**
   * Get topic detail by ID
   */
  async getTopicById(topicId: string): Promise<TopicDetailResponse> {
    return apiClient.get<TopicDetailResponse>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/topics/${topicId}`
    );
  },

  /**
   * Get aggregated causal graph for a topic
   */
  async getTopicCausalGraph(topicId: string): Promise<TopicCausalGraphResponse> {
    return apiClient.get<TopicCausalGraphResponse>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/topics/${topicId}/graph`
    );
  },

  /**
   * Get timeline of syntheses for a topic
   */
  async getTopicTimeline(topicId: string): Promise<TopicTimelineResponse> {
    return apiClient.get<TopicTimelineResponse>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/topics/${topicId}/timeline`
    );
  },

  // =========================================================================
  // ENTITIES
  // =========================================================================

  /**
   * Get list of entities with pagination
   */
  async getEntities(params?: {
    entity_type?: string;
    page?: number;
    limit?: number;
  }): Promise<EntitiesListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.entity_type) queryParams.append('entity_type', params.entity_type);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const query = queryParams.toString();
    return apiClient.get<EntitiesListResponse>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/entities${query ? `?${query}` : ''}`
    );
  },

  /**
   * Search entities by name
   */
  async searchEntities(
    query: string,
    limit: number = 10
  ): Promise<EntitySearchResult[]> {
    return apiClient.get<EntitySearchResult[]>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/entities/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
  },

  /**
   * Get entity detail by ID
   */
  async getEntityById(entityId: string): Promise<EntityDetailResponse> {
    return apiClient.get<EntityDetailResponse>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/entities/${entityId}`
    );
  },

  /**
   * Get causal profile for an entity
   */
  async getEntityCausalProfile(entityId: string): Promise<EntityCausalProfile> {
    return apiClient.get<EntityCausalProfile>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/entities/${entityId}/graph`
    );
  },

  // =========================================================================
  // GLOBAL
  // =========================================================================

  /**
   * Get global overview graph of all topics and entities
   */
  async getGlobalGraph(params?: {
    limit_topics?: number;
    limit_entities?: number;
  }): Promise<GlobalGraphResponse> {
    const queryParams = new URLSearchParams();
    if (params?.limit_topics) queryParams.append('limit_topics', params.limit_topics.toString());
    if (params?.limit_entities) queryParams.append('limit_entities', params.limit_entities.toString());

    const query = queryParams.toString();
    return apiClient.get<GlobalGraphResponse>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/global-graph${query ? `?${query}` : ''}`
    );
  },

  /**
   * Get Intelligence Hub statistics
   */
  async getStats(): Promise<IntelligenceStats> {
    return apiClient.get<IntelligenceStats>(
      `${API_CONFIG.ENDPOINTS.INTELLIGENCE}/stats`
    );
  },
};
