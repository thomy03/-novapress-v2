'use client';

/**
 * NovaLineSection - Client Component wrapper for NovaLine in synthesis sidebar
 * Replaces CausalSection with the new tension narrative visualization
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { NovaLine } from '@/app/components/novaline';
import { NovaLinePoint, NOVALINE_THEME } from '@/app/types/novaline';

interface NovaLineSectionProps {
  synthesisId: string;
  category: string;
  synthesisTitle?: string;
}

export default function NovaLineSection({
  synthesisId,
  category,
  synthesisTitle,
}: NovaLineSectionProps) {
  const router = useRouter();

  // Handle point click - navigate to full timeline view
  const handlePointClick = (point: NovaLinePoint) => {
    if (point.synthesisId && point.synthesisId !== synthesisId) {
      // Navigate to related synthesis
      router.push(`/synthesis/${point.synthesisId}`);
    } else if (!point.isFuture) {
      // Navigate to full timeline view
      router.push(`/synthesis/${synthesisId}/timeline`);
    }
  };

  return (
    <div style={styles.container}>
      {/* Section title */}
      <div style={styles.titleBar}>
        <div>
          <h3 style={styles.title}>Historique</h3>
          <p style={styles.subtitle}>Evolution de cette actualite dans le temps</p>
        </div>
        <button
          onClick={() => router.push(`/synthesis/${synthesisId}/timeline`)}
          style={styles.expandButton}
          title="Voir la timeline complete"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7" />
          </svg>
        </button>
      </div>

      {/* NovaLine visualization */}
      <NovaLine
        synthesisId={synthesisId}
        category={category || 'MONDE'}
        height={260}
        showPredictions={true}
        onPointClick={handlePointClick}
      />

      {/* Footer with link to full timeline */}
      <div style={styles.footer}>
        <button
          onClick={() => router.push(`/synthesis/${synthesisId}/timeline`)}
          style={styles.footerLink}
        >
          <span>Voir l'historique complet</span>
          <span style={{ marginLeft: '4px' }}>&rarr;</span>
        </button>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: NOVALINE_THEME.background,
    borderRadius: '4px',
    border: `1px solid ${NOVALINE_THEME.grid}`,
    overflow: 'hidden',
  },
  titleBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: `1px solid ${NOVALINE_THEME.grid}`,
  },
  title: {
    margin: 0,
    fontSize: '12px',
    fontWeight: 600,
    color: NOVALINE_THEME.text,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontFamily: 'Georgia, serif',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '11px',
    color: NOVALINE_THEME.textSecondary,
    fontWeight: 400,
  },
  expandButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    backgroundColor: 'transparent',
    border: `1px solid ${NOVALINE_THEME.grid}`,
    borderRadius: '4px',
    color: NOVALINE_THEME.textSecondary,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  footer: {
    padding: '8px 16px',
    borderTop: `1px solid ${NOVALINE_THEME.grid}`,
    backgroundColor: NOVALINE_THEME.grid,
  },
  footerLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: NOVALINE_THEME.textSecondary,
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'color 0.2s ease',
    fontFamily: 'Georgia, serif',
  },
};
