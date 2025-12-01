import React from 'react';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Asset, Criticality } from '../../types';
import { Server, Wrench, Euro, ShieldAlert } from '../ui/Icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AssetDashboardProps {
    assets: Asset[];
    onFilterChange?: (filter: { type: 'criticality' | 'status' | 'type', value: string } | null) => void;
}

export const AssetDashboard: React.FC<AssetDashboardProps> = ({ assets, onFilterChange }) => {
    // Calculate metrics
    const totalAssets = assets.length;
    const criticalAssets = assets.filter(a =>
        a.confidentiality === Criticality.CRITICAL ||
        a.integrity === Criticality.CRITICAL ||
        a.availability === Criticality.CRITICAL
    ).length;

    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const maintenanceDue = assets.filter(a => a.nextMaintenance && new Date(a.nextMaintenance) < nextMonth).length;

    const totalValue = assets.reduce((acc, a) => acc + (a.purchasePrice || 0), 0);
    const currentValue = assets.reduce((acc, a) => acc + (a.currentValue || 0), 0);
    const depreciation = totalValue > 0 ? ((totalValue - currentValue) / totalValue * 100) : 0;

    // Distribution by Type
    const typeData = assets.reduce((acc, asset) => {
        const type = asset.type || 'Autre';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const typeChartData = Object.entries(typeData)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8); // Top 8 types

    // Distribution by Criticality (Max of C, I, A)
    const getAssetCriticality = (a: Asset) => {
        if (a.confidentiality === Criticality.CRITICAL || a.integrity === Criticality.CRITICAL || a.availability === Criticality.CRITICAL) return 'Critique';
        if (a.confidentiality === Criticality.HIGH || a.integrity === Criticality.HIGH || a.availability === Criticality.HIGH) return 'Élevé';
        if (a.confidentiality === Criticality.MEDIUM || a.integrity === Criticality.MEDIUM || a.availability === Criticality.MEDIUM) return 'Moyen';
        return 'Faible';
    };

    const criticalityCounts = {
        'Critique': 0,
        'Élevé': 0,
        'Moyen': 0,
        'Faible': 0
    };

    assets.forEach(a => {
        const crit = getAssetCriticality(a);
        if (crit in criticalityCounts) criticalityCounts[crit as keyof typeof criticalityCounts]++;
    });

    const distributionData = [
        { name: 'Critique', value: criticalityCounts['Critique'], color: '#ef4444' },
        { name: 'Élevé', value: criticalityCounts['Élevé'], color: '#f97316' },
        { name: 'Moyen', value: criticalityCounts['Moyen'], color: '#eab308' },
        { name: 'Faible', value: criticalityCounts['Faible'], color: '#22c55e' }
    ];

    return (
        <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Total Assets */}
                <div
                    onClick={() => onFilterChange?.(null)}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Total Actifs</span>
                        <Server className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalAssets}</div>
                    <div className="text-xs text-slate-500 mt-1">Inventaire complet</div>
                </div>

                {/* Critical Assets */}
                <div
                    onClick={() => onFilterChange?.({ type: 'criticality', value: 'Critique' })}
                    className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-6 rounded-2xl border border-red-200 dark:border-red-800 cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Critiques</span>
                        <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div className="text-3xl font-bold text-red-700 dark:text-red-400">{criticalAssets}</div>
                    <div className="text-xs text-red-600 dark:text-red-500 mt-1">Haute sécurité requise</div>
                </div>

                {/* Maintenance Due */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Maintenance (30j)</span>
                        <Wrench className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{maintenanceDue}</div>
                    <div className="text-xs text-slate-500 mt-1">Actions requises</div>
                </div>

                {/* Financial Value */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Valeur Totale</span>
                        <Euro className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{(totalValue / 1000).toFixed(1)}k€</div>
                    <div className="text-xs text-slate-500 mt-1">Dépréciation: {depreciation.toFixed(0)}%</div>
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
                                data={distributionData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {distributionData.map((entry, index) => (
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

                {/* Type Distribution */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Top Types d'Actifs</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={typeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.5} />
                            <XAxis
                                dataKey="name"
                                stroke="#94a3b8"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                                tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                dx={-10}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9', opacity: 0.4 }} />
                            <Bar dataKey="value" fill="#3b82f6" name="Nombre d'actifs" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
