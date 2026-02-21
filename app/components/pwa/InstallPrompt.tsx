'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'novapress-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Check if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Check if dismissed recently
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed, 10) < DISMISS_DURATION_MS) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      role="banner"
      aria-label="Installer NovaPress"
      style={{
        position: 'fixed',
        bottom: '80px', // above BottomNav (70px) + margin
        left: '16px',
        right: '16px',
        background: '#111',
        color: '#FFF',
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 9999,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        border: '1px solid #333',
      }}
    >
      <span style={{ fontSize: '28px', flexShrink: 0 }}>📰</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>
          Installer NovaPress
        </div>
        <div style={{ fontSize: '12px', color: '#999', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Accès rapide depuis l&apos;écran d&apos;accueil
        </div>
      </div>

      <button
        onClick={handleInstall}
        style={{
          background: '#DC2626',
          color: '#FFF',
          border: 'none',
          borderRadius: '6px',
          padding: '8px 14px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Installer
      </button>

      <button
        onClick={handleDismiss}
        aria-label="Fermer"
        style={{
          background: 'transparent',
          color: '#666',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          fontSize: '20px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
