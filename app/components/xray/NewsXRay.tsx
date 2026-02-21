'use client';

import { useState } from 'react';
import TransparencyBadge from './TransparencyBadge';
import SourceCoverageMap from './SourceCoverageMap';
import BlindSpotAlert from './BlindSpotAlert';
import ToneAnalysis from './ToneAnalysis';

interface SourceArticle {
  name: string;
  url: string;
  title: string;
}

interface TransparencyBreakdown {
  source_diversity?: { score: number; weight: number; detail: string };
  language_diversity?: { score: number; weight: number; detail: string };
  contradictions?: { score: number; weight: number; detail: string };
  fact_density?: { score: number; weight: number; detail: string };
  geo_coverage?: { score: number; weight: number; detail: string };
}

interface NewsXRayProps {
  transparencyScore: number;
  transparencyLabel: string;
  transparencyBreakdown: TransparencyBreakdown;
  sourceArticles: SourceArticle[];
  numSources: number;
  contradictionsCount?: number;
  hasContradictions?: boolean;
  causalGraphId?: string;
}

export default function NewsXRay({
  transparencyScore,
  transparencyLabel,
  transparencyBreakdown,
  sourceArticles,
  numSources,
  contradictionsCount = 0,
  hasContradictions = false,
  causalGraphId,
}: NewsXRayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{
      border: '1px solid #E5E5E5',
      backgroundColor: '#FFFFFF',
      marginTop: '32px',
    }}>
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          border: 'none',
          backgroundColor: '#F9FAFB',
          cursor: 'pointer',
          borderBottom: isExpanded ? '1px solid #E5E5E5' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <TransparencyBadge
            score={transparencyScore}
            size="small"
            showLabel={false}
          />
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: '15px',
              fontWeight: '700',
              color: '#000',
              fontFamily: 'Georgia, serif',
            }}>
              NEWS X-RAY
            </div>
            <div style={{ fontSize: '12px', color: '#6B7280' }}>
              Score de transparence: {transparencyScore}/100 ({transparencyLabel})
            </div>
          </div>
        </div>
        <span style={{
          fontSize: '18px',
          color: '#6B7280',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}>
          V
        </span>
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div style={{ padding: '24px 20px' }}>
          {/* Score breakdown */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '24px',
            marginBottom: '32px',
            paddingBottom: '24px',
            borderBottom: '1px solid #E5E5E5',
          }}>
            <TransparencyBadge
              score={transparencyScore}
              label={transparencyLabel}
              size="large"
            />
            <div style={{ flex: 1 }}>
              <ToneAnalysis breakdown={transparencyBreakdown} />
            </div>
          </div>

          {/* Source coverage */}
          <SourceCoverageMap
            sourceArticles={sourceArticles}
            numSources={numSources}
          />

          {/* Blind spots */}
          <BlindSpotAlert
            contradictionsCount={contradictionsCount}
            hasContradictions={hasContradictions}
            numSources={numSources}
            breakdown={transparencyBreakdown}
          />

          {/* Link to causal graph */}
          {causalGraphId && (
            <div style={{
              padding: '12px 14px',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E5E5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '13px', color: '#1F2937' }}>
                Voir le graphe causal de cette synthese
              </span>
              <a
                href={`/synthesis/${causalGraphId}/causal`}
                style={{
                  fontSize: '13px',
                  color: '#2563EB',
                  textDecoration: 'none',
                  fontWeight: '600',
                }}
              >
                Ouvrir le graphe
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
