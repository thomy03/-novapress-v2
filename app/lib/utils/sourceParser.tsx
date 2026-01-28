'use client';

/**
 * Source Citation Parser
 *
 * Transforms [SOURCE:X] or [Source Name] patterns into clickable links
 * with tooltips showing the article title.
 */

import React, { Fragment, useState, useRef, useEffect } from 'react';

interface SourceArticle {
  name: string;
  url: string;
  title: string;
}

interface SourceLinkProps {
  source: SourceArticle;
  displayText: string;
}

/**
 * SourceLink Component - Individual clickable source with tooltip
 */
function SourceLink({ source, displayText }: SourceLinkProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (showTooltip && linkRef.current) {
      const rect = linkRef.current.getBoundingClientRect();
      // Show tooltip below if too close to top of viewport
      setTooltipPosition(rect.top < 100 ? 'bottom' : 'top');
    }
  }, [showTooltip]);

  if (!source.url) {
    // No URL - just display as styled text
    return (
      <span
        style={{
          backgroundColor: '#F3F4F6',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: 'inherit',
          fontWeight: 500,
          color: '#374151',
        }}
      >
        {displayText}
      </span>
    );
  }

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline',
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <a
        ref={linkRef}
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          backgroundColor: '#EFF6FF',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: 'inherit',
          fontWeight: 500,
          color: '#2563EB',
          textDecoration: 'none',
          borderBottom: '1px dotted #2563EB',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#DBEAFE';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#EFF6FF';
        }}
      >
        {displayText}
        <span style={{ marginLeft: '3px', fontSize: '0.85em' }}>↗</span>
      </a>

      {/* Tooltip */}
      {showTooltip && source.title && (
        <span
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            ...(tooltipPosition === 'top' ? { bottom: '100%', marginBottom: '8px' } : { top: '100%', marginTop: '8px' }),
            backgroundColor: '#1F2937',
            color: '#FFFFFF',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 400,
            whiteSpace: 'nowrap',
            maxWidth: '300px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontWeight: 600 }}>{source.name}</span>
          <br />
          <span style={{ opacity: 0.9 }}>{source.title}</span>

          {/* Arrow */}
          <span
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              ...(tooltipPosition === 'top' ? { top: '100%', borderTop: '6px solid #1F2937' } : { bottom: '100%', borderBottom: '6px solid #1F2937' }),
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
            }}
          />
        </span>
      )}
    </span>
  );
}

/**
 * Parse source citations in text and return React elements
 *
 * Patterns matched:
 * - [SOURCE:1] - Reference by index
 * - [Le Monde] - Reference by name
 * - [selon Le Monde] - Reference with "selon" prefix
 */
export function ParsedSourceText({
  text,
  sources = []
}: {
  text: string;
  sources: SourceArticle[];
}): React.ReactElement {
  if (!text) {
    return <>{text}</>;
  }

  // Build a map of source names (lowercase) to source objects
  const sourceMap = new Map<string, SourceArticle>();
  sources.forEach((source, index) => {
    if (source.name) {
      sourceMap.set(source.name.toLowerCase(), source);
      // Also map by index
      sourceMap.set(`source:${index + 1}`, source);
    }
  });

  // Regex patterns:
  // [SOURCE:1] - numbered reference
  // [Le Monde] - direct name reference
  // [selon Source] - "selon" prefix reference
  const pattern = /\[(SOURCE:(\d+)|selon\s+([^\]]+)|([^\]]+))\]/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const fullMatch = match[0]; // e.g., "[Le Monde]"
    const sourceIndex = match[2]; // For [SOURCE:1], this is "1"
    const selonSource = match[3]; // For [selon Le Monde], this is "Le Monde"
    const directSource = match[4]; // For [Le Monde], this is "Le Monde"

    let source: SourceArticle | undefined;
    let displayText = '';

    if (sourceIndex) {
      // [SOURCE:1] pattern
      source = sourceMap.get(`source:${sourceIndex}`);
      displayText = source?.name || `Source ${sourceIndex}`;
    } else if (selonSource) {
      // [selon Le Monde] pattern
      source = sourceMap.get(selonSource.toLowerCase().trim());
      displayText = `selon ${source?.name || selonSource.trim()}`;
    } else if (directSource) {
      // [Le Monde] pattern
      source = sourceMap.get(directSource.toLowerCase().trim());
      displayText = source?.name || directSource.trim();
    }

    if (source) {
      parts.push(
        <SourceLink
          key={`source-${match.index}`}
          source={source}
          displayText={displayText}
        />
      );
    } else {
      // No matching source found - just render the text without link
      parts.push(
        <span
          key={`unknown-${match.index}`}
          style={{
            backgroundColor: '#F3F4F6',
            padding: '2px 6px',
            borderRadius: '3px',
            color: '#6B7280',
          }}
        >
          {displayText || fullMatch.replace(/[\[\]]/g, '')}
        </span>
      );
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

/**
 * Format body text with source citations and proper paragraphs
 */
export function FormattedBodyWithSources({
  body,
  sources = []
}: {
  body: string;
  sources: SourceArticle[];
}): React.ReactElement {
  if (!body) {
    return <></>;
  }

  // Split by double newlines for paragraphs
  const paragraphs = body.split(/\n\n+/).filter(p => p.trim());

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          style={{
            marginBottom: index < paragraphs.length - 1 ? '1.5em' : 0,
          }}
        >
          <ParsedSourceText text={paragraph} sources={sources} />
        </p>
      ))}
    </>
  );
}

export default ParsedSourceText;
