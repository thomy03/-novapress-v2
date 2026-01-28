"use client";

import React, { useState, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  TopicCategory,
  CortexControlsProps,
  CATEGORY_COLORS,
} from '@/app/types/cortex';

const ALL_CATEGORIES: TopicCategory[] = [
  'POLITIQUE',
  'ECONOMIE',
  'TECH',
  'MONDE',
  'CULTURE',
  'SPORT',
  'SCIENCES',
];

/**
 * CortexControls - Search and filter controls for the Cortex
 */
export function CortexControls({
  onSearch,
  onCategoryFilter,
  selectedCategories = [],
}: CortexControlsProps) {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  // Handle search input
  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const query = e.target.value;
      setSearchQuery(query);
      onSearch(query);
    },
    [onSearch]
  );

  // Handle category toggle
  const handleCategoryClick = useCallback(
    (category: TopicCategory) => {
      if (!onCategoryFilter) return;

      const newSelection = selectedCategories.includes(category)
        ? selectedCategories.filter((c) => c !== category)
        : [...selectedCategories, category];

      onCategoryFilter(newSelection);
    },
    [selectedCategories, onCategoryFilter]
  );

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    onSearch('');
    if (onCategoryFilter) {
      onCategoryFilter([]);
    }
  }, [onSearch, onCategoryFilter]);

  const hasActiveFilters = searchQuery || selectedCategories.length > 0;

  // Check if we're in dark mode (cortex page uses dark background)
  const isDarkMode = theme.bg === '#0a0a0f' || theme.bg === '#000000' || theme.bg.includes('0a0a');

  return (
    <div
      style={{
        padding: '16px 24px',
        backgroundColor: isDarkMode ? 'transparent' : theme.bg,
        borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : theme.border}`,
      }}
    >
      {/* Search bar */}
      <div
        style={{
          position: 'relative',
          marginBottom: '16px',
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Rechercher un topic..."
          style={{
            width: '100%',
            padding: '12px 16px 12px 44px',
            fontSize: '14px',
            border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.2)' : theme.border}`,
            borderRadius: '8px',
            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : theme.bg,
            color: isDarkMode ? '#FFFFFF' : theme.text,
            outline: 'none',
            transition: 'border-color 0.2s ease',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#2563EB';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.2)' : theme.border;
          }}
        />
        <svg
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '18px',
            height: '18px',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : theme.textSecondary,
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Category filters */}
      {onCategoryFilter && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : theme.textSecondary,
              marginRight: '8px',
            }}
          >
            Categories
          </span>

          {ALL_CATEGORIES.map((category) => {
            const isSelected = selectedCategories.includes(category);
            const color = CATEGORY_COLORS[category];

            const defaultBorderColor = isDarkMode ? 'rgba(255, 255, 255, 0.2)' : theme.border;
            const defaultTextColor = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : theme.textSecondary;

            return (
              <button
                key={category}
                onClick={() => handleCategoryClick(category)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: '16px',
                  border: `1px solid ${isSelected ? color : defaultBorderColor}`,
                  backgroundColor: isSelected ? `${color}15` : 'transparent',
                  color: isSelected ? color : defaultTextColor,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = color;
                    e.currentTarget.style.color = color;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = defaultBorderColor;
                    e.currentTarget.style.color = defaultTextColor;
                  }
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: color,
                  }}
                />
                <span style={{ textTransform: 'capitalize' }}>
                  {category.toLowerCase()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Clear filters button */}
      {hasActiveFilters && (
        <button
          onClick={handleClearFilters}
          style={{
            marginTop: '12px',
            padding: '6px 12px',
            fontSize: '12px',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.6)' : theme.textSecondary,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Effacer les filtres
        </button>
      )}
    </div>
  );
}

export default CortexControls;
