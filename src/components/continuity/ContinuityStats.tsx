import React from 'react';
import { motion } from 'framer-motion';
import { HeartPulse, ShieldAlert, Zap, History, AlertTriangle } from '../ui/Icons';
import { slideUpVariants } from '../ui/animationVariants';
import { BusinessProcess, BcpDrill } from '../../types';

interface ContinuityStatsProps {
    processes: BusinessProcess[];
    drills: BcpDrill[];
}

export const ContinuityStats: React.FC<ContinuityStatsProps> = ({ processes, drills }) => {
    // Metrics
    const totalProcesses = processes.length;
    const criticalProcesses = processes.filter(p => p.priority === 'Critique').length;
    const testedProcesses = processes.filter(p => {
        if (!p.lastTestDate) return false;
        const lastTest = new Date(p.lastTestDate);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return lastTest > oneYearAgo;
    }).length;
    const coverageRate = totalProcesses > 0 ? (testedProcesses / totalProcesses) * 100 : 0;
    const overdueTests = totalProcesses - testedProcesses;
    const failedDrills = drills.filter(d => d.result === 'Échec').length;

    return (
        <motion.div variants={slideUpVariants} className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group mb-8 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 pointer-events-none" />
            <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
            </div>

            {/* Global Score */}
            <div className="flex items-center gap-6 relative z-10">
                <div className="relative">
                    <svg className="w-24 h-24 transform -rotate-90" style={{ overflow: 'visible' }}>
                        <circle
                            className="text-slate-100 dark:text-slate-800"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            r="44"
                            cx="48"
                            cy="48"
                        />
                        <circle
                            className={`${coverageRate >= 80 ? 'text-emerald-500' : coverageRate >= 50 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                            strokeWidth="8"
                            strokeDasharray={276}
                            strokeDashoffset={276 - (276 * coverageRate) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="44"
                            cx="48"
                            cy="48"
                        />
                    </svg>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                        <span className="text-xl font-black text-slate-900 dark:text-white">{Math.round(coverageRate)}%</span>
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Couverture des Tests</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[200px]">
                        Pourcentage de processus testés au cours des 12 derniers mois.
                    </p>
                </div>
            </div>

            {/* Key Metrics Breakdown */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:border-l sm:border-r border-slate-200 dark:border-white/10 sm:px-6 sm:mx-2">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <HeartPulse className="h-4 w-4 text-slate-500" />
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</div>
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white">{totalProcesses}</div>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <ShieldAlert className="h-4 w-4 text-slate-500" />
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Critiques</div>
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white">{criticalProcesses}</div>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-slate-500" />
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Exercices</div>
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white">{drills.length}</div>
                </div>
            </div>

            {/* Alerts/Status */}
            <div className="flex flex-col gap-3 min-w-[180px]">
                <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Tests Expirés</span>
                    </div>
                    <span className="text-sm font-black text-amber-700 dark:text-amber-400">{overdueTests}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="text-xs font-bold text-red-700 dark:text-red-300">Échecs</span>
                    </div>
                    <span className="text-sm font-black text-red-700 dark:text-red-400">{failedDrills}</span>
                </div>
            </div>
        </motion.div>
    );
};
