'use client';

import React from 'react';
import Link from 'next/link';

interface Synthesis {
  id: string;
  title: string;
  summary: string;
  introduction?: string;
  body?: string;
  analysis?: string;
  keyPoints: string[];
  sources: string[];
  numSources: number;
  complianceScore: number;
  readingTime: number;
  createdAt: string;
}

interface SynthesisCardProps {
  synthesis: Synthesis;
}

export default function SynthesisCard({ synthesis }: SynthesisCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get preview content (first 2 paragraphs)
  const fullContent = synthesis.body || synthesis.summary || '';
  const paragraphs = fullContent.split('\n\n').filter(p => p.trim());
  const previewParagraphs = paragraphs.slice(0, 2);

  return (
    <article
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E5E5',
        padding: '24px',
        marginBottom: '16px',
        position: 'relative'
      }}
    >
      {/* AI Badge */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          backgroundColor: '#2563EB',
          color: '#FFFFFF',
          padding: '4px 10px',
          fontSize: '11px',
          fontWeight: '600',
          letterSpacing: '0.5px',
          textTransform: 'uppercase'
        }}
      >
        AI SYNTHESIS
      </div>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <Link
          href={`/synthesis/${synthesis.id}`}
          style={{ textDecoration: 'none' }}
        >
          <h3
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '22px',
              fontWeight: '700',
              lineHeight: '1.3',
              color: '#000000',
              marginBottom: '8px',
              paddingRight: '100px',
              cursor: 'pointer',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#2563EB'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#000000'}
          >
            {synthesis.title}
          </h3>
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '12px',
            color: '#6B7280'
          }}
        >
          <span>{synthesis.numSources} sources</span>
          <span style={{ color: '#E5E5E5' }}>|</span>
          <span>{synthesis.readingTime} min read</span>
          <span style={{ color: '#E5E5E5' }}>|</span>
          <span>{formatDate(synthesis.createdAt)}</span>
        </div>
      </div>

      {/* Introduction (chapo) - always visible */}
      {synthesis.introduction && (
        <p
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '17px',
            fontWeight: '500',
            lineHeight: '1.6',
            color: '#1F2937',
            marginBottom: '16px',
            borderLeft: '3px solid #2563EB',
            paddingLeft: '16px'
          }}
        >
          {synthesis.introduction}
        </p>
      )}

      {/* Body preview (first 2 paragraphs) */}
      <div
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '15px',
          lineHeight: '1.8',
          color: '#374151',
          marginBottom: '16px'
        }}
      >
        {previewParagraphs.map((paragraph, idx) => (
          <p key={idx} style={{ marginBottom: '12px' }}>
            {paragraph}
          </p>
        ))}
      </div>

      {/* Read More Link */}
      <Link
        href={`/synthesis/${synthesis.id}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: '#2563EB',
          fontSize: '14px',
          fontWeight: '600',
          textDecoration: 'none',
          marginBottom: '16px'
        }}
      >
        <span>Lire l'article complet</span>
        <span style={{ fontSize: '12px' }}>&rarr;</span>
      </Link>

      {/* Key Points Preview */}
      {synthesis.keyPoints && synthesis.keyPoints.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '10px'
            }}
          >
            Points Cles
          </h4>
          <ul
            style={{
              margin: 0,
              paddingLeft: '20px'
            }}
          >
            {synthesis.keyPoints.slice(0, 3).map((point, index) => (
              <li
                key={index}
                style={{
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: '#374151',
                  marginBottom: '6px'
                }}
              >
                {point}
              </li>
            ))}
            {synthesis.keyPoints.length > 3 && (
              <li
                style={{
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: '#6B7280',
                  fontStyle: 'italic'
                }}
              >
                + {synthesis.keyPoints.length - 3} autres points...
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Sources */}
      {synthesis.sources && synthesis.sources.length > 0 && (
        <div
          style={{
            borderTop: '1px solid #E5E5E5',
            paddingTop: '12px',
            marginTop: '16px'
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Sources:{' '}
          </span>
          <span
            style={{
              fontSize: '12px',
              color: '#6B7280'
            }}
          >
            {synthesis.sources.join(', ')}
          </span>
        </div>
      )}

      {/* Compliance Score */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: synthesis.complianceScore >= 90 ? '#10B981' : '#F59E0B'
          }}
        />
        <span
          style={{
            fontSize: '11px',
            color: '#6B7280'
          }}
        >
          {synthesis.complianceScore}% accuracy
        </span>
      </div>
    </article>
  );
}
