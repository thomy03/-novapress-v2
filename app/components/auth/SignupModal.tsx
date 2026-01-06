"use client";

import React, { useState } from 'react';
import { authService } from '@/app/lib/api/services';
import { useTheme } from '@/app/contexts/ThemeContext';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
  onSwitchToLogin: () => void;
}

export function SignupModal({ isOpen, onClose, onSuccess, onSwitchToLogin }: SignupModalProps) {
  const { darkMode } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.register({
        email: formData.email,
        password: formData.password,
        name: formData.name
      });
      onSuccess(response.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Échec de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
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
    }}>
      <div style={{
        backgroundColor: darkMode ? '#1a1a1a' : '#ffffff',
        borderRadius: '8px',
        padding: '32px',
        width: '90%',
        maxWidth: '400px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: darkMode ? '#ffffff' : '#000000',
            fontFamily: 'Georgia, serif'
          }}>
            Créer un compte
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
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: darkMode ? '#e5e5e5' : '#374151'
            }}>
              Nom complet
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={handleChange('name')}
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: darkMode ? '#e5e5e5' : '#374151'
            }}>
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
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

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: darkMode ? '#e5e5e5' : '#374151'
            }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={handleChange('password')}
              required
              minLength={8}
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
            <p style={{
              marginTop: '4px',
              fontSize: '12px',
              color: darkMode ? '#9ca3af' : '#6b7280'
            }}>
              Minimum 8 caractères
            </p>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: darkMode ? '#e5e5e5' : '#374151'
            }}>
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
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
              backgroundColor: loading ? '#6b7280' : '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s'
            }}
          >
            {loading ? 'Inscription...' : 'S\'inscrire'}
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
            Déjà un compte?{' '}
            <button
              onClick={onSwitchToLogin}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px'
              }}
            >
              Se connecter
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}