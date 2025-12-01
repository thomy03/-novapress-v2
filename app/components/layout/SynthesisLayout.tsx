'use client';

import React, { useState, useEffect } from 'react';

interface SynthesisLayoutProps {
  leftSidebar?: React.ReactNode;
  children: React.ReactNode;
  rightSidebar?: React.ReactNode;
}

export default function SynthesisLayout({
  leftSidebar,
  children,
  rightSidebar,
}: SynthesisLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [leftExpanded, setLeftExpanded] = useState(false);
  const [rightExpanded, setRightExpanded] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1200);
    };

    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  // Mobile: Accordions above content
  if (isMobile) {
    return (
      <div style={styles.mobileContainer}>
        {/* Left sidebar accordion */}
        {leftSidebar && (
          <div style={styles.accordion}>
            <button
              style={styles.accordionButton}
              onClick={() => setLeftExpanded(!leftExpanded)}
            >
              <span style={styles.accordionTitle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                Historique
              </span>
              <span style={{
                ...styles.accordionIcon,
                transform: leftExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            {leftExpanded && (
              <div style={styles.accordionContent}>
                {leftSidebar}
              </div>
            )}
          </div>
        )}

        {/* Right sidebar accordion */}
        {rightSidebar && (
          <div style={styles.accordion}>
            <button
              style={styles.accordionButton}
              onClick={() => setRightExpanded(!rightExpanded)}
            >
              <span style={styles.accordionTitle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Nexus Causal
              </span>
              <span style={{
                ...styles.accordionIcon,
                transform: rightExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            {rightExpanded && (
              <div style={styles.accordionContent}>
                {rightSidebar}
              </div>
            )}
          </div>
        )}

        {/* Main content */}
        <main style={styles.mobileMain}>
          {children}
        </main>
      </div>
    );
  }

  // Tablet: Timeline left only, Causal at bottom
  if (isTablet) {
    return (
      <div style={styles.tabletContainer}>
        <div style={styles.tabletGrid}>
          {leftSidebar && (
            <aside style={styles.tabletLeftSidebar}>
              {leftSidebar}
            </aside>
          )}
          <main style={styles.tabletMain}>
            {children}
          </main>
        </div>

        {/* Causal graph at bottom for tablet */}
        {rightSidebar && (
          <div style={styles.tabletBottomPanel}>
            <div style={styles.tabletPanelHeader}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span>Nexus Causal</span>
            </div>
            {rightSidebar}
          </div>
        )}
      </div>
    );
  }

  // Desktop: Full 3-column layout
  const gridColumns = leftSidebar && rightSidebar
    ? '280px 1fr 400px'
    : leftSidebar
    ? '280px 1fr'
    : rightSidebar
    ? '1fr 400px'
    : '1fr';

  return (
    <div style={{
      ...styles.desktopContainer,
      gridTemplateColumns: gridColumns,
    }}>
      {leftSidebar && (
        <aside style={styles.leftSidebar}>
          <div style={styles.sidebarHeader}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span style={styles.sidebarTitle}>Historique</span>
          </div>
          <div style={styles.sidebarContent}>
            {leftSidebar}
          </div>
        </aside>
      )}

      <main style={styles.main}>
        {children}
      </main>

      {rightSidebar && (
        <aside style={styles.rightSidebar}>
          {rightSidebar}
        </aside>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  // Desktop styles
  desktopContainer: {
    display: 'grid',
    gap: '32px',
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '0 24px',
    minHeight: 'calc(100vh - 200px)',
  },
  leftSidebar: {
    position: 'sticky',
    top: '100px',
    height: 'calc(100vh - 120px)',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    borderBottom: '2px solid #000000',
    color: '#374151',
  },
  sidebarTitle: {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    fontWeight: 700,
    color: '#000000',
  },
  sidebarContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  main: {
    minWidth: 0,
  },
  rightSidebar: {
    position: 'sticky',
    top: '100px',
    height: 'calc(100vh - 120px)',
  },

  // Tablet styles
  tabletContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px',
  },
  tabletGrid: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '24px',
  },
  tabletLeftSidebar: {
    position: 'sticky',
    top: '100px',
    height: 'calc(100vh - 200px)',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    overflowY: 'auto',
    padding: '16px',
  },
  tabletMain: {
    minWidth: 0,
  },
  tabletBottomPanel: {
    marginTop: '32px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
  },
  tabletPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '2px solid #000000',
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    fontWeight: 700,
    color: '#000000',
  },

  // Mobile styles
  mobileContainer: {
    padding: '0 16px',
  },
  accordion: {
    marginBottom: '16px',
    border: '1px solid #E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  accordionButton: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '16px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid #E5E5E5',
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    fontWeight: 700,
    color: '#000000',
  },
  accordionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  accordionIcon: {
    transition: 'transform 0.3s ease',
    color: '#6B7280',
  },
  accordionContent: {
    maxHeight: '400px',
    overflowY: 'auto',
    padding: '16px',
  },
  mobileMain: {
    marginTop: '16px',
  },
};
