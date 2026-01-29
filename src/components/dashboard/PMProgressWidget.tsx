/**
 * PMProgressWidget Component
 * Displays project completion progress for Project Manager dashboard
 * Implements Story 2.5: Project Manager Progress View (AC: 1, 3, 5)
 * Per FR10: "Les project managers peuvent voir l'avancement du projet de conformite"
 */

import { cn } from '../../lib/utils';
import {
  useProjectProgress,
  getProgressColorScheme,
  PROGRESS_COLOR_CLASSES,
  type CategoryProgress,
} from '../../hooks/useProjectProgress';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw, Target } from '../ui/Icons';
import type { TrendType } from '../../types/score.types';

/**
 * Props for PMProgressWidget
 */
export interface PMProgressWidgetProps {
  /** Organization/tenant ID */
  organizationId: string;
  /** Widget size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Handler when clicking a category */
  onCategoryClick?: (category: string) => void;
}

/**
 * Size configurations
 */
const SIZE_CONFIG = {
  sm: {
    overall: 'text-3xl',
    title: 'text-sm',
    itemText: 'text-xs',
    padding: 'p-3',
    gap: 'gap-2',
    barHeight: 'h-1.5',
  },
  md: {
    overall: 'text-4xl',
    title: 'text-base',
    itemText: 'text-sm',
    padding: 'p-4',
    gap: 'gap-3',
    barHeight: 'h-2',
  },
  lg: {
    overall: 'text-5xl',
    title: 'text-lg',
    itemText: 'text-base',
    padding: 'p-6',
    gap: 'gap-4',
    barHeight: 'h-3',
  },
} as const;

/**
 * Category labels in French
 */
const CATEGORY_LABELS: Record<string, string> = {
  controls: 'Controles',
  documents: 'Documents',
  actions: 'Actions',
  milestones: 'Jalons',
};

/**
 * Trend Arrow Component
 */
function TrendArrow({ trend, className }: { trend: TrendType | null; className?: string }) {
  if (!trend || trend === 'stable') {
    return (
      <Minus
        className={cn('w-4 h-4 text-slate-600', className)}
        aria-hidden="true"
      />
    );
  }

  if (trend === 'up') {
    return (
      <TrendingUp
        className={cn('w-4 h-4 text-green-500', className)}
        aria-hidden="true"
      />
    );
  }

  return (
    <TrendingDown
      className={cn('w-4 h-4 text-red-500', className)}
      aria-hidden="true"
    />
  );
}

/**
 * Progress Bar Component
 */
