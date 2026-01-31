/**
 * useUpcomingDeadlines Hook
 * Fetches upcoming deadlines for PM dashboard timeline
 * Implements Story 2.5: Project Manager Progress View (AC: 1, 4, 5)
 * Per FR10: "Les project managers peuvent voir l'avancement du projet de conformite"
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
import { ErrorLogger } from '../services/errorLogger';
import type { TrendType } from '../types/score.types';
import { calculateTrend } from '../utils/trendUtils';

/**
 * Timeline item types
 */
export type TimelineItemType = 'action' | 'milestone' | 'audit' | 'document';

/**
 * Timeline item for display
 */
export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  type: TimelineItemType;
  dueDate: string;
  daysUntilDue: number;
  isOverdue: boolean;
  isDueSoon: boolean; // Due within 7 days
  status: string;
  assigneeId?: string;
  assigneeName?: string;
}

/**
 * Result type for useUpcomingDeadlines hook
 */
export interface UpcomingDeadlinesResult {
  /** List of timeline items */
  items: TimelineItem[];
  /** Total count of upcoming items */
  count: number;
  /** Count of items due soon (within 7 days) */
  dueSoonCount: number;
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
 * Calculate days until due date
 */
function calculateDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get urgency color scheme based on days until due
 */
export function getUrgencyColorScheme(
  daysUntilDue: number,
  isOverdue: boolean
): 'danger' | 'warning' | 'normal' {
  if (isOverdue) return 'danger';
  if (daysUntilDue <= 7) return 'warning';
  return 'normal';
}

/**
 * Get Tailwind classes for urgency color
 */
export const URGENCY_COLOR_CLASSES = {
  danger: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-500 text-white',
    dot: 'bg-red-500',
  },
  warning: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-500 text-white',
    dot: 'bg-orange-500',
  },
  normal: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-500 text-white',
    dot: 'bg-blue-500',
  },
} as const;

/**
 * Get icon for timeline item type
 */
export function getTimelineItemTypeLabel(type: TimelineItemType): string {
  switch (type) {
    case 'action':
      return 'Action';
    case 'milestone':
      return 'Jalon';
    case 'audit':
      return 'Audit';
    case 'document':
      return 'Document';
    default:
      return 'Item';
  }
}

/**
 * Hook to fetch and monitor upcoming deadlines
 *
 * @param tenantId - The tenant/organization ID
 * @param daysAhead - Number of days to look ahead (default: 30)
 * @param maxItems - Maximum number of items to return (default: 10)
 * @returns UpcomingDeadlinesResult with items list, count, trend, and loading state
 *
 * @example
 * ```tsx
 * const { items, count, dueSoonCount, loading } = useUpcomingDeadlines('tenant-123', 30);
 * ```
 */
export function useUpcomingDeadlines(
  tenantId: string | undefined,
  daysAhead: number = 30,
  maxItems: number = 10
): UpcomingDeadlinesResult {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [count, setCount] = useState<number>(0);
  const [dueSoonCount, setDueSoonCount] = useState<number>(0);
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
        // Calculate date range
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        // Query for pending actions with due dates in range
        const actionsQuery = query(
          collection(db, `tenants/${tenantId}/actions`),
          where('status', 'in', PENDING_ACTION_STATUSES),
          orderBy('dueDate', 'asc'),
          limit(maxItems * 2) // Fetch more to filter
        );

        unsubscribe = onSnapshot(
          actionsQuery,
          (snapshot) => {
            const timelineItems: TimelineItem[] = [];

            snapshot.docs.forEach((doc) => {
              const data = doc.data();
              const dueDate = data.dueDate || data.deadline || '';

              if (!dueDate) return;

              const daysUntilDue = calculateDaysUntilDue(dueDate);
              const isOverdue = daysUntilDue < 0;
              const isDueSoon = !isOverdue && daysUntilDue <= 7;

              // Include if within our range (including overdue)
              if (daysUntilDue <= daysAhead) {
                timelineItems.push({
                  id: doc.id,
                  title: data.title || data.description || 'Item sans titre',
                  description: data.description,
                  type: (data.type as TimelineItemType) || 'action',
                  dueDate: dueDate,
                  daysUntilDue,
                  isOverdue,
                  isDueSoon,
                  status: data.status || 'pending',
                  assigneeId: data.assigneeId,
                  assigneeName: data.assigneeName,
                });
              }
            });

            // Sort by due date (earliest first, overdue at top)
            timelineItems.sort((a, b) => {
              // Overdue items come first
              if (a.isOverdue && !b.isOverdue) return -1;
              if (!a.isOverdue && b.isOverdue) return 1;
              // Then sort by days until due
              return a.daysUntilDue - b.daysUntilDue;
            });

            // Limit to maxItems
            const limitedItems = timelineItems.slice(0, maxItems);

            setItems(limitedItems);

            const newCount = timelineItems.length;
            const newDueSoonCount = timelineItems.filter((item) => item.isDueSoon).length;
            setDueSoonCount(newDueSoonCount);

            // Store previous count for trend calculation
            setCount((prevCount) => {
              if (prevCount !== newCount) {
                setPreviousCount(prevCount);
                setTrend(calculateTrend(newCount, prevCount));
              } else {
                setTrend((curr) => curr || 'stable');
              }
              return newCount;
            });

            setError(null);
            setFetchedTenantId(tenantId);
            setIsRefetching(false);
          },
          (err) => {
            ErrorLogger.error(err, 'useUpcomingDeadlines.onSnapshot');
            setError(err as Error);
            setFetchedTenantId(tenantId);
            setIsRefetching(false);
          }
        );
      } catch (err) {
        ErrorLogger.error(err, 'useUpcomingDeadlines.setupListener');
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
  }, [tenantId, daysAhead, maxItems, refreshKey]);

  return {
    items: tenantId ? items : [],
    count: tenantId ? count : 0,
    dueSoonCount: tenantId ? dueSoonCount : 0,
    previousCount,
    trend,
    loading: tenantId ? loading : false,
    error,
    refetch,
  };
}

export default useUpcomingDeadlines;
