import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Clock, CheckCircle2, TrendingUp } from '../ui/Icons';
import { PremiumCard } from '../ui/PremiumCard';
import { EbiosAnalysis } from '../../types/ebios';

interface EbiosStatsWidgetProps {
    analyses: EbiosAnalysis[];
}

export const EbiosStatsWidget: React.FC<EbiosStatsWidgetProps> = ({ analyses }) => {
    const { t } = useTranslation();

    const total = analyses.length;
    const inProgress = analyses.filter(a => a.status === 'in_progress').length;
    const completed = analyses.filter(a => a.status === 'completed').length;

    const avgProgress = total > 0
        ? Math.round(analyses.reduce((acc, curr) => acc + curr.completionPercentage, 0) / total)
        : 0;

    const stats = [
        {
            label: t('ebios.stats.total'),
            value: total,
            icon: Shield,
            color: 'text-blue-500',
            bg: 'bg-blue-50'
        },
        {
            label: t('ebios.stats.inProgress'),
            value: inProgress,
            icon: Clock,
            color: 'text-amber-500',
            bg: 'bg-amber-50'
        },
        {
            label: t('ebios.stats.completed'),
            value: completed,
            icon: CheckCircle2,
            color: 'text-green-500',
            bg: 'bg-green-50'
        },
        {
            label: t('ebios.stats.avgProgress'),
            value: `${avgProgress}%`,
            icon: TrendingUp,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, index) => (
                <PremiumCard glass key={index} className="p-4 flex items-center justify-between" hover>
                    <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-muted-foreground">
                            {stat.label}
                        </p>
                        <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                            {stat.value}
                        </p>
                    </div>
                    <div className={`p-3 rounded-3xl ${stat.bg}`}>
                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                </PremiumCard>
            ))}
        </div>
    );
};
