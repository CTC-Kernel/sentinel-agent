/**
 * AgentFleetDashboard
 *
 * Premium dashboard displaying fleet-wide agent KPIs with Apple-style design.
 * Features: OS distribution pie chart, compliance trends, real-time status.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';
import { SentinelAgent, AgentCheckResult } from '../../types/agent';
import { SENTINEL_PALETTE, CHART_STYLES } from '../../theme/chartTheme';
import { useLocale } from '@/hooks/useLocale';
import { ChartTooltip } from '../ui/ChartTooltip';
import {
    Shield, Activity,
    TrendingUp, TrendingDown, Minus,
    AlertTriangle, Cpu
} from '../ui/Icons';
import { cn } from '../../lib/utils';

/**
 * Compute compliance score from actual check results (pass / (pass + fail + error) * 100).
 * Returns null if no applicable results.
 */
function computeScoreFromResults(results: AgentCheckResult[]): number | null {
    if (!results || results.length === 0) return null;
    const applicable = results.filter(r => r.status !== 'not_applicable');
    if (applicable.length === 0) return null;
    const passed = applicable.filter(r => r.status === 'pass').length;
    return Math.round((passed / applicable.length) * 100);
}

interface AgentFleetDashboardProps {
    agents: SentinelAgent[];
    loading?: boolean;
    complianceResults?: Map<string, AgentCheckResult[]>;
}

// OS colors for pie chart
const OS_COLORS = {
    windows: SENTINEL_PALETTE.primary,
    darwin: SENTINEL_PALETTE.series3,
    linux: SENTINEL_PALETTE.success,
};

