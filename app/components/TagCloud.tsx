"use client";

import { useState } from 'react';
import { Tag } from '../types/Article';

interface TagCloudProps {
  tags: Tag[];
  selectedTags: string[];
  onTagClick: (tagId: string) => void;
  darkMode?: boolean;
  showCount?: boolean;
  maxTags?: number;
}

export default function TagCloud({ 
  tags, 
  selectedTags, 
  onTagClick, 
  darkMode = false,
  showCount = true,
  maxTags = 8 
}: TagCloudProps) {
  const [showAll, setShowAll] = useState(false);
  
  const displayedTags = showAll ? tags : tags.slice(0, maxTags);
  
  const theme = {
    bg: darkMode ? '#1a1a1a' : '#f3f4f6',
    text: darkMode ? '#e5e5e5' : '#000000',
    border: darkMode ? '#333333' : '#e5e7eb',
    hover: darkMode ? '#2a2a2a' : '#e5e7eb',
    selected: '#3b82f6',
  };

  const getTagStyle = (tag: Tag, isSelected: boolean) => {
    const tagColor = tag.color || '#000000'; // Fallback noir si pas de couleur
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '6px 12px',
      margin: '2px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: `1px solid ${hexToRgba(tagColor, 0.3)}`,
      backgroundColor: isSelected ? hexToRgba(tagColor, 0.15) : hexToRgba(tagColor, 0.08),
      color: isSelected ? '#ffffff' : tagColor,
      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
      boxShadow: isSelected ? `0 2px 4px ${hexToRgba(tagColor, 0.2)}` : 'none',
    };
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: '8px'
      }}>
        <span style={{ 
          fontSize: '14px', 
          fontWeight: '600',
          color: theme.text
        }}>
          🏷️
        </span>
        {selectedTags.length > 0 && (
          <button
            onClick={() => selectedTags.forEach(id => onTagClick(id))}
            style={{
              fontSize: '11px',
              color: '#6b7280',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '2px 6px'
            }}
          >
            Effacer ({selectedTags.length})
          </button>
        )}
      </div>
      
      <div style={{ 
        display: 'flex',
        flexWrap: 'wrap',
        gap: '2px'
      }}>
        {displayedTags.map(tag => {
          const isSelected = selectedTags.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => onTagClick(tag.id)}
              style={getTagStyle(tag, isSelected)}
              onMouseEnter={(e) => {
                const tagColor = tag.color || '#000000';
                const hexToRgba = (hex: string, alpha: number) => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = hexToRgba(tagColor, 0.12);
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = `0 2px 4px ${hexToRgba(tagColor, 0.15)}`;
                }
              }}
              onMouseLeave={(e) => {
                const tagColor = tag.color || '#000000';
                const hexToRgba = (hex: string, alpha: number) => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = hexToRgba(tagColor, 0.08);
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = `0 1px 2px ${hexToRgba(tagColor, 0.1)}`;
                }
              }}
            >
              <span>{tag.name}</span>
              {showCount && tag.count && (
                <span style={{ 
                  opacity: 0.7,
                  fontSize: '11px',
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
                  padding: '2px 6px',
                  borderRadius: '10px'
                }}>
                  {tag.count}
                </span>
              )}
              {isSelected && (
                <span style={{ fontSize: '10px' }}>✓</span>
              )}
            </button>
          );
        })}
      </div>
      
      {tags.length > maxTags && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 12px',
            margin: '2px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500',
            color: darkMode ? '#DC2626' : '#6b7280',
            background: 'transparent',
            border: `1px solid ${theme.border}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.hover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {showAll ? '− Voir moins' : `+ ${tags.length - maxTags} autres`}
        </button>
      )}
    </div>
  );
}