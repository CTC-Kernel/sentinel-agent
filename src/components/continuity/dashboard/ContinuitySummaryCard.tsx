import React, { useMemo } from 'react';
import { Activity, ShieldCheck, Zap, TrendingUp, History } from '../../ui/Icons';
import { BusinessProcess, BcpDrill } from '../../../types';

interface ContinuitySummaryCardProps {
    processes: BusinessProcess[];
    drills: BcpDrill[];
}

export const ContinuitySummaryCard: React.FC<ContinuitySummaryCardProps> = ({ processes, drills }) => {
    // 1. KPI Calculations
    const stats = useMemo(() => {
        const total = processes.length;
        const critical = processes.filter(p => p.priority === 'Critique').length;

        // Coverage (Tested in last 12 months)
        const testedProcesses = processes.filter(p => {
            if (!p.lastTestDate) return false;
            const lastTest = new Date(p.lastTestDate);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            return lastTest > oneYearAgo;
        }).length;

        const coverageRate = total > 0 ? Math.round((testedProcesses / total) * 100) : 0;
        const overdueTests = total - testedProcesses;

        // Drills
        const totalDrills = drills.length;
        const failedDrills = drills.filter(d => d.result === 'Échec').length;
        const successRate = totalDrills > 0
            ? Math.round(((totalDrills - failedDrills) / totalDrills) * 100)
            : 0;

        return { total, critical, coverageRate, overdueTests, totalDrills, successRate };
    }, [processes, drills]);

    return (
        <div className="glass-premium p-6 md:p-8 rounded-5xl border border-white/60 dark:border-white/5 flex flex-col xl:flex-row gap-8 relative group overflow-hidden bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
            {/* Tech Corners Generic */}
            <svg className="absolute top-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
            <svg className="absolute top-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
            <svg className="absolute bottom-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
            <svg className="absolute bottom-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

            <div className="absolute inset-0 overflow-hidden rounded-5xl pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-100 opacity-70"></div>
            </div>

            {/* 1. Global Coverage Gauge (Radial) */}
            <div className="flex items-center gap-8 relative z-10 min-w-[300px]">
                <div className="relative group/ring">
                    <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="0 0 96 96">
                        <circle
                            className="text-slate-100 dark:text-slate-800"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            r="40"
                            cx="48"
                            cy="48"
                        />
                        <circle
                            className={`${stats.coverageRate >= 80 ? 'text-success' : stats.coverageRate >= 50 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                            strokeWidth="8"
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * stats.coverageRate) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="40"
                            cx="48"
                            cy="48"
                            style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
                        />
                    </svg>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                        <span className="text-2xl font-black text-foreground tracking-tighter">{stats.coverageRate}%</span>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-foreground mb-1 uppercase tracking-wide font-mono">Santé BCP</h3>
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                        Couverture des tests et validité des plans.
                    </p>
                </div>
            </div>

            {/* Quick Stats Grid inside the main card */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 border-l border-r border-border/50 px-6 mx-2 relative z-10">
                <div className="text-center group/metric">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <History className="h-4 w-4 text-slate-500 group-hover/metric:text-amber-500 transition-colors" />
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Expirés</div>
                    </div>
                    <div className="text-2xl font-black text-foreground group-hover/metric:scale-110 transition-transform duration-300">{stats.overdueTests}</div>
                </div>
                <div className="text-center group/metric">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-slate-500 group-hover/metric:text-brand-500 transition-colors" />
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Processus</div>
                    </div>
                    <div className="text-2xl font-black text-foreground group-hover/metric:scale-110 transition-transform duration-300">{stats.total}</div>
                </div>
                <div className="text-center group/metric">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <ShieldCheck className="h-4 w-4 text-slate-500 group-hover/metric:text-rose-500 transition-colors" />
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Critiques</div>
                    </div>
                    <div className="text-2xl font-black text-foreground group-hover/metric:scale-110 transition-transform duration-300">{stats.critical}</div>
                </div>
                <div className="text-center group/metric">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-slate-500 group-hover/metric:text-blue-500 transition-colors" />
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Exercices</div>
                    </div>
                    <div className="text-2xl font-black text-foreground group-hover/metric:scale-110 transition-transform duration-300">{stats.totalDrills}</div>
                </div>
            </div>

            {/* Drill Success Rate Mini-Card */}
            <div className="min-w-[200px] flex flex-col justify-center relative z-10 pl-4">
                <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors cursor-default mb-2">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide font-mono">Succès Drills</span>
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-3xl font-black text-foreground">{stats.successRate}%</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Taux de réussite</div>
                </div>
            </div>
        </div>
    );
};
