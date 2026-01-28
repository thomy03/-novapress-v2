"use client";

/**
 * BiasIndicator - Shows source bias analysis for a synthesis
 * Inspired by Ground News bias meter
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// Types
export interface SourceBias {
  name: string;
  domain: string;
  political_bias: number;
  bias_label: string;
  bias_code: string;
  reliability: number;
  reliability_label: string;
  country: string;
  type: string;
  tags: string[];
}

export interface SynthesisBalance {
  left_count: number;
  center_count: number;
  right_count: number;
  total_sources: number;
  average_bias: number;
  bias_spread: number;
  average_reliability: number;
  balance_score: number;
  coverage_label: string;
  is_balanced: boolean;
  sources: SourceBias[];
  unknown_sources: string[];
}

// Colors for bias categories
const BIAS_COLORS = {
  'FL': '#1D4ED8', // Far Left - Deep Blue
  'L': '#3B82F6',  // Left - Blue
  'C': '#6B7280',  // Center - Gray
  'R': '#EF4444',  // Right - Red
  'FR': '#991B1B', // Far Right - Deep Red
};

const BIAS_LABELS = {
  'FL': 'Très à gauche',
  'L': 'Gauche',
  'C': 'Centre',
  'R': 'Droite',
  'FR': 'Très à droite',
};

interface BiasIndicatorProps {
  synthesisId: string;
  sources?: string[];
  compact?: boolean;
  showDetails?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function BiasIndicator({
  synthesisId,
  sources,
  compact = false,
  showDetails = true
}: BiasIndicatorProps) {
  const { theme, darkMode } = useTheme();
  const [balance, setBalance] = useState<SynthesisBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchBias = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/syntheses/by-id/${synthesisId}/bias`);

        if (!response.ok) {
          throw new Error('Failed to fetch bias data');
        }

        const data = await response.json();
        setBalance(data);
      } catch (err) {
        console.error('Bias fetch error:', err);
        setError('Analyse indisponible');
      } finally {
        setLoading(false);
      }
    };

    fetchBias();
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
          borderTopColor: '#3B82F6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ fontSize: '12px', color: theme.textSecondary }}>
          Analyse des sources...
        </span>
      </div>
    );
  }

  if (error || !balance) {
    return null; // Silently fail - bias is optional
  }

  const { left_count, center_count, right_count, balance_score, coverage_label } = balance;
  const total = left_count + center_count + right_count;

  if (total === 0) {
    return null;
  }

  // Calculate percentages for the bar
  const leftPct = (left_count / total) * 100;
  const centerPct = (center_count / total) * 100;
  const rightPct = (right_count / total) * 100;

  // Get color for balance score
  const getScoreColor = (score: number) => {
    if (score >= 70) return '#10B981'; // Green - balanced
    if (score >= 50) return '#F59E0B'; // Yellow - somewhat balanced
    return '#EF4444'; // Red - one-sided
  };

  if (compact) {
    // Compact version - just the bar
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        {/* Mini bar */}
        <div style={{
          display: 'flex',
          width: '60px',
          height: '6px',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          {leftPct > 0 && (
            <div style={{ width: `${leftPct}%`, backgroundColor: BIAS_COLORS['L'] }} />
          )}
          {centerPct > 0 && (
            <div style={{ width: `${centerPct}%`, backgroundColor: BIAS_COLORS['C'] }} />
          )}
          {rightPct > 0 && (
            <div style={{ width: `${rightPct}%`, backgroundColor: BIAS_COLORS['R'] }} />
          )}
        </div>
        {/* Score badge */}
        <span style={{
          fontSize: '10px',
          fontWeight: '600',
          color: getScoreColor(balance_score),
        }}>
          {Math.round(balance_score)}%
        </span>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: darkMode ? '#1F2937' : '#F9FAFB',
      border: `1px solid ${theme.border}`,
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
          <span style={{ fontSize: '16px' }}>⚖️</span>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: theme.textSecondary,
          }}>
            Diversité des sources
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          backgroundColor: `${getScoreColor(balance_score)}15`,
          borderRadius: '12px',
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '700',
            color: getScoreColor(balance_score),
          }}>
            {Math.round(balance_score)}%
          </span>
          <span style={{
            fontSize: '11px',
            color: getScoreColor(balance_score),
          }}>
            {coverage_label}
          </span>
        </div>
      </div>

      {/* Bias Bar */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          height: '24px',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: theme.border,
        }}>
          {leftPct > 0 && (
            <div
              style={{
                width: `${leftPct}%`,
                backgroundColor: BIAS_COLORS['L'],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'width 0.3s ease',
              }}
              title={`${left_count} source(s) de gauche`}
            >
              {leftPct >= 15 && (
                <span style={{ color: 'white', fontSize: '11px', fontWeight: '600' }}>
                  {left_count}
                </span>
              )}
            </div>
          )}
          {centerPct > 0 && (
            <div
              style={{
                width: `${centerPct}%`,
                backgroundColor: BIAS_COLORS['C'],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'width 0.3s ease',
              }}
              title={`${center_count} source(s) au centre`}
            >
              {centerPct >= 15 && (
                <span style={{ color: 'white', fontSize: '11px', fontWeight: '600' }}>
                  {center_count}
                </span>
              )}
            </div>
          )}
          {rightPct > 0 && (
            <div
              style={{
                width: `${rightPct}%`,
                backgroundColor: BIAS_COLORS['R'],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'width 0.3s ease',
              }}
              title={`${right_count} source(s) de droite`}
            >
              {rightPct >= 15 && (
                <span style={{ color: 'white', fontSize: '11px', fontWeight: '600' }}>
                  {right_count}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '6px',
          fontSize: '10px',
          color: theme.textSecondary,
        }}>
          <span style={{ color: BIAS_COLORS['L'] }}>← Gauche</span>
          <span style={{ color: BIAS_COLORS['C'] }}>Centre</span>
          <span style={{ color: BIAS_COLORS['R'] }}>Droite →</span>
        </div>
      </div>

      {/* Reliability indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingTop: '12px',
        borderTop: `1px solid ${theme.border}`,
      }}>
        <span style={{ fontSize: '12px', color: theme.textSecondary }}>
          Fiabilité moyenne:
        </span>
        <div style={{
          display: 'flex',
          gap: '2px',
        }}>
          {[1, 2, 3, 4, 5].map(star => (
            <span
              key={star}
              style={{
                fontSize: '12px',
                color: star <= Math.round(balance.average_reliability)
                  ? '#F59E0B'
                  : theme.border,
              }}
            >
              ★
            </span>
          ))}
        </div>
        <span style={{ fontSize: '11px', color: theme.textSecondary }}>
          ({balance.average_reliability.toFixed(1)}/5)
        </span>
      </div>

      {/* Expandable source details */}
      {showDetails && balance.sources.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: '100%',
              marginTop: '12px',
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
            <span>{expanded ? 'Masquer les détails' : `Voir les ${balance.sources.length} sources analysées`}</span>
          </button>

          {expanded && (
            <div style={{
              marginTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {balance.sources.map((source, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: darkMode ? '#111827' : '#FFFFFF',
                    borderRadius: '4px',
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Bias badge */}
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: `${BIAS_COLORS[source.bias_code as keyof typeof BIAS_COLORS]}20`,
                      color: BIAS_COLORS[source.bias_code as keyof typeof BIAS_COLORS],
                    }}>
                      {source.bias_code}
                    </span>
                    {/* Source name */}
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: theme.text,
                    }}>
                      {source.name}
                    </span>
                  </div>
                  {/* Reliability */}
                  <div style={{
                    fontSize: '11px',
                    color: theme.textSecondary,
                  }}>
                    {source.reliability_label}
                  </div>
                </div>
              ))}

              {/* Unknown sources */}
              {balance.unknown_sources.length > 0 && (
                <div style={{
                  fontSize: '11px',
                  color: theme.textSecondary,
                  fontStyle: 'italic',
                  marginTop: '8px',
                }}>
                  {balance.unknown_sources.length} source(s) non analysée(s): {balance.unknown_sources.join(', ')}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Compact inline bias badge for cards
 */
interface BiasBadgeProps {
  balance: SynthesisBalance;
}

export function BiasBadge({ balance }: BiasBadgeProps) {
  const { theme } = useTheme();

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      backgroundColor: `${getScoreColor(balance.balance_score)}15`,
      borderRadius: '10px',
      fontSize: '10px',
      fontWeight: '600',
    }}>
      <span>⚖️</span>
      <span style={{ color: getScoreColor(balance.balance_score) }}>
        {Math.round(balance.balance_score)}%
      </span>
    </div>
  );
}

export default BiasIndicator;