function ProgressBar({
  progress,
  label,
  size,
  onClick,
}: {
  progress: CategoryProgress;
  label: string;
  size: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}) {
  const sizeConfig = SIZE_CONFIG[size];
  const colorScheme = getProgressColorScheme(progress.percentage);
  const colors = PROGRESS_COLOR_CLASSES[colorScheme];

  const Component = onClick ? 'button' : 'div';
  const buttonProps = onClick
    ? {
        type: 'button' as const,
        onClick,
        className: cn(
          'w-full text-left transition-all',
          'hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg p-2 -m-2',
          'focus:outline-none focus:ring-2 focus-visible:ring-brand-500 focus:ring-offset-2'
        ),
      }
    : {};

  return (
    <Component {...buttonProps}>
      <div className="flex items-center justify-between mb-1">
        <span className={cn('font-medium', sizeConfig.itemText)}>{label}</span>
        <span className={cn('text-xs tabular-nums', colors.text)}>
          {progress.completed}/{progress.total} ({progress.percentage}%)
        </span>
      </div>
      <div
        className={cn(
          'w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden',
          sizeConfig.barHeight
        )}
        role="progressbar"
        aria-valuenow={progress.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${progress.percentage}% complete`}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors.bg)}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    </Component>
  );
}

/**
 * Overall Progress Circle
 */
function OverallProgress({
  percentage,
  trend,
  size,
}: {
  percentage: number;
  trend: TrendType | null;
  size: 'sm' | 'md' | 'lg';
}) {
  const sizeConfig = SIZE_CONFIG[size];
  const colorScheme = getProgressColorScheme(percentage);
  const colors = PROGRESS_COLOR_CLASSES[colorScheme];

  // Circle progress SVG
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      {/* Circular progress */}
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-200 dark:text-slate-700"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={colors.text}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        {/* Percentage in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold tabular-nums', sizeConfig.overall, colors.text)}>
            {percentage}
          </span>
        </div>
      </div>

      {/* Label and trend */}
      <div>
        <h3 className={cn('font-semibold text-foreground', sizeConfig.title)}>
          Progression Globale
        </h3>
        <div className="flex items-center gap-1 mt-1">
          <TrendArrow trend={trend} />
          <span className="text-xs text-muted-foreground">
            {trend === 'up' ? 'En hausse' : trend === 'down' ? 'En baisse' : 'Stable'}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading Skeleton
 */
function LoadingSkeleton({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div className={cn('rounded-lg border bg-card', sizeConfig.padding)}>
      <div className="animate-pulse">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div>
            <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="flex justify-between mb-1">
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Empty State
 */
function EmptyState({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 text-center',
        'text-muted-foreground'
      )}
    >
      <Target className="w-8 h-8 mb-2 text-blue-500" aria-hidden="true" />
      <p className={sizeConfig.itemText}>Aucune donnee de progression</p>
      <p className="text-xs mt-1">Commencez par ajouter des controles et actions</p>
    </div>
  );
}

/**
 * Error State
 */
function ErrorState({
  error,
  onRetry,
  size,
}: {
  error: Error;
  onRetry: () => void;
  size: 'sm' | 'md' | 'lg';
}) {
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 text-center',
        'text-red-600 dark:text-red-400'
      )}
    >
      <AlertTriangle className="w-8 h-8 mb-2" aria-hidden="true" />
      <p className={sizeConfig.itemText}>{error.message || 'Erreur de chargement'}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-md',
          'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
          'hover:bg-red-200 dark:hover:bg-red-50 dark:hover:bg-red-900/30 dark:bg-red-9000 transition-colors',
          'text-sm font-medium'
        )}
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        Reessayer
      </button>
    </div>
  );
}

/**
 * PMProgressWidget - Displays project completion progress for Project Managers
 *
 * @example
 * ```tsx
 * <PMProgressWidget
 *   organizationId="org-123"
 *   onCategoryClick={(cat) => navigate(`/${cat}`)}
 * />
 * ```
 */
export function PMProgressWidget({
  organizationId,
  size = 'md',
  className,
  onCategoryClick,
}: PMProgressWidgetProps) {
  const { progress, trend, loading, error, refetch } = useProjectProgress(organizationId);

  const sizeConfig = SIZE_CONFIG[size];

  // Loading state
  if (loading) {
    return <LoadingSkeleton size={size} />;
  }

  // Error state
  if (error) {
    return (
      <div className={cn('rounded-lg border bg-card', sizeConfig.padding, className)}>
        <ErrorState error={error} onRetry={refetch} size={size} />
      </div>
    );
  }

  // Check if we have any data
  const hasData =
    progress.controls.total > 0 ||
    progress.documents.total > 0 ||
    progress.actions.total > 0 ||
    progress.milestones.total > 0;

  if (!hasData) {
    return (
      <div className={cn('rounded-lg border bg-card', sizeConfig.padding, className)}>
        <EmptyState size={size} />
      </div>
    );
  }

  return (
    <div
      className={cn('rounded-lg border bg-card', sizeConfig.padding, className)}
      role="region"
      aria-label="Progression du projet"
    >
      {/* Overall progress */}
      <div className="mb-6">
        <OverallProgress percentage={progress.overall} trend={trend} size={size} />
      </div>

      {/* Category progress bars */}
      <div className={cn('flex flex-col', sizeConfig.gap)}>
        <ProgressBar
          progress={progress.controls}
          label={CATEGORY_LABELS.controls}
          size={size}
          onClick={onCategoryClick ? () => onCategoryClick('controls') : undefined}
        />
        <ProgressBar
          progress={progress.documents}
          label={CATEGORY_LABELS.documents}
          size={size}
          onClick={onCategoryClick ? () => onCategoryClick('documents') : undefined}
        />
        <ProgressBar
          progress={progress.actions}
          label={CATEGORY_LABELS.actions}
          size={size}
          onClick={onCategoryClick ? () => onCategoryClick('actions') : undefined}
        />
        <ProgressBar
          progress={progress.milestones}
          label={CATEGORY_LABELS.milestones}
          size={size}
          onClick={onCategoryClick ? () => onCategoryClick('milestones') : undefined}
        />
      </div>

      {/* Summary footer */}
      <div className="mt-4 pt-3 border-t border-border/40 dark:border-slate-700">
        <p className="text-xs text-muted-foreground text-center">
          {progress.milestones.completed}/{progress.milestones.total} jalons atteints
        </p>
      </div>
    </div>
  );
}

export default PMProgressWidget;
