import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

function getScoreColor(score: number): string {
  if (score >= 80) return '#2563EB';
  if (score >= 60) return '#16A34A';
  if (score >= 40) return '#F59E0B';
  return '#DC2626';
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') || 'NovaPress AI';
  const score = parseInt(searchParams.get('score') || '0', 10);
  const sources = searchParams.get('sources') || '0';
  const languages = searchParams.get('languages') || '1';
  const label = searchParams.get('label') || '';

  const scoreColor = getScoreColor(score);

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#FFFFFF',
          fontFamily: 'Georgia, serif',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '32px 48px',
            borderBottom: '3px solid #000000',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#000' }}>NOVA</span>
            <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#DC2626' }}>PRESS</span>
            <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563EB', marginLeft: '6px' }}>AI</span>
          </div>
          <div style={{ fontSize: '16px', color: '#6B7280' }}>
            novapress.ai
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            padding: '48px',
            gap: '48px',
          }}
        >
          {/* Left: Title */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <div style={{
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: '#DC2626',
              marginBottom: '16px',
            }}>
              Synthese IA
            </div>
            <div style={{
              fontSize: '42px',
              fontWeight: 'bold',
              color: '#000000',
              lineHeight: 1.2,
              maxHeight: '260px',
              overflow: 'hidden',
            }}>
              {title.length > 120 ? title.substring(0, 120) + '...' : title}
            </div>
          </div>

          {/* Right: Score */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '200px',
            }}
          >
            {/* Score circle */}
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              border: `6px solid ${scoreColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}>
              <span style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: scoreColor,
              }}>
                {score}
              </span>
            </div>
            <div style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: scoreColor,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '16px',
            }}>
              {label || 'Transparence'}
            </div>
            <div style={{
              fontSize: '14px',
              color: '#6B7280',
              textAlign: 'center',
            }}>
              {sources} sources croisees
            </div>
            <div style={{
              fontSize: '14px',
              color: '#6B7280',
              textAlign: 'center',
            }}>
              {languages} langue(s)
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            padding: '16px 48px',
            borderTop: '1px solid #E5E5E5',
            fontSize: '13px',
            color: '#9CA3AF',
          }}
        >
          L'IA qui desose l'information
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
