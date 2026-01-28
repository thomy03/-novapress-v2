"use client";

/**
 * FactCheckIndicator - Shows fact-check analysis for a synthesis
 * Displays verification status for extracted claims
 * Inspired by Perplexity/Semafor methodology
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Types
interface VerifiedClaim {
  claim_text: string;
  claim_type: string;
  status: 'verified' | 'partially_verified' | 'unverified' | 'disputed' | 'false';
  confidence_score: number;
  verification_notes: string;
  sources_checked: string[];
  supporting_sources: string[];
  conflicting_sources: string[];
}

interface FactCheckResult {
  synthesis_id: string;
  total_claims: number;
  verified_count: number;
  disputed_count: number;
  unverified_count: number;
  overall_score: number;
  overall_label: string;
  claims: VerifiedClaim[];
  methodology_note: string;
}

// Status colors and icons
const STATUS_CONFIG = {
  verified: { icon: '✓', color: '#166534', bgColor: '#DCFCE7', label: 'Vérifié' },
  partially_verified: { icon: '◐', color: '#92400E', bgColor: '#FEF3C7', label: 'Partiellement vérifié' },
  unverified: { icon: '?', color: '#6B7280', bgColor: '#F3F4F6', label: 'Non vérifié' },
  disputed: { icon: '⚠', color: '#DC2626', bgColor: '#FEE2E2', label: 'Contesté' },
  false: { icon: '✕', color: '#991B1B', bgColor: '#FEE2E2', label: 'Faux' },
};

const CLAIM_TYPE_LABELS: Record<string, string> = {
  statistic: 'Statistique',
  quote: 'Citation',
  event: 'Événement',
  comparison: 'Comparaison',
  attribution: 'Attribution',
};

interface FactCheckIndicatorProps {
  synthesisId: string;
  compact?: boolean;
  showDetails?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function FactCheckIndicator({
  synthesisId,
  compact = false,
  showDetails = true
}: FactCheckIndicatorProps) {
  const { theme, darkMode } = useTheme();
  const [result, setResult] = useState<FactCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchFactCheck = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/syntheses/by-id/${synthesisId}/fact-check`);

        if (!response.ok) {
          throw new Error('Failed to fetch fact-check data');
        }

        const data = await response.json();
        setResult(data);
      } catch (err) {
        console.error('Fact-check fetch error:', err);
        setError('Analyse indisponible');
      } finally {
        setLoading(false);
      }
    };

    fetchFactCheck();
  }, [synthesisId]);

  if (loading) {
    return (
      <div style={{
        padding: compact ? '8px' : '12px',
        backgroundColor: darkMode ? '#1F2937' : '#F9FAFB',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          width: '16px',
          height: '16px',
          border: `2px solid ${theme.border}`,
          borderTopColor: '#10B981',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ fontSize: '12px', color: theme.textSecondary }}>
          Vérification des faits...
        </span>
      </div>
    );
  }

  if (error || !result || result.total_claims === 0) {
    return null; // Silently fail - fact-check is optional
  }

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 75) return '#166534'; // Green - high reliability
    if (score >= 50) return '#92400E'; // Yellow - medium
    return '#DC2626'; // Red - low
  };

  const scoreColor = getScoreColor(result.overall_score);

  if (compact) {
    // Compact version - just the score badge
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{ fontSize: '12px' }}>✓</span>
        <span style={{
          fontSize: '11px',
          fontWeight: '600',
          color: scoreColor,
        }}>
          {Math.round(result.overall_score)}%
        </span>
        <span style={{
          fontSize: '10px',
          color: theme.textSecondary,
        }}>
          ({result.verified_count}/{result.total_claims} vérifiés)
        </span>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: darkMode ? '#1F2937' : '#F0FDF4',
      border: `1px solid ${darkMode ? '#374151' : '#BBF7D0'}`,
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>✓</span>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: theme.textSecondary,
          }}>
            Vérification des faits
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          backgroundColor: `${scoreColor}15`,
          borderRadius: '12px',
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '700',
            color: scoreColor,
          }}>
            {Math.round(result.overall_score)}%
          </span>
          <span style={{
            fontSize: '11px',
            color: scoreColor,
          }}>
            {result.overall_label}
          </span>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '12px',
        padding: '12px',
        backgroundColor: darkMode ? '#111827' : '#FFFFFF',
        borderRadius: '6px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#166534' }}>
            {result.verified_count}
          </div>
          <div style={{ fontSize: '10px', color: theme.textSecondary }}>Vérifiés</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#6B7280' }}>
            {result.unverified_count}
          </div>
          <div style={{ fontSize: '10px', color: theme.textSecondary }}>Non vérifiés</div>
        </div>
        {result.disputed_count > 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#DC2626' }}>
              {result.disputed_count}
            </div>
            <div style={{ fontSize: '10px', color: theme.textSecondary }}>Contestés</div>
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: theme.text }}>
            {result.total_claims}
          </div>
          <div style={{ fontSize: '10px', color: theme.textSecondary }}>Total</div>
        </div>
      </div>

      {/* Expandable claim details */}
      {showDetails && result.claims.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: 'transparent',
              border: `1px dashed ${theme.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              color: theme.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>{expanded ? '▲' : '▼'}</span>
            <span>{expanded ? 'Masquer les détails' : `Voir les ${result.claims.length} claims analysés`}</span>
          </button>

          {expanded && (
            <div style={{
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {result.claims.map((claim, idx) => {
                const config = STATUS_CONFIG[claim.status] || STATUS_CONFIG.unverified;
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '12px',
                      backgroundColor: darkMode ? '#111827' : config.bgColor,
                      borderRadius: '6px',
                      border: `1px solid ${darkMode ? '#374151' : config.color}20`,
                    }}
                  >
                    {/* Status badge */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: config.color,
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: '700',
                        }}>
                          {config.icon}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: config.color,
                          textTransform: 'uppercase',
                        }}>
                          {config.label}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          color: theme.textSecondary,
                          backgroundColor: darkMode ? '#374151' : '#E5E7EB',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}>
                          {CLAIM_TYPE_LABELS[claim.claim_type] || claim.claim_type}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: config.color,
                      }}>
                        {Math.round(claim.confidence_score)}%
                      </span>
                    </div>

                    {/* Claim text */}
                    <p style={{
                      fontSize: '13px',
                      color: theme.text,
                      margin: '0 0 8px 0',
                      lineHeight: '1.5',
                    }}>
                      {claim.claim_text}
                    </p>

                    {/* Verification notes */}
                    <p style={{
                      fontSize: '11px',
                      color: theme.textSecondary,
                      margin: 0,
                      fontStyle: 'italic',
                    }}>
                      {claim.verification_notes}
                    </p>
                  </div>
                );
              })}

              {/* Methodology note */}
              <div style={{
                fontSize: '10px',
                color: theme.textSecondary,
                fontStyle: 'italic',
                marginTop: '8px',
                padding: '8px',
                borderTop: `1px solid ${theme.border}`,
              }}>
                {result.methodology_note}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Compact inline fact-check badge for cards
 */
interface FactCheckBadgeProps {
  score: number;
  verifiedCount: number;
  totalClaims: number;
}

export function FactCheckBadge({ score, verifiedCount, totalClaims }: FactCheckBadgeProps) {
  const getScoreColor = (s: number) => {
    if (s >= 75) return '#166534';
    if (s >= 50) return '#92400E';
    return '#DC2626';
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      backgroundColor: `${getScoreColor(score)}15`,
      borderRadius: '10px',
      fontSize: '10px',
      fontWeight: '600',
    }}>
      <span>✓</span>
      <span style={{ color: getScoreColor(score) }}>
        {Math.round(score)}%
      </span>
      <span style={{ color: '#6B7280' }}>
        ({verifiedCount}/{totalClaims})
      </span>
    </div>
  );
}

export default FactCheckIndicator;
