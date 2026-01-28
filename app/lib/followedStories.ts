/**
 * Followed Stories Service for NovaPress AI
 * Allows users to follow specific stories and receive updates
 * Uses localStorage and integrates with TNA for narrative updates
 */

export interface FollowedStory {
  synthesisId: string;
  title: string;
  category: string;
  followedAt: string;  // ISO date
  lastChecked: string;  // ISO date
  lastUpdated?: string;  // ISO date of last synthesis update
  narrativePhase?: 'emerging' | 'developing' | 'peak' | 'declining' | 'resolved';
  notifyOnUpdate: boolean;
}

const STORAGE_KEY = 'novapress_followed_stories';
const MAX_FOLLOWED = 20;  // Limit to prevent bloat

// Get all followed stories
export function getFollowedStories(): FollowedStory[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.error('Failed to load followed stories');
  }

  return [];
}

// Save followed stories
function saveFollowedStories(stories: FollowedStory[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
  } catch {
    console.error('Failed to save followed stories');
  }
}

// Check if a story is followed
export function isStoryFollowed(synthesisId: string): boolean {
  const stories = getFollowedStories();
  return stories.some(s => s.synthesisId === synthesisId);
}

// Follow a story
export function followStory(
  synthesisId: string,
  title: string,
  category: string,
  narrativePhase?: string
): boolean {
  const stories = getFollowedStories();

  // Check if already following
  if (stories.some(s => s.synthesisId === synthesisId)) {
    return false;
  }

  // Check limit
  if (stories.length >= MAX_FOLLOWED) {
    // Remove oldest story
    stories.sort((a, b) => new Date(a.followedAt).getTime() - new Date(b.followedAt).getTime());
    stories.shift();
  }

  const now = new Date().toISOString();
  const newStory: FollowedStory = {
    synthesisId,
    title: title.length > 100 ? title.substring(0, 97) + '...' : title,
    category,
    followedAt: now,
    lastChecked: now,
    narrativePhase: narrativePhase as FollowedStory['narrativePhase'],
    notifyOnUpdate: true,
  };

  stories.push(newStory);
  saveFollowedStories(stories);

  return true;
}

// Unfollow a story
export function unfollowStory(synthesisId: string): boolean {
  const stories = getFollowedStories();
  const index = stories.findIndex(s => s.synthesisId === synthesisId);

  if (index === -1) return false;

  stories.splice(index, 1);
  saveFollowedStories(stories);

  return true;
}

// Toggle follow status
export function toggleFollowStory(
  synthesisId: string,
  title: string,
  category: string,
  narrativePhase?: string
): boolean {
  if (isStoryFollowed(synthesisId)) {
    unfollowStory(synthesisId);
    return false;
  } else {
    followStory(synthesisId, title, category, narrativePhase);
    return true;
  }
}

// Update story's last checked timestamp
export function markStoryChecked(synthesisId: string): void {
  const stories = getFollowedStories();
  const story = stories.find(s => s.synthesisId === synthesisId);

  if (story) {
    story.lastChecked = new Date().toISOString();
    saveFollowedStories(stories);
  }
}

// Update story's narrative phase
export function updateStoryPhase(
  synthesisId: string,
  phase: FollowedStory['narrativePhase'],
  lastUpdated?: string
): void {
  const stories = getFollowedStories();
  const story = stories.find(s => s.synthesisId === synthesisId);

  if (story) {
    story.narrativePhase = phase;
    if (lastUpdated) {
      story.lastUpdated = lastUpdated;
    }
    saveFollowedStories(stories);
  }
}

// Toggle notification preference for a story
export function toggleStoryNotifications(synthesisId: string): boolean {
  const stories = getFollowedStories();
  const story = stories.find(s => s.synthesisId === synthesisId);

  if (story) {
    story.notifyOnUpdate = !story.notifyOnUpdate;
    saveFollowedStories(stories);
    return story.notifyOnUpdate;
  }

  return false;
}

// Get stories that need updates checked (not checked in last hour)
export function getStoriesNeedingUpdate(): FollowedStory[] {
  const stories = getFollowedStories();
  const oneHourAgo = Date.now() - (60 * 60 * 1000);

  return stories.filter(s => {
    const lastChecked = new Date(s.lastChecked).getTime();
    return lastChecked < oneHourAgo;
  });
}

// Get count of followed stories
export function getFollowedStoriesCount(): number {
  return getFollowedStories().length;
}

// Clear all followed stories
export function clearFollowedStories(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
