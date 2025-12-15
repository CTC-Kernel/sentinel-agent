import React, { useEffect, useState } from 'react';
import { Control } from '../../types';
import { Clock, AlertTriangle, TrendingUp, ShieldAlert } from '../ui/Icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { StatsService } from '../../services/statsService';
import { useStore } from '../../store';
import { ChartTooltip } from '../ui/ChartTooltip';
import { ErrorLogger } from '../../services/errorLogger';

interface ComplianceDashboardProps {
    controls: Control[];
    onFilterChange?: (status: string | null) => void;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ controls }) => {
    const { user, theme } = useStore();
    const [trend, setTrend] = useState<number | undefined>(undefined);

    // Chart Theme Configuration
    const chartTheme = {
        grid: theme === 'dark' ? 'hsl(var(--border) / 0.35)' : 'hsl(var(--border) / 0.6)',
        text: 'hsl(var(--muted-foreground))',
        tooltip: {
            bg: 'hsl(var(--background))',
            border: 'hsl(var(--border))',
            text: 'hsl(var(--foreground))'
        },
        colors: {
            implemented: '#10b981', // Emerald 500 - Softer than green
            partial: '#f59e0b',     // Amber 500 - Warmer than yellow
            notStarted: '#f43f5e',  // Rose 500 - Less harsh than red
            notApplicable: 'hsl(var(--muted-foreground) / 0.55)',
            primary: '#6366f1'      // Indigo 500 - More premium than blue
        }
    };

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

    // Calculate metrics
    const totalControls = controls.length;
    const implementedControls = controls.filter(c => c.status === 'Implémenté').length;
    const inProgressControls = controls.filter(c => c.status === 'Partiel').length;
    const notImplementedControls = controls.filter(c => c.status === 'Non commencé').length;
    const notApplicableControls = controls.filter(c => c.status === 'Non applicable').length;

    const complianceRate = totalControls > 0 ? (implementedControls / totalControls * 100) : 0;
    const globalScore = complianceRate;

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
        rate: (data.implemented / data.total * 100).toFixed(0),
        total: data.total,
        implemented: data.implemented
    }));

    // Radar chart data for domains
    const radarData = Object.entries(domainData).map(([domain, data]) => ({
        domain: domain,
        score: (data.implemented / data.total * 100)
    }));

    // Critical controls (high priority)
    const criticalControls = controls.filter(c =>
        c.status !== 'Implémenté' &&
        c.code &&
        (c.code.includes('A.5.') || c.code.includes('A.8.') || c.code.includes('A.12.'))
    );

    return (
        <div className="space-y-6">
            {/* Summary Card */}
            {/* Compact Summary Card */}
            <div className="glass-panel p-6 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-lg flex flex-col xl:flex-row gap-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>

                {/* Left: Global Score */}
                <div className="flex items-center gap-5 min-w-[240px] z-10">
                    <div className="relative flex-shrink-0">
                        <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 96 96">
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
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-black text-foreground">{globalScore.toFixed(0)}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-foreground">Score Global</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Conformité moyenne</p>
                        {trend !== undefined && (
                            <div className={`text-[10px] font-bold mt-1.5 px-2 py-0.5 rounded-md w-fit inline-flex items-center gap-1 ${trend >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                <TrendingUp className="w-3 h-3" />
                                {trend > 0 ? '+' : ''}{trend}% vs 30j
                            </div>
                        )}
                    </div>
                </div>

                {/* Middle: Frameworks Mini-Cards */}
                <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5 flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">ISO 27001</span>
                            <span className="text-xs font-black text-blue-600 dark:text-blue-400">{Math.round(isoScore)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${isoScore}%` }}></div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5 flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">RGPD</span>
                            <span className="text-xs font-black text-purple-600 dark:text-purple-400">{Math.round(rgpdScore)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${rgpdScore}%` }}></div>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-100 dark:border-white/5 flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">DORA</span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{Math.round(doraScore)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${doraScore}%` }}></div>
                        </div>
                    </div>
                </div>

                {/* Right: Quick Stats */}
                <div className="flex xl:flex-col gap-3 min-w-[140px]">
                    <div className="flex-1 flex items-center justify-between px-3 py-2 bg-red-50/50 dark:bg-red-900/10 rounded-lg border border-red-100/50 dark:border-red-900/20">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-3.5 w-3.5 text-red-600/70" />
                            <span className="text-xs font-bold text-red-700/70 dark:text-red-400/70">Alertes</span>
                        </div>
                        <span className="text-sm font-black text-red-700 dark:text-red-400">{alertsCount}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-between px-3 py-2 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg border border-amber-100/50 dark:border-amber-900/20">
                        <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-amber-600/70" />
                            <span className="text-xs font-bold text-amber-700/70 dark:text-amber-400/70">En cours</span>
                        </div>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-400">{inProgressCount}</span>
                    </div>
                </div>
            </div>

            {/* Charts */}
            {totalControls > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Status Distribution */}
                    <div className="glass-panel p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm min-w-0 relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-2xl" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-6 uppercase tracking-wider relative z-10">Distribution par Statut</h4>
                        <div className="h-[250px] w-full relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
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
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Domain Progress */}
                    <div className="glass-panel p-6 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm min-w-0 relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-2xl" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-6 uppercase tracking-wider relative z-10">Conformité par Domaine (Annexe A)</h4>
                        <div className="h-[250px] w-full relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={domainChartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} opacity={0.5} />
                                    <XAxis
                                        dataKey="domain"
                                        stroke={chartTheme.text}
                                        fontSize={11}
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
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.12)' }} />
                                    <Bar dataKey="rate" name="Taux %" fill={chartTheme.colors.primary} radius={[4, 4, 0, 0]} barSize={30}>
                                        {domainChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={parseInt(entry.rate) >= 80 ? chartTheme.colors.implemented : parseInt(entry.rate) >= 50 ? chartTheme.colors.partial : chartTheme.colors.primary} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Radar Chart */}
                    <div className="glass-panel p-6 rounded-2xl border border-white/60 dark:border-white/10 lg:col-span-2 shadow-sm min-w-0 relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-2xl" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-6 uppercase tracking-wider relative z-10">Vue Radar - Maturité par Domaine</h4>
                        <div className="h-[350px] w-full relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                    <PolarGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                                    <PolarAngleAxis dataKey="domain" tick={{ fill: chartTheme.text, fontSize: 12, fontWeight: 500 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: chartTheme.text, fontSize: 10 }} axisLine={false} />
                                    <Radar
                                        name="Conformité %"
                                        dataKey="score"
                                        stroke={chartTheme.colors.primary}
                                        strokeWidth={3}
                                        fill={chartTheme.colors.primary}
                                        fillOpacity={0.2}
                                    />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend formatter={(value) => <span className="text-xs font-medium text-slate-600 dark:text-slate-400 ml-1">{value}</span>} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-12 glass-panel rounded-2xl border border-white/60 dark:border-white/10 border-dashed">
                    <div className="p-4 bg-slate-100 dark:bg-white/5 rounded-full mb-4">
                        <TrendingUp className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Aucune donnée de conformité</h3>
                    <p className="text-slate-500 text-center max-w-md">
                        Commencez par importer ou créer des contrôles pour visualiser les graphiques de conformité.
                    </p>
                </div>
            )}

            {/* Critical Controls Not Implemented */}
            {criticalControls.length > 0 && (
                <div className="glass-panel p-6 rounded-2xl border border-white/60 dark:border-white/10 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-2xl" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Contrôles Critiques à Implémenter ({criticalControls.length})
                    </h4>
                    <div className="space-y-3 relative z-10">
                        {criticalControls.slice(0, 5).map((control, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-white/60 dark:border-white/10">
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{control.code} - {control.name}</p>
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{control.description}</p>
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
            <div className="glass-panel p-6 rounded-2xl border border-white/60 dark:border-white/10 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none rounded-2xl" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-4 relative z-10">Détail par Domaine ISO 27001</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                    {Object.entries(domainData).map(([domain, data]) => {
                        const rate = (data.implemented / data.total * 100);
                        return (
                            <div key={domain} className="p-4 bg-white/40 dark:bg-white/5 rounded-xl border border-white/60 dark:border-white/10 backdrop-blur-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-slate-800 dark:text-white">{domain}</span>
                                    <span className="text-xs font-bold text-slate-500">{data.implemented}/{data.total}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 mb-2">
                                    <div
                                        className="h-2 rounded-full transition-all duration-500"
                                        style={{
                                            width: `${rate}%`,
                                            backgroundColor: rate >= 80 ? chartTheme.colors.implemented : rate >= 50 ? chartTheme.colors.partial : chartTheme.colors.notStarted
                                        }}
                                    ></div>
                                </div>
                                <div className="text-xs text-slate-500">
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
