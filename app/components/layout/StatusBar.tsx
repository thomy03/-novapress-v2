'use client';

/**
 * StatusBar - Terminal-style status bar: "PARIS | HH:MM | DAY | LIVE●"
 * Intelligence Terminal design
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/app/contexts/ThemeContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const DAYS_FR = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];

interface StatusStats {
  synthesisCount: number;
  sourceCount: number;
  isActive: boolean;
}

export function StatusBar() {
  const { theme, darkMode } = useTheme();
  const [stats, setStats] = useState<StatusStats>({
    synthesisCount: 0,
    sourceCount: 53,
    isActive: false,
  });
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [liveCountRes, statusRes] = await Promise.allSettled([
          fetch(`${API_URL}/api/trending/live-count?hours=24`),
          fetch(`${API_URL}/api/admin/status`),
        ]);

        let synthesisCount = 0;
        let sourceCount = 53;
        let isActive = false;

        if (liveCountRes.status === 'fulfilled' && liveCountRes.value.ok) {
          const data = await liveCountRes.value.json();
          synthesisCount = data.count || 0;
        }

        if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
          const data = await statusRes.value.json();
          isActive = data.is_running || false;
          sourceCount = data.sources_count || 53;
        }

        setStats({ synthesisCount, sourceCount, isActive });
      } catch {
        // Keep defaults
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-label)',
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
  };

  const timeStr = time
    ? time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const dayStr = time ? DAYS_FR[time.getDay()] : '---';

  return (
    <div
      className="status-bar-desktop"
      style={{
        backgroundColor: darkMode ? '#0E0E0E' : '#0A0A0A',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '6px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        zIndex: 60,
      }}
    >
      {/* Left: Location + Time + Day + LIVE */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        ...labelStyle,
        color: 'rgba(229, 226, 225, 0.5)',
      }}>
        <span>PARIS | {timeStr} | {dayStr}</span>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#DC2626',
          fontWeight: 700,
        }}>
          LIVE
          <span
            className="terminal-pulse"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#DC2626',
            }}
          />
        </span>
      </div>

      {/* Right: Status + Sources */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        ...labelStyle,
        color: 'rgba(229, 226, 225, 0.5)',
      }}>
        <span>
          STATUS:{' '}
          <span style={{ color: stats.isActive ? '#10B981' : '#4CD7F6' }}>
            {stats.isActive ? 'ACTIVE' : 'OPTIMAL'}
          </span>
        </span>
        <span>{stats.sourceCount} SOURCES ACTIVE</span>
      </div>
    </div>
  );
}

export default StatusBar;
