"use client";

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Article, Tag } from '../types/Article';
import { 
  mockArticles, 
  mockTags, 
  mockCategories,
  filterArticlesByTags,
  filterArticlesByCategory,
  searchArticles,
  getPopularTags 
} from '../data/mockArticles';
import { useDebounce } from '../hooks/useDebounce';
import { articlesService } from '../lib/api/services';
import { Article as ApiArticle } from '../types/api';

interface ArticlesState {
  articles: Article[];
  // REF-006: filteredArticles removed from state - now computed via useMemo
  popularTags: Tag[];
  selectedTags: string[];
  selectedCategory: string;
  searchQuery: string;
  isLoading: boolean;
  articlesLoaded: number;
  hasMore: boolean;
  isApiAvailable: boolean;  // Track if API is available
}

type ArticlesAction =
  | { type: 'SET_ARTICLES'; payload: Article[] }
  // REF-006: SET_FILTERED_ARTICLES removed - filteredArticles now computed via useMemo
  | { type: 'SET_POPULAR_TAGS'; payload: Tag[] }
  | { type: 'SET_SELECTED_TAGS'; payload: string[] }
  | { type: 'ADD_TAG'; payload: string }
  | { type: 'REMOVE_TAG'; payload: string }
  | { type: 'TOGGLE_TAG'; payload: string }
  | { type: 'SET_CATEGORY'; payload: string }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOAD_MORE_ARTICLES' }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_API_AVAILABLE'; payload: boolean };

const initialState: ArticlesState = {
  articles: [],
  // REF-006: filteredArticles removed from initial state
  popularTags: [],
  selectedTags: [],
  selectedCategory: 'ACCUEIL',
  searchQuery: '',
  isLoading: false,
  articlesLoaded: 8,
  hasMore: true,
  isApiAvailable: false
};

function articlesReducer(state: ArticlesState, action: ArticlesAction): ArticlesState {
  switch (action.type) {
    case 'SET_ARTICLES':
      return { ...state, articles: action.payload };

    // REF-006: SET_FILTERED_ARTICLES case removed - computed via useMemo now

    case 'SET_POPULAR_TAGS':
      return { ...state, popularTags: action.payload };
    
    case 'SET_SELECTED_TAGS':
      return { ...state, selectedTags: action.payload };
    
    case 'ADD_TAG':
      return {
        ...state,
        selectedTags: state.selectedTags.includes(action.payload)
          ? state.selectedTags
          : [...state.selectedTags, action.payload]
      };
    
    case 'REMOVE_TAG':
      return {
        ...state,
        selectedTags: state.selectedTags.filter(id => id !== action.payload)
      };

    case 'TOGGLE_TAG':
      // Atomic toggle - reads and modifies state in a single operation
      return {
        ...state,
        selectedTags: state.selectedTags.includes(action.payload)
          ? state.selectedTags.filter(id => id !== action.payload)
          : [...state.selectedTags, action.payload]
      };

    case 'SET_CATEGORY':
      return { ...state, selectedCategory: action.payload, selectedTags: [] };
    
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'LOAD_MORE_ARTICLES':
      return {
        ...state,
        articlesLoaded: state.articlesLoaded + 6,
        hasMore: state.articlesLoaded < 50
      };
    
    case 'RESET_FILTERS':
      return {
        ...state,
        selectedTags: [],
        searchQuery: '',
        selectedCategory: 'ACCUEIL'
      };

    case 'SET_API_AVAILABLE':
      return { ...state, isApiAvailable: action.payload };

    default:
      return state;
  }
}

// REF-006: Extended state type to include computed filteredArticles
interface ArticlesStateWithFiltered extends ArticlesState {
  filteredArticles: Article[];
}

interface ArticlesContextType {
  state: ArticlesStateWithFiltered;
  addTag: (tagId: string) => void;
  removeTag: (tagId: string) => void;
  toggleTag: (tagId: string) => void;
  setCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  loadMoreArticles: () => void;
  resetFilters: () => void;
  handleArticleClick: (article: Article) => void;
}

const ArticlesContext = createContext<ArticlesContextType | undefined>(undefined);

