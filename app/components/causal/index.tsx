import dynamic from 'next/dynamic';

// Loading placeholder for lazy-loaded graphs
const GraphLoadingPlaceholder = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    backgroundColor: '#F9FAFB',
    borderRadius: '8px',
    border: '1px solid #E5E5E5',
  }}>
    <div style={{ textAlign: 'center', color: '#6B7280' }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>Loading graph...</div>
      <div style={{ fontSize: '12px' }}>Chargement du graphe causal</div>
    </div>
  </div>
);

// Lazy-loaded components (React Flow is heavy ~300KB)
// These will be code-split into separate chunks
// REF-008: Removed orphan components (CausalFlowView, TreeCausalGraph, TimelineCausalGraph)

export const NeuralCausalGraph = dynamic(() => import('./NeuralCausalGraph'), {
  loading: GraphLoadingPlaceholder,
  ssr: false,
});

export const TangleCausalGraph = dynamic(() => import('./TangleCausalGraph'), {
  loading: GraphLoadingPlaceholder,
  ssr: false,
});

export const HistoricalCausalGraph = dynamic(() => import('./HistoricalCausalGraph'), {
  loading: GraphLoadingPlaceholder,
  ssr: false,
});

// Non-lazy exports (lightweight components)
export { default as CausalPreview } from './CausalPreview';
export { default as NeuralNode } from './NeuralNode';
export { default as TangleNode } from './TangleNode';
export { default as AnimatedEdge } from './AnimatedEdge';
export { default as TangleEdge } from './TangleEdge';
export { default as NodeDetailPanel } from './NodeDetailPanel';
