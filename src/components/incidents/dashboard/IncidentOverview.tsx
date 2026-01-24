/**
 * IncidentOverview - Premium dashboard for incident management
 * Features: KPIs, severity distribution, category breakdown, timeline, status flow, agent alerts
 */
import React, { useMemo } from 'react';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    AreaChart,
    Area,
    Legend
} from 'recharts';
import { Incident, Criticality, SentinelAgent } from '../../../types';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { EmptyChartState } from '../../ui/EmptyChartState';
import {
    DONUT_COLORS,
    SEVERITY_COLORS,
    CHART_AXIS_COLORS,
    SENTINEL_PALETTE,
    ChartGradients
} from '../../../theme/chartTheme';
import {
    ShieldAlert,
    Siren,
    CheckCircle2,
    Clock,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Target,
    Bell,
    Bot,
    Lock,
    Mail,
    HardDrive,
    WifiOff,
    Database,
    Activity
} from '../../ui/Icons';

interface IncidentOverviewProps {
    incidents: Incident[];
    agents?: SentinelAgent[];
}

const CATEGORY_COLORS: Record<string, string> = {
    'Ransomware': SEVERITY_COLORS.critical,
    'Phishing': SENTINEL_PALETTE.secondary,
    'Vol Matériel': SENTINEL_PALETTE.warning,
    'Indisponibilité': SENTINEL_PALETTE.info,
    'Fuite de Données': SENTINEL_PALETTE.danger,
    'Autre': SENTINEL_PALETTE.tertiary,
    'Non catégorisé': '#94a3b8'
};

const STATUS_COLORS: Record<string, string> = {
    'Nouveau': '#a855f7',
    'Analyse': SENTINEL_PALETTE.primary,
    'Contenu': SENTINEL_PALETTE.warning,
    'Résolu': SENTINEL_PALETTE.success,
    'Fermé': '#94a3b8'
};

