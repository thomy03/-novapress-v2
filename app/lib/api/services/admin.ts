import { API_CONFIG } from '../config';
import { apiClient } from '../client';

export interface PipelineRequest {
  mode: 'SCRAPE' | 'TOPIC' | 'SIMULATION';
  sources?: string[];
  topics?: string[];
  max_articles_per_source?: number;
}

export interface PipelineResponse {
  status: string;
  message: string;
  pipeline_id?: string;
  started_at?: string;
}

export interface PipelineStatus {
  is_running: boolean;
  current_step: string | null;
  progress: number;
  last_run: string | null;
  last_result: {
    raw_articles?: number;
    unique_articles?: number;
    clusters?: number;
    syntheses?: number;
    duration?: number;
    completed_at?: string;
    error?: string;
  } | null;
}

export interface AdminStats {
  articles: {
    total: number;
    error?: string;
  };
  syntheses: {
    total: number;
  };
  pipeline: {
    last_run: string | null;
    last_result: PipelineStatus['last_result'];
  };
}

export interface NewsSource {
  name: string;
  domain?: string;
  type?: string;
  status: string;
}

export interface SourcesResponse {
  news_sources: NewsSource[];
  alternative_sources: NewsSource[];
  total_sources: number;
}

export const adminService = {
  /**
   * Get pipeline status (no auth required)
   */
  async getStatus(): Promise<PipelineStatus> {
    return apiClient.get<PipelineStatus>(
      `${API_CONFIG.ENDPOINTS.ADMIN}status`
    );
  },

  /**
   * Start the pipeline (requires admin key) - NEW endpoint
   */
  async startPipeline(request: PipelineRequest, adminKey: string): Promise<PipelineResponse> {
    return apiClient.post<PipelineResponse>(
      `${API_CONFIG.ENDPOINTS.ADMIN}pipeline/start`,
      request,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
  },

  /**
   * Start the pipeline (requires admin key) - Legacy endpoint
   */
  async runPipeline(request: PipelineRequest, adminKey: string): Promise<PipelineResponse> {
    return apiClient.post<PipelineResponse>(
      `${API_CONFIG.ENDPOINTS.ADMIN}pipeline/run`,
      request,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
  },

  /**
   * Stop the pipeline (requires admin key)
   */
  async stopPipeline(adminKey: string): Promise<{ status: string; message: string }> {
    return apiClient.post(
      `${API_CONFIG.ENDPOINTS.ADMIN}pipeline/stop`,
      {},
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
  },

  /**
   * Get admin statistics (requires admin key)
   */
  async getStats(adminKey: string): Promise<AdminStats> {
    return apiClient.get<AdminStats>(
      `${API_CONFIG.ENDPOINTS.ADMIN}stats`,
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
  },

  /**
   * Get available sources (no auth required)
   */
  async getSources(): Promise<SourcesResponse> {
    return apiClient.get<SourcesResponse>(
      `${API_CONFIG.ENDPOINTS.ADMIN}sources`
    );
  },

  /**
   * Get pipeline logs (no auth required)
   */
  async getLogs(limit: number = 100, offset: number = 0): Promise<{ logs: any[]; total: number }> {
    return apiClient.get(
      `${API_CONFIG.ENDPOINTS.ADMIN}logs?limit=${limit}&offset=${offset}`
    );
  },

  /**
   * Reset pipeline lock (requires admin key)
   * Use this if the pipeline is stuck and won't start
   */
  async resetPipelineLock(adminKey: string): Promise<{
    local_status_before: string;
    local_status_after: string;
    redis_lock_existed: boolean;
    redis_lock_value?: string;
    actions: string[];
    message: string;
  }> {
    return apiClient.post(
      `${API_CONFIG.ENDPOINTS.ADMIN}pipeline/reset-lock`,
      {},
      {
        headers: {
          'x-admin-key': adminKey
        }
      }
    );
  },

  /**
   * Debug pipeline state (no auth required)
   * Returns detailed info about local and Redis state
   */
  async debugPipeline(): Promise<{
    local_state: {
      status: string;
      is_running: boolean;
      progress: number;
      current_step: string | null;
      cancel_requested: boolean;
    };
    redis: {
      available: boolean;
      lock_exists?: boolean;
      lock_value?: string;
      lock_ttl?: number;
      error?: string;
    };
    can_start: boolean;
  }> {
    return apiClient.get(
      `${API_CONFIG.ENDPOINTS.ADMIN}pipeline/debug`
    );
  }
};
