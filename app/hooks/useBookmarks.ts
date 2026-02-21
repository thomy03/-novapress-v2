'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'novapress_bookmarks';

interface BookmarkedSynthesis {
  id: string;
  title: string;
  category?: string;
  transparencyScore?: number;
  savedAt: string;
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkedSynthesis[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setBookmarks(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const save = (data: BookmarkedSynthesis[]) => {
    setBookmarks(data);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  };

  const addBookmark = useCallback((synthesis: Omit<BookmarkedSynthesis, 'savedAt'>) => {
    setBookmarks(prev => {
      if (prev.some(b => b.id === synthesis.id)) return prev;
      const updated = [{ ...synthesis, savedAt: new Date().toISOString() }, ...prev];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks(prev => {
      const updated = prev.filter(b => b.id !== id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const isBookmarked = useCallback((id: string) => {
    return bookmarks.some(b => b.id === id);
  }, [bookmarks]);

  return { bookmarks, addBookmark, removeBookmark, isBookmarked };
}
