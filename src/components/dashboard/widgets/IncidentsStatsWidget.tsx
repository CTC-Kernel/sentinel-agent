import React, { useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Incident, Criticality } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { Clock, AlertTriangle, Loader2 } from '../../ui/Icons';

interface IncidentsStatsWidgetProps {
    navigate?: (path: string) => void;
    t?: (key: string) => string;
}

export const IncidentsStatsWidget: React.FC<IncidentsStatsWidgetProps> = ({ navigate }) => {
    const { user } = useStore();

    const { data: incidents, loading } = useFirestoreCollection<Incident>(
        'incidents',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const stats = useMemo(() => {
        const total = incidents.length;
        const openCount = incidents.filter(i => i.status !== 'Fermé' && i.status !== 'Résolu').length;
        const criticalCount = incidents.filter(i => i.severity === Criticality.CRITICAL).length;

        let totalResolutionHours = 0;
        let resolvedWithTimes = 0;

        incidents.forEach(inc => {
            if (inc.dateReported && inc.dateResolved) {
                const start = new Date(inc.dateReported).getTime();
                const end = new Date(inc.dateResolved).getTime();
                if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
                    const diffHours = (end - start) / (1000 * 60 * 60);
                    totalResolutionHours += diffHours;
                    resolvedWithTimes++;
                }
            }
        });

        const avgMttrHours = resolvedWithTimes > 0 ? Math.round(totalResolutionHours / resolvedWithTimes) : null;
        const criticalRatio = total > 0 ? Math.round((criticalCount / total) * 100) : 0;

        return {
            open: openCount,
            avgMttrHours,
            criticalRatio,
        };
    }, [incidents]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-5 glass-panel rounded-2xl border border-white/60 dark:border-white/5 shadow-sm relative overflow-hidden group hover:shadow-apple transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/5 relative z-10">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    Incidents
                </h3>
                <button
                    onClick={() => navigate && navigate('/incidents')}
                    className="text-xs font-bold px-2 py-1 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors border border-white/50 dark:border-white/5"
                >
                    Voir tout
                </button>
            </div>

            <div className="flex flex-col gap-4 mt-4 flex-1 relative z-10">
                <div className="flex items-baseline gap-2">
                    <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 tracking-tighter">
                        {stats.open}
                    </p>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">actifs</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-auto">
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/10 dark:to-emerald-900/20 border border-emerald-100/50 dark:border-emerald-900/40 p-3 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer group/card" onClick={() => navigate && navigate('/incidents')}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">MTTR</span>
                            <Clock className="h-3.5 w-3.5 text-emerald-500 group-hover/card:rotate-12 transition-transform" />
                        </div>
                        <div>
                            <p className="text-lg font-black text-slate-800 dark:text-emerald-100 leading-none">
                                {stats.avgMttrHours !== null ? `${stats.avgMttrHours}h` : '-'}
                            </p>
                            <p className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-400/70 mt-0.5 uppercase tracking-wider">moyen</p>
                        </div>
                    </div>

                    <div className="rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/10 dark:to-orange-900/20 border border-orange-100/50 dark:border-orange-900/40 p-3 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer group/card" onClick={() => navigate && navigate('/incidents')}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">Critiques</span>
                            <AlertTriangle className="h-3.5 w-3.5 text-orange-500 group-hover/card:shake transition-transform" />
                        </div>
                        <div>
                            <p className="text-lg font-black text-slate-800 dark:text-orange-100 leading-none">
                                {stats.criticalRatio}%
                            </p>
                            <p className="text-[9px] font-bold text-orange-600/70 dark:text-orange-400/70 mt-0.5 uppercase tracking-wider">du total</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
