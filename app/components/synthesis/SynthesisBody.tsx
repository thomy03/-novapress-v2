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
const GeoSvgWidget = dynamic(() => import('./GeoSvgWidget'), { ssr: false });
const MiniSparkline = dynamic(() => import('./MiniSparkline'), { ssr: false });

/**
 * REF-012c: SynthesisBody Component
 *
 * Renders structured article body with:
 * - Drop cap on first paragraph
 * - Section blocks grouped under ## headings with left-border accent
 * - Introduction/chapo with blue border-left
 * - Analysis section (gray background)
 * - Key Points (bullet list)
 * - Clickable [SOURCE:N] citations
 */

export interface SynthesisBodyProps {
  synthesis: SynthesisData;
}

/**
 * Convert inline markdown (**bold**, *italic*, «quotes») to React nodes
 */
function renderMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold**, *italic*, «guillemets»
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|\u00ab(.+?)\u00bb)/g;
  let lastIdx = 0;
  let m;
  let i = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(text.slice(lastIdx, m.index));
    }
    if (m[2]) {
      // **bold**
      parts.push(<strong key={`${keyPrefix}-b${i}`}>{m[2]}</strong>);
    } else if (m[3]) {
      // *italic*
      parts.push(<em key={`${keyPrefix}-i${i}`}>{m[3]}</em>);
    } else if (m[4]) {
      // «guillemets» — render as styled quote
      parts.push(
        <span key={`${keyPrefix}-q${i}`} style={{ fontStyle: 'italic' }}>
          {'\u00ab\u00a0'}{m[4]}{'\u00a0\u00bb'}
        </span>
      );
    }
    lastIdx = m.index + m[0].length;
    i++;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}

/**
 * Parse text to replace [SOURCE:N] with clickable highlighted links,
 * and **bold** / *italic* with proper HTML elements
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
    if (match.index > lastIndex) {
      // Process markdown in the text between source citations
      parts.push(...renderMarkdown(text.slice(lastIndex, match.index), `md-${match.index}`));
    }

    const sourceNum = parseInt(match[1], 10);
    const sourceIndex = sourceNum - 1;
    const source = sourceArticles?.[sourceIndex];

    if (source && source.url) {
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
          title={`${source.name}${source.title ? ` \u2014 ${source.title}` : ''}`}
        >
          [{sourceNum}]
        </a>
      );
    } else {
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

  if (lastIndex < text.length) {
    // Process markdown in the remaining text
    parts.push(...renderMarkdown(text.slice(lastIndex), `md-end`));
  }

  return parts;
}

/**
 * Render a paragraph with drop cap on the first one
 */
function renderParagraph(
  text: string,
  sourceArticles: SourceArticle[] | undefined,
  isFirstParagraph: boolean,
  key: string | number,
) {
  if (!isFirstParagraph || text.length < 20) {
    return (
      <p key={key} style={styles.paragraph}>
        {renderTextWithCitations(text, sourceArticles)}
      </p>
    );
  }

  // Drop cap: first letter gets special styling
  const firstChar = text[0];
  const rest = text.slice(1);

  return (
    <p key={key} style={styles.paragraph}>
      <span style={styles.dropCap}>{firstChar}</span>
      {renderTextWithCitations(rest, sourceArticles)}
    </p>
  );
}

/**
 * Group paragraphs into sections based on ## headings
 */
interface Section {
  heading?: string;
  paragraphs: string[];
}

function groupIntoSections(paragraphs: string[]): Section[] {
  const sections: Section[] = [];
  let current: Section = { paragraphs: [] };

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (trimmed.startsWith('## ')) {
      // Start a new section
      if (current.paragraphs.length > 0 || current.heading) {
        sections.push(current);
      }
      current = { heading: trimmed.slice(3).trim(), paragraphs: [] };
    } else {
      current.paragraphs.push(trimmed);
    }
  }

  // Push the last section
  if (current.paragraphs.length > 0 || current.heading) {
    sections.push(current);
  }

  return sections;
}

export default function SynthesisBody({ synthesis }: SynthesisBodyProps) {
  const fullContent = synthesis.body || synthesis.summary || '';
  const paragraphs = getParagraphs(fullContent);
  const sections = groupIntoSections(paragraphs);

  // Track whether we've rendered the first paragraph (for drop cap)
  let firstParagraphRendered = false;

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

      {/* Geographic context — editorial SVG map */}
      <GeoSvgWidget synthesis={synthesis} />

      {/* Body — structured in sections under ## headings */}
      <div style={styles.body}>
        {sections.map((section, sIdx) => {
          if (!section.heading && section.paragraphs.length === 0) return null;

          // Section without heading = intro paragraphs (before first ##)
          if (!section.heading) {
            return (
              <div key={sIdx}>
                {section.paragraphs.map((p, pIdx) => {
                  const isFirst = !firstParagraphRendered;
                  if (isFirst) firstParagraphRendered = true;
                  return renderParagraph(p, synthesis.sourceArticles, isFirst, `s${sIdx}-p${pIdx}`);
                })}
              </div>
            );
          }

          // Section with heading = structured block
          return (
            <div key={sIdx} style={styles.sectionBlock}>
              <h2 style={styles.intertitre}>{section.heading}</h2>
              <div style={styles.sectionContent}>
                {section.paragraphs.map((p, pIdx) => {
                  const isFirst = !firstParagraphRendered;
                  if (isFirst) firstParagraphRendered = true;
                  return renderParagraph(p, synthesis.sourceArticles, isFirst, `s${sIdx}-p${pIdx}`);
                })}
              </div>
            </div>
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
          <h2 style={styles.keyPointsTitle}>Points Clés</h2>
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
  paragraph: {
    marginBottom: '24px',
    lineHeight: '1.8',
  },
  dropCap: {
    float: 'left',
    fontSize: '60px',
    lineHeight: '48px',
    fontWeight: 700,
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: '#000',
    paddingRight: '8px',
    paddingTop: '4px',
  },
  sectionBlock: {
    marginTop: '40px',
    marginBottom: '32px',
  },
  intertitre: {
    fontFamily: sharedStyles.fontSerif,
    fontSize: '22px',
    fontWeight: 700,
    color: '#000000',
    margin: '0 0 20px 0',
    paddingBottom: '10px',
    borderBottom: '2px solid #000',
    lineHeight: 1.3,
    letterSpacing: '-0.3px',
  },
  sectionContent: {
    paddingLeft: '16px',
    borderLeft: '3px solid #E5E5E5',
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
