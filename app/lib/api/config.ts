// In production (non-localhost), use relative/dynamic URLs so any domain works without rebuilding.
// In dev (localhost), fall back to explicit local addresses.
const _isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const _wsProto = typeof window !== 'undefined' ? (window.location.protocol === 'https:' ? 'wss:' : 'ws:') : 'ws:';
const _wsHost = typeof window !== 'undefined' ? window.location.host : 'localhost:5000';

export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || (_isLocalhost ? 'http://localhost:5000' : ''),
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || (_isLocalhost ? 'ws://localhost:5000' : `${_wsProto}//${_wsHost}`),
  ENDPOINTS: {
    ARTICLES: '/api/articles',
    TRENDING: '/api/trending',
    SYNTHESIS: '/api/syntheses',
    SYNTHESES: '/api/syntheses/',
    TIME_TRAVELER: '/api/time-traveler/',
    CAUSAL: '/api/causal',
    INTELLIGENCE: '/api/intelligence',
    ADMIN: '/api/admin/',
    SEARCH: '/api/search',
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      REFRESH: '/api/auth/refresh',
      LOGOUT: '/api/auth/logout',
      PROFILE: '/api/auth/profile'
    },
    CATEGORIES: '/api/categories',
    SOURCES: '/api/sources',
    PREFERENCES: '/api/preferences'
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
  INTELLIGENCE_TOPICS: 'intelligence-topics',
  INTELLIGENCE_TOPIC: 'intelligence-topic',
  INTELLIGENCE_TOPIC_GRAPH: 'intelligence-topic-graph',
  INTELLIGENCE_ENTITIES: 'intelligence-entities',
  INTELLIGENCE_ENTITY: 'intelligence-entity',
  INTELLIGENCE_GLOBAL_GRAPH: 'intelligence-global-graph',
  INTELLIGENCE_STATS: 'intelligence-stats',
  ADMIN_STATUS: 'admin-status',
  ADMIN_STATS: 'admin-stats',
  ADMIN_SOURCES: 'admin-sources',
  SEARCH: 'search',
  USER: 'user',
  CATEGORIES: 'categories',
  SOURCES: 'sources',
  PREFERENCES: 'preferences'
} as const;