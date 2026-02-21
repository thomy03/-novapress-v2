'use client';

interface ToneAnalysisProps {
  breakdown: {
    fact_density?: { score: number; detail: string };
    contradictions?: { score: number; detail: string };
    source_diversity?: { score: number; detail: string };
    language_diversity?: { score: number; detail: string };
    geo_coverage?: { score: number; detail: string };
  };
}

interface BarItem {
  label: string;
  score: number;
  weight: string;
  detail: string;
}

export default function ToneAnalysis({ breakdown }: ToneAnalysisProps) {
  if (!breakdown) return null;

  const items: BarItem[] = [
    {
      label: 'Sources',
      score: breakdown.source_diversity?.score ?? 0,
      weight: '30%',
      detail: breakdown.source_diversity?.detail ?? '',
    },
    {
      label: 'Langues',
      score: breakdown.language_diversity?.score ?? 0,
      weight: '20%',
      detail: breakdown.language_diversity?.detail ?? '',
    },
    {
      label: 'Contradictions',
      score: breakdown.contradictions?.score ?? 0,
      weight: '20%',
      detail: breakdown.contradictions?.detail ?? '',
    },
    {
      label: 'Factualite',
      score: breakdown.fact_density?.score ?? 0,
      weight: '15%',
      detail: breakdown.fact_density?.detail ?? '',
    },
    {
      label: 'Geographie',
      score: breakdown.geo_coverage?.score ?? 0,
      weight: '15%',
      detail: breakdown.geo_coverage?.detail ?? '',
    },
  ];

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{
        fontSize: '14px',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: '#000',
        marginBottom: '12px',
        fontFamily: 'Georgia, serif',
      }}>
        Decomposition du score
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {items.map((item) => (
          <div key={item.label}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '4px',
            }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#1F2937' }}>
                {item.label}
                <span style={{ fontWeight: '400', color: '#9CA3AF', marginLeft: '4px' }}>
                  ({item.weight})
                </span>
              </span>
              <span style={{ fontSize: '13px', color: '#6B7280' }}>
                {item.detail}
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#E5E5E5',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${item.score}%`,
                height: '100%',
                backgroundColor: item.score >= 70 ? '#16A34A' : item.score >= 40 ? '#F59E0B' : '#DC2626',
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
