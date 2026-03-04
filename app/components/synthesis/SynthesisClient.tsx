'use client';

/**
 * REF-012g: SynthesisClient - Main Client Component for synthesis page interactivity
 * Handles persona switching, NovaLine tension visualization, and all interactive features
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import SynthesisLayout from '@/app/components/layout/SynthesisLayout';
import { TimelinePreview } from '@/app/components/timeline';
import {
  SynthesisHeader,
  PersonaSection,
  SynthesisBody,
  SourcesSection,
  HistoricalContext
} from '@/app/components/synthesis';
import { Header } from '@/app/components/layout/Header';
import dynamic from 'next/dynamic';

const MiniCausalWidget = dynamic(() => import('./MiniCausalWidget'), { ssr: false });
const NeuralCausalGraph = dynamic(() => import('@/app/components/causal/NeuralCausalGraph'), { ssr: false });
import FeedbackWidget from '@/app/components/synthesis/FeedbackWidget';
import { AudioPlayer } from '@/app/components/audio';
import { FollowButton } from '@/app/components/ui/FollowButton';
import {
  SynthesisData,
  formatSynthesisDate
} from '@/app/types/synthesis-page';
import { CausalGraphResponse } from '@/app/types/causal';
import { getSavedPersona, savePersona } from '@/app/components/ui/PersonaSwitcher';
import NewsXRay from '@/app/components/xray/NewsXRay';
import { UpgradeModal } from '@/app/components/ui/UpgradeModal';
import { FeatureLock } from '@/app/components/ui/FeatureLock';
import { subscriptionService } from '@/app/lib/api/services';
import { SubscriptionTier } from '@/app/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Phase 4A: TopicNexusLink — Replaces the CausalSection sidebar.
 * Shows a summary of causal relations + a link to the full theme Nexus page.
 */
