'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ─── Types ───

export interface ReadingPreferences {
    favoriteCategories: string[];
    preferredPersonas: string[];
    briefingFrequency: 'daily' | 'twice-daily' | 'weekly';
    darkModePreference: 'system' | 'dark' | 'light';
    fontSize: 'small' | 'medium' | 'large';
    notifications: {
        breaking: boolean;
        dailyBriefing: boolean;
        topicAlerts: boolean;
    };
}

interface ReadingProfileContextType {
    preferences: ReadingPreferences;
    updatePreferences: (updates: Partial<ReadingPreferences>) => void;
    toggleCategory: (category: string) => void;
    togglePersona: (persona: string) => void;
    resetPreferences: () => void;
}

// ─── Defaults ───

const DEFAULT_PREFERENCES: ReadingPreferences = {
    favoriteCategories: [],
    preferredPersonas: ['le_conteur'],
    briefingFrequency: 'daily',
    darkModePreference: 'system',
    fontSize: 'medium',
    notifications: {
        breaking: true,
        dailyBriefing: true,
        topicAlerts: false,
    },
};

const STORAGE_KEY = 'novapress-reading-profile';

// ─── Context ───

const ReadingProfileContext = createContext<ReadingProfileContextType | undefined>(undefined);

export function ReadingProfileProvider({ children }: { children: ReactNode }) {
    const [preferences, setPreferences] = useState<ReadingPreferences>(DEFAULT_PREFERENCES);
    const [loaded, setLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
            }
        } catch (e) {
            console.warn('Failed to load reading preferences:', e);
        }
        setLoaded(true);
    }, []);

    // Persist to localStorage on change
    useEffect(() => {
        if (loaded) {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
            } catch (e) {
                console.warn('Failed to save reading preferences:', e);
            }
        }
    }, [preferences, loaded]);

    const updatePreferences = useCallback((updates: Partial<ReadingPreferences>) => {
        setPreferences(prev => ({ ...prev, ...updates }));
    }, []);

    const toggleCategory = useCallback((category: string) => {
        setPreferences(prev => {
            const cats = prev.favoriteCategories.includes(category)
                ? prev.favoriteCategories.filter(c => c !== category)
                : [...prev.favoriteCategories, category];
            return { ...prev, favoriteCategories: cats };
        });
    }, []);

    const togglePersona = useCallback((persona: string) => {
        setPreferences(prev => {
            const personas = prev.preferredPersonas.includes(persona)
                ? prev.preferredPersonas.filter(p => p !== persona)
                : [...prev.preferredPersonas, persona];
            return { ...prev, preferredPersonas: personas };
        });
    }, []);

    const resetPreferences = useCallback(() => {
        setPreferences(DEFAULT_PREFERENCES);
    }, []);

    return (
        <ReadingProfileContext.Provider
            value={{ preferences, updatePreferences, toggleCategory, togglePersona, resetPreferences }}
        >
            {children}
        </ReadingProfileContext.Provider>
    );
}

export function useReadingProfile() {
    const ctx = useContext(ReadingProfileContext);
    if (!ctx) throw new Error('useReadingProfile must be used within ReadingProfileProvider');
    return ctx;
}
