/**
 * AgentMetricsChart
 *
 * Real-time streaming metrics chart for agent monitoring.
 * Displays CPU, Memory, Disk, and Network metrics with 1-minute rolling window.
 * Apple Activity Monitor-inspired design.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip
} from 'recharts';
import { slideUpVariants } from '../ui/animationVariants';
import { AgentRealtimeMetrics } from '../../types/agent';
import { SENTINEL_PALETTE, CHART_STYLES, ChartGradients } from '../../theme/chartTheme';
import { ChartTooltip } from '../ui/ChartTooltip';
import { Cpu, HardDrive, Activity, Network } from '../ui/Icons';
import { cn } from '../../lib/utils';

interface AgentMetricsChartProps {
    metrics: AgentRealtimeMetrics[];
    loading?: boolean;
    className?: string;
}

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// Format time for X axis
const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Individual metric card component
interface MetricCardProps {
    label: string;
    value: string;
    percent?: number;
    icon: React.ReactNode;
    color: string;
    trend?: 'up' | 'down' | 'stable';
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, percent, icon, color }) => (
    <div className="flex items-center gap-3 p-3 rounded-3xl bg-muted/30 border border-border/30">
        <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
        >
            <div style={{ color }}>{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                {label}
            </span>
            <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-foreground">{value}</span>
                {percent !== undefined && (
                    <span
                        className="text-sm font-semibold"
                        style={{ color }}
                    >
                        {percent.toFixed(1)}%
                    </span>
                )}
            </div>
        </div>
    </div>
);

// Chart gradient definitions
const GradientDefs: React.FC = () => (
    <defs>
        <linearGradient id={ChartGradients.primary.id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0.4} />
            <stop offset="100%" stopColor={SENTINEL_PALETTE.primary} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={ChartGradients.success.id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0.4} />
            <stop offset="100%" stopColor={SENTINEL_PALETTE.success} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={ChartGradients.purple.id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SENTINEL_PALETTE.secondary} stopOpacity={0.4} />
            <stop offset="100%" stopColor={SENTINEL_PALETTE.secondary} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={ChartGradients.info.id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SENTINEL_PALETTE.info} stopOpacity={0.4} />
            <stop offset="100%" stopColor={SENTINEL_PALETTE.info} stopOpacity={0} />
        </linearGradient>
    </defs>
);

export const AgentMetricsChart: React.FC<AgentMetricsChartProps> = ({
    metrics,
    loading,
    className
}) => {
    // Get current (latest) metrics
    const currentMetrics = useMemo(() => {
        if (metrics.length === 0) return null;
        return metrics[metrics.length - 1];
    }, [metrics]);

    // Transform data for chart
    const chartData = useMemo(() => {
        return metrics.map((m) => ({
            time: formatTime(m.timestamp),
            timestamp: m.timestamp,
            cpu: m.cpuPercent,
            memory: m.memoryPercent,
            disk: m.diskPercent,
            networkIn: m.networkInBytes,
            networkOut: m.networkOutBytes,
        }));
    }, [metrics]);

    if (loading) {
        return (
            <div className={cn('space-y-4 animate-pulse', className)}>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-20 bg-muted/50 rounded-3xl" />
                    ))}
                </div>
                <div className="h-64 bg-muted/50 rounded-2xl" />
            </div>
        );
    }

    return (
        <motion.div
            variants={slideUpVariants}
            className={cn('space-y-4', className)}
        >
            {/* Current Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard
                    label="CPU"
                    value={currentMetrics ? `${currentMetrics.cpuPercent.toFixed(1)}%` : '-'}
                    icon={<Cpu className="h-5 w-5" />}
                    color={SENTINEL_PALETTE.primary}
                />
                <MetricCard
                    label="Mémoire"
                    value={currentMetrics ? formatBytes(currentMetrics.memoryBytes) : '-'}
                    percent={currentMetrics?.memoryPercent}
                    icon={<HardDrive className="h-5 w-5" />}
                    color={SENTINEL_PALETTE.success}
                />
                <MetricCard
                    label="Disque"
                    value={currentMetrics ? `${currentMetrics.diskPercent.toFixed(1)}%` : '-'}
                    icon={<Activity className="h-5 w-5" />}
                    color={SENTINEL_PALETTE.secondary}
                />
                <MetricCard
                    label="Réseau"
                    value={currentMetrics ? `↓${formatBytes(currentMetrics.networkInBytes)}/s` : '-'}
                    icon={<Network className="h-5 w-5" />}
                    color={SENTINEL_PALETTE.info}
                />
            </div>

            {/* Streaming Chart */}
            <div className="glass-premium rounded-2xl p-4 border border-border/50">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-foreground">Métriques en temps réel</h3>
                        <p className="text-xs text-muted-foreground">Dernière minute d'activité</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTINEL_PALETTE.primary }} />
                            <span className="text-muted-foreground">CPU</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTINEL_PALETTE.success }} />
                            <span className="text-muted-foreground">RAM</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SENTINEL_PALETTE.secondary }} />
                            <span className="text-muted-foreground">Disque</span>
                        </div>
                    </div>
                </div>

                <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <GradientDefs />
                            <XAxis
                                dataKey="time"
                                {...CHART_STYLES.axis}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                domain={[0, 100]}
                                {...CHART_STYLES.axis}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => `${v}%`}
                                width={40}
                            />
                            <Tooltip
                                content={
                                    <ChartTooltip
                                        formatter={(v) => `${v.toFixed(1)}%`}
                                    />
                                }
                            />
                            <Area
                                type="monotone"
                                dataKey="cpu"
                                name="CPU"
                                stroke={SENTINEL_PALETTE.primary}
                                strokeWidth={2}
                                fill={`url(#${ChartGradients.primary.id})`}
                            />
                            <Area
                                type="monotone"
                                dataKey="memory"
                                name="RAM"
                                stroke={SENTINEL_PALETTE.success}
                                strokeWidth={2}
                                fill={`url(#${ChartGradients.success.id})`}
                            />
                            <Area
                                type="monotone"
                                dataKey="disk"
                                name="Disque"
                                stroke={SENTINEL_PALETTE.secondary}
                                strokeWidth={2}
                                fill={`url(#${ChartGradients.purple.id})`}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </motion.div>
    );
};

export default AgentMetricsChart;