function TopicNexusLink({
  synthesisId,
  causalData,
  causalLoading,
}: {
  synthesisId: string;
  causalData: CausalGraphResponse | null;
  causalLoading: boolean;
}) {
  const [topicInfo, setTopicInfo] = useState<{ topic_name: string | null; is_recurring: boolean } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/trending/syntheses/${synthesisId}/topic-info`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setTopicInfo(data); })
      .catch(() => {});
  }, [synthesisId]);

  const nodeCount = causalData?.nodes?.length || 0;
  const edgeCount = causalData?.edges?.length || 0;
  const topicName = topicInfo?.topic_name;
  const isRecurring = topicInfo?.is_recurring;

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#fff',
      border: '1px solid #E5E5E5',
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: '11px',
        fontWeight: 800,
        textTransform: 'uppercase' as const,
        letterSpacing: '2px',
        color: '#000',
        borderBottom: '2px solid #000',
        paddingBottom: '8px',
      }}>
        NEXUS CAUSAL
      </h3>

      {causalLoading ? (
        <p style={{ fontSize: '13px', color: '#9CA3AF' }}>Chargement...</p>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div style={{ textAlign: 'center' as const }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#000' }}>{nodeCount}</div>
              <div style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>noeuds</div>
            </div>
            <div style={{ textAlign: 'center' as const }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#000' }}>{edgeCount}</div>
              <div style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>relations</div>
            </div>
          </div>

          {/* Mini causal graph */}
          {nodeCount > 0 && causalData && (
            <div style={{ height: '280px', marginBottom: '16px', border: '1px solid #E5E5E5' }}>
              <NeuralCausalGraph
                nodes={causalData.nodes}
                edges={causalData.edges}
                centralEntity={causalData.central_entity || ''}
                narrativeFlow={causalData.narrative_flow || 'linear'}
                compact
              />
            </div>
          )}

          {/* Predictions preview */}
          {causalData?.predictions && causalData.predictions.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#6B7280', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' as const }}>
                SCENARIOS
              </div>
              {causalData.predictions.slice(0, 2).map((pred, i) => (
                <div key={i} style={{
                  padding: '8px',
                  backgroundColor: '#F9FAFB',
                  marginBottom: '6px',
                  borderLeft: '3px solid #DC2626',
                }}>
                  <div style={{ fontSize: '12px', color: '#000', lineHeight: '1.4' }}>
                    {typeof pred === 'object' && 'prediction' in pred
                      ? (pred as { prediction: string }).prediction?.slice(0, 100)
                      : String(pred).slice(0, 100)}...
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Link to theme nexus */}
          {isRecurring && topicName && (
            <Link
              href={`/topics/${encodeURIComponent(topicName)}?tab=causal`}
              style={{
                display: 'block',
                padding: '12px 16px',
                backgroundColor: '#000',
                color: '#fff',
                textAlign: 'center' as const,
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                textDecoration: 'none',
                textTransform: 'uppercase' as const,
              }}
            >
              Voir le Nexus du theme : {topicName}
            </Link>
          )}

          {!isRecurring && (
            <p style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic' }}>
              Ce sujet n&apos;est pas encore lie a un theme recurrent.
            </p>
          )}
        </>
      )}
    </div>
  );
}

interface SynthesisClientProps {
  initialSynthesis: SynthesisData;
}

export default function SynthesisClient({ initialSynthesis }: SynthesisClientProps) {
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

  // Causal graph state (for right sidebar)
  const [causalData, setCausalData] = useState<CausalGraphResponse | null>(null);
  const [causalLoading, setCausalLoading] = useState(true);

  // Subscription / feature gating state
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');
  const [userTier, setUserTier] = useState<SubscriptionTier>('free');

  // Fetch subscription tier on mount
  useEffect(() => {
    subscriptionService.getFeatures().then((data) => {
      setUserTier(data.tier);
    }).catch(() => {
      // If the endpoint is unavailable (e.g. backend not running), stay on free tier
      setUserTier('free');
    });
  }, []);

  // Helper: open upgrade modal for a given feature name
  const openUpgrade = useCallback((featureName: string) => {
    setUpgradeFeature(featureName);
    setShowUpgrade(true);
  }, []);

  // Handle persona change — gate non-neutral personas for free tier
  const handlePersonaChange = useCallback(async (personaId: string) => {
    if (personaId === currentPersona) return;

    // Free tier: only allow 'neutral' persona
    if (userTier === 'free' && personaId !== 'neutral') {
      openUpgrade('Persona Switch');
      return;
    }

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
  }, [currentPersona, originalSynthesis, synthesis.id, userTier, openUpgrade]);

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

  // Fetch causal graph data for right sidebar
  useEffect(() => {
    const abortController = new AbortController();

    const fetchCausalData = async () => {
      setCausalLoading(true);
      try {
        const response = await fetch(
          `${API_URL}/api/causal/syntheses/${synthesis.id}/causal-graph`,
          { signal: abortController.signal }
        );
        if (response.ok) {
          const data = await response.json();
          if (!abortController.signal.aborted) {
            setCausalData(data);
          }
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.log('Causal graph not available:', err);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setCausalLoading(false);
        }
      }
    };

    fetchCausalData();

    return () => {
      abortController.abort();
    };
  }, [synthesis.id]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FFFFFF', color: '#000000' }}>
      {/* Main Header */}
      <Header />

      {/* Breadcrumb */}
      <nav style={styles.breadcrumb}>
        <div style={styles.breadcrumbContent}>
          <Link href="/" style={styles.breadcrumbLink}>Accueil</Link>
          <span style={styles.breadcrumbSep}>/</span>
          <Link href="/intelligence" style={styles.breadcrumbLink}>Intelligence</Link>
          <span style={styles.breadcrumbSep}>/</span>
          <span style={styles.breadcrumbCurrent}>{synthesis.category || 'Synthese'}</span>
        </div>
      </nav>

      {/* 3-Column Layout */}
      <SynthesisLayout
        leftSidebar={
          <TimelinePreview
            synthesisId={synthesis.id}
            onError={(err: Error) => console.log('Timeline not available:', err.message)}
          />
        }
        rightSidebar={
          <TopicNexusLink
            synthesisId={synthesis.id}
            causalData={causalData}
            causalLoading={causalLoading}
          />
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

          {/* Audio Player - Listen to synthesis (PRO) */}
          {userTier === 'free' ? (
            <div
              onClick={() => openUpgrade('Briefing Audio')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openUpgrade('Briefing Audio');
                }
              }}
              aria-label="Debloquer le briefing audio avec PRO"
              style={{ cursor: 'pointer' }}
            >
              <FeatureLock
                isLocked={true}
                featureName="Briefing Audio"
                onUpgrade={() => openUpgrade('Briefing Audio')}
              >
                {/* Placeholder representant le player audio */}
                <div style={{
                  backgroundColor: '#F9FAFB',
                  border: '1px solid #E5E5E5',
                  borderRadius: '4px',
                  padding: '16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  minHeight: '64px',
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: '#E5E5E5',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '8px', backgroundColor: '#E5E5E5', borderRadius: '2px', marginBottom: '8px', width: '60%' }} />
                    <div style={{ height: '6px', backgroundColor: '#F3F4F6', borderRadius: '2px', width: '100%' }} />
                  </div>
                </div>
              </FeatureLock>
            </div>
          ) : (
            <AudioPlayer
              synthesisId={synthesis.id}
              title={synthesis.title}
            />
          )}

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

          {/* Inline Causal Widget — relations + predictions in newspaper style */}
          {causalData && !causalLoading && (
            <MiniCausalWidget
              edges={causalData.edges || []}
              predictions={synthesis.predictions || []}
              centralEntity={causalData.central_entity}
            />
          )}

          {/* Sources & Enrichment */}
          <SourcesSection synthesis={synthesis} />

          {/* Reader Feedback */}
          <FeedbackWidget
            synthesisId={synthesis.id}
            initialAvgRating={synthesis.avgRating}
            initialFeedbackCount={synthesis.feedbackCount}
          />

          {/* News X-Ray - Transparency Analysis */}
          {synthesis.transparencyScore !== undefined && synthesis.transparencyScore > 0 && (
            <NewsXRay
              transparencyScore={synthesis.transparencyScore}
              transparencyLabel={synthesis.transparencyLabel || 'N/A'}
              transparencyBreakdown={synthesis.transparencyBreakdown || {}}
              sourceArticles={synthesis.sourceArticles || []}
              numSources={synthesis.numSources}
              contradictionsCount={synthesis.historicalContext?.contradictionsCount || 0}
              hasContradictions={synthesis.historicalContext?.hasContradictions || false}
              causalGraphId={synthesis.id}
            />
          )}

          {/* Back Link */}
          <div style={styles.backSection}>
            <Link href="/" style={styles.backLinkBottom}>
              <span>&larr;</span>
              <span>Retour a la page d'accueil</span>
            </Link>
          </div>
        </main>
      </SynthesisLayout>

      {/* Upgrade Modal - PRO feature gate */}
      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        featureName={upgradeFeature}
      />
    </div>
  );
}

// Styles - Newspaper Style (Light Mode)
const styles: { [key: string]: React.CSSProperties } = {
  breadcrumb: {
    borderBottom: '1px solid #E5E5E5',
    padding: '10px 0',
    backgroundColor: '#F9FAFB',
  },
  breadcrumbContent: {
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
  },
  breadcrumbLink: {
    color: '#6B7280',
    textDecoration: 'none',
  },
  breadcrumbSep: {
    color: '#D1D5DB',
    fontSize: '11px',
  },
  breadcrumbCurrent: {
    color: '#000000',
    fontWeight: 600,
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
