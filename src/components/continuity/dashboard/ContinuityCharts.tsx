import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, Legend, CartesianGrid, XAxis, YAxis
} from 'recharts';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { slideUpVariants } from '../../ui/animationVariants';
import { BusinessProcess, BcpDrill } from '../../../types';
import { EmptyChartState } from '../../ui/EmptyChartState';
import { SEVERITY_COLORS, SENTINEL_PALETTE } from '../../../theme/chartTheme';

interface ContinuityChartsProps {
    processes: BusinessProcess[];
    drills: BcpDrill[];
}

export const ContinuityCharts: React.FC<ContinuityChartsProps> = ({ processes, drills }) => {

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
            { name: 'Succès', value: counts.Succès, color: SENTINEL_PALETTE.success },
            { name: 'Partiel', value: counts.Partiel, color: SENTINEL_PALETTE.warning },
            { name: 'Échec', value: counts.Échec, color: SEVERITY_COLORS.critical }
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
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* 3. Distribution by Criticality (Pie) */}
            <motion.div variants={slideUpVariants} className="glass-premium text-card-foreground p-6 rounded-5xl border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
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
            <motion.div variants={slideUpVariants} className="glass-premium text-card-foreground p-6 rounded-5xl border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
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
            <motion.div variants={slideUpVariants} className="glass-premium text-card-foreground p-6 rounded-5xl border border-white/60 dark:border-white/5 relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
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
                                        <stop offset="0%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.8} />
                                        <stop offset="100%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.3} />
                                    </linearGradient>
                                    <linearGradient id="gradientFail" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.8} />
                                        <stop offset="100%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.3} />
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
    );
};
