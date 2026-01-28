'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface TopicInfo {
  synthesis_id: string;
  is_recurring: boolean;
  topic_name: string | null;
  synthesis_count?: number;
  related_ids?: string[];
}

interface RecurringTopicBadgeProps {
  synthesisId: string;
}

export default function RecurringTopicBadge({ synthesisId }: RecurringTopicBadgeProps) {
  const router = useRouter();
  const [topicInfo, setTopicInfo] = useState<TopicInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopicInfo = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/trending/syntheses/${synthesisId}/topic-info`
        );

        if (response.ok) {
          const data = await response.json();
          setTopicInfo(data);
        }
      } catch (error) {
        console.error('Error fetching topic info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopicInfo();
  }, [synthesisId]);

  if (loading || !topicInfo || !topicInfo.is_recurring) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/topics/${encodeURIComponent(topicInfo.topic_name || '')}`);
  };

  return (
    <span
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(e as unknown as React.MouseEvent); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        backgroundColor: '#F9FAFB',
        color: '#374151',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: '1px solid #E5E5E5'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#F3F4F6';
        e.currentTarget.style.borderColor = '#000000';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#F9FAFB';
        e.currentTarget.style.borderColor = '#E5E5E5';
      }}
    >
      <span style={{ fontSize: '12px' }}>📰</span>
      <span>Thème récurrent</span>
      {topicInfo.synthesis_count && (
        <span style={{
          backgroundColor: '#000000',
          color: '#FFFFFF',
          padding: '2px 6px',
          fontSize: '11px',
          fontWeight: 600
        }}>
          {topicInfo.synthesis_count} synthèses
        </span>
      )}
    </span>
  );
}
