'use client';

import React, { useMemo, useState, memo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { SynthesisData, sharedStyles } from '@/app/types/synthesis-page';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/**
 * MiniGeoWidget — Compact Le Monde-style world map for MONDE category.
 * Auto-extracts mentioned countries from sourceArticles domains + keyPoints + body text.
 * Only renders when >= 2 countries are detected.
 */

// Country name → ISO Alpha-3 mapping for text extraction (French + English, no duplicates)
const COUNTRY_NAME_TO_ISO3: Record<string, string> = {
  // French names
  'allemagne': 'DEU', 'italie': 'ITA', 'espagne': 'ESP',
  'royaume-uni': 'GBR', 'etats-unis': 'USA', 'russie': 'RUS', 'chine': 'CHN',
  'japon': 'JPN', 'inde': 'IND', 'bresil': 'BRA',
  'australie': 'AUS', 'mexique': 'MEX', 'argentine': 'ARG',
  'turquie': 'TUR', 'irak': 'IRQ',
  'syrie': 'SYR', 'liban': 'LBN', 'egypte': 'EGY',
  'maroc': 'MAR', 'algerie': 'DZA', 'tunisie': 'TUN', 'senegal': 'SEN',
  'afrique du sud': 'ZAF', 'coree du nord': 'PRK',
  'coree du sud': 'KOR', 'arabie saoudite': 'SAU',
  'pologne': 'POL', 'roumanie': 'ROU', 'grece': 'GRC', 'suisse': 'CHE',
  'belgique': 'BEL', 'pays-bas': 'NLD', 'suede': 'SWE',
  'norvege': 'NOR', 'danemark': 'DNK', 'finlande': 'FIN', 'autriche': 'AUT',
  'hongrie': 'HUN', 'colombie': 'COL', 'perou': 'PER',
  'chili': 'CHL', 'banglad esh': 'BGD', 'indonesie': 'IDN',
  'thailande': 'THA',
  // English names (unique keys only)
  'france': 'FRA', 'germany': 'DEU', 'italy': 'ITA', 'spain': 'ESP',
  'united kingdom': 'GBR', 'united states': 'USA', 'russia': 'RUS', 'china': 'CHN',
  'japan': 'JPN', 'india': 'IND', 'brazil': 'BRA', 'canada': 'CAN',
  'australia': 'AUS', 'mexico': 'MEX', 'argentina': 'ARG', 'ukraine': 'UKR',
  'turkey': 'TUR', 'iran': 'IRN', 'iraq': 'IRQ', 'israel': 'ISR',
  'palestine': 'PSE', 'syria': 'SYR', 'lebanon': 'LBN', 'egypt': 'EGY',
  'morocco': 'MAR', 'algeria': 'DZA', 'tunisia': 'TUN', 'nigeria': 'NGA',
  'south africa': 'ZAF', 'north korea': 'PRK', 'south korea': 'KOR',
  'taiwan': 'TWN', 'saudi arabia': 'SAU', 'poland': 'POL', 'romania': 'ROU',
  'greece': 'GRC', 'switzerland': 'CHE', 'belgium': 'BEL', 'netherlands': 'NLD',
  'portugal': 'PRT', 'sweden': 'SWE', 'norway': 'NOR', 'denmark': 'DNK',
  'finland': 'FIN', 'austria': 'AUT', 'hungary': 'HUN', 'colombia': 'COL',
  'venezuela': 'VEN', 'peru': 'PER', 'chile': 'CHL', 'pakistan': 'PAK',
  'indonesia': 'IDN', 'thailand': 'THA', 'vietnam': 'VNM', 'philippines': 'PHL',
};

// Domain TLD → ISO3 mapping
const TLD_TO_ISO3: Record<string, string> = {
  '.fr': 'FRA', '.de': 'DEU', '.it': 'ITA', '.es': 'ESP',
  '.co.uk': 'GBR', '.com': 'USA', '.ru': 'RUS', '.cn': 'CHN',
  '.jp': 'JPN', '.in': 'IND', '.br': 'BRA', '.ca': 'CAN',
  '.au': 'AUS', '.mx': 'MEX', '.ar': 'ARG',
};

interface CountryMention {
  iso3: string;
  name: string;
  count: number;
}

function extractCountries(synthesis: SynthesisData): CountryMention[] {
  const counts = new Map<string, { name: string; count: number }>();

  // Combine all text sources for country detection
  const textSources = [
    synthesis.body || '',
    synthesis.introduction || '',
    ...(synthesis.keyPoints || []),
  ].join(' ').toLowerCase();

  // Search for country names in text
  for (const [name, iso3] of Object.entries(COUNTRY_NAME_TO_ISO3)) {
    // Word boundary matching using regex
    const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = textSources.match(regex);
    if (matches && matches.length > 0) {
      const existing = counts.get(iso3);
      counts.set(iso3, {
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count: (existing?.count || 0) + matches.length,
      });
    }
  }

  // Extract from source article domains
  if (synthesis.sourceArticles) {
    for (const src of synthesis.sourceArticles) {
      if (src.url) {
        try {
          const hostname = new URL(src.url).hostname;
          for (const [tld, iso3] of Object.entries(TLD_TO_ISO3)) {
            if (hostname.endsWith(tld) && tld !== '.com') {
              const existing = counts.get(iso3);
              counts.set(iso3, {
                name: existing?.name || iso3,
                count: (existing?.count || 0) + 1,
              });
            }
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }
  }

  return Array.from(counts.entries())
    .map(([iso3, data]) => ({ iso3, ...data }))
    .sort((a, b) => b.count - a.count);
}

function getCountryFill(iso3: string, countries: CountryMention[]): string {
  const mention = countries.find((c) => c.iso3 === iso3);
  if (!mention) return '#E5E5E5';
  if (mention.count >= 5) return '#DC2626';
  if (mention.count >= 3) return '#F59E0B';
  return '#3B82F6';
}

interface MiniGeoWidgetProps {
  synthesis: SynthesisData;
}

const MiniGeoWidgetInner = memo(function MiniGeoWidgetInner({
  countries,
}: {
  countries: CountryMention[];
}) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Zones Geographiques</h3>

      {/* Legend */}
      <div style={styles.legend}>
        {[
          { color: '#DC2626', label: 'Fortement mentionne' },
          { color: '#F59E0B', label: 'Moderement' },
          { color: '#3B82F6', label: 'Mentionne' },
        ].map(({ color, label }) => (
          <span key={color} style={styles.legendItem}>
            <span style={{ ...styles.legendDot, backgroundColor: color }} />
            <span style={styles.legendLabel}>{label}</span>
          </span>
        ))}
      </div>

      {/* Country pills */}
      <div style={styles.pills}>
        {countries.slice(0, 8).map((c) => (
          <span
            key={c.iso3}
            style={{
              ...styles.pill,
              backgroundColor: c.count >= 5 ? '#FEE2E2' : c.count >= 3 ? '#FEF3C7' : '#DBEAFE',
              color: c.count >= 5 ? '#DC2626' : c.count >= 3 ? '#D97706' : '#2563EB',
            }}
          >
            {c.name} ({c.count})
          </span>
        ))}
      </div>

      {/* Map */}
      <div style={styles.mapContainer}>
        <ComposableMap
          projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup center={[0, 20]} zoom={1}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const iso3 = geo.properties.ISO_A3;
                  const fill = getCountryFill(iso3, countries);
                  const isMentioned = countries.some((c) => c.iso3 === iso3);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={(evt) => {
                        const mention = countries.find((c) => c.iso3 === iso3);
                        const text = mention
                          ? `${mention.name}: ${mention.count} mention${mention.count > 1 ? 's' : ''}`
                          : geo.properties.NAME;
                        setTooltip({ text, x: evt.clientX, y: evt.clientY });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        default: { fill, stroke: '#FFF', strokeWidth: 0.5, outline: 'none' },
                        hover: {
                          fill: isMentioned ? '#1D4ED8' : '#D1D5DB',
                          stroke: '#FFF',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: 'pointer',
                        },
                        pressed: { fill: '#1E40AF', stroke: '#FFF', strokeWidth: 0.5, outline: 'none' },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 10,
            top: tooltip.y - 30,
            backgroundColor: '#fff',
            border: '1px solid #E5E5E5',
            borderRadius: '4px',
            padding: '6px 10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
});

export default function MiniGeoWidget({ synthesis }: MiniGeoWidgetProps) {
  const countries = useMemo(() => extractCountries(synthesis), [synthesis]);

  // Only render if >= 2 countries detected
  if (countries.length < 2) return null;

  return <MiniGeoWidgetInner countries={countries} />;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '32px',
    padding: '20px',
    backgroundColor: '#fff',
    border: `1px solid ${sharedStyles.border}`,
    position: 'relative',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: sharedStyles.textSecondary,
    fontFamily: sharedStyles.fontSans,
  },
  legend: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
    fontSize: '11px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '2px',
    display: 'inline-block',
  },
  legendLabel: {
    color: sharedStyles.textMuted,
  },
  pills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '12px',
  },
  pill: {
    padding: '3px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 500,
  },
  mapContainer: {
    width: '100%',
    height: '250px',
  },
};
