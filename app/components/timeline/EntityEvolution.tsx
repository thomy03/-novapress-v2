'use client';

import React from 'react';
import {
  EntityEvolutionItem,
  ENTITY_TYPE_CONFIG
} from '@/app/types/timeline';

interface EntityEvolutionProps {
  entities: EntityEvolutionItem[];
  compact?: boolean;
}

export default function EntityEvolution({
  entities,
  compact = false,
}: EntityEvolutionProps) {
  if (entities.length === 0) {
    return null;
  }

  const displayEntities = compact ? entities.slice(0, 5) : entities;

  return (
    <div style={styles.container}>
      <h3 style={styles.header}>
        <span style={styles.headerIcon}>👤</span>
        Acteurs clés
      </h3>

      <div style={styles.entityList}>
        {displayEntities.map((entity, index) => {
          const typeConfig = ENTITY_TYPE_CONFIG[entity.entity_type];
          const trendIcon = getTrendIcon(entity.trend);

          return (
            <div key={entity.entity_name + index} style={styles.entityItem}>
              {/* Type icon */}
              <span style={styles.entityTypeIcon}>
                {typeConfig.icon}
              </span>

              {/* Entity info */}
              <div style={styles.entityInfo}>
                <div style={styles.entityName}>
                  {entity.entity_name}
                  {entity.trend === 'new' && (
                    <span style={styles.newBadge}>Nouveau</span>
                  )}
                </div>

                {!compact && entity.mentions.length > 0 && (
                  <div style={styles.mentions}>
                    {entity.mentions.slice(0, 3).map((mention, i) => (
                      <span key={i} style={styles.mention}>
                        {mention}
                      </span>
                    ))}
                    {entity.mentions.length > 3 && (
                      <span style={styles.moreMentions}>
                        +{entity.mentions.length - 3} autres
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Trend indicator */}
              <span style={{
                ...styles.trendIcon,
                color: getTrendColor(entity.trend),
              }}>
                {trendIcon}
              </span>
            </div>
          );
        })}
      </div>

      {compact && entities.length > 5 && (
        <p style={styles.moreText}>
          +{entities.length - 5} autres acteurs
        </p>
      )}
    </div>
  );
}

function getTrendIcon(trend: string): string {
  switch (trend) {
    case 'new': return '🆕';
    case 'constant': return '➡️';
    case 'declining': return '📉';
    default: return '•';
  }
}

function getTrendColor(trend: string): string {
  switch (trend) {
    case 'new': return '#10B981';
    case 'constant': return '#6B7280';
    case 'declining': return '#EF4444';
    default: return '#6B7280';
  }
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E5E5',
    padding: '20px',
    marginTop: '16px',
  },
  header: {
    fontFamily: 'Georgia, serif',
    fontSize: '16px',
    fontWeight: 700,
    color: '#000000',
    margin: '0 0 16px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingBottom: '12px',
    borderBottom: '1px solid #E5E5E5',
  },
  headerIcon: {
    fontSize: '18px',
  },
  entityList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  entityItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '8px 0',
    borderBottom: '1px solid #F3F4F6',
  },
  entityTypeIcon: {
    fontSize: '20px',
    flexShrink: 0,
  },
  entityInfo: {
    flex: 1,
  },
  entityName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#000000',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  newBadge: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#10B981',
    backgroundColor: '#D1FAE5',
    padding: '2px 6px',
    textTransform: 'uppercase' as const,
  },
  mentions: {
    marginTop: '4px',
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },
  mention: {
    fontSize: '11px',
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    padding: '2px 6px',
  },
  moreMentions: {
    fontSize: '11px',
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
  },
  trendIcon: {
    fontSize: '14px',
    flexShrink: 0,
  },
  moreText: {
    marginTop: '12px',
    fontSize: '13px',
    color: '#6B7280',
    textAlign: 'center' as const,
  },
};
