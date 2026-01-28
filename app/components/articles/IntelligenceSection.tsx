'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useArticles } from '../../contexts/ArticlesContext';
import { synthesesService } from '../../lib/api/services/syntheses';
import { Synthesis, SynthesisCategory } from '../../types/api';

// Lazy load components
const SynthesisHero = dynamic(() => import('./SynthesisHero'), {
  loading: () => <div style={{ height: '300px', backgroundColor: '#000' }} />,
  ssr: true
});

const SynthesisCompactCard = dynamic(() => import('./SynthesisCompactCard'), {
  loading: () => <div style={{ height: '200px', backgroundColor: '#F9FAFB' }} />,
  ssr: true
});

// Valid categories mapping
const CATEGORY_MAP: Record<string, SynthesisCategory | null> = {
  'ACCUEIL': null,
  'MONDE': 'MONDE',
  'TECH': 'TECH',
  'ECONOMIE': 'ECONOMIE',
  'ÉCONOMIE': 'ECONOMIE',
  'POLITIQUE': 'POLITIQUE',
  'CULTURE': 'CULTURE',
  'SPORT': 'SPORT',
  'SCIENCES': 'SCIENCES'
};

// Category display names
const CATEGORY_DISPLAY: Record<string, string> = {
  'MONDE': 'Monde',
  'TECH': 'Tech',
  'ECONOMIE': 'Economie',
  'POLITIQUE': 'Politique',
  'CULTURE': 'Culture',
  'SPORT': 'Sport',
  'SCIENCES': 'Sciences'
};

