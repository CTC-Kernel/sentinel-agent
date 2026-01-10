/**
 * TrendSparkline Component
 * Mini line chart showing score history with trend indicator
 * Implements ADR-003: Score de Conformité Global
 */

import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import type { ScoreHistory, TrendType } from '../../types/score.types';
import { getScoreHexColor } from '../../utils/scoreUtils';

export interface TrendSparklineProps {
  /** Historical score data */
  history: ScoreHistory[];
  /** Current trend direction */
  trend?: TrendType;
  /** Width of the sparkline */
  width?: number;
  /** Height of the sparkline */
  height?: number;
  /** Show trend arrow */
  showTrendArrow?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get trend arrow icon
 */
function TrendArrow({ trend, className }: { trend: TrendType; className?: string }) {
  if (trend === 'stable') {
    return (
      <svg
        className={cn('w-4 h-4 text-gray-500', className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14" />
      </svg>
    );
  }

  if (trend === 'up') {
    return (
      <svg
        className={cn('w-4 h-4 text-green-500', className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
    );
  }

  return (
    <svg
      className={cn('w-4 h-4 text-red-500', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * TrendSparkline - Mini line chart for score history
 *
 * @example
 * ```tsx
 * <TrendSparkline history={scoreHistory} trend="up" />
 * ```
 */
export function TrendSparkline({
  history,
  trend = 'stable',
  width = 100,
  height = 30,
  showTrendArrow = true,
  className,
}: TrendSparklineProps) {
  // Calculate sparkline path and reusable values
  const { path, lastScore, minScore, maxScore, range, padding, chartHeight } = useMemo(() => {
    if (!history || history.length === 0) {
      return { path: '', lastScore: 0, minScore: 0, maxScore: 0, range: 1, padding: 2, chartHeight: 0 };
    }

    const scores = history.map((h) => h.global);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const scoreRange = max - min || 1;

    // Padding for the line
    const pad = 2;
    const chartW = width - pad * 2;
    const chartH = height - pad * 2;

    // Create path points
    const points = scores.map((score, index) => {
      const x = pad + (index / (scores.length - 1 || 1)) * chartW;
      const y = pad + chartH - ((score - min) / scoreRange) * chartH;
      return `${x},${y}`;
    });

    const pathString = points.length > 1
      ? `M ${points.join(' L ')}`
      : points.length === 1
        ? `M ${points[0]} L ${points[0]}`
        : '';

    return {
      path: pathString,
      lastScore: scores[scores.length - 1] || 0,
      minScore: min,
      maxScore: max,
      range: scoreRange,
      padding: pad,
      chartHeight: chartH,
    };
  }, [history, width, height]);

  // Get color based on last score
  const strokeColor = getScoreHexColor(lastScore);

  if (!history || history.length === 0) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <span className="text-xs text-gray-400">Aucun historique</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        {/* Grid lines (subtle) */}
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-gray-200 dark:text-gray-700"
        />

        {/* Sparkline path */}
        {path && (
          <path
            d={path}
            fill="none"
            stroke={strokeColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* End dot */}
        {history.length > 0 && (
          <circle
            cx={width - padding}
            cy={padding + chartHeight - ((lastScore - minScore) / range) * chartHeight}
            r={3}
            fill={strokeColor}
          />
        )}
      </svg>

      {showTrendArrow && <TrendArrow trend={trend} />}
    </div>
  );
}

export default TrendSparkline;
