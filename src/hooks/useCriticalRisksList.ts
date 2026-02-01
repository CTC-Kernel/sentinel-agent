/**
 * useCriticalRisksList Hook
 * Fetches critical risks with full details for RSSI dashboard
 * Implements Story 2.4: RSSI Risk & Incident View
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { RISK_THRESHOLDS } from '../constants/complianceConfig';
import { db } from '../firebase';
import { ErrorLogger } from '../services/errorLogger';
import type { TrendType } from '../types/score.types';
import { calculateTrend } from '../utils/trendUtils';

/**
 * Risk item for list display
 */
export interface RiskListItem {
  id: string;
  title: string;
  category: string;
  criticality: number; // impact x probability (1-25)
  impact: number;
  probability: number;
  status: string;
  owner?: string;
}

/**
 * Result type for useCriticalRisksList hook
 */
export interface CriticalRisksListResult {
  /** List of critical risks */
  risks: RiskListItem[];
  /** Total count of critical risks */
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
 * Risk statuses that count as "active" (not mitigated)
 */
const ACTIVE_RISK_STATUSES = ['Ouvert', 'En cours', 'En attente de validation'];

/**
 * Get criticality color scheme based on criticality score
 */
export function getCriticalityColorScheme(
  criticality: number
): 'danger' | 'warning' | 'caution' | 'success' {
  if (criticality >= RISK_THRESHOLDS.CRITICAL) return 'danger';
  if (criticality >= RISK_THRESHOLDS.HIGH) return 'warning';
  if (criticality >= RISK_THRESHOLDS.MEDIUM) return 'caution';
  return 'success';
}

/**
 * Get Tailwind classes for criticality color
 */
export const CRITICALITY_COLOR_CLASSES = {
  danger: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-200',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-500 text-white',
  },
  warning: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-800 dark:text-orange-200',
    border: 'border-orange-200 dark:border-orange-800',
    badge: 'bg-orange-500 text-white',
  },
  caution: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    border: 'border-yellow-200 dark:border-yellow-800',
    badge: 'bg-yellow-500 text-black',
  },
  success: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    border: 'border-green-200 dark:border-green-800',
    badge: 'bg-green-500 text-white',
  },
} as const;

/**
 * Hook to fetch and monitor critical risks list
 *
 * @param tenantId - The tenant/organization ID
 * @param maxItems - Maximum number of items to return (default: 5)
 * @returns CriticalRisksListResult with risks list, count, trend, and loading state
 *
 * @example
 * ```tsx
 * const { risks, count, trend, loading } = useCriticalRisksList('tenant-123');
 * ```
 */
export function useCriticalRisksList(
  tenantId: string | undefined,
  maxItems: number = 5
): CriticalRisksListResult {
  const { t } = useTranslation();
  const [risks, setRisks] = useState<RiskListItem[]>([]);
  const [count, setCount] = useState<number>(0);
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


    const unsubRef = { current: null as Unsubscribe | null };
    let cancelled = false;

    const setupListener = async () => {
      try {
        // Query for critical risks sorted by criticality (score = impact * probability)
        // Query for risks for the organization
        // We fetch more items and filter/sort client side to avoid complex compound indexes
        // active risks sorted by score descending
        const criticalRisksQuery = query(
          collection(db, 'risks'),
          where('organizationId', '==', tenantId),
          where('status', 'in', ACTIVE_RISK_STATUSES),
          limit(maxItems * 4) // Fetch 4x more to ensure we get enough critical ones after filtering
        );

        const unsub = onSnapshot(
          criticalRisksQuery,
          (snapshot) => {
            const riskItems: RiskListItem[] = snapshot.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                title: data.threat || data.scenario || t('risks.untitled', { defaultValue: 'Untitled risk' }),
                category: data.category || t('risks.uncategorized', { defaultValue: 'Uncategorized' }),
                criticality: (data.impact || 1) * (data.probability || 1),
                impact: data.impact || 1,
                probability: data.probability || 1,
                status: data.status || 'Ouvert',
                owner: data.owner,
              };
            });

            // Sort by criticality descending
            riskItems.sort((a, b) => b.criticality - a.criticality);

            // Filter to only critical risks
            const criticalOnly = riskItems.filter((r) => r.criticality >= RISK_THRESHOLDS.CRITICAL);

            setRisks(criticalOnly);

            const newCount = criticalOnly.length;

            // Store previous count for trend calculation
            setCount((prevCount) => {
              if (prevCount !== newCount) {
                setPreviousCount(prevCount);
                setTrend(calculateTrend(newCount, prevCount));
              } else {
                setTrend(prevTrend => prevTrend === null ? 'stable' : prevTrend);
              }
              return newCount;
            });

            setError(null);
            setFetchedTenantId(tenantId);
            setIsRefetching(false);
          },
          (err) => {
            ErrorLogger.error(err, 'useCriticalRisksList.onSnapshot');
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
        ErrorLogger.error(err, 'useCriticalRisksList.setupListener');
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
  }, [tenantId, maxItems, refreshKey]);

  return {
    risks,
    count,
    previousCount,
    trend,
    loading,
    error,
    refetch,
  };
}

export default useCriticalRisksList;
