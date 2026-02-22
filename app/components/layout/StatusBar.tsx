'use client';

/**
 * StatusBar - Terminal-style status bar showing live system stats
 * Displays synthesis count, source count, and last update time
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/app/contexts/ThemeContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface StatusStats {
  synthesisCount: number;
  sourceCount: number;
  lastUpdate: string;
  isActive: boolean;
}

export function StatusBar() {
  const { theme, darkMode } = useTheme();
  const [stats, setStats] = useState<StatusStats>({
    synthesisCount: 0,
    sourceCount: 0,
    lastUpdate: '--:--',
    isActive: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Try to get stats from trending API (no auth required)
        const [liveCountRes, statusRes] = await Promise.allSettled([
          fetch(`${API_URL}/api/trending/live-count?hours=24`),
          fetch(`${API_URL}/api/admin/status`),
        ]);

        let synthesisCount = 0;
        let sourceCount = 0;
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

        const now = new Date();
        const timeStr = now.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        });

        setStats({
          synthesisCount,
          sourceCount: sourceCount || 53, // Fallback to known source count
          lastUpdate: timeStr,
          isActive,
        });
      } catch (err) {
        console.error('Failed to fetch status stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Terminal-style colors
  const terminalBg = darkMode ? '#111827' : '#1F2937';
  const terminalText = darkMode ? '#9CA3AF' : '#D1D5DB';
  const activeGreen = '#10B981';

  return (
    <div
      className="status-bar-desktop"
      style={{
        backgroundColor: terminalBg,
        borderBottom: `1px solid ${darkMode ? '#1F2937' : '#374151'}`,
        padding: '8px 24px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '24px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '12px',
        color: terminalText,
      }}
    >
      {/* System status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: stats.isActive ? activeGreen : '#6B7280',
            boxShadow: stats.isActive ? `0 0 8px ${activeGreen}` : 'none',
            animation: stats.isActive ? 'statusPulse 2s ease-in-out infinite' : 'none',
          }}
        />
        <span style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
          {loading ? 'LOADING...' : stats.isActive ? 'PIPELINE ACTIVE' : 'SYSTEM READY'}
        </span>
      </div>

      {/* Separator */}
      <span style={{ color: '#4B5563' }}>|</span>

      {/* Synthesis count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#FBBF24' }}>&#9889;</span>
        <span>
          <strong style={{ color: '#E5E5E5' }}>{stats.synthesisCount}</strong> synthèses/24h
        </span>
      </div>

      {/* Separator */}
      <span style={{ color: '#4B5563' }}>|</span>

      {/* Source count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#60A5FA' }}>&#128065;</span>
        <span>
          <strong style={{ color: '#E5E5E5' }}>{stats.sourceCount}</strong> sources
        </span>
      </div>

      {/* Separator */}
      <span style={{ color: '#4B5563' }}>|</span>

      {/* Time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#A78BFA' }}>&#128337;</span>
        <span>{stats.lastUpdate}</span>
      </div>
    </div>
  );
}

export default StatusBar;
