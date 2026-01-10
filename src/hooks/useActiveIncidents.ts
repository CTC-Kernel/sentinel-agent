/**
 * useActiveIncidents Hook
 * Fetches active incidents for RSSI dashboard
 * Implements Story 2.4: RSSI Risk & Incident View (AC: 1, 4)
 * Per FR9: "Les RSSI peuvent voir les incidents en cours"
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
import type { Criticality } from '../types/common';

/**
 * Incident item for list display
 */
export interface IncidentListItem {
  id: string;
  title: string;
  description: string;
  severity: Criticality;
  status: string;
  category?: string;
  dateReported: string;
  reporter?: string;
}

/**
 * Result type for useActiveIncidents hook
 */
export interface ActiveIncidentsResult {
  /** List of active incidents */
  incidents: IncidentListItem[];
  /** Total count of active incidents */
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
 * Incident statuses that count as "active"
 */
const ACTIVE_INCIDENT_STATUSES = ['Nouveau', 'Analyse', 'Contenu'];

/**
 * Calculate trend based on count comparison
 */
function calculateTrend(current: number, previous: number): TrendType {
  if (previous === 0 && current === 0) return 'stable';
  if (previous === 0) return current > 0 ? 'up' : 'stable';

  const percentChange = ((current - previous) / previous) * 100;

  // Use 5% threshold for significant change
  if (percentChange > 5) return 'up'; // More incidents = worse = up (red arrow)
  if (percentChange < -5) return 'down'; // Fewer incidents = better = down (green arrow)
  return 'stable';
}

/**
 * Get severity color scheme
 */
export function getSeverityColorScheme(
  severity: Criticality
): 'danger' | 'warning' | 'caution' | 'success' {
  switch (severity) {
    case 'Critique':
      return 'danger';
    case 'Élevée':
      return 'warning';
    case 'Moyenne':
      return 'caution';
    case 'Faible':
    default:
      return 'success';
  }
}

/**
 * Get Tailwind classes for severity color
 */
export const SEVERITY_COLOR_CLASSES = {
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
 * Hook to fetch and monitor active incidents
 *
 * @param tenantId - The tenant/organization ID
 * @param maxItems - Maximum number of items to return (default: 5)
 * @returns ActiveIncidentsResult with incidents list, count, trend, and loading state
 *
 * @example
 * ```tsx
 * const { incidents, count, trend, loading } = useActiveIncidents('tenant-123');
 * ```
 */
export function useActiveIncidents(
  tenantId: string | undefined,
  maxItems: number = 5
): ActiveIncidentsResult {
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
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


    let unsubscribe: Unsubscribe | null = null;

    const setupListener = async () => {
      try {
        // Query for active incidents sorted by date
        // Query for active incidents sorted by date
        // Must use 'incidents' root collection with organizationId filter
        const activeIncidentsQuery = query(
          collection(db, 'incidents'),
          where('organizationId', '==', tenantId),
          where('status', 'in', ACTIVE_INCIDENT_STATUSES),
          orderBy('dateReported', 'desc'),
          limit(maxItems)
        );

        unsubscribe = onSnapshot(
          activeIncidentsQuery,
          (snapshot) => {
            const incidentItems: IncidentListItem[] = snapshot.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                title: data.title || 'Incident sans titre',
                description: data.description || '',
                severity: data.severity || 'Moyenne',
                status: data.status || 'Nouveau',
                category: data.category,
                dateReported: data.dateReported || new Date().toISOString(),
                reporter: data.reporter,
              };
            });

            setIncidents(incidentItems);

            const newCount = snapshot.size;

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
            console.error('Error fetching active incidents:', err);
            setError(err as Error);
            setFetchedTenantId(tenantId);
            setIsRefetching(false);
          }
        );
      } catch (err) {
        console.error('Error setting up active incidents listener:', err);
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
  }, [tenantId, maxItems, refreshKey]);

  return {
    incidents,
    count,
    previousCount,
    trend,
    loading,
    error,
    refetch,
  };
}

export default useActiveIncidents;
