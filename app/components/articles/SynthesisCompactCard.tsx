'use client';

import React, { memo, useState } from 'react';
import Link from 'next/link';

interface Synthesis {
  id: string;
  title: string;
  summary: string;
  introduction?: string;
  keyPoints: string[];
  sources: string[];
  numSources: number;
  complianceScore: number;
  readingTime: number;
  createdAt: string;
}

interface SynthesisCompactCardProps {
  synthesis: Synthesis;
}

export const SynthesisCompactCard = memo(function SynthesisCompactCard({
  synthesis
}: SynthesisCompactCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'À l\'instant';
    if (hours < 24) return `Il y a ${hours}h`;
    if (hours < 48) return 'Hier';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // Generate a pseudo-random image based on synthesis id
  const getImageUrl = () => {
    const hash = synthesis.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `https://picsum.photos/600/400?random=${hash}`;
  };

  return (
    <Link href={`/synthesis/${synthesis.id}`} style={{ textDecoration: 'none' }}>
      <article
        style={{
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
          height: '100%',
          transform: isHovered ? 'translateY(-4px)' : 'none',
          boxShadow: isHovered ? '0 12px 40px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.05)'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image */}
        <div style={{
          width: '100%',
          height: '180px',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#E5E5E5'
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getImageUrl()}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.5s ease',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)'
            }}
            loading="lazy"
          />

          {/* Gradient overlay */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '60px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
            pointerEvents: 'none'
          }} />

          {/* Top badges */}
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            {/* AI Badge */}
            <span style={{
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: '10px',
              fontWeight: '700',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ fontSize: '12px' }}>⚡</span> AI
            </span>

            {/* Accuracy Badge */}
            <span style={{
              backgroundColor: synthesis.complianceScore >= 90 ? '#059669' : '#F59E0B',
              color: '#FFFFFF',
              fontSize: '10px',
              fontWeight: '700',
              padding: '6px 10px'
            }}>
              {synthesis.complianceScore}%
            </span>
          </div>

          {/* Sources count */}
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            backgroundColor: 'rgba(255,255,255,0.95)',
            color: '#000000',
            fontSize: '10px',
            fontWeight: '600',
            padding: '6px 10px'
          }}>
            {synthesis.numSources} sources
          </div>

          {/* Reading time */}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            backgroundColor: 'rgba(255,255,255,0.95)',
            color: '#000000',
            fontSize: '10px',
            fontWeight: '600',
            padding: '4px 10px'
          }}>
            {synthesis.readingTime} min
          </div>
        </div>

        {/* Content */}
        <div style={{
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1
        }}>
          {/* Title */}
          <h3 style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '18px',
            fontWeight: '700',
            lineHeight: '1.35',
            color: '#000000',
            margin: 0,
            marginBottom: '12px',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {synthesis.title}
          </h3>

          {/* Key Point Preview */}
          {synthesis.keyPoints && synthesis.keyPoints.length > 0 && (
            <p style={{
              fontSize: '14px',
              color: '#4B5563',
              lineHeight: '1.5',
              marginBottom: '16px',
              paddingLeft: '12px',
              borderLeft: '2px solid #2563EB',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flex: 1
            }}>
              {synthesis.keyPoints[0]}
            </p>
          )}

          {/* Bottom Meta */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '12px',
            borderTop: '1px solid #E5E5E5',
            marginTop: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#2563EB'
              }} />
              <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>
                NovaPress AI
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>
              {formatDate(synthesis.createdAt)}
            </span>
          </div>
        </div>

        {/* Hover accent line */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          backgroundColor: '#2563EB',
          transform: isHovered ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left',
          transition: 'transform 0.3s ease'
        }} />
      </article>
    </Link>
  );
});

export default SynthesisCompactCard;