export const IncidentOverview: React.FC<IncidentOverviewProps> = ({ incidents, agents = [] }) => {
    // ========== STATS CALCULATION ==========
    const stats = useMemo(() => {
        const total = incidents.length;
        const open = incidents.filter(i => i.status !== 'Fermé' && i.status !== 'Résolu').length;
        const critical = incidents.filter(i => i.severity === Criticality.CRITICAL && i.status !== 'Fermé' && i.status !== 'Résolu').length;
        const high = incidents.filter(i => i.severity === Criticality.HIGH && i.status !== 'Fermé' && i.status !== 'Résolu').length;
        const resolved = incidents.filter(i => i.status === 'Résolu' || i.status === 'Fermé').length;
        const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;

        // NIS2 significant incidents pending notification
        const nis2Pending = incidents.filter(i => i.isSignificant && i.notificationStatus === 'Pending').length;

        // MTTR Calculation (Mean Time To Resolve)
        let totalResolutionHours = 0;
        let resolvedWithTimes = 0;
        incidents.forEach(i => {
            if ((i.status === 'Résolu' || i.status === 'Fermé') && i.dateResolved && i.dateReported) {
                const start = new Date(i.dateReported).getTime();
                const end = new Date(i.dateResolved).getTime();
                if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
                    totalResolutionHours += (end - start) / (1000 * 60 * 60);
                    resolvedWithTimes++;
                }
            }
        });
        const mttrHours = resolvedWithTimes > 0 ? Math.round(totalResolutionHours / resolvedWithTimes) : null;

        // Agent stats
        const agentErrors = agents.filter(a => a.status === 'error').length;
        const agentOffline = agents.filter(a => a.status === 'offline').length;
        const agentAlerts = agentErrors + agentOffline;

        // Trend (compare last 7 days vs previous 7 days)
        const now = new Date();
        const last7Days = incidents.filter(i => {
            if (!i.dateReported) return false;
            const d = new Date(i.dateReported);
            if (Number.isNaN(d.getTime())) return false;
            return (now.getTime() - d.getTime()) <= 7 * 24 * 60 * 60 * 1000;
        }).length;
        const prev7Days = incidents.filter(i => {
            if (!i.dateReported) return false;
            const d = new Date(i.dateReported);
            if (Number.isNaN(d.getTime())) return false;
            const diff = now.getTime() - d.getTime();
            return diff > 7 * 24 * 60 * 60 * 1000 && diff <= 14 * 24 * 60 * 60 * 1000;
        }).length;
        const trend = prev7Days > 0 ? Math.round(((last7Days - prev7Days) / prev7Days) * 100) : 0;

        return { total, open, critical, high, resolved, resolutionRate, nis2Pending, mttrHours, agentAlerts, agentErrors, agentOffline, trend, last7Days };
    }, [incidents, agents]);

    // ========== CHART DATA ==========
    // Severity Distribution
    const severityData = useMemo(() => {
        const counts = {
            'Critique': incidents.filter(i => i.severity === Criticality.CRITICAL).length,
            'Élevée': incidents.filter(i => i.severity === Criticality.HIGH).length,
            'Moyenne': incidents.filter(i => i.severity === Criticality.MEDIUM).length,
            'Faible': incidents.filter(i => i.severity === Criticality.LOW).length
        };
        return Object.entries(counts)
            .filter(([_, v]) => v > 0)
            .map(([name, value], i) => ({ name, value, color: DONUT_COLORS.severity[i] }));
    }, [incidents]);

    // Category Distribution
    const categoryData = useMemo(() => {
        const data = incidents.reduce((acc, inc) => {
            const cat = inc.category || 'Non catégorisé';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(data).map(([name, value]) => ({
            name,
            value,
            color: CATEGORY_COLORS[name] || SENTINEL_PALETTE.tertiary
        }));
    }, [incidents]);

    // Status Distribution
    const statusData = useMemo(() => {
        const data = incidents.reduce((acc, inc) => {
            acc[inc.status] = (acc[inc.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(data).map(([name, value]) => ({
            name,
            value,
            fill: STATUS_COLORS[name] || SENTINEL_PALETTE.tertiary
        }));
    }, [incidents]);

    // Timeline (Last 30 days)
    const timelineData = useMemo(() => {
        const days = 30;
        const data = [];
        const now = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = d.toISOString().split('T')[0];

            const count = incidents.filter(inc => {
                if (!inc.dateReported) return false;
                const incDateObj = new Date(inc.dateReported);
                if (Number.isNaN(incDateObj.getTime())) return false;
                const incDate = incDateObj.toISOString().split('T')[0];
                return incDate === dateStr;
            }).length;

            const resolvedCount = incidents.filter(inc => {
                if (!inc.dateResolved) return false;
                const resDateObj = new Date(inc.dateResolved);
                if (Number.isNaN(resDateObj.getTime())) return false;
                const resDate = resDateObj.toISOString().split('T')[0];
                return resDate === dateStr;
            }).length;

            data.push({
                date: i === 0 ? 'Auj.' : i <= 6 ? `J-${i}` : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
                nouveaux: count,
                resolus: resolvedCount
            });
        }
        return data;
    }, [incidents]);

    // Monthly Timeline (6 months)
    const monthlyData = useMemo(() => {
        const months = new Array(6).fill(0).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - 5 + i);
            return {
                name: d.toLocaleString('fr-FR', { month: 'short' }),
                date: d,
                count: 0
            };
        });

        incidents.forEach(inc => {
            const d = new Date(inc.dateReported);
            const monthIndex = months.findIndex(m =>
                m.date.getMonth() === d.getMonth() &&
                m.date.getFullYear() === d.getFullYear()
            );
            if (monthIndex !== -1) months[monthIndex].count++;
        });
        return months.every(m => m.count === 0) ? [] : months;
    }, [incidents]);

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* ========== HERO KPI SECTION ========== */}
            <div className="glass-premium p-6 md:p-8 rounded-5xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 relative overflow-hidden group shadow-apple">
                {/* Background Decorations */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none opacity-70" />

                {/* Tech Corners */}
                <svg className="absolute top-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute top-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-6 left-6 w-4 h-4 text-slate-400/30 dark:text-white/20 -rotate-90" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>
                <svg className="absolute bottom-6 right-6 w-4 h-4 text-slate-400/30 dark:text-white/20 rotate-180" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h6v2H2z" /><path fill="currentColor" d="M2 2v6h2V2z" /></svg>

                {/* Main Score */}
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <svg className="w-28 h-28 transform -rotate-90 overflow-visible" viewBox="-4 -4 104 104">
                            <defs>
                                <linearGradient id="incidentProgressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor={stats.resolutionRate >= 70 ? '#10B981' : stats.resolutionRate >= 40 ? '#F59E0B' : '#EF4444'} />
                                    <stop offset="100%" stopColor={stats.resolutionRate >= 70 ? '#34D399' : stats.resolutionRate >= 40 ? '#FBBF24' : '#F87171'} />
                                </linearGradient>
                            </defs>
                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200/50 dark:text-slate-700/50" />
                            <circle
                                cx="48" cy="48" r="40"
                                stroke="url(#incidentProgressGradient)"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * stats.resolutionRate) / 100}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out drop-shadow-sm"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.resolutionRate}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Taux de Résolution</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[200px] leading-snug">
                            Incidents résolus ou fermés
                        </p>
                        {stats.trend !== 0 && (
                            <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${stats.trend > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {stats.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                <span>{stats.trend > 0 ? '+' : ''}{stats.trend}% vs semaine précédente</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:w-auto relative z-10">
                    {/* Total */}
                    <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-4 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 opacity-70">Total</span>
                            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                                <Target className="h-3.5 w-3.5" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">incidents</p>
                    </div>

                    {/* Open */}
                    <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-4 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-warning-bg">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-warning-text opacity-70">Actifs</span>
                            <div className="p-1.5 rounded-lg bg-warning-bg ring-1 ring-inset ring-warning-border/30 text-warning-text">
                                <Siren className="h-3.5 w-3.5" />
                            </div>
                        </div>
                        <p className={`text-2xl font-black ${stats.open > 0 ? 'text-warning-text' : 'text-slate-900 dark:text-white'}`}>{stats.open}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">en cours</p>
                    </div>

                    {/* Critical */}
                    <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-4 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-error-bg">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-error-text opacity-70">Critiques</span>
                            <div className="p-1.5 rounded-lg bg-error-bg ring-1 ring-inset ring-error-border/30 text-error-text">
                                <ShieldAlert className="h-3.5 w-3.5" />
                            </div>
                        </div>
                        <p className={`text-2xl font-black ${stats.critical > 0 ? 'text-error-text' : 'text-slate-900 dark:text-white'}`}>{stats.critical}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">à traiter</p>
                    </div>

                    {/* MTTR */}
                    <div className="group/card relative rounded-2xl bg-white/40 dark:bg-white/5 border border-white/60 dark:border-white/10 p-4 backdrop-blur-md shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:bg-success-bg">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-success-text opacity-70">MTTR</span>
                            <div className="p-1.5 rounded-lg bg-success-bg ring-1 ring-inset ring-success-border/30 text-success-text">
                                <Clock className="h-3.5 w-3.5" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">
                            {stats.mttrHours !== null ? `${stats.mttrHours}h` : '-'}
                        </p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">délai moyen</p>
                    </div>
                </div>

                {/* Alerts Section */}
                <div className="flex flex-col gap-2 min-w-0 lg:min-w-[220px] relative z-10">
                    {stats.nis2Pending > 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50/80 dark:bg-purple-900/20 px-4 py-2.5 rounded-xl border border-purple-100 dark:border-purple-800/30 backdrop-blur-sm">
                            <Bell className="h-4 w-4 shrink-0" />
                            <span>{stats.nis2Pending} NIS2 à notifier</span>
                        </div>
                    )}
                    {stats.agentAlerts > 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-900/20 px-4 py-2.5 rounded-xl border border-amber-100 dark:border-amber-800/30 backdrop-blur-sm">
                            <Bot className="h-4 w-4 shrink-0" />
                            <span>{stats.agentErrors} erreurs, {stats.agentOffline} agents hors ligne</span>
                        </div>
                    )}
                    {stats.critical > 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50/80 dark:bg-red-900/20 px-4 py-2.5 rounded-xl border border-red-100 dark:border-red-800/30 backdrop-blur-sm">
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            <span>{stats.critical} critiques ouverts</span>
                        </div>
                    )}
                    {stats.open === 0 && stats.agentAlerts === 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-900/20 px-4 py-2.5 rounded-xl border border-emerald-100 dark:border-emerald-800/30 backdrop-blur-sm">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>Aucune alerte active</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ========== CHARTS GRID ========== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Severity Distribution (Donut) */}
                <div className="glass-premium p-6 rounded-4xl border border-white/10 shadow-apple-sm">
                    <h3 className="text-xs font-black text-slate-500/80 uppercase tracking-widest mb-6 px-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Par Sévérité
                    </h3>
                    <div className="h-[220px] w-full relative">
                        {severityData.length === 0 ? (
                            <EmptyChartState variant="pie" message="Aucune donnée" className="scale-75" />
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={severityData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius="55%"
                                            outerRadius="75%"
                                            paddingAngle={4}
                                            dataKey="value"
                                            cornerRadius={4}
                                        >
                                            {severityData.map((entry, index) => (
                                                <Cell key={`sev-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.1)" />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="text-center">
                                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Total</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex justify-center gap-3 mt-4 flex-wrap">
                        {severityData.map((item, i) => (
                            <div key={`sev-leg-${i}`} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{item.name} ({item.value})</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Category Distribution */}
                <div className="glass-premium p-6 rounded-4xl border border-white/10 shadow-apple-sm">
                    <h3 className="text-xs font-black text-slate-500/80 uppercase tracking-widest mb-6 px-2 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Par Catégorie
                    </h3>
                    <div className="h-[220px] w-full">
                        {categoryData.length === 0 ? (
                            <EmptyChartState variant="pie" message="Aucune catégorie" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={75}
                                        paddingAngle={4}
                                        dataKey="value"
                                        cornerRadius={4}
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cat-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.1)" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend
                                        iconSize={8}
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                                        formatter={(value) => <span className="text-slate-600 dark:text-slate-400">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Status Distribution (Horizontal Bar) */}
                <div className="glass-premium p-6 rounded-4xl border border-white/10 shadow-apple-sm">
                    <h3 className="text-xs font-black text-slate-500/80 uppercase tracking-widest mb-6 px-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Par Statut
                    </h3>
                    <div className="h-[220px] w-full">
                        {statusData.length === 0 ? (
                            <EmptyChartState variant="bar" message="Aucun statut" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={statusData}
                                    layout="vertical"
                                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={CHART_AXIS_COLORS.grid} strokeOpacity={CHART_AXIS_COLORS.gridOpacity} />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 11 }} width={70} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                                        {statusData.map((entry, index) => (
                                            <Cell key={`status-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* ========== TIMELINE SECTION ========== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 30-Day Timeline */}
                <div className="glass-premium p-6 rounded-4xl border border-white/10 shadow-apple-sm">
                    <h3 className="text-xs font-black text-slate-500/80 uppercase tracking-widest mb-6 px-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Évolution (30 jours)
                    </h3>
                    <div className="h-[280px] w-full">
                        {timelineData.every(d => d.nouveaux === 0 && d.resolus === 0) ? (
                            <EmptyChartState variant="line" message="Aucune activité récente" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradientNew" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={SENTINEL_PALETTE.danger} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={SENTINEL_PALETTE.danger} stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradientResolved" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_AXIS_COLORS.grid} strokeOpacity={CHART_AXIS_COLORS.gridOpacity} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 10 }} interval="preserveStartEnd" />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Area type="monotone" dataKey="nouveaux" name="Nouveaux" stroke={SENTINEL_PALETTE.danger} strokeWidth={2} fillOpacity={1} fill="url(#gradientNew)" />
                                    <Area type="monotone" dataKey="resolus" name="Résolus" stroke={SENTINEL_PALETTE.success} strokeWidth={2} fillOpacity={1} fill="url(#gradientResolved)" />
                                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* 6-Month Bar Chart */}
                <div className="glass-premium p-6 rounded-4xl border border-white/10 shadow-apple-sm">
                    <h3 className="text-xs font-black text-slate-500/80 uppercase tracking-widest mb-6 px-2 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Historique (6 mois)
                    </h3>
                    <div className="h-[280px] w-full">
                        {monthlyData.length === 0 ? (
                            <EmptyChartState variant="bar" message="Aucun historique" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.9} />
                                            <stop offset="100%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.4} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_AXIS_COLORS.grid} strokeOpacity={CHART_AXIS_COLORS.gridOpacity} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 12 }} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                                    <Bar dataKey="count" name="Incidents" fill="url(#monthlyGradient)" radius={[6, 6, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
