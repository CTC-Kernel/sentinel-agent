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

    // Distribution by Location
    const locationData = assets.reduce((acc, asset) => {
        const loc = asset.location || 'Non défini';
        acc[loc] = (acc[loc] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const locationChartData = Object.entries(locationData)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8); // Top 8 locations

    // Distribution by Scope
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

    const scopeChartData = Object.entries(scopeData).map(([name, value]) => ({ name, value }));
    const SCOPE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981', '#6366f1', 'hsl(var(--muted-foreground) / 0.55)'];

    return (
        <div className="space-y-6">
            {/* Summary Card */}
            <div className="glass-panel p-6 md:p-7 rounded-[2rem] shadow-lg border border-white/60 dark:border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group mb-8 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
                </div>

                {/* Global Score */}
                <div className="flex items-center gap-6 relative z-decorator">
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
                                className={`${depreciation <= 20 ? 'text-emerald-500' : depreciation <= 50 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                                strokeWidth="8"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * (100 - depreciation)) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="40"
                                cx="48"
                                cy="48"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-xl font-black text-slate-900 dark:text-white">{Math.round(100 - depreciation)}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Santé du Parc</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[200px]">
                            Basé sur l'amortissement et la maintenance.
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onFilterChange?.(null)}>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Server className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{totalAssets}</div>
                    </div>
                    <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onFilterChange?.({ type: 'criticality', value: 'Critique' })}>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <ShieldAlert className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Critiques</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{criticalAssets}</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Euro className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Valeur</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{(currentValue / 1000).toFixed(0)}k€</div>
                    </div>
                </div>

                {/* Alerts/Status */}
                <div className="flex flex-col gap-3 min-w-[180px]">
                    <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">Maintenance</span>
                        </div>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-400">{maintenanceDue}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Nouveaux</span>
                        </div>
                        <span className="text-sm font-black text-blue-700 dark:text-blue-400">
                            {assets.filter(a => a.purchaseDate && (new Date().getTime() - new Date(a.purchaseDate).getTime()) < 2592000000).length}
                        </span>
                    </div>
                </div>
            </div>
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Criticality Distribution */}
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
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
                                formatter={(value) => <span className="text-xs font-medium text-muted-foreground ml-1">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Type Distribution */}
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Top Types d'Actifs</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={typeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={'hsl(var(--border) / 0.6)'} vertical={false} opacity={0.5} />
                            <XAxis
                                dataKey="name"
                                stroke={'hsl(var(--muted-foreground))'}
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                                tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                            />
                            <YAxis
                                stroke={'hsl(var(--muted-foreground))'}
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                dx={-10}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.12)', opacity: 1 }} />
                            <Bar dataKey="value" fill="#3b82f6" name="Nombre d'actifs" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Scope Distribution */}
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Distribution par Périmètre (Scope)</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={scopeChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {scopeChartData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={SCOPE_COLORS[index % SCOPE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} cursor={false} />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(value) => <span className="text-xs font-medium text-muted-foreground ml-1">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Location Distribution */}
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Actifs par Localisation</h4>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={locationChartData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={'hsl(var(--border) / 0.6)'} horizontal={false} opacity={0.5} />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                stroke={'hsl(var(--muted-foreground))'}
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                width={100}
                                tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.12)', opacity: 1 }} />
                            <Bar dataKey="value" fill="#10b981" name="Nombre d'actifs" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
