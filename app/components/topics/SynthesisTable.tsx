'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

interface SynthesisRow {
  id: string;
  title: string;
  date: string;
  category: string;
  sentiment: string;
  num_sources: number;
  transparency_score: number;
  summary: string;
}

interface SynthesisTableProps {
  syntheses: SynthesisRow[];
}

type SortKey = 'date' | 'num_sources' | 'sentiment' | 'transparency_score';
type SortDir = 'asc' | 'desc';

const SENTIMENT_ORDER: Record<string, number> = {
  positive: 3,
  mixed: 2,
  neutral: 1,
  negative: 0,
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#10B981',
  negative: '#DC2626',
  neutral: '#6B7280',
  mixed: '#F59E0B',
};

export default function SynthesisTable({ syntheses }: SynthesisTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filter, setFilter] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = useMemo(() => {
    let filtered = syntheses;
    if (filter) {
      const lower = filter.toLowerCase();
      filtered = syntheses.filter(
        (s) =>
          s.title.toLowerCase().includes(lower) ||
          s.category.toLowerCase().includes(lower)
      );
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'num_sources':
          cmp = a.num_sources - b.num_sources;
          break;
        case 'sentiment':
          cmp = (SENTIMENT_ORDER[a.sentiment] || 0) - (SENTIMENT_ORDER[b.sentiment] || 0);
          break;
        case 'transparency_score':
          cmp = a.transparency_score - b.transparency_score;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [syntheses, sortKey, sortDir, filter]);

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ' \u2195';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  return (
    <div style={styles.container}>
      {/* Filter */}
      <input
        type="text"
        placeholder="Filtrer par titre ou categorie..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={styles.filterInput}
      />

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th
                style={{ ...styles.th, cursor: 'pointer', width: '100px' }}
                onClick={() => handleSort('date')}
              >
                Date{sortIcon('date')}
              </th>
              <th style={{ ...styles.th, minWidth: '280px' }}>Titre</th>
              <th
                style={{ ...styles.th, cursor: 'pointer', width: '80px', textAlign: 'center' }}
                onClick={() => handleSort('num_sources')}
              >
                Sources{sortIcon('num_sources')}
              </th>
              <th
                style={{ ...styles.th, cursor: 'pointer', width: '100px', textAlign: 'center' }}
                onClick={() => handleSort('sentiment')}
              >
                Sentiment{sortIcon('sentiment')}
              </th>
              <th
                style={{ ...styles.th, cursor: 'pointer', width: '120px', textAlign: 'center' }}
                onClick={() => handleSort('transparency_score')}
              >
                Transparence{sortIcon('transparency_score')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} style={styles.tr}>
                <td style={styles.td}>{formatDate(s.date)}</td>
                <td style={styles.td}>
                  <Link href={`/synthesis/${s.id}`} style={styles.titleLink}>
                    {s.title}
                  </Link>
                </td>
                <td style={{ ...styles.td, textAlign: 'center' }}>{s.num_sources}</td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <span
                    style={{
                      ...styles.sentimentBadge,
                      color: SENTIMENT_COLORS[s.sentiment] || '#6B7280',
                      backgroundColor: `${SENTIMENT_COLORS[s.sentiment] || '#6B7280'}15`,
                    }}
                  >
                    {s.sentiment}
                  </span>
                </td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <span style={{
                    fontWeight: 600,
                    color: s.transparency_score >= 70 ? '#10B981' : s.transparency_score >= 40 ? '#F59E0B' : '#DC2626',
                  }}>
                    {s.transparency_score || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px', fontSize: '14px' }}>
          Aucune synthese ne correspond au filtre.
        </p>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    width: '100%',
  },
  filterInput: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #E5E5E5',
    fontSize: '14px',
    marginBottom: '16px',
    outline: 'none',
    fontFamily: 'inherit',
    backgroundColor: '#F9FAFB',
  },
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontSize: '11px',
    fontWeight: 700,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    borderBottom: '2px solid #000000',
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  },
  tr: {
    borderBottom: '1px solid #E5E5E5',
  },
  td: {
    padding: '12px 12px',
    verticalAlign: 'top' as const,
    color: '#000000',
  },
  titleLink: {
    color: '#000000',
    textDecoration: 'none',
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontWeight: 600,
    fontSize: '15px',
    lineHeight: 1.3,
  },
  sentimentBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'capitalize' as const,
  },
};
