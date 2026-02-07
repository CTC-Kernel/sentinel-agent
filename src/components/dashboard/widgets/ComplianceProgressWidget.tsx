/**
 * ComplianceProgressWidget.tsx
 * Premium compliance progress widget with Recharts visualization
 */

import React, { useId, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    PieChart,
    Pie,
    Cell,
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
import { CONTROL_STATUS, PARTIAL_CONTROL_WEIGHT } from '../../../constants/complianceConfig';

interface ComplianceProgressWidgetProps {
    navigate?: (path: string) => void;
    t?: (key: string) => string;
}

export const ComplianceProgressWidget: React.FC<ComplianceProgressWidgetProps> = ({ navigate }) => {
    const uid = useId();
    const complianceGlowId = `complianceGlow-${uid}`;
    const { user } = useStore();

    const { data: controls, loading } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId || '')],
        { enabled: !!user?.organizationId }
    );

    const stats = useMemo(() => {
        const totalControls = controls.length;
        const implementedControls = controls.filter(c => c.status === CONTROL_STATUS.IMPLEMENTED).length;
        const partialControls = controls.filter(c => c.status === CONTROL_STATUS.PARTIAL).length;
        const notImplementedControls = controls.filter(c => c.status === CONTROL_STATUS.NOT_STARTED || !c.status).length;
        const actionableControls = controls.filter(c =>
            c.status !== CONTROL_STATUS.NOT_APPLICABLE && c.status !== CONTROL_STATUS.EXCLUDED
        ).length;
        const complianceRate = actionableControls > 0
            ? Math.round(((implementedControls + (partialControls * PARTIAL_CONTROL_WEIGHT)) / actionableControls) * 100)
            : 100;

        return {
            totalControls,
            implementedControls,
            inProgressControls: partialControls,
            notImplementedControls,
            actionableControls,
            complianceRate
        };
    }, [controls]);

    // Gauge data
    const gaugeData = useMemo(() => [{
        name: 'Conformité',
        value: stats.complianceRate,
        fill: stats.complianceRate >= 80 ? SENTINEL_PALETTE.success :
            stats.complianceRate >= 50 ? SENTINEL_PALETTE.warning : SENTINEL_PALETTE.danger
    }], [stats.complianceRate]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    // Empty state when no controls
    if (stats.totalControls === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col p-5 bg-[var(--glass-bg)] backdrop-blur-xl rounded-xl border border-border/40 shadow-sm relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none" />

                <div className="flex items-center justify-between pb-4 border-b border-border/40 relative z-decorator">
                    <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-success to-success/80 shadow-sm shadow-success/20">
                            <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                        Conformité
                    </h3>
                </div>

                <div className="flex-1 flex items-center justify-center relative z-decorator">
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
            className="h-full flex flex-col p-5 bg-[var(--glass-bg)] backdrop-blur-xl rounded-xl border border-border/40 shadow-sm relative overflow-hidden group hover:shadow-apple transition-all duration-normal ease-apple"
        >
            {/* SVG Definitions */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id={complianceGlowId} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            </svg>

            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 dark:from-white/5 to-transparent pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-success-bg rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border/40 relative z-decorator">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-success to-success/80 shadow-sm shadow-success/20">
                        <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                    Conformité
                </h3>
                <button
                    onClick={() => navigate && navigate('/compliance')}
                    className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-background/50 hover:bg-background/80 text-muted-foreground hover:text-foreground transition-all border border-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group/btn"
                >
                    Voir tout
                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/btn:opacity-70 group-hover/btn:translate-x-0 transition-all" />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex items-center gap-4 flex-1 relative z-decorator py-4">
                {/* Gauge */}
                <div
                    className="relative flex-shrink-0 cursor-pointer group/chart"
                    onClick={() => navigate && navigate('/compliance')}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            if (navigate) {
                                navigate('/compliance');
                            }
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Voir la compliance détaillée"
                >
                    <div className="w-28 h-28">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={undefined}>
                            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                <Pie
                                    data={gaugeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="70%"
                                    outerRadius="100%"
                                    dataKey="value"
                                    stroke="none"
                                    paddingAngle={0}
                                    cornerRadius={0}
                                >
                                    <Cell
                                        fill={gaugeData[0].fill}
                                        style={{ filter: `url(#${complianceGlowId})` }}
                                    />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-foreground">
                                {stats.complianceRate}%
                            </span>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">
                                Score
                            </span>
                        </div>
                    </div>
                    <div className="absolute inset-0 rounded-full bg-success-500/0 group-hover/chart:bg-success-bg transition-colors" />
                </div>

                {/* Stats */}
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-foreground truncate">Score Global</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        Contrôles implémentés sur {stats.totalControls} au total
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <div className={cn(
                            "text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 border",
                            stats.complianceRate >= 80
                                ? "bg-success-bg text-success-600 dark:text-success-400 border-success-500/20"
                                : stats.complianceRate >= 50
                                    ? "bg-warning-bg text-warning-600 dark:text-warning-400 border-warning-500/20"
                                    : "bg-red-50 text-red-600 dark:text-red-400 border-red-500/20"
                        )}>
                            <TrendingUp className="w-3 h-3" />
                            {stats.complianceRate >= 80 ? 'Excellent' :
                                stats.complianceRate >= 50 ? 'En progrès' : 'À améliorer'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Distribution Mini Stats */}
            <div className="grid grid-cols-3 gap-2 mt-auto relative z-decorator">
                <div className="p-2 rounded-xl bg-background/40 border border-border/40">
                    <div className="flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3 h-3 text-success-500" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Impl.</span>
                    </div>
                    <div className="text-lg font-black text-foreground">
                        {stats.implementedControls}
                    </div>
                </div>
                <div className="p-2 rounded-xl bg-background/40 border border-border/40">
                    <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3 h-3 text-warning-500" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Partiels</span>
                    </div>
                    <div className="text-lg font-black text-foreground">
                        {stats.inProgressControls}
                    </div>
                </div>
                <div className="p-2 rounded-xl bg-background/40 border border-border/40">
                    <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Non impl.</span>
                    </div>
                    <div className="text-lg font-black text-foreground">
                        {stats.notImplementedControls}
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 space-y-1.5 relative z-decorator">
                <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-bold uppercase tracking-wider text-xs">Progression</span>
                    <span className="font-bold text-foreground">{stats.implementedControls}/{stats.totalControls}</span>
                </div>
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden flex">
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