export default function IntelligenceSection() {
  const { state } = useArticles();
  const [syntheses, setSyntheses] = useState<Synthesis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get the API category from selected category
  const selectedCategory = state.selectedCategory;
  const apiCategory = CATEGORY_MAP[selectedCategory.toUpperCase()] || null;

  const fetchSyntheses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (apiCategory) {
        // Fetch by category
        response = await synthesesService.getSynthesesByCategory(apiCategory, 20);
      } else {
        // Fetch all (home page)
        response = await synthesesService.getSyntheses(20);
      }

      setSyntheses(response.data || []);
    } catch (err) {
      console.error('Failed to fetch syntheses:', err);
      setError('Unable to load AI syntheses');
      setSyntheses([]);
    } finally {
      setLoading(false);
    }
  }, [apiCategory]);

  useEffect(() => {
    fetchSyntheses();
  }, [fetchSyntheses]);

  // Don't render section if no syntheses and not loading (only for home page)
  if (!loading && syntheses.length === 0 && !apiCategory) {
    return null;
  }

  const heroSynthesis = syntheses[0];
  const gridSyntheses = syntheses.slice(1, 4);
  const moreSyntheses = syntheses.slice(4);

  // Calculate total stats
  const totalSources = syntheses.reduce((acc, s) => acc + s.numSources, 0);
  const avgAccuracy = syntheses.length > 0
    ? Math.round(syntheses.reduce((acc, s) => acc + s.complianceScore, 0) / syntheses.length)
    : 0;

  // Section title based on category
  const categoryDisplay = apiCategory ? CATEGORY_DISPLAY[apiCategory] || apiCategory : null;
  const sectionTitle = categoryDisplay
    ? `AI Intelligence - ${categoryDisplay}`
    : 'AI Intelligence';

  return (
    <section
      role="region"
      aria-label={sectionTitle}
      style={{
        marginBottom: '48px'
      }}
    >
      {/* Section Header - Newspaper Style */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '3px solid #000000',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <h2
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '28px',
              fontWeight: '700',
              color: '#000000',
              margin: 0,
              letterSpacing: '-0.02em'
            }}
          >
            {sectionTitle}
          </h2>
          <span
            style={{
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              padding: '6px 12px',
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '0.1em',
              textTransform: 'uppercase'
            }}
          >
            POWERED BY NOVAPRESS
          </span>
        </div>

        {/* Stats */}
        {!loading && syntheses.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#000' }}>
                {totalSources}
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>
                Sources Analyzed
              </div>
            </div>
            <div
              style={{
                width: '1px',
                height: '32px',
                backgroundColor: '#E5E5E5'
              }}
            />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#10B981' }}>
                {avgAccuracy}%
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>
                Avg Accuracy
              </div>
            </div>
            <div
              style={{
                width: '1px',
                height: '32px',
                backgroundColor: '#E5E5E5'
              }}
            />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#000' }}>
                {syntheses.length}
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase' }}>
                Syntheses
              </div>
            </div>
            <Link
              href="/live"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 20px',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginLeft: '16px'
              }}
            >
              <span style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#FFFFFF',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }} />
              Toutes les syntheses
            </Link>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div
          style={{
            padding: '60px',
            textAlign: 'center',
            backgroundColor: '#000000',
            color: '#FFFFFF'
          }}
        >
          <div
            style={{
              display: 'inline-block',
              width: '32px',
              height: '32px',
              border: '3px solid #374151',
              borderTopColor: '#2563EB',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
          <p style={{ marginTop: '16px', fontSize: '14px', color: '#9CA3AF' }}>
            {apiCategory
              ? `Chargement des syntheses ${categoryDisplay}...`
              : 'Generating AI Intelligence...'}
          </p>
          <style jsx>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div
          style={{
            padding: '32px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#DC2626',
            fontSize: '14px',
            textAlign: 'center'
          }}
        >
          {error}
        </div>
      )}

      {/* Content */}
      {!loading && !error && syntheses.length > 0 && (
        <>
          {/* Hero Synthesis */}
          {heroSynthesis && <SynthesisHero synthesis={heroSynthesis} />}

          {/* Grid of Secondary Syntheses - 3 columns on desktop */}
          {gridSyntheses.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px',
                marginTop: '32px'
              }}
            >
              {gridSyntheses.map((synthesis) => (
                <SynthesisCompactCard key={synthesis.id} synthesis={synthesis} />
              ))}
            </div>
          )}

          {/* More Syntheses Section - "Plus d'actualités" */}
          {moreSyntheses.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '48px',
                  marginBottom: '24px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #E5E5E5'
                }}
              >
                <h3
                  style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#6B7280',
                    margin: 0
                  }}
                >
                  Plus d'actualites
                </h3>
                <Link
                  href="/live"
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#DC2626',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Voir toutes les syntheses
                  <span style={{ fontSize: '16px' }}>→</span>
                </Link>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '24px'
                }}
              >
                {moreSyntheses.map((synthesis) => (
                  <SynthesisCompactCard key={synthesis.id} synthesis={synthesis} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Empty State for category filter */}
      {!loading && !error && syntheses.length === 0 && apiCategory && (
        <div
          style={{
            padding: '60px 40px',
            textAlign: 'center',
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E5E5'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 20px',
              backgroundColor: '#E5E5E5',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px'
            }}
          >
            📰
          </div>
          <h3
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#000'
            }}
          >
            Aucune synthese {categoryDisplay}
          </h3>
          <p
            style={{
              fontSize: '14px',
              color: '#6B7280',
              maxWidth: '400px',
              margin: '0 auto'
            }}
          >
            Pas de syntheses disponibles dans cette categorie pour le moment.
            Executez le pipeline pour generer de nouvelles syntheses.
          </p>
        </div>
      )}

      {/* Empty State for home page */}
      {!loading && !error && syntheses.length === 0 && !apiCategory && (
        <div
          style={{
            padding: '60px 40px',
            textAlign: 'center',
            backgroundColor: '#000000',
            color: '#FFFFFF'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 20px',
              backgroundColor: '#1F2937',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px'
            }}
          >
            AI
          </div>
          <h3
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '12px'
            }}
          >
            Intelligence Pipeline
          </h3>
          <p
            style={{
              fontSize: '14px',
              color: '#9CA3AF',
              maxWidth: '400px',
              margin: '0 auto'
            }}
          >
            No AI syntheses available yet. Run the pipeline to generate multi-source intelligence.
          </p>
        </div>
      )}
    </section>
  );
}
