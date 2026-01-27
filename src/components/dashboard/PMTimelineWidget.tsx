/**
 * PMTimelineWidget Component
 * Displays upcoming deadlines timeline for Project Manager dashboard
 * Implements Story 2.5: Project Manager Progress View (AC: 1, 4, 5)
 * Per FR10: "Les project managers peuvent voir l'avancement du projet de conformite"
 */

import { cn } from '../../lib/utils';
import {
  useUpcomingDeadlines,
  getUrgencyColorScheme,
  URGENCY_COLOR_CLASSES,
  getTimelineItemTypeLabel,
  type TimelineItem,
} from '../../hooks/useUpcomingDeadlines';
import { ChevronRight, Calendar, AlertTriangle, RefreshCw, CalendarCheck } from '../ui/Icons';

/**
 * Props for PMTimelineWidget
 */
export interface PMTimelineWidgetProps {
  /** Organization/tenant ID */
  organizationId: string;
  /** Widget size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Handler when clicking a timeline item */
  onItemClick?: (itemId: string) => void;
  /** Handler when clicking "Voir tout" */
  onViewAllClick?: () => void;
  /** Days ahead to show (default: 30) */
  daysAhead?: number;
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
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return 'Date invalide';
  }
}

/**
 * Get due label based on days until due
 */
function getDueLabel(item: TimelineItem): string {
  if (item.isOverdue) {
    const days = Math.abs(item.daysUntilDue);
    return days === 1 ? 'Hier' : `Il y a ${days} jours`;
  }
  if (item.daysUntilDue === 0) return "Aujourd'hui";
  if (item.daysUntilDue === 1) return 'Demain';
  if (item.daysUntilDue <= 7) return `Dans ${item.daysUntilDue} jours`;
  return formatDueDate(item.dueDate);
}

/**
 * Timeline Item Component
 */
function TimelineItemRow({
  item,
  size,
  onClick,
  isLast,
}: {
  item: TimelineItem;
  size: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  isLast: boolean;
}) {
  const sizeConfig = SIZE_CONFIG[size];
  const urgency = getUrgencyColorScheme(item.daysUntilDue, item.isOverdue);
  const colors = URGENCY_COLOR_CLASSES[urgency];

  return (
    <div className="relative flex">
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center mr-3">
        <div
          className={cn(
            'w-3 h-3 rounded-full flex-shrink-0',
            colors.dot
          )}
          aria-hidden="true"
        />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-muted mt-1" />
        )}
      </div>

      {/* Item content */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex-1 flex items-center justify-between rounded-lg border transition-all mb-2',
          'hover:shadow-sm hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-offset-2 focus-visible:ring-brand-500',
          colors.bg,
          colors.border,
          sizeConfig.itemPadding
        )}
        aria-label={`${getTimelineItemTypeLabel(item.type)}: ${item.title}, ${getDueLabel(item)}`}
      >
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                colors.badge
              )}
            >
              {getTimelineItemTypeLabel(item.type)}
            </span>
            {item.isOverdue && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-destructive text-white">
                En retard
              </span>
            )}
          </div>
          <div
            className={cn(
              'font-medium truncate',
              sizeConfig.itemText,
              item.isOverdue ? 'text-destructive' : 'text-foreground'
            )}
          >
            {item.title}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Calendar
              className={cn('w-3 h-3', colors.text)}
              aria-hidden="true"
            />
            <span className={cn('text-xs', colors.text)}>
              {getDueLabel(item)}
            </span>
          </div>
        </div>
        <ChevronRight
          className={cn('w-4 h-4 flex-shrink-0 ml-2', colors.text)}
          aria-hidden="true"
        />
      </button>
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
        <div className="h-8 w-16 bg-muted rounded mb-2" />
        <div className="h-5 w-40 bg-muted rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex">
              <div className="w-3 h-3 bg-muted rounded-full mr-3" />
              <div className="flex-1 h-16 bg-muted rounded" />
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
function EmptyState({ size, daysAhead }: { size: 'sm' | 'md' | 'lg'; daysAhead: number }) {
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 text-center',
        'text-muted-foreground'
      )}
    >
      <CalendarCheck className="w-8 h-8 mb-2 text-green-500" aria-hidden="true" />
      <p className={cn('font-medium text-green-600 dark:text-green-400', sizeConfig.itemText)}>
        Aucune echeance proche
      </p>
      <p className="text-xs mt-1">
        Pas d'echeance dans les {daysAhead} prochains jours
      </p>
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
          'bg-red-100 dark:bg-red-900/30 text-destructive',
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
 * PMTimelineWidget - Displays upcoming deadlines timeline for Project Managers
 *
 * @example
 * ```tsx
 * <PMTimelineWidget
 *   organizationId="org-123"
 *   daysAhead={30}
 *   onItemClick={(id) => navigate(`/actions/${id}`)}
 *   onViewAllClick={() => navigate('/timeline')}
 * />
 * ```
 */
export function PMTimelineWidget({
  organizationId,
  size = 'md',
  className,
  onItemClick,
  onViewAllClick,
  daysAhead = 30,
  maxItems = 5,
}: PMTimelineWidgetProps) {
  const { items, count, dueSoonCount, loading, error, refetch } = useUpcomingDeadlines(
    organizationId,
    daysAhead,
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
      aria-label="Echeances a venir"
    >
      {/* Header with count */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'font-bold tabular-nums',
              dueSoonCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400',
              sizeConfig.count
            )}
            aria-live="polite"
          >
            {count}
          </span>
          {dueSoonCount > 0 && (
            <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
              ({dueSoonCount} cette semaine)
            </span>
          )}
        </div>
        <h3 className={cn('font-semibold text-foreground', sizeConfig.title)}>
          Echeances a Venir
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Prochaines {daysAhead} jours
        </p>
      </div>

      {/* Timeline or empty state */}
      {items.length === 0 ? (
        <EmptyState size={size} daysAhead={daysAhead} />
      ) : (
        <div className="flex flex-col">
          {items.map((item, index) => (
            <TimelineItemRow
              key={item.id}
              item={item}
              size={size}
              onClick={onItemClick ? () => onItemClick(item.id) : undefined}
              isLast={index === items.length - 1}
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
            'text-sm font-medium text-blue-600 dark:text-blue-400',
            'hover:bg-blue-50 dark:hover:bg-blue-900/30 dark:hover:bg-blue-900/20 transition-colors',
            'focus:outline-none focus:ring-2 focus-visible:ring-brand-500 focus:ring-offset-2'
          )}
        >
          Voir toutes les echeances ({count})
        </button>
      )}
    </div>
  );
}

export default PMTimelineWidget;
