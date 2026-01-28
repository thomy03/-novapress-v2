'use client';

/**
 * TrendingTopics - Simple, readable trending topics display
 * Replaces the "Cortex Thématique" 3D visualization with actionable links
 * Supports dark mode via ThemeContext
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '@/app/contexts/ThemeContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface TrendingTopic {
  topic: string;
  count: number;
  category: string;
  synthesisCount: number;
  synthesisIds: string[];
}

interface CategoryStat {
  name: string;
  displayName: string;
  count: number;
  isHot: boolean;
  recentTitles: string[];
}

// Category colors (newspaper style)
const CATEGORY_COLORS: Record<string, string> = {
  MONDE: '#DC2626',      // Red
  POLITIQUE: '#DC2626',  // Red
  ECONOMIE: '#F59E0B',   // Amber
  TECH: '#2563EB',       // Blue
  CULTURE: '#8B5CF6',    // Purple
  SPORT: '#10B981',      // Green
  SCIENCES: '#06B6D4',   // Cyan
};

export function TrendingTopics() {
  const { theme } = useTheme();
  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'topics' | 'categories'>('topics');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch both in parallel
        const [topicsRes, categoriesRes] = await Promise.all([
          fetch(`${API_URL}/api/trending/?hours=48&limit=8`),
          fetch(`${API_URL}/api/trending/categories?hours=48`),
        ]);

        if (topicsRes.ok) {
          const data = await topicsRes.json();
          setTopics(data.data || []);
        }

        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          setCategories(data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch trending data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const styles = getStyles(theme);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>TENDANCES</h2>
        </div>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Chargement des tendances...</span>
        </div>
      </div>
    );
  }

  const hasData = topics.length > 0 || categories.length > 0;

  if (!hasData) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>TENDANCES</h2>
        </div>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>📰</span>
          <p style={styles.emptyText}>Aucune tendance pour le moment</p>
          <p style={styles.emptySubtext}>Lancez le pipeline pour générer des synthèses</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>TENDANCES</h2>
        <span style={styles.subtitle}>Dernières 48h</span>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('topics')}
          style={{
            ...styles.tab,
            ...(activeTab === 'topics' ? styles.tabActive : {}),
          }}
        >
          Sujets chauds
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          style={{
            ...styles.tab,
            ...(activeTab === 'categories' ? styles.tabActive : {}),
          }}
        >
          Par catégorie
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'topics' ? (
          <TopicsList topics={topics} theme={theme} />
        ) : (
          <CategoriesList categories={categories} theme={theme} />
        )}
      </div>
    </div>
  );
}

interface ThemeColors {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  text: string;
  textSecondary: string;
  border: string;
  hover: string;
  card: string;
}

function TopicsList({ topics, theme }: { topics: TrendingTopic[]; theme: ThemeColors }) {
  const styles = getStyles(theme);
  if (topics.length === 0) {
    return <p style={styles.noData}>Aucun sujet tendance</p>;
  }

  return (
    <div style={styles.list}>
      {topics.map((topic, index) => (
        <div key={index} style={styles.topicItem}>
          {/* Rank */}
          <div style={styles.rank}>
            <span style={styles.rankNumber}>{index + 1}</span>
          </div>

          {/* Content */}
          <div style={styles.topicContent}>
            {/* Title - truncated */}
            <h3 style={styles.topicTitle}>
              {topic.topic.length > 80
                ? `${topic.topic.substring(0, 80)}...`
                : topic.topic}
            </h3>

            {/* Meta */}
            <div style={styles.topicMeta}>
              <span
                style={{
                  ...styles.categoryBadge,
                  backgroundColor: `${CATEGORY_COLORS[topic.category] || '#6B7280'}15`,
                  color: CATEGORY_COLORS[topic.category] || '#6B7280',
                }}
              >
                {topic.category}
              </span>
              <span style={styles.synthesisCount}>
                {topic.synthesisCount} synthèse{topic.synthesisCount > 1 ? 's' : ''}
              </span>
            </div>

            {/* Links to syntheses */}
            {topic.synthesisIds?.length > 0 && (
              <div style={styles.synthesisLinks}>
                {topic.synthesisIds.slice(0, 2).map((id) => (
                  <Link
                    key={id}
                    href={`/synthesis/${id}`}
                    style={styles.synthesisLink}
                  >
                    Lire →
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Heat indicator */}
          <div
            style={{
              ...styles.heatBar,
              width: `${Math.min(100, topic.count * 20)}%`,
              backgroundColor: CATEGORY_COLORS[topic.category] || '#6B7280',
            }}
          />
        </div>
      ))}
    </div>
  );
}

