// Centralized exports for all hooks
export { useInfiniteScroll } from './useInfiniteScroll';
export { useDebounce, useDebouncedCallback } from './useDebounce';
export { useLocalStorage } from './useLocalStorage';
export {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsDarkMode,
  useReducedMotion
} from './useMediaQuery';
export { useServiceWorker } from './useServiceWorker';
export { usePerformanceMonitoring } from './usePerformanceMonitoring';
export { useBookmarks } from './useBookmarks';

// React Query hooks for cached data fetching
export {
  useSyntheses,
  useSynthesis,
  useBreakingSyntheses,
  useLiveSyntheses,
  useSynthesesByCategory,
  useArticles,
  useArticle,
  useTrendingCategories,
  useLiveCount,
  queryKeys,
} from './useQueries';