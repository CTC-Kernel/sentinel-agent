import React from 'react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Supplier, Criticality, SupplierIncident } from '../../types';
import { Building, ShieldAlert, Handshake, FileText } from '../ui/Icons';
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
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Suppliers */}
                <div
                    onClick={() => onFilterChange?.(null)}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Total Fournisseurs</span>
                        <Building className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalSuppliers}</div>
                    <div className="text-xs text-slate-500 mt-1">Base fournisseurs active</div>
                </div>

                {/* Critical Suppliers */}
                <div
                    onClick={() => onFilterChange?.({ type: 'criticality', value: 'Critique' })}
                    className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 p-6 rounded-2xl border border-orange-200 dark:border-orange-800 cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">Critiques / Élevés</span>
                        <ShieldAlert className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="text-3xl font-bold text-orange-700 dark:text-orange-400">{criticalSuppliers}</div>
                    <div className="text-xs text-orange-600 dark:text-orange-500 mt-1">Nécessitent attention</div>
                </div>

                {/* Avg Score */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Score Moyen</span>
                        <Handshake className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{avgScore}/100</div>
                    <div className="text-xs text-slate-500 mt-1">Niveau de sécurité global</div>
                </div>

                {/* Expired Contracts */}
                <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-6 rounded-2xl border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Contrats Expirés</span>
                        <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-3xl font-bold text-red-700 dark:text-red-400">{expiredContracts}</div>
                    <div className="text-xs text-red-600 dark:text-red-500 mt-1">Renouvellement requis</div>
                </div>

                {/* Active Incidents */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Incidents Actifs</span>
                        <ShieldAlert className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{activeIncidents}</div>
                    <div className="text-xs text-slate-500 mt-1">En cours d'investigation</div>
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
