'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface EntityData {
  name: string;
  count: number;
  type: string;
}

interface EntityFrequencyChartProps {
  synthesisId: string;
  entities?: EntityData[];
  title?: string;
}

// Color palette for entity types - Newspaper style (subtle grays and black)
const ENTITY_COLORS: Record<string, string> = {
  PERSON: '#374151',    // Gray 700
  ORG: '#6B7280',       // Gray 500
  GPE: '#000000',       // Black
  LOC: '#9CA3AF',       // Gray 400
  EVENT: '#DC2626',     // Red (breaking)
  PRODUCT: '#4B5563',   // Gray 600
  ENTITY: '#374151',    // Gray 700
  default: '#374151'    // Gray 700
};

const ENTITY_LABELS: Record<string, string> = {
  PERSON: 'Personnes',
  ORG: 'Organisations',
  GPE: 'Lieux',
  LOC: 'Localisations',
  EVENT: 'Événements',
  PRODUCT: 'Produits',
  ENTITY: 'Entités'
};

// Newspaper style tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E5E5',
        borderRadius: '4px',
        padding: '10px 14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <p style={{ margin: 0, fontWeight: 600, color: '#000000' }}>{data.name}</p>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#6B7280' }}>
          {ENTITY_LABELS[data.type] || data.type} - {data.count} mention{data.count > 1 ? 's' : ''}
        </p>
      </div>
    );
  }
  return null;
};

export default function EntityFrequencyChart({
  synthesisId,
  entities: propEntities,
  title = "Entités Mentionnées"
}: EntityFrequencyChartProps) {
  const [entities, setEntities] = useState<EntityData[]>(propEntities || []);
  const [loading, setLoading] = useState(!propEntities);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propEntities) {
      setEntities(propEntities);
      setLoading(false);
      return;
    }

    const fetchEntities = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/artifacts/syntheses/${synthesisId}/entity-frequency`
        );

        if (!response.ok) {
          throw new Error('Impossible de charger les entités');
        }

        const data = await response.json();
        setEntities(data.entities || []);
      } catch (err) {
        console.error('Error fetching entities:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
  }, [synthesisId, propEntities]);

  if (loading) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: '#F9FAFB',
        borderRadius: '4px',
        textAlign: 'center'
      }}>
        <p style={{ color: '#6B7280', margin: 0 }}>Chargement des entites...</p>
      </div>
    );
  }

  if (error || entities.length === 0) {
    return null;
  }

  // Sort by count and take top 10
  const sortedEntities = [...entities]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Get unique entity types for legend
  const uniqueTypes = [...new Set(sortedEntities.map(e => e.type))];

  return (
    <div style={{
      marginTop: '32px',
      padding: '24px',
      backgroundColor: '#F9FAFB',
      border: '1px solid #E5E5E5',
      borderRadius: '4px'
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: '16px',
        fontWeight: 600,
        fontFamily: 'Georgia, serif',
        color: '#000000'
      }}>
        {title}
      </h3>

      {/* Legend - Newspaper Style */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {uniqueTypes.map(type => {
          const label = ENTITY_LABELS[type] || type;
          const color = ENTITY_COLORS[type] || ENTITY_COLORS.default;
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: color
              }} />
              <span style={{ fontSize: '12px', color: '#6B7280' }}>{label}</span>
            </div>
          );
        })}
      </div>

      <div style={{ width: '100%', height: 300, minWidth: 200, minHeight: 300 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={300}>
          <BarChart
            data={sortedEntities}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" opacity={0.5} />
            <XAxis type="number" stroke="#9CA3AF" fontSize={12} tick={{ fill: '#6B7280' }} />
            <YAxis
              dataKey="name"
              type="category"
              width={120}
              stroke="#9CA3AF"
              fontSize={12}
              tickLine={false}
              tick={{ fill: '#374151' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
            <Bar dataKey="count" radius={[0, 2, 2, 0]}>
              {sortedEntities.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={ENTITY_COLORS[entry.type] || ENTITY_COLORS.default}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
