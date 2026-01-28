'use client';

import React, { useState, useEffect, memo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup
} from 'react-simple-maps';

// World map GeoJSON URL (Natural Earth simplified)
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface GeoMention {
  country: string;
  country_code: string;
  count: number;
  context?: string;
}

interface GeoMentionMapProps {
  synthesisId: string;
  mentions?: GeoMention[];
  title?: string;
  height?: number;
}

// Country name mapping (ISO Alpha-3 to Alpha-2 for our data)
const COUNTRY_CODE_MAP: Record<string, string> = {
  "USA": "US", "GBR": "GB", "FRA": "FR", "DEU": "DE", "ITA": "IT",
  "ESP": "ES", "CAN": "CA", "AUS": "AU", "JPN": "JP", "CHN": "CN",
  "RUS": "RU", "BRA": "BR", "IND": "IN", "MEX": "MX", "ARG": "AR",
  "KOR": "KR", "PRK": "KP", "VNM": "VN", "THA": "TH", "IDN": "ID",
  "MYS": "MY", "SGP": "SG", "PHL": "PH", "PAK": "PK", "BGD": "BD",
  "NLD": "NL", "BEL": "BE", "CHE": "CH", "AUT": "AT", "POL": "PL",
  "SWE": "SE", "NOR": "NO", "DNK": "DK", "FIN": "FI", "PRT": "PT",
  "GRC": "GR", "TUR": "TR", "UKR": "UA", "CZE": "CZ", "HUN": "HU",
  "ROU": "RO", "IRN": "IR", "IRQ": "IQ", "SAU": "SA", "ARE": "AE",
  "ISR": "IL", "PSE": "PS", "EGY": "EG", "ZAF": "ZA", "NGA": "NG",
  "KEN": "KE", "MAR": "MA", "DZA": "DZ", "TUN": "TN", "VEN": "VE",
  "COL": "CO", "PER": "PE", "CHL": "CL", "QAT": "QA", "KWT": "KW"
};

const getCountryColor = (countryCode: string, mentions: GeoMention[]): string => {
  // Find if this country is mentioned
  const mention = mentions.find(m => m.country_code === countryCode);

  if (!mention) {
    return '#E5E5E5'; // Not mentioned - light gray
  }

  // Color based on mention count
  if (mention.count >= 5) {
    return '#DC2626'; // Red - many mentions
  } else if (mention.count >= 3) {
    return '#F59E0B'; // Amber - moderate
  } else {
    return '#3B82F6'; // Blue - few mentions
  }
};

const CustomTooltip = memo(({ content }: { content: string }) => (
  <div style={{
    position: 'absolute',
    backgroundColor: '#fff',
    border: '1px solid #E5E5E5',
    borderRadius: '4px',
    padding: '8px 12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    fontSize: '12px',
    pointerEvents: 'none',
    zIndex: 1000,
    maxWidth: '200px'
  }}>
    {content}
  </div>
));

CustomTooltip.displayName = 'CustomTooltip';

