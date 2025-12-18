import { useMemo } from 'react';
import { Risk } from '../../types';

export const useRiskStats = (risks: Risk[]) => {
    const stats = useMemo(() => {
        const total = risks.length;
        const critical = risks.filter(r => r.score >= 15).length;
        const high = risks.filter(r => r.score >= 10 && r.score < 15).length;
        const medium = risks.filter(r => r.score >= 5 && r.score < 10).length;
        const low = risks.filter(r => r.score < 5).length;

        const totalScore = risks.reduce((sum, r) => sum + r.score, 0);
        const totalResidual = risks.reduce((sum, r) => sum + (r.residualScore || r.score), 0);

        const avgScore = total > 0 ? totalScore / total : 0;
        const reductionPercentage = totalScore > 0
            ? Math.round(((totalScore - totalResidual) / totalScore) * 100)
            : 0;

        const untreatedCritical = risks.filter(r => r.strategy === 'Accepter' && r.score >= 10).length;

        const strategyCounts = risks.reduce((acc, r) => {
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
