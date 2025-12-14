import React, { useState } from 'react';
import { TrendingUp } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { DashboardCard } from '../DashboardCard';

interface ComplianceEvolutionWidgetProps {
    historyData: { date: string; compliance: number }[];
    loading: boolean;
    t: (key: string) => string;
    theme: string;
}

export const ComplianceEvolutionWidget: React.FC<ComplianceEvolutionWidgetProps> = ({ historyData, loading, t, theme }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const chartColors = {
        grid: theme === 'dark' ? 'hsl(var(--border) / 0.35)' : 'hsl(var(--border) / 0.6)',
        text: 'hsl(var(--muted-foreground))',
        cursor: 'hsl(var(--muted-foreground) / 0.15)'
    };

    return (
        <DashboardCard
            title={t('dashboard.complianceEvolution')}
            subtitle={t('dashboard.last30Days')}
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandable={true}
            className="lg:col-span-2 min-h-[400px]"
        >
            <div className="w-full h-full p-6">
                {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData}>
                            <defs>
                                <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} opacity={0.5} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: chartColors.text, fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                                tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis hide={!isExpanded} domain={[0, 100]} tick={{ fontSize: 11, fill: chartColors.text }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4', fill: chartColors.cursor }} />
                            <Area
                                type="monotone"
                                dataKey="compliance"
                                name={t('dashboard.compliance')}
                                stroke="#10b981"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorCompliance)"
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </DashboardCard>
    );
};
