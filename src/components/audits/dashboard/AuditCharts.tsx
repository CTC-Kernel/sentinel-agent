import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PieChart as PieChartIcon, BarChart3 as BarChartIcon } from '../../ui/Icons';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { EmptyChartState } from '../../ui/EmptyChartState';
import { slideUpVariants } from '../../ui/animationVariants';

interface AuditChartsProps {
    statusData: Array<{ name: string; value: number; color: string }>;
    findingsByType: Array<{ name: string; value: number }>;
}

export const AuditCharts: React.FC<AuditChartsProps> = ({ statusData, findingsByType }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
            {/* Status Distribution */}
            <motion.div variants={slideUpVariants} className="glass-premium p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                {/* Tech Corners Generic */}
                <svg className="absolute top-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute top-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
                <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-brand-500" />
                    Statut des Audits
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                    {statusData.length === 0 ? (
                        <EmptyChartState
                            variant="pie"
                            message="Aucune donnée"
                            className="scale-90"
                        />
                    ) : (
                        <PieChart>
                            <Pie
                                data={statusData}
                                cx="50%"
                                cy="50%"
                                innerRadius="60%"
                                outerRadius="80%"
                                paddingAngle={4}
                                dataKey="value"
                                stroke="none"
                                cornerRadius={4}
                            >
                                {statusData.map((entry, index) => (
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
                    )}
                </ResponsiveContainer>
            </motion.div>

            {/* Findings by Type */}
            <motion.div variants={slideUpVariants} className="glass-premium p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                {/* Tech Corners Generic */}
                <svg className="absolute top-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute top-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-5 left-5 w-3 h-3 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-5 right-5 w-3 h-3 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
                <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
                    <BarChartIcon className="w-4 h-4 text-brand-500" />
                    Constats par Type
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                    {findingsByType.length === 0 ? (
                        <EmptyChartState
                            variant="bar"
                            message="Aucun constat"
                            className="scale-90"
                        />
                    ) : (
                        <BarChart data={findingsByType} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={'#94a3b8'} strokeOpacity={0.1} />
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
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
                                {findingsByType.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.name === 'Majeure' ? '#EF4444' : entry.name === 'Mineure' ? '#F59E0B' : '#3B82F6'} />
                                ))}
                            </Bar>
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </motion.div>
        </div>
    );
};