// KPI Stat Card
interface StatCardProps {
    label: string;
    value: string | number;
    sublabel?: string;
    icon: React.ReactNode;
    trend?: { value: number; isPositive?: boolean };
    variant?: 'default' | 'success' | 'warning' | 'danger';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, sublabel, icon, trend, variant = 'default' }) => {
    const variantBg = {
        default: 'from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/30',
        success: 'from-success/5 to-success/10',
        warning: 'from-warning/5 to-warning/10',
        danger: 'from-destructive/5 to-destructive/10',
    };

    const variantIcon = {
        default: 'bg-muted text-muted-foreground',
        success: 'bg-success/15 text-success',
        warning: 'bg-warning/15 text-warning',
        danger: 'bg-destructive/15 text-destructive',
    };

    return (
        <div className={cn(
            'relative overflow-hidden rounded-2xl p-5 border border-border/50',
            'bg-gradient-to-br shadow-apple-sm hover:shadow-apple transition-shadow duration-300',
            variantBg[variant]
        )}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        {label}
                    </span>
                    <span className="text-3xl font-black font-display tracking-tight text-foreground">
                        {value}
                    </span>
                    {sublabel && (
                        <span className="text-xs text-muted-foreground">{sublabel}</span>
                    )}
                    {trend && (
                        <div className={cn(
                            'flex items-center gap-1 text-xs font-semibold mt-1',
                            trend.isPositive === undefined ? 'text-muted-foreground' :
                                trend.isPositive ? 'text-success' : 'text-destructive'
                        )}>
                            {trend.isPositive === undefined ? (
                                <Minus className="h-3 w-3" />
                            ) : trend.isPositive ? (
                                <TrendingUp className="h-3 w-3" />
                            ) : (
                                <TrendingDown className="h-3 w-3" />
                            )}
                            <span>{Math.abs(trend.value)}%</span>
                        </div>
                    )}
                </div>
                <div className={cn(
                    'flex items-center justify-center w-12 h-12 rounded-3xl',
                    variantIcon[variant]
                )}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

export const AgentFleetDashboard: React.FC<AgentFleetDashboardProps> = ({ agents, loading, complianceResults }) => {
    const { config } = useLocale();
    // Computed statistics
    const stats = useMemo(() => {
        const total = agents.length;
        const active = agents.filter(a => a.status === 'active').length;
        const offline = agents.filter(a => a.status === 'offline').length;
        const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;

        // Compliance score: prefer computed from actual results, fallback to agent-reported
        const agentScores: number[] = [];
        agents.forEach(a => {
            // Try computed score from real results first
            const results = complianceResults?.get(a.id);
            const computedScore = results ? computeScoreFromResults(results) : null;
            const score = computedScore ?? a.complianceScore;
            if (score !== undefined && score !== null) {
                agentScores.push(score);
            }
        });
        const avgScore = agentScores.length > 0
            ? Math.round(agentScores.reduce((sum, s) => sum + s, 0) / agentScores.length)
            : null;

        // OS distribution
        const osDistribution = {
            windows: agents.filter(a => a.os === 'windows').length,
            darwin: agents.filter(a => a.os === 'darwin').length,
            linux: agents.filter(a => a.os === 'linux').length,
        };

        // Critical agents: use reliable score (computed from results when available)
        const critical = agents.filter(a => {
            if (a.status === 'offline') return true;
            const results = complianceResults?.get(a.id);
            const computedScore = results ? computeScoreFromResults(results) : null;
            const score = computedScore ?? a.complianceScore;
            return score !== undefined && score !== null && score < 50;
        }).length;

        // Version distribution
        const versions = new Map<string, number>();
        agents.forEach(a => {
            const v = a.version || 'unknown';
            versions.set(v, (versions.get(v) || 0) + 1);
        });
        const latestVersion = [...versions.entries()]
            .sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }))[0];
        const upToDate = latestVersion
            ? agents.filter(a => a.version === latestVersion[0]).length
            : 0;
        const updateRate = total > 0 ? Math.round((upToDate / total) * 100) : 0;

        return {
            total,
            active,
            offline,
            activeRate,
            avgScore,
            osDistribution,
            critical,
            upToDate,
            updateRate,
            latestVersion: latestVersion?.[0] || 'N/A',
        };
    }, [agents, complianceResults]);

    // Pie chart data for OS distribution
    const osChartData = useMemo(() => [
        { name: 'Windows', value: stats.osDistribution.windows, color: OS_COLORS.windows },
        { name: 'macOS', value: stats.osDistribution.darwin, color: OS_COLORS.darwin },
        { name: 'Linux', value: stats.osDistribution.linux, color: OS_COLORS.linux },
    ].filter(d => d.value > 0), [stats.osDistribution]);

    // Trend data based on current score
    // Historical trends will be available once the fleet metrics collection is fully implemented
    const trendData = useMemo(() => {
        if (stats.avgScore === null) return [];
        const now = new Date();
        // Currently we only have the "now" point. 
        // Showing a flat line with "Pas d'historique" inTooltip is better than simulated growth.
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(now);
            date.setDate(date.getDate() - (6 - i));
            const dayLabel = i === 6 ? 'Auj.' :
                i === 5 ? 'Hier' :
                    date.toLocaleDateString(config.intlLocale, { weekday: 'short' });

            return {
                day: dayLabel,
                score: i === 6 ? stats.avgScore : null,
                isPlaceholder: i < 6
            };
        });
    }, [stats.avgScore]);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-48 bg-muted/50 rounded-3xl" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i || 'unknown'} className="h-32 bg-muted/50 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-6"
        >
            {/* Premium Fleet Overview Banner */}
            <motion.div
                variants={slideUpVariants}
                className="glass-premium p-6 md:p-8 rounded-4xl relative overflow-hidden shadow-apple"
            >
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-success/5 pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    {/* Left: Main Stats */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex h-2 w-2 rounded-full bg-success animate-pulse shadow-glow shadow-success/30" />
                            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                                Fleet d'agents
                            </p>
                        </div>
                        <div className="flex items-baseline gap-4">
                            <span className="text-5xl md:text-6xl font-black text-foreground tracking-tight">
                                {stats.total}
                            </span>
                            <span className="text-lg font-semibold text-muted-foreground">
                                endpoints déployés
                            </span>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-success" />
                                <span className="text-muted-foreground">
                                    <strong className="text-foreground">{stats.active}</strong> actifs
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                                <span className="text-muted-foreground">
                                    <strong className="text-foreground">{stats.offline}</strong> hors ligne
                                </span>
                            </div>
                            {stats.critical > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                                    <span className="text-destructive font-medium">
                                        {stats.critical} critiques
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: OS Distribution Donut */}
                    <div className="flex items-center gap-6">
                        <div className="w-32 h-32">
                            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
                                <PieChart>
                                    <Pie
                                        data={osChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={55}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {osChartData.map((entry, index) => (
                                            <Cell key={`cell-${index || 'unknown'}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-2">
                            {osChartData.map((item) => (
                                <div key={item.name || 'unknown'} className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-sm"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        {item.name}
                                    </span>
                                    <span className="text-sm font-bold text-foreground">
                                        {item.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* KPI Cards Grid */}
            <motion.div
                variants={staggerContainerVariants}
                className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
                <motion.div variants={slideUpVariants}>
                    <StatCard
                        label="Taux d'activité"
                        value={`${stats.activeRate}%`}
                        sublabel={`${stats.active}/${stats.total} agents`}
                        icon={<Activity className="h-6 w-6" />}
                        variant={stats.activeRate >= 90 ? 'success' : stats.activeRate >= 70 ? 'warning' : 'danger'}
                    />
                </motion.div>

                <motion.div variants={slideUpVariants}>
                    <StatCard
                        label="Score Conformité"
                        value={stats.avgScore !== null ? `${stats.avgScore}%` : '-'}
                        sublabel={stats.avgScore !== null ? 'Moyenne de la flotte' : 'Aucune donnée'}
                        icon={<Shield className="h-6 w-6" />}
                        variant={stats.avgScore === null ? 'default' : stats.avgScore >= 80 ? 'success' : stats.avgScore >= 60 ? 'warning' : 'danger'}
                    />
                </motion.div>

                <motion.div variants={slideUpVariants}>
                    <StatCard
                        label="Agents à jour"
                        value={`${stats.updateRate}%`}
                        sublabel={`Version ${stats.latestVersion}`}
                        icon={<Cpu className="h-6 w-6" />}
                        variant={stats.updateRate >= 90 ? 'success' : stats.updateRate >= 70 ? 'warning' : 'danger'}
                    />
                </motion.div>

                <motion.div variants={slideUpVariants}>
                    <StatCard
                        label="Alertes Critiques"
                        value={stats.critical}
                        sublabel="Agents en alerte"
                        icon={<AlertTriangle className="h-6 w-6" />}
                        variant={stats.critical === 0 ? 'success' : stats.critical <= 2 ? 'warning' : 'danger'}
                    />
                </motion.div>
            </motion.div>

            {/* Compliance Score Display */}
            {stats.avgScore !== null && (
                <motion.div
                    variants={slideUpVariants}
                    className="glass-premium rounded-2xl p-6 border border-border/50"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-foreground">Score Conformité Actuel</h3>
                            <p className="text-xs text-muted-foreground">Basé sur les derniers résultats remontés</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="w-3 h-3 rounded-full bg-brand-500" />
                            <span>Score conformité</span>
                        </div>
                    </div>
                    {trendData.filter(d => d.score !== null).length <= 1 ? (
                        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                            <div className="text-center">
                                <div className={cn(
                                    'text-4xl font-black mb-2',
                                    stats.avgScore >= 80 ? 'text-success' : stats.avgScore >= 60 ? 'text-warning' : 'text-destructive'
                                )}>
                                    {stats.avgScore}%
                                </div>
                                <p>Données insuffisantes pour afficher une tendance</p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-48 min-h-48">
                            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={224}>
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.3} />
                                            <stop offset="100%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="day"
                                        {...CHART_STYLES.axis}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        {...CHART_STYLES.axis}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `${v}%`}
                                    />
                                    <Tooltip content={<ChartTooltip formatter={(v) => v !== null ? `${v}%` : 'Pas de données'} />} />
                                    <Area
                                        type="monotone"
                                        dataKey="score"
                                        stroke={SENTINEL_PALETTE.primary}
                                        strokeWidth={2}
                                        fill="url(#scoreGradient)"
                                        connectNulls={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </motion.div>
            )}
        </motion.div>
    );
};

export default AgentFleetDashboard;
