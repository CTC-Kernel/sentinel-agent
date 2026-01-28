/**
 * RiskHeatmapWidget.tsx
 * Premium risk heatmap visualization with enhanced styling
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useFirestoreCollection } from '../../../hooks/useFirestore';
import { Risk } from '../../../types';
import { where } from 'firebase/firestore';
import { useStore } from '../../../store';
import { Loader2, AlertTriangle, ArrowRight, Target, ShieldCheck } from '../../ui/Icons';
import { cn } from '../../../lib/utils';
import { EmptyState } from '../../ui/EmptyState';

interface RiskHeatmapWidgetProps {
    navigate?: (path: string) => void;
    t?: (key: string) => string;
}

export const RiskHeatmapWidget: React.FC<RiskHeatmapWidgetProps> = ({ navigate, t = (k) => k }) => {
    const { user } = useStore();

    // Fetch risks directly within the widget
    const { data: risks, loading } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { enabled: !!user?.organizationId }
    );

    const { matrixData, stats } = useMemo(() => {
        const matrix = Array(5).fill(0).map(() => Array(5).fill(0));
        let critical = 0;
        let high = 0;
        let medium = 0;
        let low = 0;

        risks.forEach(risk => {
            const p = Math.min(Math.max(risk.residualProbability || risk.probability || 1, 1), 5) - 1;
            const i = Math.min(Math.max(risk.residualImpact || risk.impact || 1, 1), 5) - 1;
            matrix[4 - p][i]++; // Invert Y axis for visualization (5 top)

            const score = (5 - (4 - p)) * (i + 1);
            if (score >= 15) critical++;
            else if (score >= 10) high++;
            else if (score >= 5) medium++;
            else low++;
        });

        return { matrixData: matrix, stats: { critical, high, medium, low, total: risks.length } };
    }, [risks]);

    const getCellStyle = (rowIndex: number, colIndex: number, count: number) => {
        const score = (5 - rowIndex) * (colIndex + 1); // 5-rowIndex because row 0 is probability 5

        let bgColor = '';
        let glowColor = '';

        if (score >= 15) {
            bgColor = 'bg-gradient-to-br from-red-500 to-red-600';
            glowColor = 'shadow-red-500/40';
        } else if (score >= 10) {
            bgColor = 'bg-gradient-to-br from-orange-400 to-orange-500';
            glowColor = 'shadow-orange-500/30';
        } else if (score >= 5) {
            bgColor = 'bg-gradient-to-br from-yellow-400 to-amber-500';
            glowColor = 'shadow-amber-500/30';
        } else {
            bgColor = 'bg-gradient-to-br from-emerald-400 to-emerald-500';
            glowColor = 'shadow-emerald-500/30';
        }

        return {
            bgColor,
            glowColor,
            hasData: count > 0
        };
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center min-h-[300px]">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    // Empty state when no risks
    if (stats.total === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-premium h-full flex flex-col p-5 border border-border/40 dark:border-border/40 rounded-3xl shadow-sm relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />

                <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-white/5 relative z-10">
                    <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                        <div className="p-2 rounded-3xl bg-gradient-to-br from-warning-500 to-orange-600 shadow-sm shadow-warning-500/20">
                            <Target className="w-4 h-4 text-white" />
                        </div>
                        {t('dashboard.riskHeatmap')}
                    </h3>
                </div>

                <div className="flex-1 flex items-center justify-center relative z-10">
                    <EmptyState
                        icon={ShieldCheck}
                        title="Aucun risque identifié"
                        description="Commencez par identifier vos premiers risques pour visualiser la matrice de criticité."
                        actionLabel="Créer un risque"
                        onAction={() => navigate && navigate('/risks')}
                        semantic="success"
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
            className="glass-premium h-full flex flex-col p-5 border border-border/40 dark:border-border/40 rounded-3xl shadow-sm relative overflow-hidden"
        >
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-warning-bg rounded-full blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border/40 dark:border-white/5 relative z-10">
                <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <div className="p-2 rounded-3xl bg-gradient-to-br from-warning-500 to-orange-600 shadow-sm shadow-warning-500/20">
                        <Target className="w-4 h-4 text-white" />
                    </div>
                    {t('dashboard.riskHeatmap')}
                </h3>
                <button
                    onClick={() => navigate && navigate('/risks')}
                    className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-3xl bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all border border-white/50 dark:border-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 group/btn"
                >
                    Voir tout
                    <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover/btn:opacity-70 group-hover/btn:translate-x-0 transition-all" />
                </button>
            </div>

            {/* Stats Summary */}
            <div className="flex items-center gap-3 py-3 relative z-10">
                <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-red-500 to-red-600 shadow-sm" />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{stats.critical} critiques</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 shadow-sm" />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{stats.high} élevés</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-sm" />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{stats.medium} moyens</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-sm" />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{stats.low} faibles</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-lg font-black text-slate-900 dark:text-white">{stats.total}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-300 uppercase tracking-wider">Total</div>
                </div>
            </div>

            {/* Heatmap Grid */}
            <div className="flex-1 flex flex-col justify-center items-center relative z-10 py-2">
                <div className="grid grid-cols-[auto_1fr] gap-3 w-full max-w-[380px]">
                    {/* Y Axis Label */}
                    <div className="flex items-center justify-center">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider -rotate-90 whitespace-nowrap">
                            {t('risks.probability')}
                        </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {/* Y Axis Numbers + Matrix */}
                        <div className="flex gap-1.5">
                            {/* Y Axis Numbers */}
                            <div className="flex flex-col justify-between pr-1">
                                {[5, 4, 3, 2, 1].map(num => (
                                    <div key={num} className="h-10 flex items-center justify-center">
                                        <span className="text-[11px] font-bold text-slate-400">{num}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Matrix */}
                            <div className="flex-1 grid grid-rows-5 gap-1.5">
                                {matrixData.map((row, rowIndex) => (
                                    <div key={rowIndex} className="grid grid-cols-5 gap-1.5 h-10">
                                        {row.map((count, colIndex) => {
                                            const { bgColor, glowColor, hasData } = getCellStyle(rowIndex, colIndex, count);
                                            return (
                                                <motion.div
                                                    key={`${rowIndex}-${colIndex}`}
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{
                                                        delay: (rowIndex * 5 + colIndex) * 0.02,
                                                        duration: 0.3,
                                                        ease: [0.16, 1, 0.3, 1]
                                                    }}
                                                    whileHover={hasData ? { scale: 1.15, zIndex: 10 } : {}}
                                                    className={cn(
                                                        "rounded-lg flex items-center justify-center text-xs font-black cursor-pointer transition-all duration-200",
                                                        bgColor,
                                                        hasData ? `text-white shadow-md ${glowColor} hover:shadow-lg` : "text-white/60 opacity-20"
                                                    )}
                                                    onClick={() => hasData && navigate && navigate('/risks')}
                                                    title={`Prob: ${5 - rowIndex}, Impact: ${colIndex + 1} - ${count} risque(s)`}
                                                >
                                                    {count > 0 && count}
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* X Axis Numbers */}
                        <div className="flex gap-1.5 pl-6">
                            {[1, 2, 3, 4, 5].map(num => (
                                <div key={num} className="flex-1 flex items-center justify-center">
                                    <span className="text-[11px] font-bold text-slate-400">{num}</span>
                                </div>
                            ))}
                        </div>

                        {/* X Axis Label */}
                        <div className="flex items-center justify-center pt-1">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                                {t('risks.impact')}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Critical Alert */}
            {stats.critical > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-auto pt-3 border-t border-border/40 dark:border-white/5 relative z-10"
                >
                    <div className="flex items-center gap-3 p-2.5 rounded-3xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                        <div className="p-1.5 rounded-lg bg-red-50">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-red-700 dark:text-red-300">
                                {stats.critical} risque{stats.critical > 1 ? 's' : ''} critique{stats.critical > 1 ? 's' : ''} nécessite{stats.critical > 1 ? 'nt' : ''} une attention immédiate
                            </p>
                        </div>
                        <button
                            onClick={() => navigate && navigate('/risks?filter=critical')}
                            className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        >
                            Voir
                        </button>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
};
