"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import { Article } from '../../types/Article';
import { Article as ApiArticle } from '../../types/api';
import LoadingSpinner from '../../components/LoadingSpinner';

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Convert API article to local format
const convertApiArticle = (apiArticle: ApiArticle): Article => {
  const tagsArray = Array.isArray(apiArticle.tags) ? apiArticle.tags : [];
  const formattedTags = tagsArray.map((tag, index) => ({
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
    category: apiArticle.category || { id: '1', name: 'Actualites', slug: 'actualites' },
    tags: formattedTags,
    author: { id: '1', name: apiArticle.author || 'NovaPress AI' },
    source: apiArticle.source ? {
      id: apiArticle.source.id,
      name: apiArticle.source.name,
      url: apiArticle.source.domain ? `https://${apiArticle.source.domain}` : 'https://novapress.ai',
      credibility: apiArticle.source.credibilityScore || 95,
      type: 'ai-generated' as const
    } : undefined,
    featuredImage: apiArticle.imageUrl || `https://picsum.photos/1200/600?random=${apiArticle.id}`,
    viewCount: apiArticle.viewCount || 0,
    readingTime: apiArticle.readTime || 3,
    trending: apiArticle.isBreaking || false
  };
};

export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const { darkMode } = useTheme();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const theme = {
    bg: darkMode ? '#0a0a0a' : '#ffffff',
    bgSecondary: darkMode ? '#141414' : '#f9fafb',
    text: darkMode ? '#e5e5e5' : '#000000',
    textSecondary: darkMode ? '#a3a3a3' : '#6b7280',
    border: darkMode ? '#333333' : '#e5e7eb',
    accent: '#dc2626',
    link: '#2563eb'
  };

  useEffect(() => {
    const abortController = new AbortController();

    const fetchArticle = async () => {
      if (!params?.id) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/articles/${params.id}`, {
          signal: abortController.signal
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError('Article non trouve');
          } else {
            setError('Erreur lors du chargement de l\'article');
          }
          return;
        }

        const data = await response.json();

        // Don't update state if aborted
        if (abortController.signal.aborted) return;

        // API returns article directly (not wrapped in {data: ...})
        if (data && data.id) {
          setArticle(convertApiArticle(data));
        } else if (data.error) {
          setError(data.error);
        } else {
          setError('Format de réponse invalide');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Error fetching article:', err);
        setError('Impossible de charger l\'article. Verifiez que le serveur est en ligne.');
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchArticle();

    return () => {
      abortController.abort();
    };
  }, [params?.id]);

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: theme.bg,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <LoadingSpinner darkMode={darkMode} size="large" text="Chargement de l'article..." />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: theme.bg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px'
      }}>
        <div style={{ fontSize: '72px', marginBottom: '24px' }}>📰</div>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: theme.text,
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          {error || 'Article non trouve'}
        </h1>
        <p style={{
          fontSize: '18px',
          color: theme.textSecondary,
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          L'article que vous recherchez n'existe pas ou a ete supprime.
        </p>
        <Link
          href="/"
          style={{
            padding: '12px 32px',
            backgroundColor: theme.accent,
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '16px',
            transition: 'opacity 0.2s'
          }}
        >
          Retour a l'accueil
        </Link>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bg
    }}>
      {/* Header Navigation */}
      <header style={{
        borderBottom: `1px solid ${theme.border}`,
        padding: '16px 24px',
        position: 'sticky',
        top: 0,
        backgroundColor: theme.bg,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: theme.text,
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <span style={{ fontSize: '20px' }}>←</span>
            Retour aux articles
          </Link>

          <Link
            href="/"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'baseline'
            }}
          >
            <span style={{
              fontSize: '24px',
              fontWeight: 'bold',
              fontFamily: 'Georgia, serif',
              color: theme.text
            }}>
              NOVA
            </span>
            <span style={{
              fontSize: '24px',
              fontWeight: 'bold',
              fontFamily: 'Georgia, serif',
              color: theme.accent
            }}>
              PRESS
            </span>
            <span style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: theme.link,
              marginLeft: '4px'
            }}>
              AI
            </span>
          </Link>

          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: article.title,
                  text: article.summary,
                  url: window.location.href
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Lien copie!');
              }
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              color: theme.text,
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>🔗</span> Partager
          </button>
        </div>
      </header>

      {/* Article Content */}
      <article style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Category & Date */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <span style={{
            backgroundColor: theme.accent,
            color: 'white',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}>
            {article.category?.icon} {article.category?.name || 'Actualites'}
          </span>

          {article.trending && (
            <span style={{
              backgroundColor: '#f59e0b',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              🔥 Tendance
            </span>
          )}
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '42px',
          fontWeight: 'bold',
          lineHeight: '1.2',
          color: theme.text,
          marginBottom: '16px',
          fontFamily: 'Georgia, serif'
        }}>
          {article.title}
        </h1>

        {/* Subtitle */}
        {article.subtitle && (
          <p style={{
            fontSize: '22px',
            color: theme.textSecondary,
            lineHeight: '1.5',
            marginBottom: '24px',
            fontStyle: 'italic'
          }}>
            {article.subtitle}
          </p>
        )}

        {/* Meta info */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '24px',
          alignItems: 'center',
          paddingBottom: '24px',
          borderBottom: `1px solid ${theme.border}`,
          marginBottom: '32px',
          color: theme.textSecondary,
          fontSize: '14px'
        }}>
          {article.author && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: theme.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold'
              }}>
                {article.author.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: '600', color: theme.text }}>
                  {article.author.name}
                </div>
                <div style={{ fontSize: '12px' }}>Auteur</div>
              </div>
            </div>
          )}

          <div>
            <div style={{ fontWeight: '500', color: theme.text }}>
              {formatDate(article.publishedAt || article.createdAt)}
            </div>
          </div>

          {article.readingTime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>📖</span>
              <span>{article.readingTime} min de lecture</span>
            </div>
          )}

          {article.viewCount ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>👁</span>
              <span>{article.viewCount.toLocaleString('fr-FR')} vues</span>
            </div>
          ) : null}
        </div>

        {/* Featured Image */}
        {article.featuredImage && (
          <div style={{
            position: 'relative',
            width: '100%',
            height: '450px',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '32px'
          }}>
            <Image
              src={article.featuredImage}
              alt={article.title}
              fill
              style={{ objectFit: 'cover' }}
              priority
            />
          </div>
        )}

        {/* Tags */}
        {article.tags.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '32px'
          }}>
            {article.tags.map(tag => (
              <Link
                key={tag.id}
                href={`/?tag=${tag.slug}`}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '500',
                  border: `1px solid ${theme.accent}`,
                  backgroundColor: `${theme.accent}15`,
                  color: theme.accent,
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* Article Content */}
        <div style={{
          fontSize: '18px',
          lineHeight: '1.8',
          color: theme.text,
          fontFamily: 'Georgia, serif'
        }}>
          {/* Summary as lead paragraph */}
          {article.summary && (
            <p style={{
              fontSize: '20px',
              fontWeight: '500',
              marginBottom: '24px',
              color: theme.text
            }}>
              {article.summary}
            </p>
          )}

          {/* Main content */}
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {article.content}
          </div>
        </div>

        {/* Source */}
        {article.source && (
          <div style={{
            marginTop: '48px',
            padding: '20px',
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px',
            borderLeft: `4px solid ${theme.accent}`
          }}>
            <div style={{
              fontSize: '12px',
              color: theme.textSecondary,
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Source
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: '600', color: theme.text }}>
                  {article.source.name}
                </div>
                {article.source.url && (
                  <a
                    href={article.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '14px',
                      color: theme.link,
                      textDecoration: 'none'
                    }}
                  >
                    {article.source.url}
                  </a>
                )}
              </div>
              {article.source.credibility && (
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: theme.accent,
                  color: 'white',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  Credibilite: {article.source.credibility}%
                </div>
              )}
            </div>
          </div>
        )}

        {/* Back to Home */}
        <div style={{
          marginTop: '48px',
          paddingTop: '32px',
          borderTop: `1px solid ${theme.border}`,
          textAlign: 'center'
        }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 32px',
              backgroundColor: theme.text,
              color: theme.bg,
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: '16px',
              transition: 'opacity 0.2s'
            }}
          >
            ← Retour aux articles
          </Link>
        </div>
      </article>
    </div>
  );
}
