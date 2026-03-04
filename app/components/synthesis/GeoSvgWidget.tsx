'use client';

import React, { useMemo } from 'react';
import { SynthesisData, sharedStyles } from '@/app/types/synthesis-page';

// ==========================================
// Coordinates lookup (ported from backend)
// ==========================================

const CITY_COORDS: Record<string, [number, number]> = {
  // Middle East
  'teheran': [51.4, 35.7], 'tehran': [51.4, 35.7],
  'bagdad': [44.4, 33.3], 'baghdad': [44.4, 33.3],
  'riyad': [46.7, 24.7], 'riyadh': [46.7, 24.7],
  'doha': [51.5, 25.3], 'dubai': [55.3, 25.3], 'abu dhabi': [54.4, 24.5],
  'jerusalem': [35.2, 31.8], 'tel-aviv': [34.8, 32.1], 'tel aviv': [34.8, 32.1],
  'gaza': [34.5, 31.5], 'beyrouth': [35.5, 33.9], 'beirut': [35.5, 33.9],
  'damas': [36.3, 33.5], 'damascus': [36.3, 33.5], 'amman': [35.9, 31.9],
  'sanaa': [44.2, 15.4], 'aden': [45.0, 12.8], 'ormuz': [56.3, 27.1],
  // Europe
  'paris': [2.3, 48.9], 'lyon': [4.8, 45.8], 'marseille': [5.4, 43.3],
  'berlin': [13.4, 52.5], 'munich': [11.6, 48.1], 'francfort': [8.7, 50.1], 'frankfurt': [8.7, 50.1],
  'londres': [-0.1, 51.5], 'london': [-0.1, 51.5],
  'rome': [12.5, 41.9], 'milan': [9.2, 45.5],
  'madrid': [-3.7, 40.4], 'barcelone': [2.2, 41.4], 'barcelona': [2.2, 41.4],
  'bruxelles': [4.3, 50.8], 'brussels': [4.3, 50.8],
  'amsterdam': [4.9, 52.4],
  'moscou': [37.6, 55.8], 'moscow': [37.6, 55.8],
  'kiev': [30.5, 50.5], 'kyiv': [30.5, 50.5],
  'varsovie': [21.0, 52.2], 'warsaw': [21.0, 52.2],
  'athenes': [23.7, 37.98], 'athens': [23.7, 37.98],
  'istanbul': [29.0, 41.0], 'ankara': [32.9, 39.9],
  'stockholm': [18.1, 59.3], 'oslo': [10.7, 59.9], 'helsinki': [24.9, 60.2],
  'geneve': [6.1, 46.2], 'geneva': [6.1, 46.2], 'zurich': [8.5, 47.4],
  'vienne': [16.4, 48.2], 'vienna': [16.4, 48.2],
  'lisbonne': [-9.1, 38.7], 'lisbon': [-9.1, 38.7],
  'prague': [14.4, 50.1], 'budapest': [19.0, 47.5], 'bucarest': [26.1, 44.4], 'bucharest': [26.1, 44.4],
  'copenhague': [12.6, 55.7], 'copenhagen': [12.6, 55.7],
  'dublin': [-6.3, 53.3], 'edinburgh': [-3.2, 55.9],
  // Americas
  'washington': [-77.0, 38.9], 'new york': [-74.0, 40.7], 'los angeles': [-118.2, 34.1],
  'chicago': [-87.6, 41.9], 'san francisco': [-122.4, 37.8], 'houston': [-95.4, 29.8],
  'miami': [-80.2, 25.8], 'boston': [-71.1, 42.4], 'seattle': [-122.3, 47.6],
  'mexico': [-99.1, 19.4], 'bogota': [-74.1, 4.6], 'lima': [-77.0, -12.0],
  'buenos aires': [-58.4, -34.6], 'sao paulo': [-46.6, -23.6], 'rio de janeiro': [-43.2, -22.9],
  'ottawa': [-75.7, 45.4], 'toronto': [-79.4, 43.7], 'montreal': [-73.6, 45.5],
  'santiago': [-70.7, -33.4], 'caracas': [-66.9, 10.5], 'havana': [-82.4, 23.1], 'la havane': [-82.4, 23.1],
  // Asia
  'pekin': [116.4, 39.9], 'beijing': [116.4, 39.9], 'shanghai': [121.5, 31.2],
  'hong kong': [114.2, 22.3], 'tokyo': [139.7, 35.7],
  'seoul': [127.0, 37.6], 'taipei': [121.5, 25.0],
  'new delhi': [77.2, 28.6], 'mumbai': [72.9, 19.1],
  'bangkok': [100.5, 13.8], 'singapour': [103.8, 1.4], 'singapore': [103.8, 1.4],
  'kaboul': [69.2, 34.5], 'kabul': [69.2, 34.5],
  'hanoi': [105.8, 21.0], 'jakarta': [106.8, -6.2], 'kuala lumpur': [101.7, 3.1],
  'islamabad': [73.0, 33.7], 'karachi': [67.0, 24.9],
  // Africa
  'le caire': [31.2, 30.0], 'cairo': [31.2, 30.0],
  'alger': [3.0, 36.8], 'algiers': [3.0, 36.8],
  'casablanca': [-7.6, 33.6], 'nairobi': [36.8, -1.3],
  'johannesburg': [28.0, -26.2], 'le cap': [18.4, -33.9], 'cape town': [18.4, -33.9],
  'lagos': [3.4, 6.5], 'addis abeba': [38.7, 9.0], 'addis ababa': [38.7, 9.0],
  'tunis': [10.2, 36.8], 'tripoli': [13.2, 32.9], 'khartoum': [32.5, 15.6],
  // Oceania
  'sydney': [151.2, -33.9], 'melbourne': [144.96, -37.8],
  'canberra': [149.1, -35.3], 'auckland': [174.8, -36.9],
};

