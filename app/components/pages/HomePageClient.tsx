"use client";

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from '../../contexts/ThemeContext';
import { BentoGridSection } from '../layout/BentoGrid';
import { BentoCard } from '../layout/BentoCard';
import { synthesesService } from '@/app/lib/api/services/syntheses';
import { Synthesis } from '@/app/types/api';
import { determineBentoSize } from '@/app/types/bento';

// Lazy load heavy components
const IntelligenceHubPreview = React.lazy(() =>
  import('../intelligence/IntelligenceHubPreview').then(mod => ({ default: mod.IntelligenceHubPreview }))
);

const FilsRougesSection = React.lazy(() =>
  import('../topics/FilsRougesSection')
);

// Skeleton loaders
function IntelligenceHubSkeleton() {
  return (
    <div style={{
      padding: '32px',
      marginBottom: '40px',
      borderRadius: '16px',
      background: 'rgba(37, 99, 235, 0.02)',
      border: '1px solid rgba(37, 99, 235, 0.1)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            height: '100px',
            borderRadius: '12px',
            backgroundColor: 'rgba(0,0,0,0.05)',
          }} />
        ))}
      </div>
    </div>
  );
}

function FilsRougesSkeleton() {
  return (
    <div style={{ marginBottom: '32px', padding: '20px 0', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{
          width: `${80 + i * 20}px`,
          height: '36px',
          borderRadius: '18px',
          backgroundColor: 'rgba(0,0,0,0.05)',
        }} />
      ))}
    </div>
  );
}

