import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { Activity, ShieldCheck, Zap, AlertTriangle, TrendingUp, History } from '../ui/Icons';
import { ChartTooltip } from '../ui/ChartTooltip';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';
import { BusinessProcess, BcpDrill } from '../../types';

interface ContinuityDashboardProps {
    processes: BusinessProcess[];
    drills: BcpDrill[];
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
            { name: 'Critique', value: counts.Critique, color: '#ef4444' }, // Red
            { name: 'Elevée', value: counts.Elevée, color: '#f97316' },   // Orange
            { name: 'Moyenne', value: counts.Moyenne, color: '#eab308' },  // Yellow
            { name: 'Faible', value: counts.Faible, color: '#22c55e' }    // Green
        ].filter(d => d.value > 0);
    }, [processes]);

    // 3. Chart Data: Drill Results
    const drillResultsData = useMemo(() => {
        const counts = { Succès: 0, Partiel: 0, Échec: 0 };
        drills.forEach(d => {
            if (d.result === 'Succès') counts.Succès++;
            else if (d.result === 'Partiel') counts.Partiel++;
            else if (d.result === 'Échec') counts.Échec++;
        });
        return [
            { name: 'Succès', value: counts.Succès, color: '#22c55e' },
            { name: 'Partiel', value: counts.Partiel, color: '#f59e0b' },
            { name: 'Échec', value: counts.Échec, color: '#ef4444' }
        ];
    }, [drills]);

    return (
        <motion.div variants={staggerContainerVariants} initial="hidden" animate="visible" className="space-y-6 mb-8">

            {/* Top Row: Global Health & KPIs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 1. Global Coverage Gauge (Radial) */}
                <motion.div variants={slideUpVariants} className="lg:col-span-2 glass-panel p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 pointer-events-none" />

                    <div className="flex items-center gap-8 relative z-10">
                        <div className="relative">
                            <svg className="w-32 h-32 transform -rotate-90">
                                <circle
                                    className="text-slate-100 dark:text-slate-800"
                                    strokeWidth="10"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="56"
                                    cx="64"
                                    cy="64"
                                />
                                <circle
                                    className={`${stats.coverageRate >= 80 ? 'text-emerald-500' : stats.coverageRate >= 50 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                                    strokeWidth="10"
                                    strokeDasharray={351}
                                    strokeDashoffset={351 - (351 * stats.coverageRate) / 100}
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="transparent"
                                    r="56"
                                    cx="64"
                                    cy="64"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.coverageRate}%</span>
                                <span className="text-[10px] uppercase font-bold text-slate-400">Couverture</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Santé de la Continuité</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[250px] leading-relaxed">
                                Pourcentage de processus critiques testés et validés au cours des 12 derniers mois.
                            </p>
                        </div>
                    </div>

                    {/* Quick Stats Grid inside the main card */}
                    <div className="flex-1 grid grid-cols-2 gap-4 border-l border-slate-200 dark:border-white/10 pl-6 lg:ml-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1 text-slate-500">
                                <History className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase">Tests Expirés</span>
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.overdueTests}</div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1 text-slate-500">
                                <Activity className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase">Processus Total</span>
                            </div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1 text-slate-500">
                                <ShieldCheck className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase">Critiques</span>
                            </div>
                            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{stats.critical}</div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1 text-slate-500">
                                <Zap className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase">Exercices</span>
                            </div>
                            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.totalDrills}</div>
                        </div>
                    </div>
                </motion.div>

                {/* 2. Drill Success Rate Card */}
                <motion.div variants={slideUpVariants} className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap className="h-24 w-24 text-brand-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Succès des Exercices</h3>
                        <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">{stats.successRate}%</div>
                        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg w-fit">
                            <TrendingUp className="h-3 w-3" />
                            <span>Taux de réussite global</span>
                        </div>
                    </div>

                    <div className="h-[100px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={drillResultsData}>
                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                    {drillResultsData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                                <RechartsTooltip
                                    cursor={{ fill: 'transparent' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-900 text-white text-xs py-1 px-2 rounded shadow-xl">
                                                    <span className="font-bold">{payload[0].payload.name}:</span> {payload[0].value}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>
            </div>

            {/* Bottom Row: Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 3. Distribution by Criticality (Pie) */}
                <motion.div variants={slideUpVariants} className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-6">Distribution par Criticité</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={criticalityData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {criticalityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <RechartsTooltip content={<ChartTooltip />} />
                                <Legend
                                    verticalAlign="middle"
                                    align="right"
                                    layout="vertical"
                                    iconType="circle"
                                    formatter={(value, entry: any) => (
                                        <span className="text-slate-600 dark:text-slate-300 text-sm font-medium ml-2">{value}</span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* 4. Placeholder for Timeline or future chart */}
                <motion.div variants={slideUpVariants} className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-800/50 [mask-image:linear-gradient(0deg,white,transparent)]" />
                    <div className="text-center relative z-10">
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-full mx-auto w-fit mb-4">
                            <Activity className="h-8 w-8 text-brand-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Chronologie des Incidents</h3>
                        <p className="text-sm text-slate-500 max-w-xs mx-auto">
                            Le module de gestion de crise affichera ici l'historique des incidents et leur résolution en temps réel.
                        </p>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};
