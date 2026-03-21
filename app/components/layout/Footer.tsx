"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';

const FOOTER_LINKS = [
  { label: 'TERMS OF INTELLIGENCE', href: '/terms' },
  { label: 'PRIVACY FRAMEWORK', href: '/privacy' },
  { label: 'API ACCESS', href: '#' },
  { label: 'ETHICS PROTOCOL', href: '#' },
  { label: 'LEGAL', href: '/legal' },
] as const;

export function Footer() {
  const { theme, typography } = useTheme();
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);

  const monoFont = typography.fonts.mono;
  const serifFont = typography.fonts.serif;

  return (
    <footer style={{
      backgroundColor: theme.bgTertiary,
      borderTop: `1px solid ${theme.border}`,
      padding: '40px 0 28px',
      marginTop: '64px',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: serifFont,
          fontStyle: 'italic',
          fontSize: '18px',
          fontWeight: 600,
          color: theme.text,
          opacity: 0.3,
          letterSpacing: '2px',
          userSelect: 'none',
        }}>
          NOVAPRESS AI
        </div>

        {/* Links row */}
        <nav style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '6px 20px',
        }}>
          {FOOTER_LINKS.map((link, i) => (
            <React.Fragment key={link.label}>
              {i > 0 && (
                <span style={{
                  fontFamily: monoFont,
                  fontSize: '10px',
                  color: theme.text,
                  opacity: 0.2,
                  lineHeight: '20px',
                  userSelect: 'none',
                }}>
                  |
                </span>
              )}
              <Link
                href={link.href}
                onMouseEnter={() => setHoveredLink(i)}
                onMouseLeave={() => setHoveredLink(null)}
                style={{
                  fontFamily: monoFont,
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  color: hoveredLink === i ? theme.brand.primary : theme.text,
                  opacity: hoveredLink === i ? 1 : 0.5,
                  textDecoration: 'none',
                  lineHeight: '20px',
                  transition: 'color 0.2s ease, opacity 0.2s ease',
                }}
              >
                {link.label}
              </Link>
            </React.Fragment>
          ))}
        </nav>

        {/* AI disclosure */}
        <p style={{
          fontFamily: monoFont,
          fontSize: '9px',
          color: theme.textTertiary,
          opacity: 0.6,
          textAlign: 'center',
          maxWidth: '520px',
          lineHeight: '14px',
          letterSpacing: '0.3px',
          margin: 0,
        }}>
          All editorial content on this platform is synthesized by artificial intelligence.
          NovaPress AI aggregates, analyzes, and reformulates information from public sources.
          No human journalist is involved in the writing process.
        </p>

        {/* Copyright */}
        <span style={{
          fontFamily: monoFont,
          fontSize: '9px',
          color: theme.text,
          opacity: 0.3,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
        }}>
          &copy; 2026 NOVAPRESS AI. ALL RIGHTS RESERVED.
        </span>
      </div>
    </footer>
  );
}
