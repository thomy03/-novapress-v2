"use client";

/**
 * WhatIfExplorer - Counterfactual scenario explorer
 * Shows "What if X didn't happen?" scenarios based on causal graph analysis
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Scenario {
  id: string;
  hypothesis: string;
  original_event: string;
  counterfactual_outcome: string;
  affected_events: string[];
  confidence: number;
  reasoning: string;
  probability: number;
}

interface KeyEvent {
  id: string;
  text: string;
  type: string;
  importance: number;
  sources_count: number;
}

interface WhatIfData {
  synthesis_id: string;
  title: string;
  key_events: KeyEvent[];
  scenarios: Scenario[];
  causal_dependencies: Array<{
    cause: string;
    effect: string;
    type: string;
    confidence: number;
  }>;
  total_scenarios: number;
  methodology_note: string;
}

interface WhatIfExplorerProps {
  synthesisId: string;
  compact?: boolean;
}

export function WhatIfExplorer({ synthesisId, compact = false }: WhatIfExplorerProps) {
  const { theme, darkMode } = useTheme();
  const [data, setData] = useState<WhatIfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchWhatIf = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${API_URL}/api/syntheses/by-id/${synthesisId}/whatif?max_scenarios=5`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch what-if data');
        }

        const result = await response.json();
        setData(result);

        // Auto-select first scenario
        if (result.scenarios && result.scenarios.length > 0) {
          setSelectedScenario(result.scenarios[0]);
        }
      } catch (err) {
        console.error('What-if fetch error:', err);
        setError('Analyse indisponible');
      } finally {
        setLoading(false);
      }
    };

    fetchWhatIf();
  }, [synthesisId]);

  if (loading) {
    return (
      <div style={{
        padding: compact ? '8px' : '16px',
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
          borderTopColor: '#F59E0B',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ fontSize: '12px', color: theme.textSecondary }}>
          Génération des scénarios...
        </span>
      </div>
    );
  }

  if (error || !data || data.scenarios.length === 0) {
    return null; // Silently fail - what-if is optional
  }

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        backgroundColor: darkMode ? '#1F2937' : '#FEF3C7',
        borderRadius: '20px',
      }}>
        <span>🔮</span>
        <span style={{ fontSize: '11px', color: theme.text }}>
          {data.total_scenarios} scénario{data.total_scenarios > 1 ? 's' : ''} alternatif{data.total_scenarios > 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: darkMode ? '#1F2937' : '#FFFBEB',
      border: `1px solid ${darkMode ? '#374151' : '#FDE68A'}`,
      borderRadius: '12px',
      padding: '20px',
      marginTop: '24px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>🔮</span>
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: theme.text,
            }}>
              Scénarios Alternatifs
            </div>
            <div style={{
              fontSize: '11px',
              color: theme.textSecondary,
            }}>
              Et si les choses s'étaient passées différemment ?
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: '6px 12px',
            backgroundColor: darkMode ? '#374151' : '#FEF3C7',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            color: theme.text,
          }}
        >
          {expanded ? 'Réduire' : 'Voir tout'}
        </button>
      </div>

      {/* Key Events Pills */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '20px',
      }}>
        {data.key_events.slice(0, expanded ? 10 : 5).map((event, idx) => (
          <button
            key={event.id}
            onClick={() => {
              const scenario = data.scenarios.find(s =>
                s.original_event.includes(event.text.slice(0, 30)) ||
                event.text.includes(s.original_event.slice(0, 30))
              );
              if (scenario) setSelectedScenario(scenario);
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: darkMode ? '#374151' : '#FFFFFF',
              border: `1px solid ${darkMode ? '#4B5563' : '#FDE68A'}`,
              borderRadius: '16px',
              cursor: 'pointer',
              fontSize: '11px',
              color: theme.text,
              maxWidth: '200px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'all 0.2s',
            }}
            title={event.text}
          >
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: getImportanceColor(event.importance),
              marginRight: '6px',
            }} />
            {event.text.slice(0, 40)}{event.text.length > 40 ? '...' : ''}
          </button>
        ))}
      </div>

      {/* Scenario Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: expanded ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr',
        gap: '16px',
      }}>
        {data.scenarios.slice(0, expanded ? 10 : 3).map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            isSelected={selectedScenario?.id === scenario.id}
            onClick={() => setSelectedScenario(scenario)}
            theme={theme}
            darkMode={darkMode}
          />
        ))}
      </div>

      {/* Selected Scenario Detail */}
      {selectedScenario && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: darkMode ? '#111827' : '#FFFFFF',
          borderRadius: '8px',
          border: `1px solid ${darkMode ? '#374151' : '#FDE68A'}`,
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#F59E0B',
            marginBottom: '12px',
          }}>
            {selectedScenario.hypothesis}
          </div>

          <div style={{
            fontSize: '14px',
            color: theme.text,
            lineHeight: '1.6',
            marginBottom: '12px',
          }}>
            {selectedScenario.counterfactual_outcome}
          </div>

          {selectedScenario.affected_events.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '600',
                color: theme.textSecondary,
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}>
                Événements impactés
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                {selectedScenario.affected_events.map((event, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: '12px',
                      color: theme.text,
                      padding: '6px 10px',
                      backgroundColor: darkMode ? '#1F2937' : '#FEF3C7',
                      borderRadius: '4px',
                      borderLeft: '3px solid #F59E0B',
                    }}
                  >
                    {event}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '11px',
            color: theme.textSecondary,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Confiance:</span>
              <span style={{
                color: getConfidenceColor(selectedScenario.confidence),
                fontWeight: '600',
              }}>
                {Math.round(selectedScenario.confidence * 100)}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Probabilité:</span>
              <span style={{
                color: '#8B5CF6',
                fontWeight: '600',
              }}>
                {Math.round(selectedScenario.probability * 100)}%
              </span>
            </div>
          </div>

          <div style={{
            marginTop: '12px',
            fontSize: '11px',
            fontStyle: 'italic',
            color: theme.textSecondary,
          }}>
            {selectedScenario.reasoning}
          </div>
        </div>
      )}

      {/* Methodology note */}
      <div style={{
        marginTop: '16px',
        fontSize: '10px',
        color: theme.textSecondary,
        fontStyle: 'italic',
        paddingTop: '12px',
        borderTop: `1px solid ${theme.border}`,
      }}>
        {data.methodology_note}
      </div>
    </div>
  );
}

