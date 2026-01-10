import { collection, query, where, getCountFromServer, getDoc, doc, setDoc, Query, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { ErrorLogger } from './errorLogger';

export interface DashboardCounts {
    activeIncidentsCount: number;
    openAuditsCount: number;
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
     */
    static async getDashboardCounts(organizationId: string): Promise<DashboardCounts> {
        try {
            const [incCount, auditCount] = await Promise.all([
                getCountFromServer(
                    query(
                        collection(db, 'incidents'),
                        where('organizationId', '==', organizationId),
                        where('status', '!=', 'Fermé')
                    )
                ),
                getCountFromServer(
                    query(
                        collection(db, 'audits'),
                        where('organizationId', '==', organizationId),
                        where('status', 'in', ['Planifié', 'En cours'])
                    )
                )
            ]);

            return {
                activeIncidentsCount: incCount.data().count,
                openAuditsCount: auditCount.data().count
            };
        } catch (_error) {
            ErrorLogger.error(_error, 'DashboardService.getDashboardCounts');
            throw _error;
        }
    }
    /**
     * Fetch aggregated stats (Risk counts by level, total assets)
     * Optimized to use server-side counting to save reads
     */
    static async getAggregatedStats(organizationId: string): Promise<{
        totalRisks: number;
        highRisks: number;
        mediumRisks: number;
        lowRisks: number;
        totalAssets: number;
        controlsStats: { implemented: number; actionable: number; total: number };
    }> {
        // Helper to safely get count or return 0 on error
        const safeCount = async (q: Query<DocumentData>, label: string) => {
            try {
                const snap = await getCountFromServer(q);
                return snap.data().count;
            } catch (error) {
                console.warn(`[DashboardService] Failed to fetch ${label} count:`, error);
                // Don't throw, just return 0 to keep dashboard alive
                return 0;
            }
        };

        try {
            // queries
            const qTotalRisks = query(collection(db, 'risks'), where('organizationId', '==', organizationId));
            const qHighRisks = query(collection(db, 'risks'), where('organizationId', '==', organizationId), where('score', '>=', 10));
            // Firestore composite index might be needed for range queries with other filters
            // We split medium risks query if it fails often, but let's try safe execution first
            const qMediumRisks = query(collection(db, 'risks'), where('organizationId', '==', organizationId), where('score', '>=', 5), where('score', '<', 10));
            const qLowRisks = query(collection(db, 'risks'), where('organizationId', '==', organizationId), where('score', '<', 5));
            const qAssets = query(collection(db, 'assets'), where('organizationId', '==', organizationId));
            const qControlsImpl = query(collection(db, 'controls'), where('organizationId', '==', organizationId), where('status', '==', 'Implémenté'));
            const qControlsTotal = query(collection(db, 'controls'), where('organizationId', '==', organizationId));

            const [
                totalRisks,
                highRisks,
                mediumRisks,
                lowRisks,
                totalAssets,
                implemented,
                totalControls
            ] = await Promise.all([
                safeCount(qTotalRisks, 'totalRisks'),
                safeCount(qHighRisks, 'highRisks'),
                safeCount(qMediumRisks, 'mediumRisks'),
                safeCount(qLowRisks, 'lowRisks'),
                safeCount(qAssets, 'totalAssets'),
                safeCount(qControlsImpl, 'controlsImpl'),
                safeCount(qControlsTotal, 'controlsTotal')
            ]);

            return {
                totalRisks,
                highRisks,
                mediumRisks,
                lowRisks,
                totalAssets,
                controlsStats: {
                    implemented,
                    actionable: totalControls, // Approx
                    total: totalControls
                }
            };

        } catch (_error) {
            ErrorLogger.error(_error, 'DashboardService.getAggregatedStats');
            return {
                totalRisks: 0,
                highRisks: 0,
                mediumRisks: 0,
                lowRisks: 0,
                totalAssets: 0,
                controlsStats: { implemented: 0, actionable: 0, total: 0 }
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
        } catch {
            return null;
        }
    }

    /**
     * Save executive summary
     */
    static async saveExecutiveSummary(organizationId: string, summary: string, generatedAt: string, metricsSnapshot?: { compliance: number }): Promise<void> {
        try {
            await setDoc(doc(db, 'dashboard_summaries', organizationId), {
                summary,
                generatedAt,
                metricsSnapshot,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (_error) {
            ErrorLogger.error(_error, 'DashboardService.saveExecutiveSummary');
        }
    }
}
