import { API_CONFIG } from '../config';
import { apiClient } from '../client';
import { TimelineResponse, TimelinePreviewResponse } from '@/app/types/timeline';

export const timelineService = {
  /**
   * Get complete historical timeline for a synthesis
   * Includes: timeline events, narrative arc, entity evolution, contradictions
   */
  async getTimeline(synthesisId: string): Promise<TimelineResponse> {
    return apiClient.get<TimelineResponse>(
      `${API_CONFIG.ENDPOINTS.TIME_TRAVELER}syntheses/${synthesisId}/timeline`
    );
  },

  /**
   * Get compact timeline preview for sidebar display
   * Returns only the 3 most recent events and essential metadata
   */
  async getTimelinePreview(synthesisId: string): Promise<TimelinePreviewResponse> {
    return apiClient.get<TimelinePreviewResponse>(
      `${API_CONFIG.ENDPOINTS.TIME_TRAVELER}syntheses/${synthesisId}/preview`
    );
  },

  /**
   * Get detailed entity evolution for a synthesis
   * Tracks how key actors have been mentioned over time
   */
  async getEntityEvolution(synthesisId: string): Promise<{
    synthesis_id: string;
    entities: Record<string, string[]>;
    evolution: Record<string, string[]>;
    timeline_count: number;
  }> {
    return apiClient.get(
      `${API_CONFIG.ENDPOINTS.TIME_TRAVELER}syntheses/${synthesisId}/entities`
    );
  },
};
