import React from 'react';
import { ShieldAlert, Clock, AlertTriangle } from '../ui/Icons';
import { Skeleton, CardSkeleton } from '../ui/Skeleton';
import { PremiumCard } from '../ui/PremiumCard';
import { useStore } from '../../store';

interface IncidentStatsProps {
    stats: {
        open: number;
        avgMttrHours: number | null;
        criticalRatio: number | null;
    };
    loading: boolean;
}

export const IncidentStats: React.FC<IncidentStatsProps> = ({ stats, loading }) => {
    const { t } = useStore();

    return (
        <PremiumCard glass className="p-6 md:p-8 rounded-3xl flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative overflow-hidden group shadow-apple transition-all duration-500">

            {loading ? (
                /* Skeleton Loader for Summary Card */
                <>
                    <div className="space-y-4 relative z-10">
                        <Skeleton className="h-4 w-48 rounded" />
                        <div className="flex items-baseline gap-3">
                            <Skeleton className="h-12 w-24 rounded-lg" />
                            <Skeleton className="h-4 w-32 rounded" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto relative z-10">
                        {[1, 2, 3].map((i) => (
                            <div key={i || 'unknown'} className="w-[180px] h-[100px]">
                                <CardSkeleton count={1} className="h-full" />
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <div className="space-y-2 relative z-10">
                        <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500/80 flex items-center gap-2 mb-2">
                            <span className="inline-flex h-2 w-2 rounded-full bg-error-text animate-pulse shadow-glow shadow-error-text/30" />
                            Vue globale des incidents
                        </p>
                        <div className="flex items-baseline gap-3">
                            <p className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                                {stats.open}
                            </p>
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{t('incidents.activeIncidents')}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto relative z-10">
                        {/* Active Incidents Card */}
                        <PremiumCard glass hover={true} className="p-5 rounded-3xl hover:bg-error-bg border-border/40 shadow-sm transition-all duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-black uppercase tracking-widest text-error-text opacity-70">Actifs</span>
                                <div className="p-2 rounded-3xl bg-error-bg ring-1 ring-inset ring-error-border/30 text-error-text shadow-sm">
                                    <ShieldAlert className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats.open}</p>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('incidents.toTreat')}</p>
                            </div>
                        </PremiumCard>

                        {/* MTTR Card */}
                        <PremiumCard glass hover={true} className="p-5 rounded-3xl hover:bg-success-bg border-border/40 shadow-sm transition-all duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-black uppercase tracking-widest text-success-text opacity-70">MTTR</span>
                                <div className="p-2 rounded-3xl bg-success-bg ring-1 ring-inset ring-success-border/30 text-success-text shadow-sm">
                                    <Clock className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {stats.avgMttrHours !== null ? `${stats.avgMttrHours}h` : '-'}
                                </p>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('incidents.avgDelay')}</p>
                            </div>
                        </PremiumCard>

                        {/* Critical Ratio Card */}
                        <PremiumCard glass hover={true} className="p-5 rounded-3xl hover:bg-warning-bg border-border/40 shadow-sm transition-all duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-black uppercase tracking-widest text-warning-text opacity-70">Critiques</span>
                                <div className="p-2 rounded-3xl bg-warning-bg ring-1 ring-inset ring-warning-border/30 text-warning-text shadow-sm">
                                    <AlertTriangle className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {stats.criticalRatio !== null ? `${stats.criticalRatio}%` : '-'}
                                </p>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t('incidents.volumeTotal')}</p>
                            </div>
                        </PremiumCard>
                    </div>
                </>
            )}
        </PremiumCard>
    );
};
