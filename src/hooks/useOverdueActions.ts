/**
 * useOverdueActions Hook
 * Fetches overdue actions for PM dashboard
 * Implements Story 2.5: Project Manager Progress View (AC: 1, 2, 5)
 * Per FR10: "Les project managers peuvent voir l'avancement du projet de conformite"
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from '../services/errorLogger';
import type { TrendType } from '../types/score.types';
import { calculateTrend } from '../utils/trendUtils';

/**
 * Overdue action item for list display
 */
export interface OverdueActionItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  dueDate: string;
  assigneeId?: string;
  assigneeName?: string;
  daysOverdue: number;
}

/**
 * Result type for useOverdueActions hook
 */
export interface OverdueActionsResult {
  /** List of overdue actions */
  actions: OverdueActionItem[];
  /** Total count of overdue actions */
  count: number;
  /** Previous period count for trend calculation */
  previousCount: number | null;
  /** Trend direction based on comparison */
  trend: TrendType | null;
  /** Loading state */
  loading: boolean;
  /** Error if any */
  error: Error | null;
  /** Function to manually refetch */
  refetch: () => void;
}

/**
 * Action statuses that count as "pending" (not completed)
 */
const PENDING_ACTION_STATUSES = ['pending', 'in_progress', 'Planifié', 'En cours'];

/**
 * Calculate days overdue from due date
 */
function calculateDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diffTime = now.getTime() - due.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get overdue severity color scheme
 */
export function getOverdueSeverityColorScheme(
  daysOverdue: number
): 'critical' | 'high' | 'medium' {
  if (daysOverdue >= 14) return 'critical';
  if (daysOverdue >= 7) return 'high';
  return 'medium';
}

/**
 * Get Tailwind classes for overdue severity
 */
export const OVERDUE_SEVERITY_COLOR_CLASSES = {
  critical: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-300 dark:border-red-700',
    badge: 'bg-red-600 text-white',
  },
  high: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-500 text-white',
  },
  medium: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-500 text-white',
  },
} as const;

/**
 * Hook to fetch and monitor overdue actions
 *
 * @param tenantId - The tenant/organization ID
 * @param maxItems - Maximum number of items to return (default: 10)
 * @returns OverdueActionsResult with actions list, count, trend, and loading state
 *
 * @example
 * ```tsx
 * const { actions, count, loading } = useOverdueActions('tenant-123');
 * ```
 */
export function useOverdueActions(
  tenantId: string | undefined,
  maxItems: number = 10
): OverdueActionsResult {
  const { t } = useTranslation();
  const [actions, setActions] = useState<OverdueActionItem[]>([]);
  const [count, setCount] = useState<number>(0);
  const [previousCount, setPreviousCount] = useState<number | null>(null);
  const [trend, setTrend] = useState<TrendType | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // State for loading management
  const [fetchedTenantId, setFetchedTenantId] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  const loading = useMemo(
    () => (!!tenantId && tenantId !== fetchedTenantId) || isRefetching,
    [tenantId, fetchedTenantId, isRefetching]
  );

  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setIsRefetching(true);
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!tenantId) {
      return;
    }

    // Loading is derived, no set state needed.


    const unsubRef = { current: null as Unsubscribe | null };
    let cancelled = false;

    const setupListener = async () => {
      try {
        // Query for all pending actions to filter overdue ones client-side
        // (Firestore doesn't support < comparison with serverTimestamp well)
        // Query for all pending actions to filter overdue ones client-side
        // Using root 'actions' collection with organizationId
        const actionsQuery = query(
          collection(db, 'actions'),
          where('organizationId', '==', tenantId),
          where('status', 'in', PENDING_ACTION_STATUSES),
          orderBy('dueDate', 'asc'),
          limit(maxItems * 2) // Fetch more to filter overdue
        );

        const unsub = onSnapshot(
          actionsQuery,
          (snapshot) => {
            const overdueItems: OverdueActionItem[] = [];

            snapshot.docs.forEach((doc) => {
              const data = doc.data();
              const dueDate = data.dueDate || data.deadline || '';

              if (!dueDate) return;

              const daysOverdue = calculateDaysOverdue(dueDate);

              // Only include overdue actions (daysOverdue > 0)
              if (daysOverdue > 0) {
                overdueItems.push({
                  id: doc.id,
                  title: data.title || data.description || t('actions.untitled', { defaultValue: 'Untitled action' }),
                  description: data.description,
                  type: data.type || 'general',
                  status: data.status || 'pending',
                  dueDate: dueDate,
                  assigneeId: data.assigneeId,
                  assigneeName: data.assigneeName,
                  daysOverdue,
                });
              }
            });

            // Sort by days overdue (most overdue first)
            overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);

            // Limit to maxItems
            const limitedItems = overdueItems.slice(0, maxItems);

            setActions(limitedItems);

            const newCount = overdueItems.length;

            // Store previous count for trend calculation
            setCount((prevCount) => {
              if (prevCount !== newCount) {
                setPreviousCount(prevCount);
                setTrend(calculateTrend(newCount, prevCount));
              } else if (trend === null) {
                setTrend('stable');
              }
              return newCount;
            });

            setError(null);
            setFetchedTenantId(tenantId);
            setIsRefetching(false);
          },
          (err) => {
            ErrorLogger.error(err, 'useOverdueActions.onSnapshot');
            setError(err as Error);
            setFetchedTenantId(tenantId);
            setIsRefetching(false);
          }
        );
        if (cancelled) {
          unsub();
          return;
        }
        unsubRef.current = unsub;
      } catch (err) {
        ErrorLogger.error(err, 'useOverdueActions.setupListener');
        setError(err as Error);
        setFetchedTenantId(tenantId);
        setIsRefetching(false);
      }
    };

    setupListener();

    return () => {
      cancelled = true;
      unsubRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trend is intentionally excluded to prevent re-subscription on trend changes
  }, [tenantId, maxItems, refreshKey]);

  return {
    actions,
    count,
    previousCount,
    trend,
    loading,
    error,
    refetch,
  };
}

export default useOverdueActions;
