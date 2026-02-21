'use client';

import React, { useState, useRef, useCallback, useEffect, ReactNode } from 'react';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: ReactNode;
    threshold?: number;
    disabled?: boolean;
}

export default function PullToRefresh({
    onRefresh,
    children,
    threshold = 80,
    disabled = false,
}: PullToRefreshProps) {
    const [pulling, setPulling] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const startYRef = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const isAtTop = useCallback(() => {
        if (!containerRef.current) return true;
        return window.scrollY <= 0;
    }, []);

    const handleTouchStart = useCallback(
        (e: TouchEvent) => {
            if (disabled || refreshing || !isAtTop()) return;
            startYRef.current = e.touches[0].clientY;
            setPulling(true);
        },
        [disabled, refreshing, isAtTop]
    );

    const handleTouchMove = useCallback(
        (e: TouchEvent) => {
            if (!pulling || disabled || refreshing) return;
            const currentY = e.touches[0].clientY;
            const diff = currentY - startYRef.current;

            if (diff > 0) {
                // Dampen the pull (feels more natural)
                const dampened = Math.min(diff * 0.5, threshold * 1.5);
                setPullDistance(dampened);
            }
        },
        [pulling, disabled, refreshing, threshold]
    );

    const handleTouchEnd = useCallback(async () => {
        if (!pulling || disabled) return;
        setPulling(false);

        if (pullDistance >= threshold) {
            setRefreshing(true);
            setPullDistance(threshold * 0.75);

            try {
                await onRefresh();
            } catch (e) {
                console.error('Refresh failed:', e);
            }

            setRefreshing(false);
        }

        setPullDistance(0);
    }, [pulling, disabled, pullDistance, threshold, onRefresh]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchmove', handleTouchMove, { passive: true });
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    const progress = Math.min(pullDistance / threshold, 1);
    const rotation = progress * 360;

    return (
        <div ref={containerRef} style={{ position: 'relative', minHeight: '100%' }}>
            {/* Pull indicator */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${pullDistance}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    transition: pulling ? 'none' : 'height 0.3s ease',
                    zIndex: 50,
                }}
            >
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: progress,
                        transform: `rotate(${rotation}deg)`,
                        transition: refreshing ? 'none' : 'transform 0.1s ease',
                        animation: refreshing ? 'ptr-spin 0.8s linear infinite' : 'none',
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #6C5CE7)" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        <polyline points="21 3 21 9 15 9" />
                    </svg>
                </div>
            </div>

            {/* Content with pull offset */}
            <div
                style={{
                    transform: `translateY(${pullDistance}px)`,
                    transition: pulling ? 'none' : 'transform 0.3s ease',
                }}
            >
                {children}
            </div>

            <style>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
