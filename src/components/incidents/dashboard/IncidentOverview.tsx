/**
 * IncidentOverview - Premium advanced dashboard for incident management
 * Features: Animated gauges, glowing charts, RadialBarChart, ComposedChart, interactive elements
 */
import React, { useId, useMemo, useState } from 'react';
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
import { Skeleton, CardSkeleton } from '../../ui/Skeleton';
import { useLocale } from '@/hooks/useLocale';
import { SentinelPieActiveShapeProps } from '../../../types/charts';

interface IncidentOverviewProps {
    incidents: Incident[];
    agents?: SentinelAgent[];
    loading?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
    'Ransomware': 'var(--destructive)',
    'Phishing': 'var(--secondary)',
    'Vol Matériel': 'var(--warning)',
    'Indisponibilité': 'var(--primary)',
    'Fuite de Données': 'var(--destructive)',
    'Autre': 'var(--muted-foreground)',
    'Non catégorisé': 'var(--muted)'
};

const STATUS_COLORS: Record<string, string> = {
    'Nouveau': 'hsl(var(--secondary))',
    'Analyse': 'var(--primary)',
    'Contenu': 'var(--warning)',
    'Résolu': 'var(--success)',
    'Fermé': 'var(--muted)'
};

const CATEGORY_ICONS: Record<string, string> = {
    'Ransomware': '🔐',
    'Phishing': '🎣',
    'Vol Matériel': '💻',
    'Indisponibilité': '⚡',
    'Fuite de Données': '📤',
    'Autre': '❓'
};

