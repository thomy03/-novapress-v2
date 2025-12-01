'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SynthesisLayout from '@/app/components/layout/SynthesisLayout';
import { TimelinePreview } from '@/app/components/timeline';
import { NeuralCausalGraph, NodeDetailPanel } from '@/app/components/causal';
import { causalService } from '@/app/lib/api/services/causal';
import {
  CausalGraphResponse,
  CausalNode,
  CausalEdge,
} from '@/app/types/causal';

interface SourceArticle {
  name: string;
  url: string;
  title: string;
}

interface Synthesis {
  id: string;
  title: string;
  summary: string;
  introduction?: string;
  body?: string;
  analysis?: string;
  keyPoints: string[];
  sources: string[];
  sourceArticles?: SourceArticle[];
  numSources: number;
  complianceScore: number;
  readingTime: number;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function SynthesisPage() {
  const params = useParams();
  const router = useRouter();
  const [synthesis, setSynthesis] = useState<Synthesis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Causal graph state
  const [causalData, setCausalData] = useState<CausalGraphResponse | null>(null);
  const [causalLoading, setCausalLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<CausalNode | null>(null);

  // Fetch synthesis
  useEffect(() => {
    const fetchSynthesis = async () => {
      if (!params?.id) return;

      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/syntheses/by-id/${params.id}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setSynthesis(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch synthesis:', err);
        setError('Unable to load synthesis');
      } finally {
        setLoading(false);
      }
    };

    fetchSynthesis();
  }, [params?.id]);

  // Fetch causal graph data
  useEffect(() => {
    const fetchCausalData = async () => {
      if (!params?.id) return;

      try {
        setCausalLoading(true);
        const data = await causalService.getCausalGraph(params.id as string);
        setCausalData(data);
      } catch (err) {
        console.log('Causal data not available:', err);
        setCausalData(null);
      } finally {
        setCausalLoading(false);
      }
    };

    fetchCausalData();
  }, [params?.id]);

  // Handle node click in causal graph
  const handleNodeClick = useCallback((nodeId: string, nodeData: CausalNode) => {
    setSelectedNode(nodeData);
  }, []);

  // Handle edge click
  const handleEdgeClick = useCallback((edge: CausalEdge) => {
    console.log('Edge clicked:', edge);
  }, []);

  // Close node detail panel
  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Get edges related to selected node
  const getNodeEdges = useCallback(() => {
    if (!selectedNode || !causalData) return { incoming: [], outgoing: [] };

    const incoming = causalData.edges.filter(
      (e) => e.effect_text === selectedNode.label
    );
    const outgoing = causalData.edges.filter(
      (e) => e.cause_text === selectedNode.label
    );

    return { incoming, outgoing };
  }, [selectedNode, causalData]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Parse text to replace [SOURCE:N] with clickable highlighted links
  const renderTextWithCitations = (text: string, sourceArticles?: SourceArticle[]) => {
    if (!text) return null;

    const sourcePattern = /\[SOURCE:(\d+)\]/g;
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sourcePattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const sourceNum = parseInt(match[1], 10);
      const sourceIndex = sourceNum - 1;
      const source = sourceArticles?.[sourceIndex];

      if (source && source.url) {
        parts.push(
          <a
            key={`source-${match.index}`}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              padding: '2px 6px',
              borderRadius: '3px',
              textDecoration: 'none',
              fontSize: '0.85em',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'inline',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FDE68A';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#FEF3C7';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title={`Source: ${source.name}${source.title ? ` - ${source.title}` : ''}`}
          >
            {source.name}
          </a>
        );
      } else {
        parts.push(
          <span
            key={`source-${match.index}`}
            style={{
              backgroundColor: '#F3F4F6',
              color: '#6B7280',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '0.85em',
              fontWeight: '500'
            }}
          >
            Source {sourceNum}
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={{ textAlign: 'center', color: '#6B7280' }}>
          <div style={styles.spinner} />
          <p style={{ marginTop: '16px', fontSize: '14px' }}>Chargement de la synthese...</p>
        </div>
      </div>
    );
  }

  if (error || !synthesis) {
    return (
      <div style={styles.errorContainer}>
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

  const fullContent = synthesis.body || synthesis.summary || '';
  const paragraphs = fullContent.split('\n\n').filter(p => p.trim());
  const nodeEdges = getNodeEdges();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <Link href="/" style={styles.backLink}>
            <span style={{ fontSize: '18px' }}>&larr;</span>
            <span>Retour aux actualites</span>
          </Link>
        </div>
      </header>

      {/* 3-Column Layout */}
      <SynthesisLayout
        leftSidebar={
          <TimelinePreview
            synthesisId={synthesis.id}
            onError={(err) => console.log('Timeline not available:', err.message)}
          />
        }
        rightSidebar={
          causalData && causalData.nodes && causalData.nodes.length > 0 ? (
            <NeuralCausalGraph
              nodes={causalData.nodes}
              edges={causalData.edges}
              centralEntity={causalData.central_entity}
              narrativeFlow={causalData.narrative_flow}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
            />
          ) : causalLoading ? (
            <div style={styles.sidebarLoading}>
              <div style={styles.spinnerSmall} />
              <p>Chargement du graphe...</p>
            </div>
          ) : (
            <div style={styles.sidebarEmpty}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <p style={styles.emptyText}>Graphe neuronal en attente</p>
              <p style={styles.emptySubtext}>Les relations causales seront disponibles prochainement.</p>
            </div>
          )
        }
      >
        {/* Main Content */}
        <main style={styles.main}>
          {/* AI Badge */}
          <div style={styles.aiBadge}>
            AI SYNTHESIS
          </div>

          {/* Title */}
          <h1 style={styles.title}>
            {synthesis.title}
          </h1>

          {/* Metadata */}
          <div style={styles.metadata}>
            <span>{synthesis.numSources} sources</span>
            <span style={{ color: '#E5E5E5' }}>|</span>
            <span>{synthesis.readingTime} min de lecture</span>
            <span style={{ color: '#E5E5E5' }}>|</span>
            <span>{formatDate(synthesis.createdAt)}</span>
            <span style={{ color: '#E5E5E5' }}>|</span>
            <span style={styles.accuracyBadge}>
              <span
                style={{
                  ...styles.accuracyDot,
                  backgroundColor: synthesis.complianceScore >= 90 ? '#10B981' : '#F59E0B'
                }}
              />
              {synthesis.complianceScore}% accuracy
            </span>
          </div>

          {/* Introduction (chapo) */}
          {synthesis.introduction && (
            <p style={styles.introduction}>
              {renderTextWithCitations(synthesis.introduction, synthesis.sourceArticles)}
            </p>
          )}

          {/* Body */}
          <div style={styles.body}>
            {paragraphs.map((paragraph, idx) => (
              <p key={idx} style={{ marginBottom: '24px' }}>
                {renderTextWithCitations(paragraph, synthesis.sourceArticles)}
              </p>
            ))}
          </div>

          {/* Analysis Section */}
          {synthesis.analysis && (
            <div style={styles.analysisSection}>
              <h2 style={styles.analysisTitle}>Analyse</h2>
              <p style={styles.analysisText}>
                {renderTextWithCitations(synthesis.analysis, synthesis.sourceArticles)}
              </p>
            </div>
          )}

          {/* Key Points */}
          {synthesis.keyPoints && synthesis.keyPoints.length > 0 && (
            <div style={styles.keyPointsSection}>
              <h2 style={styles.keyPointsTitle}>Points Cles</h2>
              <ul style={styles.keyPointsList}>
                {synthesis.keyPoints.map((point, index) => (
                  <li key={index} style={styles.keyPoint}>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sources */}
          {((synthesis.sourceArticles && synthesis.sourceArticles.length > 0) ||
            (synthesis.sources && synthesis.sources.length > 0)) && (
            <div style={styles.sourcesSection}>
              <h2 style={styles.sourcesTitle}>
                Sources utilisees ({synthesis.numSources})
              </h2>
              <div style={styles.sourcesList}>
                {synthesis.sourceArticles && synthesis.sourceArticles.length > 0 ? (
                  synthesis.sourceArticles.map((source, index) => (
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
                          Lire l'article original →
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  synthesis.sources.map((source, index) => (
                    <span key={index} style={styles.sourceTag}>
                      {source}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Back Link */}
          <div style={styles.backSection}>
            <Link href="/" style={styles.backLinkBottom}>
              <span>&larr;</span>
              <span>Retour a la page d'accueil</span>
            </Link>
          </div>
        </main>
      </SynthesisLayout>

      {/* Node Detail Panel (modal) */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          incomingEdges={nodeEdges.incoming}
          outgoingEdges={nodeEdges.outgoing}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  loadingContainer: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    display: 'inline-block',
    width: '32px',
    height: '32px',
    border: '3px solid #E5E5E5',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorContainer: {
    minHeight: '100vh',
    backgroundColor: '#FFFFFF',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    borderBottom: '1px solid #E5E5E5',
    padding: '16px 0',
    backgroundColor: '#FFFFFF',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerContent: {
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '0 24px',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6B7280',
    textDecoration: 'none',
    fontSize: '14px',
  },
  main: {
    padding: '40px 0 80px',
  },
  aiBadge: {
    display: 'inline-block',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    marginBottom: '24px',
  },
  title: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '36px',
    fontWeight: '700',
    lineHeight: '1.2',
    color: '#000000',
    marginBottom: '16px',
  },
  metadata: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '16px',
    fontSize: '14px',
    color: '#6B7280',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid #E5E5E5',
  },
  accuracyBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  accuracyDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  introduction: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '20px',
    fontWeight: '500',
    lineHeight: '1.6',
    color: '#1F2937',
    marginBottom: '32px',
    borderLeft: '4px solid #2563EB',
    paddingLeft: '20px',
  },
  body: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '18px',
    lineHeight: '1.8',
    color: '#374151',
  },
  analysisSection: {
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E5E5',
    padding: '24px',
    marginTop: '40px',
    marginBottom: '40px',
  },
  analysisTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  analysisText: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '16px',
    lineHeight: '1.7',
    color: '#4B5563',
    fontStyle: 'italic',
    margin: 0,
  },
  keyPointsSection: {
    marginTop: '40px',
    marginBottom: '40px',
    padding: '24px',
    backgroundColor: '#FAFAFA',
    border: '1px solid #E5E5E5',
  },
  keyPointsTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '16px',
  },
  keyPointsList: {
    margin: 0,
    paddingLeft: '24px',
  },
  keyPoint: {
    fontSize: '16px',
    lineHeight: '1.7',
    color: '#374151',
    marginBottom: '12px',
  },
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
  backSection: {
    marginTop: '60px',
    paddingTop: '24px',
    borderTop: '1px solid #E5E5E5',
  },
  backLinkBottom: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: '#2563EB',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
  },
  sidebarLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '400px',
    color: '#6B7280',
    fontSize: '13px',
  },
  spinnerSmall: {
    width: '24px',
    height: '24px',
    border: '2px solid #E5E5E5',
    borderTopColor: '#2563EB',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '12px',
  },
  sidebarEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '400px',
    padding: '40px 20px',
    backgroundColor: '#F9FAFB',
    border: '1px dashed #E5E5E5',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6B7280',
    marginTop: '16px',
    marginBottom: '8px',
    fontFamily: 'Georgia, serif',
  },
  emptySubtext: {
    fontSize: '12px',
    color: '#9CA3AF',
    maxWidth: '200px',
  },
};
