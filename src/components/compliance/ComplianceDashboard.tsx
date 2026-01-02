import React, { useEffect, useState } from 'react';
import { Control } from '../../types';
import { Clock, AlertTriangle, TrendingUp, ShieldAlert, PieChart as PieChartIcon, BarChart3 as BarChartIcon, Target, RefreshCw } from '../ui/Icons';
import { Button } from '../ui/button';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { StatsService } from '../../services/statsService';
import { useStore } from '../../store';
import { ChartTooltip } from '../ui/ChartTooltip';
import { ErrorLogger } from '../../services/errorLogger';
import { EmptyChartState } from '../ui/EmptyChartState';

import { Skeleton } from '../ui/Skeleton';

interface ComplianceDashboardProps {
    controls: Control[];
    onFilterChange?: (status: string | null) => void;
    currentFramework?: string;
    onSeedData?: () => void;
    loading?: boolean;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ controls, onFilterChange, currentFramework = 'ISO27001', onSeedData, loading }) => {
    const { user } = useStore();
    const [trend, setTrend] = useState<number | undefined>(undefined);

    // ... existing hook logic ...

    // Chart Theme Configuration
    const chartTheme = {
        grid: 'hsl(var(--border) / 0.2)',
        text: 'hsl(var(--muted-foreground) / 0.7)',
        cursor: 'hsl(var(--muted-foreground) / 0.1)',
        colors: {
            implemented: 'hsl(var(--success))', // green-500
            partial: 'hsl(var(--warning))',     // amber-500
            notStarted: 'hsl(var(--destructive))',  // red-500
            notApplicable: 'hsl(var(--muted-foreground) / 0.55)',
            primary: 'hsl(var(--primary))',     // blue-500
            primaryDark: 'hsl(var(--primary) / 0.8)'
        }
    };

    // Calculate metrics
    const totalControls = controls.length;
    // ... (rest of calcs)
    const implementedControls = controls.filter(c => c.status === 'Implémenté').length;
    const inProgressControls = controls.filter(c => c.status === 'Partiel').length;
    const notImplementedControls = controls.filter(c => c.status === 'Non commencé').length;
    const notApplicableControls = controls.filter(c => c.status === 'Non applicable').length;

    const complianceRate = totalControls > 0 ? (implementedControls / totalControls * 100) : 0;
    const globalScore = complianceRate;

    // ... (trend effect)
    useEffect(() => {
        const fetchTrend = async () => {
            if (!user?.organizationId) return;
            try {
                // Get last 30 days history
                const history = await StatsService.getHistory(user.organizationId, 30);
                if (history.length >= 2) {
                    const current = history[history.length - 1].metrics.complianceRate;
                    const previous = history[0].metrics.complianceRate; // Compare with 30 days ago (or oldest available)
                    setTrend(Math.round(current - previous));
                }
            } catch (error) {
                ErrorLogger.error(error, 'ComplianceDashboard.fetchTrend');
            }
        };
        fetchTrend();
    }, [user?.organizationId]);


    const calculateScore = (fw: string) => {
        const fwControls = controls.filter(c => c.framework === fw);
        if (fwControls.length === 0) return 0;
        const implemented = fwControls.filter(c => c.status === 'Implémenté').length;
        return (implemented / fwControls.length) * 100;
    };

    const isoScore = calculateScore('ISO27001');
    const rgpdScore = calculateScore('GDPR');
    const doraScore = calculateScore('DORA');

    const alertsCount = notImplementedControls;
    const inProgressCount = inProgressControls;

    // Status distribution
    const statusData = [
        { name: 'Implémenté', value: implementedControls, color: chartTheme.colors.implemented },
        { name: 'Partiel', value: inProgressControls, color: chartTheme.colors.partial },
        { name: 'Non commencé', value: notImplementedControls, color: chartTheme.colors.notStarted },
        { name: 'Non applicable', value: notApplicableControls, color: chartTheme.colors.notApplicable }
    ];

    // Group by Domain (A.5 or NIS2.1)
    const domainData = controls.reduce((acc, control) => {
        if (!control.code) return acc;
        const parts = control.code.split('.');
        const domain = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0];

        if (!acc[domain]) {
            acc[domain] = { total: 0, implemented: 0, inProgress: 0 };
        }
        acc[domain].total++;
        if (control.status === 'Implémenté') acc[domain].implemented++;
        if (control.status === 'Partiel') acc[domain].inProgress++;
        return acc;
    }, {} as Record<string, { total: number; implemented: number; inProgress: number }>);

    const domainChartData = Object.entries(domainData).map(([domain, data]) => ({
        domain,
        rate: Math.round((data.implemented / data.total) * 100),
        total: data.total,
        implemented: data.implemented
    }));

    // Radar chart data for domains (Normalize to 0-100 scale properly and filter empty domains if needed)
    const radarData = Object.entries(domainData)
        .map(([domain, data]) => ({
            domain: domain,
            score: (data.implemented / data.total * 100)
        }))
        // Optional: you might want to slice if too many domains
        .slice(0, 8);

    // Critical controls (high priority)
    const criticalControls = controls.filter(c =>
        c.status !== 'Implémenté' &&
        c.code &&
        (c.code.includes('A.5.') || c.code.includes('A.8.') || c.code.includes('A.12.'))
    );

    const barGradientPrimaryId = React.useId();
    const barGradientSuccessId = React.useId();
    const radarGradientId = React.useId();

    if (loading) {
        return (
            <div className="space-y-6 w-full min-w-0">
                {/* Summary Card Skeleton */}
                <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 shadow-lg flex flex-col xl:flex-row gap-8">
                    <div className="flex items-center gap-6 min-w-[240px]">
                        <Skeleton className="w-24 h-24 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-32" />
                            <Skeleton className="h-4 w-24" />
                        </div>
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                        ))}
                    </div>
                </div>

                {/* Charts Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="glass-panel p-6 rounded-[2rem] h-[350px]">
                            <Skeleton className="h-6 w-48 mb-6" />
                            <Skeleton className="h-full w-full rounded-xl" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }


    return (
        <div className="space-y-6 w-full min-w-0">
            {/* Summary Card */}
            <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 shadow-lg flex flex-col xl:flex-row gap-8 relative overflow-hidden group hover:shadow-apple transition-all duration-500 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>

                {/* Left: Global Score */}
                <div className="flex items-center gap-6 md:p-8 min-w-[240px] z-10">
                    <div className="relative flex-shrink-0 group/ring">
                        <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="-14 -14 124 124">
                            <circle className="text-muted-foreground/10" strokeWidth="6" stroke="currentColor" fill="transparent" r="42" cx="48" cy="48" />
                            <circle
                                className="text-brand-600 transition-all duration-1000 ease-out"
                                strokeWidth="6"
                                strokeDasharray={263.89}
                                strokeDashoffset={263.89 - (263.89 * globalScore) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="42"
                                cx="48"
                                cy="48"
                                style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl font-black text-foreground">{globalScore.toFixed(0)}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Score {currentFramework}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">Conformité moyenne</p>
                        {trend !== undefined && (
                            <div className={`text-xs font-bold mt-2 px-2.5 py-1 rounded-lg w-fit inline-flex items-center gap-1 ${trend >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                <TrendingUp className="w-3.5 h-3.5" />
                                {trend > 0 ? '+' : ''}{trend}% vs 30j
                            </div>
                        )}
                    </div>
                </div>

                {/* Middle: Frameworks Mini-Cards */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
                    {(currentFramework === 'ISO27001' || isoScore > 0) && (
                        <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 border border-slate-100 dark:border-white/5 flex flex-col justify-between hover:scale-105 transition-transform duration-300">
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">ISO 27001</span>
                                <span className="text-sm font-black text-blue-600 dark:text-blue-400">{Math.round(isoScore)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${isoScore}%` }}></div>
                            </div>
                        </div>
                    )}
                    {(currentFramework === 'GDPR' || rgpdScore > 0) && (
                        <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 border border-slate-100 dark:border-white/5 flex flex-col justify-between hover:scale-105 transition-transform duration-300">
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">RGPD</span>
                                <span className="text-sm font-black text-purple-600 dark:text-purple-400">{Math.round(rgpdScore)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${rgpdScore}%` }}></div>
                            </div>
                        </div>
                    )}
                    {(currentFramework === 'DORA' || doraScore > 0) && (
                        <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 border border-slate-100 dark:border-white/5 flex flex-col justify-between hover:scale-105 transition-transform duration-300">
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">DORA</span>
                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{Math.round(doraScore)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${doraScore}%` }}></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Quick Stats */}
                <div className="flex xl:flex-col gap-3 min-w-[160px]">
                    <div
                        onClick={() => onFilterChange?.('Non commencé')}
                        onKeyDown={(e) => e.key === 'Enter' && onFilterChange?.('Non commencé')}
                        role="button"
                        tabIndex={0}
                        className="flex-1 flex items-center justify-between px-4 py-3 bg-red-50/80 dark:bg-red-900/10 rounded-xl border border-red-100/50 dark:border-red-900/20 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-red-600/70" />
                            <span className="text-xs font-bold text-red-700/70 dark:text-red-400/70">Alertes</span>
                        </div>
                        <span className="text-lg font-black text-red-700 dark:text-red-400">{alertsCount}</span>
                    </div>
                    <div
                        onClick={() => onFilterChange?.('Partiel')}
                        onKeyDown={(e) => e.key === 'Enter' && onFilterChange?.('Partiel')}
                        role="button"
                        tabIndex={0}
                        className="flex-1 flex items-center justify-between px-4 py-3 bg-amber-50/80 dark:bg-amber-900/10 rounded-xl border border-amber-100/50 dark:border-amber-900/20 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-600/70" />
                            <span className="text-xs font-bold text-amber-700/70 dark:text-amber-400/70">En cours</span>
                        </div>
                        <span className="text-lg font-black text-amber-700 dark:text-amber-400">{inProgressCount}</span>
                    </div>
                </div>
            </div>

            {/* Charts */}
            {totalControls > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 md:p-8">
                    {/* Status Distribution */}
                    <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 shadow-sm min-w-0 relative group hover:shadow-apple hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
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
                                        innerRadius={70}
                                        outerRadius={90}
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
                    <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 shadow-sm min-w-0 relative group hover:shadow-apple hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
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
                    <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 lg:col-span-2 xl:col-span-1 shadow-sm min-w-0 relative group hover:shadow-apple hover:-translate-y-1 transition-all duration-300 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
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
            ) : (
                <div className="flex flex-col items-center justify-center space-y-4">
                    <EmptyChartState
                        variant="bar"
                        message="Aucune donnée de conformité"
                        description="Commencez par importer les contrôles standards pour visualiser les graphiques."
                        className="glass-panel border-dashed p-12 w-full"
                    />
                    {onSeedData && (
                        <div className="flex gap-4">
                            <Button onClick={onSeedData} variant="default" className="gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Initialiser ISO 27001 (Standard)
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Critical Controls Not Implemented */}
            {criticalControls.length > 0 && (
                <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 relative group hover:shadow-apple overflow-hidden bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
                    <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 relative z-10">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Contrôles Critiques à Implémenter ({criticalControls.length})
                    </h4>
                    <div className="space-y-3 relative z-10">
                        {criticalControls.slice(0, 5).map((control, index) => (
                            <div key={`task-${index}`} className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-white/60 dark:border-white/10 hover:bg-white/70 dark:hover:bg-white/10 transition-colors">
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-foreground">{control.code} - {control.name}</p>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{control.description}</p>
                                </div>
                                <div className={`px-3 py-1 rounded-lg text-xs font-bold ${control.status === 'Partiel' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                    'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                    }`}>
                                    {control.status}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Domain Details */}
            <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 relative group hover:shadow-apple transition-all duration-300 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-[2rem]" />
                <h4 className="text-sm font-bold text-foreground mb-4 relative z-10 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-brand-500" />
                    Détail par Domaine {currentFramework}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                    {Object.entries(domainData).map(([domain, data]) => {
                        const rate = (data.implemented / data.total * 100);
                        return (
                            <div key={domain} className="p-4 bg-white/40 dark:bg-white/5 rounded-xl border border-white/60 dark:border-white/10 backdrop-blur-sm hover:scale-[1.02] transition-transform duration-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-foreground text-sm">{domain}</span>
                                    <span className="text-xs font-bold text-muted-foreground">{data.implemented}/{data.total}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 mb-2 overflow-hidden">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-1000 ease-out ${rate >= 80 ? 'bg-gradient-to-r from-emerald-500 to-green-600' :
                                            rate >= 50 ? 'bg-amber-500' :
                                                'bg-red-500'
                                            }`}
                                        style={{
                                            width: `${rate}%`
                                        }}
                                    ></div>
                                </div>
                                <div className="text-xs text-muted-foreground font-medium">
                                    {rate.toFixed(0)}% conformité
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
