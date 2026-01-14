import { collection, doc, getDoc, setDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Risk, Incident, Control, Asset, Project } from '../types';
import { ErrorLogger } from './errorLogger';

export interface DailyStats {
    date: string; // YYYY-MM-DD
    timestamp: number;
    metrics: {
        totalRisks: number;
        criticalRisks: number;
        highRisks: number;
        openIncidents: number;
        complianceRate: number;
        totalAssets: number;
        activeProjects: number;
    };
}

export class StatsService {
    private static readonly COLLECTION = 'stats_history';

    /**
     * Creates a snapshot of the current statistics for today.
     * Should be called once per day (e.g., on app load).
     */
    static async snapshotDailyStats(organizationId: string): Promise<void> {
        const today = new Date().toISOString().split('T')[0];
        const docId = `${organizationId}_${today}`;
        const docRef = doc(db, this.COLLECTION, docId);

        try {
            // Check if snapshot already exists for today
            const existingdoc = await getDoc(docRef);
            if (existingdoc.exists()) {
                return; // Already snapped today
            }

            // Fetch current data counts
            const [risksSnap, incidentsSnap, controlsSnap, assetsSnap, projectsSnap] = await Promise.all([
                getDocs(query(collection(db, 'risks'), where('organizationId', '==', organizationId))),
                getDocs(query(collection(db, 'incidents'), where('organizationId', '==', organizationId))),
                getDocs(query(collection(db, 'controls'), where('organizationId', '==', organizationId))),
                getDocs(query(collection(db, 'assets'), where('organizationId', '==', organizationId))),
                getDocs(query(collection(db, 'projects'), where('organizationId', '==', organizationId)))
            ]);

            const risks = risksSnap.docs.map(d => d.data() as Risk);
            const incidents = incidentsSnap.docs.map(d => d.data() as Incident);
            const controls = controlsSnap.docs.map(d => d.data() as Control);
            const assets = assetsSnap.docs.map(d => d.data() as Asset);
            const projects = projectsSnap.docs.map(d => d.data() as Project);

            // Calculate metrics
            const criticalRisks = risks.filter(r => (r.score || 0) >= 15).length;
            const highRisks = risks.filter(r => (r.score || 0) >= 10 && (r.score || 0) < 15).length;
            const openIncidents = incidents.filter(i => i.status !== 'Fermé').length;
            const activeProjects = projects.filter(p => p.status === 'En cours').length;

            const implementedControls = controls.filter(c => c.status === 'Implémenté').length;
            const actionableControls = controls.filter(c => c.status !== 'Exclu' && c.status !== 'Non applicable').length;
            const complianceRate = actionableControls > 0 ? Math.round((implementedControls / actionableControls) * 100) : 0;

            const stats: DailyStats = {
                date: today,
                timestamp: Date.now(),
                metrics: {
                    totalRisks: risks.length,
                    criticalRisks,
                    highRisks,
                    openIncidents,
                    complianceRate,
                    totalAssets: assets.length,
                    activeProjects
                }
            };

            await setDoc(docRef, { ...stats, organizationId });
            ErrorLogger.info('Daily stats snapshot created', 'StatsService.snapshotDailyStats', { metadata: { date: today } });

        } catch (error) {
            ErrorLogger.error(error, 'StatsService.snapshotDailyStats');
        }
    }

    /**
     * Retrieves historical stats for the last N days.
     *
     * @param organizationId
     * @param days
     * @returns
     */
    static async getHistory(organizationId: string, days: number = 30): Promise<DailyStats[]> {
        try {
            const q = query(
                collection(db, this.COLLECTION),
                where('organizationId', '==', organizationId),
                orderBy('date', 'desc'),
                limit(days)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs
                .map(d => d.data() as DailyStats)
                .reverse(); // Return chronological order (oldest to newest)
        } catch (error) {
            ErrorLogger.error(error, 'StatsService.getHistory');
            return [];
        }
    }
}
