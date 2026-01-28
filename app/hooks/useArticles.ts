import { useState, useEffect, useCallback } from 'react';
import { articlesService } from '@/app/lib/api/services';
import { Article, PaginatedResponse } from '@/app/types/api';

export function useArticles(params?: {
  page?: number;
  limit?: number;
  category?: string;
  featured?: boolean;
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<{
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  } | null>(null);

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Pour le développement, utiliser des données mock si l'API n'est pas disponible
      try {
        const response = await articlesService.getArticles(params);
        setArticles(response.data);
        setPagination({
          total: response.total,
          page: response.page,
          limit: response.limit,
          hasNext: response.hasNext,
          hasPrev: response.hasPrev,
        });
      } catch (apiError) {
        // Fallback sur des données mock si l'API échoue
        console.log('API not available, using mock data');
        setArticles(getMockArticles());
        setPagination({
          total: 50,
          page: 1,
          limit: 10,
          hasNext: true,
          hasPrev: false,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch articles'));
    } finally {
      setLoading(false);
    }
  }, [params?.page, params?.limit, params?.category, params?.featured]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  return { articles, loading, error, pagination, refetch: fetchArticles };
}

export function useFeaturedArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        setLoading(true);
        setError(null);
        
        try {
          const data = await articlesService.getFeaturedArticles();
          setArticles(data);
        } catch {
          // Fallback sur des données mock
          setArticles(getMockArticles().slice(0, 5));
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch featured articles'));
      } finally {
        setLoading(false);
      }
    };

    fetchFeatured();
  }, []);

  return { articles, loading, error };
}

export function useBreakingNews() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchBreaking = async () => {
      try {
        setLoading(true);
        setError(null);
        
        try {
          const data = await articlesService.getBreakingNews();
          setArticles(data);
        } catch {
          // Fallback sur des données mock
          setArticles(getMockBreakingNews());
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch breaking news'));
      } finally {
        setLoading(false);
      }
    };

    fetchBreaking();
  }, []);

  return { articles, loading, error };
}

// Données mock pour le développement
function getMockArticles(): Article[] {
  return [
    {
      id: '1',
      title: 'Intelligence artificielle : révolution dans le secteur de la santé',
      subtitle: 'Les dernières avancées prometteuses',
      content: 'Lorem ipsum...',
      summary: 'L\'IA transforme radicalement les diagnostics médicaux...',
      author: 'Marie Dubois',
      source: {
        id: 's1',
        name: 'Le Monde',
        domain: 'lemonde.fr',
        credibilityScore: 95,
      },
      publishedAt: new Date().toISOString(),
      imageUrl: 'https://picsum.photos/800/450?random=1',
      category: { id: 'tech', name: 'Technologie', slug: 'tech' },
      tags: ['IA', 'Santé', 'Innovation'],
      readTime: 5,
      viewCount: 1234,
      isFeatured: true,
    },
    {
      id: '2',
      title: 'Crise énergétique : l\'Europe cherche des solutions',
      subtitle: 'Transition accélérée vers les renouvelables',
      content: 'Lorem ipsum...',
      summary: 'Face à la crise, l\'Europe accélère sa transition...',
      author: 'Jean Martin',
      source: {
        id: 's2',
        name: 'Les Échos',
        domain: 'lesechos.fr',
        credibilityScore: 92,
      },
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      imageUrl: 'https://picsum.photos/800/450?random=2',
      category: { id: 'eco', name: 'Économie', slug: 'economie' },
      tags: ['Énergie', 'Europe', 'Climat'],
      readTime: 7,
      viewCount: 2345,
    },
    {
      id: '3',
      title: 'Découverte archéologique majeure en Égypte',
      subtitle: 'Une tombe royale intacte mise au jour',
      content: 'Lorem ipsum...',
      summary: 'Les archéologues ont découvert une tombe...',
      author: 'Sophie Laurent',
      source: {
        id: 's3',
        name: 'National Geographic',
        domain: 'nationalgeographic.fr',
        credibilityScore: 90,
      },
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      imageUrl: 'https://picsum.photos/800/450?random=3',
      category: { id: 'culture', name: 'Culture', slug: 'culture' },
      tags: ['Archéologie', 'Égypte', 'Histoire'],
      readTime: 6,
      viewCount: 3456,
    },
  ];
}

function getMockBreakingNews(): Article[] {
  return [
    {
      id: 'b1',
      title: 'URGENT - Séisme de magnitude 6.8 au Japon',
      content: 'Un séisme majeur...',
      summary: 'Un séisme de magnitude 6.8...',
      author: 'Agence Reuters',
      source: {
        id: 's4',
        name: 'Reuters',
        domain: 'reuters.com',
        credibilityScore: 98,
      },
      publishedAt: new Date(Date.now() - 600000).toISOString(),
      category: { id: 'intl', name: 'International', slug: 'international' },
      tags: ['Japon', 'Séisme', 'Urgent'],
      readTime: 2,
      viewCount: 10234,
      isBreaking: true,
    },
  ];
}