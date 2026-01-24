/**
 * RSSICriticalRisksWidget Component
 * Displays critical risks for RSSI dashboard
 * Implements Story 2.4: RSSI Risk & Incident View (AC: 1, 2, 3)
 * Per FR8: "Les RSSI peuvent voir les risques ouverts classes par criticite"
 */

import { cn } from '../../lib/utils';
import {
  useCriticalRisksList,
  getCriticalityColorScheme,
  CRITICALITY_COLOR_CLASSES,
  type RiskListItem,
} from '../../hooks/useCriticalRisksList';
import { ChevronRight, AlertTriangle, RefreshCw } from '../ui/Icons';

/**
 * Props for RSSICriticalRisksWidget
 */
export interface RSSICriticalRisksWidgetProps {
  /** Organization/tenant ID */
  organizationId: string;
  /** Widget size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Handler when clicking a risk item */
  onRiskClick?: (riskId: string) => void;
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
 * Risk List Item Component
 */
function RiskItem({
  risk,
  size,
  onClick,
}: {
  risk: RiskListItem;
  size: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}) {
  const sizeConfig = SIZE_CONFIG[size];
  const colorScheme = getCriticalityColorScheme(risk.criticality);
  const colors = CRITICALITY_COLOR_CLASSES[colorScheme];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between rounded-lg border transition-all',
        'hover:shadow-sm hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-offset-2 focus-visible:ring-brand-500',
        colors.bg,
        colors.border,
        sizeConfig.itemPadding
      )}
      aria-label={`Risque: ${risk.title}, Criticite: ${risk.criticality}, Categorie: ${risk.category}`}
    >
      <div className="flex-1 text-left min-w-0">
        <div className={cn('font-medium truncate', sizeConfig.itemText, colors.text)}>
          {risk.title}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-xs', 'text-muted-foreground')}>{risk.category}</span>
          <span
            className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
              colors.bg,
              colors.text
            )}
          >
            {risk.criticality}
          </span>
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
        <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 bg-slate-200 dark:bg-slate-700 rounded"
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
      <AlertTriangle className="w-8 h-8 mb-2 text-green-500" aria-hidden="true" />
      <p className={sizeConfig.itemText}>Aucun risque critique</p>
      <p className="text-xs mt-1">Tous les risques sont sous controle</p>
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
 * RSSICriticalRisksWidget - Displays critical risks for RSSI
 *
 * @example
 * ```tsx
 * <RSSICriticalRisksWidget
 *   organizationId="org-123"
 *   onRiskClick={(id) => navigate(`/risks/${id}`)}
 *   onViewAllClick={() => navigate('/risks?filter=critical')}
 * />
 * ```
 */
export function RSSICriticalRisksWidget({
  organizationId,
  size = 'md',
  className,
  onRiskClick,
  onViewAllClick,
  maxItems = 5,
}: RSSICriticalRisksWidgetProps) {
  const { risks, count, loading, error, refetch } = useCriticalRisksList(
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
      aria-label="Risques critiques"
    >
      {/* Header with count */}
      <div className="mb-4">
        <div className={cn('font-bold tabular-nums text-red-600 dark:text-red-400', sizeConfig.count)}>
          {count}
        </div>
        <h3 className={cn('font-semibold text-foreground', sizeConfig.title)}>
          Risques Critiques
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tries par criticite (impact × probabilite)
        </p>
      </div>

      {/* Risk list or empty state */}
      {risks.length === 0 ? (
        <EmptyState size={size} />
      ) : (
        <div className={cn('flex flex-col', sizeConfig.gap)}>
          {risks.map((risk) => (
            <RiskItem
              key={risk.id}
              risk={risk}
              size={size}
              onClick={onRiskClick ? () => onRiskClick(risk.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* View all link */}
      {risks.length > 0 && onViewAllClick && (
        <button
          type="button"
          onClick={onViewAllClick}
          className={cn(
            'mt-4 w-full text-center py-2 rounded-md',
            'text-sm font-medium text-blue-600 dark:text-blue-400',
            'hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors',
            'focus:outline-none focus:ring-2 focus-visible:ring-brand-500 focus:ring-offset-2'
          )}
        >
          Voir tous les risques
        </button>
      )}
    </div>
  );
}

export default RSSICriticalRisksWidget;
