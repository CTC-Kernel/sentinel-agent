/**
 * useComplianceScore Hook
 * React hook for accessing compliance score with real-time updates
 * Implements ADR-003: Score de Conformité Global (Apple Health Style)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ScoreService } from '../services/scoreService';
import type {
  ComplianceScore,
  ScoreHistory,
  ScoreBreakdown,
  TrendType,
  ComplianceScoreHookResult,
} from '../types/score.types';

interface UseComplianceScoreOptions {
  /** Number of days of history to fetch (default: 30) */
  historyDays?: number;
  /** Whether to enable real-time updates (default: true) */
  realtime?: boolean;
}

/**
 * Hook to access compliance score data with real-time updates
 *
 * @param organizationId - The organization ID to fetch score for
 * @param options - Configuration options
 * @returns ComplianceScoreHookResult with score, breakdown, trend, history, loading, and error
 *
 * @example
 * ```tsx
 * const { score, breakdown, trend, loading, error } = useComplianceScore(orgId);
 *
 * if (loading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return <ScoreGauge value={score?.global} trend={trend} />;
 * ```
 */
export function useComplianceScore(
  organizationId: string | undefined,
  options: UseComplianceScoreOptions = {}
): ComplianceScoreHookResult {
  const { historyDays = 30, realtime = true } = options;

  const [score, setScore] = useState<ComplianceScore | null>(null);
  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchCounter, setRefetchCounter] = useState<number>(0);

  // Refetch function to manually trigger data reload
  const refetch = useCallback(() => {
    setRefetchCounter((prev) => prev + 1);
  }, []);



  // Subscribe to real-time score updates
  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      setScore(null);
      setHistory([]);
      setError(null);
      return;
    }

    // Reset state when organizationId changes
    setLoading(true);
    setError(null);

    // Track if component is still mounted to prevent memory leaks
    let isMounted = true;

    // Fetch initial history
    const fetchHistory = async () => {
      try {
        const historyData = await ScoreService.getScoreHistory(organizationId, historyDays);
        if (isMounted) {
          setHistory(historyData);
        }
      } catch (err) {
        console.error('Error fetching score history:', err);
      }
    };
    fetchHistory();

    if (realtime) {
      // Subscribe to real-time updates
      const unsubscribe = ScoreService.subscribeToScore(
        organizationId,
        (newScore, subscriptionError) => {
          setLoading(false);

          if (subscriptionError) {
            setError(subscriptionError);
            return;
          }

          setScore(newScore);
        }
      );

      return () => {
        isMounted = false;
        unsubscribe();
      };
    } else {
      // One-time fetch
      ScoreService.getComplianceScore(organizationId)
        .then((fetchedScore) => {
          if (isMounted) {
            setScore(fetchedScore);
            setLoading(false);
          }
        })
        .catch((fetchError) => {
          if (isMounted) {
            setError(fetchError);
            setLoading(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [organizationId, realtime, historyDays, refetchCounter]);

  // Memoized breakdown
  const breakdown = useMemo<ScoreBreakdown | null>(() => {
    return score?.breakdown || null;
  }, [score]);

  // Memoized trend
  const trend = useMemo<TrendType | null>(() => {
    return score?.trend || null;
  }, [score]);

  // Return memoized result to prevent unnecessary re-renders
  return useMemo<ComplianceScoreHookResult>(
    () => ({
      score,
      breakdown,
      trend,
      history,
      loading,
      error,
      refetch,
    }),
    [score, breakdown, trend, history, loading, error, refetch]
  );
}

/**
 * Hook to manually trigger a score recalculation
 * Calls the Cloud Function to recalculate the score
 */
export function useRecalculateScore() {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateError, setRecalculateError] = useState<Error | null>(null);

  const recalculate = useCallback(async (organizationId: string) => {
    if (!organizationId) return null;

    setIsRecalculating(true);
    setRecalculateError(null);

    try {
      // Import Firebase functions dynamically to avoid circular dependencies
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const calculateScore = httpsCallable(functions, 'calculateComplianceScore');

      const result = await calculateScore({ organizationId });
      setIsRecalculating(false);
      return result.data;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to recalculate score');
      setRecalculateError(error);
      setIsRecalculating(false);
      throw error;
    }
  }, []);

  return {
    recalculate,
    isRecalculating,
    recalculateError,
  };
}

export default useComplianceScore;
