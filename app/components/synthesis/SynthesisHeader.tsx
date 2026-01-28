'use client';

import React from 'react';
import { RecurringTopicBadge } from '@/app/components/topics';
import { SynthesisHeaderProps, sharedStyles } from '@/app/types/synthesis-page';

/**
 * REF-012b: SynthesisHeader Component
 * Displays the header section of a synthesis page including:
 * - AI Badge
 * - RecurringTopicBadge
 * - Update Notice Banner (if applicable)
 * - Title
 * - Metadata (sources, reading time, date, accuracy)
 */
export function SynthesisHeader({ synthesis, formatDate }: SynthesisHeaderProps) {
  return (
    <>
      {/* AI Badge */}
      <div style={styles.badgeContainer}>
        <div style={styles.aiBadge}>
          AI SYNTHESIS
        </div>
        <RecurringTopicBadge synthesisId={synthesis.id} />
      </div>

      {/* Update Notice Banner */}
      {synthesis.isUpdate && synthesis.updateNotice && (
        <div style={styles.updateNoticeBanner}>
          <span style={styles.updateIcon}>🔄</span>
          <span>{synthesis.updateNotice}</span>
        </div>
      )}

      {/* Title */}
      <h1 style={styles.title}>
        {synthesis.title}
      </h1>

      {/* FIX-002: Persona Byline */}
      {(synthesis.persona || synthesis.author) && (
        <p style={styles.byline}>
          Par{' '}
          <span style={styles.personaName}>
            {synthesis.author?.name || synthesis.persona?.name || 'NovaPress'}
          </span>
          {(synthesis.author?.persona_type || synthesis.persona?.displayName) && (
            <span style={styles.personaType}>
              {' '}({synthesis.author?.persona_type || synthesis.persona?.displayName})
            </span>
          )}
        </p>
      )}

      {/* Metadata */}
      <div style={styles.metadata}>
        <span>{synthesis.numSources} sources</span>
        <span style={styles.separator}>|</span>
        <span>{synthesis.readingTime} min de lecture</span>
        <span style={styles.separator}>|</span>
        <span>{formatDate(synthesis.createdAt)}</span>
        <span style={styles.separator}>|</span>
        <span style={styles.accuracyBadge}>
          <span
            style={{
              ...styles.accuracyDot,
              backgroundColor: synthesis.complianceScore >= 90
                ? sharedStyles.accentGreen
                : sharedStyles.accentYellow
            }}
          />
          {synthesis.complianceScore}% accuracy
        </span>
      </div>
    </>
  );
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  badgeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  aiBadge: {
    display: 'inline-block',
    backgroundColor: sharedStyles.accentBlue,
    color: sharedStyles.bgWhite,
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    marginBottom: '24px',
  },
  updateNoticeBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    backgroundColor: '#FEF3C7',
    borderLeft: `4px solid ${sharedStyles.accentYellow}`,
    borderRadius: '0 4px 4px 0',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#92400E',
    fontWeight: '500',
  },
  updateIcon: {
    fontSize: '16px',
  },
  title: {
    fontFamily: sharedStyles.fontSerif,
    fontSize: '36px',
    fontWeight: '700',
    lineHeight: '1.2',
    color: sharedStyles.textPrimary,
    marginBottom: '12px',
  },
  byline: {
    fontStyle: 'italic',
    fontSize: '15px',
    color: sharedStyles.textSecondary,
    marginBottom: '16px',
    marginTop: '0',
  },
  personaName: {
    fontWeight: '600',
    color: sharedStyles.textPrimary,
  },
  personaType: {
    color: sharedStyles.accentBlue,
    fontWeight: '500',
  },
  metadata: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '16px',
    fontSize: '14px',
    color: sharedStyles.textSecondary,
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: `1px solid ${sharedStyles.border}`,
  },
  separator: {
    color: sharedStyles.border,
  },
  accuracyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  accuracyDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
};

export default SynthesisHeader;
