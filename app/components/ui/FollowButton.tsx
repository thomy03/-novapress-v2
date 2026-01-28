"use client";

/**
 * FollowButton - Button to follow/unfollow a story
 * Integrates with followedStories service and notifications
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  isStoryFollowed,
  toggleFollowStory,
} from '../../lib/followedStories';

interface FollowButtonProps {
  synthesisId: string;
  title: string;
  category: string;
  narrativePhase?: string;
  compact?: boolean;
  onToggle?: (isFollowing: boolean) => void;
}

export function FollowButton({
  synthesisId,
  title,
  category,
  narrativePhase,
  compact = false,
  onToggle,
}: FollowButtonProps) {
  const { theme, darkMode } = useTheme();
  const [isFollowing, setIsFollowing] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setIsFollowing(isStoryFollowed(synthesisId));
  }, [synthesisId]);

  const handleClick = () => {
    const newState = toggleFollowStory(synthesisId, title, category, narrativePhase);
    setIsFollowing(newState);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
    onToggle?.(newState);
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        title={isFollowing ? 'Ne plus suivre' : 'Suivre cette histoire'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: `1px solid ${isFollowing ? '#3B82F6' : theme.border}`,
          backgroundColor: isFollowing ? '#3B82F6' : 'transparent',
          color: isFollowing ? '#FFFFFF' : theme.textSecondary,
          cursor: 'pointer',
          transition: 'all 0.2s',
          transform: animating ? 'scale(1.2)' : 'scale(1)',
        }}
      >
        <span style={{ fontSize: '14px' }}>
          {isFollowing ? '✓' : '🔔'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        borderRadius: '20px',
        border: `1px solid ${isFollowing ? '#3B82F6' : theme.border}`,
        backgroundColor: isFollowing
          ? (darkMode ? '#1E3A8A' : '#EFF6FF')
          : (darkMode ? '#1F2937' : '#FFFFFF'),
        color: isFollowing ? '#3B82F6' : theme.text,
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600',
        transition: 'all 0.2s',
        transform: animating ? 'scale(1.05)' : 'scale(1)',
      }}
    >
      <span style={{
        fontSize: '16px',
        transition: 'transform 0.2s',
        transform: animating ? 'rotate(20deg)' : 'none',
      }}>
        {isFollowing ? '🔔' : '🔕'}
      </span>
      <span>
        {isFollowing ? 'Suivi' : 'Suivre cette histoire'}
      </span>
    </button>
  );
}

export default FollowButton;
