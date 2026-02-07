import { useEffect, useMemo } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sanitizeData } from '../../utils/dataSanitizer';
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

 // Serialize radarData to a stable key to avoid re-triggering useEffect on every render
 const radarKey = useMemo(() => JSON.stringify(radarData), [radarData]);

 useEffect(() => {
 if (loading || !user?.organizationId) return;
 const todayStr = new Date().toISOString().split('T')[0];

 // Optimistic check to avoid unnecessary writes
 if (!historyStats.some(d => d.date === todayStr)) {
 const currentRadarData = radarData;
 const saveStats = async () => {
 try {
  const statId = `${todayStr}_${user.organizationId}`;
  await setDoc(doc(db, 'stats_history', statId), sanitizeData({
  organizationId: user.organizationId,
  date: todayStr,
  risks: allRisksCount,
  compliance: complianceScore,
  incidents: activeIncidentsCount,
  timestamp: serverTimestamp(),
  frameworks: Object.entries(currentRadarData).reduce((acc, [_, data]: [string, { subject: string; A: number }]) => ({ ...acc, [data.subject || 'Unknown']: data.A }), {})
  }), { merge: true }); // Use merge to be safe
 } catch {
  // Silent fail or log if needed, but avoiding user disruption
 }
 };
 saveStats();
 }
 // Justification: currentRadarData is intentionally excluded -- radarKey is a stable string
 // representation. Including the object directly causes infinite re-renders.
 }, [loading, historyStats, user?.organizationId, allRisksCount, complianceScore, activeIncidentsCount, radarKey]); // eslint-disable-line react-hooks/exhaustive-deps
};
