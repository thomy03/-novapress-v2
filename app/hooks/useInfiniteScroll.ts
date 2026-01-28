"use client";

import { useEffect, useCallback, useRef } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  hasNextPage: boolean;
  isFetching: boolean;
  fetchNextPage: () => void;
}

export function useInfiniteScroll({
  threshold = 100,
  rootMargin = '0px',
  hasNextPage,
  isFetching,
  fetchNextPage
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetching) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetching, fetchNextPage]
  );

  useEffect(() => {
    const currentRef = loadingRef.current;
    
    if (currentRef) {
      observerRef.current = new IntersectionObserver(handleIntersection, {
        rootMargin,
        threshold: 0.1
      });
      
      observerRef.current.observe(currentRef);
    }

    return () => {
      if (observerRef.current && currentRef) {
        observerRef.current.unobserve(currentRef);
      }
    };
  }, [handleIntersection, rootMargin]);

  // REF-005: Removed fallback scroll listener
  // IntersectionObserver has 98%+ browser support in 2026
  // The dual observer pattern was causing race conditions and double-fetches

  return { loadingRef };
}