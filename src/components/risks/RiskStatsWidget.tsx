import React from 'react';
import { Risk } from '../../types';
import { PremiumCard } from '../ui/PremiumCard';
import { ShieldAlert, AlertTriangle, Activity, TrendingUp } from '../ui/Icons';
import { cn } from '../../utils/cn';
import { RISK_ACCEPTANCE_THRESHOLD } from '../../constants/RiskConstants';

interface RiskStatsWidgetProps {
    risks: Risk[];
}

export const RiskStatsWidget: React.FC<RiskStatsWidgetProps> = ({ risks }) => {

    const totalRisks = risks.length;
    const criticalRisks = risks.filter(r => r.score >= 10).length;
    const risksAboveAppetite = risks.filter(r => (r.residualScore || r.score) > RISK_ACCEPTANCE_THRESHOLD).length;
    const avgScore = risks.length > 0 ? risks.reduce((sum, r) => sum + r.score, 0) / risks.length : 0;

    // Improvement trend - calculated from residualScore vs score
    const avgResidual = risks.length > 0
        ? risks.reduce((sum, r) => sum + (r.residualScore ?? r.score), 0) / risks.length
        : 0;
    const riskReduction = avgScore > 0 ? Math.max(0, ((avgScore - avgResidual) / avgScore * 100)) : 0;

    const stats = [
        {
            label: "Risques Identifiés",
            value: totalRisks,
            icon: Activity,
            color: 'text-brand-600 dark:text-brand-400',
            bg: 'bg-brand-50'
        },
        {
            label: "Risques Critiques",
            value: criticalRisks,
            subtext: "Score ≥ 10",
            icon: ShieldAlert,
            color: 'text-error-text',
            bg: 'bg-error-bg'
        },
        {
            label: "Hors Appétence",
            value: risksAboveAppetite,
            subtext: "> Seuil d'acceptation",
            icon: AlertTriangle,
            color: 'text-warning-text',
            bg: 'bg-warning-bg'
        },
        {
            label: "Score Moyen",
            value: avgScore.toFixed(1),
            subtext: `-${riskReduction.toFixed(0)}% après traitement`,
            icon: TrendingUp,
            color: 'text-info-text',
            bg: 'bg-info-bg'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
                <PremiumCard glass key={index} className="p-4 flex items-center justify-between" hover>
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-muted-foreground">
                            {stat.label}
                        </p>
                        <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                            {stat.value}
                        </p>
                        {stat.subtext && (
                            <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5 font-medium">
                                {stat.subtext}
                            </p>
                        )}
                    </div>
                    <div className={cn("p-4 rounded-2xl ring-1 ring-inset ring-black/5 dark:ring-white/10 shadow-sm", stat.bg)}>
                        <stat.icon className={cn("w-6 h-6", stat.color)} />
                    </div>
                </PremiumCard>
            ))}
        </div>
    );
};