const COUNTRY_CENTERS: Record<string, [number, number]> = {
  'france': [2, 47], 'allemagne': [10, 51], 'germany': [10, 51],
  'italie': [12, 42], 'italy': [12, 42], 'espagne': [-4, 40], 'spain': [-4, 40],
  'royaume-uni': [-2, 54], 'united kingdom': [-2, 54], 'uk': [-2, 54],
  'etats-unis': [-98, 39], 'united states': [-98, 39], 'usa': [-98, 39],
  'russie': [60, 60], 'russia': [60, 60], 'chine': [105, 35], 'china': [105, 35],
  'japon': [138, 36], 'japan': [138, 36], 'inde': [78, 22], 'india': [78, 22],
  'bresil': [-50, -14], 'brazil': [-50, -14], 'canada': [-100, 56],
  'ukraine': [32, 49], 'turquie': [32, 39], 'turkey': [32, 39],
  'iran': [53, 32], 'irak': [44, 33], 'iraq': [44, 33],
  'israel': [35, 31], 'palestine': [35, 32],
  'syrie': [38, 35], 'syria': [38, 35], 'liban': [36, 34], 'lebanon': [36, 34],
  'egypte': [30, 26], 'egypt': [30, 26], 'maroc': [-6, 32], 'morocco': [-6, 32],
  'arabie saoudite': [45, 24], 'saudi arabia': [45, 24],
  'coree du sud': [127, 37], 'south korea': [127, 37],
  'coree du nord': [127, 40], 'north korea': [127, 40],
  'australie': [135, -25], 'australia': [135, -25],
  'afrique du sud': [25, -29], 'south africa': [25, -29],
  'pologne': [20, 52], 'poland': [20, 52],
  'mexique': [-102, 23], 'mexico country': [-102, 23],
  'algerie': [3, 28], 'algeria': [3, 28],
  'tunisie': [9, 34], 'tunisia': [9, 34],
  'libye': [17, 27], 'libya': [17, 27],
  'yemen': [48, 15.5], 'oman': [57, 21],
  'afghanistan': [67, 33], 'pakistan': [70, 30],
  'nigeria': [8, 10], 'kenya': [38, 0],
  'ethiopie': [40, 9], 'ethiopia': [40, 9],
  'soudan': [30, 13], 'sudan': [30, 13],
  'taiwan': [121, 24], 'philippines': [122, 13],
  'vietnam': [108, 14], 'thailande': [100, 15], 'thailand': [100, 15],
  'indonesie': [118, -2], 'indonesia': [118, -2],
  'malaisie': [101, 4], 'malaysia': [101, 4],
  'colombie': [-74, 4], 'colombia': [-74, 4],
  'argentine': [-64, -34], 'argentina': [-64, -34],
  'chili': [-71, -33], 'chile': [-71, -33],
  'perou': [-76, -10], 'peru': [-76, -10],
  'venezuela': [-66, 8],
  'grece': [22, 39], 'greece': [22, 39],
  'roumanie': [25, 46], 'romania': [25, 46],
  'norvege': [8, 62], 'norway': [8, 62],
  'suede': [15, 62], 'sweden': [15, 62],
  'finlande': [26, 64], 'finland': [26, 64],
  'danemark': [10, 56], 'denmark': [10, 56],
  'suisse': [8, 47], 'switzerland': [8, 47],
  'autriche': [14, 47], 'austria': [14, 47],
  'belgique': [4, 50.5], 'belgium': [4, 50.5],
  'pays-bas': [5, 52], 'netherlands': [5, 52],
  'portugal': [-8, 39],
  'irlande': [-8, 53], 'ireland': [-8, 53],
};

