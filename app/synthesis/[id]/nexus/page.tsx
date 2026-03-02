'use client';

import React, { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { NexusCanvas } from '@/app/components/nexus';

export default function NexusPage() {
  const params = useParams();
  const router = useRouter();
  const synthesisId = params?.id as string;

  const handleClose = useCallback(() => {
    router.push(`/synthesis/${synthesisId}`);
  }, [router, synthesisId]);

  if (!synthesisId) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0A0F1A',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#64748B',
      }}>
        ID de synthese manquant
      </div>
    );
  }

  return <NexusCanvas synthesisId={synthesisId} onClose={handleClose} />;
}
