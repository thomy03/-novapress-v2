'use client';

interface TransparencyBadgeProps {
  score: number;
  label?: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#2563EB'; // blue - excellent
  if (score >= 60) return '#16A34A'; // green - good
  if (score >= 40) return '#F59E0B'; // orange - moderate
  return '#DC2626'; // red - low
}

export default function TransparencyBadge({
  score,
  label,
  size = 'medium',
  showLabel = true,
}: TransparencyBadgeProps) {
  const dimensions = {
    small: { outer: 40, inner: 34, font: 12, labelFont: 9 },
    medium: { outer: 64, inner: 56, font: 20, labelFont: 11 },
    large: { outer: 96, inner: 84, font: 32, labelFont: 13 },
  }[size];

  const color = getScoreColor(score);
  const circumference = Math.PI * dimensions.inner;
  const progress = (score / 100) * circumference;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{
        position: 'relative',
        width: `${dimensions.outer}px`,
        height: `${dimensions.outer}px`,
      }}>
        <svg
          width={dimensions.outer}
          height={dimensions.outer}
          viewBox={`0 0 ${dimensions.outer} ${dimensions.outer}`}
        >
          {/* Background circle */}
          <circle
            cx={dimensions.outer / 2}
            cy={dimensions.outer / 2}
            r={dimensions.inner / 2}
            fill="none"
            stroke="#E5E5E5"
            strokeWidth="3"
          />
          {/* Progress circle */}
          <circle
            cx={dimensions.outer / 2}
            cy={dimensions.outer / 2}
            r={dimensions.inner / 2}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${progress} ${circumference - progress}`}
            strokeDashoffset={circumference / 4}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: `${dimensions.font}px`,
          fontWeight: 'bold',
          fontFamily: 'Georgia, serif',
          color,
        }}>
          {score}
        </div>
      </div>
      {showLabel && label && (
        <span style={{
          fontSize: `${dimensions.labelFont}px`,
          color: '#6B7280',
          fontWeight: '500',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {label}
        </span>
      )}
    </div>
  );
}
