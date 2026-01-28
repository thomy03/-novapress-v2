'use client';

import React, { memo, useEffect, useState } from 'react';

interface ViralityScoreProps {
  score: number; // 0-100
  sources: number;
  engagement?: number;
  recency?: 'breaking' | 'recent' | 'today' | 'yesterday' | 'older';
  size?: 'small' | 'medium' | 'large';
  showDetails?: boolean;
}

export const ViralityScore = memo(function ViralityScore({
  score,
  sources,
  engagement = 0,
  recency = 'today',
  size = 'medium',
  showDetails = true
}: ViralityScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animate score on mount
  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = score / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setAnimatedScore(score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  // Get color based on score
  const getColor = () => {
    if (score >= 80) return '#DC2626'; // Breaking/Viral
    if (score >= 60) return '#F59E0B'; // Hot
    if (score >= 40) return '#2563EB'; // Active
    return '#6B7280'; // Normal
  };

  // Get label based on score
  const getLabel = () => {
    if (score >= 90) return 'VIRAL';
    if (score >= 80) return 'BREAKING';
    if (score >= 60) return 'HOT';
    if (score >= 40) return 'TRENDING';
    return 'ACTIVE';
  };

  // Get recency label
  const getRecencyLabel = () => {
    switch (recency) {
      case 'breaking': return 'Just now';
      case 'recent': return '< 1h';
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      default: return 'Earlier';
    }
  };

  const sizeConfig = {
    small: {
      container: { width: '80px' },
      score: { fontSize: '20px' },
      label: { fontSize: '8px' },
      bar: { height: '3px' }
    },
    medium: {
      container: { width: '120px' },
      score: { fontSize: '28px' },
      label: { fontSize: '10px' },
      bar: { height: '4px' }
    },
    large: {
      container: { width: '160px' },
      score: { fontSize: '36px' },
      label: { fontSize: '12px' },
      bar: { height: '6px' }
    }
  };

  const config = sizeConfig[size];
  const color = getColor();

  return (
    <div
      style={{
        ...config.container,
        textAlign: 'center'
      }}
    >
      {/* Score Circle */}
      <div
        style={{
          position: 'relative',
          width: size === 'small' ? '48px' : size === 'medium' ? '64px' : '80px',
          height: size === 'small' ? '48px' : size === 'medium' ? '64px' : '80px',
          margin: '0 auto 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Background Circle */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            transform: 'rotate(-90deg)'
          }}
        >
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="#E5E5E5"
            strokeWidth="6%"
          />
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke={color}
            strokeWidth="6%"
            strokeDasharray={`${(animatedScore / 100) * 283} 283`}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dasharray 0.3s ease'
            }}
          />
        </svg>

        {/* Score Number */}
        <span
          style={{
            ...config.score,
            fontWeight: '700',
            color: color,
            position: 'relative',
            zIndex: 1
          }}
        >
          {animatedScore}
        </span>
      </div>

      {/* Label */}
      <div
        style={{
          ...config.label,
          fontWeight: '700',
          letterSpacing: '0.1em',
          color: color,
          marginBottom: showDetails ? '12px' : '0'
        }}
      >
        {getLabel()}
      </div>

      {/* Details */}
      {showDetails && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px',
            backgroundColor: '#F9FAFB',
            borderRadius: '4px'
          }}
        >
          {/* Sources */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase' }}>
              Sources
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '40px',
                  height: config.bar.height,
                  backgroundColor: '#E5E5E5',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${Math.min(sources * 10, 100)}%`,
                    height: '100%',
                    backgroundColor: '#2563EB',
                    transition: 'width 0.5s ease'
                  }}
                />
              </div>
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#374151' }}>
                {sources}
              </span>
            </div>
          </div>

          {/* Engagement */}
          {engagement > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase' }}>
                Engagement
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div
                  style={{
                    width: '40px',
                    height: config.bar.height,
                    backgroundColor: '#E5E5E5',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(engagement, 100)}%`,
                      height: '100%',
                      backgroundColor: '#10B981',
                      transition: 'width 0.5s ease'
                    }}
                  />
                </div>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#374151' }}>
                  {engagement}%
                </span>
              </div>
            </div>
          )}

          {/* Recency */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span style={{ fontSize: '10px', color: '#6B7280', textTransform: 'uppercase' }}>
              Recency
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: recency === 'breaking' ? '#DC2626' : '#374151'
              }}
            >
              {getRecencyLabel()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export default ViralityScore;
