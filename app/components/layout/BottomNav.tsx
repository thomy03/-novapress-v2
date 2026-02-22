"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../../contexts/ThemeContext';

interface NavItem {
    id: string;
    label: string;
    icon: string;
    activeIcon: string;
    href: string;
}

const NAV_ITEMS: NavItem[] = [
    { id: 'feed', label: 'Accueil', icon: '📰', activeIcon: '🗞️', href: '/' },
    { id: 'live', label: 'En direct', icon: '🔴', activeIcon: '🔴', href: '/live' },
    { id: 'saved', label: 'Sauvegardés', icon: '🔖', activeIcon: '🔖', href: '/saved' },
    { id: 'settings', label: 'Réglages', icon: '⚙️', activeIcon: '⚙️', href: '/settings' },
];

export default function BottomNav() {
    const pathname = usePathname();
    const { darkMode } = useTheme();
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    // Hide on scroll down, show on scroll up
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                setIsVisible(false);
            } else {
                setIsVisible(true);
            }
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    const getActiveTab = () => {
        if (pathname === '/') return 'feed';
        for (const item of NAV_ITEMS) {
            if (item.href !== '/' && pathname.startsWith(item.href)) return item.id;
        }
        return 'feed';
    };

    const activeTab = getActiveTab();

    return (
        <nav
            className="bottom-nav"
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                backgroundColor: darkMode ? 'rgba(10, 10, 10, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
        >
            <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                height: '60px',
                maxWidth: '500px',
                margin: '0 auto',
            }}>
                {NAV_ITEMS.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '2px',
                                padding: '6px 12px',
                                borderRadius: '12px',
                                textDecoration: 'none',
                                transition: 'all 0.2s ease',
                                backgroundColor: isActive
                                    ? (darkMode ? 'rgba(220, 38, 38, 0.15)' : 'rgba(220, 38, 38, 0.08)')
                                    : 'transparent',
                                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                            }}
                        >
                            <span style={{
                                fontSize: '22px',
                                lineHeight: 1,
                                filter: isActive ? 'none' : 'grayscale(0.5)',
                            }}>
                                {isActive ? item.activeIcon : item.icon}
                            </span>
                            <span style={{
                                fontSize: '10px',
                                fontWeight: isActive ? '700' : '500',
                                color: isActive
                                    ? '#DC2626'
                                    : (darkMode ? '#a3a3a3' : '#737373'),
                                letterSpacing: '0.02em',
                            }}>
                                {item.label}
                            </span>
                            {/* Active indicator dot */}
                            {isActive && (
                                <span style={{
                                    position: 'absolute',
                                    bottom: '4px',
                                    width: '4px',
                                    height: '4px',
                                    borderRadius: '50%',
                                    backgroundColor: '#DC2626',
                                }} />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
