"use client";

import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

export interface Persona {
  id: string;
  name: string;
  displayName: string;
  tone: string;
  focusCategories: string[];
  styleReference: string;
  avatarDescription: string;
}

// Persona definitions matching backend
const PERSONAS: Persona[] = [
  {
    id: 'neutral',
    name: 'NovaPress',
    displayName: 'NovaPress (Factuel)',
    tone: 'objectif, professionnel, factuel',
    focusCategories: ['all'],
    styleReference: 'Le Monde, New York Times',
    avatarDescription: 'Logo NovaPress AI'
  },
  {
    id: 'le_cynique',
    name: 'Edouard Vaillant',
    displayName: 'Edouard V. (Le Cynique)',
    tone: 'sarcastique, desabuse, mordant',
    focusCategories: ['POLITIQUE', 'ECONOMIE', 'MONDE'],
    styleReference: 'Le Canard Enchaine',
    avatarDescription: 'Trentenaire mal rase, cravate denouee'
  },
  {
    id: 'l_optimiste',
    name: 'Claire Horizon',
    displayName: 'Claire H. (L\'Optimiste)',
    tone: 'enthousiaste, constructif, solutions',
    focusCategories: ['TECH', 'SCIENCES', 'CULTURE'],
    styleReference: 'Wired, MIT Tech Review',
    avatarDescription: 'Jeune femme dynamique, tech-wear'
  },
  {
    id: 'le_conteur',
    name: 'Alexandre Duval',
    displayName: 'Alexandre D. (Le Conteur)',
    tone: 'dramatique, suspense, epique',
    focusCategories: ['MONDE', 'CULTURE', 'POLITIQUE'],
    styleReference: 'Alexandre Dumas, feuilleton',
    avatarDescription: 'Homme style 19eme, plume a la main'
  },
  {
    id: 'le_satiriste',
    name: 'Le Bouffon',
    displayName: 'Le Bouffon (Satiriste)',
    tone: 'absurde, parodie, ironie extreme',
    focusCategories: ['all'],
    styleReference: 'Le Gorafi, The Onion',
    avatarDescription: 'Cartoon minimaliste, sourire en coin'
  }
];

// Emoji for each persona
const PERSONA_EMOJI: Record<string, string> = {
  'neutral': '📰',
  'le_cynique': '🎭',
  'l_optimiste': '✨',
  'le_conteur': '📜',
  'le_satiriste': '🃏'
};

// Color for each persona
const PERSONA_COLOR: Record<string, string> = {
  'neutral': '#374151',
  'le_cynique': '#7C3AED',
  'l_optimiste': '#10B981',
  'le_conteur': '#F59E0B',
  'le_satiriste': '#EF4444'
};

interface PersonaSwitcherProps {
  currentPersona: string;
  onPersonaChange: (personaId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function PersonaSwitcher({
  currentPersona,
  onPersonaChange,
  isLoading = false,
  disabled = false
}: PersonaSwitcherProps) {
  const { darkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const currentPersonaData = PERSONAS.find(p => p.id === currentPersona) || PERSONAS[0];

  return (
    <div style={{
      position: 'relative',
      marginBottom: '20px'
    }}>
      {/* Label */}
      <div style={{
        fontSize: '12px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: darkMode ? '#9CA3AF' : '#6B7280',
        marginBottom: '8px'
      }}>
        Changer de prisme
      </div>

      {/* Current Persona Button */}
      <button
        onClick={() => !disabled && setIsExpanded(!isExpanded)}
        disabled={disabled || isLoading}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          padding: '12px 16px',
          backgroundColor: darkMode ? '#1F2937' : '#F9FAFB',
          border: `2px solid ${PERSONA_COLOR[currentPersona] || '#E5E5E5'}`,
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s ease'
        }}
      >
        <span style={{ fontSize: '24px' }}>
          {isLoading ? '⏳' : PERSONA_EMOJI[currentPersona] || '📰'}
        </span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{
            fontWeight: '600',
            fontSize: '14px',
            color: darkMode ? '#F3F4F6' : '#111827'
          }}>
            {isLoading ? 'Generation en cours...' : currentPersonaData.displayName}
          </div>
          <div style={{
            fontSize: '12px',
            color: darkMode ? '#9CA3AF' : '#6B7280',
            marginTop: '2px'
          }}>
            {currentPersonaData.tone}
          </div>
        </div>
        <span style={{
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.2s ease',
          color: darkMode ? '#9CA3AF' : '#6B7280'
        }}>
          ▼
        </span>
      </button>

      {/* Dropdown */}
      {isExpanded && !isLoading && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: darkMode ? '#1F2937' : '#FFFFFF',
          border: `1px solid ${darkMode ? '#374151' : '#E5E5E5'}`,
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 100,
          overflow: 'hidden'
        }}>
          {PERSONAS.map((persona) => (
            <button
              key={persona.id}
              onClick={() => {
                onPersonaChange(persona.id);
                setIsExpanded(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px 16px',
                backgroundColor: persona.id === currentPersona
                  ? (darkMode ? '#374151' : '#F3F4F6')
                  : 'transparent',
                border: 'none',
                borderBottom: `1px solid ${darkMode ? '#374151' : '#F3F4F6'}`,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (persona.id !== currentPersona) {
                  e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#F9FAFB';
                }
              }}
              onMouseLeave={(e) => {
                if (persona.id !== currentPersona) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{
                fontSize: '20px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${PERSONA_COLOR[persona.id]}15`,
                borderRadius: '50%'
              }}>
                {PERSONA_EMOJI[persona.id]}
              </span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{
                  fontWeight: '600',
                  fontSize: '14px',
                  color: darkMode ? '#F3F4F6' : '#111827'
                }}>
                  {persona.displayName}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: darkMode ? '#9CA3AF' : '#6B7280',
                  marginTop: '2px'
                }}>
                  {persona.styleReference}
                </div>
              </div>
              {persona.id === currentPersona && (
                <span style={{ color: PERSONA_COLOR[persona.id] }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Info text */}
      <p style={{
        fontSize: '11px',
        color: darkMode ? '#6B7280' : '#9CA3AF',
        marginTop: '8px',
        lineHeight: '1.4'
      }}>
        Changez la perspective de lecture. Le contenu factuel reste identique,
        seul le style et le ton varient.
      </p>
    </div>
  );
}

export { PERSONAS, PERSONA_EMOJI, PERSONA_COLOR };
