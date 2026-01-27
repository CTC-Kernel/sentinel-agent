/**
 * ComplianceStatsWidget - Premium compliance stats in single card design
 * Matches the premium design pattern used across the app
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    RadialBarChart,
    RadialBar,
    ResponsiveContainer
} from 'recharts';
import { SENTINEL_PALETTE } from '../../theme/chartTheme';
import { Control, Framework } from '../../types';
import {
    TrendingUp,
    CheckCircle2,
    AlertTriangle,
    Paperclip,
    ShieldCheck,
    Activity
} from '../ui/Icons';
import { cn } from '../../lib/utils';

interface ComplianceStatsWidgetProps {
    controls: Control[];
    currentFramework: Framework;
}

// Tech corner decoration
const TechCorners: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cn("pointer-events-none", className)}>
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-brand-300 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-brand-300 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-brand-300 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-brand-300 rounded-br-lg" />
    </div>
);

export const ComplianceStatsWidget: React.FC<ComplianceStatsWidgetProps> = ({ controls, currentFramework }) => {
    const stats = useMemo(() => {
        const implementedControls = controls.filter(c => c.status === 'Implémenté').length;
        const partialControls = controls.filter(c => c.status === 'Partiel').length;
        // Actionable = Not N/A and Not Excluded
        const actionableControls = controls.filter(c => c.status !== 'Non applicable' && c.status !== 'Exclu').length;
        const totalControls = controls.length;

        // Global Score: Implemented (100%) + Partial (50%) over Actionable
        const globalScore = actionableControls > 0
            ? Math.round(((implementedControls + (partialControls * 0.5)) / actionableControls) * 100)
            : 0;

        const evidenceCount = controls.reduce((acc, curr) => acc + (curr.evidenceIds?.length || 0), 0);

        // Critical (or just missing evidence/high priority) - simplistic metric for now
        // Let's count "En cours" or "Non commencé" as 'In Progress/To Do'
        const todoControls = controls.filter(c => c.status === 'Non commencé' || c.status === 'En cours').length;

        return {
            totalControls,
            implementedControls,
            partialControls,
            actionableControls,
            globalScore,
            evidenceCount,
            todoControls
        };
    }, [controls]);

    // Gauge data
    const gaugeData = useMemo(() => [{
        name: 'Conformité',
        value: stats.globalScore,
        fill: stats.globalScore >= 80 ? SENTINEL_PALETTE.success :
              stats.globalScore >= 50 ? SENTINEL_PALETTE.warning : SENTINEL_PALETTE.danger
    }], [stats.globalScore]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-premium p-6 rounded-4xl border border-white/60 dark:border-white/10 relative overflow-hidden mb-6"
        >
            <TechCorners />

            {/* SVG Definitions */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id="complianceGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            </svg>

            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                {/* Gauge Section */}
                <div className="flex-shrink-0 flex items-center gap-4">
                    <div className="relative w-32 h-32">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart
                                cx="50%"
                                cy="50%"
                                innerRadius="70%"
                                outerRadius="100%"
                                barSize={10}
                                data={gaugeData}
                                startAngle={180}
                                endAngle={-180}
                            >
                                <RadialBar
                                    background={{ fill: 'hsl(var(--muted))' }}
                                    dataKey="value"
                                    cornerRadius={10}
                                    style={{ filter: 'url(#complianceGlow)' }}
                                />
                            </RadialBarChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">
                                {stats.globalScore}%
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                {currentFramework}
                            </span>
                        </div>
                    </div>
                    <div className="hidden sm:block">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-brand-500" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                Conformité
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[180px]">
                            {stats.globalScore >= 80 ? 'Excellent niveau de conformité' :
                             stats.globalScore >= 50 ? 'Progression en cours' : 'Attention requise'}
                        </p>
                    </div>
                </div>

                {/* Divider */}
                <div className="hidden lg:block w-px h-20 bg-gradient-to-b from-transparent via-slate-200 dark:via-white/10 to-transparent" />

                {/* Stats Grid */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Implemented Controls */}
                    <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/60 dark:border-white/10 group hover:scale-[1.02] transition-transform">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-success-bg rounded-xl">
                                <CheckCircle2 className="w-4 h-4 text-success-500" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {stats.implementedControls}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            Implémentés
                        </div>
                        <div className="mt-2 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(stats.implementedControls / Math.max(stats.actionableControls, 1)) * 100}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="h-full bg-success-500 rounded-full"
                            />
                        </div>
                    </div>

                    {/* To Do */}
                    <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/60 dark:border-white/10 group hover:scale-[1.02] transition-transform">
                        <div className="flex items-center justify-between mb-2">
                            <div className={cn(
                                "p-2 rounded-xl",
                                stats.todoControls > 0 ? "bg-warning-bg" : "bg-success-bg"
                            )}>
                                <AlertTriangle className={cn(
                                    "w-4 h-4",
                                    stats.todoControls > 0 ? "text-warning-500" : "text-success-500"
                                )} />
                            </div>
                            {stats.todoControls > 5 && (
                                <span className="flex h-2 w-2">
                                    <span className="animate-ping absolute h-2 w-2 rounded-full bg-warning-400 opacity-75"></span>
                                    <span className="relative rounded-full h-2 w-2 bg-warning-500"></span>
                                </span>
                            )}
                        </div>
                        <div className={cn(
                            "text-2xl font-black",
                            stats.todoControls > 0 ? "text-warning-600 dark:text-warning-400" : "text-slate-900 dark:text-white"
                        )}>
                            {stats.todoControls}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            À traiter
                        </div>
                        <div className="mt-2 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(stats.todoControls / Math.max(stats.actionableControls, 1)) * 100}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className={cn(
                                    "h-full rounded-full",
                                    stats.todoControls > 0 ? "bg-warning-500" : "bg-success-500"
                                )}
                            />
                        </div>
                    </div>

                    {/* Evidence Count */}
                    <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/60 dark:border-white/10 group hover:scale-[1.02] transition-transform">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-info-bg rounded-xl">
                                <Paperclip className="w-4 h-4 text-info-500" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {stats.evidenceCount}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            Preuves
                        </div>
                        <div className="mt-2 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min((stats.evidenceCount / Math.max(stats.totalControls * 2, 1)) * 100, 100)}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="h-full bg-info-500 rounded-full"
                            />
                        </div>
                    </div>

                    {/* Total Scope */}
                    <div className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-white/60 dark:border-white/10 group hover:scale-[1.02] transition-transform">
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-brand-50 rounded-xl">
                                <ShieldCheck className="w-4 h-4 text-brand-500" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {stats.actionableControls}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            Périmètre
                        </div>
                        <div className="mt-2 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="h-full bg-brand-500 rounded-full"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom activity indicator */}
            <div className="mt-4 pt-4 border-t border-white/60 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Activity className="w-3.5 h-3.5" />
                    <span>{stats.partialControls} partiels • {stats.totalControls - stats.actionableControls} exclus/N/A</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[11px]">
                        <div className="w-2 h-2 rounded-full bg-success-500" />
                        <span className="text-slate-500">Implémentés</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                        <div className="w-2 h-2 rounded-full bg-warning-500" />
                        <span className="text-slate-500">À traiter</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                        <div className="w-2 h-2 rounded-full bg-brand-500" />
                        <span className="text-slate-500">Périmètre</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
