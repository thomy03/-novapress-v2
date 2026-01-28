'use client';

import React from 'react';
import {
  SynthesisData,
  SourceArticle,
  sharedStyles,
  getParagraphs,
} from '@/app/types/synthesis-page';

/**
 * REF-012c: SynthesisBody Component
 *
 * Client Component for the main body of a synthesis article.
 * Includes:
 * - Introduction/chapo (with blue border-left)
 * - Body paragraphs with clickable citations
 * - Analysis section (gray background)
 * - Key Points (bullet list)
 */

export interface SynthesisBodyProps {
  synthesis: SynthesisData;
}

/**
 * Parse text to replace [SOURCE:N] with clickable highlighted links
 * Handles the citation pattern and creates interactive source references
 */
function renderTextWithCitations(
  text: string,
  sourceArticles?: SourceArticle[]
): React.ReactNode {
  if (!text) return null;

  const sourcePattern = /\[SOURCE:(\d+)\]/g;
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = sourcePattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const sourceNum = parseInt(match[1], 10);
    const sourceIndex = sourceNum - 1;
    const source = sourceArticles?.[sourceIndex];

    if (source && source.url) {
      // FIX-005: Footnote-style citation as superscript number
      parts.push(
        <a
          key={`source-${match.index}`}
          href={`#source-${sourceNum}`}
          onClick={(e) => {
            e.preventDefault();
            // Scroll to sources section
            const sourcesSection = document.getElementById('sources-section');
            if (sourcesSection) {
              sourcesSection.scrollIntoView({ behavior: 'smooth' });
            }
            // Also open source in new tab
            window.open(source.url, '_blank', 'noopener,noreferrer');
          }}
          style={{
            color: sharedStyles.accentBlue,
            textDecoration: 'none',
            fontSize: '0.75em',
            fontWeight: '600',
            verticalAlign: 'super',
            cursor: 'pointer',
            marginLeft: '1px',
            marginRight: '2px',
          }}
          title={`Source: ${source.name}${source.title ? ` - ${source.title}` : ''}\n(Cliquez pour ouvrir)`}
        >
          [{sourceNum}]
        </a>
      );
    } else {
      // Fallback: non-clickable superscript number
      parts.push(
        <span
          key={`source-${match.index}`}
          style={{
            color: '#6B7280',
            fontSize: '0.75em',
            fontWeight: '500',
            verticalAlign: 'super',
          }}
        >
          [{sourceNum}]
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export default function SynthesisBody({ synthesis }: SynthesisBodyProps) {
  const fullContent = synthesis.body || synthesis.summary || '';
  const paragraphs = getParagraphs(fullContent);

  return (
    <div>
      {/* Introduction (chapo) */}
      {synthesis.introduction && (
        <p style={styles.introduction}>
          {renderTextWithCitations(synthesis.introduction, synthesis.sourceArticles)}
        </p>
      )}

      {/* Body */}
      <div style={styles.body}>
        {paragraphs.map((paragraph, idx) => (
          <p key={idx} style={{ marginBottom: '24px' }}>
            {renderTextWithCitations(paragraph, synthesis.sourceArticles)}
          </p>
        ))}
      </div>

      {/* Analysis Section */}
      {synthesis.analysis && (
        <div style={styles.analysisSection}>
          <h2 style={styles.analysisTitle}>Analyse</h2>
          <p style={styles.analysisText}>
            {renderTextWithCitations(synthesis.analysis, synthesis.sourceArticles)}
          </p>
        </div>
      )}

      {/* Key Points */}
      {synthesis.keyPoints && synthesis.keyPoints.length > 0 && (
        <div style={styles.keyPointsSection}>
          <h2 style={styles.keyPointsTitle}>Points Cles</h2>
          <ul style={styles.keyPointsList}>
            {synthesis.keyPoints.map((point, index) => (
              <li key={index} style={styles.keyPoint}>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  introduction: {
    fontFamily: sharedStyles.fontSerif,
    fontSize: '20px',
    fontWeight: '500',
    lineHeight: '1.6',
    color: '#1F2937',
    marginBottom: '32px',
    borderLeft: `4px solid ${sharedStyles.accentBlue}`,
    paddingLeft: '20px',
  },
  body: {
    fontFamily: sharedStyles.fontSerif,
    fontSize: '18px',
    lineHeight: '1.8',
    color: '#374151',
  },
  analysisSection: {
    backgroundColor: sharedStyles.bgGray,
    border: `1px solid ${sharedStyles.border}`,
    padding: sharedStyles.contentPadding,
    marginTop: sharedStyles.sectionGap,
    marginBottom: sharedStyles.sectionGap,
  },
  analysisTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: sharedStyles.accentBlue,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  analysisText: {
    fontFamily: sharedStyles.fontSerif,
    fontSize: '16px',
    lineHeight: '1.7',
    color: '#4B5563',
    fontStyle: 'italic',
    margin: 0,
  },
  keyPointsSection: {
    marginTop: sharedStyles.sectionGap,
    marginBottom: sharedStyles.sectionGap,
    padding: sharedStyles.contentPadding,
    backgroundColor: '#FAFAFA',
    border: `1px solid ${sharedStyles.border}`,
  },
  keyPointsTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: sharedStyles.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '16px',
  },
  keyPointsList: {
    margin: 0,
    paddingLeft: '24px',
  },
  keyPoint: {
    fontSize: '16px',
    lineHeight: '1.7',
    color: '#374151',
    marginBottom: '12px',
  },
};

// Export the renderTextWithCitations function for use in other components
export { renderTextWithCitations };
