'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TransparencyBadge from '@/app/components/xray/TransparencyBadge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface BriefSynthesis {
  id: string;
  title: string;
  summary: string;
  transparencyScore: number;
  transparencyLabel: string;
  numSources: number;
  category: string;
  createdAt: string;
  readingTime: number;
}

export default function MorningBriefPage() {
  const [syntheses, setSyntheses] = useState<BriefSynthesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBrief() {
      try {
        const res = await fetch(`${API_URL}/api/syntheses/brief?limit=5`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSyntheses(data.data || []);
      } catch (err) {
        console.error('Failed to fetch brief:', err);
        setError('Impossible de charger le briefing.');
      } finally {
        setLoading(false);
      }
    }
    fetchBrief();
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const today = formatDate(new Date().toISOString());

  const getOneSentenceSummary = (summary: string): string => {
    if (!summary) return '';
    const firstSentence = summary.split(/[.!?]/)[0];
    return firstSentence ? firstSentence.trim() + '.' : summary.substring(0, 150) + '...';
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#6B7280' }}>
          <div style={styles.spinner} />
          <p style={{ marginTop: '16px', fontSize: '14px', fontFamily: 'Georgia, serif' }}>
            Preparation du briefing...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <Link href="/" style={{ textDecoration: 'none', color: '#000' }}>
          <div style={styles.logo}>
            <span style={{ fontWeight: 'bold' }}>NOVA</span>
            <span style={{ fontWeight: 'bold', color: '#DC2626' }}>PRESS</span>
            <span style={{ fontSize: '14px', color: '#2563EB', marginLeft: '4px', fontWeight: 'bold' }}>AI</span>
          </div>
        </Link>
        <div style={styles.dateline}>{today}</div>
      </header>

      <div style={styles.dividerThick} />

      {/* Title */}
      <div style={styles.titleSection}>
        <h1 style={styles.title}>Morning Brief</h1>
        <p style={styles.subtitle}>
          Les 5 syntheses les plus transparentes des dernieres 24 heures
        </p>
      </div>

      <div style={styles.dividerThin} />

      {/* Error state */}
      {error && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#DC2626', fontFamily: 'Georgia, serif' }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!error && syntheses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280', fontFamily: 'Georgia, serif' }}>
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>Aucune synthese dans les dernieres 24h.</p>
          <p style={{ fontSize: '14px' }}>Le pipeline doit etre lance pour generer des syntheses.</p>
        </div>
      )}

      {/* Syntheses list */}
      <div style={styles.list}>
        {syntheses.map((s, index) => (
          <article key={s.id} style={styles.item}>
            <div style={styles.itemHeader}>
              <span style={styles.index}>{index + 1}</span>
              <TransparencyBadge
                score={s.transparencyScore}
                label={s.transparencyLabel}
                size="small"
                showLabel={false}
              />
              <span style={styles.category}>{s.category}</span>
              <span style={styles.sourceBadge}>{s.numSources} sources</span>
            </div>

            <Link href={`/synthesis/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <h2 style={styles.itemTitle}>{s.title}</h2>
            </Link>

            <p style={styles.itemSummary}>
              {getOneSentenceSummary(s.summary)}
            </p>

            <div style={styles.itemFooter}>
              <span style={styles.readingTime}>{s.readingTime} min</span>
              <Link
                href={`/synthesis/${s.id}`}
                style={styles.xrayLink}
              >
                Voir le X-Ray complet
              </Link>
            </div>

            {index < syntheses.length - 1 && <div style={styles.dividerThin} />}
          </article>
        ))}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <Link href="/" style={styles.backLink}>
          Retour a l'accueil
        </Link>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '680px',
    margin: '0 auto',
    padding: '40px 24px',
    backgroundColor: '#FFFFFF',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '16px',
  },
  logo: {
    fontSize: '28px',
    fontFamily: 'Georgia, serif',
    letterSpacing: '-0.5px',
  },
  dateline: {
    fontSize: '13px',
    color: '#6B7280',
    fontFamily: 'Georgia, serif',
    textTransform: 'capitalize',
  },
  dividerThick: {
    height: '3px',
    backgroundColor: '#000',
    marginBottom: '24px',
  },
  dividerThin: {
    height: '1px',
    backgroundColor: '#E5E5E5',
    margin: '24px 0',
  },
  titleSection: {
    textAlign: 'center' as const,
    marginBottom: '8px',
  },
  title: {
    fontSize: '36px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    color: '#000',
    marginBottom: '8px',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#6B7280',
    fontFamily: 'Georgia, serif',
    fontStyle: 'italic',
  },
  list: {
    marginTop: '8px',
  },
  item: {
    paddingTop: '8px',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  index: {
    fontSize: '28px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    color: '#DC2626',
    lineHeight: 1,
  },
  category: {
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
    color: '#6B7280',
  },
  sourceBadge: {
    fontSize: '11px',
    color: '#6B7280',
    padding: '2px 8px',
    border: '1px solid #E5E5E5',
  },
  itemTitle: {
    fontSize: '22px',
    fontWeight: 'bold',
    fontFamily: 'Georgia, serif',
    color: '#000',
    lineHeight: 1.3,
    marginBottom: '8px',
  },
  itemSummary: {
    fontSize: '15px',
    color: '#4B5563',
    fontFamily: 'Georgia, serif',
    lineHeight: 1.6,
    marginBottom: '12px',
  },
  itemFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readingTime: {
    fontSize: '12px',
    color: '#9CA3AF',
  },
  xrayLink: {
    fontSize: '13px',
    color: '#2563EB',
    textDecoration: 'none',
    fontWeight: '600',
  },
  footer: {
    marginTop: '48px',
    paddingTop: '24px',
    borderTop: '2px solid #000',
    textAlign: 'center' as const,
  },
  backLink: {
    fontSize: '14px',
    color: '#2563EB',
    textDecoration: 'none',
    fontWeight: '500',
    fontFamily: 'Georgia, serif',
  },
  spinner: {
    display: 'inline-block',
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5E5',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
