'use client';

import React from 'react';
import ReadingProfile from '@/app/components/settings/ReadingProfile';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
    return (
        <div style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '24px 16px 100px',
        }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <h1 style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                }}>
                    ⚙️ Réglages
                </h1>
                <p style={{
                    fontSize: 14,
                    color: 'var(--muted)',
                    lineHeight: 1.5,
                }}>
                    Personnalisez votre expérience NovaPress.
                </p>
            </div>

            {/* Profil de lecture */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border, #333)',
                borderRadius: 16,
                padding: 20,
                backdropFilter: 'blur(10px)',
            }}>
                <ReadingProfile />
            </div>

            {/* About */}
            <div style={{
                marginTop: 32,
                padding: 20,
                borderRadius: 16,
                background: 'rgba(108, 92, 231, 0.05)',
                border: '1px solid rgba(108, 92, 231, 0.15)',
                textAlign: 'center',
            }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🧠</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--foreground)' }}>
                    NovaPress AI v2
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    L&apos;intelligence artificielle au service de l&apos;information.
                </div>
            </div>
        </div>
    );
}
