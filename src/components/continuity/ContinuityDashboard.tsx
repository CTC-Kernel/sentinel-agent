import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, Legend, CartesianGrid, XAxis, YAxis
} from 'recharts';
import { Activity, ShieldCheck, Zap, TrendingUp, History } from '../ui/Icons';
import { ChartTooltip } from '../ui/ChartTooltip';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';
import { BusinessProcess, BcpDrill } from '../../types';
import { EmptyChartState } from '../ui/EmptyChartState';
import { SEVERITY_COLORS } from '../../theme/chartTheme';

interface ContinuityDashboardProps {
    processes: BusinessProcess[];
    drills: BcpDrill[];
    loading?: boolean;
}

export const ContinuityDashboard: React.FC<ContinuityDashboardProps> = ({ processes, drills }) => {
    // 1. KPI Calculations
    const stats = useMemo(() => {
        const total = processes.length;
        const critical = processes.filter(p => p.priority === 'Critique').length;

        // Coverage (Tested in last 12 months)
        const testedProcesses = processes.filter(p => {
            if (!p.lastTestDate) return false;
            const lastTest = new Date(p.lastTestDate);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            return lastTest > oneYearAgo;
        }).length;

        const coverageRate = total > 0 ? Math.round((testedProcesses / total) * 100) : 0;
        const overdueTests = total - testedProcesses;

        // Drills
        const totalDrills = drills.length;
        const failedDrills = drills.filter(d => d.result === 'Échec').length;
        const successRate = totalDrills > 0
            ? Math.round(((totalDrills - failedDrills) / totalDrills) * 100)
            : 0;

        return { total, critical, coverageRate, overdueTests, totalDrills, successRate };
    }, [processes, drills]);

    // 2. Chart Data: Criticality Distribution
    const criticalityData = useMemo(() => {
        const counts = { Critique: 0, Elevée: 0, Moyenne: 0, Faible: 0 };
        processes.forEach(p => {
            if (counts[p.priority as keyof typeof counts] !== undefined) {
                counts[p.priority as keyof typeof counts]++;
            }
        });
        return [
            { name: 'Critique', value: counts.Critique, color: SEVERITY_COLORS.critical },
            { name: 'Elevée', value: counts.Elevée, color: SEVERITY_COLORS.high },
            { name: 'Moyenne', value: counts.Moyenne, color: SEVERITY_COLORS.medium },
            { name: 'Faible', value: counts.Faible, color: SEVERITY_COLORS.low }
        ].filter(d => d.value > 0);
    }, [processes]);

    // 3. Chart Data: Drill Results
    const drillResultsData = useMemo(() => {
        const counts = { Succès: 0, Partiel: 0, Échec: 0 };
        drills.forEach(d => {
            if (d.result === 'Succès') counts.Succès++;
            else if (d.result === 'Succès partiel') counts.Partiel++;
            else if (d.result === 'Échec') counts.Échec++;
        });
        return [
            { name: 'Succès', value: counts.Succès, color: '#10b981' },
            { name: 'Partiel', value: counts.Partiel, color: '#f59e0b' },
            { name: 'Échec', value: counts.Échec, color: '#ef4444' }
        ];
    }, [drills]);

    // 4. Chart Data: Drills Evolution (Last 12 Months)
    const drillsEvolutionData = useMemo(() => {
        const months = new Array(12).fill(0).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - 11 + i);
            return {
                name: d.toLocaleString('default', { month: 'short' }),
                date: d,
                success: 0,
                failure: 0,
                partial: 0
            };
        });

        drills.forEach(d => {
            const drillDate = new Date(d.date);
            const monthIndex = months.findIndex(m =>
                m.date.getMonth() === drillDate.getMonth() &&
                m.date.getFullYear() === drillDate.getFullYear()
            );

            if (monthIndex !== -1) {
                if (d.result === 'Succès') months[monthIndex].success++;
                else if (d.result === 'Échec') months[monthIndex].failure++;
                else months[monthIndex].partial++;
            }
        });

        return months;
    }, [drills]);

    return (
        <motion.div variants={staggerContainerVariants} initial="hidden" animate="visible" className="space-y-6 mb-8 animate-fade-in">

            {/* Top Row: Global Health & KPIs */}
            <div className="glass-premium p-6 md:p-8 rounded-[2.5rem] border border-white/60 dark:border-white/5 flex flex-col xl:flex-row gap-8 relative group overflow-hidden bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                {/* Tech Corners Generic */}
                <svg className="absolute top-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute top-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-100 opacity-70"></div>
                </div>

                {/* 1. Global Coverage Gauge (Radial) */}
                <div className="flex items-center gap-8 relative z-10 min-w-[300px]">
                    <div className="relative group/ring">
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
                                className={`${stats.coverageRate >= 80 ? 'text-emerald-500' : stats.coverageRate >= 50 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                                strokeWidth="8"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * stats.coverageRate) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="40"
                                cx="48"
                                cy="48"
                                style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-2xl font-black text-foreground tracking-tighter">{stats.coverageRate}%</span>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-foreground mb-1 uppercase tracking-wide font-mono">Santé BCP</h3>
                        <p className="text-xs text-muted-foreground max-w-[200px]">
                            Couverture des tests et validité des plans.
                        </p>
                    </div>
                </div>

                {/* Quick Stats Grid inside the main card */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 border-l border-r border-border/50 px-6 mx-2 relative z-10">
                    <div className="text-center group/metric">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <History className="h-4 w-4 text-slate-500 group-hover/metric:text-amber-500 transition-colors" />
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Expirés</div>
                        </div>
                        <div className="text-2xl font-black text-foreground group-hover/metric:scale-110 transition-transform duration-300">{stats.overdueTests}</div>
                    </div>
                    <div className="text-center group/metric">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Activity className="h-4 w-4 text-slate-500 group-hover/metric:text-brand-500 transition-colors" />
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Processus</div>
                        </div>
                        <div className="text-2xl font-black text-foreground group-hover/metric:scale-110 transition-transform duration-300">{stats.total}</div>
                    </div>
                    <div className="text-center group/metric">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <ShieldCheck className="h-4 w-4 text-slate-500 group-hover/metric:text-rose-500 transition-colors" />
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Critiques</div>
                        </div>
                        <div className="text-2xl font-black text-foreground group-hover/metric:scale-110 transition-transform duration-300">{stats.critical}</div>
                    </div>
                    <div className="text-center group/metric">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <Zap className="h-4 w-4 text-slate-500 group-hover/metric:text-blue-500 transition-colors" />
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">Exercices</div>
                        </div>
                        <div className="text-2xl font-black text-foreground group-hover/metric:scale-110 transition-transform duration-300">{stats.totalDrills}</div>
                    </div>
                </div>

                {/* Drill Success Rate Mini-Card */}
                <div className="min-w-[200px] flex flex-col justify-center relative z-10 pl-4">
                    <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors cursor-default mb-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide font-mono">Succès Drills</span>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl font-black text-foreground">{stats.successRate}%</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Taux de réussite</div>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* 3. Distribution by Criticality (Pie) */}
                <motion.div variants={slideUpVariants} className="glass-premium text-card-foreground p-6 rounded-[2.5rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                    {/* Tech Corners Generic */}
                    <svg className="absolute top-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute top-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                    <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wide font-mono text-muted-foreground">Criticité des Processus</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {criticalityData.length === 0 ? (
                                <EmptyChartState
                                    variant="pie"
                                    message="Aucun processus"
                                    description="Définissez vos processus business."
                                    className="scale-75 origin-top"
                                />
                            ) : (
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
                                        cornerRadius={4}
                                    >
                                        {criticalityData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} wrapperStyle={{ outline: 'none' }} />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconType="circle"
                                        iconSize={8}
                                        formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-wide">{value}</span>}
                                    />
                                </PieChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* 4. Drills Results (Donut/Bar) */}
                <motion.div variants={slideUpVariants} className="glass-premium text-card-foreground p-6 rounded-[2.5rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                    {/* Tech Corners Generic */}
                    <svg className="absolute top-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute top-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                    <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wide font-mono text-muted-foreground">Résultats des Exercices</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {drillResultsData.length === 0 ? (
                                <EmptyChartState
                                    variant="bar"
                                    message="Aucun exercice"
                                    description="Lancez des exercices de continuité."
                                    className="scale-75 origin-top"
                                />
                            ) : (
                                <BarChart data={drillResultsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                                        {drillResultsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} wrapperStyle={{ outline: 'none' }} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} allowDecimals={false} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* 5. Drills Timeline (New) */}
                <motion.div variants={slideUpVariants} className="glass-premium text-card-foreground p-6 rounded-[2.5rem] border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                    <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wide font-mono text-muted-foreground">Historique (12 Mois)</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {drillsEvolutionData.every(m => m.success === 0 && m.failure === 0 && m.partial === 0) ? (
                                <EmptyChartState
                                    variant="bar"
                                    message="Aucun historique"
                                    description="L'historique des exercices apparaîtra ici."
                                    className="scale-75 origin-top"
                                />
                            ) : (
                                <BarChart data={drillsEvolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradientSuccess" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
                                        </linearGradient>
                                        <linearGradient id="gradientFail" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} wrapperStyle={{ outline: 'none' }} />
                                    <Bar dataKey="success" name="Succès" stackId="a" fill="url(#gradientSuccess)" radius={[0, 0, 0, 0]} barSize={20} />
                                    <Bar dataKey="partial" name="Partiel" stackId="a" fill="hsl(var(--warning))" radius={[0, 0, 0, 0]} barSize={20} />
                                    <Bar dataKey="failure" name="Échec" stackId="a" fill="url(#gradientFail)" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};
