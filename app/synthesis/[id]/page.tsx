/**
 * REF-012g: Server Component + ISR for Synthesis Page
 * Converted from Client Component to Server Component
 *
 * Key changes:
 * - Removed 'use client' directive
 * - Added revalidate = 300 for ISR (5 minute revalidation)
 * - Server-side data fetching
 * - SynthesisClient handles all interactivity
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import SynthesisClient from '@/app/components/synthesis/SynthesisClient';
import { SynthesisData } from '@/app/types/synthesis-page';

// ISR: Revalidate every 5 minutes
export const revalidate = 300;

// Generate static params for common syntheses (optional optimization)
// export async function generateStaticParams() {
//   const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
//   const res = await fetch(`${API_URL}/api/syntheses?limit=50`);
//   const data = await res.json();
//   return data.data?.map((s: { id: string }) => ({ id: s.id })) || [];
// }

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getSynthesis(id: string): Promise<SynthesisData | null> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  try {
    const response = await fetch(`${API_URL}/api/syntheses/by-id/${id}`, {
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Map API response to SynthesisData structure
    const synthesis: SynthesisData = {
      id: data.id,
      title: data.title,
      summary: data.summary,
      introduction: data.introduction,
      body: data.body,
      analysis: data.analysis,
      keyPoints: data.keyPoints || [],
      sources: data.sources || [],
      sourceArticles: data.sourceArticles || [],
      numSources: data.numSources || 0,
      complianceScore: data.complianceScore || 0,
      readingTime: data.readingTime || 0,
      createdAt: data.createdAt,
      persona: data.personaId ? {
        id: data.personaId,
        name: data.personaName || 'NovaPress',
        displayName: data.personaName || 'NovaPress (Factuel)'
      } : undefined,
      author: data.author || undefined,
      signature: data.personaSignature || '',
      isPersonaVersion: data.isPersonaVersion || false,
      enrichment: data.enrichment || undefined,
      updateNotice: data.updateNotice || data.update_notice || undefined,
      originalCreatedAt: data.originalCreatedAt || data.original_created_at || undefined,
      lastUpdatedAt: data.lastUpdatedAt || data.last_updated_at || undefined,
      isUpdate: !!(data.updateNotice || data.update_notice || data.isUpdate || data.is_update),
      // Phase 11: Predictions & Historical Context
      predictions: data.predictions || [],
      historicalContext: data.historicalContext || undefined,
      category: data.category || 'MONDE'
    };

    return synthesis;
  } catch (error) {
    console.error('Failed to fetch synthesis:', error);
    return null;
  }
}

// Loading component for Suspense
function SynthesisLoading() {
  return (
    <div style={loadingStyles.container}>
      <div style={{ textAlign: 'center', color: '#6B7280' }}>
        <div style={loadingStyles.spinner} />
        <p style={{ marginTop: '16px', fontSize: '14px' }}>Chargement de la synthese...</p>
      </div>
    </div>
  );
}

// Error component
function SynthesisError() {
  return (
    <div style={loadingStyles.container}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', color: '#DC2626', marginBottom: '16px' }}>
          Synthese introuvable
        </h1>
        <Link href="/" style={{ color: '#2563EB', textDecoration: 'none', fontSize: '14px' }}>
          Retour a l'accueil
        </Link>
      </div>
    </div>
  );
}

export default async function SynthesisPage({ params }: PageProps) {
  const { id } = await params;
  const synthesis = await getSynthesis(id);

  if (!synthesis) {
    notFound();
  }

  return (
    <Suspense fallback={<SynthesisLoading />}>
      <SynthesisClient initialSynthesis={synthesis} />
    </Suspense>
  );
}

// Loading styles
const loadingStyles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  } as React.CSSProperties,
  spinner: {
    display: 'inline-block',
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5E5',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  } as React.CSSProperties,
};
