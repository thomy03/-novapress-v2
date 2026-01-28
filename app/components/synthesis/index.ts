/**
 * Synthesis Components Index
 * REF-012: Extracted components for Server Component architecture
 */

// Client Components
export { SynthesisHeader } from './SynthesisHeader';
export { PersonaSection, PersonaSignature } from './PersonaSection';
export { default as CausalSection } from './CausalSection';
export { default as NovaLineSection } from './NovaLineSection';
export { default as SynthesisBody, renderTextWithCitations } from './SynthesisBody';
export { default as SourcesSection } from './SourcesSection';
export { default as HistoricalContext } from './HistoricalContext';

// Main Client Wrapper (used by Server Component page)
export { default as SynthesisClient } from './SynthesisClient';
