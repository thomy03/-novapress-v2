"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import { useArticles } from '../../contexts/ArticlesContext';
import { useAuth } from '../../contexts/AuthContext';
import { SearchBar } from '../ui/SearchBar';
import { Navigation } from './Navigation';
import { LoginModal } from '../auth/LoginModal';
import { SignupModal } from '../auth/SignupModal';

export function Header() {
  const { darkMode, toggleDarkMode, theme } = useTheme();
  const { state, setCategory } = useArticles();
  const { user, logout, isAuthenticated } = useAuth();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Top Bar with Weather Widget */}
      <div 
        role="banner" 
        aria-label="Barre d'informations supérieure"
        style={{ 
          backgroundColor: '#000000', 
          color: 'white', 
          padding: '8px 0', 
          boxShadow: `0 1px 3px ${theme.shadow}`
        }}>
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto', 
          padding: '0 20px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          fontSize: '12px' 
        }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>PARIS</span>
            <span>{currentTime ? currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
            <span>CAC 40: 7,543 <span style={{ color: '#DC2626' }}>▲1.24%</span></span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '20px'
            }}>
              <span>☀️</span>
              <span>22°C</span>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>Paris</span>
            </div>
            {/* Data source indicator - only render dynamic content after mount to avoid hydration mismatch */}
            {mounted && (
              <div
                title={state.isApiAvailable ? 'Données en direct depuis l\'API' : 'Mode démo - Données simulées'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  backgroundColor: state.isApiAvailable ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: state.isApiAvailable ? '#22c55e' : '#eab308'
                }}
              >
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: state.isApiAvailable ? '#22c55e' : '#eab308',
                  animation: state.isApiAvailable ? 'pulse 2s infinite' : 'none'
                }} />
                {state.isApiAvailable ? 'LIVE' : 'DEMO'}
              </div>
            )}
            {/* Admin Pipeline Link */}
            <Link
              href="/admin/pipeline"
              title="Gestion du Pipeline (Admin)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                borderRadius: '12px',
                fontSize: '10px',
                fontWeight: 'bold',
                color: '#a78bfa',
                textDecoration: 'none',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.2)';
              }}
            >
              <span style={{ fontSize: '12px' }}>⚙️</span>
              ADMIN
            </Link>
            {/* Dev Kanban Link */}
            <Link
              href="/dev/kanban"
              title="Kanban de développement"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 10px',
                backgroundColor: 'rgba(6, 182, 212, 0.2)',
                borderRadius: '12px',
                fontSize: '10px',
                fontWeight: 'bold',
                color: '#22d3d3',
                textDecoration: 'none',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.2)';
              }}
            >
              <span style={{ fontSize: '12px' }}>📋</span>
              KANBAN
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={toggleDarkMode}
              style={{
                background: darkMode ? '#374151' : '#f3f4f6',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid #3b82f6';
                e.currentTarget.style.outlineOffset = '2px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
              }}
              aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
              title={darkMode ? 'Mode clair' : 'Mode sombre'}
            >
              <span role="img" aria-hidden="true">{darkMode ? '☀️' : '🌙'}</span>
            </button>
            {isAuthenticated ? (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: 'white', fontSize: '14px' }}>
                  Bonjour, {user?.name || 'Utilisateur'}
                </span>
                <button 
                  onClick={logout}
                  style={{ 
                    backgroundColor: 'transparent', 
                    padding: '6px 16px', 
                    borderRadius: '25px', 
                    border: '1px solid white', 
                    color: 'white', 
                    fontSize: '12px',
                    fontWeight: 'bold', 
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = '2px solid #ffffff';
                    e.currentTarget.style.outlineOffset = '2px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none';
                  }}
                  aria-label="Se déconnecter"
                >
                  DÉCONNEXION
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => setShowLoginModal(true)}
                  style={{ 
                    backgroundColor: 'transparent', 
                    padding: '6px 16px', 
                    borderRadius: '25px', 
                    border: '1px solid white', 
                    color: 'white', 
                    fontSize: '12px',
                    fontWeight: 'bold', 
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = '2px solid #ffffff';
                    e.currentTarget.style.outlineOffset = '2px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none';
                  }}
                  aria-label="Se connecter"
                >
                  CONNEXION
                </button>
                <button 
                  onClick={() => setShowSignupModal(true)}
                  style={{ 
                    backgroundColor: '#2563eb', 
                    padding: '6px 20px', 
                    borderRadius: '25px', 
                    border: 'none', 
                    color: 'white', 
                    fontWeight: 'bold', 
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 1px 3px rgba(59, 130, 246, 0.3)',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = '2px solid #ffffff';
                    e.currentTarget.style.outlineOffset = '2px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none';
                  }}
                  aria-label="S'inscrire"
                >
                  S'ABONNER
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header 
        role="banner"
        style={{ 
          borderBottom: `3px solid ${theme.borderDark}`, 
          backgroundColor: theme.bgSecondary, 
          padding: '20px 0', 
          boxShadow: `0 2px 4px ${theme.shadow}`
        }}>
        <div style={{ 
          maxWidth: '1400px', 
          margin: '0 auto', 
          padding: '0 20px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          {/* Logo */}
          <h1 
            tabIndex={0}
            role="link"
            aria-label="NovaPress AI - Accueil"
            style={{ 
              fontSize: '48px', 
              fontWeight: '900', 
              letterSpacing: '-1px', 
              cursor: 'pointer', 
              transition: 'transform 0.3s ease',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid #3b82f6';
              e.currentTarget.style.outlineOffset = '4px';
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.location.href = '/';
              }
            }}
          >
            <span style={{ color: darkMode ? '#ffffff' : '#000000' }}>NOVA</span>
            <span style={{ color: '#DC2626' }}>PRESS</span>
            <span style={{ color: '#2563EB', fontSize: '24px', fontWeight: '600', marginLeft: '8px' }}>AI</span>
          </h1>
          
          {/* Search Bar */}
          <SearchBar />
          
          {/* Navigation */}
          <Navigation 
            selectedCategory={state.selectedCategory}
            onCategoryChange={setCategory}
          />
        </div>
      </header>

      {/* Auth Modals */}
      <LoginModal 
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={(user) => {
          console.log('Login successful:', user);
          setShowLoginModal(false);
        }}
        onSwitchToSignup={() => {
          setShowLoginModal(false);
          setShowSignupModal(true);
        }}
      />
      
      <SignupModal 
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSuccess={(user) => {
          console.log('Signup successful:', user);
          setShowSignupModal(false);
        }}
        onSwitchToLogin={() => {
          setShowSignupModal(false);
          setShowLoginModal(true);
        }}
      />
    </>
  );
}