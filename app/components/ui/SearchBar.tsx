"use client";

import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useArticles } from '../../contexts/ArticlesContext';
import { useDebouncedCallback } from '../../hooks/useDebounce';

export function SearchBar() {
  const { theme } = useTheme();
  const { state, setSearchQuery } = useArticles();
  const [showSearch, setShowSearch] = useState(false);
  const [localQuery, setLocalQuery] = useState(state.searchQuery);

  // Debounced search to avoid too many updates
  const debouncedSearch = useDebouncedCallback((query: string) => {
    setSearchQuery(query);
  }, 300);

  const handleInputChange = (value: string) => {
    setLocalQuery(value);
    debouncedSearch(value);
  };

  const clearSearch = () => {
    setLocalQuery('');
    setSearchQuery('');
  };

  return (
    <div
      role="search"
      aria-label="Recherche d'articles"
      style={{
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      flex: 1,
      maxWidth: '500px',
      margin: '0 30px',
      position: 'relative'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: theme.bgTertiary,
        borderRadius: '25px',
        padding: '8px 20px',
        flex: 1,
        border: `1px solid ${theme.border}`,
        transition: 'all 0.3s ease',
        boxShadow: showSearch ? `0 0 0 2px #3b82f6` : 'none'
      }}>
        <span style={{ marginRight: '10px', opacity: 0.6 }}>🔍</span>
        <input
          type="text"
          placeholder="Rechercher des articles..."
          value={localQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowSearch(true)}
          onBlur={() => setTimeout(() => setShowSearch(false), 200)}
          aria-label="Rechercher des articles"
          aria-expanded={showSearch}
          role="searchbox"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            flex: 1,
            fontSize: '14px',
            color: theme.text
          }}
        />
        {localQuery && (
          <button
            onClick={clearSearch}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              opacity: 0.6,
              fontSize: '12px',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid #3b82f6';
              e.currentTarget.style.outlineOffset = '2px';
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none';
            }}
            aria-label="Effacer la recherche"
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>
      
      {/* Search suggestions could be added here */}
      {showSearch && localQuery && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: '8px',
          marginTop: '4px',
          padding: '8px',
          boxShadow: `0 4px 12px ${theme.shadow}`,
          zIndex: 1000
        }}>
          <div style={{
            fontSize: '12px',
            color: theme.textSecondary,
            padding: '4px 8px'
          }}>
            {state.filteredArticles.length} résultat{state.filteredArticles.length !== 1 ? 's' : ''} trouvé{state.filteredArticles.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}