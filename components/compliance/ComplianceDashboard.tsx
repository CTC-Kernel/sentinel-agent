import React, { useEffect, useState } from 'react';
import { Control } from '../../types';
import { CheckCircle2, XCircle, Clock, AlertTriangle, TrendingUp } from '../ui/Icons';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { StatsService } from '../../services/statsService';
import { useStore } from '../../store';
import { ChartTooltip } from '../ui/ChartTooltip';
import { ErrorLogger } from '../../services/errorLogger';

interface ComplianceDashboardProps {
    controls: Control[];
    onFilterChange?: (status: string | null) => void;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ controls, onFilterChange }) => {
    const { user, theme } = useStore();
    const [trend, setTrend] = useState<number | undefined>(undefined);

    // Chart Theme Configuration
    const chartTheme = {
        grid: theme === 'dark' ? '#334155' : '#e2e8f0',
        text: theme === 'dark' ? '#94a3b8' : '#64748b',
        tooltip: {
            bg: theme === 'dark' ? '#0f172a' : '#ffffff',
            border: theme === 'dark' ? '#1e293b' : '#e2e8f0',
            text: theme === 'dark' ? '#f8fafc' : '#0f172a'
        },
        colors: {
            implemented: '#10b981', // Emerald 500 - Softer than green
            partial: '#f59e0b',     // Amber 500 - Warmer than yellow
            notStarted: '#f43f5e',  // Rose 500 - Less harsh than red
            notApplicable: theme === 'dark' ? '#475569' : '#94a3b8',
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
    // Calculate metrics
    const totalControls = controls.length;
    const implementedControls = controls.filter(c => c.status === 'Implémenté').length;
    const inProgressControls = controls.filter(c => c.status === 'Partiel').length;
    const notImplementedControls = controls.filter(c => c.status === 'Non commencé').length;
    const notApplicableControls = controls.filter(c => c.status === 'Non applicable').length;

    const complianceRate = totalControls > 0 ? (implementedControls / totalControls * 100) : 0;
    const progressRate = totalControls > 0 ? ((implementedControls + inProgressControls) / totalControls * 100) : 0;

    // Status distribution
    // Status distribution
    const statusData = [
        { name: 'Implémenté', value: implementedControls, color: chartTheme.colors.implemented },
        { name: 'Partiel', value: inProgressControls, color: chartTheme.colors.partial },
        { name: 'Non commencé', value: notImplementedControls, color: chartTheme.colors.notStarted },
        { name: 'Non applicable', value: notApplicableControls, color: chartTheme.colors.notApplicable }
    ];

    // Group by Annex A domain
    // Group by Domain (A.5 or NIS2.1)
    const domainData = controls.reduce((acc, control) => {
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
        (c.code.includes('A.5.') || c.code.includes('A.8.') || c.code.includes('A.12.'))
    );

    return (
        <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Compliance Rate */}
                <div
                    onClick={() => onFilterChange?.('Implémenté')}
                    className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 cursor-pointer hover:scale-[1.02] transition-transform shadow-sm"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Conformité</span>
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex items-end gap-2">
                        <div className="text-3xl font-bold text-emerald-800 dark:text-emerald-200">{complianceRate.toFixed(0)}%</div>
                        {trend !== undefined && (
                            <div className={`text-xs font-bold mb-1.5 px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                                {trend > 0 ? '+' : ''}{trend}%
                            </div>
                        )}
                    </div>
                    <div className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">{implementedControls}/{totalControls} contrôles</div>
                </div>

                {/* In Progress */}
                <div
                    onClick={() => onFilterChange?.('Partiel')}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 cursor-pointer hover:scale-[1.02] transition-transform shadow-sm"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">En Cours</span>
                        <Clock className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">{inProgressControls}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{((inProgressControls / totalControls) * 100).toFixed(0)}% du total</div>
                </div>

                {/* Not Implemented */}
                <div
                    onClick={() => onFilterChange?.('Non commencé')}
                    className="bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/10 dark:to-red-900/10 p-6 rounded-2xl border border-rose-100 dark:border-rose-900/30 cursor-pointer hover:scale-[1.02] transition-transform shadow-sm"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">À Implémenter</span>
                        <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="text-3xl font-bold text-rose-800 dark:text-rose-200">{notImplementedControls}</div>
                    <div className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1 font-medium">Priorité haute</div>
                </div>

                {/* Progress Rate */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Progression</span>
                        <TrendingUp className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{progressRate.toFixed(0)}%</div>
                    <div className="text-xs text-slate-500 mt-1">Implémenté + En cours</div>
                </div>
            </div>

            {/* Charts */}
            {totalControls > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Status Distribution */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-6 uppercase tracking-wider">Distribution par Statut</h4>
                        <div className="h-[250px] w-full">
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
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-6 uppercase tracking-wider">Conformité par Domaine (Annexe A)</h4>
                        <div className="h-[250px] w-full">
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
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(148, 163, 184, 0.1)' }} />
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
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 lg:col-span-2 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-6 uppercase tracking-wider">Vue Radar - Maturité par Domaine</h4>
                        <div className="h-[350px] w-full">
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
                <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 border-dashed">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full mb-4">
                        <TrendingUp className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Aucune donnée de conformité</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
                        Commencez par importer ou créer des contrôles pour visualiser les graphiques de conformité.
                    </p>
                </div>
            )}

            {/* Critical Controls Not Implemented */}
            {criticalControls.length > 0 && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Contrôles Critiques à Implémenter ({criticalControls.length})
                    </h4>
                    <div className="space-y-3">
                        {criticalControls.slice(0, 5).map((control, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800/50">
                                <div className="flex-1">
                                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{control.code} - {control.name}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-1">{control.description}</p>
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
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Détail par Domaine ISO 27001</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(domainData).map(([domain, data]) => {
                        const rate = (data.implemented / data.total * 100);
                        return (
                            <div key={domain} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-slate-900 dark:text-slate-100">{domain}</span>
                                    <span className="text-xs font-bold text-slate-500">{data.implemented}/{data.total}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                                    <div
                                        className="h-2 rounded-full transition-all duration-500"
                                        style={{
                                            width: `${rate}%`,
                                            backgroundColor: rate >= 80 ? chartTheme.colors.implemented : rate >= 50 ? chartTheme.colors.partial : chartTheme.colors.notStarted
                                        }}
                                    ></div>
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-400">
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
