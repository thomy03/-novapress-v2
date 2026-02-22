'use client';

import Link from 'next/link';

export default function BillingCancelPage() {
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

          {/* X icon */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: '2px solid #6B7280',
                color: '#6B7280',
                fontSize: '36px',
                lineHeight: 1,
              }}
            >
              ×
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
            Paiement annule
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '15px',
              color: '#6B7280',
              textAlign: 'center',
              margin: '0 0 48px 0',
              fontFamily: 'Georgia, serif',
              lineHeight: '1.6',
            }}
          >
            Aucun montant n&apos;a ete preleve. Vous pouvez continuer a utiliser
            NovaPress gratuitement.
          </p>

          {/* Two buttons side by side */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
            }}
          >
            {/* Reessayer — links to /landing#waitlist */}
            <Link
              href="/landing#waitlist"
              style={{
                flex: 1,
                display: 'block',
                padding: '14px 20px',
                backgroundColor: '#000000',
                color: '#FFFFFF',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: 'bold',
                fontFamily: 'Georgia, serif',
                letterSpacing: '0.05em',
                textDecoration: 'none',
                textTransform: 'uppercase',
                boxSizing: 'border-box',
              }}
            >
              Reessayer
            </Link>

            {/* Continuer gratuitement — links to / */}
            <Link
              href="/"
              style={{
                flex: 1,
                display: 'block',
                padding: '14px 20px',
                backgroundColor: '#FFFFFF',
                color: '#000000',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: 'bold',
                fontFamily: 'Georgia, serif',
                letterSpacing: '0.05em',
                textDecoration: 'none',
                textTransform: 'uppercase',
                border: '1px solid #000000',
                boxSizing: 'border-box',
              }}
            >
              Continuer gratuitement
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
