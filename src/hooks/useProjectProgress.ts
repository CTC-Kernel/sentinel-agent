/**
 * useProjectProgress Hook
 * Fetches project completion progress metrics for PM dashboard
 * Implements Story 2.5: Project Manager Progress View (AC: 1, 3, 5)
 * Per FR10: "Les project managers peuvent voir l'avancement du projet de conformite"
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
 collection,
 query,
 where,
 getDocs,
 onSnapshot,
 limit,
 type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from '../services/errorLogger';
import type { TrendType } from '../types/score.types';
import { calculateTrend } from '../utils/trendUtils';

/**
 * Progress metrics for a category
 */
export interface CategoryProgress {
 completed: number;
 total: number;
 percentage: number;
}

/**
 * Overall project progress metrics
 */
export interface ProgressMetrics {
 /** Overall completion percentage (0-100) */
 overall: number;
 /** Controls progress */
 controls: CategoryProgress;
 /** Documents progress */
 documents: CategoryProgress;
 /** Actions progress */
 actions: CategoryProgress;
 /** Milestones progress */
 milestones: CategoryProgress;
}

/**
 * Result type for useProjectProgress hook
 */
export interface ProjectProgressResult {
 /** Progress metrics */
 progress: ProgressMetrics;
 /** Previous overall percentage for trend */
 previousOverall: number | null;
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
 * Default empty progress
 */
const DEFAULT_PROGRESS: ProgressMetrics = {
 overall: 0,
 controls: { completed: 0, total: 0, percentage: 0 },
 documents: { completed: 0, total: 0, percentage: 0 },
 actions: { completed: 0, total: 0, percentage: 0 },
 milestones: { completed: 0, total: 0, percentage: 0 },
};

/**
 * Status values that count as "completed"
 */
const COMPLETED_STATUSES = ['done', 'completed', 'Terminé', 'Validé', 'Approuvé'];

/**
 * Calculate percentage safely
 */
function calculatePercentage(completed: number, total: number): number {
 if (total === 0) return 0;
 return Math.round((completed / total) * 100);
}

// Re-export color scheme utilities (moved to utils/colorSchemes.ts to satisfy hooks naming convention)
export { getProgressColorScheme, PROGRESS_COLOR_CLASSES } from '../utils/colorSchemes';

/**
 * Hook to fetch and monitor project progress metrics
 *
 * @param tenantId - The tenant/organization ID
 * @returns ProjectProgressResult with progress metrics, trend, and loading state
 *
 * @example
 * ```tsx
 * const { progress, trend, loading } = useProjectProgress('tenant-123');
 * // progress.overall = 65
 * // progress.controls = { completed: 30, total: 50, percentage: 60 }
 * ```
 */
export function useProjectProgress(
 tenantId: string | undefined
): ProjectProgressResult {
 const [progress, setProgress] = useState<ProgressMetrics>(DEFAULT_PROGRESS);
 const [previousOverall, setPreviousOverall] = useState<number | null>(null);
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

 const refetchRef = useRef(refetch);
 useEffect(() => {
 refetchRef.current = refetch;
 }, [refetch]);

 useEffect(() => {
 if (!tenantId) {
 return;
 }




 const unsubscribes: Unsubscribe[] = [];

 const fetchProgress = async () => {
 try {
 // Fetch all collections in parallel for initial data
 // Fetch all collections in parallel for initial data
 // ALL queries must use root collections with organizationId filter
 const [controlsSnap, documentsSnap, actionsSnap, milestonesSnap] = await Promise.all([
 getDocs(query(collection(db, 'controls'), where('organizationId', '==', tenantId), limit(1000))),
 getDocs(query(collection(db, 'documents'), where('organizationId', '==', tenantId), limit(1000))),
 getDocs(query(collection(db, 'actions'), where('organizationId', '==', tenantId), limit(1000))),
 getDocs(query(collection(db, 'project_milestones'), where('organizationId', '==', tenantId), limit(500))),
 ]);

 // Calculate controls progress
 const totalControls = controlsSnap.size;
 const completedControls = controlsSnap.docs.filter((doc) => {
 const status = doc.data().status;
 return COMPLETED_STATUSES.includes(status) || doc.data().isCompliant === true;
 }).length;

 // Calculate documents progress
 const totalDocuments = documentsSnap.size;
 const completedDocuments = documentsSnap.docs.filter((doc) => {
 const status = doc.data().status;
 return COMPLETED_STATUSES.includes(status) || status === 'published' || status === 'Publié';
 }).length;

 // Calculate actions progress
 const totalActions = actionsSnap.size;
 const completedActions = actionsSnap.docs.filter((doc) => {
 const status = doc.data().status;
 return COMPLETED_STATUSES.includes(status);
 }).length;

 // Calculate milestones progress
 const totalMilestones = milestonesSnap.size;
 const completedMilestones = milestonesSnap.docs.filter((doc) => {
 const status = doc.data().status;
 return COMPLETED_STATUSES.includes(status) || doc.data().isCompleted === true;
 }).length;

 // Calculate percentages
 const controlsPercentage = calculatePercentage(completedControls, totalControls);
 const documentsPercentage = calculatePercentage(completedDocuments, totalDocuments);
 const actionsPercentage = calculatePercentage(completedActions, totalActions);
 const milestonesPercentage = calculatePercentage(completedMilestones, totalMilestones);

 // Calculate overall (weighted average)
 // Weights: controls 40%, documents 20%, actions 25%, milestones 15%
 const weights = {
 controls: 0.4,
 documents: 0.2,
 actions: 0.25,
 milestones: 0.15,
 };

 const overall = Math.round(
 controlsPercentage * weights.controls +
 documentsPercentage * weights.documents +
 actionsPercentage * weights.actions +
 milestonesPercentage * weights.milestones
 );

 const newProgress: ProgressMetrics = {
 overall,
 controls: {
 completed: completedControls,
 total: totalControls,
 percentage: controlsPercentage,
 },
 documents: {
 completed: completedDocuments,
 total: totalDocuments,
 percentage: documentsPercentage,
 },
 actions: {
 completed: completedActions,
 total: totalActions,
 percentage: actionsPercentage,
 },
 milestones: {
 completed: completedMilestones,
 total: totalMilestones,
 percentage: milestonesPercentage,
 },
 };

 // Update state with trend calculation
 setProgress((prevProgress) => {
 if (prevProgress.overall !== newProgress.overall) {
 setPreviousOverall(prevProgress.overall);
 setTrend(calculateTrend(newProgress.overall, prevProgress.overall));
 } else {
 // If stable, ensure trend is initialized
 setTrend((curr) => curr || 'stable');
 }
 return newProgress;
 });

 setError(null);
 setFetchedTenantId(tenantId);
 setIsRefetching(false);

 // Set up real-time listener for actions (most frequently changing)
 const actionsQuery = query(
 collection(db, 'actions'),
 where('organizationId', '==', tenantId)
 );

 const unsubscribe = onSnapshot(actionsQuery, () => {
 // Refetch all progress when actions change
 refetchRef.current();
 });

 unsubscribes.push(unsubscribe);
 } catch (err) {
 ErrorLogger.error(err, 'useProjectProgress.fetchProgress');
 setError(err as Error);
 setFetchedTenantId(tenantId);
 setIsRefetching(false);
 }
 };

 fetchProgress();

 return () => {
 unsubscribes.forEach((unsub) => unsub());
 };
 }, [tenantId, refreshKey]);

 return {
 progress: tenantId ? progress : DEFAULT_PROGRESS,
 previousOverall,
 trend,
 loading: tenantId ? loading : false,
 error,
 refetch,
 };
}

export default useProjectProgress;
