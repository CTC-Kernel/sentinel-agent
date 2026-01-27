/**
 * IncidentOverview - Premium advanced dashboard for incident management
 * Features: Animated gauges, glowing charts, RadialBarChart, ComposedChart, interactive elements
 */
import React, { useMemo, useState } from 'react';
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
    Area,
    Legend,
    RadialBarChart,
    RadialBar,
    ComposedChart,
    Line,
    Sector
} from 'recharts';
import { Incident, Criticality } from '../../../types';
import type { SentinelAgent } from '../../../types/agent';
import { ChartTooltip } from '../../ui/ChartTooltip';
import { EmptyChartState } from '../../ui/EmptyChartState';
import {
    DONUT_COLORS,
    SEVERITY_COLORS,
    CHART_AXIS_COLORS,
    SENTINEL_PALETTE
} from '../../../theme/chartTheme';
import {
    ShieldAlert,
    Siren,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Target,
    Bell,
    Bot,
    Activity,
    Flame,
    Zap
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

const CATEGORY_ICONS: Record<string, string> = {
    'Ransomware': '🔐',
    'Phishing': '🎣',
    'Vol Matériel': '💻',
    'Indisponibilité': '⚡',
    'Fuite de Données': '📤',
    'Autre': '❓'
};

export const IncidentOverview: React.FC<IncidentOverviewProps> = ({ incidents, agents = [] }) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

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

    // Category Distribution with enhanced data
    const categoryData = useMemo(() => {
        const data = incidents.reduce((acc, inc) => {
            const cat = inc.category || 'Non catégorisé';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return Object.entries(data)
            .map(([name, value]) => ({
                name,
                value,
                color: CATEGORY_COLORS[name] || SENTINEL_PALETTE.tertiary,
                icon: CATEGORY_ICONS[name] || '❓'
            }))
            .sort((a, b) => b.value - a.value);
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

    // Radial gauge data for resolution rate
    const gaugeData = useMemo(() => [
        { name: 'Résolution', value: stats.resolutionRate, fill: stats.resolutionRate >= 70 ? SENTINEL_PALETTE.success : stats.resolutionRate >= 40 ? SENTINEL_PALETTE.warning : SEVERITY_COLORS.critical }
    ], [stats.resolutionRate]);

    // Timeline (Last 30 days) with cumulative
    const timelineData = useMemo(() => {
        const days = 30;
        const data = [];
        const now = new Date();
        let cumulative = 0;

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

            cumulative += count - resolvedCount;

            data.push({
                date: i === 0 ? 'Auj.' : i <= 6 ? `J-${i}` : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
                nouveaux: count,
                resolus: resolvedCount,
                cumul: Math.max(0, cumulative)
            });
        }
        return data;
    }, [incidents]);

    // Weekly data for heatmap-style visualization
    const weeklyHeatData = useMemo(() => {
        const weeks = [];
        const now = new Date();
        for (let w = 3; w >= 0; w--) {
            const weekStart = new Date(now.getTime() - (w * 7 + now.getDay()) * 24 * 60 * 60 * 1000);
            const weekData = [];
            for (let d = 0; d < 7; d++) {
                const dayDate = new Date(weekStart.getTime() + d * 24 * 60 * 60 * 1000);
                const dateStr = dayDate.toISOString().split('T')[0];
                const count = incidents.filter(inc => {
                    if (!inc.dateReported) return false;
                    const incDateObj = new Date(inc.dateReported);
                    if (Number.isNaN(incDateObj.getTime())) return false;
                    return incDateObj.toISOString().split('T')[0] === dateStr;
                }).length;
                weekData.push({ day: d, count, date: dayDate });
            }
            weeks.push({ week: 3 - w, days: weekData });
        }
        return weeks;
    }, [incidents]);

    const getHeatColor = (count: number) => {
        if (count === 0) return 'bg-slate-100 dark:bg-slate-800/50';
        if (count <= 2) return 'bg-emerald-200 dark:bg-emerald-900/50';
        if (count <= 5) return 'bg-amber-300 dark:bg-amber-500';
        return 'bg-red-400 dark:bg-red-800/50';
    };

    // Custom active shape for pie
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderActiveShape = (props: any) => {
        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
        return (
            <g>
                <text x={cx} y={cy - 8} textAnchor="middle" fill="currentColor" className="text-slate-900 dark:text-white text-lg font-black">
                    {payload.value}
                </text>
                <text x={cx} y={cy + 12} textAnchor="middle" className="text-[11px] fill-slate-500 font-bold uppercase">
                    {payload.name}
                </text>
                <Sector
                    cx={cx}
                    cy={cy}
                    innerRadius={innerRadius}
                    outerRadius={outerRadius + 8}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    fill={fill}
                    style={{ filter: 'url(#glowSeverity)', transition: 'all 0.3s ease' }}
                />
                <Sector
                    cx={cx}
                    cy={cy}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    fill={fill}
                    stroke="none"
                />
            </g>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* ========== SVG DEFS FOR EFFECTS ========== */}
            <svg className="absolute w-0 h-0">
                <defs>
                    {/* Glow filters */}
                    <filter id="glowSeverity" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="glowGauge" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* Animated gradient */}
                    <linearGradient id="animatedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={SENTINEL_PALETTE.primary}>
                            <animate attributeName="stop-color" values={`${SENTINEL_PALETTE.primary};${SENTINEL_PALETTE.secondary};${SENTINEL_PALETTE.primary}`} dur="4s" repeatCount="indefinite" />
                        </stop>
                        <stop offset="100%" stopColor={SENTINEL_PALETTE.secondary}>
                            <animate attributeName="stop-color" values={`${SENTINEL_PALETTE.secondary};${SENTINEL_PALETTE.primary};${SENTINEL_PALETTE.secondary}`} dur="4s" repeatCount="indefinite" />
                        </stop>
                    </linearGradient>
                </defs>
            </svg>

            {/* ========== HERO KPI SECTION ========== */}
            <div className="glass-premium p-6 md:p-8 rounded-3xl flex flex-col xl:flex-row xl:items-center xl:justify-between gap-8 relative overflow-hidden group shadow-apple">
                {/* Background Decorations */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-brand-500/5 dark:from-white/5 dark:to-brand-500/10 pointer-events-none" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-brand-500/20 via-transparent to-transparent -mr-48 -mt-48 pointer-events-none opacity-70 blur-2xl" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-radial from-purple-500/10 via-transparent to-transparent -ml-24 -mb-24 pointer-events-none opacity-60" />

                {/* Animated corner accents */}
                <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-brand-200 rounded-tl-5xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-brand-200 rounded-br-5xl pointer-events-none" />

                {/* Main Gauge - RadialBarChart */}
                <div className="flex items-center gap-8 relative z-10">
                    <div className="relative w-36 h-36">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart
                                cx="50%"
                                cy="50%"
                                innerRadius="70%"
                                outerRadius="100%"
                                barSize={12}
                                data={gaugeData}
                                startAngle={180}
                                endAngle={-180}
                            >
                                <defs>
                                    <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor={stats.resolutionRate >= 70 ? '#10B981' : stats.resolutionRate >= 40 ? '#F59E0B' : '#EF4444'} />
                                        <stop offset="100%" stopColor={stats.resolutionRate >= 70 ? '#34D399' : stats.resolutionRate >= 40 ? '#FBBF24' : '#F87171'} />
                                    </linearGradient>
                                </defs>
                                <RadialBar
                                    dataKey="value"
                                    cornerRadius={10}
                                    fill="url(#gaugeGradient)"
                                    background={{ fill: 'rgba(100,116,139,0.1)' }}
                                    style={{ filter: 'url(#glowGauge)' }}
                                />
                            </RadialBarChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.resolutionRate}%</span>
                                <p className="text-[11px] text-slate-500 dark:text-slate-300 uppercase font-bold tracking-wider">Résolution</p>
                            </div>
                        </div>
                        {/* Animated pulse ring */}
                        <div className="absolute inset-0 rounded-full border-2 border-brand-200 animate-ping opacity-20 pointer-events-none" style={{ animationDuration: '3s' }} />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${stats.resolutionRate >= 70 ? 'bg-emerald-500' : stats.resolutionRate >= 40 ? 'bg-amber-500' : 'bg-red-500'} animate-pulse shadow-glow`} />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Performance</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Taux de Résolution</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-[200px]">
                            {stats.resolved}/{stats.total} incidents traités
                        </p>
                        {stats.trend !== 0 && (
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${stats.trend > 0 ? 'text-red-600 bg-red-50 dark:bg-red-900/30' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'}`}>
                                {stats.trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                <span>{stats.trend > 0 ? '+' : ''}{stats.trend}%</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* KPI Cards - Enhanced */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full xl:w-auto relative z-10">
                    {/* Total */}
                    <div className="group/card relative rounded-2xl bg-gradient-to-br from-white/60 to-white/30 dark:from-white/10 dark:to-white/5 border border-white/60 dark:border-white/10 p-4 backdrop-blur-xl shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:border-brand-300">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent rounded-2xl opacity-0 group-hover/card:opacity-70 transition-opacity" />
                        <div className="flex items-center justify-between mb-2 relative">
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 opacity-70">Total</span>
                            <div className="p-2 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 text-slate-500 dark:text-slate-300 shadow-inner">
                                <Target className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white relative">{stats.total}</p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">incidents</p>
                    </div>

                    {/* Open */}
                    <div className="group/card relative rounded-2xl bg-gradient-to-br from-white/60 to-amber-50/50 dark:from-white/10 dark:to-amber-900/20 border border-white/60 dark:border-white/10 p-4 backdrop-blur-xl shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:border-amber-500/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent rounded-2xl opacity-0 group-hover/card:opacity-70 transition-opacity" />
                        <div className="flex items-center justify-between mb-2 relative">
                            <span className="text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 opacity-80">Actifs</span>
                            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-950/50 text-amber-600 dark:text-amber-400 shadow-inner ring-1 ring-amber-200/50 dark:ring-amber-800/50">
                                <Siren className="h-4 w-4" />
                            </div>
                        </div>
                        <p className={`text-3xl font-black relative ${stats.open > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{stats.open}</p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">en cours</p>
                        {stats.open > 0 && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                    </div>

                    {/* Critical */}
                    <div className="group/card relative rounded-2xl bg-gradient-to-br from-white/60 to-red-50/50 dark:from-white/10 dark:to-red-900/20 border border-white/60 dark:border-white/10 p-4 backdrop-blur-xl shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:border-red-500/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent rounded-2xl opacity-0 group-hover/card:opacity-70 transition-opacity" />
                        <div className="flex items-center justify-between mb-2 relative">
                            <span className="text-[11px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 opacity-80">Critiques</span>
                            <div className="p-2 rounded-xl bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/50 dark:to-red-950/50 text-red-600 dark:text-red-400 shadow-inner ring-1 ring-red-200/50 dark:ring-red-800/50">
                                <Flame className="h-4 w-4" />
                            </div>
                        </div>
                        <p className={`text-3xl font-black relative ${stats.critical > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{stats.critical}</p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">à traiter</p>
                        {stats.critical > 0 && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500 animate-ping" />}
                    </div>

                    {/* MTTR */}
                    <div className="group/card relative rounded-2xl bg-gradient-to-br from-white/60 to-emerald-50/50 dark:from-white/10 dark:to-emerald-900/20 border border-white/60 dark:border-white/10 p-4 backdrop-blur-xl shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-lg hover:border-emerald-500/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl opacity-0 group-hover/card:opacity-70 transition-opacity" />
                        <div className="flex items-center justify-between mb-2 relative">
                            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 opacity-80">MTTR</span>
                            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/50 dark:to-emerald-950/50 text-emerald-600 dark:text-emerald-400 shadow-inner ring-1 ring-emerald-200/50 dark:ring-emerald-800/50">
                                <Zap className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-slate-900 dark:text-white relative">
                            {stats.mttrHours !== null ? `${stats.mttrHours}h` : '-'}
                        </p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">délai moyen</p>
                    </div>
                </div>

                {/* Alerts Section */}
                <div className="flex flex-col gap-2 min-w-0 xl:min-w-[240px] relative z-10">
                    {stats.nis2Pending > 0 && (
                        <div className="group flex items-center gap-3 text-xs font-bold text-purple-600 dark:text-purple-400 bg-gradient-to-r from-purple-50/90 to-purple-100/50 dark:from-purple-900/30 dark:to-purple-800/20 px-4 py-3 rounded-xl border border-purple-200/50 dark:border-purple-800/30 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-md">
                            <Bell className="h-4 w-4 shrink-0 group-hover:animate-bounce" />
                            <span>{stats.nis2Pending} NIS2 à notifier</span>
                        </div>
                    )}
                    {stats.agentAlerts > 0 && (
                        <div className="group flex items-center gap-3 text-xs font-bold text-amber-600 dark:text-amber-400 bg-gradient-to-r from-amber-50/90 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-800/20 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800/30 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-md">
                            <Bot className="h-4 w-4 shrink-0 group-hover:animate-pulse" />
                            <span>{stats.agentErrors} erreurs, {stats.agentOffline} hors ligne</span>
                        </div>
                    )}
                    {stats.critical > 0 && (
                        <div className="group flex items-center gap-3 text-xs font-bold text-red-600 dark:text-red-400 bg-gradient-to-r from-red-50/90 to-red-100/50 dark:from-red-900/30 dark:to-red-800/20 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800/30 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-md">
                            <ShieldAlert className="h-4 w-4 shrink-0 group-hover:animate-pulse" />
                            <span>{stats.critical} critiques ouverts</span>
                        </div>
                    )}
                    {stats.open === 0 && stats.agentAlerts === 0 && (
                        <div className="flex items-center gap-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-gradient-to-r from-emerald-50/90 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-800/20 px-4 py-3 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30 backdrop-blur-sm">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>Aucune alerte active</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ========== CHARTS GRID ========== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Severity Distribution (Interactive Donut) */}
                <div className="glass-premium p-6 rounded-4xl border border-white/10 shadow-apple-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
                    <h3 className="text-xs font-black text-slate-500/80 uppercase tracking-widest mb-6 px-2 flex items-center gap-2 relative">
                        <AlertTriangle className="w-4 h-4" />
                        Par Sévérité
                    </h3>
                    <div className="h-[240px] w-full relative">
                        {severityData.length === 0 ? (
                            <EmptyChartState variant="pie" message="Aucune donnée" className="scale-75" />
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <defs>
                                            {severityData.map((entry, index) => (
                                                <linearGradient key={`gradient-${index}`} id={`severityGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                                                    <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <Pie
                                            activeIndex={activeIndex ?? undefined}
                                            activeShape={renderActiveShape}
                                            data={severityData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius="50%"
                                            outerRadius="70%"
                                            paddingAngle={3}
                                            dataKey="value"
                                            cornerRadius={6}
                                            onMouseEnter={(_, index) => setActiveIndex(index)}
                                            onMouseLeave={() => setActiveIndex(null)}
                                        >
                                            {severityData.map((_, index) => (
                                                <Cell
                                                    key={`sev-${index}`}
                                                    fill={`url(#severityGradient-${index})`}
                                                    stroke="rgba(255,255,255,0.2)"
                                                    strokeWidth={2}
                                                    style={{
                                                        filter: activeIndex === index ? 'url(#glowSeverity)' : 'none',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                {activeIndex === null && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="text-center">
                                            <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-300 uppercase font-bold">Total</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex justify-center gap-4 mt-4 flex-wrap">
                        {severityData.map((item, i) => (
                            <div
                                key={`sev-leg-${i}`}
                                className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer transition-all ${activeIndex === i ? 'bg-slate-100 dark:bg-slate-800 scale-105' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                onMouseEnter={() => setActiveIndex(i)}
                                onMouseLeave={() => setActiveIndex(null)}
                            >
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{item.name} ({item.value})</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Category Distribution (Enhanced Bars) */}
                <div className="glass-premium p-6 rounded-4xl border border-white/10 shadow-apple-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
                    <h3 className="text-xs font-black text-slate-500/80 uppercase tracking-widest mb-6 px-2 flex items-center gap-2 relative">
                        <Activity className="w-4 h-4" />
                        Par Catégorie
                    </h3>
                    <div className="space-y-3 relative">
                        {categoryData.length === 0 ? (
                            <EmptyChartState variant="bar" message="Aucune catégorie" className="scale-75" />
                        ) : (
                            categoryData.slice(0, 5).map((cat) => {
                                const maxValue = Math.max(...categoryData.map(c => c.value));
                                const percentage = (cat.value / maxValue) * 100;
                                const isHovered = hoveredCategory === cat.name;
                                return (
                                    <div
                                        key={cat.name}
                                        className={`relative transition-all duration-300 ${isHovered ? 'scale-[1.02]' : ''}`}
                                        onMouseEnter={() => setHoveredCategory(cat.name)}
                                        onMouseLeave={() => setHoveredCategory(null)}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{cat.icon}</span>
                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{cat.name}</span>
                                            </div>
                                            <span className={`text-xs font-black transition-colors ${isHovered ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500'}`}>{cat.value}</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500 ease-out"
                                                style={{
                                                    width: `${percentage}%`,
                                                    background: `linear-gradient(90deg, ${cat.color}dd, ${cat.color})`,
                                                    boxShadow: isHovered ? `0 0 12px ${cat.color}66` : 'none'
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Status Distribution (Radial) */}
                <div className="glass-premium p-6 rounded-4xl border border-white/10 shadow-apple-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
                    <h3 className="text-xs font-black text-slate-500/80 uppercase tracking-widest mb-6 px-2 flex items-center gap-2 relative">
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
                                    <defs>
                                        {statusData.map((entry, index) => (
                                            <linearGradient key={`status-grad-${index}`} id={`statusGradient-${index}`} x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor={entry.fill} stopOpacity={0.8} />
                                                <stop offset="100%" stopColor={entry.fill} stopOpacity={1} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={CHART_AXIS_COLORS.grid} strokeOpacity={CHART_AXIS_COLORS.gridOpacity} />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 11 }} width={70} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', opacity: 0.05 }} />
                                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
                                        {statusData.map((_, index) => (
                                            <Cell
                                                key={`status-${index}`}
                                                fill={`url(#statusGradient-${index})`}
                                                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* ========== ADVANCED TIMELINE SECTION ========== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ComposedChart - Timeline with cumulative line */}
                <div className="glass-premium p-6 rounded-4xl border border-white/10 shadow-apple-sm lg:col-span-2 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
                    <h3 className="text-xs font-black text-slate-500/80 uppercase tracking-widest mb-6 px-2 flex items-center gap-2 relative">
                        <TrendingUp className="w-4 h-4" />
                        Évolution (30 jours)
                    </h3>
                    <div className="h-[300px] w-full">
                        {timelineData.every(d => d.nouveaux === 0 && d.resolus === 0) ? (
                            <EmptyChartState variant="line" message="Aucune activité récente" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={timelineData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradientNewAdvanced" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.4} />
                                            <stop offset="50%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.15} />
                                            <stop offset="100%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradientResolvedAdvanced" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.4} />
                                            <stop offset="50%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.15} />
                                            <stop offset="100%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0} />
                                        </linearGradient>
                                        <filter id="glowLine" x="-20%" y="-20%" width="140%" height="140%">
                                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                            <feMerge>
                                                <feMergeNode in="coloredBlur" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_AXIS_COLORS.grid} strokeOpacity={CHART_AXIS_COLORS.gridOpacity} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 10 }} interval="preserveStartEnd" />
                                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: CHART_AXIS_COLORS.tick, fontSize: 11 }} allowDecimals={false} />
                                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: SENTINEL_PALETTE.primary, fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Area yAxisId="left" type="monotone" dataKey="nouveaux" name="Nouveaux" stroke={SEVERITY_COLORS.critical} strokeWidth={2.5} fillOpacity={1} fill="url(#gradientNewAdvanced)" dot={false} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
                                    <Area yAxisId="left" type="monotone" dataKey="resolus" name="Résolus" stroke={SENTINEL_PALETTE.success} strokeWidth={2.5} fillOpacity={1} fill="url(#gradientResolvedAdvanced)" dot={false} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
                                    <Line yAxisId="right" type="monotone" dataKey="cumul" name="Cumul ouvert" stroke={SENTINEL_PALETTE.primary} strokeWidth={3} dot={false} strokeDasharray="5 5" style={{ filter: 'url(#glowLine)' }} />
                                    <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Activity Heatmap */}
                <div className="glass-premium p-6 rounded-4xl border border-white/10 shadow-apple-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-red-500/5 opacity-0 group-hover:opacity-70 transition-opacity duration-500" />
                    <h3 className="text-xs font-black text-slate-500/80 uppercase tracking-widest mb-6 px-2 flex items-center gap-2 relative">
                        <Activity className="w-4 h-4" />
                        Activité (4 semaines)
                    </h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider px-1 mb-3">
                            <span>Dim</span>
                            <span>Lun</span>
                            <span>Mar</span>
                            <span>Mer</span>
                            <span>Jeu</span>
                            <span>Ven</span>
                            <span>Sam</span>
                        </div>
                        {weeklyHeatData.map((week, wi) => (
                            <div key={wi} className="flex gap-1.5 justify-between">
                                {week.days.map((day, di) => (
                                    <div
                                        key={di}
                                        className={`flex-1 aspect-square rounded-lg ${getHeatColor(day.count)} transition-all duration-200 hover:scale-110 hover:shadow-md cursor-pointer relative group/cell`}
                                        title={`${day.date.toLocaleDateString('fr-FR')}: ${day.count} incident(s)`}
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] px-2 py-1 rounded-md opacity-0 group-hover/cell:opacity-70 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                            {day.count} incident{day.count > 1 ? 's' : ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-slate-200/50 dark:border-white/10">
                        <span className="text-[11px] text-slate-400 font-medium">Moins</span>
                        <div className="flex gap-1">
                            <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800/50" />
                            <div className="w-3 h-3 rounded bg-emerald-200 dark:bg-emerald-900/50" />
                            <div className="w-3 h-3 rounded bg-amber-300 dark:bg-amber-500" />
                            <div className="w-3 h-3 rounded bg-red-400 dark:bg-red-800/50" />
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium">Plus</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
