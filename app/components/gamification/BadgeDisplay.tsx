"use client";

/**
 * BadgeDisplay - Shows earned and available badges
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { getBadgesWithStatus, Badge } from '../../lib/gamification';

interface BadgeDisplayProps {
  showLocked?: boolean;
  compact?: boolean;
}

export function BadgeDisplay({ showLocked = true, compact = false }: BadgeDisplayProps) {
  const { theme, darkMode } = useTheme();
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    setBadges(getBadgesWithStatus());
  }, []);

  const unlockedBadges = badges.filter(b => b.unlocked);
  const lockedBadges = badges.filter(b => !b.unlocked);

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        {unlockedBadges.slice(0, 5).map(badge => (
          <span
            key={badge.id}
            title={`${badge.name}: ${badge.description}`}
            style={{ fontSize: '16px', cursor: 'help' }}
          >
            {badge.icon}
          </span>
        ))}
        {unlockedBadges.length > 5 && (
          <span style={{
            fontSize: '10px',
            color: theme.textSecondary,
            backgroundColor: theme.bgSecondary,
            padding: '2px 6px',
            borderRadius: '10px',
          }}>
            +{unlockedBadges.length - 5}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: darkMode ? '#1F2937' : '#F9FAFB',
      border: `1px solid ${theme.border}`,
      borderRadius: '12px',
      padding: '16px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
      }}>
        <span style={{ fontSize: '20px' }}>🏅</span>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: theme.textSecondary,
        }}>
          Badges ({unlockedBadges.length}/{badges.length})
        </span>
      </div>

      {/* Unlocked Badges */}
      {unlockedBadges.length > 0 && (
        <div style={{ marginBottom: showLocked && lockedBadges.length > 0 ? '16px' : 0 }}>
          <div style={{
            fontSize: '11px',
            color: theme.textSecondary,
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Débloqués
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: '8px',
          }}>
            {unlockedBadges.map(badge => (
              <div
                key={badge.id}
                style={{
                  textAlign: 'center',
                  padding: '12px 8px',
                  backgroundColor: darkMode ? '#374151' : '#FFFFFF',
                  borderRadius: '8px',
                  border: `1px solid ${darkMode ? '#4B5563' : '#E5E7EB'}`,
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>{badge.icon}</div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: theme.text,
                  marginBottom: '2px',
                }}>
                  {badge.name}
                </div>
                <div style={{
                  fontSize: '9px',
                  color: theme.textSecondary,
                }}>
                  {badge.requirement}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked Badges */}
      {showLocked && lockedBadges.length > 0 && (
        <div>
          <div style={{
            fontSize: '11px',
            color: theme.textSecondary,
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            À débloquer
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: '8px',
          }}>
            {lockedBadges.map(badge => (
              <div
                key={badge.id}
                style={{
                  textAlign: 'center',
                  padding: '12px 8px',
                  backgroundColor: darkMode ? '#111827' : '#F3F4F6',
                  borderRadius: '8px',
                  border: `1px dashed ${theme.border}`,
                  opacity: 0.6,
                }}
              >
                <div style={{
                  fontSize: '28px',
                  marginBottom: '4px',
                  filter: 'grayscale(1)',
                }}>
                  {badge.icon}
                </div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: theme.textSecondary,
                  marginBottom: '2px',
                }}>
                  {badge.name}
                </div>
                <div style={{
                  fontSize: '9px',
                  color: theme.textSecondary,
                }}>
                  {badge.requirement}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {unlockedBadges.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '24px',
          color: theme.textSecondary,
          fontSize: '13px',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}>🎯</div>
          <div>Lisez des synthèses pour débloquer vos premiers badges !</div>
        </div>
      )}
    </div>
  );
}

export default BadgeDisplay;
