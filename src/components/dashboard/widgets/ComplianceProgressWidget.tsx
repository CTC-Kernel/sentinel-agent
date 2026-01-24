/**
 * ComplianceProgressWidget.tsx
 * Premium compliance progress widget with Recharts visualization
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    RadialBarChart,
    RadialBar,
    ResponsiveContainer
} from 'recharts';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Control } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { TrendingUp, Loader2, ShieldCheck, ArrowRight, CheckCircle2, Clock, AlertTriangle, ClipboardList } from '../../ui/Icons';
import { SENTINEL_PALETTE } from '../../../theme/chartTheme';
import { cn } from '../../../lib/utils';
import { EmptyState } from '../../ui/EmptyState';

interface ComplianceProgressWidgetProps {
    navigate?: (path: string) => void;
    t?: (key: string) => string;
}

export const ComplianceProgressWidget: React.FC<ComplianceProgressWidgetProps> = ({ navigate }) => {
    const { user } = useStore();

    const { data: controls, loading } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const stats = useMemo(() => {
        const totalControls = controls.length;
        const implementedControls = controls.filter(c => c.status === 'Implémenté').length;
        const inProgressControls = controls.filter(c => c.status === 'Partiel').length;
        const notImplementedControls = controls.filter(c => c.status === 'Non Implémenté' || !c.status).length;
        const complianceRate = totalControls > 0 ? Math.round((implementedControls / totalControls) * 100) : 0;

        return {
            totalControls,
            implementedControls,
            inProgressControls,
            notImplementedControls,
            complianceRate
        };
    }, [controls]);

    // Gauge data for radial bar
    const gaugeData = useMemo(() => [{
        name: 'Conformité',
        value: stats.complianceRate,
        fill: stats.complianceRate >= 80 ? SENTINEL_PALETTE.success :
              stats.complianceRate >= 50 ? SENTINEL_PALETTE.warning : SENTINEL_PALETTE.danger
    }], [stats.complianceRate]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    // Empty state when no controls
    if (stats.totalControls === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col p-5 glass-premium rounded-3xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5 relative z-10">
                    <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-success-500 to-emerald-600 shadow-sm shadow-success-500/20">
                            <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                        Conformité
                    </h3>
                </div>

                <div className="flex-1 flex items-center justify-center relative z-10">
                    <EmptyState
                        icon={ClipboardList}
                        title="Aucun contrôle défini"
                        description="Importez un référentiel de conformité pour commencer à suivre vos contrôles."
                        actionLabel="Gérer la conformité"
                        onAction={() => navigate && navigate('/compliance')}
                        semantic="info"
                        compact
                    />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex flex-col p-5 glass-premium rounded-3xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-apple transition-all duration-300"
        >
            {/* SVG Definitions */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id="complianceGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            </svg>

            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-success-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5 relative z-10">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-success-500 to-emerald-600 shadow-sm shadow-success-500/20">
                        <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                    Conformité
                </h3>
                <button
                    onClick={() => navigate && navigate('/compliance')}
                    className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all border border-white/50 dark:border-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 group/btn"
                >
                    Voir tout
                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex items-center gap-4 flex-1 relative z-10 py-4">
                {/* Gauge */}
                <div
                    className="relative flex-shrink-0 cursor-pointer group/chart"
                    onClick={() => navigate && navigate('/compliance')}
                >
                    <div className="w-28 h-28">
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
                                {stats.complianceRate}%
                            </span>
                            <span className="text-[9px] text-slate-500 uppercase tracking-wider">
                                Score
                            </span>
                        </div>
                    </div>
                    <div className="absolute inset-0 rounded-full bg-success-500/0 group-hover/chart:bg-success-500/5 transition-colors" />
                </div>

                {/* Stats */}
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-foreground truncate">Score Global</h4>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                        Contrôles implémentés sur {stats.totalControls} au total
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 border",
                            stats.complianceRate >= 80
                                ? "bg-success-500/10 text-success-600 dark:text-success-400 border-success-500/20"
                                : stats.complianceRate >= 50
                                ? "bg-warning-500/10 text-warning-600 dark:text-warning-400 border-warning-500/20"
                                : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                        )}>
                            <TrendingUp className="w-3 h-3" />
                            {stats.complianceRate >= 80 ? 'Excellent' :
                             stats.complianceRate >= 50 ? 'En progrès' : 'À améliorer'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Distribution Mini Stats */}
            <div className="grid grid-cols-3 gap-2 mt-auto relative z-10">
                <div className="p-2 rounded-xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10">
                    <div className="flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3 h-3 text-success-500" />
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Impl.</span>
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                        {stats.implementedControls}
                    </div>
                </div>
                <div className="p-2 rounded-xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3 h-3 text-warning-500" />
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Partiels</span>
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                        {stats.inProgressControls}
                    </div>
                </div>
                <div className="p-2 rounded-xl bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10">
                    <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3 h-3 text-slate-400" />
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Non impl.</span>
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                        {stats.notImplementedControls}
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 space-y-1.5 relative z-10">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-bold uppercase tracking-wider text-[10px]">Progression</span>
                    <span className="font-bold text-foreground">{stats.implementedControls}/{stats.totalControls}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.implementedControls / (stats.totalControls || 1)) * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-success-500 to-emerald-500 rounded-l-full"
                    />
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.inProgressControls / (stats.totalControls || 1)) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-warning-400 to-warning-500"
                    />
                </div>
            </div>
        </motion.div>
    );
};
