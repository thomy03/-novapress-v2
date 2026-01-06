'use client';

import React, { memo, useState } from 'react';

interface Topic {
  id: string;
  name: string;
  count: number;
  relatedTopics: string[];
}

interface TopicClusterProps {
  topics: Topic[];
  onTopicClick?: (topicId: string) => void;
}

export const TopicCluster = memo(function TopicCluster({
  topics,
  onTopicClick
}: TopicClusterProps) {
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Sort topics by count (most articles first)
  const sortedTopics = [...topics].sort((a, b) => b.count - a.count);

  // Get size based on article count
  const getSize = (count: number) => {
    const maxCount = Math.max(...topics.map(t => t.count));
    const ratio = count / maxCount;
    if (ratio > 0.7) return 'large';
    if (ratio > 0.4) return 'medium';
    return 'small';
  };

  const sizeStyles = {
    large: { padding: '16px 24px', fontSize: '16px' },
    medium: { padding: '12px 18px', fontSize: '14px' },
    small: { padding: '8px 14px', fontSize: '12px' }
  };

  const handleTopicClick = (topic: Topic) => {
    setSelectedTopic(selectedTopic === topic.id ? null : topic.id);
    onTopicClick?.(topic.id);
  };

  // Check if topic is related to hovered/selected topic
  const isRelated = (topicId: string) => {
    const activeTopic = hoveredTopic || selectedTopic;
    if (!activeTopic) return false;
    const activeTopicData = topics.find(t => t.id === activeTopic);
    return activeTopicData?.relatedTopics.includes(topicId);
  };

  return (
    <div
      style={{
        backgroundColor: '#F9FAFB',
        border: '1px solid #E5E5E5',
        padding: '24px',
        marginBottom: '32px'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}
      >
        <h3
          style={{
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#6B7280',
            margin: 0
          }}
        >
          Topic Network
        </h3>
        <span
          style={{
            fontSize: '11px',
            color: '#9CA3AF'
          }}
        >
          {topics.length} topics detected
        </span>
      </div>

      {/* Topic Cloud */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {sortedTopics.map((topic) => {
          const size = getSize(topic.count);
          const isActive = hoveredTopic === topic.id || selectedTopic === topic.id;
          const isRelatedToActive = isRelated(topic.id);
          const isInactive = (hoveredTopic || selectedTopic) && !isActive && !isRelatedToActive;

          return (
            <button
              key={topic.id}
              onClick={() => handleTopicClick(topic)}
              onMouseEnter={() => setHoveredTopic(topic.id)}
              onMouseLeave={() => setHoveredTopic(null)}
              style={{
                ...sizeStyles[size],
                backgroundColor: isActive
                  ? '#000000'
                  : isRelatedToActive
                  ? '#2563EB'
                  : '#FFFFFF',
                color: isActive || isRelatedToActive ? '#FFFFFF' : '#000000',
                border: isActive
                  ? '2px solid #000000'
                  : isRelatedToActive
                  ? '2px solid #2563EB'
                  : '1px solid #E5E5E5',
                borderRadius: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: '600',
                opacity: isInactive ? 0.3 : 1,
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                position: 'relative'
              }}
            >
              <span>{topic.name}</span>
              <span
                style={{
                  marginLeft: '8px',
                  fontSize: '10px',
                  opacity: 0.7,
                  fontWeight: '400'
                }}
              >
                {topic.count}
              </span>

              {/* Connection indicator for related topics */}
              {isRelatedToActive && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#10B981',
                    borderRadius: '50%',
                    border: '2px solid #FFFFFF'
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid #E5E5E5'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#000000',
              borderRadius: '50%'
            }}
          />
          <span style={{ fontSize: '11px', color: '#6B7280' }}>Selected</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#2563EB',
              borderRadius: '50%'
            }}
          />
          <span style={{ fontSize: '11px', color: '#6B7280' }}>Related</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E5E5',
              borderRadius: '50%'
            }}
          />
          <span style={{ fontSize: '11px', color: '#6B7280' }}>Topic</span>
        </div>
      </div>

      {/* Selected Topic Details */}
      {selectedTopic && (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E5E5'
          }}
        >
          {(() => {
            const topic = topics.find(t => t.id === selectedTopic);
            if (!topic) return null;

            return (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px'
                  }}
                >
                  <h4
                    style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#000000',
                      margin: 0
                    }}
                  >
                    {topic.name}
                  </h4>
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#6B7280'
                    }}
                  >
                    {topic.count} articles
                  </span>
                </div>

                {topic.relatedTopics.length > 0 && (
                  <div>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#6B7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      Related topics:{' '}
                    </span>
                    <span style={{ fontSize: '13px', color: '#374151' }}>
                      {topic.relatedTopics
                        .map(id => topics.find(t => t.id === id)?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
});

export default TopicCluster;
