import React, { useState } from 'react';
import { History, ShieldAlert, Siren, Server, CheckCircle2 } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { SystemLog } from '../../../types';
import { DashboardCard } from '../DashboardCard';

interface RecentActivityWidgetProps {
    recentActivity: SystemLog[];
    loading: boolean;
    t: (key: string) => string;
}

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({ recentActivity, loading, t }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    type ActivityFilter = 'All' | 'Risk' | 'Incident' | 'Asset';
    const [filter, setFilter] = useState<ActivityFilter>('All');

    const getActivityIcon = (resource: string) => {
        switch (resource) {
            case 'Risk': return <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />;
            case 'Incident': return <Siren className="h-3.5 w-3.5 text-red-500" />;
            case 'Asset': return <Server className="h-3.5 w-3.5 text-blue-500" />;
            default: return <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />;
        }
    };

    const allFilteredActivity = recentActivity.filter(log => filter === 'All' || log.resource === filter);
    const displayActivity = isExpanded ? allFilteredActivity : allFilteredActivity.slice(0, 5);

    return (
        <DashboardCard
            title={t('dashboard.recentActivity')}
            subtitle={t('dashboard.realTime')}
            icon={<History className="w-5 h-5 text-muted-foreground" />}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandable={true}
            headerAction={
                <select
                    value={filter}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setFilter(e.target.value as ActivityFilter)}
                    className="px-2 py-1.5 bg-background rounded-lg text-[11px] font-bold text-muted-foreground border border-border hover:bg-accent transition-colors outline-none cursor-pointer"
                >
                    <option value="All">{t('common.all')}</option>
                    <option value="Risk">Risks</option>
                    <option value="Incident">Incidents</option>
                    <option value="Asset">Assets</option>
                </select>
            }
        >
            <div className="p-0 h-full overflow-y-auto custom-scrollbar">
                <div className="border-l border-border space-y-8 py-8 ml-14 pr-8 relative">
                    {loading ? <Skeleton className="h-20 w-full" /> : displayActivity.length === 0 ? (
                        <div className="text-sm text-muted-foreground">{t('dashboard.nothingToReport')}</div>
                    ) : displayActivity.map((log, i) => (
                        <div key={`activity-${i}`} className="relative group">
                            <span className="absolute -left-[41px] flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border shadow-sm group-hover:scale-110 group-hover:border-blue-400 transition-all z-10">
                                {getActivityIcon(log.resource)}
                            </span>
                            <div className="flex justify-between items-start bg-card/60 p-3 rounded-xl border border-transparent hover:border-border transition-colors">
                                <div>
                                    <p className="text-sm font-bold text-foreground">{log.action}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[500px] font-medium leading-relaxed">{log.details}</p>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide bg-accent px-2 py-1 rounded-md ml-4 whitespace-nowrap">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}
                    {!isExpanded && allFilteredActivity.length > 5 && (
                        <div className="mt-3 text-center pl-8">
                            <button
                                onClick={() => setIsExpanded(true)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setIsExpanded(true);
                                    }
                                }}
                                className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded px-2 py-1"
                            >
                                +{allFilteredActivity.length - 5} {t('common.more').toLowerCase()}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </DashboardCard>
    );
};
