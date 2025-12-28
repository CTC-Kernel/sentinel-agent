import React, { useMemo } from 'react';
import { Project } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartTooltip } from '../ui/ChartTooltip';
import { TrendingUp } from '../ui/Icons';

interface PortfolioDashboardProps {
    projects: Project[];
}

export const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({ projects }) => {
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

    // Status Distribution Data
    const statusData = useMemo(() => [
        { name: 'En cours', value: projects.filter(p => p.status === 'En cours').length, color: '#3b82f6' },
        { name: 'Terminé', value: projects.filter(p => p.status === 'Terminé').length, color: '#10b981' },
        { name: 'Planifié', value: projects.filter(p => p.status === 'Planifié').length, color: '#f59e0b' },
        { name: 'Suspendu', value: projects.filter(p => p.status === 'Suspendu').length, color: '#64748b' }
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

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border border-dashed border-slate-300 dark:border-slate-700 min-h-[400px]">
                <div className="p-4 bg-white dark:bg-slate-800 rounded-full shadow-lg mb-4">
                    <TrendingUp className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Aucun projet en cours</h3>
                <p className="text-sm text-slate-500 max-w-sm">Créez votre premier projet pour suivre son avancement et piloter votre portefeuille.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Global Health - Radial Premium Card */}
                <div className="lg:col-span-2 glass-panel p-6 md:p-8 rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group border border-transparent dark:border-white/5 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 pointer-events-none" />
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="relative">
                            <svg className="w-24 h-24 transform -rotate-90">
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
                            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[250px]">Moyenne d'avancement globale.</p>
                        </div>
                    </div>
                    {/* Key Metrics */}
                    <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-slate-200 dark:border-white/10 px-6 mx-2">
                        <div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total</div>
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">En Cours</div>
                            <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">{stats.active}</div>
                        </div>
                        <div>
                            <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Retard</div>
                            <div className="text-2xl font-bold text-red-500">{stats.delayed}</div>
                        </div>
                    </div>
                </div>

                {/* Status Distribution */}
                <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Statut des Projets</h3>
                    <div className="h-[140px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.05)" />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} />
                                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Secondary Charts - Progress Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/5">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Distribution de l'Avancement</h3>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={progressData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                {/* Placeholder for Task Distribution or other metric */}
                <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/5 flex flex-col justify-center items-center text-center">
                    <div className="p-4 bg-brand-500/10 rounded-full mb-4">
                        <TrendingUp className="h-8 w-8 text-brand-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Performance Apprentissage</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-xs">L'IA analyse les délais de vos projets pour optimiser les échéances futures.</p>
                </div>
            </div>
        </div>
    );
};
