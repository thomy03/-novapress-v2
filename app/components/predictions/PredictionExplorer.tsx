'use client';

import React, { useState, useEffect } from 'react';
import {
  Prediction,
  PredictionsResponse,
  PredictionType,
  PredictionTimeframe,
  PREDICTION_TYPE_CONFIG,
  TIMEFRAME_CONFIG
} from '@/app/types/causal';
import { causalService } from '@/app/lib/api/services/causal';

interface PredictionExplorerProps {
  synthesisId: string;
  compact?: boolean;
}

export default function PredictionExplorer({ synthesisId, compact = false }: PredictionExplorerProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<PredictionType | 'all'>('all');
  const [activeTimeframeFilter, setActiveTimeframeFilter] = useState<PredictionTimeframe | 'all'>('all');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  // State for Side Panel
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setLoading(true);
        const response = await causalService.getPredictions(synthesisId);
        setPredictions(response.predictions);
      } catch (err) {
        setError('Impossible de charger les predictions');
        console.error('Failed to fetch predictions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
  }, [synthesisId]);

  // Filter predictions
  const filteredPredictions = predictions.filter(p => {
    const typeMatch = activeTypeFilter === 'all' || p.type === activeTypeFilter;
    const timeframeMatch = activeTimeframeFilter === 'all' || p.timeframe === activeTimeframeFilter;
    return typeMatch && timeframeMatch;
  });

  // Get unique types present in predictions
  const availableTypes = [...new Set(predictions.map(p => p.type))];

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingState}>
          Chargement des scenarios...
        </div>
      </div>
    );
  }

  if (error || predictions.length === 0) {
    if (compact) return null;
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>🔮</span>
          <span style={styles.emptyText}>Aucun scenario futur disponible</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>
          <span style={styles.titleIcon}>🔮</span>
          Scenarios Futurs
        </h3>
        <span style={styles.count}>{predictions.length} prediction{predictions.length > 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      {!compact && predictions.length > 1 && (
        <div style={styles.filtersContainer}>
          {/* Type Filter */}
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Type:</span>
            <div style={styles.filterTabs}>
              <button
                style={{
                  ...styles.filterTab,
                  ...(activeTypeFilter === 'all' ? styles.filterTabActive : {})
                }}
                onClick={() => setActiveTypeFilter('all')}
              >
                Tous
              </button>
              {availableTypes.map(type => {
                const config = PREDICTION_TYPE_CONFIG[type] || PREDICTION_TYPE_CONFIG.general;
                return (
                  <button
                    key={type}
                    style={{
                      ...styles.filterTab,
                      ...(activeTypeFilter === type ? {
                        ...styles.filterTabActive,
                        backgroundColor: config.bgColor,
                        color: config.color,
                        borderColor: config.color
                      } : {})
                    }}
                    onClick={() => setActiveTypeFilter(type)}
                  >
                    {config.icon} {config.labelFr}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timeframe Filter */}
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Horizon:</span>
            <div style={styles.filterTabs}>
              <button
                style={{
                  ...styles.filterTab,
                  ...(activeTimeframeFilter === 'all' ? styles.filterTabActive : {})
                }}
                onClick={() => setActiveTimeframeFilter('all')}
              >
                Tous
              </button>
              {(['court_terme', 'moyen_terme', 'long_terme'] as PredictionTimeframe[]).map(tf => {
                const config = TIMEFRAME_CONFIG[tf];
                return (
                  <button
                    key={tf}
                    style={{
                      ...styles.filterTab,
                      ...(activeTimeframeFilter === tf ? {
                        ...styles.filterTabActive,
                        borderColor: config.color
                      } : {})
                    }}
                    onClick={() => setActiveTimeframeFilter(tf)}
                  >
                    {config.labelFr}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Predictions List */}
      <div style={styles.predictionsList}>
        {filteredPredictions.map((prediction, index) => (
          <PredictionCard
            key={index}
            prediction={prediction}
            isExpanded={expandedIndex === index}
            onToggle={() => setExpandedIndex(expandedIndex === index ? null : index)}
            compact={compact}
            onOpenDetail={() => setSelectedPrediction(prediction)}
          />
        ))}
      </div>

      {filteredPredictions.length === 0 && predictions.length > 0 && (
        <div style={styles.noResults}>
          Aucune prediction ne correspond aux filtres selectionnes
        </div>
      )}

      {/* Side Panel Overlay */}
      {selectedPrediction && (
        <div
          style={styles.panelOverlay}
          onClick={() => setSelectedPrediction(null)}
        >
          {/* Backdrop with blur */}
          <div style={styles.panelBackdrop} />

          {/* Side Panel */}
          <div
            style={styles.sidePanel}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              style={styles.panelCloseButton}
              onClick={() => setSelectedPrediction(null)}
            >
              ✕
            </button>

            {/* Panel Header */}
            <div style={styles.panelHeader}>
              <span
                style={{
                  ...styles.panelTypeBadge,
                  backgroundColor: (PREDICTION_TYPE_CONFIG[selectedPrediction.type] || PREDICTION_TYPE_CONFIG.general).bgColor,
                  color: (PREDICTION_TYPE_CONFIG[selectedPrediction.type] || PREDICTION_TYPE_CONFIG.general).color
                }}
              >
                {(PREDICTION_TYPE_CONFIG[selectedPrediction.type] || PREDICTION_TYPE_CONFIG.general).icon}{' '}
                {(PREDICTION_TYPE_CONFIG[selectedPrediction.type] || PREDICTION_TYPE_CONFIG.general).labelFr}
              </span>
              <span
                style={{
                  ...styles.panelTimeframeBadge,
                  borderColor: (TIMEFRAME_CONFIG[selectedPrediction.timeframe] || TIMEFRAME_CONFIG.moyen_terme).color,
                  color: (TIMEFRAME_CONFIG[selectedPrediction.timeframe] || TIMEFRAME_CONFIG.moyen_terme).color
                }}
              >
                {(TIMEFRAME_CONFIG[selectedPrediction.timeframe] || TIMEFRAME_CONFIG.moyen_terme).labelFr}
              </span>
            </div>

            {/* Full Prediction Text */}
            <p style={styles.panelPredictionText}>
              {selectedPrediction.prediction}
            </p>

            {/* Probability Section */}
            <div style={styles.panelProbabilitySection}>
              <div style={styles.panelProbabilityHeader}>
                <span style={styles.panelProbabilityLabel}>Probabilité estimée</span>
                <span
                  style={{
                    ...styles.panelProbabilityValue,
                    color: selectedPrediction.probability >= 0.7 ? '#10B981' :
                           selectedPrediction.probability >= 0.4 ? '#F59E0B' : '#EF4444'
                  }}
                >
                  {Math.round(selectedPrediction.probability * 100)}%
                </span>
              </div>
              <div style={styles.panelProbabilityBar}>
                <div
                  style={{
                    ...styles.panelProbabilityFill,
                    width: `${Math.round(selectedPrediction.probability * 100)}%`,
                    backgroundColor: selectedPrediction.probability >= 0.7 ? '#10B981' :
                                     selectedPrediction.probability >= 0.4 ? '#F59E0B' : '#EF4444'
                  }}
                />
              </div>
            </div>

            {/* Rationale */}
            {selectedPrediction.rationale && (
              <div style={styles.panelRationaleSection}>
                <h4 style={styles.panelRationaleTitle}>Raisonnement</h4>
                <p style={styles.panelRationaleText}>
                  {selectedPrediction.rationale}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// PredictionCard Sub-component
// ==========================================

interface PredictionCardProps {
  prediction: Prediction;
  isExpanded: boolean;
  onToggle: () => void;
  compact: boolean;
  onOpenDetail: () => void;
}

function PredictionCard({ prediction, isExpanded, onToggle, compact, onOpenDetail }: PredictionCardProps) {
  const typeConfig = PREDICTION_TYPE_CONFIG[prediction.type] || PREDICTION_TYPE_CONFIG.general;
  const timeframeConfig = TIMEFRAME_CONFIG[prediction.timeframe] || TIMEFRAME_CONFIG.moyen_terme;

  // Convert probability to percentage
  const probabilityPercent = Math.round(prediction.probability * 100);

  // Get probability color
  const getProbabilityColor = (prob: number) => {
    if (prob >= 0.7) return '#10B981';
    if (prob >= 0.4) return '#F59E0B';
    return '#EF4444';
  };

  const probColor = getProbabilityColor(prediction.probability);

  // Truncate text in compact mode if too long
  const TEXT_LIMIT = 150;
  const isTextLong = prediction.prediction.length > TEXT_LIMIT;
  const displayText = compact && isTextLong
    ? prediction.prediction.slice(0, TEXT_LIMIT) + '...'
    : prediction.prediction;

  return (
    <div style={styles.predictionCard}>
      {/* Type Badge & Timeframe */}
      <div style={styles.cardHeader}>
        <span
          style={{
            ...styles.typeBadge,
            backgroundColor: typeConfig.bgColor,
            color: typeConfig.color
          }}
        >
          {typeConfig.icon} {typeConfig.labelFr}
        </span>
        <span
          style={{
            ...styles.timeframeBadge,
            borderColor: timeframeConfig.color,
            color: timeframeConfig.color
          }}
        >
          {timeframeConfig.labelFr}
        </span>
      </div>

      {/* Prediction Text - with "Voir détail" for Side Panel */}
      <p style={styles.predictionText}>
        {displayText}
        {isTextLong && (
          <button
            onClick={onOpenDetail}
            style={styles.expandTextButton}
          >
            Voir détail →
          </button>
        )}
      </p>

      {/* Probability Bar */}
      <div style={styles.probabilityContainer}>
        <div style={styles.probabilityHeader}>
          <span style={styles.probabilityLabel}>Probabilité</span>
          <span style={{ ...styles.probabilityValue, color: probColor }}>
            {probabilityPercent}%
          </span>
        </div>
        <div style={styles.probabilityBarBg}>
          <div
            style={{
              ...styles.probabilityBarFill,
              width: `${probabilityPercent}%`,
              backgroundColor: probColor
            }}
          />
        </div>
      </div>

      {/* Rationale (expandable) - only in non-compact mode */}
      {prediction.rationale && !compact && (
        <div style={styles.rationaleContainer}>
          <button style={styles.rationaleToggle} onClick={onToggle}>
            {isExpanded ? '▼' : '▶'} Voir le raisonnement
          </button>
          {isExpanded && (
            <div style={styles.rationaleContent}>
              {prediction.rationale}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Styles - Newspaper Style Theme (NYT, Le Monde)
// ==========================================

const styles: { [key: string]: React.CSSProperties } = {
  // Container
  container: {
    backgroundColor: 'transparent',
    padding: '0',
    marginTop: '0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid #E5E5E5',
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#000000',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'Georgia, serif',
  },
  titleIcon: {
    fontSize: '18px',
  },
  count: {
    fontSize: '12px',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    padding: '4px 10px',
    borderRadius: '12px',
  },

  // Filters
  filtersContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #E5E5E5',
  },
  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: '500',
    minWidth: '50px',
  },
  filterTabs: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  filterTab: {
    padding: '5px 10px',
    fontSize: '11px',
    fontWeight: '500',
    border: '1px solid #E5E5E5',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    color: '#6B7280',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  filterTabActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
    color: '#FFFFFF',
  },

  // Predictions List
  predictionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  predictionCard: {
    backgroundColor: '#FFFFFF',
    padding: '14px',
    border: '1px solid #E5E5E5',
    transition: 'border-color 0.2s ease',
  },
  cardHeader: {
    display: 'flex',
    gap: '8px',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },
  typeBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  timeframeBadge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '500',
    backgroundColor: 'transparent',
    border: '1px solid',
  },
  predictionText: {
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#374151',
    margin: '0 0 10px 0',
  },
  expandTextButton: {
    background: 'none',
    border: 'none',
    color: '#2563EB',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    padding: 0,
    marginLeft: '4px',
  },

  // Probability
  probabilityContainer: {
    marginTop: '10px',
  },
  probabilityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  probabilityLabel: {
    fontSize: '11px',
    color: '#6B7280',
  },
  probabilityValue: {
    fontSize: '13px',
    fontWeight: '600',
  },
  probabilityBarBg: {
    height: '4px',
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
  },
  probabilityBarFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },

  // Rationale
  rationaleContainer: {
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #E5E5E5',
  },
  rationaleToggle: {
    background: 'none',
    border: 'none',
    color: '#2563EB',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
    fontWeight: '500',
  },
  rationaleContent: {
    marginTop: '8px',
    fontSize: '12px',
    lineHeight: '1.6',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    padding: '12px',
    border: '1px solid #E5E5E5',
  },

  // States
  loadingState: {
    textAlign: 'center',
    padding: '24px',
    color: '#6B7280',
    fontSize: '13px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px',
    color: '#6B7280',
  },
  emptyIcon: {
    fontSize: '28px',
    marginBottom: '8px',
    opacity: 0.5,
  },
  emptyText: {
    fontSize: '12px',
  },
  noResults: {
    textAlign: 'center',
    padding: '16px',
    color: '#6B7280',
    fontSize: '12px',
    fontStyle: 'italic',
  },

  // ==========================================
  // Side Panel Styles
  // ==========================================
  panelOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  panelBackdrop: {
    position: 'absolute',
    inset: 0,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  sidePanel: {
    position: 'relative',
    width: '420px',
    maxWidth: '90vw',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderLeft: '1px solid #E5E5E5',
    padding: '24px',
    overflowY: 'auto',
    animation: 'slideInFromRight 0.3s ease-out',
  },
  panelCloseButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'none',
    border: 'none',
    color: '#6B7280',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'all 0.2s',
  },
  panelHeader: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    marginTop: '8px',
    flexWrap: 'wrap',
  },
  panelTypeBadge: {
    padding: '6px 14px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '600',
  },
  panelTimeframeBadge: {
    padding: '6px 14px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: 'transparent',
    border: '1px solid',
  },
  panelPredictionText: {
    fontSize: '15px',
    lineHeight: '1.7',
    color: '#000000',
    margin: '0 0 24px 0',
    fontFamily: 'Georgia, serif',
  },
  panelProbabilitySection: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
  },
  panelProbabilityHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  panelProbabilityLabel: {
    fontSize: '13px',
    color: '#6B7280',
    fontWeight: '500',
  },
  panelProbabilityValue: {
    fontSize: '20px',
    fontWeight: '700',
  },
  panelProbabilityBar: {
    height: '8px',
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
  },
  panelProbabilityFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  panelRationaleSection: {
    padding: '16px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
  },
  panelRationaleTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#000000',
    margin: '0 0 12px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  panelRationaleText: {
    fontSize: '14px',
    lineHeight: '1.7',
    color: '#6B7280',
    margin: 0,
  },
};
