"use client";

/**
 * NotificationPrefs - Settings component for notification preferences
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  getNotificationPrefs,
  saveNotificationPrefs,
  NotificationPreferences,
} from '../../lib/notifications';

export function NotificationPrefs() {
  const { theme, darkMode } = useTheme();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setSupported(isNotificationSupported());
    setPermission(getNotificationPermission());
    setPrefs(getNotificationPrefs());
  }, []);

  const handleRequestPermission = async () => {
    setRequesting(true);
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      updatePrefs({ enabled: true });
    }
    setRequesting(false);
  };

  const updatePrefs = (updates: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    const newPrefs = { ...prefs, ...updates };
    setPrefs(newPrefs);
    saveNotificationPrefs(updates);
  };

  if (!supported) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: darkMode ? '#1F2937' : '#FEF3C7',
        borderRadius: '8px',
        color: theme.text,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span>
          <span style={{ fontSize: '14px' }}>
            Les notifications ne sont pas supportées par votre navigateur.
          </span>
        </div>
      </div>
    );
  }

  if (!prefs) return null;

  return (
    <div style={{
      backgroundColor: darkMode ? '#1F2937' : '#F9FAFB',
      border: `1px solid ${theme.border}`,
      borderRadius: '12px',
      padding: '20px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '20px',
      }}>
        <span style={{ fontSize: '24px' }}>🔔</span>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: theme.text,
          }}>
            Notifications
          </h3>
          <p style={{
            margin: '4px 0 0 0',
            fontSize: '12px',
            color: theme.textSecondary,
          }}>
            Recevez des alertes pour les actualités importantes
          </p>
        </div>
      </div>

      {/* Permission status */}
      {permission !== 'granted' && (
        <div style={{
          padding: '16px',
          backgroundColor: darkMode ? '#374151' : '#EFF6FF',
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          <p style={{
            margin: '0 0 12px 0',
            fontSize: '13px',
            color: theme.text,
          }}>
            {permission === 'denied'
              ? 'Les notifications sont bloquées. Modifiez les paramètres de votre navigateur pour les activer.'
              : 'Activez les notifications pour être alerté des actualités importantes.'
            }
          </p>
          {permission === 'default' && (
            <button
              onClick={handleRequestPermission}
              disabled={requesting}
              style={{
                padding: '10px 20px',
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: requesting ? 'wait' : 'pointer',
                opacity: requesting ? 0.7 : 1,
              }}
            >
              {requesting ? 'Activation...' : 'Activer les notifications'}
            </button>
          )}
        </div>
      )}

      {/* Preferences (only show if permission granted) */}
      {permission === 'granted' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Master toggle */}
          <ToggleOption
            label="Notifications activées"
            description="Activer/désactiver toutes les notifications"
            checked={prefs.enabled}
            onChange={(checked) => updatePrefs({ enabled: checked })}
            theme={theme}
            darkMode={darkMode}
          />

          {prefs.enabled && (
            <>
              <div style={{
                height: '1px',
                backgroundColor: theme.border,
                margin: '4px 0',
              }} />

              {/* Breaking news */}
              <ToggleOption
                label="Breaking News"
                description="Alertes pour les actualités majeures"
                checked={prefs.breakingNews}
                onChange={(checked) => updatePrefs({ breakingNews: checked })}
                theme={theme}
                darkMode={darkMode}
                icon="🔴"
              />

              {/* Daily digest */}
              <ToggleOption
                label="Résumé quotidien"
                description="Un récapitulatif des actualités du jour"
                checked={prefs.dailyDigest}
                onChange={(checked) => updatePrefs({ dailyDigest: checked })}
                theme={theme}
                darkMode={darkMode}
                icon="📬"
              />

              {/* New syntheses */}
              <ToggleOption
                label="Nouvelles synthèses"
                description="Alertes pour chaque nouvelle synthèse"
                checked={prefs.newSyntheses}
                onChange={(checked) => updatePrefs({ newSyntheses: checked })}
                theme={theme}
                darkMode={darkMode}
                icon="📰"
              />

              <div style={{
                height: '1px',
                backgroundColor: theme.border,
                margin: '4px 0',
              }} />

              {/* Max per day */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}>
                  <label style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: theme.text,
                  }}>
                    Maximum par jour: {prefs.maxPerDay}
                  </label>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={prefs.maxPerDay}
                  onChange={(e) => updatePrefs({ maxPerDay: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* Quiet hours */}
              <ToggleOption
                label="Heures calmes"
                description={`Pas de notifications entre ${prefs.quietHours.start} et ${prefs.quietHours.end}`}
                checked={prefs.quietHours.enabled}
                onChange={(checked) => updatePrefs({
                  quietHours: { ...prefs.quietHours, enabled: checked }
                })}
                theme={theme}
                darkMode={darkMode}
                icon="🌙"
              />

              {prefs.quietHours.enabled && (
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  marginLeft: '32px',
                }}>
                  <div>
                    <label style={{
                      fontSize: '12px',
                      color: theme.textSecondary,
                      display: 'block',
                      marginBottom: '4px',
                    }}>
                      Début
                    </label>
                    <input
                      type="time"
                      value={prefs.quietHours.start}
                      onChange={(e) => updatePrefs({
                        quietHours: { ...prefs.quietHours, start: e.target.value }
                      })}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: `1px solid ${theme.border}`,
                        backgroundColor: darkMode ? '#374151' : '#FFFFFF',
                        color: theme.text,
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      fontSize: '12px',
                      color: theme.textSecondary,
                      display: 'block',
                      marginBottom: '4px',
                    }}>
                      Fin
                    </label>
                    <input
                      type="time"
                      value={prefs.quietHours.end}
                      onChange={(e) => updatePrefs({
                        quietHours: { ...prefs.quietHours, end: e.target.value }
                      })}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: `1px solid ${theme.border}`,
                        backgroundColor: darkMode ? '#374151' : '#FFFFFF',
                        color: theme.text,
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Toggle option component
interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  theme: any;
  darkMode: boolean;
  icon?: string;
}

function ToggleOption({ label, description, checked, onChange, theme, darkMode, icon }: ToggleOptionProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
    }}>
      {icon && <span style={{ fontSize: '18px', marginTop: '2px' }}>{icon}</span>}
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '500',
          color: theme.text,
          marginBottom: '2px',
        }}>
          {label}
        </div>
        <div style={{
          fontSize: '12px',
          color: theme.textSecondary,
        }}>
          {description}
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: '44px',
          height: '24px',
          borderRadius: '12px',
          border: 'none',
          backgroundColor: checked ? '#3B82F6' : (darkMode ? '#4B5563' : '#D1D5DB'),
          cursor: 'pointer',
          position: 'relative',
          transition: 'background-color 0.2s',
        }}
      >
        <div style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '2px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: '#FFFFFF',
          transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

export default NotificationPrefs;
