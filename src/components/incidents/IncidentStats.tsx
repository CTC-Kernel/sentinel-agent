import React from 'react';
import { ShieldAlert, Clock, AlertTriangle } from '../ui/Icons';
import { Skeleton, CardSkeleton } from '../ui/Skeleton';
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
        <div className="glass-premium p-6 md:p-8 rounded-[2.5rem] flex flex-col md:flex-row md:items-center md:justify-between gap-8 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

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
                            <div key={i} className="w-[180px] h-[100px]">
                                <CardSkeleton count={1} className="h-full" />
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <div className="space-y-2 relative z-10">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                            <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                            Vue globale des incidents
                        </p>
                        <div className="flex items-baseline gap-3">
                            <p className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                                {stats.open}
                            </p>
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{t('incidents.activeIncidents')}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto relative z-10">
                        {/* Active Incidents Card */}
                        <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-red-50/50 dark:hover:bg-red-900/20">
                            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                            <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">Actifs</span>
                                <div className="p-1.5 rounded-lg bg-red-100/50 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                                    <ShieldAlert className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{stats.open}</p>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('incidents.toTreat')}</p>
                            </div>
                        </div>

                        {/* MTTR Card */}
                        <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20">
                            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                            <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">MTTR</span>
                                <div className="p-1.5 rounded-lg bg-emerald-100/50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                    <Clock className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {stats.avgMttrHours !== null ? `${stats.avgMttrHours}h` : '-'}
                                </p>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('incidents.avgDelay')}</p>
                            </div>
                        </div>

                        {/* Critical Ratio Card */}
                        <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-5 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-orange-50/50 dark:hover:bg-orange-900/20">
                            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                            <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />

                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">Critiques</span>
                                <div className="p-1.5 rounded-lg bg-orange-100/50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                                    <AlertTriangle className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {stats.criticalRatio !== null ? `${stats.criticalRatio}%` : '-'}
                                </p>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('incidents.volumeTotal')}</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
