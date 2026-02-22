"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import { useArticles } from '../../contexts/ArticlesContext';
import { useAuth } from '../../contexts/AuthContext';
import { SearchBar } from '../ui/SearchBar';
import { Navigation } from './Navigation';
import { LoginModal } from '../auth/LoginModal';
import { SignupModal } from '../auth/SignupModal';
import { Badge, LiveBadge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';

// ============================================================================
// COMPONENT
// ============================================================================

export function Header() {
  const { darkMode, toggleDarkMode, theme, getGlass } = useTheme();
  const { state, setCategory } = useArticles();
  const { user, logout, isAuthenticated } = useAuth();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Initialize and update time
  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Track scroll for glassmorphism effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Glass styles for header
  const glassStyles = scrolled ? getGlass() : {};

  return (
    <>
      {/* Desktop-only header — hidden on mobile (MobileHeader handles mobile) */}
      <div className="header-desktop">
      {/* Top Bar - Compact info bar */}
      <div
        role="banner"
        aria-label="Barre d'informations"
        style={{
          backgroundColor: theme.bg === '#0A0A0A' ? '#000000' : '#0A0A0A',
          color: '#FFFFFF',
          padding: '6px 0',
          position: 'relative',
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
          }}
        >
          {/* Left: Location & Time */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, letterSpacing: '0.05em' }}>PARIS</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)' }}>
              {currentTime ? currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </span>

            {/* Stock Ticker */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>CAC 40:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>7,543</span>
              <span style={{ color: theme.success, fontSize: '11px' }}>+1.24%</span>
            </span>

            {/* API Status Indicator */}
            {mounted && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: state.isApiAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
                title={state.isApiAvailable ? 'Donnees en direct' : 'Mode demo'}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: state.isApiAvailable ? theme.success : theme.warning,
                  }}
                  className={state.isApiAvailable ? 'animate-live-pulse' : ''}
                />
                <span style={{ color: state.isApiAvailable ? theme.success : theme.warning }}>
                  {state.isApiAvailable ? 'LIVE' : 'DEMO'}
                </span>
              </div>
            )}
          </div>

          {/* Center: Quick Nav */}
          <nav style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link
              href="/live"
              className="btn-hover-danger"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: theme.brand.primary,
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#FFFFFF',
                textDecoration: 'none',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '50%',
                }}
                className="animate-live-pulse"
              />
              EN DIRECT
            </Link>

            <Link
              href="/intelligence"
              className="btn-hover-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                background: theme.brand.secondary,
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#FFFFFF',
                textDecoration: 'none',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Intelligence
            </Link>

            <Link
              href="/admin/pipeline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                fontSize: '10px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.7)',
                textDecoration: 'none',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
              }}
            >
              Admin
            </Link>
          </nav>

          {/* Right: Theme & Auth */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="icon-btn-hover"
              style={{
                background: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
                border: 'none',
                borderRadius: '8px',
                width: 36,
                height: 36,
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 150ms ease',
              }}
              aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>

            {/* Auth Buttons */}
            {isAuthenticated ? (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                  {user?.name || 'Utilisateur'}
                </span>
                <button
                  onClick={logout}
                  style={{
                    background: 'transparent',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    letterSpacing: '0.03em',
                    transition: 'all 150ms ease',
                  }}
                >
                  DECONNEXION
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowLoginModal(true)}
                  style={{
                    background: 'transparent',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    letterSpacing: '0.03em',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                  }}
                >
                  CONNEXION
                </button>
                <button
                  onClick={() => setShowSignupModal(true)}
                  className="btn-hover-primary"
                  style={{
                    background: theme.brand.secondary,
                    padding: '6px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.03em',
                    transition: 'all 150ms ease',
                  }}
                >
                  S'ABONNER
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Header - With Glassmorphism on scroll */}
      <header
        role="banner"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          borderBottom: scrolled ? 'none' : `2px solid ${theme.border}`,
          backgroundColor: scrolled ? 'transparent' : theme.bg,
          padding: '16px 0',
          transition: 'all 300ms ease',
          ...glassStyles,
        }}
      >
        <div
          style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '32px',
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            aria-label="NovaPress AI - Retour a l'accueil"
            style={{
              textDecoration: 'none',
              display: 'block',
              flexShrink: 0,
            }}
          >
            <h1
              style={{
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 900,
                letterSpacing: '-2px',
                margin: 0,
                lineHeight: 1,
                fontFamily: 'var(--font-serif)',
                transition: 'transform 150ms ease',
              }}
              className="opacity-hover"
            >
              <span style={{ color: theme.text }}>NOVA</span>
              <span style={{ color: theme.brand.primary }}>PRESS</span>
              <span
                style={{
                  color: theme.brand.secondary,
                  fontSize: 'clamp(16px, 2vw, 24px)',
                  fontWeight: 600,
                  marginLeft: '8px',
                  letterSpacing: 0,
                  verticalAlign: 'super',
                }}
              >
                AI
              </span>
            </h1>
          </Link>

          {/* Search Bar */}
          <div style={{ flex: 1, maxWidth: '500px' }}>
            <SearchBar />
          </div>

          {/* Navigation */}
          <Navigation
            selectedCategory={state.selectedCategory}
            onCategoryChange={setCategory}
          />
        </div>
      </header>

      </div>{/* end .header-desktop */}

      {/* Auth Modals — outside header-desktop so they still work on mobile */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => setShowLoginModal(false)}
        onSwitchToSignup={() => {
          setShowLoginModal(false);
          setShowSignupModal(true);
        }}
      />

      <SignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSuccess={() => setShowSignupModal(false)}
        onSwitchToLogin={() => {
          setShowSignupModal(false);
          setShowLoginModal(true);
        }}
      />
    </>
  );
}

export default Header;
