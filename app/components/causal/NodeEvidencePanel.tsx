'use client';

import React from 'react';
import Link from 'next/link';
import type { CausalNode, CausalEdge, AggregatedCausalNode } from '@/app/types/causal';

const RELATION_LABELS_FR: Record<string, string> = {
  causes: 'cause',
  triggers: 'd\u00e9clenche',
  enables: 'permet',
  prevents: 'emp\u00eache',
  relates_to: 'li\u00e9 \u00e0',
};

const NODE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  event:    { label: '\u00c9v\u00e9nement', color: '#DC2626' },
  entity:   { label: 'Entit\u00e9',    color: '#2563EB' },
  decision: { label: 'D\u00e9cision',  color: '#6B7280' },
  keyword:  { label: 'Mot-cl\u00e9',   color: '#F59E0B' },
};

interface NodeEvidencePanelProps {
  node: CausalNode | AggregatedCausalNode;
  edges: CausalEdge[];
  allNodes: CausalNode[];
  syntheses?: { id: string; title: string; date: string }[];
  onClose: () => void;
}

function formatTimestamp(ts: number | undefined): string | null {
  if (!ts) return null;
  try {
    return new Date(ts * 1000).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export default function NodeEvidencePanel({
  node,
  edges,
  allNodes,
  syntheses,
  onClose,
}: NodeEvidencePanelProps) {
  const agg = node as AggregatedCausalNode;
  const typeConfig = NODE_TYPE_LABELS[node.node_type] || NODE_TYPE_LABELS.event;

  // Find causes (edges where this node is the effect)
  const causeEdges = edges.filter(e => e.effect_text === node.label);
  // Find effects (edges where this node is the cause)
  const effectEdges = edges.filter(e => e.cause_text === node.label);

  // Match source syntheses to titles
  const sourceSynthesesList = (agg.source_syntheses || []).map(sid => {
    const match = syntheses?.find(s => s.id === sid);
    return { id: sid, title: match?.title || sid, date: match?.date || '' };
  });

  return (
    <div style={{
      width: '320px',
      borderLeft: '1px solid #E5E5E5',
      backgroundColor: '#FFFFFF',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '2px solid #000',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '1px',
            color: typeConfig.color,
            textTransform: 'uppercase',
          }}>
            {typeConfig.label}
          </span>
          <h3 style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '18px',
            fontWeight: 700,
            color: '#000',
            margin: '4px 0 0 0',
            lineHeight: 1.3,
          }}>
            {node.label}
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid #E5E5E5',
            cursor: 'pointer',
            fontSize: '16px',
            color: '#6B7280',
            padding: '4px 8px',
            lineHeight: 1,
          }}
        >
          \u2715
        </button>
      </div>

      {/* Metadata */}
      <div style={{ padding: '16px', borderBottom: '1px solid #E5E5E5' }}>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#6B7280' }}>
          {agg.mention_count > 0 && (
            <span><strong style={{ color: '#000' }}>{agg.mention_count}</strong> mentions</span>
          )}
          {node.fact_density > 0 && (
            <span>Densit\u00e9: <strong style={{ color: '#000' }}>{Math.round(node.fact_density * 100)}%</strong></span>
          )}
        </div>
        {(agg.first_seen || agg.last_seen) && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#9CA3AF' }}>
            {formatTimestamp(agg.first_seen) && (
              <div>Apparu: {formatTimestamp(agg.first_seen)}</div>
            )}
            {formatTimestamp(agg.last_seen) && formatTimestamp(agg.last_seen) !== formatTimestamp(agg.first_seen) && (
              <div>Derni\u00e8re mention: {formatTimestamp(agg.last_seen)}</div>
            )}
          </div>
        )}
      </div>

      {/* Causes */}
      {causeEdges.length > 0 && (
        <div style={{ padding: '16px', borderBottom: '1px solid #E5E5E5' }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '1px',
            color: '#6B7280',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            Caus\u00e9 par ({causeEdges.length})
          </div>
          {causeEdges.map((e, i) => (
            <div key={i} style={{
              fontSize: '13px',
              color: '#374151',
              padding: '6px 0',
              borderBottom: i < causeEdges.length - 1 ? '1px solid #F3F4F6' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>{e.cause_text}</span>
              <span style={{ fontSize: '10px', color: '#9CA3AF' }}>
                {RELATION_LABELS_FR[e.relation_type] || e.relation_type} {Math.round(e.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Effects */}
      {effectEdges.length > 0 && (
        <div style={{ padding: '16px', borderBottom: '1px solid #E5E5E5' }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '1px',
            color: '#6B7280',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            Effets ({effectEdges.length})
          </div>
          {effectEdges.map((e, i) => (
            <div key={i} style={{
              fontSize: '13px',
              color: '#374151',
              padding: '6px 0',
              borderBottom: i < effectEdges.length - 1 ? '1px solid #F3F4F6' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>{e.effect_text}</span>
              <span style={{ fontSize: '10px', color: '#9CA3AF' }}>
                {RELATION_LABELS_FR[e.relation_type] || e.relation_type} {Math.round(e.confidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Source Syntheses */}
      {sourceSynthesesList.length > 0 && (
        <div style={{ padding: '16px' }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '1px',
            color: '#6B7280',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            Synth\u00e8ses sources ({sourceSynthesesList.length})
          </div>
          {sourceSynthesesList.map((s, i) => (
            <Link
              key={i}
              href={`/synthesis/${s.id}`}
              style={{
                display: 'block',
                fontSize: '13px',
                color: '#2563EB',
                textDecoration: 'none',
                padding: '6px 0',
                borderBottom: i < sourceSynthesesList.length - 1 ? '1px solid #F3F4F6' : 'none',
              }}
            >
              {s.title}
              {s.date && (
                <span style={{ fontSize: '11px', color: '#9CA3AF', marginLeft: '8px' }}>
                  {new Date(s.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* No extra data */}
      {causeEdges.length === 0 && effectEdges.length === 0 && sourceSynthesesList.length === 0 && (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
          Pas de d\u00e9tails suppl\u00e9mentaires disponibles.
        </div>
      )}
    </div>
  );
}
