'use client';

import React from 'react';
import { useReadingProfile } from '@/app/contexts/ReadingProfileContext';

const CATEGORIES = [
    { id: 'politique', label: 'Politique', emoji: '🏛️' },
    { id: 'économie', label: 'Économie', emoji: '📈' },
    { id: 'technologie', label: 'Technologie', emoji: '💻' },
    { id: 'science', label: 'Science', emoji: '🔬' },
    { id: 'culture', label: 'Culture', emoji: '🎭' },
    { id: 'sport', label: 'Sport', emoji: '⚽' },
    { id: 'international', label: 'International', emoji: '🌍' },
    { id: 'environnement', label: 'Environnement', emoji: '🌱' },
    { id: 'santé', label: 'Santé', emoji: '🏥' },
    { id: 'société', label: 'Société', emoji: '👥' },
];

const PERSONAS = [
    { id: 'le_cynique', label: 'Le Cynique', emoji: '😏', desc: 'Vision critique et décapante' },
    { id: 'l_optimiste', label: 'L\'Optimiste', emoji: '🌟', desc: 'Toujours le bon côté' },
    { id: 'le_conteur', label: 'Le Conteur', emoji: '📖', desc: 'Narration immersive' },
    { id: 'le_satiriste', label: 'Le Satiriste', emoji: '🎪', desc: 'Humour et ironie' },
];

const FONT_SIZES = [
    { id: 'small' as const, label: 'Petit', px: '14px' },
    { id: 'medium' as const, label: 'Normal', px: '16px' },
    { id: 'large' as const, label: 'Grand', px: '18px' },
];

