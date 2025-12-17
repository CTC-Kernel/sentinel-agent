import React, { useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Incident, Criticality } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { ShieldAlert, Clock, AlertTriangle, Loader2 } from '../../ui/Icons';

interface IncidentsStatsWidgetProps {
    navigate?: (path: string) => void;
    t?: (key: string) => string;
}

export const IncidentsStatsWidget: React.FC<IncidentsStatsWidgetProps> = ({ navigate, t = (k) => k }) => {
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
        <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <h3 className="text-lg font-bold flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    Incidents
                </h3>
            </div>

            <div className="flex items-baseline gap-3 mb-2">
                <p className="text-4xl font-black text-foreground tracking-tight">
                    {stats.open}
                </p>
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">actifs</span>
            </div>

            <div className="grid grid-cols-2 gap-3 flex-1">
                <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100/50 dark:border-emerald-900/40 p-3 flex flex-col justify-between backdrop-blur-sm transition-colors hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 cursor-pointer" onClick={() => navigate?.('/incidents')}>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">MTTR</span>
                        <Clock className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <p className="text-lg font-black text-foreground leading-none">
                        {stats.avgMttrHours !== null ? `${stats.avgMttrHours}h` : '-'}
                    </p>
                    <p className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-300/70 mt-1 uppercase tracking-wider">moyen</p>
                </div>

                <div className="rounded-xl bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100/50 dark:border-orange-900/40 p-3 flex flex-col justify-between backdrop-blur-sm transition-colors hover:bg-orange-100/50 dark:hover:bg-orange-900/20 cursor-pointer" onClick={() => navigate?.('/incidents')}>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">Critiques</span>
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                    </div>
                    <p className="text-lg font-black text-foreground leading-none">
                        {stats.criticalRatio}%
                    </p>
                    <p className="text-[9px] font-bold text-orange-600/70 dark:text-orange-300/70 mt-1 uppercase tracking-wider">du total</p>
                </div>
            </div>
        </div>
    );
};
