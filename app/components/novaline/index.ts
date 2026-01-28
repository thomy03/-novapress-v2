/**
 * NovaLine v3 - The Electrocardiogram of News
 *
 * A tension narrative visualization that combines:
 * - Timeline (past events)
 * - Story Arc (tension curve)
 * - Predictions (future scenarios)
 * - Contradictions (source divergences)
 *
 * Features:
 * - Responsive: Horizontal on desktop, Vertical on mobile
 * - Category-weighted tension calculation
 * - Cone of uncertainty for predictions
 * - Pulse animation on "Today" marker
 * - Contradiction markers with detailed tooltips
 */

export { NovaLine } from './NovaLine';
export { NovaLineHorizontal } from './NovaLineHorizontal';
export { NovaLineVertical } from './NovaLineVertical';
export { NovaLineTooltip, ContradictionTooltip } from './NovaLineTooltip';
export { useNovaLineData } from './useNovaLineData';
