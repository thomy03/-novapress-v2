"use client";

import React, { useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Header } from '../layout/Header';
import { NewsTicker } from '../layout/NewsTicker';
import { Footer } from '../layout/Footer';
import IntelligenceSection from '../articles/IntelligenceSection';
import { OfflineNotification } from '../ui/OfflineNotification';

// Skip to main content component
function SkipToMain({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      onClick={onSkip}
      style={{
        position: 'absolute',
        top: '-40px',
        left: '8px',
        backgroundColor: '#000000',
        color: 'white',
        padding: '8px 16px',
        border: 'none',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        zIndex: 1000,
        transition: 'top 0.2s ease'
      }}
      onFocus={(e) => {
        e.currentTarget.style.top = '8px';
      }}
      onBlur={(e) => {
        e.currentTarget.style.top = '-40px';
      }}
      aria-label="Aller au contenu principal"
    >
      Aller au contenu principal
    </button>
  );
}

// Live region for screen reader announcements
function LiveRegion({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden'
      }}
    >
      {message}
    </div>
  );
}


// Minimal newsletter section
function NewsletterSection() {
  const { theme } = useTheme();

  return (
    <section style={{
      borderTop: `1px solid ${theme.border}`,
      borderBottom: `1px solid ${theme.border}`,
      padding: '48px 0',
      marginTop: '64px',
      marginBottom: '48px',
      textAlign: 'center'
    }}>
      <h2 style={{
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: theme.textSecondary,
        marginBottom: '16px'
      }}>
        Newsletter
      </h2>
      <p style={{
        fontSize: '24px',
        fontWeight: '600',
        color: theme.text,
        fontFamily: 'Georgia, "Times New Roman", serif',
        marginBottom: '24px',
        maxWidth: '500px',
        margin: '0 auto 24px'
      }}>
        Recevez notre sélection quotidienne
      </p>
      <div style={{
        display: 'flex',
        gap: '0',
        maxWidth: '440px',
        margin: '0 auto'
      }}>
        <input
          type="email"
          placeholder="Votre adresse email"
          style={{
            flex: 1,
            padding: '14px 20px',
            border: `1px solid ${theme.border}`,
            borderRight: 'none',
            fontSize: '14px',
            backgroundColor: theme.bg,
            color: theme.text,
            outline: 'none'
          }}
        />
        <button style={{
          backgroundColor: theme.text,
          color: theme.card,
          padding: '14px 28px',
          border: 'none',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'opacity 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.85';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
        >
          S'inscrire
        </button>
      </div>
    </section>
  );
}

export function HomePage() {
  const { theme } = useTheme();
  const mainContentRef = useRef<HTMLElement>(null);
  const [liveRegionMessage, setLiveRegionMessage] = React.useState<string>('');

  // Skip to main content function
  const skipToMainContent = () => {
    mainContentRef.current?.focus();
    mainContentRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLiveRegionMessage('Navigation fermée');
        setTimeout(() => setLiveRegionMessage(''), 1000);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bg,
      color: theme.text
    }}>
      {/* Accessibility Components */}
      <SkipToMain onSkip={skipToMainContent} />
      <LiveRegion message={liveRegionMessage} />

      {/* Header Components */}
      <Header />
      <NewsTicker />

      {/* Main Content */}
      <main
        ref={mainContentRef}
        role="main"
        aria-label="Contenu principal"
        tabIndex={-1}
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '40px 24px',
          outline: 'none'
        }}>

        {/* AI Intelligence Section - Now the main content */}
        <IntelligenceSection />

        {/* Newsletter Section */}
        <NewsletterSection />
      </main>

      {/* Footer */}
      <Footer />

      {/* Service Worker Notifications */}
      <OfflineNotification />
    </div>
  );
}
