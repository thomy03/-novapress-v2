'use client';

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { KeyMetric, sharedStyles } from '@/app/types/synthesis-page';

/**
 * MiniSparkline — Compact horizontal bar chart for ECONOMIE category.
 * Extracts numeric values from keyMetrics and displays them as comparative bars.
 * Only renders for ECONOMIE category with >= 2 numeric metrics.
 */

interface MiniSparklineProps {
  metrics: KeyMetric[];
  category?: string;
}

interface ChartDatum {
  label: string;
  value: number;
  displayValue: string;
  source?: string;
  isNegative: boolean;
}

const BAR_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#DC2626'];

/**
 * Parse a metric value string into a number.
 * Handles: "15%", "-3.2%", "1.5M", "48h", "$12B", "3", etc.
 */
function parseNumericValue(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[%$,\s]/g, '').replace(/[BMKbmk]$/, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function truncateLabel(label: string, maxLen: number = 30): string {
  return label.length > maxLen ? label.slice(0, maxLen - 1) + '\u2026' : label;
}

export default function MiniSparkline({ metrics, category }: MiniSparklineProps) {
  // Only show for ECONOMIE category
  if (category !== 'ECONOMIE') return null;
  if (!metrics || metrics.length < 2) return null;

  const chartData = useMemo<ChartDatum[]>(() => {
    const parsed: ChartDatum[] = [];
    for (const m of metrics) {
      const num = parseNumericValue(m.value);
      if (num !== null) {
        parsed.push({
          label: truncateLabel(m.label),
          value: Math.abs(num),
          displayValue: m.value,
          source: m.source,
          isNegative: num < 0,
        });
      }
    }
    return parsed;
  }, [metrics]);

  // Need at least 2 numeric values to be useful
  if (chartData.length < 2) return null;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Indicateurs Economiques</h3>
      <div style={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={chartData.length * 44 + 20}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 60, bottom: 4, left: 8 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={140}
              tick={{ fontSize: 12, fill: '#374151', fontFamily: sharedStyles.fontSans }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(_value: any, _name: any, props: any) => [
                props?.payload?.displayValue ?? '',
                props?.payload?.source ?? '',
              ]}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E5E5',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: sharedStyles.fontSans,
              }}
            />
            <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={20}>
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.isNegative ? '#DC2626' : BAR_COLORS[idx % BAR_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Value labels on the right side of bars */}
        <div style={styles.valueLabels}>
          {chartData.map((d, idx) => (
            <div key={idx} style={styles.valueRow}>
              <span style={{
                ...styles.valueBadge,
                color: d.isNegative ? '#DC2626' : '#2563EB',
              }}>
                {d.displayValue}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: '32px',
    padding: '20px',
    backgroundColor: '#fff',
    border: `1px solid ${sharedStyles.border}`,
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: sharedStyles.textSecondary,
    fontFamily: sharedStyles.fontSans,
  },
  chartWrapper: {
    position: 'relative',
  },
  valueLabels: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  valueRow: {
    height: '20px',
    display: 'flex',
    alignItems: 'center',
  },
  valueBadge: {
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: sharedStyles.fontSans,
  },
};
