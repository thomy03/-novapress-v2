'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

export function UpdateNotifier() {
  const [showToast, setShowToast] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  // Track whether the user explicitly requested an update — only reload in that case.
  // Without this guard, every SW re-registration (e.g. on cold open) would trigger
  // an infinite reload loop in PWA standalone mode.
  const userRequestedUpdate = useRef(false);

  const registerWaiting = useCallback((worker: ServiceWorker) => {
    setWaitingWorker(worker);
    setShowToast(true);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const bootstrap = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;

        // Already a waiting worker when we mount
        if (reg.waiting) {
          registerWaiting(reg.waiting);
        }

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              registerWaiting(installing);
            }
          });
        });
      } catch {
        // SW not available — ignore
      }
    };

    bootstrap();

    // Only reload when the user explicitly clicked "Mettre à jour"
    const onControllerChange = () => {
      if (userRequestedUpdate.current) {
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () =>
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, [registerWaiting]);

  const handleUpdate = () => {
    userRequestedUpdate.current = true; // Mark as user-initiated before sending SKIP_WAITING
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowToast(false);
  };

  if (!showToast) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '80px', /* above BottomNav (60px) + margin */
        left: '16px',
        right: '16px',
        background: '#111',
        color: '#FFF',
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 10000,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        border: '1px solid #333',
      }}
    >
      <span style={{ fontSize: '18px' }}>✨</span>
      <span style={{ fontSize: '14px', fontWeight: 600 }}>Nouvelle version disponible</span>

      <button
        onClick={handleUpdate}
        style={{
          background: '#2563EB',
          color: '#FFF',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 14px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Mettre à jour
      </button>

      <button
        onClick={() => setShowToast(false)}
        aria-label="Ignorer"
        style={{
          background: 'transparent',
          color: '#666',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          fontSize: '18px',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
