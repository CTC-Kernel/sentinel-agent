import React, { useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Incident, Criticality } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { Clock, AlertTriangle, Loader2, ShieldCheck } from '../../ui/Icons';
import { GlassCard } from '../../ui/GlassCard';
import { EmptyState } from '../../ui/EmptyState';

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
        const openCount = incidents.filter(i => i.status !== 'Fermé').length;
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

    // Empty state when no incidents
    if (incidents.length === 0) {
        return (
            <GlassCard
                className="h-full flex flex-col p-5 overflow-hidden"
                hoverEffect={true}
                gradientOverlay={true}
            >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5 relative z-10">
                    <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                        </span>
                        Incidents
                    </h3>
                </div>

                <div className="flex-1 flex items-center justify-center relative z-10">
                    <EmptyState
                        icon={ShieldCheck}
                        title="Aucun incident enregistré"
                        description="Votre organisation n'a déclaré aucun incident de sécurité."
                        actionLabel="Déclarer un incident"
                        onAction={() => navigate && navigate('/incidents')}
                        semantic="success"
                        compact
                    />
                </div>
            </GlassCard>
        );
    }

    return (
        <GlassCard
            className="h-full flex flex-col p-5 overflow-hidden group hover:shadow-apple"
            hoverEffect={true}
            gradientOverlay={true}
        >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5 relative z-10">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/60 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive"></span>
                    </span>
                    Incidents
                </h3>
                <button
                    onClick={() => {
                        if (navigate) navigate('/incidents');
                    }}
                    className="text-xs font-bold px-2 py-1 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors border border-white/50 dark:border-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
                    <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (navigate) {
                                    navigate('/incidents');
                                }
                            }
                        }}
                        className="rounded-xl bg-gradient-to-br from-success-bg to-success-bg/50 dark:from-success/5 dark:to-success/10 border border-success-border/50 dark:border-success/20 p-3 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer group/card focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
                        onClick={() => {
                            if (navigate) navigate('/incidents');
                        }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-success-text dark:text-success">MTTR</span>
                            <Clock className="h-3.5 w-3.5 text-success group-hover/card:rotate-12 transition-transform" />
                        </div>
                        <div>
                            <p className="text-lg font-black text-slate-800 dark:text-success/90 leading-none">
                                {stats.avgMttrHours !== null ? `${stats.avgMttrHours}h` : '-'}
                            </p>
                            <p className="text-[9px] font-bold text-success-text/70 dark:text-success/70 mt-0.5 uppercase tracking-wider">moyen</p>
                        </div>
                    </div>

                    <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (navigate) {
                                    navigate('/incidents');
                                }
                            }
                        }}
                        className="rounded-xl bg-gradient-to-br from-warning-bg to-warning-bg/50 dark:from-warning/5 dark:to-warning/10 border border-warning-border/50 dark:border-warning/20 p-3 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer group/card focus:outline-none focus-visible:ring-2 focus-visible:ring-warning"
                        onClick={() => {
                            if (navigate) navigate('/incidents');
                        }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-warning-text dark:text-warning">Critiques</span>
                            <AlertTriangle className="h-3.5 w-3.5 text-warning group-hover/card:shake transition-transform" />
                        </div>
                        <div>
                            <p className="text-lg font-black text-slate-800 dark:text-warning/90 leading-none">
                                {stats.criticalRatio}%
                            </p>
                            <p className="text-[9px] font-bold text-warning-text/70 dark:text-warning/70 mt-0.5 uppercase tracking-wider">du total</p>
                        </div>
                    </div>
                </div>
            </div>
        </GlassCard>
    );
};
