import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { EmptyChartState } from '../../ui/EmptyChartState';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { GlassCard } from '../../ui/GlassCard';
import { DONUT_COLORS, SEVERITY_COLORS, CHART_AXIS_COLORS } from '../../../theme/chartTheme';

interface IncidentChartsProps {
    categoryData: { name: string; value: number }[];
    timelineData: { name: string; date: Date; count: number }[];
}

export const IncidentCharts: React.FC<IncidentChartsProps> = ({ categoryData, timelineData }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Incidents by Category */}
            <GlassCard className="p-6 rounded-3xl relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wide font-mono text-muted-foreground">Par Catégorie</h4>
                <div className="h-[250px] w-full">
                    {categoryData.length === 0 ? (
                        <EmptyChartState variant="pie" message="Aucune catégorie" />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={65}
                                    outerRadius={85}
                                    paddingAngle={4}
                                    dataKey="value"
                                    stroke="none"
                                    cornerRadius={4}
                                >
                                    {categoryData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={DONUT_COLORS.category[index % DONUT_COLORS.category.length]} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} wrapperStyle={{ outline: 'none' }} />
                                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </GlassCard>

            {/* Incidents Timeline (Last 6 Months) */}
            <GlassCard className="p-6 rounded-3xl relative overflow-hidden group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wide font-mono text-muted-foreground">Historique (6 mois)</h4>
                <div className="h-[250px] w-full">
                    {timelineData.length === 0 ? (
                        <EmptyChartState variant="bar" message="Aucun historique récent" />
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={timelineData}
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="incidentGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={SEVERITY_COLORS.high} stopOpacity={0.8} />
                                        <stop offset="100%" stopColor={SEVERITY_COLORS.high} stopOpacity={0.3} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_AXIS_COLORS.grid} strokeOpacity={CHART_AXIS_COLORS.gridOpacity} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 12 }} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} wrapperStyle={{ outline: 'none' }} />
                                <Bar dataKey="count" fill="url(#incidentGradient)" radius={[6, 6, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </GlassCard>
        </div>
    );
};
