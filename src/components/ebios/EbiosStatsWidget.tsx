import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, CheckCircle2, Target, Network } from '../ui/Icons';
import { PremiumCard } from '../ui/PremiumCard';
import { EbiosAnalysis } from '../../types/ebios';

interface EbiosStatsWidgetProps {
    analyses: EbiosAnalysis[];
}

export const EbiosStatsWidget: React.FC<EbiosStatsWidgetProps> = ({ analyses }) => {
    const { t } = useTranslation();

    const metrics = React.useMemo(() => {
        const total = analyses.length;
        if (total === 0) return { maturity: 0, sources: 0, scenarios: 0, treated: 0 };

        let totalMaturity = 0;
        let totalSources = 0;
        let totalScenarios = 0;
        let totalRisks = 0;
        let treatedRisks = 0;

        analyses.forEach(a => {
            // Workshop 1: Maturity
            totalMaturity += a.workshops[1]?.data?.securityBaseline?.maturityScore || 0;

            // Workshop 2: Sources
            totalSources += a.workshops[2]?.data?.selectedRiskSources?.length || 0;

            // Workshop 3 & 4: Scenarios
            totalScenarios += (a.workshops[3]?.data?.strategicScenarios?.length || 0) +
                (a.workshops[4]?.data?.operationalScenarios?.length || 0);

            // Workshop 5: Treatment
            const treatmentPlan = a.workshops[5]?.data?.treatmentPlan || [];
            totalRisks += treatmentPlan.length;
            treatedRisks += treatmentPlan.filter(i => i.status === 'completed' || i.strategy === 'accept').length;
        });

        return {
            maturity: Math.round(totalMaturity / total),
            sources: totalSources,
            scenarios: totalScenarios,
            treatedRate: totalRisks > 0 ? Math.round((treatedRisks / totalRisks) * 100) : 0
        };
    }, [analyses]);

    const stats = [
        {
            label: t('ebios.stats.maturity'),
            value: `${metrics.maturity}%`,
            sublabel: t('ebios.workshops.w1'),
            icon: Shield,
            color: 'text-brand-500',
            bg: 'bg-brand-50 dark:bg-brand-900/10'
        },
        {
            label: t('ebios.stats.riskSources'),
            value: metrics.sources,
            sublabel: t('ebios.workshops.w2'),
            icon: Target,
            color: 'text-warning-text',
            bg: 'bg-warning-bg'
        },
        {
            label: t('ebios.stats.scenarios'),
            value: metrics.scenarios,
            sublabel: t('ebios.workshops.w34'),
            icon: Network,
            color: 'text-violet-500',
            bg: 'bg-violet-50 dark:bg-violet-900/10'
        },
        {
            label: t('ebios.stats.treatmentRate'),
            value: `${metrics.treatedRate}%`,
            sublabel: t('ebios.workshops.w5'),
            icon: CheckCircle2,
            color: 'text-success-text',
            bg: 'bg-success-bg'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
                <PremiumCard glass key={index} className="p-4 flex items-center justify-between" hover>
                    <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                            {stat.sublabel}
                        </p>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            {stat.label}
                        </p>
                        <p className="text-2xl font-black mt-1 text-slate-900 dark:text-white">
                            {stat.value}
                        </p>
                    </div>
                    <div className={`p-3 rounded-2xl ${stat.bg}`}>
                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                </PremiumCard>
            ))}
        </div>
    );
};
