// DIAGNOSTIC PHASE 5: RESTORE RECHARTS (FIXED HEIGHT)
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

export const ComplianceEvolutionWidget: React.FC<ComplianceEvolutionWidgetProps> = ({ historyData: _historyData, loading, t, theme }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y' | 'all'>('30d');
    const gradientId = useId();

    // DEBUG: MOCK DATA INJECTION (Keep this to prove rendering works first)
    const MOCK_DATA = [
        { date: '2025-01-01', compliance: 20 },
        { date: '2025-02-01', compliance: 45 },
        { date: '2025-03-01', compliance: 60 },
        { date: '2025-04-01', compliance: 75 },
        { date: '2025-05-01', compliance: 85 },
        { date: '2025-06-01', compliance: 90 },
    ];

    const chartColors = {
        grid: theme === 'dark' ? 'hsl(var(--border) / 0.35)' : 'hsl(var(--border) / 0.6)',
        text: 'hsl(var(--muted-foreground))',
        cursor: 'hsl(var(--muted-foreground) / 0.15)',
        stroke: 'hsl(var(--primary))', // Use primary color for better visibility
        fill: 'hsl(var(--primary))'
    };

    const filteredData = React.useMemo(() => {
        // FORCE MOCK DATA FOR DIAGNOSTIC
        return MOCK_DATA;
    }, []);

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
                ) : (
                    /* CRITICAL: Enforce explicit height in PX for diagnosic, remove h-full */
                    <div className="w-full h-[350px] relative border border-blue-300 border-dashed">
                        <div className="absolute top-0 right-0 text-xs text-blue-500 bg-blue-100 p-1 z-10">
                            Target Height: 350px
                        </div>
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
