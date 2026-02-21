'use client';

import { useState, useEffect, useCallback } from 'react';

// Set via NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local
const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/** Convert URL-safe base64 to ArrayBuffer for applicationServerKey */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

export interface PushState {
  isSupported: boolean;
  permission: NotificationPermission | 'default';
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: false,
    error: null,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState((prev) => ({ ...prev, isSubscribed: !!sub }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isSupported =
      'PushManager' in window &&
      'serviceWorker' in navigator &&
      'Notification' in window &&
      PUBLIC_VAPID_KEY !== '';

    const permission = isSupported
      ? (Notification.permission as NotificationPermission)
      : 'default';

    setState((prev) => ({ ...prev, isSupported, permission }));

    if (isSupported) {
      checkSubscription();
    }
  }, [checkSubscription]);

  const subscribe = useCallback(async () => {
    if (!PUBLIC_VAPID_KEY) {
      setState((prev) => ({
        ...prev,
        error: 'Clé VAPID non configurée. Définissez NEXT_PUBLIC_VAPID_PUBLIC_KEY.',
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({
        ...prev,
        permission: permission as NotificationPermission,
      }));

      if (permission !== 'granted') {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
      });

      // Send subscription to backend
      const resp = await fetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!resp.ok) {
        throw new Error(`Backend error: ${resp.status}`);
      }

      setState((prev) => ({ ...prev, isSubscribed: true, isLoading: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Échec de l\'abonnement',
      }));
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch('/api/v1/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setState((prev) => ({ ...prev, isSubscribed: false, isLoading: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Échec de la désinscription',
      }));
    }
  }, []);

  return { ...state, subscribe, unsubscribe };
}
