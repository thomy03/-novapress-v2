'use client';

/**
 * REF-012e: CausalSection - Client Component wrapper for causal graph sidebar
 * Now renders a dark NexusMiniPreview instead of TangleCausalGraph
 */

import React from 'react';
import { NexusMiniPreview } from '@/app/components/nexus';
import { CausalSectionProps } from '@/app/types/synthesis-page';

export default function CausalSection({
  synthesisId,
  synthesisTitle,
  causalData,
  causalLoading,
}: CausalSectionProps) {
  return (
    <NexusMiniPreview
      synthesisId={synthesisId}
      causalData={causalData}
      causalLoading={causalLoading}
    />
  );
}
