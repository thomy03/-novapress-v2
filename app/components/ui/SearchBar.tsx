"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../contexts/ThemeContext';
import { useArticles } from '../../contexts/ArticlesContext';
import { useDebouncedCallback } from '../../hooks/useDebounce';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Suggestion {
  type: 'title' | 'category' | 'topic';
  text: string;
  synthesisId?: string;
  category?: string;
}

export function SearchBar() {
  const router = useRouter();
  const { theme } = useTheme();
  const { state, setSearchQuery } = useArticles();
  const [showDropdown, setShowDropdown] = useState(false);
  const [localQuery, setLocalQuery] = useState(state.searchQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search to avoid too many updates
  const debouncedSearch = useDebouncedCallback((query: string) => {
    setSearchQuery(query);
  }, 300);

  // Debounced fetch suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      setLoadingSuggestions(true);
      const response = await fetch(`${API_URL}/api/search/suggestions?q=${encodeURIComponent(query)}&limit=8`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const debouncedFetchSuggestions = useDebouncedCallback(fetchSuggestions, 200);

  const handleInputChange = (value: string) => {
    setLocalQuery(value);
    setSelectedIndex(-1);
    debouncedSearch(value);
    debouncedFetchSuggestions(value);
  };

  const clearSearch = () => {
    setLocalQuery('');
    setSearchQuery('');
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.type === 'title' && suggestion.synthesisId) {
      // Navigate to synthesis page
      router.push(`/synthesis/${suggestion.synthesisId}`);
    } else if (suggestion.type === 'category' && suggestion.category) {
      // Filter by category
      setLocalQuery(suggestion.text);
      setSearchQuery(suggestion.category);
    } else {
      // Use as search query
      setLocalQuery(suggestion.text);
      setSearchQuery(suggestion.text);
    }
    setShowDropdown(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'title': return '📄';
      case 'category': return '🏷️';
      case 'topic': return '💡';
      default: return '🔍';
    }
  };

  const getSuggestionLabel = (type: string) => {
    switch (type) {
      case 'title': return 'Synthèse';
      case 'category': return 'Catégorie';
      case 'topic': return 'Sujet';
      default: return '';
    }
  };

  return (
    <div
      role="search"
      aria-label="Recherche d'articles"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        flex: '0 1 400px',
        maxWidth: '400px',
        margin: '0 20px',
        position: 'relative'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: theme.bgTertiary,
        borderRadius: '25px',
        padding: '8px 20px',
        flex: 1,
        border: `1px solid ${theme.border}`,
        transition: 'all 0.3s ease',
        boxShadow: showDropdown ? `0 0 0 2px #3b82f6` : 'none'
      }}>
        <span style={{ marginRight: '10px', opacity: 0.6 }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Rechercher..."
          value={localQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          aria-label="Rechercher des articles"
          aria-expanded={showDropdown && suggestions.length > 0}
          aria-controls="search-suggestions"
          aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
          role="combobox"
          autoComplete="off"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            flex: 1,
            fontSize: '14px',
            color: theme.text
          }}
        />
        {loadingSuggestions && (
          <div style={{
            width: '14px',
            height: '14px',
            border: `2px solid ${theme.border}`,
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginRight: '8px',
          }} />
        )}
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

      {/* Autocomplete dropdown */}
      {showDropdown && (localQuery.length >= 2 || suggestions.length > 0) && (
        <div
          ref={dropdownRef}
          id="search-suggestions"
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            marginTop: '8px',
            boxShadow: `0 8px 24px ${theme.shadow}`,
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {suggestions.length > 0 ? (
            <>
              {suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.type}-${index}`}
                  id={`suggestion-${index}`}
                  role="option"
                  aria-selected={selectedIndex === index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    backgroundColor: selectedIndex === index ? theme.bgSecondary : 'transparent',
                    borderBottom: index < suggestions.length - 1 ? `1px solid ${theme.border}` : 'none',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span style={{ fontSize: '16px', opacity: 0.7 }}>
                    {getSuggestionIcon(suggestion.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      color: theme.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {suggestion.text}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: theme.textSecondary,
                      marginTop: '2px',
                    }}>
                      {getSuggestionLabel(suggestion.type)}
                      {suggestion.category && suggestion.type !== 'category' && (
                        <span style={{
                          marginLeft: '8px',
                          padding: '2px 6px',
                          backgroundColor: theme.bgTertiary,
                          borderRadius: '4px',
                        }}>
                          {suggestion.category}
                        </span>
                      )}
                    </div>
                  </div>
                  {suggestion.type === 'title' && (
                    <span style={{ fontSize: '12px', color: theme.textSecondary }}>→</span>
                  )}
                </div>
              ))}
            </>
          ) : localQuery.length >= 2 && !loadingSuggestions ? (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              color: theme.textSecondary,
              fontSize: '13px',
            }}>
              Aucun résultat pour &quot;{localQuery}&quot;
            </div>
          ) : null}

          {/* Results count footer */}
          {localQuery && state.filteredArticles.length > 0 && (
            <div style={{
              padding: '8px 16px',
              borderTop: `1px solid ${theme.border}`,
              backgroundColor: theme.bgSecondary,
              fontSize: '12px',
              color: theme.textSecondary,
            }}>
              {state.filteredArticles.length} résultat{state.filteredArticles.length !== 1 ? 's' : ''} trouvé{state.filteredArticles.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
