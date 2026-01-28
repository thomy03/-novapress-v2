'use client';

/**
 * REF-012e: CausalSection - Client Component wrapper for causal graph sidebar
 * Extracted from app/synthesis/[id]/page.tsx
 */

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TangleCausalGraph, NodeDetailPanel } from '@/app/components/causal';
import {
  CausalGraphResponse,
  CausalNode,
  CausalEdge
} from '@/app/types/causal';
import { CausalSectionProps } from '@/app/types/synthesis-page';

export default function CausalSection({
  synthesisId,
  synthesisTitle,
  causalData,
  causalLoading,
  onNodeClick,
  onEdgeClick
}: CausalSectionProps) {
  const router = useRouter();
  const [selectedNode, setSelectedNode] = useState<CausalNode | null>(null);

  // Handle node click - navigate to fullscreen causal view
  const handleNodeClick = useCallback((nodeId: string, nodeData: CausalNode) => {
    if (onNodeClick) {
      onNodeClick(nodeId, nodeData);
    }
    // Navigate to fullscreen causal view with focus on clicked node
    router.push(`/synthesis/${synthesisId}/causal?focus=${nodeId}`);
  }, [synthesisId, router, onNodeClick]);

  // Handle edge click
  const handleEdgeClick = useCallback((edge: CausalEdge) => {
    if (onEdgeClick) {
      onEdgeClick(edge);
    }
    console.log('Edge clicked:', edge);
  }, [onEdgeClick]);

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

  // Render loading state
  if (causalLoading) {
    return (
      <div style={styles.sidebarLoading}>
        <div style={styles.spinnerSmall} />
        <span>Chargement du nexus causal...</span>
      </div>
    );
  }

  // Render empty state
  if (!causalData || causalData.nodes.length === 0) {
    return (
      <div style={styles.sidebarEmpty}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1">
          <circle cx="6" cy="6" r="3" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="18" r="3" />
          <path d="M9 6h6M6 9v6M18 9v6M9 18h6" />
        </svg>
        <p style={styles.emptyText}>Nexus causal en attente</p>
        <p style={styles.emptySubtext}>Les relations cause-effet seront visualisees ici.</p>
      </div>
    );
  }

  const nodeEdges = getNodeEdges();

  return (
    <>
      <TangleCausalGraph
        nodes={causalData.nodes}
        edges={causalData.edges}
        centralEntity={causalData.central_entity || synthesisTitle}
        narrativeFlow={causalData.narrative_flow || 'linear'}
        synthesisId={synthesisId}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
      />

      {/* Node Detail Panel (modal) */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          incomingEdges={nodeEdges.incoming}
          outgoingEdges={nodeEdges.outgoing}
          onClose={handleClosePanel}
        />
      )}
    </>
  );
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
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
