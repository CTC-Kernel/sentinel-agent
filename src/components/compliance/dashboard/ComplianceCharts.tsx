import React from 'react';
import { Control } from '../../../types';
import { PieChart as PieChartIcon, BarChart3 as BarChartIcon, Target } from '../../ui/Icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { ChartTooltip } from '../../ui/ChartTooltip';

interface ComplianceChartsProps {
    controls: Control[];
    currentFramework: string;
}

export const ComplianceCharts: React.FC<ComplianceChartsProps> = ({
    controls,
    currentFramework
}) => {
    // Chart Theme Configuration
    const chartTheme = {
        grid: 'hsl(var(--border) / 0.2)',
        text: 'hsl(var(--muted-foreground) / 0.7)',
        cursor: 'hsl(var(--muted-foreground) / 0.1)',
        colors: {
            implemented: 'hsl(var(--success))',
            partial: 'hsl(var(--warning))',
            notStarted: 'hsl(var(--destructive))',
            notApplicable: 'hsl(var(--muted-foreground) / 0.55)',
            primary: 'hsl(var(--primary))',
            primaryDark: 'hsl(var(--primary) / 0.8)'
        }
    };

    const implementedControls = controls.filter(c => c.status === 'Implémenté').length;
    const inProgressControls = controls.filter(c => c.status === 'Partiel').length;
    const notImplementedControls = controls.filter(c => c.status === 'Non commencé').length;
    const notApplicableControls = controls.filter(c => c.status === 'Non applicable').length;

    // Status distribution
    const statusData = [
        { name: 'Implémenté', value: implementedControls, color: chartTheme.colors.implemented },
        { name: 'Partiel', value: inProgressControls, color: chartTheme.colors.partial },
        { name: 'Non commencé', value: notImplementedControls, color: chartTheme.colors.notStarted },
        { name: 'Non applicable', value: notApplicableControls, color: chartTheme.colors.notApplicable }
    ];

    // Group by Domain
    const domainData = controls.reduce((acc, control) => {
        if (!control.code) return acc;
        const parts = control.code.split('.');
        const domain = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];

        if (!acc[domain]) {
            acc[domain] = { total: 0, implemented: 0, inProgress: 0 };
        }
        acc[domain].total++;
        if (control.status === 'Implémenté') acc[domain].implemented++;
        acc[domain].inProgress++; // Simplified: tracks all existence
        return acc;
    }, {} as Record<string, { total: number; implemented: number; inProgress: number }>);

    const domainChartData = Object.entries(domainData).map(([domain, data]) => ({
        domain,
        rate: Math.round((data.implemented / data.total) * 100),
        total: data.total,
        implemented: data.implemented
    }));

    const radarData = Object.entries(domainData)
        .map(([domain, data]) => ({
            domain: domain,
            score: (data.implemented / data.total * 100)
        }))
        .slice(0, 8);

    const barGradientPrimaryId = React.useId();
    const barGradientSuccessId = React.useId();
    const radarGradientId = React.useId();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:p-8">
            {/* Status Distribution */}
            <div className="glass-premium p-6 md:p-8 rounded-[2rem] shadow-sm min-w-0 relative group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
                <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
                    <PieChartIcon className="w-4 h-4 text-brand-500" />
                    Distribution par Statut
                </h4>
                <div className="h-[280px] w-full min-h-[280px] relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <defs>
                                {statusData.map((entry, index) => (
                                    <linearGradient key={`grad-${index}`} id={`pieStatusGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <Pie
                                data={statusData}
                                cx="50%"
                                cy="50%"
                                innerRadius="60%"
                                outerRadius="80%"
                                paddingAngle={4}
                                dataKey="value"
                                stroke="none"
                            >
                                {statusData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={`url(#pieStatusGradient-${index})`} className="drop-shadow-sm" />
                                ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} cursor={false} />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-wide">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Domain Progress */}
            <div className="glass-premium p-6 md:p-8 rounded-[2rem] shadow-sm min-w-0 relative group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
                <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
                    <BarChartIcon className="w-4 h-4 text-brand-500" />
                    Conformité par Domaine ({currentFramework})
                </h4>
                <div className="h-[280px] w-full min-h-[280px] relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={domainChartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                            <defs>
                                <linearGradient id={barGradientPrimaryId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartTheme.colors.primary} stopOpacity={1} />
                                    <stop offset="100%" stopColor={chartTheme.colors.primaryDark} stopOpacity={0.8} />
                                </linearGradient>
                                <linearGradient id={barGradientSuccessId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={1} />
                                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.8} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                            <XAxis
                                dataKey="domain"
                                stroke={chartTheme.text}
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke={chartTheme.text}
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: chartTheme.cursor, radius: 4 }} />
                            <Bar dataKey="rate" name="Taux %" fill={chartTheme.colors.primary} radius={[6, 6, 0, 0]} barSize={24} animationDuration={1000}>
                                {domainChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.rate >= 80 ? `url(#${barGradientSuccessId})` : entry.rate >= 50 ? chartTheme.colors.partial : `url(#${barGradientPrimaryId})`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Radar Chart */}
            <div className="glass-premium p-6 md:p-8 rounded-[2rem] lg:col-span-2 xl:col-span-1 shadow-sm min-w-0 relative group hover:shadow-apple hover:-translate-y-1 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
                <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-wider relative z-10 flex items-center gap-2">
                    <Target className="w-4 h-4 text-brand-500" />
                    Vue Radar - Maturité par Domaine
                </h4>
                <div className="h-[280px] w-full min-h-[280px] relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                            <defs>
                                <linearGradient id={radarGradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartTheme.colors.primary} stopOpacity={0.6} />
                                    <stop offset="100%" stopColor={chartTheme.colors.primaryDark} stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <PolarGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                            <PolarAngleAxis dataKey="domain" tick={{ fill: chartTheme.text, fontSize: 10, fontWeight: 600 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: chartTheme.text, fontSize: 9 }} axisLine={false} />
                            <Radar
                                name="Conformité %"
                                dataKey="score"
                                stroke={chartTheme.colors.primary}
                                strokeWidth={3}
                                fill={`url(#${radarGradientId})`}
                                fillOpacity={1}
                                isAnimationActive={true}
                                style={{ filter: 'drop-shadow(0 0 4px hsl(var(--primary) / 0.5))' }}
                            />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend formatter={(value) => <span className="text-xs font-bold text-muted-foreground ml-1 uppercase tracking-wide">{value}</span>} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
