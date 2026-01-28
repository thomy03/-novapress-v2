"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// localStorage key for persona persistence
const PERSONA_STORAGE_KEY = 'novapress_selected_persona';

/**
 * Get saved persona from localStorage
 * Returns null if not found or invalid
 */
export function getSavedPersona(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const saved = localStorage.getItem(PERSONA_STORAGE_KEY);
    return saved || null;
  } catch {
    return null;
  }
}

/**
 * Save persona to localStorage
 */
export function savePersona(personaId: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(PERSONA_STORAGE_KEY, personaId);
  } catch (e) {
    console.warn('Failed to save persona to localStorage:', e);
  }
}

/**
 * Clear saved persona from localStorage
 */
export function clearSavedPersona(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(PERSONA_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

export interface Persona {
  id: string;
  name: string;
  displayName: string;
  tone: string;
  focusCategories: string[];
  styleReference: string;
  avatarDescription: string;
}

// Persona definitions matching backend - 18 personas total
const PERSONAS: Persona[] = [
  // ═══════════════════════════════════════════════════════════════
  // ORIGINAUX (5)
  // ═══════════════════════════════════════════════════════════════
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
    displayName: 'Edouard Vaillant (Le Cynique)',
    tone: 'sarcastique, desabuse, mordant',
    focusCategories: ['POLITIQUE', 'ECONOMIE', 'MONDE'],
    styleReference: 'Le Canard Enchaine',
    avatarDescription: 'Trentenaire mal rase, cravate denouee'
  },
  {
    id: 'l_optimiste',
    name: 'Claire Horizon',
    displayName: 'Claire Horizon (L\'Optimiste)',
    tone: 'enthousiaste, constructif, solutions',
    focusCategories: ['TECH', 'SCIENCES', 'CULTURE'],
    styleReference: 'Wired, MIT Tech Review',
    avatarDescription: 'Jeune femme dynamique, tech-wear'
  },
  {
    id: 'le_conteur',
    name: 'Alexandre Duval',
    displayName: 'Alexandre Duval (Le Conteur)',
    tone: 'dramatique, suspense, epique',
    focusCategories: ['MONDE', 'CULTURE', 'POLITIQUE'],
    styleReference: 'Alexandre Dumas, feuilleton',
    avatarDescription: 'Homme style 19eme, plume a la main'
  },
  {
    id: 'le_satiriste',
    name: 'Le Bouffon',
    displayName: 'Le Bouffon (Le Satiriste)',
    tone: 'absurde, parodie, ironie extreme',
    focusCategories: ['all'],
    styleReference: 'Le Gorafi, The Onion',
    avatarDescription: 'Cartoon minimaliste, sourire en coin'
  },

  // ═══════════════════════════════════════════════════════════════
  // POLITIQUES/IDÉOLOGIQUES (5)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'le_souverainiste',
    name: 'Jean-Pierre Valois',
    displayName: 'Jean-Pierre Valois (Le Souverainiste)',
    tone: 'patriote, mefiant, souverainiste',
    focusCategories: ['MONDE', 'POLITIQUE', 'ECONOMIE'],
    styleReference: 'Valeurs Actuelles, Front Populaire',
    avatarDescription: 'Homme 55 ans, costume sobre, drapeau francais'
  },
  {
    id: 'l_ecologiste',
    name: 'Gaia Verdier',
    displayName: 'Gaia Verdier (L\'Ecologiste)',
    tone: 'alarmiste constructif, urgence climatique',
    focusCategories: ['SCIENCES', 'MONDE', 'ECONOMIE'],
    styleReference: 'Reporterre, Vert, Bon Pote',
    avatarDescription: 'Femme 35 ans, tenue eco-responsable'
  },
  {
    id: 'le_techno_sceptique',
    name: 'Lucie Prudence',
    displayName: 'Lucie Prudence (Le Techno-Sceptique)',
    tone: 'mefiant, humaniste, anti-surveillance',
    focusCategories: ['TECH', 'MONDE', 'POLITIQUE'],
    styleReference: 'La Quadrature du Net, Framasoft',
    avatarDescription: 'Femme 40 ans, lunettes, livres papier'
  },
  {
    id: 'l_economiste',
    name: 'Charles Marche',
    displayName: 'Charles Marche (L\'Economiste)',
    tone: 'analytique, chiffres, rationnel',
    focusCategories: ['ECONOMIE', 'POLITIQUE', 'MONDE'],
    styleReference: 'Les Echos, Financial Times',
    avatarDescription: 'Homme 50 ans, costume cravate, graphiques'
  },
  {
    id: 'le_populiste',
    name: 'Marine Dupeuple',
    displayName: 'Marine Dupeuple (Le Populiste)',
    tone: 'anti-elite, peuple, bon sens',
    focusCategories: ['POLITIQUE', 'ECONOMIE', 'MONDE'],
    styleReference: 'Discours populistes historiques',
    avatarDescription: 'Femme 45 ans, tenue simple, quartier populaire'
  },

  // ═══════════════════════════════════════════════════════════════
  // PHILOSOPHIQUES/INTELLECTUELS (3)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'l_historien',
    name: 'Victor Memoire',
    displayName: 'Victor Memoire (L\'Historien)',
    tone: 'erudit, paralleles historiques, cycles',
    focusCategories: ['MONDE', 'POLITIQUE', 'CULTURE'],
    styleReference: 'Historia, L\'Histoire',
    avatarDescription: 'Homme 60 ans, bibliotheque ancienne'
  },
  {
    id: 'le_philosophe',
    name: 'Socrate Dubois',
    displayName: 'Socrate Dubois (Le Philosophe)',
    tone: 'questionneur, existentiel, maieutique',
    focusCategories: ['CULTURE', 'POLITIQUE', 'SCIENCES'],
    styleReference: 'Philosophie Magazine',
    avatarDescription: 'Homme 50 ans, barbe soignee, regard interrogateur'
  },
  {
    id: 'le_scientifique',
    name: 'Dr. Marie Evidence',
    displayName: 'Dr. Marie Evidence (Le Scientifique)',
    tone: 'data-driven, sceptique methodique, etudes',
    focusCategories: ['SCIENCES', 'TECH', 'ECONOMIE'],
    styleReference: 'Nature, Science, Pour la Science',
    avatarDescription: 'Femme 45 ans, blouse blanche, laboratoire'
  },

  // ═══════════════════════════════════════════════════════════════
  // GÉNÉRATIONNELS (3)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'le_boomer',
    name: 'Gerard Jadis',
    displayName: 'Gerard Jadis (Le Boomer)',
    tone: 'nostalgique, critique modernite',
    focusCategories: ['CULTURE', 'POLITIQUE', 'ECONOMIE'],
    styleReference: 'Courrier des lecteurs Figaro',
    avatarDescription: 'Homme 65 ans, pull classique, journal papier'
  },
  {
    id: 'le_millennial',
    name: 'Emma Startup',
    displayName: 'Emma Startup (Le Millennial)',
    tone: 'ironique, pop culture, burnout',
    focusCategories: ['TECH', 'ECONOMIE', 'CULTURE'],
    styleReference: 'Vice, Konbini',
    avatarDescription: 'Femme 32 ans, MacBook, coworking'
  },
  {
    id: 'le_gen_z',
    name: 'Zoe TikTok',
    displayName: 'Zoe TikTok (Le Gen-Z)',
    tone: 'direct, slang, emoji, authentique',
    focusCategories: ['TECH', 'CULTURE', 'MONDE'],
    styleReference: 'TikTok, Twitter/X Gen-Z',
    avatarDescription: 'Femme 20 ans, streetwear, ring light'
  },

  // ═══════════════════════════════════════════════════════════════
  // CONTROVERSÉS (2)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'le_complotiste',
    name: 'Xavier Doute',
    displayName: 'Xavier Doute (Le Complotiste)',
    tone: 'questionnement, cui bono, mefiance',
    focusCategories: ['POLITIQUE', 'MONDE', 'TECH'],
    styleReference: 'Questionnement alternatif',
    avatarDescription: 'Homme 40 ans, capuche, regard mefiant'
  },
  {
    id: 'le_provocateur',
    name: 'Eric Polemique',
    displayName: 'Eric Polemique (Le Provocateur)',
    tone: 'contrarian, avocat du diable, debat',
    focusCategories: ['all'],
    styleReference: 'Debats televises',
    avatarDescription: 'Homme 50 ans, sourire en coin, plateau TV'
  }
];

