import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyChartState } from '../ui/EmptyChartState';
import { Supplier, Criticality } from '../../types';
import { Building, ShieldAlert, FileText, CheckCircle2, TrendingUp, AlertTriangle, Star } from '../ui/Icons';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    RadialBarChart, RadialBar, Sector
} from 'recharts';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';
import { SEVERITY_COLORS, SENTINEL_PALETTE } from '../../theme/chartTheme';

interface SupplierDashboardProps {
    suppliers: Supplier[];
    onFilterChange?: (filter: { type: string; value: string } | null) => void;
    loading?: boolean;
}

// Premium activeShape for interactive pie
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
    return (
        <g>
            <text x={cx} y={cy - 8} textAnchor="middle" className="fill-foreground font-black text-base">
                {payload.name}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground text-sm font-mono">
                {payload.value} ({(percent * 100).toFixed(0)}%)
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius - 6}
                outerRadius={outerRadius + 10}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                style={{ filter: 'url(#supplierGlow)' }}
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={innerRadius - 4}
                outerRadius={outerRadius}
                fill={fill}
                stroke="none"
            />
        </g>
    );
};

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({ suppliers, onFilterChange, loading }) => {
    const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

    // Calculate metrics
    const metrics = useMemo(() => {
        const total = suppliers.length;
        const critical = suppliers.filter(s => s.criticality === Criticality.CRITICAL || s.criticality === Criticality.HIGH).length;
        const scoredSuppliers = suppliers.filter(s => (s.securityScore || 0) > 0);
        const avgScore = scoredSuppliers.length > 0 ? Math.round(scoredSuppliers.reduce((acc, s) => acc + (s.securityScore || 0), 0) / scoredSuppliers.length) : 0;
        const expiredContracts = suppliers.filter(s => s.contractEnd && new Date(s.contractEnd) < new Date()).length;
        const compliant = suppliers.filter(s => (s.securityScore || 0) >= 80).length;
        const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 0;

        return { total, critical, avgScore, expiredContracts, compliant, complianceRate };
    }, [suppliers]);

    // Chart Data
    const criticalityData = useMemo(() => [
        { name: 'Critique', value: suppliers.filter(s => s.criticality === Criticality.CRITICAL).length, color: SEVERITY_COLORS.critical },
        { name: 'Élevée', value: suppliers.filter(s => s.criticality === Criticality.HIGH).length, color: SEVERITY_COLORS.high },
        { name: 'Moyenne', value: suppliers.filter(s => s.criticality === Criticality.MEDIUM).length, color: SEVERITY_COLORS.medium },
        { name: 'Faible', value: suppliers.filter(s => s.criticality === Criticality.LOW).length, color: SEVERITY_COLORS.low },
    ].filter(d => d.value > 0), [suppliers]);

    const categoryData = useMemo(() => {
        return Object.entries(
            suppliers.reduce((acc, s) => {
                acc[s.category] = (acc[s.category] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
    }, [suppliers]);

    // Score distribution
    const scoreDistribution = useMemo(() => [
        { name: '90-100', value: suppliers.filter(s => (s.securityScore || 0) >= 90).length, color: SENTINEL_PALETTE.success },
        { name: '70-89', value: suppliers.filter(s => (s.securityScore || 0) >= 70 && (s.securityScore || 0) < 90).length, color: SENTINEL_PALETTE.secondary },
        { name: '50-69', value: suppliers.filter(s => (s.securityScore || 0) >= 50 && (s.securityScore || 0) < 70).length, color: SENTINEL_PALETTE.warning },
        { name: '<50', value: suppliers.filter(s => (s.securityScore || 0) < 50 && (s.securityScore || 0) > 0).length, color: SEVERITY_COLORS.critical },
        { name: 'N/A', value: suppliers.filter(s => !s.securityScore || s.securityScore === 0).length, color: 'hsl(var(--muted-foreground) / 0.4)' },
    ].filter(d => d.value > 0), [suppliers]);

    // Gauge data
    const scoreGaugeData = [{ name: 'Score', value: metrics.avgScore, fill: 'url(#supplierScoreGradient)' }];
    const complianceGaugeData = [{ name: 'Conformité', value: metrics.complianceRate, fill: 'url(#supplierComplianceGradient)' }];

    // Top suppliers by score
    const topSuppliers = useMemo(() => {
        return suppliers
            .filter(s => s.securityScore && s.securityScore > 0)
            .sort((a, b) => (b.securityScore || 0) - (a.securityScore || 0))
            .slice(0, 5);
    }, [suppliers]);

    if (loading) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="glass-premium p-4 sm:p-6 rounded-3xl h-48 animate-pulse bg-slate-100 dark:bg-slate-800/50 shadow-sm" />
                    <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i || 'unknown'} className="glass-premium p-5 rounded-4xl h-32 animate-pulse bg-slate-100 dark:bg-slate-800/50 shadow-sm" />
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                    <div className="glass-premium p-4 sm:p-6 rounded-3xl h-[350px] animate-pulse bg-slate-100 dark:bg-slate-800/50 shadow-sm" />
                    <div className="glass-premium p-4 sm:p-6 rounded-3xl h-[350px] animate-pulse bg-slate-100 dark:bg-slate-800/50 shadow-sm" />
                </div>
            </div>
        );
    }

    if (metrics.total === 0) {
        return (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
                <EmptyChartState
                    message="Aucun fournisseur"
                    description="Commencez par ajouter des fournisseurs pour voir apparaître des métriques et des analyses détaillées."
                    className="glass-premium rounded-3xl min-h-[400px]"
                    variant="default"
                    icon={<Building className="h-10 w-10 text-brand-500" />}
                />
            </motion.div>
        );
    }

    return (
        <motion.div variants={staggerContainerVariants} initial="hidden" animate="visible" className="space-y-6">
            {/* SVG Defs */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id="supplierGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="supplierScoreGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={metrics.avgScore >= 80 ? SENTINEL_PALETTE.success : metrics.avgScore >= 50 ? SENTINEL_PALETTE.warning : SEVERITY_COLORS.critical} />
                        <stop offset="100%" stopColor={metrics.avgScore >= 80 ? '#10b981' : metrics.avgScore >= 50 ? '#f59e0b' : '#ef4444'} />
                    </linearGradient>
                    <linearGradient id="supplierComplianceGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} />
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.secondary} />
                    </linearGradient>
                    <linearGradient id="supplierBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.secondary} stopOpacity={0.6} />
                    </linearGradient>
                </defs>
            </svg>

            {/* Hero Section with Gauges */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Score Gauge */}
                <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-3xl relative overflow-hidden group hover:shadow-apple-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-brand-50 rounded-3xl">
                            <Star className="h-4 w-4 text-brand-500" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Score Moyen</span>
                    </div>
                    <div className="h-[120px] relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
                            <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" barSize={12} data={scoreGaugeData} startAngle={180} endAngle={0}>
                                <RadialBar background={{ fill: 'hsl(var(--muted) / 0.3)' }} dataKey="value" cornerRadius={10} style={{ filter: 'url(#supplierGlow)' }} />
                            </RadialBarChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 text-center">
                            <div className={`text-3xl font-black bg-gradient-to-r ${metrics.avgScore >= 80 ? 'from-emerald-600 to-emerald-400' : metrics.avgScore >= 50 ? 'from-amber-600 to-amber-400' : 'from-red-600 to-red-400'} bg-clip-text text-transparent`}>
                                {metrics.avgScore}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Compliance Rate Gauge */}
                <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-3xl relative overflow-hidden group hover:shadow-apple-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent pointer-events-none" />
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-3xl">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Conformité</span>
                    </div>
                    <div className="h-[120px] relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
                            <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" barSize={12} data={complianceGaugeData} startAngle={180} endAngle={0}>
                                <RadialBar background={{ fill: 'hsl(var(--muted) / 0.3)' }} dataKey="value" cornerRadius={10} style={{ filter: 'url(#supplierGlow)' }} />
                            </RadialBarChart>
                        </ResponsiveContainer>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 text-center">
                            <div className="text-3xl font-black bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
                                {metrics.complianceRate}%
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Key Metrics Grid */}
                <motion.div variants={slideUpVariants} className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total', value: metrics.total, icon: Building, color: 'brand', gradient: 'from-brand-500 to-brand-400' },
                        { label: 'Critiques', value: metrics.critical, icon: ShieldAlert, color: 'orange', gradient: 'from-orange-500 to-orange-400' },
                        { label: 'Expirés', value: metrics.expiredContracts, icon: FileText, color: 'red', gradient: 'from-red-500 to-red-400', onClick: () => onFilterChange?.({ type: 'contract', value: 'expired' }) },
                        { label: 'Conformes', value: metrics.compliant, icon: CheckCircle2, color: 'emerald', gradient: 'from-emerald-500 to-emerald-400' }
                    ].map((item, idx) => (
                        <button
                            key={idx || 'unknown'}
                            type="button"
                            onClick={item.onClick}
                            className={`glass-premium p-4 rounded-4xl flex flex-col items-center justify-center text-center hover:shadow-apple hover:-translate-y-1 transition-all duration-300 group ${item.onClick ? 'cursor-pointer' : ''}`}
                            disabled={!item.onClick}
                        >
                            <div className={`p-2.5 bg-${item.color}-500/10 rounded-3xl mb-3 group-hover:scale-110 transition-transform`}>
                                <item.icon className={`h-4 w-4 text-${item.color}-500`} />
                            </div>
                            <span className={`text-2xl font-black bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent mb-1`}>
                                {item.value}
                            </span>
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{item.label}</span>
                        </button>
                    ))}
                </motion.div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Interactive Criticality Distribution */}
                <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />
                    <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <div className="p-2 bg-orange-500/10 rounded-3xl">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                        </div>
                        Distribution par Criticité
                    </h4>
                    <div className="h-[280px]">
                        {criticalityData.length === 0 ? (
                            <EmptyChartState variant="pie" message="Aucune donnée" description="Ajoutez des fournisseurs pour voir la répartition par criticité." />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
                                <PieChart>
                                    <defs>
                                        {criticalityData.map((entry, idx) => (
                                            <linearGradient key={idx || 'unknown'} id={`supplierCritGrad${idx}`} x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                                <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <Pie
                                        data={criticalityData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="55%"
                                        outerRadius="75%"
                                        paddingAngle={5}
                                        dataKey="value"
                                        cornerRadius={6}
                                        stroke="none"
                                        activeIndex={activePieIndex !== null ? activePieIndex : undefined}
                                        activeShape={renderActiveShape}
                                        onMouseEnter={(_, index) => setActivePieIndex(index)}
                                        onMouseLeave={() => setActivePieIndex(null)}
                                    >
                                        {criticalityData.map((_, index) => (
                                            <Cell key={`cell-${index || 'unknown'}`} fill={`url(#supplierCritGrad${index})`} className="cursor-pointer" />
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

                {/* Top Categories Chart */}
                <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />
                    <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <div className="p-2 bg-brand-50 rounded-3xl">
                            <Building className="w-4 h-4 text-brand-500" />
                        </div>
                        Top Catégories
                    </h4>
                    <div className="h-[280px]">
                        {categoryData.length === 0 ? (
                            <EmptyChartState variant="bar" message="Aucune catégorie" description="Les catégories s'afficheront ici." />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
                                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }}
                                        dy={10}
                                        tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.1)' }} />
                                    <Bar
                                        dataKey="value"
                                        fill="url(#supplierBarGradient)"
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

                {/* Score Distribution */}
                <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />
                    <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 rounded-3xl">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        </div>
                        Distribution des Scores
                    </h4>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
                            <BarChart data={scoreDistribution} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border) / 0.3)" />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }} width={50} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.1)' }} />
                                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20} animationDuration={1200}>
                                    {scoreDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index || 'unknown'}`} fill={entry.color} style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))' }} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Top Suppliers List */}
                <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />
                    <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider flex items-center gap-2">
                        <div className="p-2 bg-amber-50 rounded-3xl">
                            <Star className="w-4 h-4 text-amber-500" />
                        </div>
                        Top 5 Fournisseurs
                    </h4>
                    <div className="space-y-3">
                        {topSuppliers.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                Aucun fournisseur avec un score défini.
                            </div>
                        ) : (
                            topSuppliers.map((supplier, index) => (
                                <motion.div
                                    key={supplier.id || 'unknown'}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="flex items-center gap-4 p-3 bg-white/50 dark:bg-white/5 rounded-2xl hover:bg-white/80 dark:hover:bg-white/10 transition-all group cursor-pointer"
                                >
                                    <div className={`w-8 h-8 rounded-3xl flex items-center justify-center text-xs font-black text-white ${index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
                                        index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500' :
                                            index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                                                'bg-gradient-to-br from-brand-400 to-brand-600'
                                        }`}>
                                        #{index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-foreground truncate group-hover:text-brand-600 transition-colors">
                                            {supplier.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate">{supplier.category}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`px-2.5 py-1 rounded-lg text-xs font-black ${(supplier.securityScore || 0) >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            (supplier.securityScore || 0) >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                            {supplier.securityScore}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};
