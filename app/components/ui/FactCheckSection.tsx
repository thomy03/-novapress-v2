'use client';

import React from 'react';
import { FactCheckEnrichment, WebSource } from '@/app/types/api';

interface FactCheckSectionProps {
  factCheck: FactCheckEnrichment;
  webSources?: WebSource[];
}

export default function FactCheckSection({ factCheck, webSources = [] }: FactCheckSectionProps) {
  if (factCheck.count === 0 && webSources.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={{ fontSize: '18px' }}>✓</span>
        <h3 style={styles.title}>Verification des faits</h3>
      </div>

      {/* Fact Check Notes */}
      {factCheck.notes.length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Resultats de verification</h4>
          <ul style={styles.notesList}>
            {factCheck.notes.map((note, i) => (
              <li key={i} style={styles.noteItem}>
                {formatFactCheckNote(note)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Web Sources */}
      {webSources.length > 0 && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Sources web consultees</h4>
          <ul style={styles.sourcesList}>
            {webSources.map((source, i) => (
              <li key={i} style={styles.sourceItem}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.sourceLink}
                >
                  {source.title || extractDomain(source.url)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function formatFactCheckNote(note: string) {
  // Parse note format: "claim: VERIFIED/FALSE/PARTIALLY TRUE - explanation"
  const verifiedMatch = note.match(/VERIFIED|VRAI|TRUE/i);
  const falseMatch = note.match(/FALSE|FAUX/i);
  const partialMatch = note.match(/PARTIAL|PARTIELLEMENT/i);

  let icon = '❓';
  let color = '#6B7280';

  if (verifiedMatch) {
    icon = '✅';
    color = '#166534';
  } else if (falseMatch) {
    icon = '❌';
    color = '#991B1B';
  } else if (partialMatch) {
    icon = '⚠️';
    color = '#92400E';
  }

  return (
    <span style={{ color }}>
      {icon} {note}
    </span>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#FFFBEB',
    border: '1px solid #FDE68A',
    borderRadius: '8px',
    padding: '20px',
    marginTop: '24px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: 0,
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: '8px',
  },
  notesList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  noteItem: {
    padding: '8px 12px',
    backgroundColor: '#FFFFFF',
    borderRadius: '4px',
    marginBottom: '6px',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  sourcesList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  sourceItem: {
    display: 'inline-block',
  },
  sourceLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '4px',
    fontSize: '13px',
    color: '#2563EB',
    textDecoration: 'none',
    transition: 'all 0.2s',
  },
};
