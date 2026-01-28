"use client";

/**
 * GamificationToast - Notification toast for points and badges earned
 */

import React, { useState, useEffect } from 'react';
import { Badge } from '../../lib/gamification';

interface ToastData {
  id: string;
  type: 'points' | 'badge' | 'levelUp' | 'streak';
  pointsEarned?: number;
  badge?: Badge;
  newLevel?: number;
  streak?: number;
}

interface GamificationToastProps {
  toast: ToastData | null;
  onClose: () => void;
  duration?: number;
}

export function GamificationToast({ toast, onClose, duration = 4000 }: GamificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast, duration, onClose]);

  if (!toast) return null;

  const getContent = () => {
    switch (toast.type) {
      case 'points':
        return {
          icon: '⭐',
          title: `+${toast.pointsEarned} points !`,
          subtitle: 'Continuez à lire pour gagner plus',
          color: '#F59E0B',
        };
      case 'badge':
        return {
          icon: toast.badge?.icon || '🏅',
          title: `Badge débloqué !`,
          subtitle: toast.badge?.name || 'Nouveau badge',
          color: '#8B5CF6',
        };
      case 'levelUp':
        return {
          icon: '🎉',
          title: `Niveau ${toast.newLevel} !`,
          subtitle: 'Félicitations, vous montez de niveau',
          color: '#3B82F6',
        };
      case 'streak':
        return {
          icon: '🔥',
          title: `${toast.streak} jours de suite !`,
          subtitle: 'Votre streak continue',
          color: '#EF4444',
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      transform: isVisible ? 'translateX(0)' : 'translateX(120%)',
      opacity: isVisible ? 1 : 0,
      transition: 'all 0.3s ease-out',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        backgroundColor: '#1F2937',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        border: `2px solid ${content.color}`,
        minWidth: '280px',
      }}>
        {/* Icon with animation */}
        <div style={{
          fontSize: '32px',
          animation: 'bounce 0.5s ease',
        }}>
          {content.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '16px',
            fontWeight: '700',
            color: content.color,
            marginBottom: '2px',
          }}>
            {content.title}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#9CA3AF',
          }}>
            {content.subtitle}
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: '#6B7280',
            fontSize: '16px',
          }}
        >
          ✕
        </button>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export default GamificationToast;
