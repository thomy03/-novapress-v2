"use client";

import React from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';

export function Footer() {
  const { theme, darkMode } = useTheme();

  return (
    <footer style={{
      borderTop: `1px solid ${theme.border}`,
      padding: '48px 0 32px',
      marginTop: '48px',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 24px' }}>
        {/* Top row: logo + tagline */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <div style={{
            fontSize: '20px',
            fontFamily: '"Fraunces", Georgia, "Times New Roman", serif',
          }}>
            <span style={{ fontWeight: 700, color: theme.text }}>NOVA</span>
            <span style={{ fontWeight: 700, color: theme.brand.primary }}>PRESS</span>
            <span style={{ fontSize: '12px', color: theme.brand.secondary, marginLeft: '3px', fontWeight: 700 }}>AI</span>
          </div>
          <span style={{
            fontSize: '13px',
            color: theme.textSecondary,
          }}>
            Transformer le chaos informationnel en intelligence journalistique.
          </span>
        </div>

        {/* Divider */}
        <div style={{
          height: '1px',
          backgroundColor: theme.border,
          marginBottom: '24px',
        }} />

        {/* Bottom row: links + copyright */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <Link href="/terms" style={{
              fontSize: '13px',
              color: theme.textSecondary,
              textDecoration: 'none',
            }}>
              Conditions d'utilisation
            </Link>
            <Link href="/privacy" style={{
              fontSize: '13px',
              color: theme.textSecondary,
              textDecoration: 'none',
            }}>
              Politique de confidentialit&eacute;
            </Link>
          </div>
          <span style={{
            fontSize: '12px',
            color: theme.textSecondary,
            opacity: 0.7,
          }}>
            &copy; 2026 NovaPress AI. Tous droits r&eacute;serv&eacute;s.
          </span>
        </div>
      </div>
    </footer>
  );
}
