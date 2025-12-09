import React from 'react';
import { TrendingUp } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartTooltip } from '../../ui/ChartTooltip';

interface ComplianceEvolutionWidgetProps {
    historyData: any[];
    loading: boolean;
    t: (key: string) => string;
    theme: string;
}

export const ComplianceEvolutionWidget: React.FC<ComplianceEvolutionWidgetProps> = ({ historyData, loading, t, theme }) => {
    return (
        <div className="glass-panel p-0 rounded-[2rem] lg:col-span-2 flex flex-col overflow-hidden shadow-sm h-full min-h-[450px] group hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between px-8 pt-8 pb-6 bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/5 backdrop-blur-sm">
                <div><h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('dashboard.complianceEvolution')}</h3><p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{t('dashboard.last30Days')}</p></div>
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20"><TrendingUp className="w-5 h-5 text-emerald-500" /></div>
            </div>
            <div className="flex-1 w-full p-6 bg-white/40 dark:bg-transparent">
                {loading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData}>
                            <defs>
                                <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'} opacity={0.5} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                                tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }} />
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
        </div>
    );
};
