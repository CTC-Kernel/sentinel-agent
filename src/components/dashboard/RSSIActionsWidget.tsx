/**
 * RSSIActionsWidget Component
 * Displays assigned actions for RSSI dashboard
 * Implements Story 2.4: RSSI Risk & Incident View (AC: 1, 3)
 * Per FR9: "Les RSSI peuvent voir les actions assignees"
 */

import { cn } from '../../lib/utils';
import {
  useAssignedActions,
  getDueStatusColorScheme,
  DUE_STATUS_COLOR_CLASSES,
  type ActionListItem,
} from '../../hooks/useAssignedActions';
import { ChevronRight, Clock, AlertCircle, RefreshCw, CheckCircle } from '../ui/Icons';

/**
 * Props for RSSIActionsWidget
 */
export interface RSSIActionsWidgetProps {
  /** Organization/tenant ID */
  organizationId: string;
  /** Current user ID for filtering assigned actions */
  userId?: string;
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
 * Get due status label
 */
function getDueStatusLabel(action: ActionListItem): string {
  if (action.isOverdue) {
    const days = Math.abs(action.daysUntilDue);
    return days === 1 ? 'En retard (1 jour)' : `En retard (${days} jours)`;
  }
  if (action.isDueSoon) {
    if (action.daysUntilDue === 0) return "Aujourd'hui";
    if (action.daysUntilDue === 1) return 'Demain';
    return `Dans ${action.daysUntilDue} jours`;
  }
  return formatDueDate(action.dueDate);
}

/**
 * Action List Item Component
 */
function ActionItem({
  action,
  size,
  onClick,
}: {
  action: ActionListItem;
  size: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}) {
  const sizeConfig = SIZE_CONFIG[size];
  const colorScheme = getDueStatusColorScheme(action.isOverdue, action.isDueSoon);
  const colors = DUE_STATUS_COLOR_CLASSES[colorScheme];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between rounded-lg border transition-all',
        'hover:shadow-sm hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
        colors.bg,
        colors.border,
        sizeConfig.itemPadding
      )}
      aria-label={`Action: ${action.title}, Echeance: ${getDueStatusLabel(action)}, ${action.isOverdue ? 'En retard' : ''}`}
    >
      <div className="flex-1 text-left min-w-0">
        <div
          className={cn(
            'font-medium truncate',
            sizeConfig.itemText,
            action.isOverdue ? 'text-red-700 dark:text-red-300' : 'text-foreground'
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
            {getDueStatusLabel(action)}
          </span>
          {action.isOverdue && (
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                colors.badge
              )}
            >
              En retard
            </span>
          )}
        </div>
      </div>
      <ChevronRight
        className={cn('w-4 h-4 flex-shrink-0 ml-2', colors.text)}
        aria-hidden="true"
      />
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
        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 bg-gray-200 dark:bg-gray-700 rounded"
            />
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
      <CheckCircle className="w-8 h-8 mb-2 text-green-500" aria-hidden="true" />
      <p className={sizeConfig.itemText}>Aucune action en attente</p>
      <p className="text-xs mt-1">Toutes les actions sont completees</p>
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
      <AlertCircle className="w-8 h-8 mb-2" aria-hidden="true" />
      <p className={sizeConfig.itemText}>{error.message || 'Erreur de chargement'}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-md',
          'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
          'hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors',
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
 * RSSIActionsWidget - Displays assigned actions for RSSI
 *
 * @example
 * ```tsx
 * <RSSIActionsWidget
 *   organizationId="org-123"
 *   userId="user-456"
 *   onActionClick={(id) => navigate(`/actions/${id}`)}
 *   onViewAllClick={() => navigate('/actions?filter=assigned')}
 * />
 * ```
 */
export function RSSIActionsWidget({
  organizationId,
  userId,
  size = 'md',
  className,
  onActionClick,
  onViewAllClick,
  maxItems = 10,
}: RSSIActionsWidgetProps) {
  const { actions, count, overdueCount, loading, error, refetch } = useAssignedActions(
    organizationId,
    userId,
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
      aria-label="Actions assignees"
    >
      {/* Header with count */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'font-bold tabular-nums',
              overdueCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400',
              sizeConfig.count
            )}
          >
            {count}
          </span>
          {overdueCount > 0 && (
            <span className="text-sm text-red-600 dark:text-red-400 font-medium">
              ({overdueCount} en retard)
            </span>
          )}
        </div>
        <h3 className={cn('font-semibold text-foreground', sizeConfig.title)}>
          Actions Assignees
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Actions en attente triees par echeance
        </p>
      </div>

      {/* Action list or empty state */}
      {actions.length === 0 ? (
        <EmptyState size={size} />
      ) : (
        <div className={cn('flex flex-col', sizeConfig.gap)}>
          {actions.map((action) => (
            <ActionItem
              key={action.id}
              action={action}
              size={size}
              onClick={onActionClick ? () => onActionClick(action.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* View all link */}
      {actions.length > 0 && onViewAllClick && (
        <button
          type="button"
          onClick={onViewAllClick}
          className={cn(
            'mt-4 w-full text-center py-2 rounded-md',
            'text-sm font-medium text-blue-600 dark:text-blue-400',
            'hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          )}
        >
          Voir toutes les actions
        </button>
      )}
    </div>
  );
}

export default RSSIActionsWidget;
