'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import {
  SynthesisData,
  SourceArticle,
  sharedStyles,
  getParagraphs,
} from '@/app/types/synthesis-page';

const KeyMetricCallout = dynamic(() => import('./KeyMetricCallout'), { ssr: false });
const MiniGeoWidget = dynamic(() => import('./MiniGeoWidget'), { ssr: false });
const MiniSparkline = dynamic(() => import('./MiniSparkline'), { ssr: false });

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
      // Direct link to source — tooltip shows name + title on hover
      parts.push(
        <a
          key={`source-${match.index}`}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#2563EB',
            textDecoration: 'none',
            fontSize: '0.75em',
            fontWeight: '600',
            verticalAlign: 'super',
            cursor: 'pointer',
            marginLeft: '1px',
            marginRight: '2px',
          }}
          title={`${source.name}${source.title ? ` — ${source.title}` : ''}`}
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

      {/* Key Metrics Callouts (Axios/Bloomberg style) */}
      {synthesis.keyMetrics && synthesis.keyMetrics.length > 0 && (
        <KeyMetricCallout metrics={synthesis.keyMetrics} />
      )}

      {/* Geographic context — positioned early for MONDE articles */}
      {synthesis.category === 'MONDE' && (
        <MiniGeoWidget synthesis={synthesis} />
      )}

      {/* Body — with intertitre support (## Heading) */}
      <div style={styles.body}>
        {paragraphs.map((paragraph, idx) => {
          // Detect intertitre lines: "## Some Title"
          const trimmed = paragraph.trim();
          if (trimmed.startsWith('## ')) {
            const headingText = trimmed.slice(3).trim();
            return (
              <h2 key={idx} style={styles.intertitre}>
                {headingText}
              </h2>
            );
          }
          return (
            <p key={idx} style={{ marginBottom: '24px' }}>
              {renderTextWithCitations(paragraph, synthesis.sourceArticles)}
            </p>
          );
        })}
      </div>

      {/* Category-specific widgets */}
      {synthesis.category === 'ECONOMIE' && synthesis.keyMetrics && (
        <MiniSparkline metrics={synthesis.keyMetrics} category={synthesis.category} />
      )}

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
  intertitre: {
    fontFamily: sharedStyles.fontSerif,
    fontSize: '22px',
    fontWeight: 700,
    color: '#000000',
    margin: '40px 0 16px 0',
    paddingBottom: '8px',
    borderBottom: '1px solid #E5E5E5',
    lineHeight: 1.3,
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
