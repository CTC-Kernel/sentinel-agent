import { collection, query, where, getCountFromServer, getDoc, doc } from 'firebase/firestore';
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
        } catch (error) {
            ErrorLogger.error(error, 'DashboardService.getOrganizationDetails');
            throw error;
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
        } catch (error) {
            ErrorLogger.error(error, 'DashboardService.getDashboardCounts');
            throw error;
        }
    }
    /**
     * Fetch saved executive summary
     */
    static async getExecutiveSummary(organizationId: string): Promise<{ summary: string; generatedAt: string } | null> {
        try {
            const docSnap = await getDoc(doc(db, 'dashboard_summaries', organizationId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                return {
                    summary: data.summary,
                    generatedAt: data.generatedAt
                };
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Save executive summary
     */
    static async saveExecutiveSummary(organizationId: string, summary: string, generatedAt: string): Promise<void> {
        try {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(doc(db, 'dashboard_summaries', organizationId), {
                summary,
                generatedAt,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            ErrorLogger.error(error, 'DashboardService.saveExecutiveSummary');
        }
    }
}
