import React from 'react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Supplier, Criticality, SupplierIncident } from '../../types';
import { Building, ShieldAlert, FileText } from '../ui/Icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SupplierDashboardProps {
    suppliers: Supplier[];
    incidents: SupplierIncident[];
    onFilterChange?: (filter: { type: string; value: string } | null) => void;
}

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({ suppliers, incidents, onFilterChange }) => {
    // Calculate metrics
    const totalSuppliers = suppliers.length;
    const criticalSuppliers = suppliers.filter(s => s.criticality === Criticality.CRITICAL || s.criticality === Criticality.HIGH).length;
    const avgScore = totalSuppliers > 0 ? Math.round(suppliers.reduce((acc, s) => acc + (s.securityScore || 0), 0) / totalSuppliers) : 0;
    const expiredContracts = suppliers.filter(s => s.contractEnd && new Date(s.contractEnd) < new Date()).length;

    const activeIncidents = incidents.filter(i => i.status === 'Open' || i.status === 'Investigating').length;

    // Chart Data
    const criticalityData = [
        { name: 'Critique', value: suppliers.filter(s => s.criticality === Criticality.CRITICAL).length, color: '#EF4444' },
        { name: 'Élevée', value: suppliers.filter(s => s.criticality === Criticality.HIGH).length, color: '#F97316' },
        { name: 'Moyenne', value: suppliers.filter(s => s.criticality === Criticality.MEDIUM).length, color: '#EAB308' },
        { name: 'Faible', value: suppliers.filter(s => s.criticality === Criticality.LOW).length, color: '#22C55E' },
    ].filter(d => d.value > 0);

    const categoryData = Object.entries(
        suppliers.reduce((acc, s) => {
            acc[s.category] = (acc[s.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Summary Card */}
            <div className="glass-panel p-6 md:p-7 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group">
                <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
                </div>

                {/* Global Score */}
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="0 0 96 96">
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
                                className={`${avgScore >= 80 ? 'text-emerald-500' : avgScore >= 60 ? 'text-amber-500' : 'text-red-500'} transition-all duration-1000 ease-out`}
                                strokeWidth="8"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * avgScore) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="40"
                                cx="48"
                                cy="48"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-xl font-black text-slate-900 dark:text-white">{avgScore}</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Score Moyen</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px]">
                            Niveau de sécurité moyen de l'ensemble des fournisseurs.
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="flex-1 grid grid-cols-2 gap-4 border-l border-r border-slate-200 dark:border-white/10 px-6 mx-2">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Building className="h-4 w-4 text-slate-400" />
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{totalSuppliers}</div>
                        <div className="text-xs text-slate-500 mt-1">Fournisseurs actifs</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <ShieldAlert className="h-4 w-4 text-slate-400" />
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critiques</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{criticalSuppliers}</div>
                        <div className="text-xs text-slate-500 mt-1">Nécessitent attention</div>
                    </div>
                </div>

                {/* Alerts/Status */}
                <div className="flex flex-col gap-3 min-w-[180px]">
                    <div
                        onClick={() => onFilterChange?.({ type: 'contract', value: 'expired' })}
                        className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                            <span className="text-xs font-bold text-red-700 dark:text-red-300">Contrats Expirés</span>
                        </div>
                        <span className="text-sm font-black text-red-700 dark:text-red-400">{expiredContracts}</span>
                    </div>
                    <div
                        onClick={() => onFilterChange?.({ type: 'status', value: 'incident' })}
                        className="flex items-center justify-between p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-900/30 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                            <span className="text-xs font-bold text-orange-700 dark:text-orange-300">Incidents Actifs</span>
                        </div>
                        <span className="text-sm font-black text-orange-700 dark:text-orange-400">{activeIncidents}</span>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Criticality Distribution */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Distribution par Criticité</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={criticalityData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {criticalityData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} cursor={false} />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(value) => <span className="text-xs font-medium text-slate-600 dark:text-slate-400 ml-1">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Category Distribution */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Top Catégories</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
