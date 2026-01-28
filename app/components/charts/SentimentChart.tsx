'use client';

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface SentimentDataPoint {
  date: string;
  sentiment: number; // -1 to 1
  label?: string;
}

interface SentimentChartProps {
  synthesisId: string;
  data?: SentimentDataPoint[];
  title?: string;
}

const getSentimentColor = (value: number): string => {
  if (value >= 0.3) return '#10B981'; // Positive - Green
  if (value <= -0.3) return '#EF4444'; // Negative - Red
  return '#F59E0B'; // Neutral - Amber
};

const getSentimentLabel = (value: number): string => {
  if (value >= 0.6) return 'Très positif';
  if (value >= 0.3) return 'Positif';
  if (value >= -0.3) return 'Neutre';
  if (value >= -0.6) return 'Négatif';
  return 'Très négatif';
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #E5E5E5',
        borderRadius: '4px',
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>{label}</p>
        <p style={{
          margin: '4px 0 0 0',
          fontWeight: 600,
          color: getSentimentColor(value)
        }}>
          {getSentimentLabel(value)} ({(value * 100).toFixed(0)}%)
        </p>
      </div>
    );
  }
  return null;
};

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  const color = getSentimentColor(payload.sentiment);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={color}
      stroke="#fff"
      strokeWidth={2}
    />
  );
};

export default function SentimentChart({
  synthesisId,
  data: propData,
  title = "Évolution du Sentiment"
}: SentimentChartProps) {
  const [data, setData] = useState<SentimentDataPoint[]>(propData || []);
  const [loading, setLoading] = useState(!propData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propData) {
      setData(propData);
      setLoading(false);
      return;
    }

    const fetchSentiment = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/artifacts/syntheses/${synthesisId}/sentiment-history`
        );

        if (!response.ok) {
          throw new Error('Impossible de charger les données de sentiment');
        }

        const responseData = await response.json();
        setData(responseData.history || []);
      } catch (err) {
        console.error('Error fetching sentiment:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchSentiment();
  }, [synthesisId, propData]);

  if (loading) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: '#F9FAFB',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#6B7280', margin: 0 }}>Chargement du sentiment...</p>
      </div>
    );
  }

  if (error || data.length === 0) {
    return null; // Don't show anything if no data
  }

  // Calculate current sentiment (last data point)
  const currentSentiment = data.length > 0 ? data[data.length - 1].sentiment : 0;

  return (
    <div style={{
      marginTop: '32px',
      padding: '24px',
      backgroundColor: '#fff',
      border: '1px solid #E5E5E5',
      borderRadius: '8px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: 600,
          fontFamily: 'Georgia, serif',
          color: '#000'
        }}>
          {title}
        </h3>

        {/* Current sentiment badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 12px',
          backgroundColor: `${getSentimentColor(currentSentiment)}15`,
          borderRadius: '16px'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getSentimentColor(currentSentiment)
          }} />
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            color: getSentimentColor(currentSentiment)
          }}>
            {getSentimentLabel(currentSentiment)}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '16px',
        fontSize: '12px',
        color: '#6B7280'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#10B981' }}>●</span> Positif
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#F59E0B' }}>●</span> Neutre
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#EF4444' }}>●</span> Négatif
        </span>
      </div>

      <div style={{ width: '100%', height: 250, minHeight: 250 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={250}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
            <XAxis
              dataKey="date"
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              domain={[-1, 1]}
              ticks={[-1, -0.5, 0, 0.5, 1]}
              stroke="#6B7280"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="sentiment"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
