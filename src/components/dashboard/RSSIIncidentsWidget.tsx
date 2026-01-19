/**
 * RSSIIncidentsWidget Component
 * Displays active incidents for RSSI dashboard
 * Implements Story 2.4: RSSI Risk & Incident View (AC: 1, 3, 4)
 * Per FR9: "Les RSSI peuvent voir les incidents en cours"
 */

import { cn } from '../../lib/utils';
import {
  useActiveIncidents,
  getSeverityColorScheme,
  SEVERITY_COLOR_CLASSES,
  type IncidentListItem,
} from '../../hooks/useActiveIncidents';
import { ChevronRight, AlertCircle, RefreshCw, ShieldAlert } from '../ui/Icons';

/**
 * Props for RSSIIncidentsWidget
 */
export interface RSSIIncidentsWidgetProps {
  /** Organization/tenant ID */
  organizationId: string;
  /** Widget size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Handler when clicking an incident item */
  onIncidentClick?: (incidentId: string) => void;
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
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return 'Date inconnue';
  }
}

/**
 * Incident List Item Component
 */
function IncidentItem({
  incident,
  size,
  onClick,
}: {
  incident: IncidentListItem;
  size: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}) {
  const sizeConfig = SIZE_CONFIG[size];
  const colorScheme = getSeverityColorScheme(incident.severity);
  const colors = SEVERITY_COLOR_CLASSES[colorScheme];

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
      aria-label={`Incident: ${incident.title}, Severite: ${incident.severity}, Statut: ${incident.status}`}
    >
      <div className="flex-1 text-left min-w-0">
        <div className={cn('font-medium truncate', sizeConfig.itemText, colors.text)}>
          {incident.title}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
              colors.badge
            )}
          >
            {incident.severity}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(incident.dateReported)}
          </span>
          {incident.category && (
            <span className="text-xs text-muted-foreground">• {incident.category}</span>
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
      <ShieldAlert className="w-8 h-8 mb-2 text-green-500" aria-hidden="true" />
      <p className={sizeConfig.itemText}>Aucun incident actif</p>
      <p className="text-xs mt-1">Tout est sous controle</p>
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
 * RSSIIncidentsWidget - Displays active incidents for RSSI
 *
 * @example
 * ```tsx
 * <RSSIIncidentsWidget
 *   organizationId="org-123"
 *   onIncidentClick={(id) => navigate(`/incidents/${id}`)}
 *   onViewAllClick={() => navigate('/incidents?filter=active')}
 * />
 * ```
 */
export function RSSIIncidentsWidget({
  organizationId,
  size = 'md',
  className,
  onIncidentClick,
  onViewAllClick,
  maxItems = 5,
}: RSSIIncidentsWidgetProps) {
  const { incidents, count, loading, error, refetch } = useActiveIncidents(
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
      aria-label="Incidents actifs"
    >
      {/* Header with count */}
      <div className="mb-4">
        <div
          className={cn(
            'font-bold tabular-nums',
            count > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400',
            sizeConfig.count
          )}
        >
          {count}
        </div>
        <h3 className={cn('font-semibold text-foreground', sizeConfig.title)}>
          Incidents Actifs
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Incidents necessitant une attention
        </p>
      </div>

      {/* Incident list or empty state */}
      {incidents.length === 0 ? (
        <EmptyState size={size} />
      ) : (
        <div className={cn('flex flex-col', sizeConfig.gap)}>
          {incidents.map((incident) => (
            <IncidentItem
              key={incident.id}
              incident={incident}
              size={size}
              onClick={onIncidentClick ? () => onIncidentClick(incident.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* View all link */}
      {incidents.length > 0 && onViewAllClick && (
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
          Voir tous les incidents
        </button>
      )}
    </div>
  );
}

export default RSSIIncidentsWidget;
