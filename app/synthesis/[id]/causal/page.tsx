'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/**
 * Legacy causal page — redirects to the new Nexus experience
 */
export default function CausalPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/synthesis/${params.id}/nexus`);
    }
  }, [params?.id, router]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0A0F1A',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      color: '#64748B',
      fontSize: '13px',
      fontFamily: 'monospace',
    }}>
      Redirection vers le Nexus...
    </div>
  );
}
