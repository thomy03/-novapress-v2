"use client";

/**
 * StreakCounter - Displays current reading streak and points
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { getProgress, UserProgress } from '../../lib/gamification';

interface StreakCounterProps {
  compact?: boolean;
}

export function StreakCounter({ compact = false }: StreakCounterProps) {
  const { theme, darkMode } = useTheme();
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    setProgress(getProgress());
  }, []);

  if (!progress) return null;

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        padding: '6px 12px',
        backgroundColor: darkMode ? '#1F2937' : '#FEF3C7',
        borderRadius: '20px',
        fontSize: '12px',
      }}>
        {/* Streak */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>🔥</span>
          <span style={{ fontWeight: '600', color: '#F59E0B' }}>{progress.streak}</span>
        </div>
        {/* Points */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>⭐</span>
          <span style={{ fontWeight: '600', color: theme.text }}>{progress.points}</span>
        </div>
        {/* Level */}
        <div style={{
          padding: '2px 8px',
          backgroundColor: '#3B82F6',
          borderRadius: '10px',
          color: '#FFFFFF',
          fontWeight: '600',
          fontSize: '10px',
        }}>
          Niv. {progress.level}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: darkMode ? '#1F2937' : '#FFFBEB',
      border: `1px solid ${darkMode ? '#374151' : '#FDE68A'}`,
      borderRadius: '12px',
      padding: '16px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🎮</span>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: theme.textSecondary,
          }}>
            Votre progression
          </span>
        </div>
        <div style={{
          padding: '4px 12px',
          backgroundColor: '#3B82F6',
          borderRadius: '12px',
          color: '#FFFFFF',
          fontWeight: '700',
          fontSize: '12px',
        }}>
          Niveau {progress.level}
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
      }}>
        {/* Streak */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          backgroundColor: darkMode ? '#374151' : '#FFFFFF',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '4px' }}>🔥</div>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#F59E0B',
          }}>
            {progress.streak}
          </div>
          <div style={{
            fontSize: '11px',
            color: theme.textSecondary,
            marginTop: '4px',
          }}>
            jours consécutifs
          </div>
        </div>

        {/* Points */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          backgroundColor: darkMode ? '#374151' : '#FFFFFF',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '4px' }}>⭐</div>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            color: theme.text,
          }}>
            {progress.points}
          </div>
          <div style={{
            fontSize: '11px',
            color: theme.textSecondary,
            marginTop: '4px',
          }}>
            points
          </div>
        </div>

        {/* Articles Read */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          backgroundColor: darkMode ? '#374151' : '#FFFFFF',
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '4px' }}>📚</div>
          <div style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#10B981',
          }}>
            {progress.articlesRead}
          </div>
          <div style={{
            fontSize: '11px',
            color: theme.textSecondary,
            marginTop: '4px',
          }}>
            synthèses lues
          </div>
        </div>
      </div>

      {/* Progress to next level */}
      <div style={{ marginTop: '16px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: theme.textSecondary,
          marginBottom: '4px',
        }}>
          <span>Niveau {progress.level}</span>
          <span>Niveau {progress.level + 1}</span>
        </div>
        <div style={{
          height: '6px',
          backgroundColor: darkMode ? '#374151' : '#E5E7EB',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${(progress.points % 100)}%`,
            backgroundColor: '#3B82F6',
            borderRadius: '3px',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{
          fontSize: '11px',
          color: theme.textSecondary,
          marginTop: '4px',
          textAlign: 'center',
        }}>
          {100 - (progress.points % 100)} points avant le niveau suivant
        </div>
      </div>

      {/* Badges count */}
      <div style={{
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '12px',
        color: theme.textSecondary,
      }}>
        <span>🏅</span>
        <span>{progress.badges.length} badge{progress.badges.length !== 1 ? 's' : ''} débloqué{progress.badges.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

export default StreakCounter;
