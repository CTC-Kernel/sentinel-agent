import React, { useState, useId } from 'react';
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
    const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y' | 'all'>('30d');
    const gradientId = useId();

    const chartColors = {
        grid: theme === 'dark' ? 'hsl(var(--border) / 0.35)' : 'hsl(var(--border) / 0.6)',
        text: 'hsl(var(--muted-foreground))',
        cursor: 'hsl(var(--muted-foreground) / 0.15)',
        stroke: 'hsl(var(--primary))', // Use primary color for better visibility
        fill: 'hsl(var(--primary))'
    };

    const filteredData = React.useMemo(() => {
        if (!historyData) return [];
        const now = new Date();
        const cutoff = new Date();

        switch (timeRange) {
            case '30d': cutoff.setDate(now.getDate() - 30); break;
            case '90d': cutoff.setDate(now.getDate() - 90); break;
            case '1y': cutoff.setFullYear(now.getFullYear() - 1); break;
            case 'all': return historyData;
        }

        return historyData.filter(d => new Date(d.date) >= cutoff);
    }, [historyData, timeRange]);

    const getSubtitle = () => {
        switch (timeRange) {
            case '30d': return t('dashboard.last30Days');
            case '90d': return t('dashboard.last90Days');
            case '1y': return t('dashboard.lastYear');
            case 'all': return t('dashboard.allTime');
            default: return t('dashboard.last30Days');
        }
    };

    return (
        <DashboardCard
            title={t('dashboard.complianceEvolution')}
            subtitle={getSubtitle()}
            icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandable={true}
            className="lg:col-span-2 min-h-[400px]"
            headerAction={
                <div className="flex bg-slate-100 dark:bg-white/5 rounded-lg p-1 gap-1" onClick={(e) => e.stopPropagation()}>
                    {(['30d', '90d', '1y', 'all'] as const).map(range => (
                        <button
                            key={range}
                            onClick={(e) => { e.stopPropagation(); setTimeRange(range); }}
                            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${timeRange === range
                                ? 'bg-white dark:bg-slate-700 shadow-sm text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {range.toUpperCase()}
                        </button>
                    ))}
                </div>
            }
        >
            <div className="w-full h-full p-6">
                {loading ? (
                    <Skeleton className="h-full w-full rounded-2xl" />
                ) : !filteredData || filteredData.length === 0 ? (
                    <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 animate-fade-in">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-3 ring-1 ring-slate-100 dark:ring-white/5">
                            <TrendingUp className="w-6 h-6 opacity-40" />
                        </div>
                        <p className="text-sm font-medium">{t('dashboard.noDataAvailable')}</p>
                    </div>
                ) : (
                    <div className="w-full h-full min-h-[300px] relative">
                        {/* Debug info - hidden in production if needed, or remove later */}
                        {filteredData.length > 0 && false && (
                            <div className="absolute top-0 left-0 text-xs bg-red-100 z-50">
                                Data Points: {filteredData.length}
                            </div>
                        )}
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartColors.stroke} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={chartColors.stroke} stopOpacity={0} />
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
                                <Tooltip content={<ChartTooltip />} cursor={{ stroke: chartColors.stroke, strokeWidth: 1, strokeDasharray: '4 4', fill: chartColors.cursor }} />
                                <Area
                                    type="monotone"
                                    dataKey="compliance"
                                    name={t('dashboard.compliance')}
                                    stroke={chartColors.stroke}
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill={`url(#${gradientId})`}
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
};
