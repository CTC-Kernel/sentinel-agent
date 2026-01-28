import React, { useMemo } from 'react';
import { Project } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip';
import { EmptyChartState } from '../ui/EmptyChartState';
import { SENTINEL_PALETTE, SEVERITY_COLORS } from '../../theme/chartTheme';

import { Skeleton } from '../ui/Skeleton';

interface PortfolioDashboardProps {
    projects: Project[];
    loading?: boolean;
}

export const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({ projects, loading }) => {
    // Stats Calculations
    const stats = useMemo(() => {
        const total = projects.length;
        const active = projects.filter(p => p.status === 'En cours').length;
        const delayed = projects.filter(p => new Date(p.dueDate) < new Date() && p.status !== 'Terminé').length;

        // Global Progress (Average)
        const globalProgress = total > 0
            ? Math.round(projects.reduce((acc, p) => acc + (p.progress || 0), 0) / total)
            : 0;

        return { total, active, delayed, globalProgress };
    }, [projects]);

    // Status Distribution Data (using harmonized palette)
    const statusData = useMemo(() => [
        { name: 'En cours', value: projects.filter(p => p.status === 'En cours').length, color: SENTINEL_PALETTE.primary },
        { name: 'Terminé', value: projects.filter(p => p.status === 'Terminé').length, color: SENTINEL_PALETTE.success },
        { name: 'Planifié', value: projects.filter(p => p.status === 'Planifié').length, color: SENTINEL_PALETTE.warning },
        { name: 'Suspendu', value: projects.filter(p => p.status === 'Suspendu').length, color: SENTINEL_PALETTE.tertiary }
    ].filter(d => d.value > 0), [projects]);

    // Progress Distribution (Grouped by ranges)
    const progressData = useMemo(() => {
        const ranges = { '0-25%': 0, '26-50%': 0, '51-75%': 0, '76-100%': 0 };
        projects.forEach(p => {
            if (p.progress <= 25) ranges['0-25%']++;
            else if (p.progress <= 50) ranges['26-50%']++;
            else if (p.progress <= 75) ranges['51-75%']++;
            else ranges['76-100%']++;
        });
        return Object.entries(ranges).map(([name, value]) => ({ name, value }));
    }, [projects]);

    // Upcoming Deadlines (Next 6 Months)
    const deadlineData = React.useMemo(() => {
        const months = new Array(6).fill(0).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() + i);
            return {
                name: d.toLocaleString('default', { month: 'short' }),
                date: d,
                count: 0
            };
        });

        projects.forEach(p => {
            if (p.dueDate && p.status !== 'Terminé' && p.status !== 'Suspendu') {
                const due = new Date(p.dueDate);
                const monthIndex = months.findIndex(m =>
                    m.date.getMonth() === due.getMonth() &&
                    m.date.getFullYear() === due.getFullYear()
                );
                if (monthIndex !== -1) {
                    months[monthIndex].count++;
                }
            }
        });

        return months.map(m => ({ name: m.name, value: m.count }));
    }, [projects]);

    // ... (Stats and other memos remain same, just ensure they are clean)

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Global Health Loading State */}
                    <div className="lg:col-span-2 glass-premium p-6 md:p-8 rounded-4xl shadow-sm flex flex-col md:flex-row gap-6 border border-transparent dark:border-border/40 animate-pulse">
                        <div className="flex items-center gap-6">
                            <Skeleton className="h-24 w-24 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48 rounded" />
                                <Skeleton className="h-4 w-32 rounded" />
                            </div>
                        </div>
                        <div className="flex-1 grid grid-cols-3 gap-4 border-l border-border/40 dark:border-border/40 px-6 mx-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="space-y-2">
                                    <Skeleton className="h-4 w-16 rounded" />
                                    <Skeleton className="h-8 w-12 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Status Distribution Loading State */}
                    <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 animate-pulse">
                        <Skeleton className="h-4 w-32 rounded mb-4" />
                        <Skeleton className="h-[140px] w-full rounded-full" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {/* Secondary Charts Loading State */}
                    {[1, 2].map(i => (
                        <div key={i} className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 animate-pulse">
                            <Skeleton className="h-4 w-48 rounded mb-4" />
                            <Skeleton className="h-[250px] w-full rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-border/40 dark:border-slate-700 min-h-[400px]">
                <EmptyChartState
                    message="Aucun projet en cours"
                    description="Créez votre premier projet pour suivre son avancement et piloter votre portefeuille."
                    variant="default"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Global Health - Radial Premium Card */}
                <div className="lg:col-span-2 glass-premium p-6 md:p-8 rounded-4xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group border border-transparent dark:border-border/40 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 pointer-events-none" />
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="relative">
                            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 96 96">
                                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200 dark:text-slate-700" />
                                <circle
                                    cx="48" cy="48" r="40"
                                    stroke="currentColor" strokeWidth="8" fill="transparent"
                                    strokeDasharray={251.2}
                                    strokeDashoffset={251.2 - (251.2 * stats.globalProgress) / 100}
                                    className="text-brand-500 transition-all duration-1000 ease-out"
                                />
                            </svg>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                <span className="text-xl font-black text-slate-900 dark:text-white">
                                    {stats.globalProgress}%
                                </span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Santé du Portefeuille</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-[250px]">Moyenne d'avancement globale.</p>
                        </div>
                    </div>
                    {/* Key Metrics */}
                    <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-border/40 dark:border-border/40 px-6 mx-2">
                        <div>
                            <div className="text-sm text-slate-600 dark:text-muted-foreground mb-1">Total</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-600 dark:text-muted-foreground mb-1">En Cours</div>
                            <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">{stats.active}</div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-600 dark:text-muted-foreground mb-1">Retard</div>
                            <div className="text-2xl font-bold text-red-500">{stats.delayed}</div>
                        </div>
                    </div>
                </div>

                {/* Status Distribution */}
                <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40 relative overflow-hidden">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-4">Statut des Projets</h3>
                    <div className="h-[140px] w-full">
                        {statusData.length === 0 ? (
                            <EmptyChartState
                                variant="pie"
                                message="Aucun statut"
                                className="scale-75 origin-top"
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={65}
                                        paddingAngle={4}
                                        dataKey="value"
                                        cornerRadius={4}
                                        stroke="none"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} wrapperStyle={{ outline: 'none' }} />
                                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Secondary Charts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Progress Distribution */}
                <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-4">Distribution de l'Avancement</h3>
                    <div className="h-[250px] w-full">
                        {progressData.every(d => d.value === 0) ? (
                            <EmptyChartState
                                variant="bar"
                                message="Pas de données d'avancement"
                                description="Mettez à jour les projets pour voir la distribution."
                                className="scale-75 origin-top"
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={progressData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={SENTINEL_PALETTE.secondary} stopOpacity={0.8} />
                                            <stop offset="100%" stopColor={SENTINEL_PALETTE.secondary} stopOpacity={0.3} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} wrapperStyle={{ outline: 'none' }} />
                                    <Bar dataKey="value" fill="url(#progressGradient)" radius={[6, 6, 0, 0]} barSize={40} animationDuration={1500} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Deadlines Chart (Replaces Placeholder) */}
                <div className="glass-premium p-4 sm:p-6 rounded-4xl border border-border/40">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider mb-4">Échéances à Venir (6 mois)</h3>
                    <div className="h-[250px] w-full">
                        {deadlineData.every(d => d.value === 0) ? (
                            <EmptyChartState
                                variant="bar"
                                message="Aucune échéance proche"
                                description="Vous êtes à jour !"
                                className="scale-75 origin-top"
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={deadlineData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="deadlineGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.8} />
                                            <stop offset="100%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.3} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} wrapperStyle={{ outline: 'none' }} />
                                    <Bar dataKey="value" fill="url(#deadlineGradient)" radius={[6, 6, 0, 0]} barSize={40} animationDuration={1500} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