// ==========================================
// Simplified continent outlines [lon, lat][]
// ==========================================

const CONTINENTS: [number, number][][] = [
  // North America
  [
    [-170,72], [-140,60], [-130,55], [-125,48], [-118,34], [-105,25], [-100,20],
    [-90,15], [-85,10], [-80,8], [-78,10], [-82,25], [-81,30], [-75,35],
    [-74,41], [-68,45], [-55,47], [-50,55], [-55,60], [-65,65], [-80,70],
    [-95,72], [-125,72], [-155,72], [-170,72],
  ],
  // South America
  [
    [-80,10], [-77,5], [-72,-3], [-72,-15], [-62,-10], [-50,-3], [-45,0],
    [-35,-5], [-38,-15], [-45,-23], [-50,-28], [-55,-35], [-60,-42],
    [-68,-55], [-75,-50], [-72,-40], [-72,-30], [-75,-15], [-80,-5], [-80,10],
  ],
  // Europe
  [
    [-10,36], [0,38], [3,43], [-5,48], [-10,53], [-5,58], [5,54],
    [12,55], [20,55], [25,60], [30,62], [32,70], [28,71],
    [20,70], [5,62], [-5,62], [-10,58], [-10,36],
  ],
  // Africa
  [
    [-17,15], [-17,12], [-12,5], [0,5], [10,3], [12,-2], [18,-8],
    [25,-15], [33,-22], [35,-34], [28,-34], [18,-35], [12,-18],
    [10,-5], [20,0], [30,5], [35,10], [43,12], [50,12],
    [42,0], [45,-5], [40,-12], [35,-5], [25,5],
    [15,10], [5,15], [-5,15], [-17,15],
  ],
  // Asia (mainland)
  [
    [30,42], [40,42], [45,38], [50,38], [55,25], [60,25], [65,30],
    [70,25], [75,15], [80,8], [85,20], [90,22], [95,15], [100,5],
    [105,-5], [110,-8], [115,0], [120,15], [122,25], [125,33],
    [130,35], [135,35], [140,42], [145,45], [150,60], [160,63],
    [170,65], [180,70], [180,72], [150,72], [120,72], [90,75],
    [60,72], [50,55], [45,50], [40,48], [35,42], [30,42],
  ],
  // Australia
  [
    [113,-12], [130,-12], [135,-15], [140,-18], [148,-20], [153,-25],
    [152,-32], [147,-38], [138,-36], [130,-33], [120,-34], [115,-35],
    [115,-30], [115,-22], [120,-15], [113,-12],
  ],
];