export default function ReadingProfile() {
    const { preferences, updatePreferences, toggleCategory, togglePersona, resetPreferences } = useReadingProfile();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Catégories favorites */}
            <section>
                <h3 style={{
                    fontSize: 16, fontWeight: 600, marginBottom: 12,
                    color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    📂 Catégories favorites
                </h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                    Sélectionnez vos sujets préférés pour personnaliser votre feed.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {CATEGORIES.map(cat => {
                        const active = preferences.favoriteCategories.includes(cat.id);
                        return (
                            <button
                                key={cat.id}
                                onClick={() => toggleCategory(cat.id)}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: 20,
                                    border: active ? '2px solid var(--accent, #6C5CE7)' : '2px solid var(--border, #333)',
                                    background: active ? 'rgba(108, 92, 231, 0.15)' : 'transparent',
                                    color: active ? 'var(--accent, #6C5CE7)' : 'var(--foreground)',
                                    fontSize: 13,
                                    fontWeight: active ? 600 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    minHeight: 44,
                                }}
                            >
                                <span>{cat.emoji}</span>
                                <span>{cat.label}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Personas préférés */}
            <section>
                <h3 style={{
                    fontSize: 16, fontWeight: 600, marginBottom: 12,
                    color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    🎭 Persona par défaut
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {PERSONAS.map(persona => {
                        const active = preferences.preferredPersonas.includes(persona.id);
                        return (
                            <button
                                key={persona.id}
                                onClick={() => togglePersona(persona.id)}
                                style={{
                                    padding: '12px 16px',
                                    borderRadius: 12,
                                    border: active ? '2px solid var(--accent, #6C5CE7)' : '2px solid var(--border, #333)',
                                    background: active ? 'rgba(108, 92, 231, 0.1)' : 'rgba(255,255,255,0.03)',
                                    color: 'var(--foreground)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    textAlign: 'left',
                                    minHeight: 56,
                                }}
                            >
                                <span style={{ fontSize: 24 }}>{persona.emoji}</span>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{persona.label}</div>
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{persona.desc}</div>
                                </div>
                                {active && (
                                    <span style={{ marginLeft: 'auto', color: 'var(--accent, #6C5CE7)', fontSize: 18 }}>✓</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Taille de police */}
            <section>
                <h3 style={{
                    fontSize: 16, fontWeight: 600, marginBottom: 12,
                    color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    🔤 Taille de lecture
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                    {FONT_SIZES.map(size => {
                        const active = preferences.fontSize === size.id;
                        return (
                            <button
                                key={size.id}
                                onClick={() => updatePreferences({ fontSize: size.id })}
                                style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    borderRadius: 12,
                                    border: active ? '2px solid var(--accent, #6C5CE7)' : '2px solid var(--border, #333)',
                                    background: active ? 'rgba(108, 92, 231, 0.1)' : 'transparent',
                                    color: active ? 'var(--accent, #6C5CE7)' : 'var(--foreground)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    fontSize: size.px,
                                    fontWeight: active ? 600 : 400,
                                    minHeight: 48,
                                }}
                            >
                                {size.label}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Fréquence de briefing */}
            <section>
                <h3 style={{
                    fontSize: 16, fontWeight: 600, marginBottom: 12,
                    color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    ⏰ Fréquence de briefing
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                    {[
                        { id: 'daily' as const, label: '1x/jour' },
                        { id: 'twice-daily' as const, label: '2x/jour' },
                        { id: 'weekly' as const, label: 'Hebdo' },
                    ].map(freq => {
                        const active = preferences.briefingFrequency === freq.id;
                        return (
                            <button
                                key={freq.id}
                                onClick={() => updatePreferences({ briefingFrequency: freq.id })}
                                style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    borderRadius: 12,
                                    border: active ? '2px solid var(--accent, #6C5CE7)' : '2px solid var(--border, #333)',
                                    background: active ? 'rgba(108, 92, 231, 0.1)' : 'transparent',
                                    color: active ? 'var(--accent, #6C5CE7)' : 'var(--foreground)',
                                    fontSize: 14,
                                    fontWeight: active ? 600 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    minHeight: 48,
                                }}
                            >
                                {freq.label}
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Notifications */}
            <section>
                <h3 style={{
                    fontSize: 16, fontWeight: 600, marginBottom: 12,
                    color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    🔔 Notifications
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                        { key: 'breaking' as const, label: 'Breaking news', desc: 'Alertes urgentes' },
                        { key: 'dailyBriefing' as const, label: 'Briefing quotidien', desc: 'Résumé du jour' },
                        { key: 'topicAlerts' as const, label: 'Sujets suivis', desc: 'Nouveautés sur vos topics' },
                    ].map(notif => (
                        <label
                            key={notif.key}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                borderRadius: 12,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--border, #333)',
                                cursor: 'pointer',
                                minHeight: 52,
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--foreground)' }}>{notif.label}</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{notif.desc}</div>
                            </div>
                            <div
                                onClick={() =>
                                    updatePreferences({
                                        notifications: { ...preferences.notifications, [notif.key]: !preferences.notifications[notif.key] },
                                    })
                                }
                                style={{
                                    width: 48,
                                    height: 28,
                                    borderRadius: 14,
                                    background: preferences.notifications[notif.key] ? 'var(--accent, #6C5CE7)' : 'var(--border, #444)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 2,
                                    cursor: 'pointer',
                                    transition: 'background 0.2s ease',
                                }}
                            >
                                <div
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        background: 'white',
                                        transition: 'transform 0.2s ease',
                                        transform: preferences.notifications[notif.key] ? 'translateX(20px)' : 'translateX(0)',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                    }}
                                />
                            </div>
                        </label>
                    ))}
                </div>
            </section>

            {/* Reset */}
            <button
                onClick={resetPreferences}
                style={{
                    padding: '12px 20px',
                    borderRadius: 12,
                    border: '1px solid var(--border, #333)',
                    background: 'transparent',
                    color: 'var(--muted)',
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginTop: 8,
                    minHeight: 48,
                }}
            >
                🔄 Réinitialiser les préférences
            </button>
        </div>
    );
}
