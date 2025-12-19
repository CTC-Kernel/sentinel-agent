import React from 'react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Supplier, Criticality } from '../../types';
import { Building, ShieldAlert, FileText, CheckCircle2 } from '../ui/Icons';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface SupplierDashboardProps {
    suppliers: Supplier[];
    onFilterChange?: (filter: { type: string; value: string } | null) => void;
}

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({ suppliers, onFilterChange }) => {
    // Calculate metrics
    const totalSuppliers = suppliers.length;
    const criticalSuppliers = suppliers.filter(s => s.criticality === Criticality.CRITICAL || s.criticality === Criticality.HIGH).length;
    const avgScore = totalSuppliers > 0 ? Math.round(suppliers.reduce((acc, s) => acc + (s.securityScore || 0), 0) / totalSuppliers) : 0;
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

    return (
        <div className="space-y-6">
            {/* Top Summary Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Main Score Card (Glass + Gradient) */}
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />

                    <div className="flex items-center gap-6 relative z-10">
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
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Score Moyen</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Niveau de conformité global du parc fournisseurs.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Key Metrics Grid */}
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Metric 1 */}
                    <div className="glass-panel p-5 rounded-3xl border border-white/50 dark:border-white/5 flex flex-col items-center justify-center text-center hover:bg-white/50 dark:hover:bg-white/5 transition-colors group">
                        <div className="p-3 bg-indigo-50 dark:bg-slate-800 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                            <Building className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <span className="text-2xl font-black text-slate-900 dark:text-white mb-1">{totalSuppliers}</span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total</span>
                    </div>

                    {/* Metric 2 */}
                    <div className="glass-panel p-5 rounded-3xl border border-white/50 dark:border-white/5 flex flex-col items-center justify-center text-center hover:bg-white/50 dark:hover:bg-white/5 transition-colors group">
                        <div className="p-3 bg-orange-50 dark:bg-slate-800 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                            <ShieldAlert className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <span className="text-2xl font-black text-slate-900 dark:text-white mb-1">{criticalSuppliers}</span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Critiques</span>
                    </div>

                    {/* Metric 3 */}
                    <div
                        onClick={() => onFilterChange?.({ type: 'contract', value: 'expired' })}
                        className="glass-panel p-5 rounded-3xl border border-red-100 dark:border-red-900/30 flex flex-col items-center justify-center text-center hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors cursor-pointer group"
                    >
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                            <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <span className="text-2xl font-black text-slate-900 dark:text-white mb-1">{expiredContracts}</span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Expirés</span>
                    </div>

                    {/* Metric 4 */}
                    <div className="glass-panel p-5 rounded-3xl border border-white/50 dark:border-white/5 flex flex-col items-center justify-center text-center hover:bg-white/50 dark:hover:bg-white/5 transition-colors group">
                        <div className="p-3 bg-emerald-50 dark:bg-slate-800 rounded-2xl mb-3 group-hover:scale-110 transition-transform">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-2xl font-black text-slate-900 dark:text-white mb-1">{compliantSuppliers}</span>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Conformes</span>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Distribution Chart */}
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/50 dark:border-white/5 shadow-sm">
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-6 px-2">Distribution par Criticité</h4>
                    <div className="h-[300px] w-full">
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
                                    innerRadius={80}
                                    outerRadius={100}
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
                    </div>
                </div>

                {/* Top Categories Chart */}
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/50 dark:border-white/5 shadow-sm">
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-6 px-2">Top Catégories</h4>
                    <div className="h-[300px] w-full">
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
                    </div>
                </div>
            </div>
        </div>
    );
};