// ==========================================
// Projection helpers
// ==========================================

function resolveCoords(place: string, country?: string): [number, number] | null {
  const key = place.toLowerCase().trim();
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  if (COUNTRY_CENTERS[key]) return COUNTRY_CENTERS[key];
  if (country) {
    const cKey = country.toLowerCase().trim();
    if (COUNTRY_CENTERS[cKey]) return COUNTRY_CENTERS[cKey];
  }
  return null;
}

interface Bounds {
  minLon: number; maxLon: number; minLat: number; maxLat: number;
}

function getBounds(points: { lon: number; lat: number }[]): Bounds {
  if (points.length === 0) return { minLon: -180, maxLon: 180, minLat: -60, maxLat: 80 };

  const lons = points.map(p => p.lon);
  const lats = points.map(p => p.lat);

  let minLon = Math.min(...lons);
  let maxLon = Math.max(...lons);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);

  // Ensure minimum span so single-point doesn't collapse
  const lonSpan = Math.max(maxLon - minLon, 25);
  const latSpan = Math.max(maxLat - minLat, 18);

  // Add 30% padding
  const padLon = lonSpan * 0.3;
  const padLat = latSpan * 0.3;
  minLon -= padLon;
  maxLon += padLon;
  minLat -= padLat;
  maxLat += padLat;

  // Maintain ~16:9 aspect ratio
  const currentLonSpan = maxLon - minLon;
  const currentLatSpan = maxLat - minLat;
  const targetRatio = 1.75; // 600/340 ≈ 1.76
  const currentRatio = currentLonSpan / currentLatSpan;

  if (currentRatio < targetRatio) {
    const extraLon = (currentLatSpan * targetRatio - currentLonSpan) / 2;
    minLon -= extraLon;
    maxLon += extraLon;
  } else {
    const extraLat = (currentLonSpan / targetRatio - currentLatSpan) / 2;
    minLat -= extraLat;
    maxLat += extraLat;
  }

  // Clamp to world bounds
  return {
    minLon: Math.max(minLon, -180),
    maxLon: Math.min(maxLon, 180),
    minLat: Math.max(minLat, -75),
    maxLat: Math.min(maxLat, 85),
  };
}

const VIEW_W = 600;
const VIEW_H = 340;
const PAD = 30;

function project(lon: number, lat: number, b: Bounds): { x: number; y: number } {
  const w = VIEW_W - 2 * PAD;
  const h = VIEW_H - 2 * PAD;
  const x = PAD + ((lon - b.minLon) / (b.maxLon - b.minLon)) * w;
  const y = PAD + ((b.maxLat - lat) / (b.maxLat - b.minLat)) * h;
  return { x, y };
}

function continentPath(points: [number, number][], b: Bounds): string {
  const projected = points.map(([lon, lat]) => project(lon, lat, b));
  return projected.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  ).join(' ') + ' Z';
}

// ==========================================
// Type badge mapping
// ==========================================

const TYPE_LABELS: Record<string, string> = {
  city: 'ville',
  country: 'pays',
  region: 'r\u00e9gion',
  waterway: 'voie maritime',
  base: 'base',
};

// ==========================================
// Component
// ==========================================

interface ResolvedLocation {
  place: string;
  type: string;
  role: string;
  country?: string;
  lon: number;
  lat: number;
}

interface ProjectedLocation extends ResolvedLocation {
  x: number;
  y: number;
}

interface GeoSvgWidgetProps {
  synthesis: SynthesisData;
}

