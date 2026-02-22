'use client';

import { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { billingService } from '@/app/lib/api/services/billing';

const UNLOCKED_FEATURES = [
  'Syntheses illimitees',
  '18 personas disponibles',
  'Graphes causaux interactifs',
  'Timeline historique',
  'Audio briefing',
  'Alertes Telegram',
];

function SuccessContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      // Fire-and-forget: refresh subscription status in background
      billingService.getStatus().catch(() => {
        // Silently ignore errors — page is already showing success
      });
    }
  }, [searchParams]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#FFFFFF',
        fontFamily: 'Georgia, serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top-left back link */}
      <div style={{ padding: '16px 24px' }}>
        <Link
          href="/"
          style={{
            fontSize: '12px',
            color: '#6B7280',
            textDecoration: 'none',
            fontFamily: 'Georgia, serif',
            letterSpacing: '0.02em',
          }}
        >
          ← Retour a l&apos;accueil
        </Link>
      </div>

      {/* Main centered content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '500px',
            width: '100%',
          }}
        >
          {/* Logo */}
          <div
            style={{
              textAlign: 'center',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                fontSize: '22px',
                fontWeight: 'bold',
                color: '#000000',
                fontFamily: 'Georgia, serif',
                letterSpacing: '-0.5px',
              }}
            >
              NovaPress{' '}
              <span style={{ color: '#2563EB' }}>AI</span>
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              borderTop: '1px solid #000000',
              marginBottom: '48px',
            }}
          />

          {/* Checkmark icon */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: '2px solid #2563EB',
                color: '#2563EB',
                fontSize: '36px',
                lineHeight: 1,
              }}
            >
              ✓
            </div>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#000000',
              textAlign: 'center',
              margin: '0 0 14px 0',
              fontFamily: 'Georgia, serif',
              letterSpacing: '-0.5px',
            }}
          >
            Abonnement active !
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '15px',
              color: '#6B7280',
              textAlign: 'center',
              margin: '0 0 36px 0',
              fontFamily: 'Georgia, serif',
              lineHeight: '1.6',
            }}
          >
            Bienvenue dans NovaPress AI Pro. Toutes les fonctionnalites sont
            maintenant disponibles.
          </p>

          {/* Unlocked features list */}
          <div
            style={{
              border: '1px solid #E5E5E5',
              padding: '24px',
              marginBottom: '36px',
            }}
          >
            <p
              style={{
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#000000',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                margin: '0 0 16px 0',
                fontFamily: 'Georgia, serif',
              }}
            >
              Desormais disponible
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {UNLOCKED_FEATURES.map((feature, index) => (
                <li
                  key={feature}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                    color: '#000000',
                    fontFamily: 'Georgia, serif',
                    paddingBottom: index < UNLOCKED_FEATURES.length - 1 ? '10px' : '0',
                    marginBottom: index < UNLOCKED_FEATURES.length - 1 ? '10px' : '0',
                    borderBottom:
                      index < UNLOCKED_FEATURES.length - 1
                        ? '1px solid #E5E5E5'
                        : 'none',
                  }}
                >
                  <span
                    style={{
                      color: '#2563EB',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Primary button */}
          <Link
            href="/"
            style={{
              display: 'block',
              width: '100%',
              padding: '14px 24px',
              backgroundColor: '#000000',
              color: '#FFFFFF',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.05em',
              textDecoration: 'none',
              textTransform: 'uppercase',
              marginBottom: '20px',
              boxSizing: 'border-box',
            }}
          >
            Decouvrir les syntheses
          </Link>

          {/* Secondary link */}
          <div style={{ textAlign: 'center' }}>
            <Link
              href="/account"
              style={{
                fontSize: '13px',
                color: '#6B7280',
                textDecoration: 'underline',
                fontFamily: 'Georgia, serif',
              }}
            >
              Gerer mon abonnement
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Georgia, serif',
            fontSize: '14px',
            color: '#6B7280',
          }}
        >
          Chargement...
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
