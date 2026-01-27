import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, Legend, CartesianGrid, XAxis, YAxis, RadialBarChart, RadialBar, Sector
} from 'recharts';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { slideUpVariants } from '../../ui/animationVariants';
import { BusinessProcess, BcpDrill } from '../../../types';
import { EmptyChartState } from '../../ui/EmptyChartState';
import { SEVERITY_COLORS, SENTINEL_PALETTE } from '../../../theme/chartTheme';
import { AlertTriangle, Target, Activity } from '../../ui/Icons';

interface ContinuityChartsProps {
    processes: BusinessProcess[];
    drills: BcpDrill[];
}

// Premium activeShape for interactive pie
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
    return (
        <g>
            <text x={cx} y={cy - 8} textAnchor="middle" className="fill-foreground font-black text-base">
                {payload.name}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted-foreground text-sm font-mono">
                {payload.value} ({(percent * 100).toFixed(0)}%)
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius - 6}
                outerRadius={outerRadius + 10}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
                style={{ filter: 'url(#continuityGlow)' }}
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={innerRadius - 4}
                outerRadius={outerRadius}
                fill={fill}
                stroke="none"
            />
        </g>
    );
};

export const ContinuityCharts: React.FC<ContinuityChartsProps> = ({ processes, drills }) => {
    const [activeCriticalityIndex, setActiveCriticalityIndex] = useState<number | null>(null);

    // Chart Data: Criticality Distribution
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

    // Chart Data: Drill Results
    const drillResultsData = useMemo(() => {
        const counts = { Succès: 0, Partiel: 0, Échec: 0 };
        drills.forEach(d => {
            if (d.result === 'Succès') counts.Succès++;
            else if (d.result === 'Succès partiel') counts.Partiel++;
            else if (d.result === 'Échec') counts.Échec++;
        });
        return [
            { name: 'Succès', value: counts.Succès, color: SENTINEL_PALETTE.success },
            { name: 'Partiel', value: counts.Partiel, color: SENTINEL_PALETTE.warning },
            { name: 'Échec', value: counts.Échec, color: SEVERITY_COLORS.critical }
        ].filter(d => d.value > 0);
    }, [drills]);

    // Drill success rate
    const drillSuccessRate = useMemo(() => {
        const total = drills.length;
        if (total === 0) return 0;
        const success = drills.filter(d => d.result === 'Succès').length;
        return Math.round((success / total) * 100);
    }, [drills]);

    // Chart Data: Drills Evolution (Last 12 Months)
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

    // Gauge data
    const successGaugeData = [{ name: 'Taux', value: drillSuccessRate, fill: 'url(#continuitySuccessGradient)' }];

    return (
        <div className="space-y-6">
            {/* SVG Defs */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <filter id="continuityGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="continuitySuccessGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={drillSuccessRate >= 80 ? SENTINEL_PALETTE.success : drillSuccessRate >= 50 ? SENTINEL_PALETTE.warning : SEVERITY_COLORS.critical} />
                        <stop offset="100%" stopColor={drillSuccessRate >= 80 ? '#10b981' : drillSuccessRate >= 50 ? '#f59e0b' : '#ef4444'} />
                    </linearGradient>
                    <linearGradient id="gradientSuccess" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="gradientFail" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.8} />
                        <stop offset="100%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.3} />
                    </linearGradient>
                </defs>
            </svg>

            {/* Success Rate Gauge Hero */}
            {drills.length > 0 && (
                <motion.div
                    variants={slideUpVariants}
                    initial="hidden"
                    animate="visible"
                    className="glass-premium p-6 rounded-3xl relative overflow-hidden hover:shadow-apple-lg transition-all duration-300"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent pointer-events-none" />
                    <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
                        <div className="relative">
                            <div className="h-[140px] w-[140px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" barSize={14} data={successGaugeData} startAngle={180} endAngle={0}>
                                        <RadialBar background={{ fill: 'hsl(var(--muted) / 0.3)' }} dataKey="value" cornerRadius={12} style={{ filter: 'url(#continuityGlow)' }} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 text-center">
                                <div className={`text-4xl font-black bg-gradient-to-r ${drillSuccessRate >= 80 ? 'from-emerald-600 to-emerald-400' : drillSuccessRate >= 50 ? 'from-amber-600 to-amber-400' : 'from-red-600 to-red-400'} bg-clip-text text-transparent`}>
                                    {drillSuccessRate}%
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-lg font-bold text-foreground mb-2 uppercase tracking-wide">Taux de Succès des Exercices</h3>
                            <p className="text-sm text-muted-foreground max-w-md">
                                {drills.filter(d => d.result === 'Succès').length} exercices réussis sur {drills.length} au total.
                                {drillSuccessRate >= 80 ? ' Excellente maîtrise de la continuité.' :
                                    drillSuccessRate >= 50 ? ' Des améliorations sont possibles.' :
                                        ' Actions correctives urgentes requises.'}
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Distribution by Criticality (Interactive Pie) */}
                <motion.div variants={slideUpVariants} initial="hidden" animate="visible" className="glass-premium p-6 rounded-3xl relative overflow-hidden group hover:shadow-apple-lg transition-all duration-300">
                    {/* Tech Corners */}
                    <svg className="absolute top-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute top-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />
                    <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider relative z-10 flex items-center gap-2">
                        <div className="p-2 bg-orange-500/10 rounded-xl">
                            <AlertTriangle className="w-4 h-4 text-orange-500" />
                        </div>
                        Criticité des Processus
                    </h3>
                    <div className="h-[280px] w-full relative z-10">
                        {criticalityData.length === 0 ? (
                            <EmptyChartState
                                variant="pie"
                                message="Aucun processus"
                                description="Définissez vos processus business."
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <defs>
                                        {criticalityData.map((entry, idx) => (
                                            <linearGradient key={idx} id={`contCritGrad${idx}`} x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                                <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <Pie
                                        data={criticalityData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="55%"
                                        outerRadius="75%"
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={6}
                                        activeIndex={activeCriticalityIndex !== null ? activeCriticalityIndex : undefined}
                                        activeShape={renderActiveShape}
                                        onMouseEnter={(_, index) => setActiveCriticalityIndex(index)}
                                        onMouseLeave={() => setActiveCriticalityIndex(null)}
                                    >
                                        {criticalityData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={`url(#contCritGrad${index})`} className="cursor-pointer" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} wrapperStyle={{ outline: 'none' }} />
                                    <Legend
                                        verticalAlign="bottom"
                                        height={36}
                                        iconType="circle"
                                        iconSize={10}
                                        formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-wide">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Drills Results (Bar Chart) */}
                <motion.div variants={slideUpVariants} initial="hidden" animate="visible" className="glass-premium p-6 rounded-3xl relative overflow-hidden group hover:shadow-apple-lg transition-all duration-300">
                    <svg className="absolute top-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute top-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />
                    <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider relative z-10 flex items-center gap-2">
                        <div className="p-2 bg-brand-50 rounded-xl">
                            <Target className="w-4 h-4 text-brand-500" />
                        </div>
                        Résultats des Exercices
                    </h3>
                    <div className="h-[280px] w-full relative z-10">
                        {drillResultsData.length === 0 ? (
                            <EmptyChartState
                                variant="bar"
                                message="Aucun exercice"
                                description="Lancez des exercices de continuité."
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={drillResultsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.1)' }} />
                                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40} animationDuration={1200}>
                                        {drillResultsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Drills Timeline (Stacked Bar) */}
                <motion.div variants={slideUpVariants} initial="hidden" animate="visible" className="glass-premium p-6 rounded-3xl relative overflow-hidden group hover:shadow-apple-lg transition-all duration-300">
                    <svg className="absolute top-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute top-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                    <svg className="absolute bottom-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-3xl" />
                    <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider relative z-10 flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 rounded-xl">
                            <Activity className="w-4 h-4 text-emerald-500" />
                        </div>
                        Historique (12 Mois)
                    </h3>
                    <div className="h-[280px] w-full relative z-10">
                        {drillsEvolutionData.every(m => m.success === 0 && m.failure === 0 && m.partial === 0) ? (
                            <EmptyChartState
                                variant="bar"
                                message="Aucun historique"
                                description="L'historique des exercices apparaîtra ici."
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={drillsEvolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.3)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.05)' }} />
                                    <Bar dataKey="success" name="Succès" stackId="a" fill="url(#gradientSuccess)" radius={[0, 0, 0, 0]} barSize={20} />
                                    <Bar dataKey="partial" name="Partiel" stackId="a" fill={SENTINEL_PALETTE.warning} radius={[0, 0, 0, 0]} barSize={20} />
                                    <Bar dataKey="failure" name="Échec" stackId="a" fill="url(#gradientFail)" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Legend
                                        iconSize={10}
                                        iconType="circle"
                                        wrapperStyle={{ paddingTop: '10px' }}
                                        formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1">{value}</span>}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
