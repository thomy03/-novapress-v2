export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000',
  ENDPOINTS: {
    ARTICLES: '/api/v1/articles',
    TRENDING: '/api/v1/trending',
    SYNTHESIS: '/api/v1/synthesis',
    SYNTHESES: '/api/v1/syntheses',
    TIME_TRAVELER: '/api/v1/time-traveler/',
    CAUSAL: '/api/v1/causal',
    ADMIN: '/api/v1/admin/',
    SEARCH: '/api/v1/search',
    AUTH: {
      LOGIN: '/api/v1/auth/login',
      REGISTER: '/api/v1/auth/register',
      REFRESH: '/api/v1/auth/refresh',
      LOGOUT: '/api/v1/auth/logout',
      PROFILE: '/api/v1/auth/profile'
    },
    CATEGORIES: '/api/v1/categories',
    SOURCES: '/api/v1/sources',
    PREFERENCES: '/api/v1/preferences'
  },
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

export const QUERY_KEYS = {
  ARTICLES: 'articles',
  ARTICLE: 'article',
  TRENDING: 'trending',
  SYNTHESIS: 'synthesis',
  SYNTHESES: 'syntheses',
  TIMELINE: 'timeline',
  TIMELINE_PREVIEW: 'timeline-preview',
  CAUSAL_GRAPH: 'causal-graph',
  CAUSAL_PREVIEW: 'causal-preview',
  CAUSAL_STATS: 'causal-stats',
  ENTITY_CAUSAL_PROFILE: 'entity-causal-profile',
  ADMIN_STATUS: 'admin-status',
  ADMIN_STATS: 'admin-stats',
  ADMIN_SOURCES: 'admin-sources',
  SEARCH: 'search',
  USER: 'user',
  CATEGORIES: 'categories',
  SOURCES: 'sources',
  PREFERENCES: 'preferences'
} as const;