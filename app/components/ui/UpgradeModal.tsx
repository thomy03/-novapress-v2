'use client';

/**
 * UpgradeModal — Modale "Passer a PRO" pour les features gated.
 * Style newspaper strict: pas de gradients, inline styles uniquement.
 */

import React, { useEffect, useCallback } from 'react';
import Link from 'next/link';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

const PRO_FEATURES = [
  'Graphe causal interactif',
  'Persona switch (18 styles)',
  'Timeline historique',
  'Briefing audio',
  'Recherche semantique avancee',
];

export function UpgradeModal({ isOpen, onClose, featureName }: UpgradeModalProps) {
  // Fermer sur touche Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    // Bloquer le scroll du body pendant l'ouverture
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    /* Overlay */
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Carte — stopper la propagation pour eviter la fermeture au clic interieur */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #000000',
          borderRadius: '4px',
          maxWidth: '480px',
          width: '100%',
          position: 'relative',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Bouton fermer */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1,
            color: '#6B7280',
            padding: '4px',
          }}
        >
          &times;
        </button>

        {/* Header */}
        <div
          style={{
            borderBottom: '1px solid #E5E5E5',
            padding: '24px 24px 20px',
          }}
        >
          {/* Logo */}
          <div
            style={{
              fontSize: '20px',
              fontWeight: '700',
              letterSpacing: '-0.02em',
              marginBottom: '12px',
              fontFamily: 'Georgia, serif',
            }}
          >
            <span style={{ color: '#000000' }}>NOVA</span>
            <span style={{ color: '#DC2626' }}>PRESS</span>
            <span
              style={{
                color: '#2563EB',
                fontSize: '14px',
                fontWeight: '700',
                marginLeft: '4px',
                fontFamily: 'Arial, sans-serif',
                verticalAlign: 'middle',
              }}
            >
              AI
            </span>
          </div>

          <h2
            id="upgrade-modal-title"
            style={{
              fontSize: '22px',
              fontWeight: '700',
              color: '#000000',
              margin: 0,
              lineHeight: 1.2,
              fontFamily: 'Georgia, serif',
            }}
          >
            Fonctionnalite PRO
          </h2>

          {featureName && (
            <p
              style={{
                marginTop: '8px',
                marginBottom: 0,
                fontSize: '14px',
                color: '#6B7280',
                fontFamily: 'Arial, sans-serif',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: '#000000' }}>{featureName}</strong> est disponible
              uniquement avec l&apos;abonnement PRO.
            </p>
          )}
        </div>

        {/* Corps */}
        <div style={{ padding: '24px' }}>
          {/* Prix */}
          <div
            style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E5E5',
              borderRadius: '4px',
              fontFamily: 'Arial, sans-serif',
            }}
          >
            <span
              style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#000000',
              }}
            >
              4,99 €/mois
            </span>
            <span
              style={{
                fontSize: '13px',
                color: '#6B7280',
                marginLeft: '8px',
              }}
            >
              ou 49,99 €/an
            </span>
          </div>

          {/* Liste features */}
          <ul
            style={{
              listStyle: 'none',
              margin: '0 0 24px',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {PRO_FEATURES.map((feat) => (
              <li
                key={feat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '14px',
                  color: '#000000',
                  lineHeight: 1.4,
                }}
              >
                <span
                  style={{
                    color: '#2563EB',
                    fontWeight: '700',
                    fontSize: '15px',
                    flexShrink: 0,
                    width: '18px',
                    textAlign: 'center',
                  }}
                >
                  &#10003;
                </span>
                {feat}
              </li>
            ))}
          </ul>

          {/* Boutons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Primaire */}
            <Link
              href="/landing"
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 24px',
                backgroundColor: '#000000',
                color: '#FFFFFF',
                textAlign: 'center',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '700',
                fontFamily: 'Arial, sans-serif',
                letterSpacing: '0.03em',
                borderRadius: '2px',
                boxSizing: 'border-box',
              }}
              onClick={onClose}
            >
              Decouvrir PRO
            </Link>

            {/* Secondaire */}
            <button
              onClick={onClose}
              style={{
                display: 'block',
                width: '100%',
                padding: '13px 24px',
                backgroundColor: 'transparent',
                color: '#6B7280',
                border: '1px solid #E5E5E5',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: '400',
                fontFamily: 'Arial, sans-serif',
                cursor: 'pointer',
                borderRadius: '2px',
              }}
            >
              Continuer gratuitement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;
