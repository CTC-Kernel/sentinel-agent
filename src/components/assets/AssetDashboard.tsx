import React, { useState, useMemo } from 'react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyChartState } from '../ui/EmptyChartState';
import { Asset, Criticality } from '../../types';
import { Server, Wrench, Euro, ShieldAlert, TrendingUp, Box, Layers } from '../ui/Icons';
import { motion } from 'framer-motion';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    RadialBarChart, RadialBar, ComposedChart, Area, Line
} from 'recharts';
import { SEVERITY_COLORS, SENTINEL_PALETTE } from '../../theme/chartTheme';

interface AssetDashboardProps {
    assets: Asset[];
    onFilterChange?: (filter: { type: 'criticality' | 'status' | 'type', value: string } | null) => void;
    loading?: boolean;
}

// Premium activeShape for interactive pie
const renderActiveShape = (props: {
    cx: number; cy: number; innerRadius: number; outerRadius: number;
    startAngle: number; endAngle: number; fill: string;
    payload: { name: string; value: number }; percent: number;
}) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
    return (
        <g>
            <defs>
                <filter id="assetPieGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            <Pie
                cx={cx}
                cy={cy}
                innerRadius={innerRadius - 6}
                outerRadius={outerRadius + 10}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                stroke="none"
                style={{ filter: 'url(#assetPieGlow)' }}
                data={[{ value: 1 }]}
                dataKey="value"
                isAnimationActive={false}
            >
                <Cell fill={fill} />
            </Pie>
            <text x={cx} y={cy - 8} textAnchor="middle" className="fill-foreground font-black text-base">
                {payload.name}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground text-sm font-mono">
                {payload.value} ({(percent * 100).toFixed(0)}%)
            </text>
        </g>
    );
};