function CategoriesList({ categories, theme }: { categories: CategoryStat[]; theme: ThemeColors }) {
  const styles = getStyles(theme);
  if (categories.length === 0) {
    return <p style={styles.noData}>Aucune catégorie</p>;
  }

  // Filter categories with at least 1 synthesis
  const activeCategories = categories.filter((c) => c.count > 0);

  return (
    <div style={styles.categoriesGrid}>
      {activeCategories.map((category) => (
        <Link
          key={category.name}
          href={`/intelligence?category=${category.name}`}
          style={styles.categoryCard}
        >
          {/* Hot badge */}
          {category.isHot && <span style={styles.hotBadge}>HOT</span>}

          {/* Category name */}
          <div style={styles.categoryHeader}>
            <span
              style={{
                ...styles.categoryDot,
                backgroundColor: CATEGORY_COLORS[category.name] || '#6B7280',
              }}
            />
            <h3 style={styles.categoryName}>{category.displayName}</h3>
          </div>

          {/* Count */}
          <div style={styles.categoryCount}>
            <span style={styles.countNumber}>{category.count}</span>
            <span style={styles.countLabel}>synthèses</span>
          </div>

          {/* Recent title preview */}
          {category.recentTitles?.[0] && (
            <p style={styles.recentTitle}>
              {category.recentTitles[0].length > 60
                ? `${category.recentTitles[0].substring(0, 60)}...`
                : category.recentTitles[0]}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}

// Dynamic styles function with theme support for dark mode
function getStyles(theme: ThemeColors): { [key: string]: React.CSSProperties } {
  return {
    container: {
      backgroundColor: theme.card,
      border: `1px solid ${theme.border}`,
      borderRadius: '4px',
      overflow: 'hidden',
      maxWidth: '900px',
      margin: '0 auto',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: `1px solid ${theme.border}`,
      backgroundColor: theme.hover,
    },
    title: {
      margin: 0,
      fontSize: '14px',
      fontWeight: 700,
      color: theme.text,
      letterSpacing: '2px',
      fontFamily: 'Georgia, serif',
    },
    subtitle: {
      fontSize: '12px',
      color: theme.textSecondary,
    },
    tabs: {
      display: 'flex',
      borderBottom: `1px solid ${theme.border}`,
    },
    tab: {
      flex: 1,
      padding: '12px 16px',
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: '2px solid transparent',
      fontSize: '13px',
      color: theme.textSecondary,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontFamily: 'Georgia, serif',
    },
    tabActive: {
      color: theme.text,
      borderBottomColor: '#DC2626',
      fontWeight: 600,
    },
    content: {
      padding: '16px',
      minHeight: '300px',
    },
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    topicItem: {
      position: 'relative',
      display: 'flex',
      gap: '12px',
      padding: '12px',
      backgroundColor: theme.hover,
      borderRadius: '4px',
      overflow: 'hidden',
    },
    rank: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      width: '28px',
      flexShrink: 0,
    },
    rankNumber: {
      fontSize: '18px',
      fontWeight: 700,
      color: '#DC2626',
      fontFamily: 'Georgia, serif',
    },
    topicContent: {
      flex: 1,
      minWidth: 0,
    },
    topicTitle: {
      margin: '0 0 8px 0',
      fontSize: '14px',
      fontWeight: 600,
      color: theme.text,
      lineHeight: 1.4,
      fontFamily: 'Georgia, serif',
    },
    topicMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px',
    },
    categoryBadge: {
      fontSize: '10px',
      fontWeight: 600,
      padding: '2px 6px',
      borderRadius: '2px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    synthesisCount: {
      fontSize: '11px',
      color: theme.textSecondary,
    },
    synthesisLinks: {
      display: 'flex',
      gap: '8px',
    },
    synthesisLink: {
      fontSize: '12px',
      color: '#2563EB',
      textDecoration: 'none',
      fontWeight: 500,
    },
    heatBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      height: '3px',
      opacity: 0.6,
    },
    categoriesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '12px',
    },
    categoryCard: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      backgroundColor: theme.hover,
      borderRadius: '4px',
      textDecoration: 'none',
      transition: 'all 0.2s ease',
      border: '1px solid transparent',
    },
    hotBadge: {
      position: 'absolute',
      top: '8px',
      right: '8px',
      fontSize: '9px',
      fontWeight: 700,
      padding: '2px 6px',
      backgroundColor: '#DC2626',
      color: '#FFFFFF',
      borderRadius: '2px',
      letterSpacing: '0.5px',
    },
    categoryHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '8px',
    },
    categoryDot: {
      width: '10px',
      height: '10px',
      borderRadius: '50%',
    },
    categoryName: {
      margin: 0,
      fontSize: '14px',
      fontWeight: 600,
      color: theme.text,
      fontFamily: 'Georgia, serif',
    },
    categoryCount: {
      display: 'flex',
      alignItems: 'baseline',
      gap: '4px',
      marginBottom: '8px',
    },
    countNumber: {
      fontSize: '24px',
      fontWeight: 700,
      color: theme.text,
      fontFamily: 'Georgia, serif',
    },
    countLabel: {
      fontSize: '12px',
      color: theme.textSecondary,
    },
    recentTitle: {
      margin: 0,
      fontSize: '12px',
      color: theme.textSecondary,
      lineHeight: 1.4,
      fontStyle: 'italic',
    },
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
    },
    spinner: {
      width: '24px',
      height: '24px',
      border: `2px solid ${theme.border}`,
      borderTopColor: '#DC2626',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    },
    loadingText: {
      marginTop: '12px',
      fontSize: '13px',
      color: theme.textSecondary,
    },
    emptyState: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      textAlign: 'center',
    },
    emptyIcon: {
      fontSize: '48px',
      marginBottom: '16px',
    },
    emptyText: {
      margin: '0 0 8px 0',
      fontSize: '14px',
      color: theme.text,
      fontWeight: 600,
    },
    emptySubtext: {
      margin: 0,
      fontSize: '12px',
      color: theme.textSecondary,
    },
    noData: {
      textAlign: 'center',
      color: theme.textSecondary,
      fontSize: '13px',
      padding: '40px 0',
    },
  };
}

export default TrendingTopics;
