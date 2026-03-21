"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'feed', label: 'Feed', icon: 'newspaper', href: '/' },
  { id: 'live', label: 'Live', icon: 'sensors', href: '/live' },
  { id: 'saved', label: 'Saved', icon: 'bookmark', href: '/saved' },
  { id: 'settings', label: 'Settings', icon: 'settings', href: '/settings' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

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
        backgroundColor: '#1C1B1B',
        borderTop: '1px solid rgba(67, 70, 85, 0.15)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '64px',
      }}
    >
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
              gap: '4px',
              padding: '8px 16px',
              textDecoration: 'none',
              backgroundColor: isActive ? '#201F1F' : 'transparent',
              color: isActive ? '#2563EB' : '#525252',
              transition: 'none',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '22px' }}
            >
              {item.icon}
            </span>
            <span style={{
              fontFamily: 'var(--font-label)',
              fontSize: '9px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginTop: '2px',
            }}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