// Newsletter section
function NewsletterSection() {
  const { theme, darkMode } = useTheme();

  return (
    <section style={{
      borderTop: `1px solid ${theme.border}`,
      borderBottom: `1px solid ${theme.border}`,
      padding: '48px 0',
      marginTop: '64px',
      marginBottom: '48px',
      textAlign: 'center',
      backgroundColor: darkMode ? 'rgba(255,255,255,0.02)' : 'transparent',
    }}>
      <h2 style={{
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        color: theme.textSecondary,
        marginBottom: '16px'
      }}>
        Newsletter
      </h2>
      <p style={{
        fontSize: '24px',
        fontWeight: '600',
        color: theme.text,
        fontFamily: 'Georgia, "Times New Roman", serif',
        marginBottom: '24px',
        maxWidth: '500px',
        margin: '0 auto 24px'
      }}>
        Recevez notre sélection quotidienne
      </p>
      <div style={{
        display: 'flex',
        gap: '0',
        maxWidth: '440px',
        margin: '0 auto'
      }}>
        <input
          type="email"
          placeholder="Votre adresse email"
          aria-label="Adresse email pour newsletter"
          style={{
            flex: 1,
            padding: '14px 20px',
            border: `1px solid ${theme.border}`,
            borderRight: 'none',
            fontSize: '14px',
            backgroundColor: theme.bg,
            color: theme.text,
            outline: 'none',
            borderRadius: '8px 0 0 8px',
          }}
        />
        <button
          style={{
            backgroundColor: theme.text,
            color: theme.bg,
            padding: '14px 28px',
            border: 'none',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'opacity 0.2s ease',
            borderRadius: '0 8px 8px 0',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          S'inscrire
        </button>
      </div>
    </section>
  );
}

// Bento Synthesis Card
interface BentoSynthesisCardProps {
  synthesis: Synthesis;
  size: 'small' | 'medium' | 'large' | 'featured';
}

function BentoSynthesisCard({ synthesis, size }: BentoSynthesisCardProps) {
  const { theme, darkMode } = useTheme();
  const isFeatured = size === 'featured' || size === 'large';

  return (
    <BentoCard
      size={size}
      onClick={() => { window.location.href = `/synthesis/${synthesis.id}`; }}
      title={synthesis.title}
      backgroundImage={isFeatured ? synthesis.imageUrl : undefined}
      overlay={isFeatured}
    >
      {/* Category badge */}
      {synthesis.category && (
        <span style={{
          display: 'inline-block',
          padding: '4px 10px',
          backgroundColor: darkMode ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)',
          color: '#2563EB',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '12px',
        }}>
          {synthesis.category}
        </span>
      )}

      {/* Title */}
      <h3 style={{
        fontSize: isFeatured ? '24px' : size === 'medium' ? '18px' : '15px',
        fontWeight: 600,
        color: isFeatured && synthesis.imageUrl ? '#fff' : theme.text,
        margin: 0,
        marginBottom: '8px',
        fontFamily: 'Georgia, "Times New Roman", serif',
        lineHeight: 1.3,
        display: '-webkit-box',
        WebkitLineClamp: isFeatured ? 3 : 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {synthesis.title}
      </h3>

      {/* Summary (only for larger cards) */}
      {(isFeatured || size === 'medium') && synthesis.summary && (
        <p style={{
          fontSize: '14px',
          color: isFeatured && synthesis.imageUrl ? 'rgba(255,255,255,0.8)' : theme.textSecondary,
          margin: 0,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1,
        }}>
          {synthesis.summary}
        </p>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 'auto',
        paddingTop: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: isFeatured && synthesis.imageUrl ? 'rgba(255,255,255,0.7)' : theme.textSecondary,
      }}>
        <span>{synthesis.sourceCount || synthesis.numSources || 0} sources</span>
        <span>
          {synthesis.createdAt
            ? new Date(synthesis.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            : ''}
        </span>
      </div>
    </BentoCard>
  );
}

// Main syntheses grid with Bento layout
function SynthesesBentoGrid() {
  const { theme } = useTheme();
  const [syntheses, setSyntheses] = useState<Synthesis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSyntheses = async () => {
      try {
        setLoading(true);
        const response = await synthesesService.getLiveSyntheses(48, 48);
        setSyntheses(response.data.slice(0, 9));
      } catch (err) {
        console.error('Failed to fetch syntheses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSyntheses();
  }, []);

  if (loading) {
    return (
      <BentoGridSection
        title="Synthèses IA"
        subtitle="Actualités analysées par notre intelligence artificielle"
      >
        {[...Array(6)].map((_, i) => (
          <BentoCard key={i} size={determineBentoSize(i, 6)} disableHover>
            <div style={{
              height: '100%',
              backgroundColor: theme.border,
              borderRadius: '8px',
            }} />
          </BentoCard>
        ))}
      </BentoGridSection>
    );
  }

  if (syntheses.length === 0) {
    return (
      <BentoGridSection
        title="Synthèses IA"
        subtitle="Actualités analysées par notre intelligence artificielle"
        action={
          <Link href="/admin/pipeline" style={{ fontSize: '12px', color: theme.brand.accent, textDecoration: 'none' }}>
            Lancer le pipeline →
          </Link>
        }
      >
        <BentoCard size="featured" disableHover>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center',
            gap: '16px',
          }}>
            <span style={{ fontSize: '48px', opacity: 0.5 }}>🧠</span>
            <p style={{ color: theme.textSecondary, fontSize: '14px' }}>
              Aucune synthèse disponible. Lancez le pipeline IA pour générer du contenu.
            </p>
          </div>
        </BentoCard>
      </BentoGridSection>
    );
  }

  return (
    <BentoGridSection
      title="Synthèses IA"
      subtitle="Actualités analysées par notre intelligence artificielle"
      action={
        <Link href="/live" style={{ fontSize: '12px', color: theme.brand.accent, textDecoration: 'none', fontWeight: 600 }}>
          Voir tout →
        </Link>
      }
    >
      {syntheses.map((synthesis, index) => (
        <BentoSynthesisCard
          key={synthesis.id}
          synthesis={synthesis}
          size={determineBentoSize(index, syntheses.length)}
        />
      ))}
    </BentoGridSection>
  );
}

// Skip to main content component
function SkipToMain({ onSkip }: { onSkip: () => void }) {
  const { theme } = useTheme();
  return (
    <button
      onClick={onSkip}
      style={{
        position: 'absolute',
        top: '-40px',
        left: '8px',
        backgroundColor: theme.text,
        color: theme.bg,
        padding: '8px 16px',
        border: 'none',
        fontSize: '13px',
        fontWeight: '600',
        cursor: 'pointer',
        zIndex: 1000,
        transition: 'top 0.2s ease',
        borderRadius: '4px',
      }}
      onFocus={(e) => { e.currentTarget.style.top = '8px'; }}
      onBlur={(e) => { e.currentTarget.style.top = '-40px'; }}
      aria-label="Aller au contenu principal"
    >
      Aller au contenu principal
    </button>
  );
}

// Live region for screen reader announcements
function LiveRegion({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden'
      }}
    >
      {message}
    </div>
  );
}

export function HomePageClient() {
  const { theme } = useTheme();
  const mainContentRef = useRef<HTMLElement>(null);
  const [liveRegionMessage, setLiveRegionMessage] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const skipToMainContent = () => {
    mainContentRef.current?.focus();
    mainContentRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLiveRegionMessage('Navigation fermée');
        setTimeout(() => setLiveRegionMessage(''), 1000);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <SkipToMain onSkip={skipToMainContent} />
      <LiveRegion message={liveRegionMessage} />

      <main
        ref={mainContentRef}
        role="main"
        aria-label="Contenu principal"
        tabIndex={-1}
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '40px 24px',
          outline: 'none'
        }}>

        {/* Intelligence Hub Preview - Above fold */}
        {mounted && (
          <React.Suspense fallback={<IntelligenceHubSkeleton />}>
            <IntelligenceHubPreview />
          </React.Suspense>
        )}

        {/* Enhanced Fils Rouges Section */}
        {mounted && (
          <React.Suspense fallback={<FilsRougesSkeleton />}>
            <FilsRougesSection />
          </React.Suspense>
        )}

        {/* Bento Grid with Syntheses */}
        <SynthesesBentoGrid />

        {/* Newsletter Section */}
        <NewsletterSection />
      </main>
    </>
  );
}

export default HomePageClient;
