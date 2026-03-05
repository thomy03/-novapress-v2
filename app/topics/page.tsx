'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/app/components/layout/Header';
import { NarrativeArcIndicator } from '@/app/components/topics';
import type { NarrativeArc } from '@/app/components/topics';

interface RecurringTopic {
  topic_name: string;
  synthesis_count: number;
  narrative_arc: string;
  is_active: boolean;
  key_entities: string[];
  latest_date?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function TopicsListPage() {
  const [topics, setTopics] = useState<RecurringTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const response = await fetch(`${API_URL}/api/trending/recurring-topics`);
        if (!response.ok) throw new Error('Erreur lors du chargement');
        const data = await response.json();
        // Sort by synthesis count (most covered first)
        const sorted = (data.topics || data || []).sort(
          (a: RecurringTopic, b: RecurringTopic) => b.synthesis_count - a.synthesis_count
        );
        setTopics(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, []);

  const activeTopics = topics.filter(t => t.is_active);
  const resolvedTopics = topics.filter(t => !t.is_active);

  return (
    <div style={styles.page}>
      {/* Shared Header */}
      <Header />

      {/* Hero */}
      <div style={styles.hero}>
        <span style={styles.sectionBadge}>DOSSIERS</span>
        <h1 style={styles.title}>Themes Recurrents</h1>
        <p style={styles.subtitle}>
          Explorez les sujets couverts par plusieurs syntheses. Chaque dossier
          regroupe les analyses, entites cles et l'evolution d'un theme dans le temps.
        </p>
        {!loading && topics.length > 0 && (
          <div style={styles.statsRow}>
            <span>{topics.length} dossiers</span>
            <span style={styles.separator}>|</span>
            <span>{activeTopics.length} actifs</span>
            <span style={styles.separator}>|</span>
            <span>{topics.reduce((sum, t) => sum + t.synthesis_count, 0)} syntheses totales</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {loading && (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={{ marginTop: '16px', fontSize: '14px', color: '#6B7280' }}>
              Chargement des dossiers...
            </p>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#6B7280' }}>
            <p>{error}</p>
          </div>
        )}

        {!loading && topics.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '60px 24px', color: '#6B7280' }}>
            <p>Aucun theme recurrent detecte pour le moment.</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>
              Les themes apparaissent quand un sujet est couvert par au moins 3 syntheses.
            </p>
          </div>
        )}

        {/* Active Topics */}
        {activeTopics.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Dossiers Actifs</h2>
            <div style={styles.topicsGrid}>
              {activeTopics.map((topic, index) => (
                <TopicCard key={index} topic={topic} />
              ))}
            </div>
          </section>
        )}

        {/* Resolved Topics */}
        {resolvedTopics.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Dossiers Clos</h2>
            <div style={styles.topicsGrid}>
              {resolvedTopics.map((topic, index) => (
                <TopicCard key={index} topic={topic} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function TopicCard({ topic }: { topic: RecurringTopic }) {
  return (
    <Link
      href={`/topics/${encodeURIComponent(topic.topic_name)}`}
      style={styles.topicCard}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#000000';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#E5E5E5';
      }}
    >
      <div style={styles.topicCardTop}>
        <NarrativeArcIndicator
          arc={(topic.narrative_arc || 'emerging') as NarrativeArc}
          size="small"
        />
        <span style={styles.synthesisCount}>
          {topic.synthesis_count} syntheses
        </span>
      </div>

      <h3 style={styles.topicName}>{topic.topic_name}</h3>

      {topic.key_entities && topic.key_entities.length > 0 && (
        <div style={styles.entitiesRow}>
          {topic.key_entities.slice(0, 4).map((entity, i) => (
            <span key={i} style={styles.entityChip}>{entity}</span>
          ))}
          {topic.key_entities.length > 4 && (
            <span style={styles.entityMore}>+{topic.key_entities.length - 4}</span>
          )}
        </div>
      )}

      <span style={styles.readMore}>Voir le dossier &rarr;</span>
    </Link>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  hero: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 24px 32px',
    borderBottom: '2px solid #000000',
  },
  sectionBadge: {
    display: 'inline-block',
    backgroundColor: '#000000',
    color: '#FFFFFF',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    marginBottom: '16px',
  },
  title: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '42px',
    fontWeight: 700,
    lineHeight: 1.15,
    color: '#000000',
    margin: '0 0 12px 0',
  },
  subtitle: {
    fontSize: '16px',
    color: '#6B7280',
    lineHeight: 1.6,
    maxWidth: '700px',
    margin: '0 0 16px 0',
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    color: '#6B7280',
  },
  separator: {
    color: '#E5E5E5',
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px 80px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 24px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5E5',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  section: {
    marginTop: '48px',
  },
  sectionTitle: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '20px',
    fontWeight: 700,
    color: '#000000',
    margin: '0 0 24px 0',
    paddingBottom: '8px',
    borderBottom: '1px solid #E5E5E5',
  },
  topicsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: '16px',
  },
  topicCard: {
    display: 'block',
    padding: '20px',
    border: '1px solid #E5E5E5',
    textDecoration: 'none',
    color: '#000000',
    transition: 'border-color 0.2s ease',
    backgroundColor: '#FFFFFF',
  },
  topicCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  synthesisCount: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: 500,
  },
  topicName: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '18px',
    fontWeight: 700,
    color: '#000000',
    margin: '0 0 12px 0',
    lineHeight: 1.3,
  },
  entitiesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '12px',
  },
  entityChip: {
    fontSize: '11px',
    padding: '2px 8px',
    backgroundColor: '#F3F4F6',
    color: '#374151',
    fontWeight: 500,
  },
  entityMore: {
    fontSize: '11px',
    padding: '2px 8px',
    color: '#9CA3AF',
  },
  readMore: {
    fontSize: '13px',
    color: '#2563EB',
    fontWeight: 500,
  },
};
