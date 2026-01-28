/**
 * Gamification System for NovaPress AI
 * Tracks reading streaks, points, and badges using localStorage
 * No backend required - works offline
 */

// Types
export interface UserProgress {
  points: number;
  streak: number;
  lastReadDate: string | null;  // ISO date string
  articlesRead: number;
  synthesisRead: string[];  // List of synthesis IDs read
  badges: string[];
  level: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  unlocked: boolean;
}

// Constants
const STORAGE_KEY = 'novapress_gamification';
const POINTS_PER_SYNTHESIS = 10;
const POINTS_PER_SHARE = 25;
const POINTS_PER_STREAK_DAY = 5;
const POINTS_PER_LEVEL = 100;

// Badge definitions
export const BADGES: Badge[] = [
  {
    id: 'first_read',
    name: 'Premier Pas',
    description: 'Lire votre première synthèse',
    icon: '📖',
    requirement: '1 synthèse lue',
    unlocked: false,
  },
  {
    id: 'streak_3',
    name: 'Régulier',
    description: 'Maintenir un streak de 3 jours',
    icon: '🔥',
    requirement: '3 jours consécutifs',
    unlocked: false,
  },
  {
    id: 'streak_7',
    name: 'Habitué',
    description: 'Maintenir un streak de 7 jours',
    icon: '⚡',
    requirement: '7 jours consécutifs',
    unlocked: false,
  },
  {
    id: 'streak_30',
    name: 'Incollable',
    description: 'Maintenir un streak de 30 jours',
    icon: '🏆',
    requirement: '30 jours consécutifs',
    unlocked: false,
  },
  {
    id: 'reader_10',
    name: 'Lecteur Assidu',
    description: 'Lire 10 synthèses',
    icon: '📚',
    requirement: '10 synthèses lues',
    unlocked: false,
  },
  {
    id: 'reader_50',
    name: 'Expert',
    description: 'Lire 50 synthèses',
    icon: '🎓',
    requirement: '50 synthèses lues',
    unlocked: false,
  },
  {
    id: 'reader_100',
    name: 'Maître',
    description: 'Lire 100 synthèses',
    icon: '👑',
    requirement: '100 synthèses lues',
    unlocked: false,
  },
  {
    id: 'level_5',
    name: 'Niveau 5',
    description: 'Atteindre le niveau 5',
    icon: '⭐',
    requirement: 'Niveau 5',
    unlocked: false,
  },
  {
    id: 'level_10',
    name: 'Niveau 10',
    description: 'Atteindre le niveau 10',
    icon: '🌟',
    requirement: 'Niveau 10',
    unlocked: false,
  },
];

// Helper functions
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function isYesterday(dateStr: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateStr === yesterday.toISOString().split('T')[0];
}

function isToday(dateStr: string): boolean {
  return dateStr === getToday();
}

// Main functions
export function getProgress(): UserProgress {
  if (typeof window === 'undefined') {
    return getDefaultProgress();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.error('Failed to load gamification data');
  }

  return getDefaultProgress();
}

function getDefaultProgress(): UserProgress {
  return {
    points: 0,
    streak: 0,
    lastReadDate: null,
    articlesRead: 0,
    synthesisRead: [],
    badges: [],
    level: 1,
  };
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    console.error('Failed to save gamification data');
  }
}

export function recordSynthesisRead(synthesisId: string): {
  pointsEarned: number;
  newBadges: Badge[];
  levelUp: boolean;
} {
  const progress = getProgress();
  let pointsEarned = 0;
  const newBadges: Badge[] = [];
  let levelUp = false;

  // Check if already read
  if (progress.synthesisRead.includes(synthesisId)) {
    return { pointsEarned: 0, newBadges: [], levelUp: false };
  }

  // Add synthesis to read list
  progress.synthesisRead.push(synthesisId);
  progress.articlesRead += 1;

  // Award points
  pointsEarned += POINTS_PER_SYNTHESIS;

  // Update streak
  const today = getToday();
  if (progress.lastReadDate) {
    if (isYesterday(progress.lastReadDate)) {
      // Continue streak
      progress.streak += 1;
      pointsEarned += POINTS_PER_STREAK_DAY * progress.streak;
    } else if (!isToday(progress.lastReadDate)) {
      // Streak broken
      progress.streak = 1;
    }
    // If read today already, streak stays the same
  } else {
    // First time reading
    progress.streak = 1;
  }

  progress.lastReadDate = today;
  progress.points += pointsEarned;

  // Calculate new level
  const newLevel = Math.floor(progress.points / POINTS_PER_LEVEL) + 1;
  if (newLevel > progress.level) {
    progress.level = newLevel;
    levelUp = true;
  }

  // Check for new badges
  const earnedBadges = checkBadges(progress);
  for (const badge of earnedBadges) {
    if (!progress.badges.includes(badge.id)) {
      progress.badges.push(badge.id);
      newBadges.push(badge);
    }
  }

  saveProgress(progress);

  return { pointsEarned, newBadges, levelUp };
}

export function recordShare(): number {
  const progress = getProgress();
  progress.points += POINTS_PER_SHARE;
  saveProgress(progress);
  return POINTS_PER_SHARE;
}

function checkBadges(progress: UserProgress): Badge[] {
  const earned: Badge[] = [];

  // First read
  if (progress.articlesRead >= 1) {
    earned.push(BADGES.find(b => b.id === 'first_read')!);
  }

  // Streak badges
  if (progress.streak >= 3) {
    earned.push(BADGES.find(b => b.id === 'streak_3')!);
  }
  if (progress.streak >= 7) {
    earned.push(BADGES.find(b => b.id === 'streak_7')!);
  }
  if (progress.streak >= 30) {
    earned.push(BADGES.find(b => b.id === 'streak_30')!);
  }

  // Reader badges
  if (progress.articlesRead >= 10) {
    earned.push(BADGES.find(b => b.id === 'reader_10')!);
  }
  if (progress.articlesRead >= 50) {
    earned.push(BADGES.find(b => b.id === 'reader_50')!);
  }
  if (progress.articlesRead >= 100) {
    earned.push(BADGES.find(b => b.id === 'reader_100')!);
  }

  // Level badges
  if (progress.level >= 5) {
    earned.push(BADGES.find(b => b.id === 'level_5')!);
  }
  if (progress.level >= 10) {
    earned.push(BADGES.find(b => b.id === 'level_10')!);
  }

  return earned.filter(Boolean);
}

export function getBadgesWithStatus(): Badge[] {
  const progress = getProgress();
  return BADGES.map(badge => ({
    ...badge,
    unlocked: progress.badges.includes(badge.id),
  }));
}

export function resetProgress(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
