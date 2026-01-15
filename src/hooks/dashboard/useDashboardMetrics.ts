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
    aggregatedStats?: {
        totalRisks: number;
        criticalRisks: number;
        highRisks: number;
        totalAssets: number;
    } | null;
    externalComplianceScore?: number | null;
}

export const useDashboardMetrics = ({
    controls,
    allRisks,
    allAssets,
    historyStats,
    activeIncidentsCount,
    openAuditsCount,
    myProjectsLength,
    userOrgId,
    aggregatedStats,
    externalComplianceScore
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
    const topRisks = useMemo(() => [...allRisks].filter(r => r.score >= 10).sort((a, b) => b.score - a.score).slice(0, 5), [allRisks]);

    // Stats and Radar Logic
    const { stats, radarData, complianceScore, globalScore } = useMemo(() => {
        const implemented = controls.filter(c => c.status === 'Implémenté').length;
        const partial = controls.filter(c => c.status === 'Partiel').length;
        const actionable = controls.filter(c => c.status !== 'Exclu' && c.status !== 'Non applicable').length;

        // "Conformité" KPI -> Matches Compliance Module (Controls Only)
        // Formula: (Implemented + (Partial * 0.5)) / Actionable * 100
        const controlComplianceScore = actionable > 0
            ? Math.round(((implemented + (partial * 0.5)) / actionable) * 100)
            : 0;

        // "Global Security Score" -> Composite (from ScoreService/AI)
        // If available, use it for "Score Global". If not, fallback to Control Score for now.
        // BUT for "stats.compliance", we MUST use controlComplianceScore to match the widget label "Conformité".
        const globalScore = (externalComplianceScore !== undefined && externalComplianceScore !== null)
            ? externalComplianceScore
            : controlComplianceScore;

        // Note: complianceScore exported below was used for the Gauge. 
        // We should decide if the Gauge shows Global or Control.
        // Label is "Conformité" -> Control Score.
        const compScore = controlComplianceScore;

        const domains = { 'Org.': { total: 0, implemented: 0, prefix: 'A.5' }, 'Humain': { total: 0, implemented: 0, prefix: 'A.6' }, 'Physique': { total: 0, implemented: 0, prefix: 'A.7' }, 'Techno': { total: 0, implemented: 0, prefix: 'A.8' } };
        controls.forEach(c => {
            if (c.status === 'Exclu' || c.status === 'Non applicable') return;
            const key = Object.keys(domains).find(k => c.code.startsWith(domains[k as keyof typeof domains].prefix));
            if (key) { domains[key as keyof typeof domains].total++; if (c.status === 'Implémenté') domains[key as keyof typeof domains].implemented++; }
        });
        const rData = Object.entries(domains).map(([subject, data]) => ({ subject, A: data.total > 0 ? Math.round((data.implemented / data.total) * 100) : 0, fullMark: 100 }));

        // Asset Value Logic with Aggregation Fallback
        const calculateDepreciation = (price: number, purchaseDate: string) => {
            if (!price || !purchaseDate) return price;
            const start = new Date(purchaseDate);
            const now = new Date();
            const ageInYears = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            const value = price * (1 - (ageInYears / 5));
            return Math.max(0, Math.round(value));
        };

        // Use aggregated totalAssets if available (count), but value is harder.
        // If we have arrays (small tenant), use array. If aggregatedStats says 1000 assets but we have 20, use 20 for value?
        // Actually, if we are in optimization mode, 'allAssets' is limited to 20.
        // So 'totalAssetValue' based on 'allAssets' will be WRONG (too low).
        // Solution: If using aggregatedStats, we need an estimate.
        // Simple Estimate: (Sum of visible assets / visible assets count) * aggregated Total Count.

        let totalAssetValue = 0;
        const visibleAssetsCount = allAssets.length;
        const trueTotalAssets = aggregatedStats?.totalAssets ?? visibleAssetsCount;

        if (visibleAssetsCount > 0) {
            const visibleValue = allAssets.reduce((acc, a) => acc + calculateDepreciation(a.purchasePrice || 0, a.purchaseDate || ''), 0);
            const avgValue = visibleValue / visibleAssetsCount;
            totalAssetValue = Math.round(avgValue * trueTotalAssets);
        }

        // Financial Exposure Logic
        let financialExposure = 0;

        // Similarly for risks, we only have Top 20 risks.
        // We can sum exposure for known top risks, but we miss exposure for hidden risks.
        // This is acceptable for a Dashboard "Safety" metric if we focus on known high risks.
        // Or we project: (Visible High Risk Exposure) + (Estimated hidden).
        // For now, let's just sum the VISIBLE high risks as they are the most important. 
        // Note: topRisksData in useDashboardData fetches score >= 8.

        allRisks.forEach(risk => {
            if (risk.score >= 10) {
                if (risk.assetId) {
                    const asset = allAssets.find(a => a.id === risk.assetId);
                    if (asset) {
                        financialExposure += calculateDepreciation(asset.purchasePrice || 0, asset.purchaseDate || '');
                    }
                } else {
                    const avgAssetValue = totalAssetValue > 0 && trueTotalAssets > 0 ? totalAssetValue / trueTotalAssets : 10000;
                    const exposurePercentage = Math.min(1, (risk.score - 9) / 10);
                    financialExposure += Math.round(avgAssetValue * exposurePercentage);
                }
            }
        });

        // Use aggregated counts if available
        const totalRisksCount = aggregatedStats?.totalRisks ?? allRisks.length;
        const criticalRisksCount = aggregatedStats?.criticalRisks ?? allRisks.filter(r => r.score >= 15).length;
        const highRisksCount = aggregatedStats?.highRisks ?? allRisks.filter(r => r.score >= 10 && r.score < 15).length;

        return {
            stats: {
                risks: totalRisksCount,
                assets: trueTotalAssets,
                compliance: compScore,
                highRisks: highRisksCount,
                auditsOpen: openAuditsCount,
                activeIncidents: activeIncidentsCount,
                assetValue: totalAssetValue,
                financialRisk: financialExposure,
                totalRisks: totalRisksCount,
                criticalRisks: criticalRisksCount,
                openIncidents: activeIncidentsCount,
                complianceRate: compScore,
                totalAssets: trueTotalAssets,
                activeProjects: myProjectsLength
            },
            radarData: rData,
            complianceScore: compScore,
            globalScore
        };
    }, [controls, allAssets, allRisks, openAuditsCount, activeIncidentsCount, myProjectsLength, aggregatedStats, externalComplianceScore]);

    const scoreGrade = useMemo(() => {
        if (!Number.isFinite(complianceScore) || complianceScore < 0) return undefined;
        if (complianceScore >= 85) return 'A';
        if (complianceScore >= 70) return 'B';
        if (complianceScore >= 50) return 'C';
        return 'D';
    }, [complianceScore]);

    return { historyData, topRisks, stats: { ...stats, globalScore }, radarData, complianceScore, scoreGrade, globalScore };
};
