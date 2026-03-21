"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { synthesesService } from '../../lib/api/services/syntheses';
import { Synthesis } from '../../types/api';

export function NewsTicker() {
  const [breakingNews, setBreakingNews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBreakingNews = useCallback(async () => {
    try {
      const response = await synthesesService.getBreakingSyntheses(8);
      if (response.data && response.data.length > 0) {
        const newsItems = response.data.map((synthesis: Synthesis) => {
          const title = synthesis.title.length > 120
            ? synthesis.title.substring(0, 120) + '...'
            : synthesis.title;
          return `BREAKING: ${title}`;
        });
        setBreakingNews(newsItems);
      }
    } catch {
      setBreakingNews([
        'BREAKING: NovaPress AI Intelligence Network Active',
        'BREAKING: 53 Sources Monitored in Real-Time',
        'BREAKING: AI Synthesis Engine Operational',
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBreakingNews();
    const interval = setInterval(fetchBreakingNews, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchBreakingNews]);

  const duplicatedNews = [...breakingNews, ...breakingNews];
  const scrollDuration = Math.max(30, breakingNews.length * 8);

  return (
    <>
      <div
        role="complementary"
        aria-label="Breaking news"
        aria-live="polite"
        style={{
          backgroundColor: '#DC2626',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          padding: '5px 0',
          position: 'relative',
          zIndex: 55,
        }}
      >
        {isLoading ? (
          <div style={{
            fontFamily: 'var(--font-label)',
            fontSize: '10px',
            fontWeight: 700,
            color: '#FFFFFF',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            paddingLeft: '24px',
          }}>
            SCANNING SOURCES...
          </div>
        ) : (
          <div style={{
            display: 'flex',
            animation: `tickerScroll ${scrollDuration}s linear infinite`,
          }}>
            <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}>
              {duplicatedNews.map((text, index) => (
                <span
                  key={index}
                  style={{
                    fontFamily: 'var(--font-label)',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    paddingLeft: '32px',
                    paddingRight: '32px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