export const AssetDashboard: React.FC<AssetDashboardProps> = ({ assets, onFilterChange, loading }) => {
    const [activeCriticalityIndex, setActiveCriticalityIndex] = useState<number | null>(null);
    const [activeScopeIndex, setActiveScopeIndex] = useState<number | null>(null);

    // Calculate metrics
    const metrics = useMemo(() => {
        const total = assets.length;
        const critical = assets.filter(a =>
            a.confidentiality === Criticality.CRITICAL ||
            a.integrity === Criticality.CRITICAL ||
            a.availability === Criticality.CRITICAL
        ).length;

        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);
        const maintenance = assets.filter(a => a.nextMaintenance && new Date(a.nextMaintenance) < nextMonth).length;

        const tValue = assets.reduce((acc, a) => acc + (a.purchasePrice || 0), 0);
        const cValue = assets.reduce((acc, a) => acc + (a.currentValue || 0), 0);
        const dep = tValue > 0 ? ((tValue - cValue) / tValue * 100) : 0;
        const healthScore = Math.round(100 - dep);

        const newAssets = assets.filter(a => a.purchaseDate && (new Date().getTime() - new Date(a.purchaseDate).getTime()) < 2592000000).length;

        return { total, critical, maintenance, totalValue: tValue, currentValue: cValue, depreciation: dep, healthScore, newAssets };
    }, [assets]);

    // Distribution by Type
    const typeChartData = useMemo(() => {
        const typeData = assets.reduce((acc, asset) => {
            const type = asset.type || 'Autre';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(typeData)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [assets]);

    // Distribution by Criticality
    const distributionData = useMemo(() => {
        const getAssetCriticality = (a: Asset) => {
            if (a.confidentiality === Criticality.CRITICAL || a.integrity === Criticality.CRITICAL || a.availability === Criticality.CRITICAL) return 'Critique';
            if (a.confidentiality === Criticality.HIGH || a.integrity === Criticality.HIGH || a.availability === Criticality.HIGH) return 'Élevé';
            if (a.confidentiality === Criticality.MEDIUM || a.integrity === Criticality.MEDIUM || a.availability === Criticality.MEDIUM) return 'Moyen';
            return 'Faible';
        };

        const criticalityCounts = { 'Critique': 0, 'Élevé': 0, 'Moyen': 0, 'Faible': 0 };
        assets.forEach(a => {
            const crit = getAssetCriticality(a);
            if (crit in criticalityCounts) criticalityCounts[crit as keyof typeof criticalityCounts]++;
        });

        return [
            { name: 'Critique', value: criticalityCounts['Critique'], color: SEVERITY_COLORS.critical },
            { name: 'Élevé', value: criticalityCounts['Élevé'], color: SEVERITY_COLORS.high },
            { name: 'Moyen', value: criticalityCounts['Moyen'], color: SEVERITY_COLORS.medium },
            { name: 'Faible', value: criticalityCounts['Faible'], color: SEVERITY_COLORS.low }
        ].filter(d => d.value > 0);
    }, [assets]);

    // Distribution by Scope
    const { scopeChartData, SCOPE_COLORS } = useMemo(() => {
        const scopeData = assets.reduce((acc, asset) => {
            if (asset.scope && asset.scope.length > 0) {
                asset.scope.forEach(s => {
                    acc[s] = (acc[s] || 0) + 1;
                });
            } else {
                acc['Aucun'] = (acc['Aucun'] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const colors = [
            SENTINEL_PALETTE.primary,
            SENTINEL_PALETTE.secondary,
            '#ec4899',
            '#f43f5e',
            SENTINEL_PALETTE.success,
            '#6366f1',
            'hsl(var(--muted-foreground) / 0.55)'
        ];

        return {
            scopeChartData: Object.entries(scopeData).map(([name, value]) => ({ name, value })),
            SCOPE_COLORS: colors
        };
    }, [assets]);

    // Acquisition Trend (Last 12 Months)
    const acquisitionData = useMemo(() => {
        const months = new Array(12).fill(0).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - 11 + i);
            return { name: d.toLocaleString('default', { month: 'short' }), date: d, count: 0, value: 0, cumulative: 0 };
        });

        assets.forEach(a => {
            if (a.purchaseDate) {
                const pDate = new Date(a.purchaseDate);
                const monthIndex = months.findIndex(m =>
                    m.date.getMonth() === pDate.getMonth() &&
                    m.date.getFullYear() === pDate.getFullYear()
                );
                if (monthIndex !== -1) {
                    months[monthIndex].count++;
                    months[monthIndex].value += a.purchasePrice || 0;
                }
            }
        });

        // Calculate cumulative using reduce to avoid reassignment
        return months.reduce<Array<{ name: string; count: number; value: number; cumulative: number }>>((acc, m) => {
            const prevCumulative = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
            acc.push({ name: m.name, count: m.count, value: m.value, cumulative: prevCumulative + m.count });
            return acc;
        }, []);
    }, [assets]);

    // Health gauge data
    const healthGaugeData = [{ name: 'Santé', value: metrics.healthScore, fill: 'url(#healthGradient)' }];

    if (loading) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="glass-premium p-6 md:p-8 rounded-5xl h-48 animate-pulse bg-slate-100 dark:bg-slate-800/50" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="glass-premium p-4 sm:p-6 rounded-5xl h-[300px] animate-pulse bg-slate-100 dark:bg-slate-800/50" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* SVG Defs for Gradients and Filters */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id="assetGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="healthGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={metrics.healthScore >= 70 ? SENTINEL_PALETTE.success : metrics.healthScore >= 40 ? SENTINEL_PALETTE.warning : SEVERITY_COLORS.critical} />
                        <stop offset="100%" stopColor={metrics.healthScore >= 70 ? '#10b981' : metrics.healthScore >= 40 ? '#f59e0b' : '#ef4444'} />
                    </linearGradient>
                    <linearGradient id="assetAcqGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="assetAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.secondary} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.secondary} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="assetTypeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.secondary} stopOpacity={0.6} />
                    </linearGradient>
                </defs>
            </svg>

            {/* Hero Summary Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-premium p-6 md:p-8 rounded-5xl relative overflow-hidden"
            >
                {/* Tech Corners */}
                <svg className="absolute top-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute top-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                <div className="absolute inset-0 overflow-hidden rounded-5xl pointer-events-none">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -ml-20 -mb-20" />
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 relative z-10">
                    {/* Health Score Gauge */}
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <div className="h-[120px] w-[120px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="65%"
                                        outerRadius="100%"
                                        barSize={10}
                                        data={healthGaugeData}
                                        startAngle={180}
                                        endAngle={0}
                                    >
                                        <RadialBar
                                            background={{ fill: 'hsl(var(--muted) / 0.3)' }}
                                            dataKey="value"
                                            cornerRadius={10}
                                            style={{ filter: 'url(#assetGlow)' }}
                                        />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 text-center">
                                <div className={`text-3xl font-black bg-gradient-to-r ${metrics.healthScore >= 70 ? 'from-emerald-600 to-emerald-400' : metrics.healthScore >= 40 ? 'from-amber-600 to-amber-400' : 'from-red-600 to-red-400'} bg-clip-text text-transparent`}>
                                    {metrics.healthScore}%
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground mb-1 uppercase tracking-wide font-mono">Santé du Parc</h3>
                            <p className="text-xs text-muted-foreground max-w-[200px]">
                                Basé sur l'amortissement et la maintenance.
                            </p>
                        </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-border/50 px-6 mx-2">
                        <div
                            className="text-center cursor-pointer hover:opacity-80 transition-opacity group/metric"
                            onClick={() => onFilterChange?.(null)}
                            role="button"
                            tabIndex={0}
                        >
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <div className="p-2 bg-brand-500/10 rounded-xl group-hover/metric:scale-110 transition-transform">
                                    <Server className="h-4 w-4 text-brand-500" />
                                </div>
                            </div>
                            <div className="text-2xl font-black bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">{metrics.total}</div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total</div>
                        </div>
                        <div
                            className="text-center cursor-pointer hover:opacity-80 transition-opacity group/metric"
                            onClick={() => onFilterChange?.({ type: 'criticality', value: 'Critique' })}
                            role="button"
                            tabIndex={0}
                        >
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <div className="p-2 bg-red-500/10 rounded-xl group-hover/metric:scale-110 transition-transform">
                                    <ShieldAlert className="h-4 w-4 text-red-500" />
                                </div>
                            </div>
                            <div className="text-2xl font-black bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent">{metrics.critical}</div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Critiques</div>
                        </div>
                        <div className="text-center group/metric">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <div className="p-2 bg-emerald-500/10 rounded-xl group-hover/metric:scale-110 transition-transform">
                                    <Euro className="h-4 w-4 text-emerald-500" />
                                </div>
                            </div>
                            <div className="text-2xl font-black bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">{(metrics.currentValue / 1000).toFixed(0)}k€</div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Valeur</div>
                        </div>
                    </div>

                    {/* Alerts */}
                    <div className="flex flex-col gap-3 min-w-0 sm:min-w-[200px]">
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-500/20"
                        >
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-amber-500/20 rounded-lg">
                                    <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Maintenance</span>
                            </div>
                            <span className="text-lg font-black text-amber-700 dark:text-amber-400">{metrics.maintenance}</span>
                        </motion.div>
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-500/20"
                        >
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                                    <Box className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Nouveaux</span>
                            </div>
                            <span className="text-lg font-black text-blue-700 dark:text-blue-400">{metrics.newAssets}</span>
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Interactive Criticality Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-premium p-6 rounded-5xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-5xl" />
                    <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <div className="p-2 bg-orange-500/10 rounded-xl">
                            <ShieldAlert className="w-4 h-4 text-orange-500" />
                        </div>
                        Distribution par Criticité
                    </h4>
                    <div className="h-[280px]">
                        {assets.length === 0 ? (
                            <EmptyChartState variant="pie" message="Aucune donnée" description="Ajoutez des actifs pour voir la répartition." />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <defs>
                                        {distributionData.map((entry, idx) => (
                                            <linearGradient key={idx} id={`assetCritGrad${idx}`} x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                                <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <Pie
                                        data={distributionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="55%"
                                        outerRadius="75%"
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={6}
                                        activeIndex={activeCriticalityIndex !== null ? activeCriticalityIndex : undefined}
                                        activeShape={renderActiveShape}
                                        onMouseEnter={(_, index) => setActiveCriticalityIndex(index)}
                                        onMouseLeave={() => setActiveCriticalityIndex(null)}
                                    >
                                        {distributionData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={`url(#assetCritGrad${index})`} className="cursor-pointer" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        iconSize={10}
                                        formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1 uppercase">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Type Distribution Bar Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="glass-premium p-6 rounded-5xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-5xl" />
                    <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <div className="p-2 bg-brand-500/10 rounded-xl">
                            <Layers className="w-4 h-4 text-brand-500" />
                        </div>
                        Top Types d'Actifs
                    </h4>
                    <div className="h-[280px]">
                        {typeChartData.length === 0 ? (
                            <EmptyChartState variant="bar" message="Aucun type" description="Les types d'actifs s'afficheront ici." />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={typeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }}
                                        dy={10}
                                        tickFormatter={(value) => value.length > 8 ? `${value.substring(0, 8)}...` : value}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.1)' }} />
                                    <Bar
                                        dataKey="value"
                                        fill="url(#assetTypeGradient)"
                                        radius={[8, 8, 0, 0]}
                                        barSize={28}
                                        animationDuration={1200}
                                        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Scope Distribution Interactive Pie */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-premium p-6 rounded-5xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-5xl" />
                    <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <div className="p-2 bg-violet-500/10 rounded-xl">
                            <Box className="w-4 h-4 text-violet-500" />
                        </div>
                        Distribution par Périmètre
                    </h4>
                    <div className="h-[280px]">
                        {scopeChartData.length === 0 ? (
                            <EmptyChartState variant="pie" message="Aucun périmètre" description="Définissez le périmètre de vos actifs." />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <defs>
                                        {scopeChartData.map((_, idx) => (
                                            <linearGradient key={idx} id={`assetScopeGrad${idx}`} x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0%" stopColor={SCOPE_COLORS[idx % SCOPE_COLORS.length]} stopOpacity={1} />
                                                <stop offset="100%" stopColor={SCOPE_COLORS[idx % SCOPE_COLORS.length]} stopOpacity={0.7} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <Pie
                                        data={scopeChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="55%"
                                        outerRadius="75%"
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={6}
                                        activeIndex={activeScopeIndex !== null ? activeScopeIndex : undefined}
                                        activeShape={renderActiveShape}
                                        onMouseEnter={(_, index) => setActiveScopeIndex(index)}
                                        onMouseLeave={() => setActiveScopeIndex(null)}
                                    >
                                        {scopeChartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={`url(#assetScopeGrad${index})`} className="cursor-pointer" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend
                                        verticalAlign="bottom"
                                        iconType="circle"
                                        iconSize={10}
                                        formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1 uppercase">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Acquisition Trend Composed Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="glass-premium p-6 rounded-5xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-5xl" />
                    <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        Acquisitions (12 derniers mois)
                    </h4>
                    <div className="h-[280px]">
                        {acquisitionData.every(d => d.count === 0) ? (
                            <EmptyChartState variant="bar" message="Pas d'acquisitions récentes" description="L'historique des achats s'affichera ici." />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={acquisitionData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }}
                                        dy={10}
                                    />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend
                                        iconType="circle"
                                        iconSize={10}
                                        formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1">{value}</span>}
                                    />
                                    <Area
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="cumulative"
                                        name="Cumul"
                                        fill="url(#assetAreaGradient)"
                                        stroke={SENTINEL_PALETTE.secondary}
                                        strokeWidth={2}
                                    />
                                    <Bar
                                        yAxisId="left"
                                        dataKey="count"
                                        name="Acquisitions"
                                        fill="url(#assetAcqGradient)"
                                        radius={[6, 6, 0, 0]}
                                        barSize={20}
                                    />
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="count"
                                        stroke={SENTINEL_PALETTE.primary}
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        dot={false}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
