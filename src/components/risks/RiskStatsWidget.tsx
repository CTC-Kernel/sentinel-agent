import React from 'react';
import { Risk } from '../../types';
import { GlassCard } from '../ui/GlassCard';
import { ShieldAlert, AlertTriangle, Activity, TrendingUp } from 'lucide-react';
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

    // Improvement trend (mock logic or real if historical data available, here calculated from reduction)
    const avgResidual = risks.length > 0 ? risks.reduce((sum, r) => sum + ((r.residualProbability || 0) * (r.residualImpact || 0)), 0) / risks.length : 0;
    const riskReduction = avgScore > 0 ? ((avgScore - avgResidual) / avgScore * 100) : 0;

    const stats = [
        {
            label: "Risques Identifiés",
            value: totalRisks,
            icon: Activity,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            label: "Risques Critiques",
            value: criticalRisks,
            subtext: "Score ≥ 10",
            icon: ShieldAlert,
            color: 'text-red-500',
            bg: 'bg-red-500/10'
        },
        {
            label: "Hors Appétence",
            value: risksAboveAppetite,
            subtext: "> Seuil d'acceptation",
            icon: AlertTriangle,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10'
        },
        {
            label: "Score Moyen",
            value: avgScore.toFixed(1),
            subtext: `-${riskReduction.toFixed(0)}% après traitement`,
            icon: TrendingUp,
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
                <GlassCard key={index} className="p-4 flex items-center justify-between" hoverEffect>
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {stat.label}
                        </p>
                        <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">
                            {stat.value}
                        </p>
                        {stat.subtext && (
                            <p className="text-xs text-brand-600 dark:text-brand-400 mt-0.5 font-medium">
                                {stat.subtext}
                            </p>
                        )}
                    </div>
                    <div className={cn("p-3 rounded-xl", stat.bg)}>
                        <stat.icon className={cn("w-6 h-6", stat.color)} />
                    </div>
                </GlassCard>
            ))}
        </div>
    );
};
