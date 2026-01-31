/**
 * useOngoingAudits Hook
 * Fetches ongoing audits count for KPI display
 * Implements Story 2.3: Executive KPI Cards
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from '../services/errorLogger';
import type { TrendType } from '../types/score.types';
import { calculateTrend } from '../utils/trendUtils';

/**
 * Result type for useOngoingAudits hook
 */
export interface OngoingAuditsResult {
  /** Number of ongoing audits */
  count: number | null;
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
 * Hook to fetch and monitor ongoing audits count
 *
 * @param tenantId - The tenant/organization ID
 * @returns OngoingAuditsResult with count, trend, and loading state
 *
 * @example
 * ```tsx
 * const { count, trend, loading, error } = useOngoingAudits('tenant-123');
 * ```
 */
export function useOngoingAudits(tenantId: string | undefined): OngoingAuditsResult {
  const [count, setCount] = useState<number | null>(null);
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
        // Query for audits with status 'in_progress'
        // Query for audits with status 'in_progress'
        // Must use 'audits' root collection with organizationId filter
        const ongoingAuditsQuery = query(
          collection(db, 'audits'),
          where('organizationId', '==', tenantId),
          where('status', '==', 'in_progress')
        );

        unsubscribe = onSnapshot(
          ongoingAuditsQuery,
          (snapshot) => {
            const newCount = snapshot.size;

            // Store previous count for trend calculation
            setCount((prevCount) => {
              if (prevCount !== null && prevCount !== newCount) {
                setPreviousCount(prevCount);
                setTrend(calculateTrend(newCount, prevCount));
              } else if (prevCount === null) {
                // First load - set stable trend
                setTrend('stable');
              }
              return newCount;
            });

            setError(null);
            setFetchedTenantId(tenantId);
            setIsRefetching(false);
          },
          (err) => {
            ErrorLogger.error(err, 'useOngoingAudits.onSnapshot');
            setError(err as Error);
            setFetchedTenantId(tenantId);
            setIsRefetching(false);
          }
        );
      } catch (err) {
        ErrorLogger.error(err, 'useOngoingAudits.setupListener');
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
  }, [tenantId, refreshKey]);

  return {
    count,
    previousCount,
    trend,
    loading,
    error,
    refetch,
  };
}

export default useOngoingAudits;
