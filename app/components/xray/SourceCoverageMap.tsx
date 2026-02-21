'use client';

interface SourceArticle {
  name: string;
  url: string;
  title: string;
}

interface SourceCoverageMapProps {
  sourceArticles: SourceArticle[];
  numSources: number;
}

export default function SourceCoverageMap({ sourceArticles, numSources }: SourceCoverageMapProps) {
  if (!sourceArticles || sourceArticles.length === 0) {
    return null;
  }

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
        Sources croisees ({numSources})
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '8px',
      }}>
        {sourceArticles.map((source, i) => (
          <a
            key={`${source.name}-${i}`}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              border: '1px solid #E5E5E5',
              backgroundColor: '#FFFFFF',
              textDecoration: 'none',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2563EB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E5E5E5';
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#16A34A',
              flexShrink: 0,
            }} />
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#000',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {source.name}
              </div>
              {source.title && (
                <div style={{
                  fontSize: '11px',
                  color: '#6B7280',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {source.title}
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
