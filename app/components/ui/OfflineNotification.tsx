"use client";

import React, { useState } from 'react';
import { useServiceWorker } from '../../hooks/useServiceWorker';
import { useTheme } from '../../contexts/ThemeContext';

export function OfflineNotification() {
  const { isOnline, updateAvailable, updateServiceWorker } = useServiceWorker();
  const { theme } = useTheme();
  const [dismissed, setDismissed] = useState(false);

  if (!updateAvailable && isOnline) {
    return null;
  }

  if (dismissed) {
    return null;
  }

  return (
    <>
      {/* Offline notification */}
      {!isOnline && (
        <div 
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#f59e0b',
            color: 'white',
            padding: '16px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '400px',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              Mode hors ligne
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Vous naviguez en mode hors ligne. Certaines fonctionnalités peuvent être limitées.
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            aria-label="Fermer la notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Update available notification */}
      {updateAvailable && (
        <div 
          role="alert"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#10b981',
            color: 'white',
            padding: '16px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '400px',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <span style={{ fontSize: '20px' }}>🆕</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              Nouvelle version disponible
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Une mise à jour de NovaPress AI est disponible.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={updateServiceWorker}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '4px',
                color: 'white',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              Mettre à jour
            </button>
            <button
              onClick={() => setDismissed(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '12px',
                opacity: 0.7
              }}
              aria-label="Fermer la notification"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

// Cache status indicator for development/admin
export function CacheStatusIndicator() {
  const { isRegistered, isOnline, getCacheInfo } = useServiceWorker();
  const { theme } = useTheme();
  const [cacheInfo, setCacheInfo] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  React.useEffect(() => {
    const loadCacheInfo = async () => {
      const info = await getCacheInfo();
      setCacheInfo(info);
    };
    
    if (isRegistered) {
      loadCacheInfo();
      // Update cache info every 30 seconds
      const interval = setInterval(loadCacheInfo, 30000);
      return () => clearInterval(interval);
    }
  }, [isRegistered, getCacheInfo]);

  if (!isRegistered) {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        backgroundColor: theme.card,
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '12px',
        color: theme.textSecondary,
        cursor: 'pointer',
        zIndex: 999,
        transition: 'all 0.2s ease'
      }}
      onClick={() => setShowDetails(!showDetails)}
      title="Cliquez pour voir les détails du cache"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div 
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isOnline ? '#10b981' : '#f59e0b'
          }}
        />
        <span>SW</span>
        {cacheInfo && (
          <span>{cacheInfo.percentage}%</span>
        )}
      </div>
      
      {showDetails && cacheInfo && (
        <div 
          style={{
            position: 'absolute',
            bottom: '100%',
            right: '0',
            marginBottom: '8px',
            backgroundColor: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: '6px',
            padding: '12px',
            minWidth: '200px',
            boxShadow: `0 4px 12px ${theme.shadow}`
          }}
        >
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Cache Storage</div>
          <div>Utilisé: {Math.round(cacheInfo.used / 1024 / 1024)} MB</div>
          <div>Quota: {Math.round(cacheInfo.quota / 1024 / 1024)} MB</div>
          <div>Pourcentage: {cacheInfo.percentage}%</div>
          <div style={{ marginTop: '8px', color: isOnline ? '#000000' : '#DC2626' }}>
            {isOnline ? '🟢 En ligne' : '🟡 Hors ligne'}
          </div>
        </div>
      )}
    </div>
  );
}