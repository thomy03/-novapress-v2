'use client';

import React from 'react';

interface SentimentPoint {
  date: string;
  sentiment: number | string;
  title?: string;
}

interface TopicSentimentSparklineProps {
  data: SentimentPoint[];
}

function parseSentiment(val: number | string): number {
  if (typeof val === 'number') return val;
  const str = String(val).toLowerCase();
  if (str === 'positive' || str === 'positif') return 1;
  if (str === 'negative' || str === 'n\u00e9gatif' || str === 'negatif') return -1;
  return 0;
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#10B981',
  neutral:  '#9CA3AF',
  negative: '#DC2626',
};

function getSentimentColor(value: number): string {
  if (value > 0) return SENTIMENT_COLORS.positive;
  if (value < 0) return SENTIMENT_COLORS.negative;
  return SENTIMENT_COLORS.neutral;
}

export default function TopicSentimentSparkline({ data }: TopicSentimentSparklineProps) {
  if (data.length === 0) return null;

  const parsed = data.map(d => ({
    ...d,
    numericSentiment: parseSentiment(d.sentiment),
  }));

  const SVG_WIDTH = 300;
  const SVG_HEIGHT = 80;
  const PADDING_X = 20;
  const PADDING_Y = 16;
  const plotW = SVG_WIDTH - PADDING_X * 2;
  const plotH = SVG_HEIGHT - PADDING_Y * 2;

  // Map to coordinates. Y: -1 = bottom, +1 = top
  const points = parsed.map((p, i) => {
    const x = PADDING_X + (parsed.length > 1 ? (i / (parsed.length - 1)) * plotW : plotW / 2);
    const y = PADDING_Y + ((1 - p.numericSentiment) / 2) * plotH;
    return { x, y, sentiment: p.numericSentiment };
  });

  // Polyline path
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  // Trend arrow (compare last to first)
  const trend = parsed.length >= 2
    ? parsed[parsed.length - 1].numericSentiment - parsed[0].numericSentiment
    : 0;
  const trendSymbol = trend > 0 ? '\u2191' : trend < 0 ? '\u2193' : '\u2192';
  const trendColor = trend > 0 ? '#10B981' : trend < 0 ? '#DC2626' : '#9CA3AF';

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '1.5px',
          color: '#6B7280',
          textTransform: 'uppercase',
        }}>
          Sentiment
        </span>
        <span style={{
          fontSize: '16px',
          fontWeight: 700,
          color: trendColor,
        }}>
          {trendSymbol}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        height={SVG_HEIGHT}
        style={{ overflow: 'visible' }}
      >
        {/* Zero line */}
        <line
          x1={PADDING_X}
          y1={PADDING_Y + plotH / 2}
          x2={PADDING_X + plotW}
          y2={PADDING_Y + plotH / 2}
          stroke="#E5E5E5"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Polyline connecting points */}
        {points.length > 1 && (
          <polyline
            points={polyline}
            fill="none"
            stroke="#374151"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={getSentimentColor(p.sentiment)}
            stroke="#FFF"
            strokeWidth={1.5}
          />
        ))}
      </svg>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: '#9CA3AF',
        marginTop: '4px',
        paddingLeft: `${PADDING_X}px`,
        paddingRight: `${PADDING_X}px`,
      }}>
        <span>Positif</span>
        <span>Neutre</span>
        <span>N\u00e9gatif</span>
      </div>
    </div>
  );
}
