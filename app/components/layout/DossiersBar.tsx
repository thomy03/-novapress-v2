"use client";

/**
 * DossiersBar - Thin bar showing hot dossiers/entities between NewsTicker and Hero
 * Style: Newspaper-professional, white background, black text, vertical separators
 * Fetches cleaned trending entities from /api/trending/entities
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface TrendingEntity {
  entity: string;
  count: number;
}

export function DossiersBar() {
  const { theme } = useTheme();
  const [entities, setEntities] = useState<TrendingEntity[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/trending/entities?hours=168&limit=7`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.data) {
          setEntities(data.data);
        }
      })
      .catch(() => {}); // Fail silently
  }, []);

  if (entities.length === 0) return null;

  return (
    <nav
      aria-label="Dossiers en cours"
      style={{
        backgroundColor: theme.bg,
        borderBottom: `1px solid ${theme.border}`,
        padding: '10px 0',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '0',
          overflow: 'hidden',
        }}
      >
        {/* Label */}
        <span
          style={{
            fontSize: '10px',
            fontWeight: 800,
            color: theme.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            marginRight: '16px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          DOSSIERS
        </span>

        {/* Entity links with separators */}
        <div
          className="mobile-nav-scroll"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0',
            overflow: 'hidden',
            flex: 1,
          }}
        >
          {entities.map((item, index) => (
            <React.Fragment key={item.entity}>
              {index > 0 && (
                <span
                  style={{
                    color: theme.border,
                    margin: '0 12px',
                    fontSize: '12px',
                    flexShrink: 0,
                    userSelect: 'none',
                  }}
                  aria-hidden="true"
                >
                  |
                </span>
              )}
              <Link
                href={`/topics/${encodeURIComponent(item.entity)}`}
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: theme.text,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.textDecoration = 'none';
                }}
              >
                {item.entity}
              </Link>
            </React.Fragment>
          ))}
        </div>
      </div>
    </nav>
  );
}
