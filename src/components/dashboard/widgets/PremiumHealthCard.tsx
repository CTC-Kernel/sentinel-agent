/**
 * PremiumHealthCard.tsx
 * Premium consolidated health indicator card for the main dashboard
 * Uses Recharts with premium styling and animations
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    RadialBarChart,
    RadialBar,
    ResponsiveContainer
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { SENTINEL_PALETTE } from '../../../theme/chartTheme';
import {
    ShieldCheck,
    AlertTriangle,
    Activity,
    ArrowRight,
    Zap
} from '../../ui/Icons';
import { cn } from '../../../lib/utils';
import { useLocale } from '@/hooks/useLocale';

interface PremiumHealthCardProps {
    stats: {
        totalRisks: number;
        highRisks: number;
        criticalRisks: number;
        compliance: number;
        financialRisk: number;
        assetValue: number;
    };
    complianceScore: number;
    activeIncidentsCount: number;
    loading?: boolean;
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

export const PremiumHealthCard: React.FC<PremiumHealthCardProps> = ({
    stats,
    complianceScore,
    activeIncidentsCount,
    loading = false
}) => {
    const navigate = useNavigate();
    const { config } = useLocale();
    const effectiveCompliance = complianceScore ?? stats.compliance ?? 0;

    // Compliance gauge data
    const complianceGaugeData = useMemo(() => [{
        name: 'Conformité',
        value: effectiveCompliance,
        fill: effectiveCompliance >= 80 ? SENTINEL_PALETTE.success :
              effectiveCompliance >= 50 ? SENTINEL_PALETTE.warning : SENTINEL_PALETTE.danger
    }], [effectiveCompliance]);

    // Risk distribution for pie chart
    const riskDistribution = useMemo(() => [
        { name: 'Critiques', value: stats.criticalRisks, fill: SENTINEL_PALETTE.danger },
        { name: 'Élevés', value: stats.highRisks - stats.criticalRisks, fill: SENTINEL_PALETTE.warning },
        { name: 'Autres', value: Math.max(0, stats.totalRisks - stats.highRisks), fill: SENTINEL_PALETTE.info }
    ].filter(d => d.value > 0), [stats]);

    if (loading) {
        return (
            <div className="glass-premium p-6 rounded-4xl border border-border/40 dark:border-border/40 animate-pulse">
                <div className="flex items-center gap-6">
                    <div className="w-32 h-32 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 space-y-4">
                        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-48" />
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64" />
                        <div className="grid grid-cols-3 gap-4">
                            {[...Array(3)].map((_, i) => (
                                <div key={i || 'unknown'} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-3xl" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-premium p-6 rounded-4xl border border-border/40 dark:border-border/40 relative overflow-hidden"
        >
            <TechCorners />

            {/* SVG Definitions */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id="healthGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
            </svg>

            {/* Background gradient effects */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/20 dark:bg-brand-400/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-success-bg rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-3xl bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/20">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                                Santé Globale
                            </h3>
                            <p className="text-xs text-slate-600">
                                Indicateurs de performance clés
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2" />
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-6">
                    {/* Main Compliance Gauge */}
                    <div
                        className="flex-shrink-0 relative cursor-pointer group"
                        onClick={() => navigate('/compliance')}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate('/compliance');
                            }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label="Voir la compliance détaillée"
                    >
                        <div className="relative w-36 h-36">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={undefined}>
                                <RadialBarChart
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="70%"
                                    outerRadius="100%"
                                    barSize={12}
                                    data={complianceGaugeData}
                                    startAngle={180}
                                    endAngle={-180}
                                >
                                    <RadialBar
                                        background={{ fill: 'hsl(var(--muted))' }}
                                        dataKey="value"
                                        cornerRadius={10}
                                        style={{ filter: 'url(#healthGlow)' }}
                                    />
                                </RadialBarChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-slate-900 dark:text-white">
                                    {effectiveCompliance}%
                                </span>
                                <span className="text-[11px] text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                    Conformité
                                </span>
                            </div>
                        </div>
                        <div className="absolute inset-0 rounded-full bg-transparent group-hover:bg-brand-50 transition-colors" />
                    </div>

                    {/* Divider */}
                    <div className="hidden lg:block w-px h-28 bg-gradient-to-b from-transparent via-slate-200 dark:via-white/10 to-transparent" />

                    {/* Stats Grid */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                        {/* Risks Card */}
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40 dark:border-border/40 cursor-pointer group"
                            onClick={() => navigate('/risks')}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-warning-bg rounded-3xl">
                                    <AlertTriangle className="w-4 h-4 text-warning-500" />
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-70 transition-opacity" />
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">
                                {stats.totalRisks}
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider mt-0.5">
                                Risques
                            </div>
                            {stats.criticalRisks > 0 && (
                                <div className="mt-2 flex items-center gap-1.5">
                                    <span className="flex h-2 w-2">
                                        <span className="animate-ping absolute h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                    <span className="text-[11px] text-red-600 dark:text-red-400 font-bold">
                                        {stats.criticalRisks} critiques
                                    </span>
                                </div>
                            )}
                            <div className="mt-2 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (stats.criticalRisks / Math.max(stats.totalRisks, 1)) * 100)}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    className="h-full bg-red-500 rounded-full"
                                />
                            </div>
                        </motion.div>

                        {/* Incidents Card */}
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40 dark:border-border/40 cursor-pointer group"
                            onClick={() => navigate('/incidents')}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={cn(
                                    "p-2 rounded-3xl",
                                    activeIncidentsCount > 0 ? "bg-red-50" : "bg-success-bg"
                                )}>
                                    <Zap className={cn(
                                        "w-4 h-4",
                                        activeIncidentsCount > 0 ? "text-red-500" : "text-success-500"
                                    )} />
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-70 transition-opacity" />
                            </div>
                            <div className={cn(
                                "text-2xl font-black",
                                activeIncidentsCount > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white"
                            )}>
                                {activeIncidentsCount}
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider mt-0.5">
                                Incidents Actifs
                            </div>
                            {activeIncidentsCount > 0 && (
                                <div className="mt-2 flex items-center gap-1.5">
                                    <span className="flex h-2 w-2">
                                        <span className="animate-ping absolute h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                    <span className="text-[11px] text-red-600 dark:text-red-400 font-bold">
                                        Action requise
                                    </span>
                                </div>
                            )}
                            {activeIncidentsCount === 0 && (
                                <div className="mt-2 flex items-center gap-1.5">
                                    <span className="rounded-full h-2 w-2 bg-success-500"></span>
                                    <span className="text-[11px] text-success-600 dark:text-success-400 font-bold">
                                        Aucun incident
                                    </span>
                                </div>
                            )}
                        </motion.div>

                        {/* Financial Exposure Card */}
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="p-4 bg-white/50 dark:bg-white/5 rounded-2xl border border-border/40 dark:border-border/40 cursor-pointer group"
                            onClick={() => navigate('/risks')}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-2 bg-info-bg rounded-3xl">
                                    <ShieldCheck className="w-4 h-4 text-info-500" />
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-70 transition-opacity" />
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white truncate" title={new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: 'EUR' }).format(stats.financialRisk)}>
                                {new Intl.NumberFormat(config.intlLocale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, notation: "compact" }).format(stats.financialRisk)}
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider mt-0.5">
                                Exposition
                            </div>
                            <div className="mt-2 text-[11px] text-info-600 dark:text-info-400 font-medium">
                                Estimation basée sur les risques
                            </div>
                            <div className="mt-1 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, Math.max(5, (stats.financialRisk / (stats.assetValue || 1)) * 100))}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                    className="h-full bg-info-500 rounded-full"
                                />
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Bottom Risk Distribution */}
                {riskDistribution.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-border/40 dark:border-white/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                                    Distribution des risques
                                </span>
                                <div className="flex items-center gap-3">
                                    {riskDistribution.map((item) => (
                                        <div key={item.name || 'unknown'} className="flex items-center gap-1.5 text-[11px]">
                                            <div
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: item.fill }}
                                            />
                                            <span className="text-slate-600 dark:text-slate-600">{item.name}: {item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 max-w-[200px] h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                                {riskDistribution.map((item, index) => (
                                    <motion.div
                                        key={item.name || 'unknown'}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(item.value / stats.totalRisks) * 100}%` }}
                                        transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
                                        className="h-full first:rounded-l-full last:rounded-r-full"
                                        style={{ backgroundColor: item.fill }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
};
