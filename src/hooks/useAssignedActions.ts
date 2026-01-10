/**
 * useAssignedActions Hook
 * Fetches assigned actions for RSSI dashboard
 * Implements Story 2.4: RSSI Risk & Incident View (AC: 1, 4)
 * Per FR9: "Les RSSI peuvent voir les actions assignees"
 */

import { useState, useEffect, useCallback } from 'react';
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
import type { TrendType } from '../types/score.types';

/**
 * Action item for list display
 */
export interface ActionListItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  dueDate: string;
  assigneeId?: string;
  isOverdue: boolean;
  isDueSoon: boolean; // Due within 7 days
  daysUntilDue: number;
}

/**
 * Result type for useAssignedActions hook
 */
export interface AssignedActionsResult {
  /** List of assigned actions */
  actions: ActionListItem[];
  /** Total count of assigned actions */
  count: number;
  /** Count of overdue actions */
  overdueCount: number;
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
 * Action statuses that count as "pending"
 */
const PENDING_ACTION_STATUSES = ['pending', 'in_progress', 'Planifié', 'En cours'];

/**
 * Calculate trend based on count comparison
 */
function calculateTrend(current: number, previous: number): TrendType {
  if (previous === 0 && current === 0) return 'stable';
  if (previous === 0) return current > 0 ? 'up' : 'stable';

  const percentChange = ((current - previous) / previous) * 100;

  // Use 5% threshold for significant change
  if (percentChange > 5) return 'up';
  if (percentChange < -5) return 'down';
  return 'stable';
}

/**
 * Calculate days until due date
 */
function calculateDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get due status color scheme
 */
export function getDueStatusColorScheme(
  isOverdue: boolean,
  isDueSoon: boolean
): 'danger' | 'warning' | 'neutral' {
  if (isOverdue) return 'danger';
  if (isDueSoon) return 'warning';
  return 'neutral';
}

/**
 * Get Tailwind classes for due status color
 */
export const DUE_STATUS_COLOR_CLASSES = {
  danger: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-500 text-white',
  },
  warning: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-500 text-white',
  },
  neutral: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
    badge: 'bg-gray-500 text-white',
  },
} as const;

/**
 * Hook to fetch and monitor assigned actions
 *
 * @param tenantId - The tenant/organization ID
 * @param userId - The current user ID to filter assigned actions
 * @param maxItems - Maximum number of items to return (default: 10)
 * @returns AssignedActionsResult with actions list, count, trend, and loading state
 *
 * @example
 * ```tsx
 * const { actions, count, overdueCount, loading } = useAssignedActions('tenant-123', 'user-456');
 * ```
 */
export function useAssignedActions(
  tenantId: string | undefined,
  userId: string | undefined,
  maxItems: number = 10
): AssignedActionsResult {
  const [actions, setActions] = useState<ActionListItem[]>([]);
  const [count, setCount] = useState<number>(0);
  const [overdueCount, setOverdueCount] = useState<number>(0);
  const [previousCount, setPreviousCount] = useState<number | null>(null);
  const [trend, setTrend] = useState<TrendType | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // State for loading management
  const [fetchedTenantId, setFetchedTenantId] = useState<string | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);

  // Derived loading state
  const loading = (!!tenantId && tenantId !== fetchedTenantId) || isRefetching;

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


    let unsubscribe: Unsubscribe | null = null;

    const setupListener = async () => {
      try {
        // Build query - filter by user if provided
        let actionsQuery;
        if (userId) {
          actionsQuery = query(
            collection(db, `tenants/${tenantId}/actions`),
            where('assigneeId', '==', userId),
            where('status', 'in', PENDING_ACTION_STATUSES),
            orderBy('dueDate', 'asc'),
            limit(maxItems)
          );
        } else {
          // If no userId, get all pending actions
          actionsQuery = query(
            collection(db, `tenants/${tenantId}/actions`),
            where('status', 'in', PENDING_ACTION_STATUSES),
            orderBy('dueDate', 'asc'),
            limit(maxItems)
          );
        }

        unsubscribe = onSnapshot(
          actionsQuery,
          (snapshot) => {
            const actionItems: ActionListItem[] = snapshot.docs.map((doc) => {
              const data = doc.data();
              const dueDate = data.dueDate || data.deadline || '';
              const daysUntilDue = dueDate ? calculateDaysUntilDue(dueDate) : Infinity;
              const isOverdue = daysUntilDue < 0;
              const isDueSoon = !isOverdue && daysUntilDue <= 7;

              return {
                id: doc.id,
                title: data.title || data.description || 'Action sans titre',
                description: data.description,
                type: data.type || 'general',
                status: data.status || 'pending',
                dueDate: dueDate,
                assigneeId: data.assigneeId,
                isOverdue,
                isDueSoon,
                daysUntilDue,
              };
            });

            // Sort: overdue first, then by due date
            actionItems.sort((a, b) => {
              if (a.isOverdue && !b.isOverdue) return -1;
              if (!a.isOverdue && b.isOverdue) return 1;
              return a.daysUntilDue - b.daysUntilDue;
            });

            setActions(actionItems);

            const newCount = actionItems.length;
            const newOverdueCount = actionItems.filter((a) => a.isOverdue).length;
            setOverdueCount(newOverdueCount);

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
            console.error('Error fetching assigned actions:', err);
            setError(err as Error);
            setFetchedTenantId(tenantId);
            setIsRefetching(false);
          }
        );
      } catch (err) {
        console.error('Error setting up assigned actions listener:', err);
        setError(err as Error);
        setFetchedTenantId(tenantId);
        setIsRefetching(false);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [tenantId, userId, maxItems, refreshKey]);

  return {
    actions,
    count,
    overdueCount,
    previousCount,
    trend,
    loading,
    error,
    refetch,
  };
}

export default useAssignedActions;
