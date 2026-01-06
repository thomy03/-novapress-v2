"use client";

import { useEffect, useState } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isOnline: true,
    updateAvailable: false
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if service workers are supported
    const isSupported = 'serviceWorker' in navigator;
    setState(prev => ({ ...prev, isSupported }));

    if (!isSupported) {
      console.log('Service workers are not supported');
      return;
    }

    // Register service worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        console.log('Service worker registered successfully:', registration.scope);
        setState(prev => ({ ...prev, isRegistered: true }));

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                setState(prev => ({ ...prev, updateAvailable: true }));
                console.log('New version available! Please refresh.');
              }
            });
          }
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'CACHE_UPDATED') {
            console.log('Cache updated:', event.data.url);
          }
        });

      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    registerSW();

    // Monitor online/offline status
    const updateOnlineStatus = () => {
      setState(prev => ({ ...prev, isOnline: navigator.onLine }));
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Function to update service worker
  const updateServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    }
  };

  // Function to cache articles for offline reading
  const cacheArticlesForOffline = async (articles: any[]) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_ARTICLES',
        articles
      });
    }
  };

  // Function to check cache size
  const getCacheInfo = async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
        percentage: estimate.quota ? Math.round((estimate.usage || 0) / estimate.quota * 100) : 0
      };
    }
    return null;
  };

  return {
    ...state,
    updateServiceWorker,
    cacheArticlesForOffline,
    getCacheInfo
  };
}