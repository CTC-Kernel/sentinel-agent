// DIAGNOSTIC PHASE 6: FINAL CLEANUP & COMPLETED FIX
import React, { useState, useId } from 'react';
import { TrendingUp } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { DashboardCard } from '../DashboardCard';
import { EmptyChartState } from '../../ui/EmptyChartState';
import i18n from '../../../i18n';

interface ComplianceEvolutionWidgetProps {
    historyData: { date: string; compliance: number }[];
    loading: boolean;
    t: (key: string) => string;
    theme: string;
}

export const ComplianceEvolutionWidget: React.FC<ComplianceEvolutionWidgetProps> = React.memo(({ historyData, loading, t, theme }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [timeRange, setTimeRange] = useState<'30d' | '90d' | '1y' | 'all'>('30d');
    const gradientId = useId();

    const chartColors = {
        grid: theme === 'dark' ? 'hsl(var(--border) / 0.35)' : 'hsl(var(--border) / 0.6)',
        text: 'hsl(var(--muted-foreground))',
        cursor: 'hsl(var(--muted-foreground) / 0.15)',
        stroke: 'hsl(var(--primary))',
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
            icon={<TrendingUp className="w-5 h-5 text-success" />}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandable={true}
            className="lg:col-span-2 min-h-[400px]"
            headerAction={
                <div 
                    className="flex bg-slate-100 dark:bg-white/5 rounded-lg p-1 gap-1 cursor-default hover:bg-slate-200 dark:hover:bg-white/10 transition-colors" 
                    role="group" 
                    aria-label={t('dashboard.selectPeriod')}
                >
                    {(['30d', '90d', '1y', 'all'] as const).map(range => (
                        <button
                            key={range || 'unknown'}
                            onClick={(e) => { e.stopPropagation(); setTimeRange(range); }}
                            className={`px-2 py-1 text-[11px] font-bold rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${timeRange === range
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
                    <EmptyChartState
                        message={t('dashboard.noDataAvailable')}
                        description={t('dashboard.complianceValuesWillAppearHere')}
                        variant="line"
                    />
                ) : (
                    /* FIXED: Explicit height to prevent collapse */
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={undefined}>
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
                                    tickFormatter={(value) => new Date(value).toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit' })}
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
                                    dot={(props: { cx: number; cy: number; index: number }) => {
                                        const { cx, cy, index } = props;
                                        const isLast = index === filteredData.length - 1;
                                        if (!isLast) return <circle key={`dot-${index || 'unknown'}`} cx={cx} cy={cy} r={0} />;
                                        return (
                                            <g key={`dot-group-${index || 'unknown'}`}>
                                                <circle cx={cx} cy={cy} r={6} fill={chartColors.stroke} className="animate-ping opacity-75" />
                                                <circle cx={cx} cy={cy} r={4} fill={chartColors.fill} stroke={chartColors.stroke} strokeWidth={2} />
                                            </g>
                                        );
                                    }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
});

ComplianceEvolutionWidget.displayName = 'ComplianceEvolutionWidget';
