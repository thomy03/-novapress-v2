"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../../contexts/ThemeContext';

const QUICK_LINKS = [
    { label: '⚡ En direct', href: '/live' },
    { label: '🌍 Monde', href: '/live?category=MONDE' },
    { label: '💻 Tech', href: '/live?category=TECH' },
    { label: '📈 Éco', href: '/live?category=ECONOMIE' },
    { label: '🏛️ Politique', href: '/live?category=POLITIQUE' },
    { label: '🎭 Culture', href: '/live?category=CULTURE' },
    { label: '⚽ Sport', href: '/live?category=SPORT' },
    { label: '🔬 Sciences', href: '/live?category=SCIENCES' },
    { label: '📌 Sauvegardés', href: '/saved' },
];

export default function MobileHeader() {
    const { darkMode, toggleDarkMode } = useTheme();
    const pathname = usePathname();
    const [isHidden, setIsHidden] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const lastScrollY = useRef(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            const currentY = window.scrollY;
            if (currentY > lastScrollY.current && currentY > 80) {
                setIsHidden(true);
                setSearchOpen(false);
            } else {
                setIsHidden(false);
            }
            lastScrollY.current = currentY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (searchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [searchOpen]);

    const borderColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = darkMode ? '#FAFAFA' : '#0A0A0A';
    const bgColor = darkMode ? 'rgba(10, 10, 10, 0.95)' : 'rgba(255, 255, 255, 0.95)';

    return (
        <header
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 999,
                transform: isHidden ? 'translateY(-100%)' : 'translateY(0)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                backgroundColor: bgColor,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: `1px solid ${borderColor}`,
                paddingTop: 'env(safe-area-inset-top, 0px)',
            }}
        >
            {/* Top bar: Logo + actions */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '52px',
                padding: '0 16px',
            }}>
                {/* Logo */}
                <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: '1px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'Georgia, serif', color: textColor }}>NOVA</span>
                    <span style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'Georgia, serif', color: '#DC2626' }}>PRESS</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', marginLeft: '2px' }}>AI</span>
                </Link>

                {/* Right actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {/* Search toggle */}
                    <button
                        onClick={() => setSearchOpen(!searchOpen)}
                        style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: searchOpen
                                ? (darkMode ? 'rgba(220,38,38,0.2)' : 'rgba(220,38,38,0.1)')
                                : 'transparent',
                            color: textColor,
                            fontSize: '18px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        aria-label="Rechercher"
                    >
                        {searchOpen ? '✕' : '🔍'}
                    </button>

                    {/* Theme toggle — styled as a pill for visibility */}
                    <button
                        onClick={toggleDarkMode}
                        style={{
                            height: '34px',
                            padding: '0 12px',
                            borderRadius: '20px',
                            border: `1px solid ${borderColor}`,
                            backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                            color: textColor,
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            whiteSpace: 'nowrap',
                        }}
                        aria-label={darkMode ? 'Mode clair' : 'Mode sombre'}
                    >
                        {darkMode ? '☀️' : '🌙'}
                        <span style={{ fontSize: '11px' }}>{darkMode ? 'Clair' : 'Sombre'}</span>
                    </button>
                </div>
            </div>

            {/* Expandable search bar */}
            <div
                style={{
                    overflow: 'hidden',
                    maxHeight: searchOpen ? '56px' : '0',
                    transition: 'max-height 0.25s ease',
                    padding: searchOpen ? '0 16px 10px' : '0 16px',
                }}
            >
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Rechercher dans les synthèses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchQuery.trim()) {
                            window.location.href = `/topics?q=${encodeURIComponent(searchQuery)}`;
                        }
                    }}
                    style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: '10px',
                        border: `1px solid ${borderColor}`,
                        backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                        color: textColor,
                        padding: '0 14px',
                        fontSize: '15px',
                        outline: 'none',
                    }}
                />
            </div>

            {/* Quick navigation bar — horizontal scroll */}
            <div
                className="mobile-nav-scroll"
                style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '8px 16px 10px',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                {QUICK_LINKS.map((link) => {
                    const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href.split('?')[0]));
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            style={{
                                flexShrink: 0,
                                padding: '5px 13px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: isActive ? 700 : 500,
                                textDecoration: 'none',
                                backgroundColor: isActive
                                    ? '#DC2626'
                                    : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                                color: isActive ? '#FFFFFF' : textColor,
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {link.label}
                        </Link>
                    );
                })}
            </div>
        </header>
    );
}