export default function GeoSvgWidget({ synthesis }: GeoSvgWidgetProps) {
  const relevance = synthesis.geoRelevance || 'none';
  const locations = synthesis.geographicContext || [];

  // Resolve locations to coordinates
  const resolved = useMemo<ResolvedLocation[]>(() => {
    const seen = new Set<string>();
    const result: ResolvedLocation[] = [];

    for (const loc of locations) {
      const place = (loc.place || '').trim();
      if (!place) continue;
      const key = place.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const coords = resolveCoords(place, loc.country);
      if (!coords) continue;

      result.push({
        place,
        type: loc.type || 'city',
        role: loc.role || '',
        country: loc.country,
        lon: coords[0],
        lat: coords[1],
      });
    }
    return result;
  }, [locations]);

  // Calculate bounds
  const bounds = useMemo(() => getBounds(resolved), [resolved]);

  // Project locations
  const projected = useMemo<ProjectedLocation[]>(() => {
    return resolved.map(loc => ({
      ...loc,
      ...project(loc.lon, loc.lat, bounds),
    }));
  }, [resolved, bounds]);

  // Generate graticule lines within bounds
  const graticules = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; isMain: boolean }[] = [];
    const lonSpan = bounds.maxLon - bounds.minLon;
    const latSpan = bounds.maxLat - bounds.minLat;

    // Choose grid interval based on zoom
    const lonStep = lonSpan > 200 ? 30 : lonSpan > 80 ? 20 : 10;
    const latStep = latSpan > 100 ? 20 : latSpan > 50 ? 10 : 5;

    // Latitude lines (horizontal)
    const latStart = Math.ceil(bounds.minLat / latStep) * latStep;
    for (let lat = latStart; lat <= bounds.maxLat; lat += latStep) {
      const s = project(bounds.minLon, lat, bounds);
      const e = project(bounds.maxLon, lat, bounds);
      lines.push({ x1: s.x, y1: s.y, x2: e.x, y2: e.y, isMain: lat === 0 });
    }

    // Longitude lines (vertical)
    const lonStart = Math.ceil(bounds.minLon / lonStep) * lonStep;
    for (let lon = lonStart; lon <= bounds.maxLon; lon += lonStep) {
      const s = project(lon, bounds.maxLat, bounds);
      const e = project(lon, bounds.minLat, bounds);
      lines.push({ x1: s.x, y1: s.y, x2: e.x, y2: e.y, isMain: lon === 0 });
    }

    return lines;
  }, [bounds]);

  // Generate connection arcs between sequential locations
  const arcs = useMemo(() => {
    if (projected.length < 2) return [];
    const result: { d: string; len: number }[] = [];

    for (let i = 0; i < projected.length - 1; i++) {
      const a = projected[i];
      const b = projected[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const curvature = Math.min(dist * 0.3, 50);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - curvature;

      result.push({
        d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`,
        len: Math.ceil(dist * 1.3),
      });
    }
    return result;
  }, [projected]);

  // Don't render if no relevant geography
  if (relevance === 'none' || resolved.length === 0) return null;

  // Build CSS animations for arcs (each needs unique dasharray/offset)
  const arcCss = arcs.map((arc, i) => `
    .np-geo-arc-${i} {
      stroke-dasharray: ${arc.len};
      stroke-dashoffset: ${arc.len};
      animation: npGeoArcDraw${i} 1.2s ease-out ${0.8 + i * 0.4}s forwards;
    }
    @keyframes npGeoArcDraw${i} {
      to { stroke-dashoffset: 0; }
    }
  `).join('');

  return (
    <div style={styles.container}>
      <h3 style={styles.sectionTitle}>{'G\u00c9OGRAPHIE DE L\u2019\u00c9V\u00c9NEMENT'}</h3>

      {/* Animated SVG Map */}
      <div style={styles.mapContainer}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          aria-label="Carte des lieux mentionn\u00e9s"
        >
          <style>{`
            @keyframes npGeoMarkerIn {
              0% { transform: scale(0); opacity: 0; }
              50% { transform: scale(1.5); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes npGeoPulse {
              0%, 100% { opacity: 0.7; }
              50% { opacity: 0.2; }
            }
            @keyframes npGeoLabelIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            ${arcCss}
          `}</style>

          {/* Background */}
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#FAFBFC" rx="4" />

          {/* Continent outlines */}
          {CONTINENTS.map((cont, i) => (
            <path
              key={`cont-${i}`}
              d={continentPath(cont, bounds)}
              fill="#F0F1F3"
              stroke="#E2E4E8"
              strokeWidth="0.6"
              strokeLinejoin="round"
            />
          ))}

          {/* Graticule grid */}
          {graticules.map((line, i) => (
            <line
              key={`grid-${i}`}
              x1={line.x1} y1={line.y1}
              x2={line.x2} y2={line.y2}
              stroke={line.isMain ? '#D1D5DB' : '#E5E7EB'}
              strokeWidth={line.isMain ? 0.8 : 0.4}
              strokeDasharray={line.isMain ? 'none' : '2,4'}
              opacity={line.isMain ? 0.6 : 0.4}
            />
          ))}

          {/* Connection arcs */}
          {arcs.map((arc, i) => (
            <path
              key={`arc-${i}`}
              className={`np-geo-arc-${i}`}
              d={arc.d}
              fill="none"
              stroke="#DC2626"
              strokeWidth="1.5"
              opacity="0.35"
              strokeLinecap="round"
            />
          ))}

          {/* Markers + Labels */}
          {projected.map((loc, i) => {
            // Position label to avoid edge overflow
            const labelRight = loc.x < VIEW_W * 0.7;
            const labelX = labelRight ? loc.x + 10 : loc.x - 10;
            const anchor = labelRight ? 'start' : 'end';
            const delay = 0.3 + i * 0.25;

            return (
              <g key={`loc-${i}`}>
                {/* Pulse ring */}
                <circle
                  cx={loc.x} cy={loc.y} r="12"
                  fill="none" stroke="#DC2626" strokeWidth="1"
                  opacity="0"
                  style={{
                    animation: `npGeoPulse 2s ease-in-out ${delay + 0.5}s infinite`,
                  }}
                />

                {/* Marker dot */}
                <circle
                  cx={loc.x} cy={loc.y} r="5"
                  fill="#DC2626" stroke="#fff" strokeWidth="2"
                  style={{
                    transformOrigin: `${loc.x}px ${loc.y}px`,
                    animation: `npGeoMarkerIn 0.5s ease-out ${delay}s both`,
                  }}
                />

                {/* Label */}
                <text
                  x={labelX} y={loc.y + 4}
                  fill="#1F2937"
                  fontSize="11"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fontWeight="600"
                  textAnchor={anchor}
                  style={{
                    animation: `npGeoLabelIn 0.4s ease-out ${delay + 0.3}s both`,
                  }}
                >
                  {loc.place}
                </text>

                {/* Subtle type indicator */}
                {loc.type === 'country' && (
                  <rect
                    x={loc.x - 3} y={loc.y - 3}
                    width="6" height="6"
                    fill="none" stroke="#DC2626" strokeWidth="1"
                    rx="1"
                    style={{
                      transformOrigin: `${loc.x}px ${loc.y}px`,
                      animation: `npGeoMarkerIn 0.5s ease-out ${delay}s both`,
                    }}
                  />
                )}
              </g>
            );
          })}

          {/* Credit line */}
          <text
            x={VIEW_W - PAD} y={VIEW_H - 8}
            fill="#9CA3AF" fontSize="8"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
            textAnchor="end"
          >
            NovaPress AI
          </text>
        </svg>
      </div>

      {/* Location list */}
      {resolved.length > 0 && (
        <div style={styles.locationList}>
          {resolved.slice(0, 6).map((loc, i) => (
            <div key={i} style={styles.locationItem}>
              <div style={{
                ...styles.locationDot,
                borderRadius: loc.type === 'country' ? '2px' : '50%',
              }} />
              <div style={styles.locationText}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={styles.locationName}>{loc.place}</span>
                  {TYPE_LABELS[loc.type] && (
                    <span style={styles.locationBadge}>{TYPE_LABELS[loc.type]}</span>
                  )}
                </div>
                {loc.role && (
                  <span style={styles.locationRole}>{loc.role}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// Styles
// ==========================================

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
    marginBottom: '16px',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid #E5E7EB',
    backgroundColor: '#FAFBFC',
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
  locationDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#DC2626',
    flexShrink: 0,
    marginTop: '5px',
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
