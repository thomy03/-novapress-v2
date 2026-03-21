"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import { useArticles } from '../../contexts/ArticlesContext';
import { useAuth } from '../../contexts/AuthContext';
import { SearchBar } from '../ui/SearchBar';
import { LoginModal } from '../auth/LoginModal';
import { SignupModal } from '../auth/SignupModal';

// ============================================================================
// CONSTANTS
// ============================================================================

const NAV_CATEGORIES = [
  { id: 'MONDE', label: 'MONDE' },
  { id: 'TECH', label: 'TECH' },
  { id: 'ECONOMIE', label: 'ECONOMIE' },
  { id: 'POLITIQUE', label: 'POLITIQUE' },
  { id: 'CULTURE', label: 'CULTURE' },
  { id: 'SPORT', label: 'SPORT' },
  { id: 'SCIENCES', label: 'SCIENCES' },
];

const LABEL_FONT = "'Space Grotesk', 'Inter', system-ui, sans-serif";

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
  const [showSearch, setShowSearch] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

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

  // Format time for status bar
  const formatTime = useCallback(() => {
    if (!currentTime) return '--:--';
    return currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }, [currentTime]);

  const formatDayName = useCallback(() => {
    if (!currentTime) return '';
    return currentTime.toLocaleDateString('fr-FR', { weekday: 'long' }).toUpperCase();
  }, [currentTime]);

  // Glass styles for main header on scroll
  const glassStyles: React.CSSProperties = scrolled ? {
    ...getGlass(),
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  } : {};

  // Status bar background: darkest surface
  const statusBarBg = darkMode ? '#000000' : '#0A0A0A';
  const statusBarText = 'rgba(255, 255, 255, 0.55)';
  const statusBarTextBright = 'rgba(255, 255, 255, 0.8)';

  return (
    <>
      <div className="header-desktop">
        {/* ================================================================ */}
        {/* STATUS BAR - Top thin intelligence strip                         */}
        {/* ================================================================ */}
        <div
          role="banner"
          aria-label="Barre de statut"
          style={{
            backgroundColor: statusBarBg,
            padding: '5px 0',
            position: 'relative',
            zIndex: 100,
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div
            style={{
              maxWidth: '1400px',
              margin: '0 auto',
              padding: '0 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Left: PARIS | HH:MM | DAY | LIVE */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              <span
                style={{
                  fontFamily: LABEL_FONT,
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase' as const,
                  color: statusBarTextBright,
                }}
              >
                PARIS
              </span>

              <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 10px', fontSize: '10px' }}>|</span>

              <span
                style={{
                  fontFamily: LABEL_FONT,
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  color: statusBarText,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatTime()}
              </span>

              <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 10px', fontSize: '10px' }}>|</span>

              <span
                style={{
                  fontFamily: LABEL_FONT,
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase' as const,
                  color: statusBarText,
                }}
              >
                {formatDayName()}
              </span>

              {/* LIVE indicator */}
              {mounted && state.isApiAvailable && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 10px', fontSize: '10px' }}>|</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span
                      className="animate-live-pulse"
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: '#DC2626',
                        display: 'inline-block',
                        boxShadow: '0 0 6px rgba(220, 38, 38, 0.6)',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: LABEL_FONT,
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        color: '#DC2626',
                      }}
                    >
                      LIVE
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Right: API STATUS | LATENCY | Admin */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              <span
                style={{
                  fontFamily: LABEL_FONT,
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase' as const,
                  color: statusBarText,
                }}
              >
                API STATUS:
              </span>
              <span
                style={{
                  fontFamily: LABEL_FONT,
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: mounted && state.isApiAvailable ? '#10B981' : 'rgba(255,255,255,0.4)',
                  marginLeft: '5px',
                }}
              >
                {mounted && state.isApiAvailable ? 'OPTIMAL' : 'OFFLINE'}
              </span>

              <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 10px', fontSize: '10px' }}>|</span>

              <span
                style={{
                  fontFamily: LABEL_FONT,
                  fontSize: '10px',
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase' as const,
                  color: statusBarText,
                }}
              >
                LATENCY:
              </span>
              <span
                style={{
                  fontFamily: LABEL_FONT,
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  color: statusBarTextBright,
                  marginLeft: '5px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                14ms
              </span>

              {/* Admin link */}
              {isAuthenticated && user?.isAdmin && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.2)', margin: '0 10px', fontSize: '10px' }}>|</span>
                  <Link
                    href="/admin/pipeline"
                    style={{
                      fontFamily: LABEL_FONT,
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase' as const,
                      color: theme.brand.accent,
                      textDecoration: 'none',
                      transition: 'opacity 150ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                    ADMIN
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* MAIN HEADER - Sticky with glassmorphism on scroll                */}
        {/* ================================================================ */}
        <header
          role="banner"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 50,
            backgroundColor: scrolled ? 'transparent' : theme.bg,
            transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            borderBottom: `1px solid ${scrolled ? 'transparent' : theme.border}`,
            ...glassStyles,
          }}
        >
          {/* Row 1: Logo + Nav + Actions */}
          <div
            style={{
              maxWidth: '1400px',
              margin: '0 auto',
              padding: '14px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {/* Logo */}
            <Link
              href="/"
              aria-label="NovaPress AI - Retour a l'accueil"
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'baseline',
                flexShrink: 0,
                gap: '6px',
              }}
            >
              <span
                style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: '28px',
                  fontWeight: 700,
                  fontStyle: 'italic',
                  letterSpacing: '-1px',
                  color: theme.text,
                  lineHeight: 1,
                  transition: 'opacity 150ms ease',
                }}
              >
                NOVAPRESS
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.brand.secondary,
                  color: '#FFFFFF',
                  fontFamily: LABEL_FONT,
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  lineHeight: 1,
                  position: 'relative' as const,
                  top: '-8px',
                }}
              >
                AI
              </span>
            </Link>

            {/* Navigation Links */}
            <nav
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {NAV_CATEGORIES.map((cat) => {
                const isActive = state.selectedCategory === cat.id;
                const isHovered = hoveredNav === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    onMouseEnter={() => setHoveredNav(cat.id)}
                    onMouseLeave={() => setHoveredNav(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: LABEL_FONT,
                      fontSize: '11px',
                      fontWeight: isActive ? 700 : 500,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase' as const,
                      color: isActive
                        ? theme.brand.primary
                        : isHovered
                          ? theme.text
                          : theme.textSecondary,
                      padding: '8px 12px',
                      position: 'relative' as const,
                      transition: 'color 150ms ease',
                    }}
                  >
                    {cat.label}
                    {/* Active underline */}
                    <span
                      style={{
                        position: 'absolute' as const,
                        bottom: '2px',
                        left: '12px',
                        right: '12px',
                        height: '2px',
                        backgroundColor: theme.brand.primary,
                        borderRadius: '1px',
                        transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
                        transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                        transformOrigin: 'center',
                      }}
                    />
                  </button>
                );
              })}
            </nav>

            {/* Right Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              {/* EN DIRECT button */}
              <Link
                href="/live"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  backgroundColor: '#DC2626',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontFamily: LABEL_FONT,
                  fontWeight: 700,
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#B91C1C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#DC2626'; }}
              >
                <span
                  className="animate-live-pulse"
                  style={{
                    width: '5px',
                    height: '5px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '50%',
                    display: 'inline-block',
                  }}
                />
                EN DIRECT
              </Link>

              {/* Search Icon / Toggle */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                aria-label="Rechercher"
                style={{
                  background: 'none',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.textSecondary,
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.text;
                  e.currentTarget.style.color = theme.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.border;
                  e.currentTarget.style.color = theme.textSecondary;
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                aria-label={darkMode ? 'Activer le mode clair' : 'Activer le mode sombre'}
                style={{
                  background: 'none',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '4px',
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.textSecondary,
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.text;
                  e.currentTarget.style.color = theme.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.border;
                  e.currentTarget.style.color = theme.textSecondary;
                }}
              >
                {darkMode ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              {/* Auth Section */}
              {isAuthenticated ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px' }}>
                  <Link
                    href="/account"
                    style={{
                      fontFamily: LABEL_FONT,
                      fontSize: '11px',
                      fontWeight: 500,
                      color: theme.textSecondary,
                      textDecoration: 'none',
                      letterSpacing: '0.04em',
                      transition: 'color 150ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = theme.text; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = theme.textSecondary; }}
                  >
                    {user?.name || 'Mon compte'}
                  </Link>
                  <button
                    onClick={logout}
                    style={{
                      background: 'none',
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      padding: '5px 12px',
                      fontFamily: LABEL_FONT,
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase' as const,
                      color: theme.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.text;
                      e.currentTarget.style.color = theme.text;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.border;
                      e.currentTarget.style.color = theme.textSecondary;
                    }}
                  >
                    Sortir
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                  <button
                    onClick={() => setShowLoginModal(true)}
                    style={{
                      background: 'none',
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      padding: '5px 12px',
                      fontFamily: LABEL_FONT,
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase' as const,
                      color: theme.textSecondary,
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.text;
                      e.currentTarget.style.color = theme.text;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.border;
                      e.currentTarget.style.color = theme.textSecondary;
                    }}
                  >
                    Connexion
                  </button>
                  <button
                    onClick={() => setShowSignupModal(true)}
                    style={{
                      background: theme.brand.secondary,
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 14px',
                      fontFamily: LABEL_FONT,
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase' as const,
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'opacity 150ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                  >
                    S'abonner
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Search Bar - expandable */}
          {showSearch && (
            <div
              style={{
                maxWidth: '1400px',
                margin: '0 auto',
                padding: '0 24px 12px',
              }}
            >
              <div style={{ maxWidth: '480px', marginLeft: 'auto' }}>
                <SearchBar />
              </div>
            </div>
          )}

          {/* Bottom rule */}
          <div
            style={{
              height: scrolled ? '0px' : '2px',
              backgroundColor: theme.border,
              transition: 'height 200ms ease',
            }}
          />
        </header>
      </div>{/* end .header-desktop */}

      {/* Auth Modals -- outside header-desktop so they still work on mobile */}
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