// Scenario card component
function ScenarioCard({
  scenario,
  isSelected,
  onClick,
  theme,
  darkMode
}: {
  scenario: Scenario;
  isSelected: boolean;
  onClick: () => void;
  theme: any;
  darkMode: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '14px',
        backgroundColor: isSelected
          ? (darkMode ? '#374151' : '#FEF3C7')
          : (darkMode ? '#111827' : '#FFFFFF'),
        borderRadius: '8px',
        border: `2px solid ${isSelected ? '#F59E0B' : theme.border}`,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s',
      }}
    >
      <div style={{
        fontSize: '12px',
        fontWeight: '600',
        color: '#F59E0B',
        marginBottom: '8px',
      }}>
        🔮 {scenario.hypothesis.slice(0, 60)}{scenario.hypothesis.length > 60 ? '...' : ''}
      </div>

      <div style={{
        fontSize: '12px',
        color: theme.text,
        lineHeight: '1.5',
        marginBottom: '8px',
      }}>
        {scenario.counterfactual_outcome.slice(0, 100)}
        {scenario.counterfactual_outcome.length > 100 ? '...' : ''}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: theme.textSecondary,
      }}>
        <span>
          {scenario.affected_events.length} impact{scenario.affected_events.length > 1 ? 's' : ''}
        </span>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{
            padding: '2px 6px',
            backgroundColor: `${getConfidenceColor(scenario.confidence)}20`,
            color: getConfidenceColor(scenario.confidence),
            borderRadius: '4px',
            fontWeight: '600',
          }}>
            {Math.round(scenario.confidence * 100)}%
          </span>
        </div>
      </div>
    </button>
  );
}

// Helper functions
function getImportanceColor(importance: number): string {
  if (importance >= 0.8) return '#EF4444';
  if (importance >= 0.6) return '#F59E0B';
  return '#10B981';
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return '#10B981';
  if (confidence >= 0.5) return '#F59E0B';
  return '#6B7280';
}

export default WhatIfExplorer;
