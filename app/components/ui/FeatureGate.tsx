"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';

// Features that require PRO tier (from backend feature_gates.py)
const PRO_FEATURES = new Set([
  'syntheses_unlimited',
  'persona_switch',
  'causal_graph',
  'timeline',
  'audio_briefing',
  'telegram_alerts',
  'semantic_search',
  'bookmarks',
  'news_xray',
]);

const ENTERPRISE_FEATURES = new Set([
  'api_access',
  'custom_sources',
  'custom_personas',
  'white_label',
]);

function hasFeatureForTier(feature: string, tier: string): boolean {
  if (tier === 'enterprise') return true;
  if (tier === 'pro') return !ENTERPRISE_FEATURES.has(feature);
  // free: no premium features
  return !PRO_FEATURES.has(feature) && !ENTERPRISE_FEATURES.has(feature);
}

interface UpgradeModalProps {
  feature: string;
  featureLabel: string;
  onClose: () => void;
}

function UpgradeModal({ featureLabel, onClose }: UpgradeModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        style={{
          backgroundColor: '#FFFFFF',
          width: '90%',
          maxWidth: '420px',
          padding: '0',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          borderBottom: '3px solid #DC2626',
          padding: '20px 24px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <p style={{
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '0.15em',
              color: '#DC2626',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              margin: '0 0 6px 0',
              textTransform: 'uppercase',
            }}>
              FONCTIONNALITE RESERVEE
            </p>
            <h2
              id="upgrade-modal-title"
              style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#000000',
                fontFamily: 'Georgia, "Times New Roman", serif',
                margin: 0,
                letterSpacing: '-0.3px',
              }}
            >
              {featureLabel}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#6B7280',
              padding: '0 0 0 12px',
              lineHeight: 1,
            }}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          <p style={{
            fontSize: '15px',
            color: '#374151',
            fontFamily: 'Georgia, "Times New Roman", serif',
            lineHeight: 1.6,
            margin: '0 0 20px 0',
          }}>
            Cette fonctionnalit&eacute; est disponible avec l&apos;abonnement{' '}
            <strong style={{ color: '#000000' }}>NovaPress PRO</strong>.
            Acc&eacute;dez &agrave; toutes les analyses avanc&eacute;es,
            graphes causaux, timelines et personas.
          </p>

          {/* Price */}
          <div style={{
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E5E5',
            padding: '16px',
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            <p style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#000000',
              fontFamily: 'Georgia, "Times New Roman", serif',
              margin: '0 0 4px 0',
              letterSpacing: '-0.5px',
            }}>
              4,99&nbsp;&euro;<span style={{ fontSize: '14px', fontWeight: '400', color: '#6B7280' }}>/mois</span>
            </p>
            <p style={{
              fontSize: '12px',
              color: '#6B7280',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              margin: 0,
            }}>
              ou 49,99&nbsp;&euro;/an &mdash; 2 mois offerts
            </p>
          </div>

          {/* CTA */}
          <Link
            href="/landing"
            style={{
              display: 'block',
              width: '100%',
              padding: '13px 0',
              backgroundColor: '#000000',
              color: '#FFFFFF',
              textAlign: 'center',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: '700',
              letterSpacing: '0.1em',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              boxSizing: 'border-box',
              marginBottom: '12px',
            }}
            onClick={onClose}
          >
            PASSER A PRO
          </Link>

          <button
            onClick={onClose}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 0',
              backgroundColor: 'transparent',
              color: '#6B7280',
              border: '1px solid #E5E5E5',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              boxSizing: 'border-box',
            }}
          >
            Continuer avec le plan gratuit
          </button>
        </div>
      </div>
    </div>
  );
}

interface FeatureGateProps {
  /** Feature key matching backend Feature enum (e.g. 'causal_graph', 'timeline') */
  feature: string;
  /** Human-readable feature name shown in upgrade modal */
  featureLabel: string;
  /** Content to show when access is granted */
  children: React.ReactNode;
  /** How to render the lock UI: 'overlay' wraps children, 'block' replaces them */
  mode?: 'overlay' | 'block';
}

/**
 * FeatureGate wraps content that requires a paid subscription.
 * - If the user has access: renders children normally.
 * - If not: shows a lock overlay (mode='overlay') or a replacement block (mode='block')
 *   with an upgrade CTA that opens the upgrade modal.
 */
export function FeatureGate({
  feature,
  featureLabel,
  children,
  mode = 'overlay',
}: FeatureGateProps) {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const tier = user?.subscription?.type ?? 'free';
  const hasAccess = hasFeatureForTier(feature, tier);

  if (hasAccess) {
    return <>{children}</>;
  }

  // mode='block': replace children with a compact upgrade prompt
  if (mode === 'block') {
    return (
      <>
        <div
          style={{
            border: '1px solid #E5E5E5',
            padding: '24px',
            textAlign: 'center',
            backgroundColor: '#F9FAFB',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔒</div>
          <p style={{
            fontSize: '15px',
            fontWeight: '600',
            color: '#000000',
            fontFamily: 'Georgia, "Times New Roman", serif',
            margin: '0 0 8px 0',
          }}>
            {featureLabel}
          </p>
          <p style={{
            fontSize: '13px',
            color: '#6B7280',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            margin: '0 0 16px 0',
          }}>
            Disponible avec NovaPress PRO
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '9px 20px',
              backgroundColor: '#000000',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.08em',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            DECOUVRIR PRO
          </button>
        </div>

        {showModal && (
          <UpgradeModal
            feature={feature}
            featureLabel={featureLabel}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  // mode='overlay': render children with a lock overlay on top
  return (
    <>
      <div style={{ position: 'relative' }}>
        {/* Blurred content underneath */}
        <div
          style={{
            filter: 'blur(4px)',
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: 0.4,
          }}
          aria-hidden="true"
        >
          {children}
        </div>

        {/* Lock overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.75)',
          }}
        >
          <div style={{
            fontSize: '32px',
            lineHeight: 1,
          }}>
            🔒
          </div>
          <p style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#000000',
            fontFamily: 'Georgia, "Times New Roman", serif',
            margin: 0,
            textAlign: 'center',
          }}>
            {featureLabel}
          </p>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '9px 22px',
              backgroundColor: '#000000',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.08em',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            PASSER A PRO
          </button>
        </div>
      </div>

      {showModal && (
        <UpgradeModal
          feature={feature}
          featureLabel={featureLabel}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
