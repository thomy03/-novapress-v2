'use client';

/**
 * REF-012f: SourcesSection - Sources and Enrichment Section Component
 * Displays source articles and enrichment data (Perplexity, Grok, FactCheck)
 */

import React from 'react';
import { SourcesSectionProps, SynthesisData, SourceArticle } from '@/app/types/synthesis-page';
import EnrichmentBadge from '@/app/components/ui/EnrichmentBadge';
import SocialSentiment from '@/app/components/ui/SocialSentiment';
import FactCheckSection from '@/app/components/ui/FactCheckSection';

export default function SourcesSection({ synthesis }: SourcesSectionProps) {
  const hasSourceArticles = synthesis.sourceArticles && synthesis.sourceArticles.length > 0;
  const hasSources = synthesis.sources && synthesis.sources.length > 0;
  const hasEnrichment = synthesis.enrichment?.isEnriched;

  // Don't render if no sources and no enrichment
  if (!hasSourceArticles && !hasSources && !hasEnrichment) {
    return null;
  }

  return (
    <>
      {/* Sources Section */}
      {(hasSourceArticles || hasSources) && (
        <div style={styles.sourcesSection}>
          <h2 style={styles.sourcesTitle}>
            Sources utilisees ({synthesis.numSources})
          </h2>
          <div style={styles.sourcesList}>
            {hasSourceArticles ? (
              synthesis.sourceArticles!.map((source: SourceArticle, index: number) => (
                <div key={index} style={styles.sourceCard}>
                  <div style={styles.sourceName}>{source.name}</div>
                  {source.title && (
                    <div style={styles.sourceTitle}>{source.title}</div>
                  )}
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.sourceLink}
                    >
                      Lire l'article original &rarr;
                    </a>
                  )}
                </div>
              ))
            ) : (
              synthesis.sources.map((source: string, index: number) => (
                <span key={index} style={styles.sourceTag}>
                  {source}
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {/* Enrichment Section */}
      {hasEnrichment && synthesis.enrichment && (
        <div style={styles.enrichmentSection}>
          <h2 style={styles.enrichmentTitle}>
            <span style={{ marginRight: '8px' }}>🌐</span>
            Sources complementaires
          </h2>
          <p style={styles.enrichmentDescription}>
            Cette synthese a ete enrichie avec des informations provenant de recherches web et d'analyses des reseaux sociaux.
          </p>

          {/* Enrichment Badges */}
          <div style={{ marginBottom: '20px' }}>
            <EnrichmentBadge enrichment={synthesis.enrichment} />
          </div>

          {/* Perplexity Web Context */}
          {synthesis.enrichment.perplexity.enabled && synthesis.enrichment.perplexity.context && (
            <div style={styles.webContextBox}>
              <h4 style={styles.contextTitle}>Informations web complementaires</h4>
              <p style={styles.contextText}>
                {synthesis.enrichment.perplexity.context}
              </p>
            </div>
          )}

          {/* Social Sentiment */}
          {synthesis.enrichment.grok.enabled && (
            <SocialSentiment grok={synthesis.enrichment.grok} />
          )}

          {/* Fact Check */}
          {(synthesis.enrichment.factCheck.count > 0 ||
            synthesis.enrichment.perplexity.sources.length > 0) && (
            <FactCheckSection
              factCheck={synthesis.enrichment.factCheck}
              webSources={synthesis.enrichment.perplexity.sources}
            />
          )}
        </div>
      )}
    </>
  );
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  // Sources styles
  sourcesSection: {
    borderTop: '2px solid #000000',
    paddingTop: '24px',
    marginTop: '40px',
  },
  sourcesTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '16px',
  },
  sourcesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  sourceCard: {
    backgroundColor: '#F9FAFB',
    padding: '12px 16px',
    borderLeft: '3px solid #2563EB',
  },
  sourceName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: '4px',
  },
  sourceTitle: {
    fontSize: '13px',
    color: '#4B5563',
    marginBottom: '6px',
  },
  sourceLink: {
    fontSize: '12px',
    color: '#2563EB',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  },
  sourceTag: {
    backgroundColor: '#F3F4F6',
    padding: '6px 12px',
    fontSize: '13px',
    color: '#374151',
    borderRadius: '2px',
    display: 'inline-block',
  },
  // Enrichment styles
  enrichmentSection: {
    marginTop: '40px',
    padding: '24px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
    borderRadius: '8px',
  },
  enrichmentTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
  },
  enrichmentDescription: {
    fontSize: '13px',
    color: '#6B7280',
    marginTop: 0,
    marginBottom: '16px',
    lineHeight: '1.5',
  },
  webContextBox: {
    backgroundColor: '#EEF2FF',
    border: '1px solid #C7D2FE',
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '16px',
  },
  contextTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: '8px',
  },
  contextText: {
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#374151',
    margin: 0,
  },
};
