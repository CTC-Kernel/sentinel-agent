import React, { useMemo } from 'react';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { BusinessProcess, BcpDrill } from '../../../types';
import { where, orderBy, limit } from 'firebase/firestore';
import { useStore } from '../../../store';
import { HeartPulse, CheckCircle2, AlertTriangle, CalendarClock } from '../../ui/Icons';

interface ContinuityPlansWidgetProps {
    navigate?: (path: string) => void;
}

export const ContinuityPlansWidget: React.FC<ContinuityPlansWidgetProps> = ({ navigate }) => {
    const { user } = useStore();

    const { data: processes, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId)],
        { realtime: true, enabled: !!user?.organizationId }
    );

    const { data: drills, loading: loadingDrills } = useFirestoreCollection<BcpDrill>(
        'bcp_drills',
        [where('organizationId', '==', user?.organizationId), orderBy('date', 'desc'), limit(1)],
        { realtime: true, enabled: !!user?.organizationId }
    );

    const stats = useMemo(() => {
        const total = processes.length;
        if (total === 0) return { coverage: 0, lastDrillStr: 'Aucun' };

        const tested = processes.filter(p => {
            if (!p.lastTestDate) return false;
            const last = new Date(p.lastTestDate);
            const yearAgo = new Date();
            yearAgo.setFullYear(yearAgo.getFullYear() - 1);
            return last > yearAgo;
        }).length;

        const coverage = Math.round((tested / total) * 100);
        const lastDrill = drills.length > 0 ? drills[0] : null;

        // Format relative date or strict date
        let lastDrillStr = 'Aucun';
        if (lastDrill) {
            lastDrillStr = new Date(lastDrill.date).toLocaleDateString();
        }

        return { coverage, lastDrillStr, lastDrillResult: lastDrill?.result };
    }, [processes, drills]);

    const loading = loadingProcesses || loadingDrills;

    // Gradient calculation similar to Compliance widget
    const circumference = 2 * Math.PI * 40; // r=40
    const strokeDashoffset = circumference - (stats.coverage / 100) * circumference;

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center glass-panel rounded-2xl border border-white/60 dark:border-white/5 p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-5 glass-panel rounded-2xl border border-white/60 dark:border-white/5 shadow-sm relative overflow-hidden group hover:shadow-apple transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5 relative z-10">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400">
                        <HeartPulse className="w-4 h-4" />
                    </div>
                    Continuité
                </h3>
                <button
                    onClick={() => navigate && navigate('/continuity')}
                    className="text-xs font-bold px-2 py-1 rounded-lg bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors border border-white/50 dark:border-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                    Voir tout
                </button>
            </div>

            <div className="flex-1 flex items-center justify-between relative z-10 pt-2 px-1">
                {/* Circular Chart */}
                <div className="relative w-20 h-20 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="40"
                            cy="40"
                            r="36"
                            fill="transparent"
                            stroke="currentColor"
                            strokeWidth="8"
                            className="text-slate-100 dark:text-slate-800"
                        />
                        <circle
                            cx="40"
                            cy="40"
                            r="36"
                            fill="transparent"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className={`transition-all duration-1000 ease-out ${stats.coverage >= 80 ? 'text-emerald-500' : stats.coverage >= 50 ? 'text-amber-500' : 'text-rose-500'}`}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-lg font-black text-foreground">{stats.coverage}%</span>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1 text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Dernier Test</span>
                    <span className="text-sm font-bold text-foreground">{stats.lastDrillStr}</span>

                    {stats.lastDrillResult && (
                        <div className={`mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${stats.lastDrillResult === 'Succès' ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:border-green-900/30' : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900/30'}`}>
                            {stats.lastDrillResult === 'Succès' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {stats.lastDrillResult}
                        </div>
                    )}
                    {!stats.lastDrillResult && (
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <CalendarClock className="w-3 h-3" />
                            À Planifier
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
