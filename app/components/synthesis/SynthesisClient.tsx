'use client';

/**
 * REF-012g: SynthesisClient - Main Client Component for synthesis page interactivity
 * Handles persona switching, NovaLine tension visualization, and all interactive features
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SynthesisLayout from '@/app/components/layout/SynthesisLayout';
import { TimelinePreview } from '@/app/components/timeline';
import { PredictionExplorer, WhatIfExplorer } from '@/app/components/predictions';
import { EntityFrequencyChart } from '@/app/components/charts';
import {
  SynthesisHeader,
  PersonaSection,
  PersonaSignature,
  SynthesisBody,
  SourcesSection,
  NovaLineSection,
  HistoricalContext
} from '@/app/components/synthesis';
import { BiasIndicator } from '@/app/components/ui/BiasIndicator';
import { FactCheckIndicator } from '@/app/components/ui/FactCheckIndicator';
import { AudioPlayer } from '@/app/components/audio';
import { GamificationToast } from '@/app/components/gamification';
import { recordSynthesisRead, Badge } from '@/app/lib/gamification';
import { FollowButton } from '@/app/components/ui/FollowButton';
import { DebateView } from '@/app/components/ui/DebateView';
import { FutureScenarios } from '@/app/components/predictions/FutureScenarios';
import {
  SynthesisData,
  formatSynthesisDate,
  RelatedSynthesis
} from '@/app/types/synthesis-page';
import { getSavedPersona, savePersona } from '@/app/components/ui/PersonaSwitcher';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface SynthesisClientProps {
  initialSynthesis: SynthesisData;
}

export default function SynthesisClient({ initialSynthesis }: SynthesisClientProps) {
  const router = useRouter();
  const [synthesis, setSynthesis] = useState<SynthesisData>(initialSynthesis);
  const [originalSynthesis] = useState<SynthesisData>(initialSynthesis);

  // Persona state - check localStorage first, then fall back to synthesis default
  const [currentPersona, setCurrentPersona] = useState<string>(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const savedPersona = getSavedPersona();
      if (savedPersona) {
        return savedPersona;
      }
    }
    return initialSynthesis.persona?.id || 'neutral';
  });
  const [personaLoading, setPersonaLoading] = useState(false);
  const [initialPersonaLoaded, setInitialPersonaLoaded] = useState(false);

  // Related syntheses state (for sidebar)
  const [relatedSyntheses, setRelatedSyntheses] = useState<RelatedSynthesis[]>([]);

  // Gamification state
  const [gamificationToast, setGamificationToast] = useState<{
    id: string;
    type: 'points' | 'badge' | 'levelUp' | 'streak';
    pointsEarned?: number;
    badge?: Badge;
    newLevel?: number;
    streak?: number;
  } | null>(null);

  // Track synthesis read for gamification
  useEffect(() => {
    if (synthesis.id) {
      const result = recordSynthesisRead(synthesis.id);

      if (result.pointsEarned > 0) {
        // Show points toast
        setGamificationToast({
          id: `points-${Date.now()}`,
          type: 'points',
          pointsEarned: result.pointsEarned,
        });

        // If level up, show that toast after a delay
        if (result.levelUp) {
          setTimeout(() => {
            setGamificationToast({
              id: `levelup-${Date.now()}`,
              type: 'levelUp',
              newLevel: Math.floor(result.pointsEarned / 100) + 1,
            });
          }, 4500);
        }

        // If new badges, show them after
        if (result.newBadges.length > 0) {
          setTimeout(() => {
            setGamificationToast({
              id: `badge-${Date.now()}`,
              type: 'badge',
              badge: result.newBadges[0],
            });
          }, result.levelUp ? 9000 : 4500);
        }
      }
    }
  }, [synthesis.id]);

  // Handle persona change
  const handlePersonaChange = useCallback(async (personaId: string) => {
    if (personaId === currentPersona) return;

    // If switching back to original persona, restore original
    const originalPersonaId = originalSynthesis.persona?.id || 'neutral';
    if (personaId === originalPersonaId) {
      setCurrentPersona(originalPersonaId);
      setSynthesis(originalSynthesis);
      return;
    }

    try {
      setPersonaLoading(true);
      const response = await fetch(
        `${API_URL}/api/syntheses/by-id/${synthesis.id}/persona/${personaId}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Map API response persona fields to expected structure
      const mappedData: SynthesisData = {
        ...originalSynthesis,
        ...data,
        persona: data.personaId ? {
          id: data.personaId,
          name: data.personaName || 'NovaPress',
          displayName: data.personaName || 'NovaPress (Factuel)'
        } : (data.persona || undefined),
        author: data.author || undefined,
        signature: data.personaSignature || data.signature || '',
        isPersonaVersion: data.isPersonaVersion ?? true
      };

      setSynthesis(mappedData);
      setCurrentPersona(personaId);
      // Save to localStorage
      savePersona(personaId);
    } catch (err) {
      console.error('Failed to fetch persona synthesis:', err);
    } finally {
      setPersonaLoading(false);
    }
  }, [currentPersona, originalSynthesis, synthesis.id]);

  // Load saved persona on mount if different from synthesis default
  useEffect(() => {
    const loadSavedPersona = async () => {
      if (initialPersonaLoaded) return;

      const savedPersona = getSavedPersona();
      const defaultPersona = initialSynthesis.persona?.id || 'neutral';

      // Only load if saved persona is different from what we got from server
      if (savedPersona && savedPersona !== defaultPersona) {
        setInitialPersonaLoaded(true);
        await handlePersonaChange(savedPersona);
      } else {
        setInitialPersonaLoaded(true);
      }
    };

    loadSavedPersona();
  }, [initialSynthesis.persona?.id, initialPersonaLoaded, handlePersonaChange]);

  // Fetch related syntheses for sidebar
  useEffect(() => {
    const abortController = new AbortController();

    const fetchRelatedSyntheses = async () => {
      try {
        const response = await fetch(`${API_URL}/api/time-traveler/syntheses/${synthesis.id}/preview`, {
          signal: abortController.signal
        });
        if (response.ok) {
          const data = await response.json();
          if (!abortController.signal.aborted && data.related_syntheses) {
            setRelatedSyntheses(data.related_syntheses.slice(0, 5));
          }
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.log('Related syntheses not available:', err);
        }
      }
    };

    fetchRelatedSyntheses();

    return () => {
      abortController.abort();
    };
  }, [synthesis.id]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FFFFFF', color: '#000000' }}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link href="/" style={styles.backLink}>
            <span style={{ fontSize: '18px' }}>&larr;</span>
            <span>Retour aux actualites</span>
          </Link>
        </div>
      </header>

      {/* 3-Column Layout */}
      <SynthesisLayout
        leftSidebar={
          <TimelinePreview
            synthesisId={synthesis.id}
            onError={(err) => console.log('Timeline not available:', err.message)}
          />
        }
        rightSidebar={
          <>
            <NovaLineSection
              synthesisId={synthesis.id}
              category={synthesis.category || 'MONDE'}
              synthesisTitle={synthesis.title}
            />
            {/* Prediction Explorer - moved to sidebar for balanced layout */}
            <div style={{ marginTop: '24px' }}>
              <PredictionExplorer synthesisId={synthesis.id} compact={true} />
            </div>
          </>
        }
      >
        {/* Main Content */}
        <main style={styles.main}>
          {/* Header Section */}
          <SynthesisHeader
            synthesis={synthesis}
            formatDate={formatSynthesisDate}
          />

          {/* Follow Story Button */}
          <div style={{ marginBottom: '16px' }}>
            <FollowButton
              synthesisId={synthesis.id}
              title={synthesis.title}
              category={synthesis.category || 'MONDE'}
              narrativePhase={synthesis.historicalContext?.narrativeArc}
            />
          </div>

          {/* Audio Player - Listen to synthesis */}
          <AudioPlayer
            synthesisId={synthesis.id}
            title={synthesis.title}
          />

          {/* Persona Section */}
          <PersonaSection
            synthesis={synthesis}
            currentPersona={currentPersona}
            personaLoading={personaLoading}
            onPersonaChange={handlePersonaChange}
          />

          {/* Historical Context - "Previously on..." section */}
          {synthesis.historicalContext && (
            <HistoricalContext
              daysTracked={synthesis.historicalContext.daysTracked}
              narrativeArc={synthesis.historicalContext.narrativeArc}
              relatedSyntheses={synthesis.historicalContext.relatedSyntheses || []}
              hasContradictions={synthesis.historicalContext.hasContradictions}
              contradictionsCount={synthesis.historicalContext.contradictionsCount}
              synthesisId={synthesis.id}
            />
          )}

          {/* Body Content */}
          <SynthesisBody synthesis={synthesis} />

          {/* Future Scenarios - Predictions section */}
          {synthesis.predictions && synthesis.predictions.length > 0 && (
            <FutureScenarios
              predictions={synthesis.predictions}
              sourceCount={synthesis.numSources}
              relatedCount={synthesis.historicalContext?.relatedSyntheses?.length || 0}
            />
          )}

          {/* Persona Signature */}
          <PersonaSignature
            signature={synthesis.signature}
            isPersonaVersion={synthesis.isPersonaVersion}
            persona={synthesis.persona}
            author={synthesis.author}
          />

          {/* Bias Analysis - Ground News style */}
          <BiasIndicator
            synthesisId={synthesis.id}
            showDetails={true}
          />

          {/* Fact-Check Analysis - Perplexity/Semafor style */}
          <FactCheckIndicator
            synthesisId={synthesis.id}
            showDetails={true}
          />

          {/* Debate View - PRO/CON arguments for controversial topics */}
          <DebateView
            synthesisId={synthesis.id}
          />

          {/* What-If Scenarios - Counterfactual analysis */}
          <WhatIfExplorer
            synthesisId={synthesis.id}
          />

          {/* Sources & Enrichment */}
          <SourcesSection synthesis={synthesis} />

          {/* Entity Frequency Chart - Key entities visualization */}
          <div style={{ marginTop: '32px' }}>
            <EntityFrequencyChart
              synthesisId={synthesis.id}
              title="Entites Cles"
            />
          </div>

          {/* Back Link */}
          <div style={styles.backSection}>
            <Link href="/" style={styles.backLinkBottom}>
              <span>&larr;</span>
              <span>Retour a la page d'accueil</span>
            </Link>
          </div>
        </main>
      </SynthesisLayout>

      {/* Gamification Toast */}
      <GamificationToast
        toast={gamificationToast}
        onClose={() => setGamificationToast(null)}
      />
    </div>
  );
}

// Styles - Newspaper Style (Light Mode)
const styles: { [key: string]: React.CSSProperties } = {
  header: {
    borderBottom: '1px solid #E5E5E5',
    padding: '16px 0',
    backgroundColor: '#FFFFFF',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerContent: {
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '0 24px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6B7280',
    textDecoration: 'none',
    fontSize: '14px',
  },
  main: {
    padding: '40px 0 80px',
  },
  backSection: {
    marginTop: '60px',
    paddingTop: '24px',
    borderTop: '1px solid #E5E5E5',
  },
  backLinkBottom: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#000000',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
  },
};
