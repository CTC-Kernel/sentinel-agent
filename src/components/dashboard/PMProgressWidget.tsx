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
import { useTranslation } from 'react-i18next';

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
 * Category label i18n keys
 */
const CATEGORY_KEYS: Record<string, string> = {
 controls: 'pm.category.controls',
 documents: 'pm.category.documents',
 actions: 'pm.category.actions',
 milestones: 'pm.category.milestones',
};
const CATEGORY_DEFAULTS: Record<string, string> = {
 controls: 'Contrôles',
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
 className={cn('w-4 h-4 text-muted-foreground', className)}
 aria-hidden="true"
 />
 );
 }

 if (trend === 'up') {
 return (
 <TrendingUp
 className={cn('w-4 h-4 text-success', className)}
 aria-hidden="true"
 />
 );
 }

 return (
 <TrendingDown
 className={cn('w-4 h-4 text-destructive', className)}
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
 'hover:bg-muted/50 rounded-lg p-2 -m-2',
 'focus:outline-none focus:ring-2 focus-visible:ring-primary focus:ring-offset-2'
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
 'w-full rounded-full bg-muted overflow-hidden',
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
 const { t } = useTranslation();
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
 className="text-muted-foreground/60"
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
 {t('pm.overallProgress', { defaultValue: 'Progression Globale' })}
 </h3>
 <div className="flex items-center gap-1 mt-1">
 <TrendArrow trend={trend} />
 <span className="text-xs text-muted-foreground">
 {trend === 'up' ? t('pm.trend.up', { defaultValue: 'En hausse' }) : trend === 'down' ? t('pm.trend.down', { defaultValue: 'En baisse' }) : t('pm.trend.stable', { defaultValue: 'Stable' })}
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
 <div className="w-24 h-24 rounded-full bg-muted" />
 <div>
 <div className="h-5 w-32 bg-muted rounded mb-2" />
 <div className="h-4 w-20 bg-muted rounded" />
 </div>
 </div>
 <div className="space-y-4">
 {[1, 2, 3, 4].map((i) => (
 <div key={i || 'unknown'}>
 <div className="flex justify-between mb-1">
 <div className="h-4 w-20 bg-muted rounded" />
 <div className="h-4 w-16 bg-muted rounded" />
 </div>
 <div className="h-2 bg-muted rounded-full" />
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
 const { t } = useTranslation();
 const sizeConfig = SIZE_CONFIG[size];

 return (
 <div
 className={cn(
 'flex flex-col items-center justify-center py-8 text-center',
 'text-muted-foreground'
 )}
 >
 <Target className="w-8 h-8 mb-2 text-primary" aria-hidden="true" />
 <p className={sizeConfig.itemText}>{t('pm.empty.title', { defaultValue: 'Aucune donnée de progression' })}</p>
 <p className="text-xs mt-1">{t('pm.empty.description', { defaultValue: 'Commencez par ajouter des contrôles et actions' })}</p>
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
 const { t } = useTranslation();
 const sizeConfig = SIZE_CONFIG[size];

 return (
 <div
 className={cn(
 'flex flex-col items-center justify-center py-8 text-center',
 'text-destructive'
 )}
 >
 <AlertTriangle className="w-8 h-8 mb-2" aria-hidden="true" />
 <p className={sizeConfig.itemText}>{error.message || t('pm.error.loading', { defaultValue: 'Erreur de chargement' })}</p>
 <button
 type="button"
 onClick={onRetry}
 className={cn(
 'mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-md',
 'bg-error-bg text-error-text',
 'hover:bg-error-bg/80 transition-colors',
 'text-sm font-medium'
 )}
 >
 <RefreshCw className="w-4 h-4" aria-hidden="true" />
 {t('common.retry', { defaultValue: 'Réessayer' })}
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
 * organizationId="org-123"
 * onCategoryClick={(cat) => navigate(`/${cat}`)}
 * />
 * ```
 */
export function PMProgressWidget({
 organizationId,
 size = 'md',
 className,
 onCategoryClick,
}: PMProgressWidgetProps) {
 const { t } = useTranslation();
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
 aria-label={t('pm.ariaLabel', { defaultValue: 'Progression du projet' })}
 >
 {/* Overall progress */}
 <div className="mb-6">
 <OverallProgress percentage={progress.overall} trend={trend} size={size} />
 </div>

 {/* Category progress bars */}
 <div className={cn('flex flex-col', sizeConfig.gap)}>
 <ProgressBar
 progress={progress.controls}
 label={t(CATEGORY_KEYS.controls, { defaultValue: CATEGORY_DEFAULTS.controls })}
 size={size}
 onClick={onCategoryClick ? () => onCategoryClick('controls') : undefined}
 />
 <ProgressBar
 progress={progress.documents}
 label={t(CATEGORY_KEYS.documents, { defaultValue: CATEGORY_DEFAULTS.documents })}
 size={size}
 onClick={onCategoryClick ? () => onCategoryClick('documents') : undefined}
 />
 <ProgressBar
 progress={progress.actions}
 label={t(CATEGORY_KEYS.actions, { defaultValue: CATEGORY_DEFAULTS.actions })}
 size={size}
 onClick={onCategoryClick ? () => onCategoryClick('actions') : undefined}
 />
 <ProgressBar
 progress={progress.milestones}
 label={t(CATEGORY_KEYS.milestones, { defaultValue: CATEGORY_DEFAULTS.milestones })}
 size={size}
 onClick={onCategoryClick ? () => onCategoryClick('milestones') : undefined}
 />
 </div>

 {/* Summary footer */}
 <div className="mt-4 pt-3 border-t border-border/40">
 <p className="text-xs text-muted-foreground text-center">
 {t('pm.milestonesReached', { defaultValue: '{{completed}}/{{total}} jalons atteints', completed: progress.milestones.completed, total: progress.milestones.total })}
 </p>
 </div>
 </div>
 );
}

export default PMProgressWidget;
