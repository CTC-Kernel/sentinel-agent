import React from 'react';
import { Stethoscope, CheckCircle2, AlertTriangle } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';

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
    return (
        <div className="glass-panel p-0 rounded-[2rem] overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-shadow">
            <div className="px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 flex justify-between items-center backdrop-blur-sm">
                <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('dashboard.healthCheck')}</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{t('dashboard.systemAlerts')}</p></div>
                <CustomTooltip content={healthIssues.length > 0 ? t('dashboard.actionsRequired') : t('dashboard.systemHealthy')} position="left">
                    <div className={`p-2 rounded-xl ${healthIssues.length > 0 ? 'bg-orange-500/10' : 'bg-emerald-500/10'}`}>
                        <Stethoscope className={`w-5 h-5 ${healthIssues.length > 0 ? 'text-orange-500' : 'text-emerald-500'}`} />
                    </div>
                </CustomTooltip>
            </div>
            <div className="p-6 flex-1 space-y-3 bg-white/40 dark:bg-transparent">
                {loading ? <Skeleton className="h-full w-full" /> : healthIssues.length === 0 ? (<div className="flex items-center p-5 bg-emerald-50/80 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30"><CheckCircle2 className="h-6 w-6 text-emerald-500 mr-4 flex-shrink-0" /><div><span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 block">{t('dashboard.noAnomalies')}</span><span className="text-xs text-emerald-600/80 dark:text-emerald-400">{t('dashboard.systemsNominal')}</span></div></div>) : (healthIssues.map(issue => (
                    <CustomTooltip key={issue.id} content={t('dashboard.clickToResolve')} position="top" className="w-full">
                        <div onClick={() => navigate(issue.link)} className={`flex items-start p-4 rounded-2xl border cursor-pointer hover:scale-[1.02] transition-all w-full ${issue.type === 'danger' ? 'bg-red-50/80 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 hover:shadow-md hover:shadow-red-500/5' : 'bg-orange-50/80 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30 hover:shadow-md hover:shadow-orange-500/5'}`}><AlertTriangle className={`h-5 w-5 mr-3 mt-0.5 flex-shrink-0 ${issue.type === 'danger' ? 'text-red-500' : 'text-orange-500'}`} /><div><p className={`text-sm font-bold leading-tight ${issue.type === 'danger' ? 'text-red-800 dark:text-red-200' : 'text-orange-800 dark:text-orange-200'}`}>{issue.message}</p><span className={`text-xs font-bold mt-1 block ${issue.type === 'danger' ? 'text-red-600/70 dark:text-red-400' : 'text-orange-600/70 dark:text-orange-400'}`}>{issue.count} {t('dashboard.itemsAffected')}</span></div></div>
                    </CustomTooltip>
                )))}
            </div>
        </div>
    );
};
