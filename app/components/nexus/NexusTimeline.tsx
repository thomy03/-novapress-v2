'use client';

import React from 'react';

interface TimelineMarker {
  x: number;
  label: string;
  isNow?: boolean;
  zone: 'past' | 'present' | 'future';
}

interface NexusTimelineProps {
  markers: TimelineMarker[];
  y: number;
  width: number;
  paddingX: number;
}

const ZONE_LINE_COLORS = {
  past: '#06B6D4',
  present: '#3B82F6',
  future: '#F59E0B',
};

export default function NexusTimeline({ markers, y, width, paddingX }: NexusTimelineProps) {
  if (markers.length === 0) return null;

  const startX = paddingX;
  const endX = width - paddingX;
  const lineY = y;

  // Find the "now" marker for gradient split
  const nowMarker = markers.find((m) => m.isNow);
  const nowX = nowMarker ? nowMarker.x : endX * 0.65;
  const gradientId = 'timeline-gradient';

  return (
    <g>
      {/* Gradient definition */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.6" />
          <stop offset={`${((nowX - startX) / (endX - startX)) * 100}%`} stopColor="#3B82F6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Main timeline line */}
      <line
        x1={startX}
        y1={lineY}
        x2={endX}
        y2={lineY}
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
      />

      {/* Zone labels */}
      <text x={startX + 20} y={lineY - 18} fontSize="9" fill="#06B6D4" fontFamily="var(--font-mono)" letterSpacing="0.1em" opacity={0.6}>
        FONDATIONS
      </text>
      <text x={nowX - 30} y={lineY - 18} fontSize="9" fill="#3B82F6" fontFamily="var(--font-mono)" letterSpacing="0.1em" opacity={0.6}>
        ACTUEL
      </text>
      <text x={endX - 80} y={lineY - 18} fontSize="9" fill="#F59E0B" fontFamily="var(--font-mono)" letterSpacing="0.1em" opacity={0.6}>
        PROJECTIONS
      </text>

      {/* Markers */}
      {markers.map((marker, i) => (
        <g key={`marker-${i}`}>
          {/* Vertical dashed line from timeline to node area */}
          <line
            x1={marker.x}
            y1={lineY - 8}
            x2={marker.x}
            y2={lineY + 8}
            stroke={ZONE_LINE_COLORS[marker.zone]}
            strokeWidth={marker.isNow ? 2 : 1}
            opacity={marker.isNow ? 0.8 : 0.4}
          />

          {/* Dot on timeline */}
          <circle
            cx={marker.x}
            cy={lineY}
            r={marker.isNow ? 5 : 3}
            fill={ZONE_LINE_COLORS[marker.zone]}
            opacity={marker.isNow ? 1 : 0.6}
          />

          {/* NOW pulsing indicator */}
          {marker.isNow && (
            <>
              <circle
                cx={marker.x}
                cy={lineY}
                r={5}
                fill="none"
                stroke="#3B82F6"
                strokeWidth={1.5}
                className="nexus-now-pulse"
              />
              <text
                x={marker.x}
                y={lineY + 22}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#3B82F6"
                fontFamily="var(--font-mono)"
              >
                NOW
              </text>
            </>
          )}

          {/* Date label */}
          {!marker.isNow && (
            <text
              x={marker.x}
              y={lineY + 20}
              textAnchor="middle"
              fontSize="8"
              fill="#64748B"
              fontFamily="var(--font-mono)"
            >
              {marker.label}
            </text>
          )}
        </g>
      ))}

      {/* Arrow at end */}
      <polygon
        points={`${endX},${lineY - 4} ${endX + 8},${lineY} ${endX},${lineY + 4}`}
        fill="#F59E0B"
        opacity={0.4}
      />
    </g>
  );
}
