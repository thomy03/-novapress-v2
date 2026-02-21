'use client';

import { ReactNode, useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import { ArticlesProvider } from '../contexts/ArticlesContext';
import { ReadingProfileProvider } from '../contexts/ReadingProfileContext';
import { ErrorBoundary } from './ErrorBoundary';
import dynamic from 'next/dynamic';

// Lazy-load mobile components (only rendered on mobile via CSS)
const BottomNav = dynamic(() => import('./layout/BottomNav'), { ssr: false });
const MobileHeader = dynamic(() => import('./layout/MobileHeader'), { ssr: false });

interface ProvidersProps {
  children: ReactNode;
}

// Create QueryClient outside component to avoid recreation
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const queryClient = getQueryClient();

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ArticlesProvider>
              <ReadingProfileProvider>
                <div style={{ visibility: mounted ? 'visible' : 'hidden' }}>
                  {isMobile && <MobileHeader />}
                  {children}
                  {isMobile && <BottomNav />}
                </div>
              </ReadingProfileProvider>
            </ArticlesProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
