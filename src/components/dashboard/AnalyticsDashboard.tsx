import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { Tooltip as UiTooltip } from '../ui/Tooltip';
import {
    TrendingUp,
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    HelpCircle
} from '../ui/Icons';
import { EmptyChartState } from '../ui/EmptyChartState';
import { useStore } from '../../store';
import { Risk } from '../../types';
import { StatCard } from '../ui/StatCard';
import { ProgressRing } from '../ui/ProgressRing';
import { DataTable } from '../ui/DataTable';
import { Badge } from '../ui/Badge';
import { ColumnDef } from '@tanstack/react-table';
import { StatsService } from '../../services/statsService';
import { OnboardingService } from '../../services/onboardingService';
import { useLayoutData } from '../../hooks/layout/useLayoutData';
import { useComplianceData } from '../../hooks/useComplianceData';
import { CHART_COLORS, RISK_COLORS, STATUS_COLORS, SLATE_COLORS } from '../../constants/colors';

interface TrendData {
    date: string;
    risks: number;
    incidents: number;
    compliance: number;
    assets: number;
}

interface CategoryData {
    name: string;
    value: number;
    color: string;
}

export const AnalyticsDashboard: React.FC = () => {
    const { user } = useStore();
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

    const chartColors = {
        grid: 'hsl(var(--border) / 0.6)',
        text: 'hsl(var(--muted-foreground))'
    };

    // Fetch data from hooks
    const { risks, assets, incidents, projects, loading: layoutLoading } = useLayoutData();
    const { controls, loading: complianceLoading } = useComplianceData();

    const loading = layoutLoading || complianceLoading;

    const [trends, setTrends] = useState({
        riskTrend: 0,
        incidentTrend: 0,
        complianceTrend: 0,
        projectTrend: 0
    });

    // Calculate metrics
    const metrics = useMemo(() => {
        const criticalRisks = risks.filter(r => (r.score || 0) >= 15).length;
        const openIncidents = incidents.filter(i => i.status !== 'Résolu').length;
        const complianceRate = controls.length > 0
            ? (controls.filter(c => c.status === 'Implémenté').length / controls.length) * 100
            : 0;
        const activeProjects = projects.filter(p => p.status === 'En cours').length;

        return {
            criticalRisks,
            openIncidents,
            complianceRate,
            activeProjects,
            trends
        };
    }, [risks, incidents, controls, projects, trends]);

    // Trend data for charts
    const [trendData, setTrendData] = useState<TrendData[]>([]);

    useEffect(() => {
        if (!user?.organizationId) return;

        const fetchHistory = async () => {
            // Trigger snapshot (will only run once per day per org)
            await StatsService.snapshotDailyStats(user.organizationId!);

            // Fetch history
            const history = await StatsService.getHistory(user.organizationId!, timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365);

            const mappedData: TrendData[] = history.map(day => ({
                date: new Date(day.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
                risks: day.metrics.totalRisks,
                incidents: day.metrics.openIncidents,
                compliance: day.metrics.complianceRate,
                assets: day.metrics.totalAssets
            }));

            // Calculate trends
            if (history.length >= 2) {
                const current = history[history.length - 1];
                const previous = history[history.length - 2];

                const calculateTrend = (curr: number, prev: number) => {
                    if (prev === 0) return curr > 0 ? 100 : 0;
                    return Number(((curr - prev) / prev * 100).toFixed(1));
                };

                setTrends({
                    riskTrend: calculateTrend(current.metrics.criticalRisks, previous.metrics.criticalRisks),
                    incidentTrend: calculateTrend(current.metrics.openIncidents, previous.metrics.openIncidents),
                    complianceTrend: calculateTrend(current.metrics.complianceRate, previous.metrics.complianceRate),
                    projectTrend: calculateTrend(current.metrics.activeProjects || 0, previous.metrics.activeProjects || 0)
                });
            }

            // If no history yet, show current state as a single point or empty
            if (mappedData.length === 0) {
                const criticalRisks = risks.filter(r => (r.score || 0) >= 15).length;
                const openIncidents = incidents.filter(i => i.status !== 'Résolu').length;
                const complianceRate = controls.length > 0
                    ? (controls.filter(c => c.status === 'Implémenté').length / controls.length) * 100
                    : 0;
                setTrendData([{
                    date: new Date().toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
                    risks: criticalRisks,
                    incidents: openIncidents,
                    compliance: complianceRate,
                    assets: assets.length
                }]);
            } else {
                setTrendData(mappedData);
            }
        };

        fetchHistory();
    }, [user?.organizationId, timeRange, risks, incidents, controls, assets.length]);

    // Risk distribution by category
    const risksByCategory: CategoryData[] = useMemo(() => {
        const categories: Record<string, number> = {};

        risks.forEach(risk => {
            const category = (risk as unknown as { category?: string }).category || 'Autre';
            categories[category] = (categories[category] || 0) + 1;
        });

        return Object.entries(categories).map(([name, value], idx) => ({
            name,
            value,
            color: CHART_COLORS[idx % CHART_COLORS.length]
        }));
    }, [risks]);

    // Top risks table columns
    const topRisksColumns: ColumnDef<Risk>[] = [
        {
            accessorKey: 'threat',
            header: 'Menace',
            cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>
        },
        {
            accessorKey: 'score',
            header: 'Score',
            cell: ({ getValue }) => {
                const value = getValue() as number;
                return (
                    <Badge
                        variant="soft"
                        status={value >= 15 ? 'error' : value >= 10 ? 'warning' : 'success'}
                    >
                        {value}
                    </Badge>
                );
            }
        },
        {
            accessorKey: 'status',
            header: 'Statut',
            cell: ({ getValue }) => {
                const status = (getValue() as string) || 'Ouvert';
                return (
                    <Badge status={status === 'Ouvert' ? 'info' : 'success'} variant="outline">
                        {status}
                    </Badge>
                );
            }
        },
        {
            accessorKey: 'responsable',
            header: 'Responsable',
            cell: ({ getValue }) => (getValue() as string) || '-'
        }
    ];

    const topRisks = useMemo(() => {
        return [...risks]
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 10);
    }, [risks]);

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-accent rounded w-1/4"></div>
                    <div className="grid grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={`chart-${i}`} className="h-32 bg-accent rounded-2xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 font-display tracking-tight">
                        Analytics Dashboard
                    </h1>
                    <p className="text-slate-700 dark:text-slate-400 font-medium">
                        Vue d'ensemble des métriques et tendances de sécurité
                    </p>
                </div>

                <div className="flex flex-wrap gap-3">
                    <UiTooltip content="Lancer une visite interactive du tableau de bord" position="bottom">
                        <button
                            onClick={() => OnboardingService.startAnalyticsTour()}
                            className="px-4 py-2 bg-white/50 dark:bg-slate-800/50 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-900/30 rounded-xl text-sm font-bold hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all flex items-center gap-2 backdrop-blur-sm"
                        >
                            <HelpCircle className="h-4 w-4" />
                            Visite guidée
                        </button>
                    </UiTooltip>

                    {/* Time range selector */}
                    <div className="flex gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-xl border border-white/20 dark:border-white/5 backdrop-blur-md">
                        {(['7d', '30d', '90d', '1y'] as const).map((range) => (
                            <UiTooltip key={range} content={`Afficher les données sur ${range === '7d' ? '7 jours' : range === '30d' ? '30 jours' : range === '90d' ? '90 jours' : '1 an'}`} position="top">
                                <button
                                    onClick={() => setTimeRange(range)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeRange === range
                                        ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                        }`}
                                >
                                    {range === '7d' ? '7J' : range === '30d' ? '30J' : range === '90d' ? '90J' : '1A'}
                                </button>
                            </UiTooltip>
                        ))}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-tour="analytics-kpi">
                <StatCard
                    title="Risques Critiques"
                    value={metrics.criticalRisks}
                    icon={AlertTriangle}
                    colorClass="bg-red-500"
                    trend={{ value: metrics.trends.riskTrend, label: 'vs mois dernier' }}
                    onClick={() => navigate('/risks')}
                    sparklineData={trendData.slice(-7).map(d => d.risks)}
                />

                <StatCard
                    title="Incidents Ouverts"
                    value={metrics.openIncidents}
                    icon={Activity}
                    colorClass="bg-orange-500"
                    trend={{ value: metrics.trends.incidentTrend, label: 'vs mois dernier' }}
                    onClick={() => navigate('/incidents')}
                    sparklineData={trendData.slice(-7).map(d => d.incidents)}
                />

                <StatCard
                    title="Conformité"
                    value={`${Math.round(metrics.complianceRate)}%`}
                    icon={CheckCircle2}
                    colorClass="bg-green-500"
                    trend={{ value: metrics.trends.complianceTrend, label: 'vs mois dernier' }}
                    onClick={() => navigate('/compliance')}
                    sparklineData={trendData.slice(-7).map(d => d.compliance)}
                />

                <StatCard
                    title="Projets Actifs"
                    value={metrics.activeProjects}
                    icon={Clock}
                    colorClass="bg-indigo-500"
                    trend={{ value: metrics.trends.projectTrend, label: 'vs mois dernier' }}
                    onClick={() => navigate('/projects')}
                    sparklineData={trendData.slice(-7).map(d => d.assets)}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend Chart */}
                <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden group" data-tour="analytics-trends">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none"></div>
                    <div className="relative z-decorator">
                        {/* Heading hierarchy: h2 for card title (follows h1 page title) */}
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 font-display">
                            Évolution des Risques et Incidents
                        </h2>
                        <div className="h-[300px] w-full">
                            {trendData.length === 0 || trendData.every(d => d.risks === 0 && d.incidents === 0) ? (
                                <EmptyChartState
                                    message="Aucune tendance"
                                    description="L'historique des risques et incidents s'affichera ici."
                                    variant="line"
                                />
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData}>
                                        <defs>
                                            <linearGradient id="colorRisks" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={RISK_COLORS.critical} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={RISK_COLORS.critical} stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={STATUS_COLORS.warning} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={STATUS_COLORS.warning} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            stroke={chartColors.text}
                                            style={{ fontSize: '11px', fontWeight: 500 }}
                                            axisLine={false}
                                            tickLine={false}
                                            dy={10}
                                        />
                                        <YAxis
                                            stroke={chartColors.text}
                                            style={{ fontSize: '11px', fontWeight: 500 }}
                                            axisLine={false}
                                            tickLine={false}
                                            dx={-10}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                                borderColor: 'rgba(255, 255, 255, 0.2)',
                                                borderRadius: '16px',
                                                boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
                                                backdropFilter: 'blur(12px)',
                                                padding: '12px 16px',
                                                color: SLATE_COLORS[800]
                                            }}
                                            itemStyle={{ fontSize: '12px', fontWeight: 600, padding: '2px 0' }}
                                            labelStyle={{ color: SLATE_COLORS[500], fontSize: '11px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                            cursor={{ stroke: SLATE_COLORS[400], strokeWidth: 1, strokeDasharray: '4 4' }}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                        <Area
                                            type="monotone"
                                            dataKey="risks"
                                            stroke={RISK_COLORS.critical}
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorRisks)"
                                            name="Risques"
                                            animationDuration={1500}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="incidents"
                                            stroke={STATUS_COLORS.warning}
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorIncidents)"
                                            name="Incidents"
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>

                {/* Compliance Progress */}
                <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none"></div>
                    <div className="relative z-decorator">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 font-display">
                            Taux de Conformité ISO 27001
                        </h3>
                        <div className="flex items-center justify-center h-[300px]">
                            <ProgressRing
                                progress={metrics.complianceRate}
                                size={220}
                                strokeWidth={16}
                                color={STATUS_COLORS.success}
                                label="Conformité"
                            />
                        </div>
                        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                            <div className="p-3 rounded-2xl bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
                                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{controls.filter(c => c.status === 'Implémenté').length}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-green-600/70 dark:text-green-400/70 mt-1">Implémentés</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20">
                                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{controls.filter(c => c.status === 'Partiel').length}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600/70 dark:text-orange-400/70 mt-1">Partiels</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/30">
                                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{controls.filter(c => c.status === 'Non commencé').length}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500/70 dark:text-slate-400/70 mt-1">Non commencés</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Risk Distribution */}
            <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none"></div>
                <div className="relative z-decorator">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 font-display">
                        Distribution des Risques par Catégorie
                    </h3>
                    <div className="h-[300px] w-full">
                        {risksByCategory.length === 0 ? (
                            <EmptyChartState
                                variant="pie"
                                message="Aucune catégorie"
                                description="Les catégories de risques apparaîtront ici."
                                actionLabel="Créer un risque"
                                onAction={() => navigate('/risks')}
                            />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={risksByCategory}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        innerRadius="60%"
                                        outerRadius="80%"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {risksByCategory.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                            borderColor: 'rgba(255, 255, 255, 0.2)',
                                            borderRadius: '16px',
                                            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)',
                                            backdropFilter: 'blur(12px)',
                                            padding: '12px 16px',
                                            color: SLATE_COLORS[800]
                                        }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Risks Table */}
            <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/60 dark:border-white/5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none"></div>
                <div className="relative z-decorator">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                                Top 10 Risques Critiques
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Risques nécessitant une attention immédiate</p>
                        </div>
                        <button
                            onClick={() => navigate('/risks')}
                            className="px-4 py-2 rounded-xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 font-bold text-sm hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors flex items-center gap-2"
                        >
                            Voir tous les risques
                            <TrendingUp className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-slate-200/60 dark:border-white/5">
                        <DataTable
                            data={topRisks}
                            columns={topRisksColumns}
                            onRowClick={(risk) => navigate(`/risks?id=${risk.id}`)}
                            exportable
                            exportFilename="top_risques"
                            searchable
                            pageSize={5}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
