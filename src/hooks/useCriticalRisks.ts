/**
 * useCriticalRisks Hook
 * Fetches critical risks count for KPI display
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
import type { TrendType } from '../types/score.types';

/**
 * Result type for useCriticalRisks hook
 */
export interface CriticalRisksResult {
  /** Number of critical risks */
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
 * Risk statuses that count as "active" (not mitigated)
 * Aligned with useCriticalRisksList for consistency
 */
const ACTIVE_RISK_STATUSES = ['Ouvert', 'En cours', 'En attente de validation'];

/**
 * Calculate trend based on count comparison
 */
function calculateTrend(current: number, previous: number): TrendType {
  if (previous === 0 && current === 0) return 'stable';
  if (previous === 0) return current > 0 ? 'up' : 'stable';

  const percentChange = ((current - previous) / previous) * 100;

  // Use 5% threshold for significant change
  if (percentChange > 5) return 'up';    // More risks = worse = up (red arrow)
  if (percentChange < -5) return 'down'; // Fewer risks = better = down (green arrow)
  return 'stable';
}

/**
 * Hook to fetch and monitor critical risks count
 *
 * @param tenantId - The tenant/organization ID
 * @returns CriticalRisksResult with count, trend, and loading state
 *
 * @example
 * ```tsx
 * const { count, trend, loading, error } = useCriticalRisks('tenant-123');
 * ```
 */
export function useCriticalRisks(tenantId: string | undefined): CriticalRisksResult {
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
        // Query for all active risks for the organization
        // We filter for critical ones client-side to ensure consistency with RiskStats
        const activeRisksQuery = query(
          collection(db, 'risks'),
          where('organizationId', '==', tenantId),
          where('status', 'in', ACTIVE_RISK_STATUSES)
        );

        unsubscribe = onSnapshot(
          activeRisksQuery,
          (snapshot) => {
            let criticalCount = 0;

            snapshot.docs.forEach((doc) => {
              const data = doc.data();
              // Calculate criticality score: impact * probability
              // Handle potential missing fields with defaults
              const score = (data.impact || 1) * (data.probability || 1);

              // Critical threshold is >= 20 (or 15 for 'High' depending on definition)
              if (score >= 15) {
                criticalCount++;
              }
            });

            const newCount = criticalCount;

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
            console.error('Error fetching critical risks:', err);
            setError(err as Error);
            setFetchedTenantId(tenantId);
            setIsRefetching(false);
          }
        );
      } catch (err) {
        console.error('Error setting up critical risks listener:', err);
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

export default useCriticalRisks;