export default function GeoMentionMap({
  synthesisId,
  mentions: propMentions,
  title = "Zones Géographiques Mentionnées",
  height = 300
}: GeoMentionMapProps) {
  const [mentions, setMentions] = useState<GeoMention[]>(propMentions || []);
  const [loading, setLoading] = useState(!propMentions);
  const [error, setError] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<string>('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (propMentions) {
      setMentions(propMentions);
      setLoading(false);
      return;
    }

    const fetchMentions = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/artifacts/syntheses/${synthesisId}/geo-mentions`
        );

        if (!response.ok) {
          throw new Error('Impossible de charger les données géographiques');
        }

        const data = await response.json();
        setMentions(data.mentions || []);
      } catch (err) {
        console.error('Error fetching geo mentions:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchMentions();
  }, [synthesisId, propMentions]);

  const handleMouseEnter = (geo: any, evt: React.MouseEvent) => {
    const { NAME, ISO_A3 } = geo.properties;
    const countryCode = COUNTRY_CODE_MAP[ISO_A3] || ISO_A3;
    const mention = mentions.find(m => m.country_code === countryCode);

    if (mention) {
      setTooltipContent(`${mention.country}: ${mention.count} mention${mention.count > 1 ? 's' : ''}`);
      setTooltipPosition({ x: evt.clientX, y: evt.clientY });
      setShowTooltip(true);
    } else {
      setTooltipContent(NAME);
      setTooltipPosition({ x: evt.clientX, y: evt.clientY });
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  if (loading) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: '#F9FAFB',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#6B7280', margin: 0 }}>Chargement de la carte...</p>
      </div>
    );
  }

  if (error || mentions.length === 0) {
    return null; // Don't show anything if no data
  }

  return (
    <div style={{
      marginTop: '32px',
      padding: '24px',
      backgroundColor: '#fff',
      border: '1px solid #E5E5E5',
      borderRadius: '8px',
      position: 'relative'
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: '16px',
        fontWeight: 600,
        fontFamily: 'Georgia, serif',
        color: '#000'
      }}>
        {title}
      </h3>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '16px',
        fontSize: '12px'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: '12px',
            height: '12px',
            backgroundColor: '#DC2626',
            borderRadius: '2px'
          }} />
          <span style={{ color: '#6B7280' }}>Fortement mentionné</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: '12px',
            height: '12px',
            backgroundColor: '#F59E0B',
            borderRadius: '2px'
          }} />
          <span style={{ color: '#6B7280' }}>Modérément</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            width: '12px',
            height: '12px',
            backgroundColor: '#3B82F6',
            borderRadius: '2px'
          }} />
          <span style={{ color: '#6B7280' }}>Mentionné</span>
        </span>
      </div>

      {/* Mentioned countries list */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '16px'
      }}>
        {mentions.slice(0, 10).map((mention) => (
          <span
            key={mention.country_code}
            style={{
              padding: '4px 8px',
              backgroundColor: mention.count >= 5 ? '#FEE2E2' :
                             mention.count >= 3 ? '#FEF3C7' : '#DBEAFE',
              color: mention.count >= 5 ? '#DC2626' :
                    mention.count >= 3 ? '#D97706' : '#2563EB',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 500
            }}
          >
            {mention.country} ({mention.count})
          </span>
        ))}
      </div>

      {/* Map */}
      <div style={{ width: '100%', height: height }}>
        <ComposableMap
          projectionConfig={{
            rotate: [-10, 0, 0],
            scale: 147
          }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup center={[0, 20]} zoom={1}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const { ISO_A3 } = geo.properties;
                  const countryCode = COUNTRY_CODE_MAP[ISO_A3] || ISO_A3;
                  const color = getCountryColor(countryCode, mentions);
                  const isMentioned = mentions.some(m => m.country_code === countryCode);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={(evt) => handleMouseEnter(geo, evt)}
                      onMouseLeave={handleMouseLeave}
                      style={{
                        default: {
                          fill: color,
                          stroke: '#FFFFFF',
                          strokeWidth: 0.5,
                          outline: 'none'
                        },
                        hover: {
                          fill: isMentioned ? '#1D4ED8' : '#D1D5DB',
                          stroke: '#FFFFFF',
                          strokeWidth: 0.5,
                          outline: 'none',
                          cursor: 'pointer'
                        },
                        pressed: {
                          fill: '#1E40AF',
                          stroke: '#FFFFFF',
                          strokeWidth: 0.5,
                          outline: 'none'
                        }
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
      {showTooltip && (
        <div style={{
          position: 'fixed',
          left: tooltipPosition.x + 10,
          top: tooltipPosition.y - 30,
          backgroundColor: '#fff',
          border: '1px solid #E5E5E5',
          borderRadius: '4px',
          padding: '6px 10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          fontSize: '12px',
          pointerEvents: 'none',
          zIndex: 1000
        }}>
          {tooltipContent}
        </div>
      )}
    </div>
  );
}
