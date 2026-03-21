'use client';

import React, { useState } from 'react';
import type { Prediction, PredictionType } from '@/app/types/causal';

interface PredictionBranchData {
  prediction: Prediction;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  index: number;
  total: number;
}

const SCENARIO_COLORS = {
  high: { path: '#10B981', glow: 'rgba(16, 185, 129, 0.4)', bg: 'rgba(16, 185, 129, 0.12)' },
  medium: { path: '#F59E0B', glow: 'rgba(245, 158, 11, 0.4)', bg: 'rgba(245, 158, 11, 0.12)' },
  low: { path: '#EF4444', glow: 'rgba(239, 68, 68, 0.4)', bg: 'rgba(239, 68, 68, 0.12)' },
};

const TYPE_ICONS: Record<PredictionType, string> = {
  economic: '\uD83D\uDCC8',
  political: '\uD83C\uDFDB\uFE0F',
  social: '\uD83D\uDC65',
  geopolitical: '\uD83C\uDF0D',
  tech: '\uD83D\uDCBB',
  general: '\uD83D\uDCCB',
};

const TIMEFRAME_LABELS: Record<string, string> = {
  court_terme: 'Court terme',
  moyen_terme: 'Moyen terme',
  long_terme: 'Long terme',
};

function getScenarioLevel(probability: number): 'high' | 'medium' | 'low' {
  if (probability >= 0.6) return 'high';
  if (probability >= 0.3) return 'medium';
  return 'low';
}

interface NexusPredictionBranchProps {
  branches: PredictionBranchData[];
  onHover?: (prediction: Prediction | null, e?: React.MouseEvent) => void;
}

export default function NexusPredictionBranch({ branches, onHover }: NexusPredictionBranchProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <g>
      {branches.map((branch, i) => {
        const level = getScenarioLevel(branch.prediction.probability);
        const colors = SCENARIO_COLORS[level];
        const pathWidth = Math.max(1.5, branch.prediction.probability * 5);
        const icon = TYPE_ICONS[branch.prediction.type] || '\uD83D\uDCCB';
        const isExpanded = expandedIndex === i;

        // Curved path from cause node to prediction endpoint
        const dx = branch.endX - branch.startX;
        const cpX = branch.startX + dx * 0.5;
        const cpY1 = branch.startY;
        const cpY2 = branch.endY;
        const pathD = `M ${branch.startX} ${branch.startY} C ${cpX} ${cpY1} ${cpX} ${cpY2} ${branch.endX} ${branch.endY}`;

        return (
          <g
            key={`pred-${i}`}
            className="nexus-branch-appear"
            style={{ animationDelay: `${600 + i * 150}ms` }}
          >
            {/* Path glow */}
            <path
              d={pathD}
              fill="none"
              stroke={colors.glow}
              strokeWidth={pathWidth + 4}
              opacity={0.2}
            />

            {/* Main path */}
            <path
              d={pathD}
              fill="none"
              stroke={colors.path}
              strokeWidth={pathWidth}
              opacity={0.6}
              strokeDasharray="1000"
              className="nexus-branch-grow"
              style={{ animationDelay: `${600 + i * 150}ms` }}
            />

            {/* Animated particles */}
            <path
              d={pathD}
              fill="none"
              stroke={colors.path}
              strokeWidth={1}
              strokeDasharray="2 10"
              className="nexus-particle"
              opacity={0.5}
            />

            {/* Scenario card at endpoint */}
            <g
              transform={`translate(${branch.endX}, ${branch.endY})`}
              onMouseEnter={(e) => {
                setExpandedIndex(i);
                onHover?.(branch.prediction, e);
              }}
              onMouseLeave={() => {
                setExpandedIndex(null);
                onHover?.(null);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Glassmorphism card background */}
              <rect
                x={-4}
                y={-28}
                width={isExpanded ? 180 : 140}
                height={isExpanded ? 80 : 56}
                rx={6}
                fill="rgba(15, 23, 42, 0.85)"
                stroke={colors.path}
                strokeWidth={1}
                opacity={0.9}
                style={{ transition: 'all 0.3s ease', backdropFilter: 'blur(8px)' }}
              />

              {/* Probability (large, glowing) */}
              <text
                x={8}
                y={-8}
                fontSize="18"
                fontWeight="700"
                fill={colors.path}
                fontFamily="var(--font-label)"
                style={{ filter: `drop-shadow(0 0 4px ${colors.glow})` }}
              >
                {Math.round(branch.prediction.probability * 100)}%
              </text>

              {/* Type icon + timeframe */}
              <text
                x={70}
                y={-10}
                fontSize="10"
                fill="#94A3B8"
                fontFamily="var(--font-sans)"
              >
                {icon} {TIMEFRAME_LABELS[branch.prediction.timeframe] || branch.prediction.timeframe}
              </text>

              {/* Prediction text */}
              <text
                x={8}
                y={14}
                fontSize="9"
                fill="#CBD5E1"
                fontFamily="var(--font-sans)"
              >
                {branch.prediction.prediction.length > 40
                  ? branch.prediction.prediction.slice(0, 38) + '...'
                  : branch.prediction.prediction}
              </text>

              {/* Expanded rationale */}
              {isExpanded && branch.prediction.rationale && (
                <text
                  x={8}
                  y={34}
                  fontSize="8"
                  fill="#64748B"
                  fontFamily="var(--font-sans)"
                >
                  {branch.prediction.rationale.length > 50
                    ? branch.prediction.rationale.slice(0, 48) + '...'
                    : branch.prediction.rationale}
                </text>
              )}

              {/* Glowing dot at path endpoint */}
              <circle
                cx={-4}
                cy={0}
                r={5}
                fill={colors.path}
                opacity={0.8}
              >
                <animate
                  attributeName="r"
                  values="4;6;4"
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.6;1;0.6"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          </g>
        );
      })}
    </g>
  );
}
