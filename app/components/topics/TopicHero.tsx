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
  causalNodes,
}: TopicHeroProps) {
  const arc = NARRATIVE_ARC_COLORS[narrativeArc] || NARRATIVE_ARC_COLORS.developing;

  const kpis = [
    { value: synthesisCount, label: 'SYNTH\u00c8SES' },
    { value: `${durationDays}j`, label: 'DUR\u00c9E' },
    { value: sourcesTotal, label: 'SOURCES' },
    { value: entitiesCount, label: 'ENTIT\u00c9S' },
    { value: Math.round(transparencyAvg), label: 'TRANSPARENCE' },
    { value: causalNodes, label: 'NOEUDS CAUSAUX' },
  ];

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 24px 0',
    }}>
      {/* Back link */}
      <Link href="/" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        color: '#6B7280',
        textDecoration: 'none',
        fontSize: '13px',
        marginBottom: '24px',
      }}>
        {'← Retour aux actualités'}
      </Link>

      {/* Badges */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px',
        flexWrap: 'wrap',
      }}>
        <span style={{
          backgroundColor: '#000',
          color: '#FFF',
          padding: '4px 12px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '1px',
        }}>
          DOSSIER
        </span>
        <span style={{
          backgroundColor: `${arc.color}15`,
          color: arc.color,
          padding: '4px 12px',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.5px',
        }}>
          {arc.label}
        </span>
        {isActive && (
          <span style={{
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            padding: '4px 12px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.5px',
          }}>
            EN COURS
          </span>
        )}
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '48px',
        fontWeight: 700,
        lineHeight: 1.1,
        color: '#000',
        margin: '0 0 24px 0',
        borderBottom: '3px solid #000',
        paddingBottom: '16px',
      }}>
        {topic}
      </h1>

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
      </div>
    </div>
  );
}
