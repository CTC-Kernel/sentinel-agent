import { useMemo } from 'react';
import { Control, Risk, Asset, StatsHistoryEntry } from '../../types';

interface MetricInputs {
    controls: Control[];
    allRisks: Risk[];
    allAssets: Asset[];
    historyStats: StatsHistoryEntry[];
    activeIncidentsCount: number;
    openAuditsCount: number;
    myProjectsLength: number;
    userOrgId: string | undefined;
}

export const useDashboardMetrics = ({
    controls,
    allRisks,
    allAssets,
    historyStats,
    activeIncidentsCount,
    openAuditsCount,
    myProjectsLength,
    userOrgId
}: MetricInputs) => {
    // History Data Mapping
    const historyData = useMemo(() => {
        return historyStats
            .map((d, index) => {
                const anyD = d as unknown as Record<string, unknown>;
                const metrics = d.metrics || {
                    complianceRate: Number(anyD.compliance) || 0,
                    totalRisks: Number(anyD.risks) || 0,
                    criticalRisks: 0,
                    highRisks: 0,
                    openIncidents: Number(anyD.incidents) || 0,
                    totalAssets: 0,
                    activeProjects: 0
                };
                return {
                    id: d.id || `temp-${index}`,
                    organizationId: d.organizationId || userOrgId || '',
                    date: typeof anyD.date === 'string' ? anyD.date : new Date().toISOString().split('T')[0],
                    // eslint-disable-next-line react-hooks/purity
                    timestamp: typeof d.timestamp === 'number' ? d.timestamp : Date.now(),
                    metrics,
                    compliance: metrics.complianceRate
                } as (StatsHistoryEntry & { compliance: number });
            })
            .filter(d => d.date && d.date.length > 0)
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [historyStats, userOrgId]);

    // Top Risks
    const topRisks = useMemo(() => [...allRisks].sort((a, b) => b.score - a.score).slice(0, 5), [allRisks]);

    // Stats and Radar Logic
    const { stats, radarData, complianceScore } = useMemo(() => {
        const implemented = controls.filter(c => c.status === 'Implémenté').length;
        const actionable = controls.filter(c => c.status !== 'Exclu' && c.status !== 'Non applicable').length;
        const compScore = actionable > 0 ? Math.round((implemented / actionable) * 100) : 0;

        const domains = { 'Org.': { total: 0, implemented: 0, prefix: 'A.5' }, 'Humain': { total: 0, implemented: 0, prefix: 'A.6' }, 'Physique': { total: 0, implemented: 0, prefix: 'A.7' }, 'Techno': { total: 0, implemented: 0, prefix: 'A.8' } };
        controls.forEach(c => {
            if (c.status === 'Exclu' || c.status === 'Non applicable') return;
            const key = Object.keys(domains).find(k => c.code.startsWith(domains[k as keyof typeof domains].prefix));
            if (key) { domains[key as keyof typeof domains].total++; if (c.status === 'Implémenté') domains[key as keyof typeof domains].implemented++; }
        });
        const rData = Object.entries(domains).map(([subject, data]) => ({ subject, A: data.total > 0 ? Math.round((data.implemented / data.total) * 100) : 0, fullMark: 100 }));

        const calculateDepreciation = (price: number, purchaseDate: string) => {
            if (!price || !purchaseDate) return price;
            const start = new Date(purchaseDate);
            const now = new Date();
            const ageInYears = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            const value = price * (1 - (ageInYears / 5));
            return Math.max(0, Math.round(value));
        };

        const totalAssetValue = allAssets.reduce((acc, a) => acc + calculateDepreciation(a.purchasePrice || 0, a.purchaseDate || ''), 0);

        let financialExposure = 0;
        allRisks.forEach(risk => {
            if (risk.score >= 12 && risk.assetId) {
                const asset = allAssets.find(a => a.id === risk.assetId);
                if (asset) {
                    financialExposure += calculateDepreciation(asset.purchasePrice || 0, asset.purchaseDate || '');
                }
            }
        });

        const criticalRisksCount = allRisks.filter(r => r.score >= 15).length;

        return {
            stats: {
                risks: allRisks.length,
                assets: allAssets.length,
                compliance: compScore,
                highRisks: criticalRisksCount,
                auditsOpen: openAuditsCount,
                activeIncidents: activeIncidentsCount,
                assetValue: totalAssetValue,
                financialRisk: financialExposure,
                totalRisks: allRisks.length,
                criticalRisks: criticalRisksCount,
                openIncidents: activeIncidentsCount,
                complianceRate: compScore,
                totalAssets: allAssets.length,
                activeProjects: myProjectsLength
            },
            radarData: rData,
            complianceScore: compScore
        };
    }, [controls, allAssets, allRisks, openAuditsCount, activeIncidentsCount, myProjectsLength]);

    const scoreGrade = useMemo(() => {
        if (!Number.isFinite(complianceScore) || complianceScore < 0) return undefined;
        if (complianceScore >= 85) return 'A';
        if (complianceScore >= 70) return 'B';
        if (complianceScore >= 50) return 'C';
        return 'D';
    }, [complianceScore]);

    return { historyData, topRisks, stats, radarData, complianceScore, scoreGrade };
};
