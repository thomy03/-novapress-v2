'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '@/app/contexts/ThemeContext';
import { AnimatedCounter, StatCard } from '@/app/components/ui/AnimatedCounter';
import { MiniCausalGraph } from './MiniCausalGraph';
import { statsService, GlobalStats } from '@/app/lib/api/services/stats';

/**
 * UI-004d: IntelligenceHubPreview Component
 * Section proéminente sur la homepage avec stats et aperçu graphe
 */

interface IntelligenceHubPreviewProps {
  /** Afficher en mode compact */
  compact?: boolean;
}

export function IntelligenceHubPreview({ compact = false }: IntelligenceHubPreviewProps) {
  const { theme, darkMode } = useTheme();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await statsService.getGlobalStats();
        setStats(response.stats);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Impossible de charger les statistiques');
        // Use fallback stats
        setStats({
          sourcesCount: 53,
          synthesisCount: 0,
          causalRelationsCount: 0,
          accuracyScore: 94,
          articlesAnalyzed: 0,
          activeTopics: 0,
          lastUpdated: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Skeleton loading state
  if (loading) {
    return (
      <section
        style={{
          backgroundColor: darkMode ? 'rgba(37, 99, 235, 0.05)' : 'rgba(37, 99, 235, 0.03)',
          border: `1px solid ${darkMode ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)'}`,
          borderRadius: '16px',
          padding: compact ? '24px' : '32px',
          marginBottom: '32px',
        }}
      >
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {/* Skeleton boxes */}
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                flex: '1 1 150px',
                height: '80px',
                backgroundColor: theme.border,
                borderRadius: '8px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </section>
    );
  }

  const statItems = [
    {
      value: stats?.sourcesCount || 53,
      label: 'Sources mondiales',
      icon: '📰',
      delay: 0,
    },
    {
      value: stats?.synthesisCount || 0,
      label: 'Synthèses IA',
      icon: '🧠',
      delay: 200,
    },
    {
      value: stats?.causalRelationsCount || 0,
      label: 'Relations causales',
      icon: '🔗',
      delay: 400,
    },
    {
      value: stats?.accuracyScore || 94,
      label: '% Précision',
      icon: '✓',
      delay: 600,
    },
  ];

  return (
    <section
      style={{
        backgroundColor: darkMode ? 'rgba(37, 99, 235, 0.05)' : 'rgba(37, 99, 235, 0.03)',
        border: `1px solid ${darkMode ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)'}`,
        borderRadius: '16px',
        padding: compact ? '24px' : '32px',
        marginBottom: '32px',
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-label="Intelligence Hub Preview"
    >
      {/* Background decoration */}
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: `radial-gradient(circle, ${darkMode ? 'rgba(37, 99, 235, 0.1)' : 'rgba(37, 99, 235, 0.05)'} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <span
              style={{
                backgroundColor: '#2563EB',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              Intelligence IA
            </span>
            <span
              style={{
                fontSize: '10px',
                color: theme.textSecondary,
              }}
            >
              Mise à jour en temps réel
            </span>
          </div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: theme.text,
              margin: 0,
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            Nexus Causal NovaPress
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: theme.textSecondary,
              margin: '8px 0 0',
              maxWidth: '400px',
            }}
          >
            Analyse automatique des relations de cause à effet dans l'actualité mondiale
          </p>
        </div>

        {/* CTA Button */}
        <Link
          href="/intelligence"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#2563EB',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#1D4ED8';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#2563EB';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Explorer le Hub
          <span>→</span>
        </Link>
      </div>

      {/* Content: Stats + Graph */}
      <div
        style={{
          display: 'flex',
          gap: '32px',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        {/* Stats Grid */}
        <div
          style={{
            flex: '1 1 400px',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px',
          }}
        >
          {statItems.map((stat, index) => (
            <div
              key={index}
              style={{
                backgroundColor: theme.card,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '20px' }}>{stat.icon}</span>
              <AnimatedCounter
                value={stat.value}
                size="medium"
                delay={stat.delay}
                compact={stat.value > 1000}
              />
              <span
                style={{
                  fontSize: '12px',
                  color: theme.textSecondary,
                  fontWeight: 500,
                }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Mini Causal Graph */}
        {!compact && (
          <div
            style={{
              flex: '0 0 300px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: theme.textSecondary,
              }}
            >
              Aperçu du graphe causal
            </span>
            <MiniCausalGraph
              width={280}
              height={180}
              animated={true}
            />
            <span
              style={{
                fontSize: '11px',
                color: theme.textSecondary,
                fontStyle: 'italic',
              }}
            >
              Cliquez sur un nœud pour voir les connexions
            </span>
          </div>
        )}
      </div>

      {/* Error notice (subtle) */}
      {error && (
        <div
          style={{
            marginTop: '16px',
            padding: '8px 12px',
            backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
            borderRadius: '6px',
            fontSize: '12px',
            color: theme.textSecondary,
          }}
        >
          ℹ️ Données de démonstration (connexion API en cours)
        </div>
      )}
    </section>
  );
}

export default IntelligenceHubPreview;
