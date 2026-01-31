import { collection, query, where, getCountFromServer, getDoc, doc, setDoc, Query, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';
import { RISK_THRESHOLDS, CONTROL_STATUS } from '../constants/complianceConfig';

export interface DashboardCounts {
    activeIncidentsCount: number;
    openAuditsCount: number;
    /** True if any count failed to load (partial data) */
    hasPartialData?: boolean;
}

export interface OrganizationDetails {
    name: string;
    logoUrl?: string;
}

export class DashboardService {
    /**
     * Fetch organization details
     */
    static async getOrganizationDetails(organizationId: string): Promise<OrganizationDetails | null> {
        try {
            const orgSnap = await getDoc(doc(db, 'organizations', organizationId));
            if (orgSnap.exists()) {
                const data = orgSnap.data();
                return {
                    name: data.name || '',
                    logoUrl: data.logoUrl
                };
            }
            return null;
        } catch (_error) {
            ErrorLogger.error(_error, 'DashboardService.getOrganizationDetails');
            throw _error;
        }
    }

    /**
     * Fetch dashboard counts (active incidents and open audits)
     * Uses parallel execution for better performance
     * Returns hasPartialData: true if any query failed
     */
    static async getDashboardCounts(organizationId: string): Promise<DashboardCounts> {
        let hasPartialData = false;

        try {
            const incQuery = query(
                collection(db, 'incidents'),
                where('organizationId', '==', organizationId),
                where('status', '!=', 'Fermé')
            );

            const auditQuery = query(
                collection(db, 'audits'),
                where('organizationId', '==', organizationId),
                where('status', 'in', ['Planifié', 'En cours'])
            );

            const [incCount, auditCount] = await Promise.all([
                getCountFromServer(incQuery).catch(error => {
                    hasPartialData = true;
                    ErrorLogger.warn('Failed to count incidents', 'DashboardService.getDashboardCounts', { metadata: { error } });
                    return { data: () => ({ count: 0 }) };
                }),
                getCountFromServer(auditQuery).catch(error => {
                    hasPartialData = true;
                    ErrorLogger.warn('Failed to count audits', 'DashboardService.getDashboardCounts', { metadata: { error } });
                    return { data: () => ({ count: 0 }) };
                })
            ]);

            return {
                activeIncidentsCount: incCount.data().count,
                openAuditsCount: auditCount.data().count,
                hasPartialData
            };
        } catch (_error) {
            ErrorLogger.error(_error, 'DashboardService.getDashboardCounts');
            return { activeIncidentsCount: 0, openAuditsCount: 0, hasPartialData: true };
        }
    }
    /**
     * Fetch aggregated stats (Risk counts by level, total assets)
     * Optimized to use server-side counting to save reads
     * Returns hasPartialData: true if any query failed
     */
    static async getAggregatedStats(organizationId: string): Promise<{
        totalRisks: number;
        criticalRisks: number;
        highRisks: number;
        mediumRisks: number;
        lowRisks: number;
        totalAssets: number;
        controlsStats: { implemented: number; actionable: number; total: number };
        hasPartialData?: boolean;
        failedQueries?: string[];
    }> {
        const failedQueries: string[] = [];

        // Helper to safely get count or return 0 on error
        const safeCount = async (q: Query<DocumentData>, label: string) => {
            try {
                const snap = await getCountFromServer(q);
                return snap.data().count;
            } catch (error: unknown) {
                const err = error as { message?: string } | null;
                // Log the full error to see the "create index" link if missing
                ErrorLogger.warn(`Failed to fetch ${label} count: ${err?.message || 'Unknown error'}`, `DashboardService.getAggregatedStats`, { metadata: { error } });
                // Track the failure
                failedQueries.push(label);
                // Don't throw, just return 0 to keep dashboard alive
                return 0;
            }
        };

        try {
            // queries using centralized RISK_THRESHOLDS
            const qTotalRisks = query(collection(db, 'risks'), where('organizationId', '==', organizationId));
            const qCriticalRisks = query(collection(db, 'risks'), where('organizationId', '==', organizationId), where('score', '>=', RISK_THRESHOLDS.CRITICAL));
            const qHighRisks = query(collection(db, 'risks'), where('organizationId', '==', organizationId), where('score', '>=', RISK_THRESHOLDS.HIGH), where('score', '<', RISK_THRESHOLDS.CRITICAL));
            // Firestore composite index might be needed for range queries with other filters
            // We split medium risks query if it fails often, but let's try safe execution first
            const qMediumRisks = query(collection(db, 'risks'), where('organizationId', '==', organizationId), where('score', '>=', RISK_THRESHOLDS.MEDIUM), where('score', '<', RISK_THRESHOLDS.HIGH));
            const qLowRisks = query(collection(db, 'risks'), where('organizationId', '==', organizationId), where('score', '<', RISK_THRESHOLDS.MEDIUM));
            const qAssets = query(collection(db, 'assets'), where('organizationId', '==', organizationId));
            const qControlsImpl = query(collection(db, 'controls'), where('organizationId', '==', organizationId), where('status', '==', CONTROL_STATUS.IMPLEMENTED));
            const qControlsNA = query(collection(db, 'controls'), where('organizationId', '==', organizationId), where('status', '==', CONTROL_STATUS.NOT_APPLICABLE));
            const qControlsExcl = query(collection(db, 'controls'), where('organizationId', '==', organizationId), where('status', '==', CONTROL_STATUS.EXCLUDED));
            const qControlsTotal = query(collection(db, 'controls'), where('organizationId', '==', organizationId));

            const [
                totalRisks,
                criticalRisks,
                highRisks,
                mediumRisks,
                lowRisks,
                totalAssets,
                implemented,
                naControls,
                excludedControls,
                totalControls
            ] = await Promise.all([
                safeCount(qTotalRisks, 'totalRisks'),
                safeCount(qCriticalRisks, 'criticalRisks'),
                safeCount(qHighRisks, 'highRisks'),
                safeCount(qMediumRisks, 'mediumRisks'),
                safeCount(qLowRisks, 'lowRisks'),
                safeCount(qAssets, 'totalAssets'),
                safeCount(qControlsImpl, 'controlsImpl'),
                safeCount(qControlsNA, 'controlsNA'),
                safeCount(qControlsExcl, 'controlsExcl'),
                safeCount(qControlsTotal, 'controlsTotal')
            ]);

            return {
                totalRisks,
                criticalRisks,
                highRisks,
                mediumRisks,
                lowRisks,
                totalAssets,
                controlsStats: {
                    implemented,
                    actionable: totalControls - naControls - excludedControls,
                    total: totalControls
                },
                hasPartialData: failedQueries.length > 0,
                failedQueries: failedQueries.length > 0 ? failedQueries : undefined
            };

        } catch (_error) {
            ErrorLogger.error(_error, 'DashboardService.getAggregatedStats');
            return {
                totalRisks: 0,
                criticalRisks: 0,
                highRisks: 0,
                mediumRisks: 0,
                lowRisks: 0,
                totalAssets: 0,
                controlsStats: { implemented: 0, actionable: 0, total: 0 },
                hasPartialData: true,
                failedQueries: ['all']
            };
        }
    }

    /**
     * Fetch saved executive summary
     */
    static async getExecutiveSummary(organizationId: string): Promise<{ summary: string; generatedAt: string; metricsSnapshot?: { compliance: number } } | null> {
        try {
            const docSnap = await getDoc(doc(db, 'dashboard_summaries', organizationId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    summary: data.summary,
                    generatedAt: data.generatedAt,
                    metricsSnapshot: data.metricsSnapshot
                };
            }
            return null;
        } catch (error) {
            // Log the error instead of silently swallowing it
            ErrorLogger.warn('Failed to fetch executive summary', 'DashboardService.getExecutiveSummary', { metadata: { error } });
            return null;
        }
    }

    /**
     * Save executive summary
     * Returns true on success, false on failure
     */
    static async saveExecutiveSummary(organizationId: string, summary: string, generatedAt: string, metricsSnapshot?: { compliance: number }): Promise<boolean> {
        try {
            await setDoc(doc(db, 'dashboard_summaries', organizationId), {
                summary,
                generatedAt,
                metricsSnapshot,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            return true;
        } catch (_error) {
            ErrorLogger.error(_error, 'DashboardService.saveExecutiveSummary');
            return false;
        }
    }
}
