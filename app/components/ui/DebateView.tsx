"use client";

/**
 * DebateView - Shows PRO/CON arguments for controversial topics
 * Inspired by AllSides but with automatic AI extraction
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Argument {
  text: string;
  side: 'pro' | 'con';
  source: string | null;
  confidence: number;
  entities: string[];
}

interface DebateData {
  is_controversial: boolean;
  controversy_score: number;
  topic: string;
  pro_arguments: Argument[];
  con_arguments: Argument[];
  neutral_points: string[];
  total_arguments: number;
  methodology_note: string;
}

interface DebateViewProps {
  synthesisId: string;
  compact?: boolean;
}

export function DebateView({ synthesisId, compact = false }: DebateViewProps) {
  const { theme, darkMode } = useTheme();
  const [debate, setDebate] = useState<DebateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchDebate = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/syntheses/by-id/${synthesisId}/debate`);

        if (!response.ok) {
          throw new Error('Failed to fetch debate data');
        }

        const data = await response.json();
        setDebate(data);
      } catch (err) {
        console.error('Debate fetch error:', err);
        setError('Analyse indisponible');
      } finally {
        setLoading(false);
      }
    };

    fetchDebate();
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
          borderTopColor: '#8B5CF6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ fontSize: '12px', color: theme.textSecondary }}>
          Analyse des arguments...
        </span>
      </div>
    );
  }

  if (error || !debate || !debate.is_controversial) {
    return null; // Silently fail - debate mode is optional
  }

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        backgroundColor: darkMode ? '#1F2937' : '#F3E8FF',
        borderRadius: '20px',
      }}>
        <span>⚖️</span>
        <span style={{ fontSize: '11px', color: theme.text }}>
          Débat: {debate.pro_arguments.length} pour / {debate.con_arguments.length} contre
        </span>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: darkMode ? '#1F2937' : '#F5F3FF',
      border: `1px solid ${darkMode ? '#374151' : '#DDD6FE'}`,
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>⚖️</span>
          <div>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: theme.textSecondary,
            }}>
              Mode Débat
            </span>
            <div style={{
              fontSize: '11px',
              color: theme.textSecondary,
            }}>
              {debate.topic}
            </div>
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          backgroundColor: `#8B5CF615`,
          borderRadius: '12px',
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#8B5CF6',
          }}>
            {Math.round(debate.controversy_score * 100)}%
          </span>
          <span style={{
            fontSize: '10px',
            color: '#8B5CF6',
          }}>
            controversé
          </span>
        </div>
      </div>

      {/* Arguments Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '16px',
      }}>
        {/* PRO Arguments */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            padding: '8px 12px',
            backgroundColor: '#10B98115',
            borderRadius: '6px',
          }}>
            <span style={{ fontSize: '16px' }}>✓</span>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#10B981',
              textTransform: 'uppercase',
            }}>
              Pour ({debate.pro_arguments.length})
            </span>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {debate.pro_arguments.map((arg, idx) => (
              <ArgumentCard
                key={idx}
                argument={arg}
                theme={theme}
                darkMode={darkMode}
              />
            ))}
            {debate.pro_arguments.length === 0 && (
              <div style={{
                fontSize: '12px',
                color: theme.textSecondary,
                fontStyle: 'italic',
                padding: '12px',
              }}>
                Aucun argument identifié
              </div>
            )}
          </div>
        </div>

        {/* CON Arguments */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
            padding: '8px 12px',
            backgroundColor: '#EF444415',
            borderRadius: '6px',
          }}>
            <span style={{ fontSize: '16px' }}>✕</span>
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#EF4444',
              textTransform: 'uppercase',
            }}>
              Contre ({debate.con_arguments.length})
            </span>
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {debate.con_arguments.map((arg, idx) => (
              <ArgumentCard
                key={idx}
                argument={arg}
                theme={theme}
                darkMode={darkMode}
              />
            ))}
            {debate.con_arguments.length === 0 && (
              <div style={{
                fontSize: '12px',
                color: theme.textSecondary,
                fontStyle: 'italic',
                padding: '12px',
              }}>
                Aucun argument identifié
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Neutral Points */}
      {debate.neutral_points.length > 0 && (
        <div style={{
          padding: '12px',
          backgroundColor: darkMode ? '#111827' : '#FFFFFF',
          borderRadius: '8px',
          marginBottom: '12px',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            color: theme.textSecondary,
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            Points factuels
          </div>
          <ul style={{
            margin: 0,
            padding: '0 0 0 16px',
            fontSize: '13px',
            color: theme.text,
          }}>
            {debate.neutral_points.map((point, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Methodology note */}
      <div style={{
        fontSize: '10px',
        color: theme.textSecondary,
        fontStyle: 'italic',
        paddingTop: '12px',
        borderTop: `1px solid ${theme.border}`,
      }}>
        {debate.methodology_note}
      </div>
    </div>
  );
}

// Argument card component
function ArgumentCard({
  argument,
  theme,
  darkMode
}: {
  argument: Argument;
  theme: any;
  darkMode: boolean;
}) {
  const sideColor = argument.side === 'pro' ? '#10B981' : '#EF4444';

  return (
    <div style={{
      padding: '12px',
      backgroundColor: darkMode ? '#111827' : '#FFFFFF',
      borderRadius: '6px',
      borderLeft: `3px solid ${sideColor}`,
    }}>
      <p style={{
        margin: '0 0 8px 0',
        fontSize: '13px',
        color: theme.text,
        lineHeight: '1.5',
      }}>
        {argument.text}
      </p>
      {argument.source && (
        <div style={{
          fontSize: '11px',
          color: theme.textSecondary,
        }}>
          — {argument.source}
        </div>
      )}
      {argument.entities.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '4px',
          marginTop: '6px',
          flexWrap: 'wrap',
        }}>
          {argument.entities.map((entity, idx) => (
            <span
              key={idx}
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                backgroundColor: darkMode ? '#374151' : '#F3F4F6',
                borderRadius: '4px',
                color: theme.textSecondary,
              }}
            >
              {entity}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default DebateView;
