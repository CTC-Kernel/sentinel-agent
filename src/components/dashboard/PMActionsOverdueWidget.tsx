/**
 * PMActionsOverdueWidget Component
 * Displays overdue actions for Project Manager dashboard
 * Implements Story 2.5: Project Manager Progress View (AC: 1, 2, 5)
 * Per FR10: "Les project managers peuvent voir l'avancement du projet de conformite"
 */

import { cn } from '../../lib/utils';
import {
  useOverdueActions,
  getOverdueSeverityColorScheme,
  OVERDUE_SEVERITY_COLOR_CLASSES,
  type OverdueActionItem,
} from '../../hooks/useOverdueActions';
import { ChevronRight, Clock, AlertTriangle, RefreshCw, CheckCircle } from '../ui/Icons';

/**
 * Props for PMActionsOverdueWidget
 */
export interface PMActionsOverdueWidgetProps {
  /** Organization/tenant ID */
  organizationId: string;
  /** Widget size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Handler when clicking an action item */
  onActionClick?: (actionId: string) => void;
  /** Handler when clicking "Voir tout" */
  onViewAllClick?: () => void;
  /** Maximum items to display */
  maxItems?: number;
}

/**
 * Size configurations
 */
const SIZE_CONFIG = {
  sm: {
    count: 'text-2xl',
    title: 'text-sm',
    itemText: 'text-xs',
    padding: 'p-3',
    gap: 'gap-2',
    itemPadding: 'p-2',
  },
  md: {
    count: 'text-3xl',
    title: 'text-base',
    itemText: 'text-sm',
    padding: 'p-4',
    gap: 'gap-3',
    itemPadding: 'p-3',
  },
  lg: {
    count: 'text-4xl',
    title: 'text-lg',
    itemText: 'text-base',
    padding: 'p-6',
    gap: 'gap-4',
    itemPadding: 'p-4',
  },
} as const;

/**
 * Format due date for display
 */
function formatDueDate(dateString: string): string {
  if (!dateString) return 'Sans echeance';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return 'Date invalide';
  }
}

/**
 * Get overdue label
 */
function getOverdueLabel(daysOverdue: number): string {
  if (daysOverdue === 1) return 'En retard (1 jour)';
  return `En retard (${daysOverdue} jours)`;
}

/**
 * Action List Item Component
 */
function ActionItem({
  action,
  size,
  onClick,
}: {
  action: OverdueActionItem;
  size: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}) {
  const sizeConfig = SIZE_CONFIG[size];
  const severity = getOverdueSeverityColorScheme(action.daysOverdue);
  const colors = OVERDUE_SEVERITY_COLOR_CLASSES[severity];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between rounded-lg border transition-all',
        'hover:shadow-sm hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500',
        colors.bg,
        colors.border,
        sizeConfig.itemPadding
      )}
      aria-label={`Action en retard: ${action.title}, ${getOverdueLabel(action.daysOverdue)}`}
    >
      <div className="flex-1 text-left min-w-0">
        <div
          className={cn(
            'font-medium truncate',
            sizeConfig.itemText,
            colors.text
          )}
        >
          {action.title}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Clock
            className={cn('w-3 h-3', colors.text)}
            aria-hidden="true"
          />
          <span className={cn('text-xs', colors.text)}>
            Echeance: {formatDueDate(action.dueDate)}
          </span>
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
              colors.badge
            )}
          >
            En retard
          </span>
        </div>
        {action.assigneeName && (
          <div className="text-xs text-muted-foreground mt-1">
            Assigne a: {action.assigneeName}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 ml-2">
        <span className={cn('text-xs font-bold', colors.text)}>
          +{action.daysOverdue}j
        </span>
        <ChevronRight
          className={cn('w-4 h-4 flex-shrink-0', colors.text)}
          aria-hidden="true"
        />
      </div>
    </button>
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
        <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i || 'unknown'}
              className="h-16 bg-slate-200 dark:bg-slate-700 rounded"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Empty State - No overdue actions (good!)
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
      <CheckCircle className="w-8 h-8 mb-2 text-green-500" aria-hidden="true" />
      <p className={cn('font-medium text-green-600 dark:text-green-400', sizeConfig.itemText)}>
        Aucune action en retard
      </p>
      <p className="text-xs mt-1">Toutes les actions sont dans les delais</p>
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
 * PMActionsOverdueWidget - Displays overdue actions for Project Managers
 *
 * @example
 * ```tsx
 * <PMActionsOverdueWidget
 *   organizationId="org-123"
 *   onActionClick={(id) => navigate(`/actions/${id}`)}
 *   onViewAllClick={() => navigate('/actions?filter=overdue')}
 * />
 * ```
 */
export function PMActionsOverdueWidget({
  organizationId,
  size = 'md',
  className,
  onActionClick,
  onViewAllClick,
  maxItems = 5,
}: PMActionsOverdueWidgetProps) {
  const { actions, count, loading, error, refetch } = useOverdueActions(
    organizationId,
    maxItems
  );

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

  return (
    <div
      className={cn('rounded-lg border bg-card', sizeConfig.padding, className)}
      role="region"
      aria-label="Actions en retard"
    >
      {/* Header with count */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'font-bold tabular-nums',
              count > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
              sizeConfig.count
            )}
            aria-live="polite"
          >
            {count}
          </span>
          {count > 0 && (
            <AlertTriangle
              className="w-5 h-5 text-red-500"
              aria-hidden="true"
            />
          )}
        </div>
        <h3 className={cn('font-semibold text-foreground', sizeConfig.title)}>
          Actions en Retard
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Actions ayant depasse leur echeance
        </p>
      </div>

      {/* Action list or empty state */}
      {actions.length === 0 ? (
        <EmptyState size={size} />
      ) : (
        <div className={cn('flex flex-col', sizeConfig.gap)}>
          {actions.map((action) => (
            <ActionItem
              key={action.id || 'unknown'}
              action={action}
              size={size}
              onClick={onActionClick ? () => onActionClick(action.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* View all link */}
      {count > 0 && onViewAllClick && (
        <button
          type="button"
          onClick={onViewAllClick}
          className={cn(
            'mt-4 w-full text-center py-2 rounded-md',
            'text-sm font-medium text-red-600 dark:text-red-400',
            'hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2'
          )}
        >
          Voir toutes les actions en retard ({count})
        </button>
      )}
    </div>
  );
}

export default PMActionsOverdueWidget;
