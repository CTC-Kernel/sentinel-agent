/**
 * ComplianceScoreWidget Component
 * Full widget assembly integrating ScoreGauge, TrendSparkline, and ScoreBreakdownPanel
 * Implements ADR-003: Score de Conformité Global (Apple Health Style)
 */

import { useState, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { useComplianceScore } from '../../hooks/useComplianceScore';
import { ScoreGauge, type ScoreGaugeSize } from '../ui/ScoreGauge';
import { TrendSparkline } from '../ui/TrendSparkline';
import { ScoreBreakdownPanel } from './ScoreBreakdownPanel';
import { getScoreStatusLabel } from '../../utils/scoreUtils';

export interface ComplianceScoreWidgetProps {
  /** Organization ID to fetch score for */
  organizationId: string | undefined;
  /** Gauge size */
  size?: ScoreGaugeSize;
  /** Show sparkline trend */
  showSparkline?: boolean;
  /** Show breakdown panel on click */
  showBreakdownOnClick?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Title override */
  title?: string;
}

/**
 * Loading skeleton for the widget
 */
function WidgetSkeleton({ size = 'md' }: { size?: ScoreGaugeSize }) {
  const dimensions = {
    sm: 'w-20 h-20',
    md: 'w-[120px] h-[120px]',
    lg: 'w-[180px] h-[180px]',
  };

  return (
    <div className="flex flex-col items-center gap-3 animate-pulse">
      <div className={cn('rounded-full bg-slate-200 dark:bg-slate-700', dimensions[size])} />
      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
      <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
    </div>
  );
}

/**
 * Error state for the widget
 */
function WidgetError({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center p-4">
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 dark:bg-red-900 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-red-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <p className="text-sm text-slate-600 dark:text-muted-foreground">
        Impossible de charger le score: {error.message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-400 font-medium"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}

/**
 * Empty state when no score exists
 */
function WidgetEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 text-center p-4">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      </div>
      <p className="text-sm text-slate-600 dark:text-muted-foreground">
        Aucun score calculé
      </p>
      <p className="text-xs text-slate-500">
        Le score sera calculé automatiquement
      </p>
    </div>
  );
}

/**
 * ComplianceScoreWidget - Complete score display widget
 *
 * @example
 * ```tsx
 * <ComplianceScoreWidget
 *   organizationId={user.organizationId}
 *   size="lg"
 *   showSparkline
 *   showBreakdownOnClick
 * />
 * ```
 */
export function ComplianceScoreWidget({
  organizationId,
  size = 'md',
  showSparkline = true,
  showBreakdownOnClick = true,
  className,
  title = 'Score de Conformité',
}: ComplianceScoreWidgetProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Handle ESC key to close modal
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setShowBreakdown(false);
    }
  }, []);

  useEffect(() => {
    if (showBreakdown) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showBreakdown, handleKeyDown]);

  const { score, breakdown, trend, history, loading, error, refetch } = useComplianceScore(organizationId, {
    realtime: true,
    historyDays: 30,
  });

  // Loading state
  if (loading) {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <WidgetSkeleton size={size} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <WidgetError error={error} onRetry={refetch} />
      </div>
    );
  }

  // Empty state
  if (!score) {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <WidgetEmpty />
      </div>
    );
  }

  const statusLabel = getScoreStatusLabel(score.global, 'fr');

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* Title */}
      <h3 className="text-sm font-medium text-slate-500 dark:text-muted-foreground">
        {title}
      </h3>

      {/* Gauge */}
      <ScoreGauge
        score={score.global}
        size={size}
        onClick={showBreakdownOnClick ? () => setShowBreakdown(true) : undefined}
        ariaLabel={`${title}: ${score.global}% - ${statusLabel}`}
      />

      {/* Status label */}
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 dark:text-muted-foreground">
        {statusLabel}
      </span>

      {/* Sparkline */}
      {showSparkline && history.length > 0 && (
        <TrendSparkline
          history={history}
          trend={trend || 'stable'}
          width={size === 'lg' ? 140 : size === 'md' ? 100 : 80}
          height={size === 'lg' ? 40 : 30}
        />
      )}

      {/* Breakdown Panel (Modal-like) */}
      {showBreakdown && breakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowBreakdown(false)} onKeyDown={(e) => e.key === 'Escape' && setShowBreakdown(false)} role="button" tabIndex={0} aria-label="Fermer le panneau">
          <div onClick={(e) => e.stopPropagation()} role="presentation">
            <ScoreBreakdownPanel
              breakdown={breakdown}
              calculationDetails={score.calculationDetails}
              isOpen={showBreakdown}
              onClose={() => setShowBreakdown(false)}
              className="max-w-md w-full mx-4"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ComplianceScoreWidget;