// Emoji for each persona
const PERSONA_EMOJI: Record<string, string> = {
  // Originaux
  'neutral': '📰',
  'le_cynique': '🎭',
  'l_optimiste': '✨',
  'le_conteur': '📜',
  'le_satiriste': '🃏',
  // Politiques/Ideologiques
  'le_souverainiste': '🦅',
  'l_ecologiste': '🌍',
  'le_techno_sceptique': '🔒',
  'l_economiste': '📊',
  'le_populiste': '✊',
  // Philosophiques/Intellectuels
  'l_historien': '📚',
  'le_philosophe': '🤔',
  'le_scientifique': '🔬',
  // Generationnels
  'le_boomer': '📺',
  'le_millennial': '💻',
  'le_gen_z': '📱',
  // Controverses
  'le_complotiste': '🔍',
  'le_provocateur': '⚡'
};

// Color for each persona
const PERSONA_COLOR: Record<string, string> = {
  // Originaux
  'neutral': '#374151',
  'le_cynique': '#7C3AED',
  'l_optimiste': '#10B981',
  'le_conteur': '#F59E0B',
  'le_satiriste': '#EF4444',
  // Politiques/Ideologiques
  'le_souverainiste': '#1E40AF',
  'l_ecologiste': '#059669',
  'le_techno_sceptique': '#6366F1',
  'l_economiste': '#0891B2',
  'le_populiste': '#DC2626',
  // Philosophiques/Intellectuels
  'l_historien': '#92400E',
  'le_philosophe': '#7E22CE',
  'le_scientifique': '#0D9488',
  // Generationnels
  'le_boomer': '#78716C',
  'le_millennial': '#EC4899',
  'le_gen_z': '#8B5CF6',
  // Controverses
  'le_complotiste': '#991B1B',
  'le_provocateur': '#EA580C'
};

