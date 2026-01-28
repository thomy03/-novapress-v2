"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authService } from '@/app/lib/api/services';
import { useTheme } from '@/app/contexts/ThemeContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
  onSwitchToSignup: () => void;
}

export function LoginModal({ isOpen, onClose, onSuccess, onSwitchToSignup }: LoginModalProps) {
  const { darkMode } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // REF-010: ARIA - Refs for focus trap
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLInputElement>(null);
  const lastFocusableRef = useRef<HTMLButtonElement>(null);

  // REF-010: ARIA - Handle Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    // Focus trap: Tab navigation within modal
    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, [onClose]);

  // REF-010: ARIA - Setup keyboard listeners and initial focus
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Focus first input when modal opens
      setTimeout(() => firstFocusableRef.current?.focus(), 0);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authService.login({ email, password });
      onSuccess(response.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Échec de la connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    // REF-010: ARIA - Backdrop with click-to-close
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-hidden="true"
    >
      {/* REF-010: ARIA - Dialog container with proper attributes */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        style={{
          backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
          borderRadius: '8px',
          padding: '32px',
          width: '90%',
          maxWidth: '400px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2
            id="login-modal-title"
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: darkMode ? '#ffffff' : '#000000',
              fontFamily: 'Georgia, serif'
            }}
          >
            Connexion
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: darkMode ? '#6b7280' : '#6b7280'
            }}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="login-email"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: darkMode ? '#e5e5e5' : '#374151'
              }}
            >
              Email
            </label>
            <input
              ref={firstFocusableRef}
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '16px',
                border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
                borderRadius: '4px',
                backgroundColor: darkMode ? '#262626' : '#ffffff',
                color: darkMode ? '#ffffff' : '#000000'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="login-password"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500',
                color: darkMode ? '#e5e5e5' : '#374151'
              }}
            >
              Mot de passe
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '16px',
                border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
                borderRadius: '4px',
                backgroundColor: darkMode ? '#262626' : '#ffffff',
                color: darkMode ? '#ffffff' : '#000000'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px',
              marginBottom: '16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '4px',
              color: '#dc2626',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#6b7280' : '#000000',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s'
            }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '14px',
            color: darkMode ? '#9ca3af' : '#6b7280'
          }}>
            Pas encore de compte?{' '}
            <button
              onClick={onSwitchToSignup}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              S'inscrire
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}