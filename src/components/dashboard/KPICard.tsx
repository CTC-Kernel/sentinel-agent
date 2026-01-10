/**
 * KPICard Component
 * Displays a single KPI with large number, title, trend indicator
 * Implements ADR-004: Dashboard Configurable par Role
 * Per FR7: Uses simple language without ISO jargon
 */

import { useMemo } from 'react';
import { cn } from '../../lib/utils';
import type { TrendType } from '../../types/score.types';
import {
  type KPIColorScheme,
  KPI_COLOR_CLASSES,
  getTrendLabel,
} from '../../config/kpiConfig';

/**
 * TrendArrow component for displaying trend direction
 * @param invertColors - When true, UP is red (bad) and DOWN is green (good)
 *                       Use this for metrics where lower is better (e.g., risk count)
 */
function TrendArrow({
  trend,
  className,
  invertColors = false,
}: {
  trend: TrendType;
  className?: string;
  invertColors?: boolean;
}) {
  // Determine colors based on trend and inversion
  // Default: UP = green (good), DOWN = red (bad) - for metrics where higher is better
  // Inverted: UP = red (bad), DOWN = green (good) - for metrics where lower is better
  const upColor = invertColors ? 'text-red-500' : 'text-green-500';
  const downColor = invertColors ? 'text-green-500' : 'text-red-500';

  if (trend === 'stable') {
    return (
      <svg
        className={cn('w-5 h-5 text-gray-500', className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
      </svg>
    );
  }

  if (trend === 'up') {
    return (
      <svg
        className={cn('w-5 h-5', upColor, className)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
    );
  }

  return (
    <svg
      className={cn('w-5 h-5', downColor, className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export interface KPICardProps {
  /** Simple French label (no jargon) */
  title: string;
  /** Large number display */
  value: number | string;
  /** Additional context text */
  subtitle?: string;
  /** Trend direction */
  trend?: TrendType;
  /** Change percentage for trend */
  trendValue?: number;
  /** Color scheme based on status */
  colorScheme?: KPIColorScheme;
  /** Card size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Invert trend colors (use for metrics where lower is better, e.g., risk count) */
  invertTrendColors?: boolean;
}

/**
 * Size configurations for KPICard
 */
const SIZE_CONFIG = {
  sm: {
    value: 'text-2xl',
    title: 'text-sm',
    subtitle: 'text-xs',
    padding: 'p-3',
    minWidth: 'min-w-[140px]',
  },
  md: {
    value: 'text-4xl',
    title: 'text-lg',
    subtitle: 'text-sm',
    padding: 'p-4',
    minWidth: 'min-w-[180px]',
  },
  lg: {
    value: 'text-5xl',
    title: 'text-xl',
    subtitle: 'text-base',
    padding: 'p-6',
    minWidth: 'min-w-[220px]',
  },
} as const;

/**
 * KPICard - Displays a single KPI metric
 *
 * @example
 * ```tsx
 * <KPICard
 *   title="Sante Conformite"
 *   value={75}
 *   subtitle="Score global"
 *   trend="up"
 *   colorScheme="success"
 * />
 * ```
 */
export function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  colorScheme = 'neutral',
  size = 'md',
  className,
  onClick,
  loading = false,
  invertTrendColors = false,
}: KPICardProps) {
  const sizeConfig = SIZE_CONFIG[size];
  const colorClasses = KPI_COLOR_CLASSES[colorScheme];

  // Accessible label for trend
  const trendAriaLabel = useMemo(() => {
    if (!trend) return undefined;
    return getTrendLabel(trend, trendValue);
  }, [trend, trendValue]);

  // Loading skeleton
  if (loading) {
    return (
      <div
        className={cn(
          'rounded-lg border bg-card',
          sizeConfig.padding,
          sizeConfig.minWidth,
          'animate-pulse',
          className
        )}
      >
        <div className="flex flex-col gap-2">
          <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-card transition-all duration-200',
        colorClasses.bgLight,
        colorClasses.border,
        sizeConfig.padding,
        sizeConfig.minWidth,
        onClick && 'cursor-pointer hover:shadow-md hover:scale-[1.02]',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={`${title}: ${value}${subtitle ? `, ${subtitle}` : ''}${trendAriaLabel ? `, ${trendAriaLabel}` : ''}`}
    >
      <div className="flex flex-col">
        {/* Trend Arrow */}
        {trend && (
          <div className="flex items-center gap-1 mb-1">
            <TrendArrow trend={trend} invertColors={invertTrendColors} />
            {trendValue !== undefined && (
              <span
                className={cn(
                  'text-xs font-medium',
                  trend === 'up' && (invertTrendColors ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'),
                  trend === 'down' && (invertTrendColors ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'),
                  trend === 'stable' && 'text-gray-500'
                )}
              >
                {trend !== 'stable' && (trend === 'up' ? '+' : '-')}
                {Math.abs(trendValue)}%
              </span>
            )}
            <span className="sr-only">{trendAriaLabel}</span>
          </div>
        )}

        {/* Value - Large and prominent */}
        <div
          className={cn(
            'font-bold tabular-nums',
            sizeConfig.value,
            colorClasses.text
          )}
        >
          {value}
        </div>

        {/* Title - Simple language */}
        <div
          className={cn(
            'font-semibold text-foreground mt-1',
            sizeConfig.title
          )}
        >
          {title}
        </div>

        {/* Subtitle - Additional context */}
        {subtitle && (
          <div
            className={cn(
              'text-muted-foreground mt-0.5',
              sizeConfig.subtitle
            )}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

export default KPICard;