interface PersonaSwitcherProps {
  currentPersona: string;
  onPersonaChange: (personaId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  /** If true, will auto-restore from localStorage on mount */
  autoRestore?: boolean;
  /** If true, will auto-save to localStorage on change */
  autoSave?: boolean;
}

export function PersonaSwitcher({
  currentPersona,
  onPersonaChange,
  isLoading = false,
  disabled = false,
  autoRestore = true,
  autoSave = true
}: PersonaSwitcherProps) {
  const { darkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);

  // Auto-restore from localStorage on mount
  useEffect(() => {
    if (autoRestore && !hasRestored) {
      const savedPersona = getSavedPersona();
      if (savedPersona && savedPersona !== currentPersona) {
        // Check if saved persona is valid
        const isValid = PERSONAS.some(p => p.id === savedPersona);
        if (isValid) {
          onPersonaChange(savedPersona);
        }
      }
      setHasRestored(true);
    }
  }, [autoRestore, hasRestored, currentPersona, onPersonaChange]);

  // Handle persona change with persistence
  const handlePersonaChange = useCallback((personaId: string) => {
    onPersonaChange(personaId);
    if (autoSave) {
      savePersona(personaId);
    }
    setIsExpanded(false);
  }, [onPersonaChange, autoSave]);

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
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {PERSONAS.map((persona) => (
            <button
              key={persona.id}
              onClick={() => handlePersonaChange(persona.id)}
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
          {/* FIX-004: Scroll indicator for more personas */}
          <div style={{
            padding: '8px 16px',
            textAlign: 'center',
            fontSize: '11px',
            color: darkMode ? '#6B7280' : '#9CA3AF',
            backgroundColor: darkMode ? '#111827' : '#F9FAFB',
            borderTop: `1px solid ${darkMode ? '#374151' : '#E5E5E5'}`,
            position: 'sticky',
            bottom: 0,
          }}>
            ↕ 18 personas disponibles - Faites défiler
          </div>
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