export function ArticlesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(articlesReducer, initialState);
  const debouncedSearchQuery = useDebounce(state.searchQuery, 300);
  const router = useRouter();

  // Helper function to convert API article to local format
  const convertApiArticle = (apiArticle: ApiArticle): Article => {
    // Convert string tags to Tag objects
    const tagsArray = Array.isArray(apiArticle.tags) ? apiArticle.tags : [];
    const formattedTags: Tag[] = tagsArray.map((tag, index) => ({
      id: typeof tag === 'string' ? tag.toLowerCase().replace(/\s+/g, '-') : String(index),
      name: typeof tag === 'string' ? tag : 'Tag',
      slug: typeof tag === 'string' ? tag.toLowerCase().replace(/\s+/g, '-') : `tag-${index}`
    }));

    return {
      id: apiArticle.id,
      title: apiArticle.title,
      subtitle: apiArticle.subtitle || '',
      content: apiArticle.content || '',
      summary: apiArticle.summary || apiArticle.content?.substring(0, 200) || '',
      slug: apiArticle.title?.toLowerCase().replace(/\s+/g, '-').replace(/['"]/g, '') || apiArticle.id,
      status: 'published' as const,
      publishedAt: apiArticle.publishedAt,
      createdAt: apiArticle.publishedAt,
      updatedAt: apiArticle.updatedAt || apiArticle.publishedAt,
      category: apiArticle.category || { id: '1', name: 'Actualités', slug: 'actualites' },
      tags: formattedTags,
      author: { id: '1', name: apiArticle.author || 'NovaPress AI' },
      source: apiArticle.source ? {
        id: apiArticle.source.id,
        name: apiArticle.source.name,
        url: apiArticle.source.domain ? `https://${apiArticle.source.domain}` : 'https://novapress.ai',
        credibility: apiArticle.source.credibilityScore || 95,
        type: 'ai-generated' as const
      } : undefined,
      featuredImage: apiArticle.imageUrl || `https://picsum.photos/800/400?random=${apiArticle.id}`,
      viewCount: apiArticle.viewCount || 0,
      readingTime: apiArticle.readTime || 3,
      trending: apiArticle.isBreaking || false
    };
  };

  // Initialize articles and popular tags
  useEffect(() => {
    const loadArticles = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });

      try {
        // Try to fetch from API
        const response = await articlesService.getArticles({ limit: 50 });

        if (Array.isArray(response.data)) {
          // API is reachable — mark as available regardless of article count
          dispatch({ type: 'SET_API_AVAILABLE', payload: true });

          if (response.data.length > 0) {
            const convertedArticles = response.data.map(convertApiArticle);
            dispatch({ type: 'SET_ARTICLES', payload: convertedArticles });
            const tags = getPopularTags(convertedArticles, 15);
            dispatch({ type: 'SET_POPULAR_TAGS', payload: tags });
            console.log(`✅ Loaded ${convertedArticles.length} articles from API`);
          } else {
            // API available but DB empty (pipeline not yet run) — show mock for display
            dispatch({ type: 'SET_ARTICLES', payload: mockArticles });
            const tags = getPopularTags(mockArticles, 15);
            dispatch({ type: 'SET_POPULAR_TAGS', payload: tags });
            console.log('ℹ️ API available but no articles yet — showing demo content');
          }
        } else {
          throw new Error('Invalid API response format');
        }
      } catch (error) {
        // API unreachable — fallback to mock data
        console.error('❌ API Error:', error);
        console.log('⚠️ API unreachable — using mock data');
        dispatch({ type: 'SET_ARTICLES', payload: mockArticles });
        dispatch({ type: 'SET_API_AVAILABLE', payload: false });
        const tags = getPopularTags(mockArticles, 15);
        dispatch({ type: 'SET_POPULAR_TAGS', payload: tags });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    loadArticles();
  }, []);

  // REF-006: API search results stored separately (async operation)
  const [apiSearchResults, setApiSearchResults] = useState<Article[] | null>(null);

  // REF-006: useEffect ONLY for async API search calls
  useEffect(() => {
    // Only trigger API search if conditions are met
    if (state.isApiAvailable && debouncedSearchQuery && debouncedSearchQuery.length >= 2) {
      const controller = new AbortController();

      const performSearch = async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
          const response = await articlesService.searchArticles(debouncedSearchQuery, { limit: 20 });
          if (!controller.signal.aborted) {
            const convertedArticles = response.data.map(convertApiArticle);
            setApiSearchResults(convertedArticles);
            console.log(`🔍 Semantic search: ${convertedArticles.length} results for "${debouncedSearchQuery}"`);
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error('Search API failed:', error);
            setApiSearchResults(null); // Fallback to local filtering
          }
        } finally {
          if (!controller.signal.aborted) {
            dispatch({ type: 'SET_LOADING', payload: false });
          }
        }
      };

      performSearch();
      return () => controller.abort();
    } else {
      // Clear API results when not searching via API
      setApiSearchResults(null);
    }
  }, [debouncedSearchQuery, state.isApiAvailable]);

  // REF-006: Local filtering computed via useMemo (no dispatch needed)
  const localFilteredArticles = useMemo(() => {
    let filtered = [...state.articles];

    // Filter by category
    if (state.selectedCategory !== 'ACCUEIL') {
      const category = mockCategories.find(c => c.name === state.selectedCategory);
      if (category) {
        filtered = filterArticlesByCategory(filtered, category.id);
      }
    }

    // Filter by tags
    if (state.selectedTags.length > 0) {
      filtered = filterArticlesByTags(filtered, state.selectedTags);
    }

    // Filter by search query (local fallback when API not available)
    if (debouncedSearchQuery && !state.isApiAvailable) {
      filtered = searchArticles(filtered, debouncedSearchQuery);
    }

    return filtered;
  }, [state.articles, state.selectedCategory, state.selectedTags, debouncedSearchQuery, state.isApiAvailable]);

  // REF-006: Final filtered articles - API results take precedence if available
  const filteredArticles = apiSearchResults ?? localFilteredArticles;

  const addTag = useCallback((tagId: string) => {
    dispatch({ type: 'ADD_TAG', payload: tagId });
  }, []);

  const removeTag = useCallback((tagId: string) => {
    dispatch({ type: 'REMOVE_TAG', payload: tagId });
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    // Use atomic TOGGLE_TAG action to prevent race conditions
    dispatch({ type: 'TOGGLE_TAG', payload: tagId });
  }, []);

  const setCategory = useCallback((category: string) => {
    dispatch({ type: 'SET_CATEGORY', payload: category });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  }, []);

  const loadMoreArticles = useCallback(() => {
    if (!state.isLoading && state.hasMore) {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Simulate API call
      setTimeout(() => {
        dispatch({ type: 'LOAD_MORE_ARTICLES' });
        dispatch({ type: 'SET_LOADING', payload: false });
      }, 800);
    }
  }, [state.isLoading, state.hasMore]);

  const resetFilters = useCallback(() => {
    dispatch({ type: 'RESET_FILTERS' });
  }, []);

  const handleArticleClick = useCallback((article: Article) => {
    // Route synthesis articles to /synthesis/id, regular articles to /article/id
    const isSynthesis = article.source?.name === 'NovaPress AI' ||
                        article.complianceScore !== undefined;
    const path = isSynthesis ? `/synthesis/${article.id}` : `/article/${article.id}`;
    router.push(path);
  }, [router]);

  // REF-006: Merge computed filteredArticles into state for consumers
  const stateWithFiltered: ArticlesStateWithFiltered = {
    ...state,
    filteredArticles
  };

  const value = {
    state: stateWithFiltered,
    addTag,
    removeTag,
    toggleTag,
    setCategory,
    setSearchQuery,
    loadMoreArticles,
    resetFilters,
    handleArticleClick
  };

  return (
    <ArticlesContext.Provider value={value}>
      {children}
    </ArticlesContext.Provider>
  );
}

export function useArticles() {
  const context = useContext(ArticlesContext);
  if (context === undefined) {
    throw new Error('useArticles must be used within an ArticlesProvider');
  }
  return context;
}