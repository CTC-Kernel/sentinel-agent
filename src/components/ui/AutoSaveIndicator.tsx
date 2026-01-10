/**
 * AutoSaveIndicator - Visual indicator for auto-save status (Story 1.4)
 *
 * Displays the current auto-save status with localized labels and
 * appropriate visual feedback for each state.
 *
 * @module AutoSaveIndicator
 */

import { Loader2, Check, AlertCircle, RefreshCw, Clock } from './Icons';
import { useLocale } from '../../hooks/useLocale';
import type { AutoSaveStatus } from '../../hooks/useAutoSave';
import type { SupportedLocale } from '../../config/localeConfig';

/**
 * Localized labels for the AutoSaveIndicator
 */
const labels = {
  fr: {
    saving: 'Enregistrement...',
    saved: 'Enregistré',
    error: "Échec de l'enregistrement",
    retry: 'Réessayer',
    pending: 'Modifications en attente...',
    justNow: 'À l\'instant',
    minutesAgo: (n: number) => `il y a ${n} min`,
    hoursAgo: (n: number) => `il y a ${n}h`,
  },
  en: {
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Save failed',
    retry: 'Retry',
    pending: 'Changes pending...',
    justNow: 'Just now',
    minutesAgo: (n: number) => `${n} min ago`,
    hoursAgo: (n: number) => `${n}h ago`,
  },
} as const;

/**
 * Get localized label for a key
 */
export function getAutoSaveLabel(
  locale: SupportedLocale,
  key: keyof typeof labels.fr
): string | ((n: number) => string) {
  return labels[locale][key];
}

interface AutoSaveIndicatorProps {
  /** Current auto-save status */
  status: AutoSaveStatus;
  /** Timestamp of last successful save */
  lastSavedAt: Date | null;
  /** Error from last failed save attempt */
  error: Error | null;
  /** Callback to retry a failed save */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * Format relative time for display
 */
function formatRelativeTime(date: Date, locale: SupportedLocale): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);

  const l = labels[locale];

  if (diffMinutes < 1) {
    return l.justNow;
  } else if (diffMinutes < 60) {
    return l.minutesAgo(diffMinutes);
  } else {
    return l.hoursAgo(diffHours);
  }
}

/**
 * AutoSaveIndicator component for displaying auto-save status.
 *
 * @example
 * ```tsx
 * <AutoSaveIndicator
 *   status={autoSaveStatus}
 *   lastSavedAt={lastSavedAt}
 *   error={saveError}
 *   onRetry={retry}
 * />
 * ```
 */
export function AutoSaveIndicator({
  status,
  lastSavedAt,
  error: _error,
  onRetry,
  className = '',
  compact = false,
}: AutoSaveIndicatorProps): React.ReactElement | null {
  const { locale } = useLocale();
  const l = labels[locale];

  // Base styles for the container
  const baseStyles = 'inline-flex items-center gap-1.5 text-sm transition-all duration-200';

  // Don't render anything for idle status
  if (status === 'idle') {
    return null;
  }

  // Status-specific rendering
  switch (status) {
    case 'pending':
      return (
        <div
          className={`${baseStyles} text-slate-500 dark:text-slate-400 ${className}`}
          role="status"
          aria-live="polite"
        >
          <Clock className="w-4 h-4" />
          {!compact && <span>{l.pending}</span>}
        </div>
      );

    case 'saving':
      return (
        <div
          className={`${baseStyles} text-blue-600 dark:text-blue-400 ${className}`}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          {!compact && <span>{l.saving}</span>}
        </div>
      );

    case 'saved':
      return (
        <div
          className={`${baseStyles} text-emerald-600 dark:text-emerald-400 ${className}`}
          role="status"
          aria-live="polite"
        >
          <Check className="w-4 h-4" />
          {!compact && (
            <span>
              {l.saved}
              {lastSavedAt && (
                <span className="text-slate-400 dark:text-slate-500 ml-1">
                  ({formatRelativeTime(lastSavedAt, locale)})
                </span>
              )}
            </span>
          )}
        </div>
      );

    case 'error':
      return (
        <div
          className={`${baseStyles} text-rose-600 dark:text-rose-400 ${className}`}
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="w-4 h-4" />
          {!compact && (
            <>
              <span>{l.error}</span>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 text-xs font-medium
                           bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300
                           rounded hover:bg-rose-200 dark:hover:bg-rose-900/50
                           focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1
                           transition-colors"
                  type="button"
                  aria-label={l.retry}
                >
                  <RefreshCw className="w-3 h-3" />
                  {l.retry}
                </button>
              )}
            </>
          )}
        </div>
      );

    default:
      return null;
  }
};

export default AutoSaveIndicator;
