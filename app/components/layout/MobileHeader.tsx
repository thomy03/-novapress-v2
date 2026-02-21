"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';

export default function MobileHeader() {
    const { darkMode, toggleDarkMode } = useTheme();
    const [isHidden, setIsHidden] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const lastScrollY = useRef(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            const currentY = window.scrollY;
            if (currentY > lastScrollY.current && currentY > 60) {
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

    return (
        <header
            className="mobile-header"
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 999,
                transform: isHidden ? 'translateY(-100%)' : 'translateY(0)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                backgroundColor: darkMode ? 'rgba(10, 10, 10, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                paddingTop: 'env(safe-area-inset-top, 0px)',
            }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '56px',
                padding: '0 16px',
            }}>
                {/* Logo */}
                <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline' }}>
                    <span style={{
                        fontSize: '22px',
                        fontWeight: 'bold',
                        fontFamily: 'Georgia, serif',
                        color: darkMode ? '#FAFAFA' : '#0A0A0A',
                    }}>
                        NOVA
                    </span>
                    <span style={{
                        fontSize: '22px',
                        fontWeight: 'bold',
                        fontFamily: 'Georgia, serif',
                        color: '#DC2626',
                    }}>
                        PRESS
                    </span>
                    <span style={{
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: '#2563EB',
                        marginLeft: '3px',
                    }}>
                        AI
                    </span>
                </Link>

                {/* Right actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Search toggle */}
                    <button
                        onClick={() => setSearchOpen(!searchOpen)}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: searchOpen
                                ? (darkMode ? 'rgba(220,38,38,0.2)' : 'rgba(220,38,38,0.1)')
                                : 'transparent',
                            color: darkMode ? '#FAFAFA' : '#0A0A0A',
                            fontSize: '18px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                        }}
                        aria-label="Rechercher"
                    >
                        {searchOpen ? '✕' : '🔍'}
                    </button>

                    {/* Dark mode toggle */}
                    <button
                        onClick={toggleDarkMode}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: darkMode ? '#FAFAFA' : '#0A0A0A',
                            fontSize: '18px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        aria-label="Mode sombre"
                    >
                        {darkMode ? '☀️' : '🌙'}
                    </button>
                </div>
            </div>

            {/* Expandable search bar */}
            <div
                style={{
                    overflow: 'hidden',
                    maxHeight: searchOpen ? '60px' : '0',
                    transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    padding: searchOpen ? '0 16px 12px' : '0 16px',
                }}
            >
                <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                }}>
                    <span style={{
                        position: 'absolute',
                        left: '12px',
                        fontSize: '16px',
                        color: darkMode ? '#666' : '#999',
                    }}>
                        🔍
                    </span>
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
                            height: '40px',
                            borderRadius: '12px',
                            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                            backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            color: darkMode ? '#FAFAFA' : '#0A0A0A',
                            paddingLeft: '38px',
                            paddingRight: '12px',
                            fontSize: '15px',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                        }}
                    />
                </div>
            </div>
        </header>
    );
}