export const IncidentOverview: React.FC<IncidentOverviewProps> = ({ incidents, agents = [], loading = false }) => {
    const { t, config } = useLocale();
    const uid = useId();
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

    // Stable SVG IDs to avoid collisions when multiple instances are rendered
    const svgIds = useMemo(() => ({
        glowSeverity: `glowSeverity-${uid}`,
        glowGauge: `glowGauge-${uid}`,
        animatedGradient: `animatedGradient-${uid}`,
        gaugeGradient: `gaugeGradient-${uid}`,
        glowLine: `glowLine-${uid}`,
        gradientNew: `gradientNew-${uid}`,
        gradientResolved: `gradientResolved-${uid}`,
    }), [uid]);

    // ========== STATS CALCULATION ==========
    const stats = useMemo(() => {
        if (loading) return null;
        const total = incidents.length;
        const open = incidents.filter(i => i.status !== 'Fermé' && i.status !== 'Résolu').length;
        const critical = incidents.filter(i => i.severity === Criticality.CRITICAL && i.status !== 'Fermé' && i.status !== 'Résolu').length;
        const high = incidents.filter(i => i.severity === Criticality.HIGH && i.status !== 'Fermé' && i.status !== 'Résolu').length;
        const resolved = incidents.filter(i => i.status === 'Résolu' || i.status === 'Fermé').length;
        const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

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
    }, [incidents, agents, loading]);

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
    const gaugeData = useMemo(() => {
        const rate = stats?.resolutionRate ?? 0;
        return [
            { name: 'Résolution', value: rate, fill: rate >= 70 ? SENTINEL_PALETTE.success : rate >= 40 ? SENTINEL_PALETTE.warning : SEVERITY_COLORS.critical }
        ];
    }, [stats?.resolutionRate]);

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
                date: i === 0 ? t('common.today', { defaultValue: 'Auj.' }) : i <= 6 ? `${t('common.dayPrefix', { defaultValue: 'J' })}-${i}` : d.toLocaleDateString(config.intlLocale, { day: '2-digit', month: 'short' }),
                nouveaux: count,
                resolus: resolvedCount,
                cumul: Math.max(0, cumulative)
            });
        }
        return data;
    }, [incidents, config.intlLocale]);

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
        if (count === 0) return 'bg-muted/10';
        if (count <= 2) return 'bg-success/20';
        if (count <= 5) return 'bg-warning/40';
        return 'bg-destructive/40';
    };

    // Custom active shape for pie
    const renderActiveShape = (props: SentinelPieActiveShapeProps) => {
        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
        const cyValue = cy ?? 0;
        const innerR = innerRadius ?? 0;
        const outerR = outerRadius ?? 0;

        return (
            <g>
                <text x={cx} y={cyValue - 8} textAnchor="middle" fill="currentColor" className="text-foreground text-lg font-black">
                    {payload.value}
                </text>
                <text x={cx} y={cyValue + 12} textAnchor="middle" className="text-[11px] fill-muted-foreground font-bold uppercase">
                    {payload.name}
                </text>
                <Sector
                    cx={cx}
                    cy={cy}
                    innerRadius={innerR}
                    outerRadius={outerR + 8}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    fill={fill}
                    style={{ filter: `url(#${svgIds.glowSeverity})`, transition: 'all 0.3s ease' }}
                />
                <Sector
                    cx={cx}
                    cy={cy}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    innerRadius={innerR}
                    outerRadius={outerR}
                    fill={fill}
                    stroke="none"
                />
            </g>
        );
    };

    // Loading skeleton
    if (loading || !stats) {
        return (
            <div className="space-y-6 animate-fade-in pb-10">
                <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 md:p-8 rounded-xl border border-border/40 flex flex-col gap-6 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row gap-8 items-center">
                        <Skeleton variant="circular" className="w-36 h-36 shrink-0" />
                        <div className="flex-1 space-y-4 w-full">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-8 w-64" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </div>
                </div>
                <CardSkeleton count={4} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-[350px] w-full rounded-xl" />
                    <Skeleton className="h-[350px] w-full rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* ========== SVG DEFS FOR EFFECTS ========== */}
            <svg className="absolute w-0 h-0">
                <defs>
                    {/* Glow filters */}
                    <filter id={svgIds.glowSeverity} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id={svgIds.glowGauge} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* Animated gradient */}
                    <linearGradient id={svgIds.animatedGradient} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="var(--primary)">
                            <animate attributeName="stop-color" values="var(--primary);var(--secondary);var(--primary)" dur="4s" repeatCount="indefinite" />
                        </stop>
                        <stop offset="100%" stopColor="var(--secondary)">
                            <animate attributeName="stop-color" values="var(--secondary);var(--primary);var(--secondary)" dur="4s" repeatCount="indefinite" />
                        </stop>
                    </linearGradient>
                </defs>
            </svg>

            {/* ========== HERO KPI SECTION ========== */}
            <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 md:p-8 rounded-xl border border-border/40 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-8 relative overflow-hidden group shadow-premium transition-all duration-normal ease-apple">
                {/* Background Decorations */}
                <div className="absolute inset-0 bg-gradient-to-br from-background/40 via-transparent to-primary/5 pointer-events-none" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-primary/10 via-transparent to-transparent -mr-48 -mt-48 pointer-events-none opacity-50 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-radial from-secondary/10 via-transparent to-transparent -ml-24 -mb-24 pointer-events-none opacity-40 blur-2xl" />

                {/* Animated corner accents */}
                <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-primary/20 rounded-tl-xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-primary/20 rounded-br-xl pointer-events-none" />

                {/* Main Gauge - RadialBarChart */}
                <div className="flex items-center gap-8 relative z-10">
                    <div className="relative w-36 h-36">
                        <ResponsiveContainer width="100%" height="100%" >
                            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                <Pie
                                    data={gaugeData}
                                    cx="50%"
                                    cy="85%"
                                    startAngle={180}
                                    endAngle={0}
                                    innerRadius="70%"
                                    outerRadius="105%"
                                    dataKey="value"
                                    stroke="none"
                                    cornerRadius={12}
                                    paddingAngle={0}
                                >
                                    <Cell
                                        fill={`url(#${svgIds.gaugeGradient})`}
                                        style={{ filter: `url(#${svgIds.glowGauge})` }}
                                    />
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <span className="text-3xl font-black text-foreground">{stats.resolutionRate}%</span>
                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{t('incidents.resolution', { defaultValue: 'Résolution' })}</p>
                            </div>
                        </div>
                        {/* Animated pulse ring */}
                        <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping opacity-20 pointer-events-none" style={{ animationDuration: '3s' }} />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${stats.resolutionRate >= 70 ? 'bg-success' : stats.resolutionRate >= 40 ? 'bg-warning' : 'bg-destructive'} animate-pulse shadow-glow`} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Performance</span>
                        </div>
                        <h3 className="text-xl font-bold text-foreground">{t('incidents.resolutionRate', { defaultValue: 'Taux de Résolution' })}</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px]">
                            <span className="text-foreground font-black">{stats.resolved}</span>/{stats.total} {t('incidents.processed', { defaultValue: 'incidents traités' })}
                        </p>
                        {stats.trend !== 0 && (
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${stats.trend > 0 ? 'text-destructive bg-error-bg' : 'text-success bg-success-bg'}`}>
                                {stats.trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                <span>{stats.trend > 0 ? '+' : ''}{stats.trend}%</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* KPI Cards - Enhanced */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full xl:w-auto relative z-10">
                    {/* Total */}
                    <div className="group/card relative rounded-xl bg-background/40 border border-border/40 p-4 backdrop-blur-xl shadow-sm transition-all duration-normal ease-apple hover:scale-[1.03] hover:shadow-premium hover:border-primary/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-xl opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="flex items-center justify-between mb-2 relative">
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70">{t('common.total', { defaultValue: 'Total' })}</span>
                            <div className="p-2 rounded-xl bg-muted/10 text-muted-foreground shadow-inner">
                                <Target className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-foreground relative">{stats.total}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">incidents</p>
                    </div>

                    {/* Open */}
                    <div className="group/card relative rounded-xl bg-background/40 border border-border/40 p-4 backdrop-blur-xl shadow-sm transition-all duration-normal ease-apple hover:scale-[1.03] hover:shadow-premium hover:border-warning/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent rounded-xl opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="flex items-center justify-between mb-2 relative">
                            <span className="text-[10px] font-black uppercase tracking-widest text-warning opacity-80">{t('incidents.active', { defaultValue: 'Actifs' })}</span>
                            <div className="p-2 rounded-xl bg-warning/10 text-warning shadow-inner ring-1 ring-warning/20">
                                <Siren className="h-4 w-4" />
                            </div>
                        </div>
                        <p className={`text-3xl font-black relative ${stats.open > 0 ? 'text-warning' : 'text-foreground'}`}>{stats.open}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('incidents.inProgress', { defaultValue: 'en cours' })}</p>
                        {stats.open > 0 && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-warning animate-pulse" />}
                    </div>

                    {/* Critical */}
                    <div className="group/card relative rounded-xl bg-background/40 border border-border/40 p-4 backdrop-blur-xl shadow-sm transition-all duration-normal ease-apple hover:scale-[1.03] hover:shadow-premium hover:border-destructive/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent rounded-xl opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="flex items-center justify-between mb-2 relative">
                            <span className="text-[10px] font-black uppercase tracking-widest text-destructive opacity-80">{t('incidents.critical', { defaultValue: 'Critiques' })}</span>
                            <div className="p-2 rounded-xl bg-destructive/10 text-destructive shadow-inner ring-1 ring-destructive/20">
                                <Flame className="h-4 w-4" />
                            </div>
                        </div>
                        <p className={`text-3xl font-black relative ${stats.critical > 0 ? 'text-destructive' : 'text-foreground'}`}>{stats.critical}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('incidents.toProcess', { defaultValue: 'à traiter' })}</p>
                        {stats.critical > 0 && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-destructive animate-ping" />}
                    </div>

                    {/* MTTR */}
                    <div className="group/card relative rounded-xl bg-background/40 border border-border/40 p-4 backdrop-blur-xl shadow-sm transition-all duration-normal ease-apple hover:scale-[1.03] hover:shadow-premium hover:border-success/30">
                        <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent rounded-xl opacity-0 group-hover/card:opacity-100 transition-opacity" />
                        <div className="flex items-center justify-between mb-2 relative">
                            <span className="text-[10px] font-black uppercase tracking-widest text-success opacity-80">MTTR</span>
                            <div className="p-2 rounded-xl bg-success/10 text-success shadow-inner ring-1 ring-success/20">
                                <Zap className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-foreground relative">
                            {stats.mttrHours !== null ? `${stats.mttrHours}h` : '-'}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('incidents.avgDelay', { defaultValue: 'délai moyen' })}</p>
                    </div>
                </div>

                {/* Alerts Section */}
                <div className="flex flex-col gap-2 min-w-0 xl:min-w-[240px] relative z-10">
                    {stats.nis2Pending > 0 && (
                        <div className="group flex items-center gap-3 text-xs font-black text-primary bg-primary/10 px-4 py-3 rounded-xl border border-primary/20 backdrop-blur-sm transition-all duration-normal ease-apple hover:scale-[1.02] hover:shadow-md">
                            <Bell className="h-4 w-4 shrink-0 group-hover:animate-bounce" />
                            <span className="uppercase tracking-wider">{stats.nis2Pending} {t('incidents.nis2ToNotify', { defaultValue: 'NIS2 à notifier' })}</span>
                        </div>
                    )}
                    {stats.agentAlerts > 0 && (
                        <div className="group flex items-center gap-3 text-xs font-black text-warning bg-warning/10 px-4 py-3 rounded-xl border border-warning/20 backdrop-blur-sm transition-all duration-normal ease-apple hover:scale-[1.02] hover:shadow-md">
                            <Bot className="h-4 w-4 shrink-0 group-hover:animate-pulse" />
                            <span className="uppercase tracking-wider">{t('incidents.agentAlerts', { defaultValue: '{{errors}} erreurs, {{offline}} hors ligne', errors: stats.agentErrors, offline: stats.agentOffline })}</span>
                        </div>
                    )}
                    {stats.critical > 0 && (
                        <div className="group flex items-center gap-3 text-xs font-black text-destructive bg-destructive/10 px-4 py-3 rounded-xl border border-destructive/20 backdrop-blur-sm transition-all duration-normal ease-apple hover:scale-[1.02] hover:shadow-md">
                            <ShieldAlert className="h-4 w-4 shrink-0 group-hover:animate-pulse" />
                            <span className="uppercase tracking-wider">{stats.critical} {t('incidents.criticalOpen', { defaultValue: 'critiques ouverts' })}</span>
                        </div>
                    )}
                    {stats.open === 0 && stats.agentAlerts === 0 && (
                        <div className="flex items-center gap-3 text-xs font-black text-success bg-success/10 px-4 py-3 rounded-xl border border-success/20 backdrop-blur-sm transition-all duration-normal ease-apple hover:scale-[1.02]">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span className="uppercase tracking-wider">{t('incidents.noActiveAlerts', { defaultValue: 'Aucune alerte active' })}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ========== CHARTS GRID ========== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Severity Distribution (Interactive Donut) */}
                <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-xl border border-border/40 shadow-premium relative overflow-hidden group transition-all duration-normal ease-apple">
                    <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-normal ease-apple" />
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2 flex items-center gap-2 relative">
                        <AlertTriangle className="w-4 h-4 text-warning" />
                        {t('incidents.bySeverity', { defaultValue: 'Par Sévérité' })}
                    </h3>
                    <div className="h-[240px] w-full relative">
                        {severityData.length === 0 ? (
                            <EmptyChartState variant="pie" message="Aucune donnée" className="scale-75" />
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height="100%" >
                                    <PieChart>
                                        <defs>
                                            {severityData.map((entry, index) => (
                                                <linearGradient key={`gradient-${index || 'unknown'}`} id={`severityGradient-${uid}-${index}`} x1="0" y1="0" x2="1" y2="1">
                                                    <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                                                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <Pie
                                            activeIndex={activeIndex !== null ? activeIndex : undefined}
                                            activeShape={renderActiveShape as Pie['props']['activeShape']}
                                            data={severityData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius="50%"
                                            outerRadius="70%"
                                            paddingAngle={2}
                                            dataKey="value"
                                            cornerRadius={8}
                                            onMouseEnter={(_, index) => setActiveIndex(index)}
                                            onMouseLeave={() => setActiveIndex(null)}
                                        >
                                            {severityData.map((_, index) => (
                                                <Cell
                                                    key={`sev-${index || 'unknown'}`}
                                                    fill={`url(#severityGradient-${uid}-${index})`}
                                                    stroke="rgba(255,255,255,0.2)"
                                                    strokeWidth={2}
                                                    style={{
                                                        filter: activeIndex === index ? `url(#${svgIds.glowSeverity})` : 'none',
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
                                            <p className="text-3xl font-black text-foreground">{stats.total}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Total</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex justify-center gap-4 mt-4 flex-wrap">
                        {severityData.map((item, i) => (
                            <div
                                key={`sev-leg-${i || 'unknown'}`}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-normal ease-apple ${activeIndex === i ? 'bg-muted/20 scale-105' : 'hover:bg-muted/10'}`}
                                onMouseEnter={() => setActiveIndex(i)}
                                onMouseLeave={() => setActiveIndex(null)}
                                onFocus={() => setActiveIndex(i)}
                                onBlur={() => setActiveIndex(null)}
                                role="button"
                                tabIndex={0}
                                aria-label={`Sévérité: ${item.name} (${item.value})`}
                            >
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{item.name} ({item.value})</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Category Distribution (Enhanced Bars) */}
                <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-xl border border-border/40 shadow-premium relative overflow-hidden group transition-all duration-normal ease-apple">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-success/5 opacity-0 group-hover:opacity-100 transition-opacity duration-normal ease-apple" />
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2 flex items-center gap-2 relative">
                        <Activity className="w-4 h-4 text-primary" />
                        {t('incidents.byCategory', { defaultValue: 'Par Catégorie' })}
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
                                        key={cat.name || 'unknown'}
                                        className={`relative transition-all duration-300 ${isHovered ? 'scale-[1.02]' : ''}`}
                                        onMouseEnter={() => setHoveredCategory(cat.name)}
                                        onMouseLeave={() => setHoveredCategory(null)}
                                        onFocus={() => setHoveredCategory(cat.name)}
                                        onBlur={() => setHoveredCategory(null)}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Catégorie: ${cat.name} (${cat.value})`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{cat.icon}</span>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-foreground">{cat.name}</span>
                                            </div>
                                            <span className={`text-[10px] font-black transition-colors ${isHovered ? 'text-primary' : 'text-muted-foreground'}`}>{cat.value}</span>
                                        </div>
                                        <div className="h-2 bg-muted/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-normal ease-apple"
                                                style={{
                                                    width: `${percentage}%`,
                                                    background: `linear-gradient(90deg, ${cat.color}, var(--primary))`,
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
                <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-xl border border-border/40 shadow-premium relative overflow-hidden group transition-all duration-normal ease-apple">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-normal ease-apple" />
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2 flex items-center gap-2 relative">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        {t('incidents.byStatus', { defaultValue: 'Par Statut' })}
                    </h3>
                    <div className="h-[220px] w-full">
                        {statusData.length === 0 ? (
                            <EmptyChartState variant="bar" message="Aucun statut" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" >
                                <BarChart
                                    data={statusData}
                                    layout="vertical"
                                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                                >
                                    <defs>
                                        {statusData.map((entry, index) => (
                                            <linearGradient key={`status-grad-${index || 'unknown'}`} id={`statusGradient-${uid}-${index}`} x1="0" y1="0" x2="1" y2="0">
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
                                                key={`status-${index || 'unknown'}`}
                                                fill={`url(#statusGradient-${uid}-${index})`}
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
                <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-xl border border-border/40 shadow-premium lg:col-span-2 relative overflow-hidden group transition-all duration-normal ease-apple">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-success/5 opacity-0 group-hover:opacity-100 transition-opacity duration-normal ease-apple" />
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2 flex items-center gap-2 relative">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        {t('incidents.evolution30d', { defaultValue: 'Évolution (30 jours)' })}
                    </h3>
                    <div className="h-[300px] w-full">
                        {timelineData.every(d => d.nouveaux === 0 && d.resolus === 0) ? (
                            <EmptyChartState variant="line" message="Aucune activité récente" />
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" >
                                <ComposedChart data={timelineData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id={svgIds.gradientNew} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.4} />
                                            <stop offset="50%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.15} />
                                            <stop offset="100%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id={svgIds.gradientResolved} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.4} />
                                            <stop offset="50%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.15} />
                                            <stop offset="100%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0} />
                                        </linearGradient>
                                        <filter id={svgIds.glowLine} x="-20%" y="-20%" width="140%" height="140%">
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
                                    <Area yAxisId="left" type="monotone" dataKey="nouveaux" name="Nouveaux" stroke={SEVERITY_COLORS.critical} strokeWidth={2.5} fillOpacity={1} fill={`url(#${svgIds.gradientNew})`} dot={false} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
                                    <Area yAxisId="left" type="monotone" dataKey="resolus" name="Résolus" stroke={SENTINEL_PALETTE.success} strokeWidth={2.5} fillOpacity={1} fill={`url(#${svgIds.gradientResolved})`} dot={false} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
                                    <Line yAxisId="right" type="monotone" dataKey="cumul" name="Cumul ouvert" stroke={SENTINEL_PALETTE.primary} strokeWidth={3} dot={false} strokeDasharray="5 5" style={{ filter: `url(#${svgIds.glowLine})` }} />
                                    <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Activity Heatmap */}
                <div className="bg-[var(--glass-bg)] backdrop-blur-xl p-6 rounded-xl border border-border/40 shadow-premium relative overflow-hidden group transition-all duration-normal ease-apple">
                    <div className="absolute inset-0 bg-gradient-to-br from-warning/5 via-transparent to-destructive/5 opacity-0 group-hover:opacity-100 transition-opacity duration-normal ease-apple" />
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 px-2 flex items-center gap-2 relative">
                        <Activity className="w-4 h-4 text-warning" />
                        {t('incidents.activity4w', { defaultValue: 'Activité (4 semaines)' })}
                    </h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-[9px] text-muted-foreground font-black uppercase tracking-widest px-1 mb-3">
                            {[0, 1, 2, 3, 4, 5, 6].map(day => (
                                <span key={day}>{new Date(2024, 0, day).toLocaleDateString(config.intlLocale, { weekday: 'short' }).slice(0, 3)}</span>
                            ))}
                        </div>
                        {weeklyHeatData.map((week, wi) => (
                            <div key={wi || 'unknown'} className="flex gap-1.5 justify-between">
                                {week.days.map((day, di) => (
                                    <div
                                        key={di || 'unknown'}
                                        className={`flex-1 aspect-square rounded-lg ${getHeatColor(day.count)} transition-all duration-normal ease-apple hover:scale-110 hover:shadow-md cursor-pointer relative group/cell border border-border/10`}
                                        title={`${day.date.toLocaleDateString(config.intlLocale)}: ${day.count} incident(s)`}
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-md text-foreground text-[10px] font-black px-2 py-1 rounded border border-border/40 shadow-premium opacity-0 group-hover/cell:opacity-100 transition-all duration-normal ease-apple whitespace-nowrap pointer-events-none z-10 translate-y-1 group-hover/cell:translate-y-0">
                                            {day.count} incident{day.count > 1 ? 's' : ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-6 pt-4 border-t border-border/20">
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">{t('common.less', { defaultValue: 'Moins' })}</span>
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded bg-muted/10 border border-border/10" />
                            <div className="w-3 h-3 rounded bg-success/20 border border-success/20" />
                            <div className="w-3 h-3 rounded bg-warning/40 border border-warning/20" />
                            <div className="w-3 h-3 rounded bg-destructive/40 border border-destructive/20" />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-wider">{t('common.more', { defaultValue: 'Plus' })}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
