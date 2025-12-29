import { useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { StatsHistoryEntry } from '../../types';

interface DashboardStatsHistoryProps {
    loading: boolean;
    historyStats: StatsHistoryEntry[];
    allRisksCount: number;
    complianceScore: number;
    activeIncidentsCount: number;
    radarData: { subject: string; A: number; fullMark: number }[];
}

export const useDashboardStatsHistory = ({
    loading,
    historyStats,
    allRisksCount,
    complianceScore,
    activeIncidentsCount,
    radarData
}: DashboardStatsHistoryProps) => {
    const { user } = useStore();

    useEffect(() => {
        if (loading || !user?.organizationId) return;
        const todayStr = new Date().toISOString().split('T')[0];

        // Optimistic check to avoid unnecessary writes
        if (!historyStats.some(d => d.date === todayStr)) {
            const saveStats = async () => {
                try {
                    const statId = `${todayStr}_${user.organizationId}`;
                    await setDoc(doc(db, 'stats_history', statId), {
                        organizationId: user.organizationId,
                        date: todayStr,
                        risks: allRisksCount,
                        compliance: complianceScore,
                        incidents: activeIncidentsCount,
                        timestamp: serverTimestamp(),
                        frameworks: Object.entries(radarData).reduce((acc, [_, data]: [string, { subject: string; A: number }]) => ({ ...acc, [data.subject || 'Unknown']: data.A }), {})
                    }, { merge: true }); // Use merge to be safe
                } catch (e) {
                    // Silent fail or log if needed, but avoiding user disruption
                    console.error("Failed to save daily stats", e);
                }
            };
            saveStats();
        }
    }, [loading, historyStats, user?.organizationId, allRisksCount, complianceScore, activeIncidentsCount, radarData]);
};
