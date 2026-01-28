/**
 * Push Notifications Service for NovaPress AI
 * Handles notification permissions and delivery
 * Uses Web Notifications API with localStorage preferences
 */

// Types
export interface NotificationPreferences {
  enabled: boolean;
  breakingNews: boolean;
  dailyDigest: boolean;
  newSyntheses: boolean;
  followedTopics: string[];
  maxPerDay: number;
  quietHours: {
    enabled: boolean;
    start: string;  // "22:00"
    end: string;    // "08:00"
  };
}

interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  url?: string;
  scheduledFor: number;  // timestamp
  type: 'breaking' | 'synthesis' | 'digest';
}

// Constants
const PREFS_KEY = 'novapress_notification_prefs';
const SENT_KEY = 'novapress_notifications_sent';
const QUEUE_KEY = 'novapress_notification_queue';

// Default preferences
const DEFAULT_PREFS: NotificationPreferences = {
  enabled: false,
  breakingNews: true,
  dailyDigest: true,
  newSyntheses: false,
  followedTopics: [],
  maxPerDay: 5,
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '08:00',
  },
};

// Check if notifications are supported
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return 'denied';
  }
}

// Get user preferences
export function getNotificationPrefs(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;

  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
    }
  } catch {
    console.error('Failed to load notification preferences');
  }

  return DEFAULT_PREFS;
}

// Save user preferences
export function saveNotificationPrefs(prefs: Partial<NotificationPreferences>): void {
  if (typeof window === 'undefined') return;

  try {
    const current = getNotificationPrefs();
    const updated = { ...current, ...prefs };
    localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
  } catch {
    console.error('Failed to save notification preferences');
  }
}

// Check if we're in quiet hours
function isQuietHours(): boolean {
  const prefs = getNotificationPrefs();
  if (!prefs.quietHours.enabled) return false;

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const start = prefs.quietHours.start;
  const end = prefs.quietHours.end;

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }

  return currentTime >= start && currentTime < end;
}

// Get today's sent notification count
function getTodaySentCount(): number {
  if (typeof window === 'undefined') return 0;

  try {
    const stored = localStorage.getItem(SENT_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const today = new Date().toISOString().split('T')[0];
      if (data.date === today) {
        return data.count;
      }
    }
  } catch {
    // Ignore
  }

  return 0;
}

// Increment sent count
function incrementSentCount(): void {
  if (typeof window === 'undefined') return;

  const today = new Date().toISOString().split('T')[0];
  const currentCount = getTodaySentCount();

  localStorage.setItem(SENT_KEY, JSON.stringify({
    date: today,
    count: currentCount + 1,
  }));
}

// Check if we can send a notification
export function canSendNotification(): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const prefs = getNotificationPrefs();
  if (!prefs.enabled) return false;
  if (isQuietHours()) return false;
  if (getTodaySentCount() >= prefs.maxPerDay) return false;

  return true;
}

// Send a notification
export async function sendNotification(
  title: string,
  body: string,
  options?: {
    type?: 'breaking' | 'synthesis' | 'digest';
    url?: string;
    icon?: string;
    tag?: string;
    requireInteraction?: boolean;
  }
): Promise<boolean> {
  if (!canSendNotification()) return false;

  const prefs = getNotificationPrefs();

  // Check type preferences
  if (options?.type === 'breaking' && !prefs.breakingNews) return false;
  if (options?.type === 'synthesis' && !prefs.newSyntheses) return false;
  if (options?.type === 'digest' && !prefs.dailyDigest) return false;

  try {
    const notification = new Notification(title, {
      body,
      icon: options?.icon || '/favicon.ico',
      tag: options?.tag || `novapress-${Date.now()}`,
      requireInteraction: options?.requireInteraction ?? false,
      badge: '/icon-192.png',
    });

    // Handle click
    if (options?.url) {
      notification.onclick = () => {
        window.focus();
        window.location.href = options.url!;
        notification.close();
      };
    }

    incrementSentCount();
    return true;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}

// Send breaking news notification
export async function sendBreakingNewsNotification(
  title: string,
  synthesisId: string
): Promise<boolean> {
  return sendNotification(
    '🔴 BREAKING NEWS',
    title,
    {
      type: 'breaking',
      url: `/synthesis/${synthesisId}`,
      requireInteraction: true,
      tag: `breaking-${synthesisId}`,
    }
  );
}

// Send new synthesis notification
export async function sendNewSynthesisNotification(
  title: string,
  category: string,
  synthesisId: string
): Promise<boolean> {
  const prefs = getNotificationPrefs();

  // Check if topic is followed
  if (prefs.followedTopics.length > 0) {
    const isFollowed = prefs.followedTopics.some(
      topic => category.toLowerCase().includes(topic.toLowerCase())
    );
    if (!isFollowed) return false;
  }

  return sendNotification(
    `📰 Nouvelle synthèse: ${category}`,
    title.length > 100 ? title.substring(0, 97) + '...' : title,
    {
      type: 'synthesis',
      url: `/synthesis/${synthesisId}`,
      tag: `synthesis-${synthesisId}`,
    }
  );
}

// Initialize notification service (call on app mount)
export function initializeNotifications(): void {
  if (!isNotificationSupported()) return;

  // Check if service worker is supported for background notifications
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('Service worker registration skipped:', err);
    });
  }
}
