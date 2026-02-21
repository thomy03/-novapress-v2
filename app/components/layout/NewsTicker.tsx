"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { synthesesService } from '../../lib/api/services/syntheses';
import { Synthesis } from '../../types/api';

// Fallback demo data when API is unavailable
const FALLBACK_NEWS = [
  "Technologie : Les dernières actualités tech",
  "Économie : Actualités économiques en temps réel",
  "International : Actualités internationales",
  "Sport : Actualités sportives",
  "Culture : Actualités culturelles"
];

// Category emoji mapping
const CATEGORY_EMOJI: Record<string, string> = {
  'MONDE': '🌍',
  'TECH': '💻',
  'ECONOMIE': '📈',
  'POLITIQUE': '🏛️',
  'CULTURE': '🎭',
  'SPORT': '⚽',
  'SCIENCES': '🔬'
};

export function NewsTicker() {
  const { darkMode } = useTheme();
  const [breakingNews, setBreakingNews] = useState<string[]>(FALLBACK_NEWS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBreakingNews = useCallback(async () => {
    try {
      const response = await synthesesService.getBreakingSyntheses(8);

      if (response.data && response.data.length > 0) {
        const newsItems = response.data.map((synthesis: Synthesis) => {
          const emoji = CATEGORY_EMOJI[synthesis.category] || '🔴';
          // Truncate title if too long
          const title = synthesis.title.length > 100
            ? synthesis.title.substring(0, 100) + '...'
            : synthesis.title;
          return `${emoji} ${synthesis.category} : ${title}`;
        });
        setBreakingNews(newsItems);
      }
    } catch (error) {
      console.warn('Failed to fetch breaking news, using fallback:', error);
      // Keep fallback data
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBreakingNews();

    // Refresh every 2 minutes
    const interval = setInterval(fetchBreakingNews, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchBreakingNews]);

  // Duplicate news items for seamless scrolling
  const duplicatedNews = [...breakingNews, ...breakingNews];

  return (
    <>
      <div
        role="complementary"
        aria-label="Dernières actualités"
        aria-live="polite"
        style={{
          backgroundColor: '#DC2626',
          color: 'white',
          overflow: 'hidden',
          position: 'relative',
          height: '45px',
          display: 'flex',
          alignItems: 'center'
        }}>
        <span style={{
          backgroundColor: darkMode ? '#0f172a' : '#334155',
          padding: '0 20px',
          fontWeight: 'bold',
          zIndex: 1,
          position: 'absolute',
          left: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          borderRight: '2px solid rgba(255,255,255,0.2)',
          fontSize: '13px',
          letterSpacing: '0.5px'
        }}>
          🔴 DERNIÈRE MINUTE
        </span>

        {isLoading ? (
          <div style={{
            paddingLeft: '200px',
            fontSize: '14px',
            opacity: 0.8
          }}>
            Chargement des actualités...
          </div>
        ) : (
          <div style={{
            display: 'flex',
            animation: `scroll ${Math.max(30, breakingNews.length * 8)}s linear infinite`,
            paddingLeft: '200px',
            alignItems: 'center',
            height: '100%'
          }}>
            {duplicatedNews.map((text, index) => (
              <span
                key={index}
                style={{
                  paddingRight: '80px',
                  whiteSpace: 'nowrap',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'default'
                }}
              >
                {text}
              </span>
            ))}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: "@keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }"}} />
    </>
  );
}
