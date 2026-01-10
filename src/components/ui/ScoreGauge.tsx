/**
 * ScoreGauge Component
 * Animated circular gauge for displaying compliance score (Apple Health Style)
 * Implements ADR-003: Score de Conformité Global
 */

import { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { getScoreTextColor, getScoreLevel } from '../../utils/scoreUtils';

export type ScoreGaugeSize = 'sm' | 'md' | 'lg';

export interface ScoreGaugeProps {
  /** Score value from 0 to 100 */
  score: number;
  /** Size variant */
  size?: ScoreGaugeSize;
  /** Enable animation on score changes */
  showAnimation?: boolean;
  /** Show the score number in center */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Click handler for opening breakdown */
  onClick?: () => void;
  /** Accessible label */
  ariaLabel?: string;
}

/** Size configurations */
const SIZE_CONFIG: Record<ScoreGaugeSize, { diameter: number; strokeWidth: number; fontSize: string }> = {
  sm: { diameter: 80, strokeWidth: 6, fontSize: 'text-xl' },
  md: { diameter: 120, strokeWidth: 8, fontSize: 'text-2xl' },
  lg: { diameter: 180, strokeWidth: 10, fontSize: 'text-4xl' },
};

/**
 * Gradient color stops for each score level
 */
const GRADIENT_COLORS = {
  critical: { start: '#fca5a5', end: '#ef4444' }, // red-300 to red-500
  warning: { start: '#fdba74', end: '#f97316' },  // orange-300 to orange-500
  good: { start: '#86efac', end: '#22c55e' },     // green-300 to green-500
} as const;

/**
 * ScoreGauge - Circular progress gauge component
 *
 * @example
 * ```tsx
 * <ScoreGauge score={75} size="lg" onClick={() => setShowBreakdown(true)} />
 * ```
 */
export function ScoreGauge({
  score,
  size = 'md',
  showAnimation = true,
  showLabel = true,
  className,
  onClick,
  ariaLabel,
}: ScoreGaugeProps) {
  const config = SIZE_CONFIG[size];
  const { diameter, strokeWidth, fontSize } = config;

  // SVG calculations
  const radius = (diameter - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.max(0, Math.min(100, score));
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  // Center position
  const center = diameter / 2;

  // Get colors - use scoreUtils for consistency
  const scoreLevel = getScoreLevel(normalizedScore);
  const gradientColors = GRADIENT_COLORS[scoreLevel];
  const textColorClass = getScoreTextColor(normalizedScore);

  // Unique gradient ID for this instance
  const [gradientId] = useState(() => `score-gradient-${Math.random().toString(36).substr(2, 9)}`);

  // Critical score pulse animation
  const isCritical = normalizedScore < 30;

  // Memoize the gauge path for performance
  const gaugeStyle = useMemo(() => ({
    strokeDasharray: circumference,
    strokeDashoffset: strokeDashoffset,
    transition: showAnimation ? 'stroke-dashoffset 1s ease-out' : 'none',
  }), [circumference, strokeDashoffset, showAnimation]);

  const isClickable = !!onClick;

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center',
        isClickable && 'cursor-pointer hover:scale-105 transition-transform',
        isCritical && showAnimation && 'animate-pulse',
        className
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      role="meter"
      aria-valuenow={normalizedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || `Score de conformité: ${normalizedScore}%`}
      tabIndex={isClickable ? 0 : undefined}
    >
      <svg
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
        className="transform -rotate-90"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gradientColors.start} />
            <stop offset="100%" stopColor={gradientColors.end} />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />

        {/* Score arc with gradient */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          style={gaugeStyle}
        />
      </svg>

      {/* Center label */}
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', fontSize, textColorClass)}>
            {Math.round(normalizedScore)}
          </span>
        </div>
      )}
    </div>
  );
}

export default ScoreGauge;
