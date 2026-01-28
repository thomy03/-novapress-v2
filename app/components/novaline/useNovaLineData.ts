'use client';

import { useState, useEffect, useCallback } from 'react';
import { timelineService } from '@/app/lib/api/services/timeline';
import { causalService } from '@/app/lib/api/services/causal';
import {
  NovaLineData,
  NovaLinePoint,
  NovaLinePrediction,
  calculateTension,
  formatNovaLineDate,
  PHASE_TENSION,
} from '@/app/types/novaline';
import { TimelineResponse, ContradictionItem } from '@/app/types/timeline';
import { PredictionsResponse, Prediction } from '@/app/types/causal';

interface UseNovaLineDataResult {
  data: NovaLineData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to fetch and transform timeline + predictions data for NovaLine
 * Combines data from time-traveler and causal APIs
 */
export function useNovaLineData(
  synthesisId: string,
  category: string
): UseNovaLineDataResult {
  const [data, setData] = useState<NovaLineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!synthesisId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch timeline and predictions in parallel
      const [timelineResponse, predictionsResponse] = await Promise.allSettled([
        timelineService.getTimeline(synthesisId),
        causalService.getPredictions(synthesisId),
      ]);

      // Process timeline data
      let timeline: TimelineResponse | null = null;
      if (timelineResponse.status === 'fulfilled') {
        timeline = timelineResponse.value;
      }

      // Process predictions data
      let predictions: PredictionsResponse | null = null;
      if (predictionsResponse.status === 'fulfilled') {
        predictions = predictionsResponse.value;
      }

      // Transform to NovaLine format
      const novaLineData = transformToNovaLineData(
        synthesisId,
        category,
        timeline,
        predictions
      );

      setData(novaLineData);
    } catch (err) {
      console.error('Error fetching NovaLine data:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setIsLoading(false);
    }
  }, [synthesisId, category]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

/**
 * Transform API responses to NovaLine data format
 */
function transformToNovaLineData(
  synthesisId: string,
  category: string,
  timeline: TimelineResponse | null,
  predictions: PredictionsResponse | null
): NovaLineData {
  const points: NovaLinePoint[] = [];
  const contradictionsMap = new Map<string, ContradictionItem>();

  // Map contradictions by date for quick lookup (filter out invalid ones)
  if (timeline?.contradictions) {
    timeline.contradictions.forEach((c) => {
      // Filter out invalid contradictions:
      // - Empty or "-" claims
      // - Claim that equals the synthesis title (not a real contradiction)
      const isValidContradiction =
        c.claim_a && c.claim_a !== '-' && c.claim_a.trim().length > 5 &&
        c.claim_b && c.claim_b !== '-' && c.claim_b.trim().length > 5 &&
        c.claim_a !== timeline.current_title &&
        c.claim_b !== timeline.current_title;

      if (isValidContradiction) {
        const dateKey = c.date.split('T')[0];
        contradictionsMap.set(dateKey, c);
      }
    });
  }

  // Transform timeline events to points
  if (timeline?.timeline) {
    timeline.timeline.forEach((event, index) => {
      const dateKey = event.date.split('T')[0];
      const contradiction = contradictionsMap.get(dateKey);
      const isLast = index === timeline.timeline.length - 1;

      points.push({
        id: `past-${index}`,
        date: event.date,
        dateFormatted: formatNovaLineDate(event.date),
        title: event.title,
        summary: event.summary,
        tension: calculateTension(event.narrative_phase, category, event.fact_density),
        phase: event.narrative_phase,
        factDensity: event.fact_density,
        sources: event.sources,
        synthesisId: event.synthesis_id,
        isPresent: isLast,
        isFuture: false,
        hasContradiction: !!contradiction,
        contradiction,
      });
    });
  }

  // If no timeline data, create a single "present" point
  if (points.length === 0) {
    points.push({
      id: 'present-0',
      date: new Date().toISOString(),
      dateFormatted: "Aujourd'hui",
      title: timeline?.current_title || 'Synthèse actuelle',
      tension: calculateTension(
        timeline?.narrative_arc || 'developing',
        category,
        0.7
      ),
      phase: timeline?.narrative_arc || 'developing',
      factDensity: 0.7,
      sources: [],
      synthesisId,
      isPresent: true,
      isFuture: false,
      hasContradiction: false,
    });
  }

  // Transform predictions to future scenarios
  const novaLinePredictions = transformPredictions(predictions, category);

  // Calculate min/max tension
  const allTensions = [
    ...points.map((p) => p.tension),
    ...novaLinePredictions.flatMap((p) => p.points.map((pt) => pt.tension)),
  ];
  const minTension = Math.min(...allTensions, 0);
  const maxTension = Math.max(...allTensions, 100);

  // Only include valid contradictions in the response
  const validContradictions = Array.from(contradictionsMap.values());

  return {
    synthesisId,
    category,
    currentTitle: timeline?.current_title || '',
    points,
    predictions: novaLinePredictions,
    contradictions: validContradictions,
    narrativeArc: timeline?.narrative_arc || 'developing',
    daysTracked: timeline?.days_tracked || 0,
    minTension,
    maxTension,
  };
}

/**
 * Transform predictions to NovaLine prediction format
 */
function transformPredictions(
  predictions: PredictionsResponse | null,
  category: string
): NovaLinePrediction[] {
  if (!predictions?.predictions || predictions.predictions.length === 0) {
    return [];
  }

  // Group predictions by probability (high vs low)
  const sorted = [...predictions.predictions].sort(
    (a, b) => b.probability - a.probability
  );

  // Take top 2 predictions as scenarios
  const scenarios = sorted.slice(0, 2);

  return scenarios.map((pred, index) => {
    // Calculate future tension based on prediction content
    const futureTension = estimateFutureTension(pred, category);

    // Create future point for this scenario
    const futurePoint: NovaLinePoint = {
      id: `future-${index}`,
      date: getFutureDate(pred.timeframe),
      dateFormatted: getTimeframeLabel(pred.timeframe),
      title: pred.prediction,
      summary: pred.rationale,
      tension: futureTension,
      phase: futureTension >= 70 ? 'peak' : futureTension >= 40 ? 'developing' : 'resolved',
      factDensity: pred.probability,
      sources: [],
      synthesisId: predictions.synthesis_id,
      isPresent: false,
      isFuture: true,
      hasContradiction: false,
    };

    return {
      id: `scenario-${index}`,
      label: `Scénario ${index === 0 ? 'A' : 'B'}`,
      tension: futureTension,
      probability: pred.probability,
      timeframe: pred.timeframe,
      rationale: pred.rationale,
      points: [futurePoint],
    };
  });
}

/**
 * Estimate future tension based on prediction content
 */
function estimateFutureTension(pred: Prediction, category: string): number {
  // Base tension on prediction type and probability
  const baseTension = pred.probability >= 0.5 ? 60 : 40;

  // Adjust based on keywords in prediction
  const text = pred.prediction.toLowerCase();
  let adjustment = 0;

  // High tension keywords
  if (text.includes('crise') || text.includes('conflit') || text.includes('guerre')) {
    adjustment += 20;
  }
  if (text.includes('escalade') || text.includes('aggrav')) {
    adjustment += 15;
  }
  if (text.includes('chute') || text.includes('effondrement')) {
    adjustment += 15;
  }

  // Low tension keywords
  if (text.includes('accord') || text.includes('paix') || text.includes('négociation')) {
    adjustment -= 15;
  }
  if (text.includes('résolution') || text.includes('stabilisation')) {
    adjustment -= 20;
  }

  const categoryWeight = getCategoryWeight(category);
  return Math.max(10, Math.min(100, Math.round((baseTension + adjustment) * categoryWeight)));
}

function getCategoryWeight(category: string): number {
  const weights: Record<string, number> = {
    MONDE: 1.0,
    POLITIQUE: 0.9,
    ECONOMIE: 0.8,
    SCIENCES: 0.7,
    TECH: 0.6,
    CULTURE: 0.5,
    SPORT: 0.4,
  };
  return weights[category.toUpperCase()] || 0.6;
}

function getFutureDate(timeframe: string): string {
  const now = new Date();
  switch (timeframe) {
    case 'court_terme':
      now.setDate(now.getDate() + 14);
      break;
    case 'moyen_terme':
      now.setMonth(now.getMonth() + 3);
      break;
    case 'long_terme':
      now.setFullYear(now.getFullYear() + 1);
      break;
    default:
      now.setMonth(now.getMonth() + 1);
  }
  return now.toISOString();
}

function getTimeframeLabel(timeframe: string): string {
  switch (timeframe) {
    case 'court_terme':
      return 'Prochaines semaines';
    case 'moyen_terme':
      return 'Prochains mois';
    case 'long_terme':
      return 'Prochaine année';
    default:
      return 'Futur';
  }
}
