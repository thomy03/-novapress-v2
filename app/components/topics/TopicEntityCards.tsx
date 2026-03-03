'use client';

import React from 'react';

interface KeyEntity {
  name: string;
  count: number;
  type: string;
}

const TYPE_COLORS: Record<string, string> = {
  PER: '#2563EB',
  PERSON: '#2563EB',
  ORG: '#DC2626',
  ORGANIZATION: '#DC2626',
  LOC: '#10B981',
  LOCATION: '#10B981',
  GPE: '#10B981',
};

interface TopicEntityCardsProps {
  entities: KeyEntity[];
  onEntityClick?: (entityName: string) => void;
}

export default function TopicEntityCards({ entities, onEntityClick }: TopicEntityCardsProps) {
  if (entities.length === 0) return null;

  const maxCount = Math.max(...entities.map(e => e.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {entities.slice(0, 12).map((entity, i) => {
        const barWidth = Math.max(8, (entity.count / maxCount) * 100);
        const dotColor = TYPE_COLORS[entity.type.toUpperCase()] || '#6B7280';

        return (
          <div
            key={i}
            onClick={() => onEntityClick?.(entity.name)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              cursor: onEntityClick ? 'pointer' : 'default',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E5E5',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          >
            {/* Type dot */}
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: dotColor,
              flexShrink: 0,
            }} />

            {/* Name */}
            <span style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: '14px',
              fontWeight: 600,
              color: '#000',
              flex: '0 0 auto',
              minWidth: '120px',
            }}>
              {entity.name}
            </span>

            {/* Bar */}
            <div style={{
              flex: 1,
              height: '4px',
              backgroundColor: '#F3F4F6',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${barWidth}%`,
                backgroundColor: dotColor,
                opacity: 0.6,
              }} />
            </div>

            {/* Count */}
            <span style={{
              fontSize: '11px',
              color: '#9CA3AF',
              fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
            }}>
              {entity.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
