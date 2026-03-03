'use client';

import React, { useMemo, useState, memo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from 'react-simple-maps';
import { SynthesisData, GeographicLocation, sharedStyles } from '@/app/types/synthesis-page';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/**
 * MiniGeoWidget — Editorial contextual geography widget.
 * Phase 3C: Uses LLM-generated geographic_context for precise locations.
 * Fallback: extracts countries from text if no geographic_context.
 * Style: "THEATRE DES OPERATIONS" — Le Monde editorial.
 */

// Country ISO2 → approximate center coordinates for map centering
const COUNTRY_CENTERS: Record<string, [number, number]> = {
  FR: [2, 47], DE: [10, 51], IT: [12, 42], ES: [-4, 40], GB: [-2, 54],
  US: [-98, 39], RU: [60, 60], CN: [105, 35], JP: [138, 36], IN: [78, 22],
  BR: [-50, -14], CA: [-100, 56], AU: [135, -25], MX: [-102, 23],
  TR: [32, 39], IR: [53, 32], IQ: [44, 33], IL: [35, 31], PS: [35, 32],
  SY: [38, 35], LB: [36, 34], EG: [30, 26], MA: [-6, 32], DZ: [3, 28],
  TN: [9, 34], NG: [8, 10], ZA: [25, -29], KR: [127, 37], KP: [127, 40],
  TW: [121, 24], SA: [45, 24], PK: [69, 30], UA: [32, 49], PL: [20, 52],
  GR: [22, 39], AR: [-64, -34], CO: [-74, 4], VE: [-66, 8], PE: [-76, -10],
  CL: [-71, -30], SE: [15, 62], NO: [10, 62], FI: [26, 64], AT: [14, 47],
  BE: [4, 51], NL: [5, 52], CH: [8, 47], PT: [-8, 39], RO: [25, 46],
  HU: [19, 47], ID: [117, -2], TH: [100, 15], VN: [108, 16], PH: [122, 13],
};

// Country name → ISO Alpha-3 mapping for regex fallback
const COUNTRY_NAME_TO_ISO3: Record<string, string> = {
  'france': 'FRA', 'allemagne': 'DEU', 'germany': 'DEU', 'italie': 'ITA', 'italy': 'ITA',
  'espagne': 'ESP', 'spain': 'ESP', 'royaume-uni': 'GBR', 'united kingdom': 'GBR',
  'etats-unis': 'USA', 'united states': 'USA', 'russie': 'RUS', 'russia': 'RUS',
  'chine': 'CHN', 'china': 'CHN', 'japon': 'JPN', 'japan': 'JPN', 'inde': 'IND',
  'india': 'IND', 'bresil': 'BRA', 'brazil': 'BRA', 'canada': 'CAN',
  'ukraine': 'UKR', 'turquie': 'TUR', 'turkey': 'TUR', 'iran': 'IRN',
  'irak': 'IRQ', 'iraq': 'IRQ', 'israel': 'ISR', 'palestine': 'PSE',
  'syrie': 'SYR', 'syria': 'SYR', 'liban': 'LBN', 'lebanon': 'LBN',
  'egypte': 'EGY', 'egypt': 'EGY', 'maroc': 'MAR', 'morocco': 'MAR',
  'algerie': 'DZA', 'algeria': 'DZA', 'tunisie': 'TUN', 'tunisia': 'TUN',
  'afrique du sud': 'ZAF', 'south africa': 'ZAF', 'arabie saoudite': 'SAU',
  'saudi arabia': 'SAU', 'coree du nord': 'PRK', 'north korea': 'PRK',
  'coree du sud': 'KOR', 'south korea': 'KOR', 'pologne': 'POL', 'poland': 'POL',
  'grece': 'GRC', 'greece': 'GRC', 'suisse': 'CHE', 'switzerland': 'CHE',
};

// ISO2 → flag emoji
function countryFlag(iso2: string): string {
  if (!iso2 || iso2.length !== 2) return '';
  return String.fromCodePoint(
    ...iso2.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

interface GeoData {
  locations: GeographicLocation[];
  highlightedISO3: string[];
  center: [number, number];
  zoom: number;
}

function extractGeoData(synthesis: SynthesisData): GeoData {
  const locations = synthesis.geographicContext || [];

  // If we have LLM-generated context, use it
  if (locations.length > 0) {
    // Determine map center from countries
    const countries = locations
      .map(l => l.country?.toUpperCase())
      .filter(Boolean) as string[];

    const uniqueCountries = [...new Set(countries)];
    const highlightedISO3: string[] = [];

    // Map ISO2 to ISO3 for map highlighting
    for (const iso2 of uniqueCountries) {
      const iso3 = ISO2_TO_ISO3[iso2];
      if (iso3) highlightedISO3.push(iso3);
    }

    // Calculate center based on mentioned countries
    let centerLon = 0, centerLat = 0, count = 0;
    for (const iso2 of uniqueCountries) {
      const coords = COUNTRY_CENTERS[iso2];
      if (coords) {
        centerLon += coords[0];
        centerLat += coords[1];
        count++;
      }
    }
    const center: [number, number] = count > 0
      ? [centerLon / count, centerLat / count]
      : [10, 30];

    // Zoom based on bounding box of countries
    let zoom = 1;
    if (count === 1) zoom = 4;
    else if (count >= 2) {
      const lons = uniqueCountries.map(c => COUNTRY_CENTERS[c]?.[0]).filter(v => v !== undefined) as number[];
      const lats = uniqueCountries.map(c => COUNTRY_CENTERS[c]?.[1]).filter(v => v !== undefined) as number[];
      const lonSpread = Math.max(...lons) - Math.min(...lons);
      const latSpread = Math.max(...lats) - Math.min(...lats);
      const maxSpread = Math.max(lonSpread, latSpread);
      if (maxSpread < 15) zoom = 3.5;
      else if (maxSpread < 40) zoom = 2.5;
      else if (maxSpread < 80) zoom = 1.8;
      else zoom = 1.2;
    }

    return { locations, highlightedISO3, center, zoom };
  }

  // Fallback: extract countries from text
  return extractFallbackGeoData(synthesis);
}

function extractFallbackGeoData(synthesis: SynthesisData): GeoData {
  const textSources = [
    synthesis.body || '',
    synthesis.introduction || '',
    ...(synthesis.keyPoints || []),
  ].join(' ').toLowerCase();

  const found = new Map<string, number>();
  for (const [name, iso3] of Object.entries(COUNTRY_NAME_TO_ISO3)) {
    const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = textSources.match(regex);
    if (matches) found.set(iso3, (found.get(iso3) || 0) + matches.length);
  }

  const locations: GeographicLocation[] = Array.from(found.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([iso3]) => ({
      place: iso3,
      type: 'country',
      role: 'Mentionné dans l\'article',
      country: ISO3_TO_ISO2[iso3] || '',
    }));

  const highlightedISO3 = Array.from(found.keys());

  return {
    locations,
    highlightedISO3,
    center: [10, 30],
    zoom: 1,
  };
}

// ISO2 ↔ ISO3 mapping
const ISO2_TO_ISO3: Record<string, string> = {
  FR: 'FRA', DE: 'DEU', IT: 'ITA', ES: 'ESP', GB: 'GBR', US: 'USA',
  RU: 'RUS', CN: 'CHN', JP: 'JPN', IN: 'IND', BR: 'BRA', CA: 'CAN',
  AU: 'AUS', MX: 'MEX', TR: 'TUR', IR: 'IRN', IQ: 'IRQ', IL: 'ISR',
  PS: 'PSE', SY: 'SYR', LB: 'LBN', EG: 'EGY', MA: 'MAR', DZ: 'DZA',
  TN: 'TUN', NG: 'NGA', ZA: 'ZAF', KR: 'KOR', KP: 'PRK', TW: 'TWN',
  SA: 'SAU', PK: 'PAK', UA: 'UKR', PL: 'POL', GR: 'GRC', AR: 'ARG',
  CO: 'COL', VE: 'VEN', PE: 'PER', CL: 'CHL', SE: 'SWE', NO: 'NOR',
  FI: 'FIN', AT: 'AUT', BE: 'BEL', NL: 'NLD', CH: 'CHE', PT: 'PRT',
  RO: 'ROU', HU: 'HUN', ID: 'IDN', TH: 'THA', VN: 'VNM', PH: 'PHL',
};

const ISO3_TO_ISO2: Record<string, string> = Object.fromEntries(
  Object.entries(ISO2_TO_ISO3).map(([k, v]) => [v, k])
);

// Type emoji mapping
const TYPE_ICONS: Record<string, string> = {
  city: '\u{1F3D9}',     // 🏙
  country: '\u{1F3F3}',  // 🏳
  region: '\u{1F30D}',   // 🌍
  waterway: '\u{1F30A}', // 🌊
  base: '\u{1F6E1}',     // 🛡
};

interface MiniGeoWidgetProps {
  synthesis: SynthesisData;
}

const GeoMapInner = memo(function GeoMapInner({
  geoData,
}: {
  geoData: GeoData;
}) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  return (
    <div style={styles.container}>
      <h3 style={styles.sectionTitle}>{'GÉOGRAPHIE DE L\u2019ÉVÉNEMENT'}</h3>

      {/* Map */}
      <div style={styles.mapContainer}>
        <ComposableMap
          projectionConfig={{
            rotate: [-geoData.center[0], 0, 0],
            center: [0, geoData.center[1]],
            scale: 147 * geoData.zoom,
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const iso3 = geo.properties.ISO_A3;
                  const isHighlighted = geoData.highlightedISO3.includes(iso3);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={(evt) => {
                        if (isHighlighted) {
                          const loc = geoData.locations.find(l => {
                            const locIso3 = l.country ? ISO2_TO_ISO3[l.country.toUpperCase()] : '';
                            return locIso3 === iso3;
                          });
                          setTooltip({
                            text: loc ? `${loc.place}: ${loc.role}` : geo.properties.NAME,
                            x: evt.clientX,
                            y: evt.clientY,
                          });
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        default: {
                          fill: isHighlighted ? '#DC2626' : '#E5E5E5',
                          stroke: '#FFF',
                          strokeWidth: 0.5,
                          outline: 'none',
                        },
                        hover: {
                          fill: isHighlighted ? '#B91C1C' : '#D1D5DB',
                          stroke: '#FFF',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: isHighlighted ? 'pointer' : 'default',
                        },
                        pressed: { fill: '#991B1B', stroke: '#FFF', strokeWidth: 0.5, outline: 'none' },
                      }}
                    />
                  );
                })
              }
            </Geographies>
            {/* Markers for specific locations */}
            {geoData.locations
              .filter(l => l.country && COUNTRY_CENTERS[l.country.toUpperCase()])
              .map((loc, i) => {
                const coords = COUNTRY_CENTERS[loc.country!.toUpperCase()];
                return (
                  <Marker key={i} coordinates={coords}>
                    <circle r={4} fill="#000" opacity={0.7} />
                    <circle r={2} fill="#DC2626" />
                  </Marker>
                );
              })}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Location list — editorial style */}
      <div style={styles.locationList}>
        {geoData.locations.slice(0, 6).map((loc, i) => (
          <div key={i} style={styles.locationItem}>
            <span style={styles.locationFlag}>
              {loc.country ? countryFlag(loc.country.toUpperCase()) : (TYPE_ICONS[loc.type] || '')}
            </span>
            <div style={styles.locationText}>
              <span style={styles.locationName}>{loc.place}</span>
              <span style={styles.locationRole}>{loc.role}</span>
            </div>
          </div>
        ))}
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
            padding: '6px 10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            maxWidth: '200px',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
});

export default function MiniGeoWidget({ synthesis }: MiniGeoWidgetProps) {
  const geoData = useMemo(() => extractGeoData(synthesis), [synthesis]);

  // Only render if we have locations
  if (geoData.locations.length < 1) return null;

  return <GeoMapInner geoData={geoData} />;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '32px',
    padding: '20px',
    backgroundColor: '#fff',
    border: `1px solid ${sharedStyles.border}`,
    position: 'relative',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: sharedStyles.textPrimary,
    fontFamily: sharedStyles.fontSans,
    borderBottom: '2px solid #000',
    paddingBottom: '8px',
  },
  mapContainer: {
    width: '100%',
    height: '220px',
    marginBottom: '16px',
  },
  locationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  locationItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '6px 0',
    borderBottom: `1px solid ${sharedStyles.border}`,
  },
  locationFlag: {
    fontSize: '16px',
    lineHeight: '1',
    flexShrink: 0,
    marginTop: '2px',
  },
  locationText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  locationName: {
    fontSize: '13px',
    fontWeight: 700,
    color: sharedStyles.textPrimary,
    fontFamily: sharedStyles.fontSans,
  },
  locationRole: {
    fontSize: '11px',
    color: sharedStyles.textSecondary,
    lineHeight: '1.3',
    fontFamily: sharedStyles.fontSans,
  },
};
