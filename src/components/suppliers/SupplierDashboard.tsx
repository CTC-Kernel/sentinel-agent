import React from 'react';
import { motion } from 'framer-motion';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyChartState } from '../ui/EmptyChartState';
import { Supplier, Criticality } from '../../types';
import { Building, ShieldAlert, FileText, CheckCircle2, PieChart as PieChartIcon, BarChart3 as BarChartIcon } from '../ui/Icons';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';

interface SupplierDashboardProps {
    suppliers: Supplier[];
    onFilterChange?: (filter: { type: string; value: string } | null) => void;
    loading?: boolean;
}

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({ suppliers, onFilterChange, loading }) => {
    // Calculate metrics
    const totalSuppliers = suppliers.length;
    const criticalSuppliers = suppliers.filter(s => s.criticality === Criticality.CRITICAL || s.criticality === Criticality.HIGH).length;
    const scoredSuppliers = suppliers.filter(s => (s.securityScore || 0) > 0);
    const avgScore = scoredSuppliers.length > 0 ? Math.round(scoredSuppliers.reduce((acc, s) => acc + (s.securityScore || 0), 0) / scoredSuppliers.length) : 0;
    const expiredContracts = suppliers.filter(s => s.contractEnd && new Date(s.contractEnd) < new Date()).length;
    const compliantSuppliers = suppliers.filter(s => (s.securityScore || 0) >= 80).length;

    // Chart Data
    const criticalityData = [
        { name: 'Critique', value: suppliers.filter(s => s.criticality === Criticality.CRITICAL).length, color: '#ef4444' }, // Red-500
        { name: 'Élevée', value: suppliers.filter(s => s.criticality === Criticality.HIGH).length, color: '#f97316' },   // Orange-500
        { name: 'Moyenne', value: suppliers.filter(s => s.criticality === Criticality.MEDIUM).length, color: '#eab308' }, // Yellow-500
        { name: 'Faible', value: suppliers.filter(s => s.criticality === Criticality.LOW).length, color: '#22c55e' },    // Green-500
    ].filter(d => d.value > 0);

    const categoryData = Object.entries(
        suppliers.reduce((acc, s) => {
            acc[s.category] = (acc[s.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

    if (loading) {
        return (
            <div className="space-y-6 animate-fade-in">
                {/* Top Summary Section Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="glass-premium p-6 rounded-[2rem] h-48 animate-pulse bg-slate-100 dark:bg-slate-800/50" />
                    <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="glass-premium p-5 rounded-[2rem] h-32 animate-pulse bg-slate-100 dark:bg-slate-800/50" />
                        <div className="glass-premium p-5 rounded-[2rem] h-32 animate-pulse bg-slate-100 dark:bg-slate-800/50" />
                        <div className="glass-premium p-5 rounded-[2rem] h-32 animate-pulse bg-slate-100 dark:bg-slate-800/50" />
                        <div className="glass-premium p-5 rounded-[2rem] h-32 animate-pulse bg-slate-100 dark:bg-slate-800/50" />
                    </div>
                </div>
                {/* Charts Section Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                    <div className="glass-premium p-6 rounded-[2rem] h-[350px] animate-pulse bg-slate-100 dark:bg-slate-800/50" />
                    <div className="glass-premium p-6 rounded-[2rem] h-[350px] animate-pulse bg-slate-100 dark:bg-slate-800/50" />
                </div>
            </div>
        );
    }

    if (totalSuppliers === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <EmptyChartState
                    message="Aucun fournisseur"
                    description="Commencez par ajouter des fournisseurs pour voir apparaître des métriques et des analyses détaillées."
                    className="glass-premium rounded-[2.5rem] min-h-[400px]"
                    variant="default"
                    icon={<Building className="h-10 w-10 text-brand-500" />}
                />
            </motion.div>
        );
    }

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
        >
            {/* Top Summary Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Main Score Card (Glass + Gradient) */}
                <motion.div variants={slideUpVariants} className="glass-premium p-6 rounded-[2rem] shadow-lg relative overflow-hidden group hover:shadow-apple transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />

                    {/* Tech Corners */}
                    <svg className="absolute top-5 left-5 w-4 h-4 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v2H2z" /><path fill="currentColor" d="M2 2v20h2V2z" /></svg>
                    <svg className="absolute bottom-5 right-5 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v2H2z" /><path fill="currentColor" d="M2 2v20h2V2z" /></svg>

                    <div className="flex items-center gap-6 relative z-10 h-full">
                        <div className="relative">
                            <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="0 0 96 96">
                                <defs>
                                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor={avgScore >= 80 ? '#10b981' : avgScore >= 50 ? '#f59e0b' : '#ef4444'} />
                                        <stop offset="100%" stopColor={avgScore >= 80 ? '#34d399' : avgScore >= 50 ? '#fbbf24' : '#f87171'} />
                                    </linearGradient>
                                </defs>
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
                                    stroke="url(#scoreGradient)"
                                    strokeWidth="8"
                                    strokeDasharray={251.2}
                                    strokeDashoffset={251.2 - (251.2 * avgScore) / 100}
                                    strokeLinecap="round"
                                    fill="transparent"
                                    r="40"
                                    cx="48"
                                    cy="48"
                                    className="drop-shadow-sm transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                <span className="text-2xl font-black bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                                    {avgScore}
                                </span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 uppercase tracking-wider">Score Moyen</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 font-mono leading-relaxed">
                                Niveau de conformité global du parc fournisseurs.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* 2. Key Metrics Grid */}
                <motion.div variants={slideUpVariants} className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Metric 1 */}
                    <div className="glass-premium p-5 rounded-[2rem] flex flex-col items-center justify-center text-center hover:shadow-apple hover:-translate-y-1 transition-all duration-300 group shadow-sm">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                            <Building className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="text-2xl font-black text-slate-900 dark:text-white mb-1 font-mono">{totalSuppliers}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total</span>
                    </div>

                    {/* Metric 2 */}
                    <div className="glass-premium p-5 rounded-[2rem] flex flex-col items-center justify-center text-center hover:shadow-apple hover:-translate-y-1 transition-all duration-300 group shadow-sm">
                        <div className="p-3 bg-orange-50 dark:bg-orange-500/10 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                            <ShieldAlert className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <span className={`text-2xl font-black mb-1 font-mono ${criticalSuppliers > 0 ? 'text-orange-500' : 'text-slate-900 dark:text-white'}`}>{criticalSuppliers}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Critiques</span>
                    </div>

                    {/* Metric 3 */}
                    <div
                        onClick={() => onFilterChange?.({ type: 'contract', value: 'expired' })}
                        className="glass-premium p-5 rounded-[2rem] flex flex-col items-center justify-center text-center hover:shadow-apple hover:-translate-y-1 transition-all duration-300 cursor-pointer group shadow-sm border-l-2 border-red-500/50"
                    >
                        <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                            <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <span className={`text-2xl font-black mb-1 font-mono ${expiredContracts > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>{expiredContracts}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Expirés</span>
                    </div>

                    {/* Metric 4 */}
                    <div className="glass-premium p-5 rounded-[2rem] flex flex-col items-center justify-center text-center hover:shadow-apple hover:-translate-y-1 transition-all duration-300 group shadow-sm">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-2xl font-black text-slate-900 dark:text-white mb-1 font-mono">{compliantSuppliers}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Conformes</span>
                    </div>
                </motion.div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                {/* Distribution Chart */}
                <motion.div variants={slideUpVariants} className="glass-premium p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                    {/* Tech Corners Generic */}
                    <svg className="absolute top-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute top-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
                    <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 text-brand-500" />
                        Distribution par Criticité
                    </h4>
                    <div className="h-[300px] w-full">
                        {criticalityData.length === 0 ? (
                            <EmptyChartState
                                variant="pie"
                                message="Aucune donnée"
                                description="Ajoutez des fournisseurs pour voir la répartition par criticité."
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <defs>
                                        {criticalityData.map((entry, index) => (
                                            <radialGradient key={`gradient-${index}`} id={`gradient-${index}`} cx="50%" cy="50%" r="70%" fx="50%" fy="50%">
                                                <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                                <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                                            </radialGradient>
                                        ))}
                                    </defs>
                                    <Pie
                                        data={criticalityData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="60%"
                                        outerRadius="80%"
                                        paddingAngle={5}
                                        dataKey="value"
                                        cornerRadius={6}
                                        stroke="none"
                                    >
                                        {criticalityData.map((_, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={`url(#gradient-${index})`}
                                                className="hover:opacity-80 transition-opacity cursor-pointer"
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} cursor={false} />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconType="circle"
                                        formatter={(value) => <span className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-1">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Top Categories Chart */}
                <motion.div variants={slideUpVariants} className="glass-premium p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                    {/* Tech Corners Generic */}
                    <svg className="absolute top-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute top-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
                    <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
                        <BarChartIcon className="w-4 h-4 text-brand-500" />
                        Top Catégories
                    </h4>
                    <div className="h-[300px] w-full">
                        {categoryData.length === 0 ? (
                            <EmptyChartState
                                variant="bar"
                                message="Aucune catégorie"
                                description="Les catégories s'afficheront ici."
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                    <Bar
                                        dataKey="value"
                                        fill="url(#barGradient)"
                                        radius={[6, 6, 0, 0]}
                                        barSize={32}
                                        animationDuration={1500}
                                    >
                                        {categoryData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill="url(#barGradient)" />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};
