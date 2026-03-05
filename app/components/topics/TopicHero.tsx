'use client';

import React from 'react';
import Link from 'next/link';

const NARRATIVE_ARC_COLORS: Record<string, { color: string; label: string }> = {
  emerging:   { color: '#2563EB', label: '\u00c9mergent' },
  developing: { color: '#10B981', label: 'En d\u00e9veloppement' },
  peak:       { color: '#DC2626', label: 'Point culminant' },
  declining:  { color: '#F59E0B', label: 'En d\u00e9clin' },
  resolved:   { color: '#6B7280', label: 'R\u00e9solu' },
};

interface TopicHeroProps {
  topic: string;
  narrativeArc: string;
  isActive: boolean;
  synthesisCount: number;
  durationDays: number;
  transparencyAvg: number;
  sourcesTotal: number;
  entitiesCount: number;
  causalNodes: number;
  firstDate?: string;
}

export default function TopicHero({
  topic,
  narrativeArc,
  isActive,
  synthesisCount,
  durationDays,
  transparencyAvg,
  sourcesTotal,
  entitiesCount,
  firstDate,
}: TopicHeroProps) {
  const arc = NARRATIVE_ARC_COLORS[narrativeArc] || NARRATIVE_ARC_COLORS.developing;

  const transparencyColor = transparencyAvg >= 70 ? '#10B981' : transparencyAvg >= 40 ? '#F59E0B' : '#DC2626';

  const kpis = [
    { value: synthesisCount, label: 'SYNTH\u00c8SES' },
    { value: `${durationDays}j`, label: 'DUR\u00c9E' },
    { value: sourcesTotal, label: 'SOURCES' },
    { value: entitiesCount, label: 'ENTIT\u00c9S' },
  ];

  return (
    <div>
      {/* Hero Image */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '280px',
        overflow: 'hidden',
        marginBottom: '24px',
        backgroundColor: '#1a1a2e',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://source.unsplash.com/1600x400/?${encodeURIComponent(topic)},map,country`}
          alt={`Illustration: ${topic}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
          onError={(e) => {
            // Fallback: hide image, show dark bg
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {/* Dark overlay for text readability */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          right: '24px',
        }}>
          {/* Badges on image */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}>
            <span style={{
              backgroundColor: '#FFF',
              color: '#000',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '1px',
            }}>
              DOSSIER
            </span>
            <span style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: '#FFF',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              backdropFilter: 'blur(4px)',
            }}>
              {arc.label}
            </span>
            {isActive && (
              <span style={{
                backgroundColor: 'rgba(220, 38, 38, 0.8)',
                color: '#FFF',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}>
                EN COURS
              </span>
            )}
          </div>
          <h1 style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '42px',
            fontWeight: 700,
            lineHeight: 1.1,
            color: '#FFF',
            margin: 0,
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            {topic}
          </h1>
        </div>
      </div>

      {/* Content below image */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px',
      }}>
        {/* Back link */}
        <Link href="/" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: '#6B7280',
          textDecoration: 'none',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          {'← Retour aux actualités'}
        </Link>

        {/* Subtitle */}
        {firstDate && (
          <p style={{
            fontSize: '14px',
            color: '#6B7280',
            margin: '0 0 24px 0',
          }}>
            Dossier suivi depuis le{' '}
            {new Date(firstDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}

        {/* KPI Bar — large numbers with vertical dividers */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0',
          paddingBottom: '32px',
          borderBottom: '1px solid #E5E5E5',
          overflowX: 'auto',
        }}>
          {kpis.map((kpi, i) => (
            <div
              key={kpi.label}
              style={{
                flex: '1 0 auto',
                textAlign: 'center',
                padding: '0 20px',
                borderRight: i < kpis.length - 1 ? '1px solid #E5E5E5' : 'none',
                minWidth: '100px',
              }}
            >
              <div style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: '28px',
                fontWeight: 700,
                color: '#000',
                lineHeight: 1.2,
              }}>
                {kpi.value}
              </div>
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                color: '#9CA3AF',
                marginTop: '4px',
              }}>
                {kpi.label}
              </div>
            </div>
          ))}

          {/* Transparency score with color indicator */}
          <div
            style={{
              flex: '1 0 auto',
              textAlign: 'center',
              padding: '0 20px',
              minWidth: '100px',
            }}
          >
            <div style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '28px',
              fontWeight: 700,
              color: transparencyColor,
              lineHeight: 1.2,
            }}>
              {Math.round(transparencyAvg)}<span style={{ fontSize: '16px', color: '#9CA3AF' }}>/100</span>
            </div>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              color: '#9CA3AF',
              marginTop: '4px',
            }}>
              TRANSPARENCE
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
