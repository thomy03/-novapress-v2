'use client';

import React, { useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  CartesianGrid,
} from 'recharts';
import {
  NovaLineData,
  NovaLinePoint,
  NOVALINE_THEME,
  NOVALINE_PHASE_COLORS,
} from '@/app/types/novaline';
import { NovaLineTooltip, ContradictionTooltip } from './NovaLineTooltip';

interface NovaLineHorizontalProps {
  data: NovaLineData;
  height?: number;
  showPredictions?: boolean;
  onPointClick?: (point: NovaLinePoint) => void;
}

/**
 * NovaLine Horizontal - Desktop version
 * Displays tension curve with past events, present marker, and future predictions
 */
export function NovaLineHorizontal({
  data,
  height = 280,
  showPredictions = true,
  onPointClick,
}: NovaLineHorizontalProps) {
  const [hoveredContradiction, setHoveredContradiction] = useState<NovaLinePoint | null>(null);

  // Prepare chart data
  const chartData = useMemo(() => {
    const points = [...data.points];

    // Find present point index
    const presentIndex = points.findIndex((p) => p.isPresent);

    // Add prediction points
    if (showPredictions && data.predictions.length > 0) {
      data.predictions.forEach((prediction, pIndex) => {
        prediction.points.forEach((point) => {
          points.push({
            ...point,
            scenarioLabel: prediction.label,
            probability: prediction.probability,
          } as NovaLinePoint & { scenarioLabel: string; probability: number });
        });
      });
    }

    return points.map((point, index) => ({
      ...point,
      index,
      displayDate: point.dateFormatted,
      // Cone of uncertainty (for future points)
      coneUpper: point.isFuture ? point.tension + 15 : null,
      coneLower: point.isFuture ? point.tension - 15 : null,
    }));
  }, [data, showPredictions]);

  // Find indices for visual markers
  const presentPointIndex = chartData.findIndex((p) => p.isPresent);
  const presentPoint = chartData[presentPointIndex];

  // Custom dot renderer
  const renderDot = (props: { cx?: number; cy?: number; payload?: NovaLinePoint }) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy || !payload) return null;

    const isPresent = payload.isPresent;
    const isFuture = payload.isFuture;
    const hasContradiction = payload.hasContradiction;

    // Point size based on type
    const radius = isPresent ? 8 : isFuture ? 5 : 6;

    // Point color
    let fill = NOVALINE_THEME.pointPast;
    if (isPresent) fill = NOVALINE_THEME.pointPresent;
    if (isFuture) fill = NOVALINE_THEME.pointFuture;

    return (
      <g key={payload.id}>
        {/* Main point */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={fill}
          stroke={NOVALINE_THEME.background}
          strokeWidth={2}
          style={{
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          className={isPresent ? 'novaline-present' : ''}
          onClick={() => onPointClick?.(payload)}
        />

        {/* Pulse animation ring for present point */}
        {isPresent && (
          <circle
            cx={cx}
            cy={cy}
            r={radius + 4}
            fill="none"
            stroke={NOVALINE_THEME.pointPresent}
            strokeWidth={2}
            opacity={0.5}
            className="novaline-pulse-ring"
          />
        )}

        {/* Contradiction marker */}
        {hasContradiction && (
          <g
            onMouseEnter={() => setHoveredContradiction(payload)}
            onMouseLeave={() => setHoveredContradiction(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={cx + 12}
              cy={cy - 12}
              r={8}
              fill={NOVALINE_THEME.contradiction}
            />
            <text
              x={cx + 12}
              y={cy - 8}
              textAnchor="middle"
              fontSize={10}
              fill={NOVALINE_THEME.background}
            >
              ⚠️
            </text>
          </g>
        )}
      </g>
    );
  };

  // Custom active dot (on hover)
  const renderActiveDot = (props: { cx?: number; cy?: number; payload?: NovaLinePoint }) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy || !payload) return null;

    return (
      <circle
        cx={cx}
        cy={cy}
        r={payload.isPresent ? 10 : 8}
        fill={payload.isPresent ? NOVALINE_THEME.pointPresent : NOVALINE_PHASE_COLORS[payload.phase]}
        stroke={NOVALINE_THEME.background}
        strokeWidth={3}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
      />
    );
  };

  // State to track if container is mounted
  const [isContainerReady, setIsContainerReady] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Wait for container to be mounted before rendering chart
  React.useEffect(() => {
    if (containerRef.current) {
      setIsContainerReady(true);
    }
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: NOVALINE_THEME.background,
        borderRadius: '4px',
        padding: '16px 8px 8px',
      }}
    >
      {/* Title */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          paddingLeft: '8px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: NOVALINE_THEME.text,
            fontFamily: 'Georgia, serif',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          Evolution de l'actualite
        </h3>
        {data.daysTracked > 0 && (
          <span
            style={{
              fontSize: '11px',
              color: NOVALINE_THEME.textSecondary,
            }}
          >
            {data.daysTracked} jours suivis
          </span>
        )}
      </div>

      {/* Chart - wrapped in div with explicit dimensions to prevent -1 error */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: height,
          minHeight: height,
          minWidth: 200
        }}
      >
        {isContainerReady && (
          <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
        >
          {/* Grid */}
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={NOVALINE_THEME.grid}
            vertical={false}
          />

          {/* Axes */}
          <XAxis
            dataKey="displayDate"
            axisLine={{ stroke: NOVALINE_THEME.grid }}
            tickLine={false}
            tick={{
              fontSize: 10,
              fill: NOVALINE_THEME.textSecondary,
            }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{
              fontSize: 10,
              fill: NOVALINE_THEME.textSecondary,
            }}
            tickFormatter={(value) => `${value}`}
            width={30}
          />

          {/* Cone of uncertainty (for future) */}
          {showPredictions && (
            <Area
              dataKey="coneUpper"
              stroke="none"
              fill={NOVALINE_THEME.coneBackground}
              connectNulls={false}
            />
          )}

          {/* Reference line at "Today" */}
          {presentPoint && (
            <ReferenceLine
              x={presentPoint.displayDate}
              stroke={NOVALINE_THEME.pointPresent}
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: "AUJOURD'HUI",
                position: 'top',
                fill: NOVALINE_THEME.pointPresent,
                fontSize: 9,
                fontWeight: 600,
              }}
            />
          )}

          {/* Main tension line (past) */}
          <Line
            type="monotone"
            dataKey="tension"
            stroke={NOVALINE_THEME.linePast}
            strokeWidth={2}
            dot={renderDot}
            activeDot={renderActiveDot}
            connectNulls={false}
          />

          {/* Tooltip */}
          <Tooltip
            content={<NovaLineTooltip />}
            cursor={{
              stroke: NOVALINE_THEME.textSecondary,
              strokeDasharray: '4 4',
            }}
          />
          </ComposedChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* Contradiction tooltip overlay */}
      {hoveredContradiction && hoveredContradiction.contradiction && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
          }}
        >
          <ContradictionTooltip contradiction={hoveredContradiction.contradiction} />
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: `1px solid ${NOVALINE_THEME.grid}`,
        }}
      >
        <LegendItem color={NOVALINE_THEME.linePast} label="Passé" solid />
        <LegendItem color={NOVALINE_THEME.pointPresent} label="Maintenant" dot />
        {showPredictions && data.predictions.length > 0 && (
          <LegendItem color={NOVALINE_THEME.lineFuture} label="Prédictions" dashed />
        )}
        {data.contradictions.length > 0 && (
          <LegendItem color={NOVALINE_THEME.contradiction} label="Contradiction" icon="⚠️" />
        )}
      </div>
    </div>
  );
}

// Legend item component
function LegendItem({
  color,
  label,
  solid,
  dashed,
  dot,
  icon,
}: {
  color: string;
  label: string;
  solid?: boolean;
  dashed?: boolean;
  dot?: boolean;
  icon?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {solid && (
        <div
          style={{
            width: '16px',
            height: '2px',
            backgroundColor: color,
          }}
        />
      )}
      {dashed && (
        <div
          style={{
            width: '16px',
            height: '2px',
            backgroundImage: `repeating-linear-gradient(90deg, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`,
          }}
        />
      )}
      {dot && (
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
      )}
      {icon && <span style={{ fontSize: '12px' }}>{icon}</span>}
      <span
        style={{
          fontSize: '10px',
          color: NOVALINE_THEME.textSecondary,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default NovaLineHorizontal;
