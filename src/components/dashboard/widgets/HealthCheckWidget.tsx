import React, { useState } from 'react';
import { Stethoscope, CheckCircle2, AlertTriangle } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import { DashboardCard } from '../DashboardCard';

interface HealthIssue {
    id: string;
    type: 'warning' | 'danger';
    message: string;
    count: number;
    link: string;
}

interface HealthCheckWidgetProps {
    healthIssues: HealthIssue[];
    loading: boolean;
    navigate: (path: string) => void;
    t: (key: string) => string;
}

export const HealthCheckWidget: React.FC<HealthCheckWidgetProps> = ({ healthIssues, loading, navigate, t }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const displayIssues = isExpanded ? healthIssues : healthIssues.slice(0, 3);

    return (
        <DashboardCard
            title={t('dashboard.healthCheck')}
            subtitle={t('dashboard.systemAlerts')}
            icon={<Stethoscope className="w-5 h-5" />}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandable={true}
            headerAction={
                <CustomTooltip content={healthIssues.length > 0 ? t('dashboard.actionsRequired') : t('dashboard.systemHealthy')} position="left">
                    <div className={`p-1.5 rounded-lg ${healthIssues.length > 0 ? 'bg-orange-500/10' : 'bg-emerald-500/10'}`}>
                        <div className={`w-2 h-2 rounded-full ${healthIssues.length > 0 ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`} />
                    </div>
                </CustomTooltip>
            }
        >
            <div className="p-4 h-full overflow-y-auto custom-scrollbar">
                {loading ? <Skeleton className="h-full w-full" /> : healthIssues.length === 0 ? (
                    <div className="flex items-center p-5 bg-emerald-100/50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200/50 dark:border-emerald-900/30 backdrop-blur-sm">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-500 mr-4 flex-shrink-0" />
                        <div>
                            <span className="text-sm font-bold text-slate-800 dark:text-emerald-300 block">{t('dashboard.noAnomalies')}</span>
                            <span className="text-xs font-semibold text-slate-600 dark:text-emerald-400">{t('dashboard.systemsNominal')}</span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {displayIssues.map(issue => (
                            <CustomTooltip key={issue.id} content={t('dashboard.clickToResolve')} position="top" className="w-full">
                                <div
                                    onClick={() => navigate(issue.link)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            navigate(issue.link);
                                        }
                                    }}
                                    className={`flex items-start p-4 rounded-2xl border cursor-pointer hover:scale-[1.02] transition-all w-full ${issue.type === 'danger' ? 'bg-red-50/80 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:shadow-md hover:shadow-red-500/5' : 'bg-orange-50/80 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30 hover:shadow-md hover:shadow-orange-500/5'}`}
                                >
                                    <AlertTriangle className={`h-5 w-5 mr-3 mt-0.5 flex-shrink-0 ${issue.type === 'danger' ? 'text-red-500' : 'text-orange-500'}`} />
                                    <div>
                                        <p className={`text-sm font-bold leading-tight ${issue.type === 'danger' ? 'text-red-800 dark:text-red-200' : 'text-orange-800 dark:text-orange-200'}`}>{issue.message}</p>
                                        <span className={`text-xs font-bold mt-1 block ${issue.type === 'danger' ? 'text-red-600/70 dark:text-red-400' : 'text-orange-600/70 dark:text-orange-400'}`}>{issue.count} {t('dashboard.itemsAffected')}</span>
                                    </div>
                                </div>
                            </CustomTooltip>
                        ))}
                    </div>
                )}
                {!isExpanded && healthIssues.length > 3 && (
                    <div className="mt-3 text-center">
                        <button
                            className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 rounded"
                            onClick={() => setIsExpanded(true)}
                        >
                            +{healthIssues.length - 3} {t('common.more').toLowerCase()}
                        </button>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
};
