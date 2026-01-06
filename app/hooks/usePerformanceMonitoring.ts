"use client";

import { useEffect, useState, useCallback } from 'react';

interface PerformanceMetrics {
  fcp: number | null; // First Contentful Paint
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift
  ttfb: number | null; // Time to First Byte
  domContentLoaded: number | null;
  windowLoad: number | null;
}

interface ResourceTiming {
  name: string;
  duration: number;
  size: number;
  type: string;
}

export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fcp: null,
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    domContentLoaded: null,
    windowLoad: null
  });
  
  const [resourceTimings, setResourceTimings] = useState<ResourceTiming[]>([]);
  const [isSupported, setIsSupported] = useState(false);

  // Collect Core Web Vitals
  const collectCoreWebVitals = useCallback(() => {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return;
    }

    setIsSupported(true);

    // Collect Navigation Timing metrics
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      setMetrics(prev => ({
        ...prev,
        ttfb: navigation.responseStart - navigation.requestStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        windowLoad: navigation.loadEventEnd - navigation.fetchStart
      }));
    }

    // First Contentful Paint (FCP)
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    if (fcpEntry) {
      setMetrics(prev => ({ ...prev, fcp: fcpEntry.startTime }));
    }

    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }));
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay (FID)
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            setMetrics(prev => ({ ...prev, fid: entry.processingStart - entry.startTime }));
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift (CLS)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              setMetrics(prev => ({ ...prev, cls: clsValue }));
            }
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // Cleanup observers on unmount
        return () => {
          lcpObserver.disconnect();
          fidObserver.disconnect();
          clsObserver.disconnect();
        };
      } catch (error) {
        console.warn('Performance Observer not fully supported:', error);
      }
    }
  }, []);

  // Collect Resource Timing data
  const collectResourceTimings = useCallback(() => {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return;
    }

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const resourceData: ResourceTiming[] = resources.map(resource => ({
      name: resource.name,
      duration: resource.duration,
      size: resource.transferSize || 0,
      type: getResourceType(resource.name)
    }));

    setResourceTimings(resourceData);
  }, []);

  // Get resource type from URL
  const getResourceType = (url: string): string => {
    if (url.includes('.css')) return 'CSS';
    if (url.includes('.js')) return 'JavaScript';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'Image';
    if (url.includes('font') || url.match(/\.(woff|woff2|ttf|otf)$/)) return 'Font';
    if (url.includes('api/')) return 'API';
    return 'Other';
  };

  // Calculate performance score (0-100)
  const getPerformanceScore = useCallback((): number => {
    if (!metrics.fcp || !metrics.lcp || !metrics.cls) {
      return 0;
    }

    let score = 100;
    
    // FCP scoring (Good: <1.8s, Needs Improvement: 1.8s-3s, Poor: >3s)
    if (metrics.fcp > 3000) score -= 25;
    else if (metrics.fcp > 1800) score -= 10;
    
    // LCP scoring (Good: <2.5s, Needs Improvement: 2.5s-4s, Poor: >4s)
    if (metrics.lcp > 4000) score -= 25;
    else if (metrics.lcp > 2500) score -= 10;
    
    // CLS scoring (Good: <0.1, Needs Improvement: 0.1-0.25, Poor: >0.25)
    if (metrics.cls > 0.25) score -= 25;
    else if (metrics.cls > 0.1) score -= 10;
    
    // FID scoring (Good: <100ms, Needs Improvement: 100ms-300ms, Poor: >300ms)
    if (metrics.fid) {
      if (metrics.fid > 300) score -= 25;
      else if (metrics.fid > 100) score -= 10;
    }

    return Math.max(0, score);
  }, [metrics]);

  // Send analytics (replace with your analytics service)
  const sendAnalytics = useCallback((data: any) => {
    if (process.env.NODE_ENV === 'production') {
      // Example: Google Analytics, Mixpanel, etc.
      console.log('Analytics data:', data);
      
      // You can integrate with services like:
      // gtag('event', 'page_load_metrics', data);
      // mixpanel.track('page_load_metrics', data);
    }
  }, []);

  // Get bundle analysis
  const getBundleAnalysis = useCallback(() => {
    const jsResources = resourceTimings.filter(r => r.type === 'JavaScript');
    const cssResources = resourceTimings.filter(r => r.type === 'CSS');
    const imageResources = resourceTimings.filter(r => r.type === 'Image');
    
    return {
      totalJSSize: jsResources.reduce((sum, r) => sum + r.size, 0),
      totalCSSSize: cssResources.reduce((sum, r) => sum + r.size, 0),
      totalImageSize: imageResources.reduce((sum, r) => sum + r.size, 0),
      jsCount: jsResources.length,
      cssCount: cssResources.length,
      imageCount: imageResources.length,
      slowestResources: resourceTimings
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
    };
  }, [resourceTimings]);

  useEffect(() => {
    // Wait for page load to collect initial metrics
    if (document.readyState === 'complete') {
      collectCoreWebVitals();
      collectResourceTimings();
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => {
          collectCoreWebVitals();
          collectResourceTimings();
        }, 0);
      });
    }
  }, [collectCoreWebVitals, collectResourceTimings]);

  // Send analytics after metrics are collected
  useEffect(() => {
    if (metrics.fcp && metrics.lcp) {
      const analyticsData = {
        ...metrics,
        performanceScore: getPerformanceScore(),
        userAgent: navigator.userAgent,
        connectionType: (navigator as any).connection?.effectiveType || 'unknown',
        timestamp: Date.now()
      };
      
      sendAnalytics(analyticsData);
    }
  }, [metrics, getPerformanceScore, sendAnalytics]);

  return {
    metrics,
    resourceTimings,
    isSupported,
    performanceScore: getPerformanceScore(),
    bundleAnalysis: getBundleAnalysis(),
    collectResourceTimings
  };
}