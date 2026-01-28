"use client";

/**
 * FollowedStoriesList - Shows all stories the user is following
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getFollowedStories,
  unfollowStory,
  FollowedStory,
} from '../../lib/followedStories';

interface FollowedStoriesListProps {
  compact?: boolean;
  maxItems?: number;
}

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  emerging: { label: 'Émergent', color: '#10B981' },
  developing: { label: 'En développement', color: '#3B82F6' },
  peak: { label: 'Pic', color: '#F59E0B' },
  declining: { label: 'Déclin', color: '#6B7280' },
  resolved: { label: 'Résolu', color: '#8B5CF6' },
};

export function FollowedStoriesList({ compact = false, maxItems = 10 }: FollowedStoriesListProps) {
  const { theme, darkMode } = useTheme();
  const [stories, setStories] = useState<FollowedStory[]>([]);

  useEffect(() => {
    setStories(getFollowedStories());
  }, []);

  const handleUnfollow = (synthesisId: string) => {
    unfollowStory(synthesisId);
    setStories(getFollowedStories());
  };

  if (stories.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: compact ? '16px' : '32px',
        color: theme.textSecondary,
        fontSize: '13px',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}>🔔</div>
        <div>Vous ne suivez aucune histoire pour le moment.</div>
        <div style={{ marginTop: '4px', fontSize: '12px' }}>
          Cliquez sur &quot;Suivre cette histoire&quot; sur une synthèse pour être notifié des mises à jour.
        </div>
      </div>
    );
  }

  const displayedStories = stories.slice(0, maxItems);

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {displayedStories.map(story => (
          <Link
            key={story.synthesisId}
            href={`/synthesis/${story.synthesisId}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: darkMode ? '#1F2937' : '#F9FAFB',
              borderRadius: '6px',
              textDecoration: 'none',
              color: theme.text,
              fontSize: '12px',
            }}
          >
            <span>🔔</span>
            <span style={{
              flex: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {story.title}
            </span>
            {story.narrativePhase && (
              <span style={{
                padding: '2px 6px',
                backgroundColor: PHASE_LABELS[story.narrativePhase]?.color + '20',
                color: PHASE_LABELS[story.narrativePhase]?.color,
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '600',
              }}>
                {PHASE_LABELS[story.narrativePhase]?.label}
              </span>
            )}
          </Link>
        ))}
        {stories.length > maxItems && (
          <div style={{
            fontSize: '11px',
            color: theme.textSecondary,
            textAlign: 'center',
            padding: '4px',
          }}>
            +{stories.length - maxItems} autre{stories.length - maxItems > 1 ? 's' : ''}
          </div>
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
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🔔</span>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: theme.textSecondary,
          }}>
            Histoires suivies ({stories.length})
          </span>
        </div>
      </div>

      {/* Stories list */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {displayedStories.map(story => (
          <div
            key={story.synthesisId}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px',
              backgroundColor: darkMode ? '#111827' : '#FFFFFF',
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
            }}
          >
            {/* Category badge */}
            <span style={{
              padding: '4px 8px',
              backgroundColor: darkMode ? '#374151' : '#E5E7EB',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600',
              color: theme.textSecondary,
              textTransform: 'uppercase',
            }}>
              {story.category}
            </span>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link
                href={`/synthesis/${story.synthesisId}`}
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: theme.text,
                  textDecoration: 'none',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                {story.title}
              </Link>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '11px',
                color: theme.textSecondary,
              }}>
                {/* Narrative phase */}
                {story.narrativePhase && (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: PHASE_LABELS[story.narrativePhase]?.color,
                    }} />
                    {PHASE_LABELS[story.narrativePhase]?.label}
                  </span>
                )}

                {/* Follow date */}
                <span>
                  Suivi depuis {formatRelativeDate(story.followedAt)}
                </span>
              </div>
            </div>

            {/* Unfollow button */}
            <button
              onClick={() => handleUnfollow(story.synthesisId)}
              title="Ne plus suivre"
              style={{
                padding: '4px 8px',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                color: theme.textSecondary,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Show more */}
      {stories.length > maxItems && (
        <div style={{
          marginTop: '12px',
          textAlign: 'center',
          fontSize: '12px',
          color: theme.textSecondary,
        }}>
          Et {stories.length - maxItems} autre{stories.length - maxItems > 1 ? 's' : ''} histoire{stories.length - maxItems > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// Helper function to format relative dates
function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `${diffDays} jours`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} semaine${Math.floor(diffDays / 7) > 1 ? 's' : ''}`;
  return `${Math.floor(diffDays / 30)} mois`;
}

export default FollowedStoriesList;
