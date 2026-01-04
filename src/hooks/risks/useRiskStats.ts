import { useMemo } from 'react';
import { Risk } from '../../types';

export const useRiskStats = (risks: Risk[]) => {
    const stats = useMemo(() => {
        const safeRisks = risks.map(r => ({
            ...r,
            score: Number(r.score) || 0,
            residualScore: Number(r.residualScore) || Number(r.score) || 0,
            probability: Number(r.probability) || 0,
            impact: Number(r.impact) || 0
        }));

        const total = safeRisks.length;
        const critical = safeRisks.filter(r => r.score >= 15).length;
        const high = safeRisks.filter(r => r.score >= 10 && r.score < 15).length;
        const medium = safeRisks.filter(r => r.score >= 5 && r.score < 10).length;
        const low = safeRisks.filter(r => r.score < 5).length;

        const totalScore = safeRisks.reduce((sum, r) => sum + r.score, 0);
        const totalResidual = safeRisks.reduce((sum, r) => sum + r.residualScore, 0);

        const avgScore = total > 0 ? totalScore / total : 0;
        const reductionPercentage = totalScore > 0
            ? Math.round(((totalScore - totalResidual) / totalScore) * 100)
            : 0;

        const untreatedCritical = safeRisks.filter(r => r.strategy === 'Accepter' && r.score >= 10).length;

        const strategyCounts = safeRisks.reduce((acc, r) => {
            const strat = r.strategy || 'Inconnu';
            acc[strat] = (acc[strat] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            total,
            critical,
            high,
            medium,
            low,
            avgScore,
            reductionPercentage,
            untreatedCritical,
            strategyCounts
        };
    }, [risks]);

    return stats;
};
