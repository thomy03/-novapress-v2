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
 * Smart zoom: auto-focuses on the region/cities mentioned.
 * City-level precision when LLM provides city-type locations.
 * Only shows when geographic data is explicitly present.
 */

// Country ISO2 → approximate center coordinates
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
  QA: [51, 25], AE: [54, 24], KW: [48, 29], BH: [50, 26], OM: [57, 21],
  JO: [36, 31], YE: [48, 15], AF: [67, 33], LY: [17, 27], SD: [30, 15],
  ET: [40, 9], KE: [38, 0], MY: [101, 4], SG: [104, 1],
};

// City name → coordinates (LLM returns city names, we resolve them)
const CITY_COORDS: Record<string, [number, number]> = {
  // Middle East
  'teheran': [51.4, 35.7], 'tehran': [51.4, 35.7],
  'bagdad': [44.4, 33.3], 'baghdad': [44.4, 33.3],
  'riyad': [46.7, 24.7], 'riyadh': [46.7, 24.7],
  'doha': [51.5, 25.3], 'dubai': [55.3, 25.3], 'abu dhabi': [54.4, 24.5],
  'koweit': [48.0, 29.4], 'kuwait': [48.0, 29.4], 'kuwait city': [48.0, 29.4],
  'jerusalem': [35.2, 31.8], 'tel-aviv': [34.8, 32.1], 'tel aviv': [34.8, 32.1],
  'gaza': [34.5, 31.5], 'beyrouth': [35.5, 33.9], 'beirut': [35.5, 33.9],
  'damas': [36.3, 33.5], 'damascus': [36.3, 33.5], 'alep': [37.2, 36.2], 'aleppo': [37.2, 36.2],
  'amman': [35.9, 31.9], 'sanaa': [44.2, 15.4], 'aden': [45.0, 12.8],
  'ispahan': [51.7, 32.7], 'isfahan': [51.7, 32.7], 'tabriz': [46.3, 38.1],
  'bassorah': [47.8, 30.5], 'basra': [47.8, 30.5], 'mossoul': [43.1, 36.3], 'mosul': [43.1, 36.3],
  'erbil': [44.0, 36.2], 'najaf': [44.3, 32.0],
  // Gulf region
  'manama': [50.6, 26.2], 'mascate': [58.6, 23.6], 'muscat': [58.6, 23.6],
  'djeddah': [39.2, 21.5], 'jeddah': [39.2, 21.5], 'la mecque': [39.8, 21.4], 'mecca': [39.8, 21.4],
  // Europe
  'paris': [2.3, 48.9], 'lyon': [4.8, 45.8], 'marseille': [5.4, 43.3],
  'berlin': [13.4, 52.5], 'munich': [11.6, 48.1], 'francfort': [8.7, 50.1], 'frankfurt': [8.7, 50.1],
  'londres': [-0.1, 51.5], 'london': [-0.1, 51.5],
  'rome': [12.5, 41.9], 'milan': [9.2, 45.5],
  'madrid': [-3.7, 40.4], 'barcelone': [2.2, 41.4], 'barcelona': [2.2, 41.4],
  'bruxelles': [4.3, 50.8], 'brussels': [4.3, 50.8],
  'amsterdam': [4.9, 52.4],
  'vienne': [16.4, 48.2], 'vienna': [16.4, 48.2],
  'geneve': [6.1, 46.2], 'geneva': [6.1, 46.2], 'zurich': [8.5, 47.4],
  'moscou': [37.6, 55.8], 'moscow': [37.6, 55.8],
  'saint-petersbourg': [30.3, 59.9], 'st petersburg': [30.3, 59.9],
  'kiev': [30.5, 50.5], 'kyiv': [30.5, 50.5],
  'varsovie': [21.0, 52.2], 'warsaw': [21.0, 52.2],
  'bucarest': [26.1, 44.4], 'bucharest': [26.1, 44.4],
  'athenes': [23.7, 37.98], 'athens': [23.7, 37.98],
  'lisbonne': [-9.1, 38.7], 'lisbon': [-9.1, 38.7],
  'stockholm': [18.1, 59.3], 'oslo': [10.7, 59.9], 'helsinki': [24.9, 60.2],
  'istanbul': [29.0, 41.0], 'ankara': [32.9, 39.9],
  // Americas
  'washington': [-77.0, 38.9], 'new york': [-74.0, 40.7], 'los angeles': [-118.2, 34.1],
  'chicago': [-87.6, 41.9], 'san francisco': [-122.4, 37.8], 'houston': [-95.4, 29.8],
  'mexico': [-99.1, 19.4], 'bogota': [-74.1, 4.6], 'lima': [-77.0, -12.0],
  'buenos aires': [-58.4, -34.6], 'sao paulo': [-46.6, -23.6], 'rio de janeiro': [-43.2, -22.9],
  'santiago': [-70.7, -33.4], 'caracas': [-66.9, 10.5], 'la havane': [-82.4, 23.1], 'havana': [-82.4, 23.1],
  'ottawa': [-75.7, 45.4], 'toronto': [-79.4, 43.7], 'montreal': [-73.6, 45.5],
  // Asia
  'pekin': [116.4, 39.9], 'beijing': [116.4, 39.9], 'shanghai': [121.5, 31.2],
  'hong kong': [114.2, 22.3], 'tokyo': [139.7, 35.7], 'osaka': [135.5, 34.7],
  'seoul': [127.0, 37.6], 'pyongyang': [125.8, 39.0],
  'taipei': [121.5, 25.0], 'new delhi': [77.2, 28.6], 'mumbai': [72.9, 19.1],
  'bangkok': [100.5, 13.8], 'singapour': [103.8, 1.4], 'singapore': [103.8, 1.4],
  'kaboul': [69.2, 34.5], 'kabul': [69.2, 34.5],
  'islamabad': [73.0, 33.7], 'karachi': [67.0, 24.9],
  'hanoi': [105.8, 21.0], 'manille': [121.0, 14.6], 'manila': [121.0, 14.6],
  // Africa
  'le caire': [31.2, 30.0], 'cairo': [31.2, 30.0],
  'alger': [3.0, 36.8], 'algiers': [3.0, 36.8],
  'casablanca': [-7.6, 33.6], 'rabat': [-6.8, 34.0], 'tunis': [10.2, 36.8],
  'lagos': [3.4, 6.5], 'nairobi': [36.8, -1.3], 'johannesburg': [28.0, -26.2],
  'le cap': [18.4, -33.9], 'cape town': [18.4, -33.9],
  'addis-abeba': [38.7, 9.0], 'addis ababa': [38.7, 9.0],
  'khartoum': [32.5, 15.6], 'tripoli': [13.2, 32.9],
  // Oceania
  'sydney': [151.2, -33.9], 'melbourne': [144.96, -37.8], 'canberra': [149.1, -35.3],
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

// Resolve a location to [lon, lat] coordinates
function resolveCoords(loc: GeographicLocation): [number, number] | null {
  // Try city lookup first (more precise)
  if (loc.type === 'city' || loc.type === 'base') {
    const cityKey = loc.place.toLowerCase().trim();
    if (CITY_COORDS[cityKey]) return CITY_COORDS[cityKey];
  }

  // Try place name as city regardless of type
  const placeKey = loc.place.toLowerCase().trim();
  if (CITY_COORDS[placeKey]) return CITY_COORDS[placeKey];

  // Fall back to country center
  if (loc.country) {
    return COUNTRY_CENTERS[loc.country.toUpperCase()] || null;
  }

  return null;
}

interface GeoData {
  locations: GeographicLocation[];
  highlightedISO3: string[];
  center: [number, number];
  zoom: number;
  markers: { coords: [number, number]; label: string; type: string; role: string }[];
}

function extractGeoData(synthesis: SynthesisData): GeoData {
  const locations = synthesis.geographicContext || [];

  if (locations.length > 0) {
    const uniqueCountries = [...new Set(
      locations.map(l => l.country?.toUpperCase()).filter(Boolean) as string[]
    )];
    const highlightedISO3: string[] = [];
    for (const iso2 of uniqueCountries) {
      const iso3 = ISO2_TO_ISO3[iso2];
      if (iso3) highlightedISO3.push(iso3);
    }

    // Resolve all locations to coordinates for precise centering
    const markers: GeoData['markers'] = [];
    const allCoords: [number, number][] = [];

    for (const loc of locations) {
      const coords = resolveCoords(loc);
      if (coords) {
        allCoords.push(coords);
        markers.push({
          coords,
          label: loc.place,
          type: loc.type,
          role: loc.role,
        });
      }
    }

    // Center on the centroid of ALL resolved coordinates (cities + countries)
    let centerLon = 0, centerLat = 0;
    if (allCoords.length > 0) {
      for (const [lon, lat] of allCoords) {
        centerLon += lon;
        centerLat += lat;
      }
      centerLon /= allCoords.length;
      centerLat /= allCoords.length;
    } else {
      centerLon = 10;
      centerLat = 30;
    }

    // Smart zoom based on bounding box of ALL coordinates (not just countries)
    let zoom = 1;
    if (allCoords.length === 1) {
      // Single location → tight zoom
      zoom = 6;
    } else if (allCoords.length >= 2) {
      const lons = allCoords.map(c => c[0]);
      const lats = allCoords.map(c => c[1]);
      const lonSpread = Math.max(...lons) - Math.min(...lons);
      const latSpread = Math.max(...lats) - Math.min(...lats);
      const maxSpread = Math.max(lonSpread, latSpread);

      // Much tighter zoom levels than before
      if (maxSpread < 5) zoom = 8;          // Same city area (e.g. Gaza + Tel Aviv)
      else if (maxSpread < 10) zoom = 5.5;  // Same region (e.g. Israel + Lebanon)
      else if (maxSpread < 20) zoom = 4;    // Neighboring countries (Gulf region)
      else if (maxSpread < 40) zoom = 3;    // Sub-continental (Middle East)
      else if (maxSpread < 60) zoom = 2.2;  // Continental
      else if (maxSpread < 100) zoom = 1.6; // Multi-continental
      else zoom = 1.2;                       // Global
    }

    return { locations, highlightedISO3, center: [centerLon, centerLat], zoom, markers };
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

  if (found.size === 0) {
    return { locations: [], highlightedISO3: [], center: [10, 30], zoom: 1, markers: [] };
  }

  const locations: GeographicLocation[] = Array.from(found.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([iso3]) => ({
      place: iso3,
      type: 'country',
      role: 'Mentionn\u00e9 dans l\'article',
      country: ISO3_TO_ISO2[iso3] || '',
    }));

  const highlightedISO3 = Array.from(found.keys());

  // Calculate center and zoom from fallback data too
  const coords: [number, number][] = [];
  for (const loc of locations) {
    if (loc.country) {
      const c = COUNTRY_CENTERS[loc.country.toUpperCase()];
      if (c) coords.push(c);
    }
  }

  let centerLon = 10, centerLat = 30, zoom = 1;
  if (coords.length === 1) {
    centerLon = coords[0][0];
    centerLat = coords[0][1];
    zoom = 4;
  } else if (coords.length >= 2) {
    centerLon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
    centerLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const spread = Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats));
    if (spread < 20) zoom = 4;
    else if (spread < 40) zoom = 3;
    else if (spread < 80) zoom = 1.8;
    else zoom = 1.2;
  }

  const markers = coords.map((c, i) => ({
    coords: c,
    label: locations[i]?.place || '',
    type: 'country',
    role: locations[i]?.role || '',
  }));

  return { locations, highlightedISO3, center: [centerLon, centerLat], zoom, markers };
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
  QA: 'QAT', AE: 'ARE', KW: 'KWT', BH: 'BHR', OM: 'OMN',
  JO: 'JOR', YE: 'YEM', AF: 'AFG', LY: 'LBY', SD: 'SDN',
  ET: 'ETH', KE: 'KEN', MY: 'MYS', SG: 'SGP',
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
      <h3 style={styles.sectionTitle}>{'G\u00c9OGRAPHIE DE L\u2019\u00c9V\u00c9NEMENT'}</h3>

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
            {/* Markers for all resolved locations (cities + countries) */}
            {geoData.markers.map((marker, i) => (
              <Marker
                key={i}
                coordinates={marker.coords}
                onMouseEnter={(evt) => {
                  setTooltip({
                    text: `${marker.label}: ${marker.role}`,
                    x: evt.clientX,
                    y: evt.clientY,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {marker.type === 'city' || marker.type === 'base' ? (
                  <>
                    {/* City: larger pulsing marker */}
                    <circle r={6} fill="#000" opacity={0.15} />
                    <circle r={4} fill="#DC2626" opacity={0.9} />
                    <circle r={1.5} fill="#FFF" />
                  </>
                ) : (
                  <>
                    {/* Country: small dot */}
                    <circle r={4} fill="#000" opacity={0.5} />
                    <circle r={2} fill="#DC2626" />
                  </>
                )}
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Location list — editorial style */}
      <div style={styles.locationList}>
        {geoData.locations.slice(0, 6).map((loc, i) => (
          <div key={i} style={styles.locationItem}>
            <span style={styles.locationIcon}>
              {loc.country ? countryFlag(loc.country.toUpperCase()) : (TYPE_ICONS[loc.type] || '')}
            </span>
            <div style={styles.locationText}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={styles.locationName}>{loc.place}</span>
                {loc.type === 'city' && (
                  <span style={styles.locationBadge}>ville</span>
                )}
                {loc.type === 'waterway' && (
                  <span style={styles.locationBadge}>voie maritime</span>
                )}
                {loc.type === 'region' && (
                  <span style={styles.locationBadge}>r\u00e9gion</span>
                )}
              </div>
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
            maxWidth: '240px',
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

  // Only render if we have real geographic locations
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
    height: '260px',
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
  locationIcon: {
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
  locationBadge: {
    fontSize: '9px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    padding: '1px 5px',
  },
  locationRole: {
    fontSize: '11px',
    color: sharedStyles.textSecondary,
    lineHeight: '1.3',
    fontFamily: sharedStyles.fontSans,
  },
};
