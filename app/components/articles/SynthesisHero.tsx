'use client';

import React, { memo } from 'react';
import Link from 'next/link';

interface Synthesis {
  id: string;
  title: string;
  summary: string;
  introduction?: string;
  body?: string;
  keyPoints: string[];
  sources: string[];
  numSources: number;
  complianceScore: number;
  readingTime: number;
  createdAt: string;
  category?: string;
}

interface SynthesisHeroProps {
  synthesis: Synthesis;
}

export const SynthesisHero = memo(function SynthesisHero({ synthesis }: SynthesisHeroProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'À l\'instant';
    if (hours < 24) return `Il y a ${hours}h`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  };

  // Get first 2 sentences for preview
  const getPreview = () => {
    const content = synthesis.introduction || synthesis.summary || '';
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    return sentences.slice(0, 2).join('. ') + (sentences.length > 0 ? '.' : '');
  };

  return (
    <Link href={`/synthesis/${synthesis.id}`} style={{ textDecoration: 'none' }}>
      <article
        style={{
          position: 'relative',
          backgroundColor: '#000000',
          color: '#FFFFFF',
          padding: '48px',
          marginBottom: '24px',
          cursor: 'pointer',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        {/* Background Pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '300px',
            height: '100%',
            background: 'linear-gradient(135deg, transparent 0%, rgba(37,99,235,0.1) 100%)',
            pointerEvents: 'none'
          }}
        />

        {/* Top Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* AI Badge */}
            <span
              style={{
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}
            >
              AI SYNTHESIS
            </span>

            {/* Live Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#10B981',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite'
                }}
              />
              <span style={{ fontSize: '11px', color: '#9CA3AF', textTransform: 'uppercase' }}>
                Live Analysis
              </span>
            </div>
          </div>

          {/* Timestamp */}
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
            {formatDate(synthesis.createdAt)}
          </span>
        </div>

        {/* UI-007: Improved Title with balanced text wrapping */}
        <h2
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '38px',
            fontWeight: '800',
            lineHeight: '1.15',
            marginBottom: '20px',
            maxWidth: '850px',
            letterSpacing: '-0.03em',
            textWrap: 'balance' as 'balance'
          }}
        >
          {synthesis.title}
        </h2>

        {/* Preview */}
        <p
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '18px',
            lineHeight: '1.6',
            color: '#D1D5DB',
            marginBottom: '32px',
            maxWidth: '700px'
          }}
        >
          {getPreview()}
        </p>

        {/* Bottom Stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            flexWrap: 'wrap'
          }}
        >
          {/* Sources Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#1F2937',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '700'
              }}
            >
              {synthesis.numSources}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>Sources</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Cross-referenced</div>
            </div>
          </div>

          {/* Reading Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#1F2937',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '700'
              }}
            >
              {synthesis.readingTime}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>Minutes</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Reading time</div>
            </div>
          </div>

          {/* Accuracy Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: synthesis.complianceScore >= 90 ? '#065F46' : '#92400E',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '700'
              }}
            >
              {synthesis.complianceScore}%
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>Accuracy</div>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>AI Verified</div>
            </div>
          </div>

          {/* Key Points Preview */}
          {synthesis.keyPoints && synthesis.keyPoints.length > 0 && (
            <div
              style={{
                marginLeft: 'auto',
                padding: '12px 20px',
                backgroundColor: '#1F2937',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '13px', color: '#9CA3AF' }}>
                {synthesis.keyPoints.length} points clés
              </span>
              <span style={{ fontSize: '16px' }}>→</span>
            </div>
          )}
        </div>

        {/* Pulse Animation */}
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </article>
    </Link>
  );
});

export default SynthesisHero;
