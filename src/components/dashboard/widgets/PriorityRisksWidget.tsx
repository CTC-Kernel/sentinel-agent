import React, { useState } from 'react';
import { Flame, ShieldAlert } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { Risk } from '../../../types';
import { DashboardCard } from '../DashboardCard';

interface PriorityRisksWidgetProps {
    topRisks: Risk[];
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
    title?: string;
}

export const PriorityRisksWidget: React.FC<PriorityRisksWidgetProps> = ({ topRisks, loading, navigate, t, title }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const displayRisks = isExpanded ? topRisks : topRisks.slice(0, 3);

    return (
        <div data-tour="risks-overview" className="contents">
            <DashboardCard
                title={title || t('dashboard.priorityRisks')}
                subtitle={t('dashboard.topCriticality')}
                icon={<Flame className="w-5 h-5 text-red-500" />}
                isExpanded={isExpanded}
                onToggleExpand={() => setIsExpanded(!isExpanded)}
                expandable={true}
                className="lg:col-span-2"
            >
                <div className="p-6 space-y-3 h-full overflow-y-auto custom-scrollbar">
                    {loading ? [1, 2].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />) : displayRisks.map(risk => (<div key={risk.id} onClick={() => navigate('/risks')} className="p-4 rounded-2xl bg-card/80 border border-border hover:bg-card transition-all group flex items-center justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer"><div className="flex items-center"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-100 dark:border-red-500/20 flex items-center justify-center mr-4 text-red-600 dark:text-red-400 font-black text-lg shadow-inner">{risk.score}</div><div><h4 className="text-sm font-bold text-foreground leading-tight">{risk.threat}</h4><p className="text-xs text-muted-foreground font-medium mt-1">{risk.vulnerability}</p></div></div><span className="text-[10px] font-bold bg-background/60 px-3 py-1.5 rounded-lg border border-border text-muted-foreground">{risk.strategy}</span></div>))}
                    {topRisks.length === 0 && !loading && <div className="flex flex-col items-center justify-center py-8 text-center"><ShieldAlert className="h-10 w-10 text-muted-foreground/40 mb-2" /><p className="text-sm text-muted-foreground font-medium">{t('dashboard.noCriticalRisks')}</p></div>}

                    {!isExpanded && topRisks.length > 3 && (
                        <div className="mt-3 text-center">
                            <span className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setIsExpanded(true)}>
                                +{topRisks.length - 3} {t('common.more').toLowerCase()}
                            </span>
                        </div>
                    )}
                </div>
            </DashboardCard>
        </div>
    );
};
