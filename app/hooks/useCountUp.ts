/**
 * UI-003a: useCountUp Hook
 * Custom hook pour animation count-up avec IntersectionObserver
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// SSR guard - check if we're in browser
const isBrowser = typeof window !== 'undefined';

interface UseCountUpOptions {
  /** Valeur finale */
  end: number;
  /** Valeur initiale (défaut: 0) */
  start?: number;
  /** Durée de l'animation en ms (défaut: 2000) */
  duration?: number;
  /** Fonction d'easing (défaut: easeOutExpo) */
  easing?: (t: number) => number;
  /** Nombre de décimales (défaut: 0) */
  decimals?: number;
  /** Délai avant démarrage en ms */
  delay?: number;
  /** Déclencher au scroll (IntersectionObserver) */
  enableScrollTrigger?: boolean;
  /** Seuil de visibilité pour trigger (0-1) */
  threshold?: number;
}

interface UseCountUpReturn {
  /** Valeur actuelle animée */
  value: number;
  /** Valeur formatée en string */
  formattedValue: string;
  /** Référence à attacher à l'élément */
  ref: React.RefObject<HTMLElement>;
  /** Animation terminée */
  isComplete: boolean;
  /** Redémarrer l'animation */
  reset: () => void;
}

// Fonction d'easing par défaut (easeOutExpo)
const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

export function useCountUp({
  end,
  start = 0,
  duration = 2000,
  easing = easeOutExpo,
  decimals = 0,
  delay = 0,
  enableScrollTrigger = true,
  threshold = 0.3,
}: UseCountUpOptions): UseCountUpReturn {
  const [value, setValue] = useState(start);
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const animationRef = useRef<number | null>(null);

  // Format value with decimals
  const formattedValue = value.toFixed(decimals);

  // Animation function (browser only)
  const animate = useCallback(() => {
    // Skip animation on server - just set final value
    if (!isBrowser) {
      setValue(end);
      setIsComplete(true);
      return;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = performance.now();
    const startValue = start;
    const endValue = end;

    const tick = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      const currentValue = startValue + (endValue - startValue) * easedProgress;

      setValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      } else {
        setValue(endValue);
        setIsComplete(true);
      }
    };

    animationRef.current = requestAnimationFrame(tick);
  }, [start, end, duration, easing]);

  // Start animation with optional delay
  const startAnimation = useCallback(() => {
    if (hasStarted) return;
    setHasStarted(true);

    if (delay > 0) {
      setTimeout(animate, delay);
    } else {
      animate();
    }
  }, [hasStarted, delay, animate]);

  // Reset animation
  const reset = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setValue(start);
    setIsComplete(false);
    setHasStarted(false);
  }, [start]);

  // IntersectionObserver for scroll trigger (browser only)
  useEffect(() => {
    // Skip on server
    if (!isBrowser) return;

    if (!enableScrollTrigger) {
      startAnimation();
      return;
    }

    const element = ref.current;
    if (!element) return;

    // Check if IntersectionObserver is available
    if (!('IntersectionObserver' in window)) {
      startAnimation();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStarted) {
            startAnimation();
          }
        });
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enableScrollTrigger, threshold, hasStarted, startAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    value,
    formattedValue,
    ref: ref as React.RefObject<HTMLElement>,
    isComplete,
    reset,
  };
}

export default useCountUp;
