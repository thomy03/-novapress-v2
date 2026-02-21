'use client';

interface BlindSpotAlertProps {
  contradictionsCount: number;
  hasContradictions: boolean;
  numSources: number;
  breakdown?: {
    source_diversity?: { score: number };
    geo_coverage?: { score: number; detail: string };
    language_diversity?: { score: number; detail: string };
  };
}

export default function BlindSpotAlert({
  contradictionsCount,
  hasContradictions,
  numSources,
  breakdown,
}: BlindSpotAlertProps) {
  const alerts: Array<{ type: 'warning' | 'info'; message: string }> = [];

  if (numSources <= 2) {
    alerts.push({
      type: 'warning',
      message: `Seulement ${numSources} source(s) - couverture limitee`,
    });
  }

  if (breakdown?.geo_coverage && breakdown.geo_coverage.score < 40) {
    alerts.push({
      type: 'warning',
      message: `Couverture geographique limitee (${breakdown.geo_coverage.detail})`,
    });
  }

  if (breakdown?.language_diversity && breakdown.language_diversity.score < 30) {
    alerts.push({
      type: 'info',
      message: `Sources dans une seule langue (${breakdown.language_diversity.detail})`,
    });
  }

  if (hasContradictions && contradictionsCount > 0) {
    alerts.push({
      type: 'info',
      message: `${contradictionsCount} contradiction(s) detectee(s) entre sources`,
    });
  }

  if (alerts.length === 0) return null;

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
        Angles morts
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {alerts.map((alert, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: alert.type === 'warning' ? '#FEF2F2' : '#EFF6FF',
              borderLeft: `3px solid ${alert.type === 'warning' ? '#DC2626' : '#2563EB'}`,
            }}
          >
            <span style={{ fontSize: '14px', flexShrink: 0 }}>
              {alert.type === 'warning' ? '!' : 'i'}
            </span>
            <span style={{
              fontSize: '13px',
              color: '#1F2937',
              lineHeight: '1.4',
            }}>
              {alert.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
