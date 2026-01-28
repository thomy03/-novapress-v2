"use client";

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

export function Footer() {
  const { darkMode } = useTheme();

  return (
    <footer style={{ 
      backgroundColor: darkMode ? '#0f0f0f' : '#000000', 
      color: darkMode ? '#a3a3a3' : '#ffffff', 
      padding: '60px 0 30px',
      marginTop: '60px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ 
          borderTop: '1px solid rgba(255,255,255,0.1)', 
          paddingTop: '30px', 
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '14px', opacity: 0.6 }}>
            © 2025 NovaPress AI. Tous droits réservés. | Développé avec ❤️ et IA
          </p>
        </div>
      </div>
    </footer>
  );
}