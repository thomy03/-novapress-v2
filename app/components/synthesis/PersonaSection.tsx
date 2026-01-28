'use client';

/**
 * REF-012d: PersonaSection component
 * Extracted from app/synthesis/[id]/page.tsx
 *
 * Handles persona switcher, active persona indicator, and signature display
 */

import React from 'react';
import { PersonaSwitcher, PERSONA_EMOJI, PERSONA_COLOR, PERSONAS } from '@/app/components/ui/PersonaSwitcher';
import { PersonaSectionProps, sharedStyles } from '@/app/types/synthesis-page';

export function PersonaSection({
  synthesis,
  currentPersona,
  personaLoading,
  onPersonaChange
}: PersonaSectionProps) {
  return (
    <>
      {/* Persona Switcher */}
      <div style={{ marginTop: '24px', marginBottom: '24px' }}>
        <PersonaSwitcher
          currentPersona={currentPersona}
          onPersonaChange={onPersonaChange}
          isLoading={personaLoading}
        />

        {/* Persona indicator when not neutral */}
        {synthesis.persona && synthesis.persona.id !== 'neutral' && (() => {
          const personaData = PERSONAS.find(p => p.id === synthesis.persona?.id);
          const personaStyle = personaData?.displayName?.match(/\((.*?)\)/)?.[1] || synthesis.author?.persona_type;
          const displayText = synthesis.author?.display || (
            personaStyle
              ? `par ${synthesis.persona.name} › ${personaStyle}`
              : `par ${personaData?.displayName || synthesis.persona.name}`
          );

          return (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: `${PERSONA_COLOR[synthesis.persona.id]}15`,
              borderLeft: `3px solid ${PERSONA_COLOR[synthesis.persona.id]}`,
              borderRadius: '0 4px 4px 0',
              marginTop: '12px'
            }}>
              <span style={{ fontSize: '18px' }}>{PERSONA_EMOJI[synthesis.persona.id]}</span>
              <span style={{
                fontSize: '13px',
                fontWeight: '600',
                color: PERSONA_COLOR[synthesis.persona.id]
              }}>
                {displayText}
              </span>
            </div>
          );
        })()}
      </div>
    </>
  );
}

/**
 * PersonaSignature component
 * Displays the persona signature at the bottom of the synthesis
 */
export interface PersonaSignatureProps {
  signature?: string;
  isPersonaVersion?: boolean;
  persona?: {
    id: string;
    name: string;
    displayName: string;
  };
  author?: {
    name: string;
    persona_type?: string;
  };
}

export function PersonaSignature({
  signature,
  isPersonaVersion,
  persona,
  author
}: PersonaSignatureProps) {
  if (!signature || !isPersonaVersion) {
    return null;
  }

  return (
    <div style={{
      marginTop: '32px',
      padding: '20px',
      borderTop: `1px solid ${sharedStyles.border}`,
      fontStyle: 'italic',
      fontSize: '15px',
      color: sharedStyles.textSecondary,
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <span style={{ fontSize: '24px' }}>
        {persona ? PERSONA_EMOJI[persona.id] : '📝'}
      </span>
      <span>{signature}</span>
      {persona && (
        <span style={{
          marginLeft: 'auto',
          fontSize: '12px',
          fontWeight: '600',
          color: persona ? PERSONA_COLOR[persona.id] : sharedStyles.textSecondary
        }}>
          — {author?.name || persona.name}
          {author?.persona_type && (
            <span style={{ fontWeight: '400', opacity: 0.8 }}> › {author.persona_type}</span>
          )}
        </span>
      )}
    </div>
  );
}

export default PersonaSection;
