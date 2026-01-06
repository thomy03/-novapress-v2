"use client";

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import { synthesesService } from '../../lib/api/services/syntheses';

interface NavigationProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

// Categories matching backend
const CATEGORIES = [
  { id: 'ACCUEIL', label: 'ACCUEIL', apiCategory: null },
  { id: 'MONDE', label: 'MONDE', apiCategory: 'MONDE' },
  { id: 'TECH', label: 'TECH', apiCategory: 'TECH' },
  { id: 'ECONOMIE', label: 'ÉCONOMIE', apiCategory: 'ECONOMIE' },
  { id: 'POLITIQUE', label: 'POLITIQUE', apiCategory: 'POLITIQUE' },
  { id: 'CULTURE', label: 'CULTURE', apiCategory: 'CULTURE' },
  { id: 'SPORT', label: 'SPORT', apiCategory: 'SPORT' },
  { id: 'SCIENCES', label: 'SCIENCES', apiCategory: 'SCIENCES' }
];

export function Navigation({ selectedCategory, onCategoryChange }: NavigationProps) {
  const { theme } = useTheme();
  const [liveCount, setLiveCount] = useState<number>(0);
  const [categoryStats, setCategoryStats] = useState<Record<string, number>>({});

  const fetchStats = useCallback(async () => {
    try {
      // Fetch live count for EN DIRECT badge
      const liveResponse = await synthesesService.getLiveCount(24);
      setLiveCount(liveResponse.count);

      // Fetch category stats
      const statsResponse = await synthesesService.getCategoriesStats(24);
      if (statsResponse.data) {
        const stats: Record<string, number> = {};
        statsResponse.data.forEach(cat => {
          stats[cat.name] = cat.count;
        });
        setCategoryStats(stats);
      }
    } catch (error) {
      console.warn('Failed to fetch navigation stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <nav role="navigation" aria-label="Navigation principale" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
      {CATEGORIES.map(item => {
        const isSelected = selectedCategory === item.id;
        const count = item.apiCategory ? categoryStats[item.apiCategory] || 0 : 0;

        return (
          <button
            key={item.id}
            onClick={() => onCategoryChange(item.id)}
            role="button"
            aria-current={isSelected ? 'page' : undefined}
            aria-label={`Afficher les articles de la catégorie ${item.label}${count > 0 ? `, ${count} articles` : ''}`}
            className={`nav-item-hover ${isSelected ? 'nav-item-active' : ''}`}
            style={{
              fontSize: '13px',
              fontWeight: 'bold',
              color: isSelected ? '#DC2626' : theme.text,
              textDecoration: 'none',
              padding: '8px 14px',
              borderRadius: '20px',
              backgroundColor: isSelected ? (theme.bgTertiary || '#f3f4f6') : 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              position: 'relative',
              ['--nav-hover-bg' as string]: theme.bgTertiary || '#f3f4f6'
            }}
          >
            {item.label}
            {count > 0 && item.apiCategory && (
              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: isSelected ? '#DC2626' : '#6B7280',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontWeight: '600',
                  minWidth: '18px',
                  textAlign: 'center'
                }}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}

      {/* EN DIRECT Button - Links to /live page */}
      <Link
        href="/live"
        aria-label={`Actualités en direct${liveCount > 0 ? `, ${liveCount} articles` : ''}`}
        className="btn-hover-outline-danger"
        style={{
          border: '2px solid #DC2626',
          borderRadius: '20px',
          padding: '8px 16px',
          backgroundColor: 'transparent',
          color: '#DC2626',
          fontWeight: 'bold',
          cursor: 'pointer',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          textDecoration: 'none'
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            backgroundColor: '#DC2626',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }}
          aria-hidden="true"
        />
        EN DIRECT
        {liveCount > 0 && (
          <span
            style={{
              fontSize: '10px',
              backgroundColor: '#DC2626',
              color: 'white',
              borderRadius: '10px',
              padding: '2px 6px',
              fontWeight: '600',
              minWidth: '18px',
              textAlign: 'center'
            }}
          >
            {liveCount > 99 ? '99+' : liveCount}
          </span>
        )}
      </Link>

      {/* Pulse animation for live indicator */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </nav>
  );
}
