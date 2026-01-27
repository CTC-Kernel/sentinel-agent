/**
 * FleetHealthReport
 *
 * Comprehensive health report for agent fleet.
 * Shows status distribution, performance metrics, and anomalies.
 *
 * Sprint 10 - Reporting & RBAC
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { useStore } from '../../store';
import { AgentReportService } from '../../services/AgentReportService';
import { ErrorLogger } from '../../services/errorLogger';
import type {
    FleetHealthReportData,
    ReportConfig,
    ReportFilters,
    ReportDateRange,
    ExportFormat,
} from '../../types/agentReport';
import {
    Activity, Server, Cpu, HardDrive, Wifi, AlertTriangle,
    Download, Calendar, CheckCircle2, XCircle,
    ChevronDown, BarChart3, PieChart, Zap, Loader2,
    TrendingUp, TrendingDown, RefreshCw,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

// ============================================================================
// Types
// ============================================================================

interface FleetHealthReportProps {
    /** Initial filters */
    initialFilters?: ReportFilters;
    /** Initial date range */
    initialDateRange?: ReportDateRange;
    /** On export click */
    onExport?: (format: ExportFormat) => void;
    /** Custom class name */
    className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

interface MetricCardProps {
    title: string;
    value: number;
    unit?: string;
    icon: React.ReactNode;
    trend?: number;
    status?: 'good' | 'warning' | 'critical';
}

const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    unit = '%',
    icon,
    trend,
    status = 'good',
}) => {
    const statusStyles = {
        good: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
        critical: 'bg-danger/10 text-danger',
    };

    return (
        <div className="glass-panel rounded-2xl p-4">
            <div className="flex items-start justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${statusStyles[status]}`}>
                    {icon}
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-xs ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
                        {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</span>
                    </div>
                )}
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {title}
            </p>
            <p className="text-2xl font-bold font-display text-foreground mt-1">
                {value.toFixed(1)}<span className="text-sm text-muted-foreground ml-1">{unit}</span>
            </p>
        </div>
    );
};

interface StatusDistributionChartProps {
    data: Array<{
        status: 'active' | 'offline' | 'pending' | 'error';
        count: number;
        percentage: number;
    }>;
}

const StatusDistributionChart: React.FC<StatusDistributionChartProps> = ({ data }) => {
    const statusConfig = {
        active: { color: 'bg-success', label: 'Actifs' },
        offline: { color: 'bg-muted-foreground', label: 'Hors ligne' },
        pending: { color: 'bg-warning', label: 'En attente' },
        error: { color: 'bg-danger', label: 'Erreur' },
    };

    return (
        <div className="space-y-4">
            {/* Stacked bar */}
            <div className="h-4 rounded-full overflow-hidden flex">
                {data.map((item) => (
                    <div
                        key={item.status}
                        className={`${statusConfig[item.status].color} transition-all duration-500`}
                        style={{ width: `${item.percentage}%` }}
                    />
                ))}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2">
                {data.map((item) => (
                    <div key={item.status} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${statusConfig[item.status].color}`} />
                        <span className="text-xs text-muted-foreground">
                            {statusConfig[item.status].label}
                        </span>
                        <span className="text-xs font-semibold text-foreground ml-auto">
                            {item.count}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface OSDistributionChartProps {
    data: Array<{
        os: string;
        count: number;
        percentage: number;
    }>;
}

const OSDistributionChart: React.FC<OSDistributionChartProps> = ({ data }) => {
    const osConfig: Record<string, { color: string; icon: string }> = {
        windows: { color: 'bg-blue-500', icon: '🪟' },
        macos: { color: 'bg-slate-500', icon: '🍎' },
        linux: { color: 'bg-orange-500', icon: '🐧' },
        unknown: { color: 'bg-muted', icon: '❓' },
    };

    return (
        <div className="space-y-3">
            {data.map((item) => {
                const config = osConfig[item.os.toLowerCase()] || osConfig.unknown;
                return (
                    <div key={item.os} className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground flex items-center gap-2">
                                <span>{config.icon}</span>
                                {item.os}
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                                {item.count} ({item.percentage.toFixed(0)}%)
                            </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full ${config.color} transition-all duration-500`}
                                style={{ width: `${item.percentage}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

interface VersionListProps {
    data: Array<{
        version: string;
        count: number;
        percentage: number;
        isLatest: boolean;
    }>;
}

const VersionList: React.FC<VersionListProps> = ({ data }) => {
    return (
        <div className="space-y-2">
            {data.map((item) => (
                <div
                    key={item.version}
                    className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground font-mono">{item.version}</span>
                        {item.isLatest && (
                            <Badge variant="soft" className="bg-success/10 text-success text-xs">
                                Latest
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full ${item.isLatest ? 'bg-success' : 'bg-warning'}`}
                                style={{ width: `${item.percentage}%` }}
                            />
                        </div>
                        <span className="text-sm text-muted-foreground w-16 text-right">
                            {item.count} ({item.percentage.toFixed(0)}%)
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

interface UptimeChartProps {
    data: Array<{
        date: string;
        avgUptime: number;
        activeCount: number;
        offlineCount: number;
    }>;
}

const UptimeChart: React.FC<UptimeChartProps> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                Pas de données disponibles
            </div>
        );
    }

    return (
        <div className="h-32 flex items-end gap-1">
            {data.map((point, index) => {
                const date = new Date(point.date);
                const total = point.activeCount + point.offlineCount;
                const activePercent = total > 0 ? (point.activeCount / total) * 100 : 0;

                return (
                    <div
                        key={index}
                        className="flex-1 flex flex-col items-center gap-1 group"
                    >
                        <div className="relative w-full h-24 bg-muted/50 rounded overflow-hidden flex flex-col justify-end">
                            <div
                                className="w-full bg-success transition-all duration-300"
                                style={{ height: `${activePercent}%` }}
                            />
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                {point.avgUptime.toFixed(1)}% uptime
                            </div>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                            {date.toLocaleDateString('fr-FR', { day: '2-digit' })}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

interface AnomalySummaryProps {
    data: {
        totalAnomalies: number;
        criticalAnomalies: number;
        resolvedAnomalies: number;
        avgResolutionTime: number;
    };
}

const AnomalySummary: React.FC<AnomalySummaryProps> = ({ data }) => {
    const formatTime = (minutes: number) => {
        if (minutes < 60) return `${minutes.toFixed(0)}min`;
        if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
        return `${(minutes / 1440).toFixed(1)}j`;
    };

    return (
        <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-xl">
                <p className="text-2xl font-bold text-foreground">{data.totalAnomalies}</p>
                <p className="text-xs text-muted-foreground mt-1">Total anomalies</p>
            </div>
            <div className="text-center p-4 bg-danger/10 rounded-xl">
                <p className="text-2xl font-bold text-danger">{data.criticalAnomalies}</p>
                <p className="text-xs text-muted-foreground mt-1">Critiques</p>
            </div>
            <div className="text-center p-4 bg-success/10 rounded-xl">
                <p className="text-2xl font-bold text-success">{data.resolvedAnomalies}</p>
                <p className="text-xs text-muted-foreground mt-1">Résolues</p>
            </div>
            <div className="text-center p-4 bg-primary/10 rounded-xl">
                <p className="text-2xl font-bold text-primary">{formatTime(data.avgResolutionTime)}</p>
                <p className="text-xs text-muted-foreground mt-1">MTTR</p>
            </div>
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const FleetHealthReport: React.FC<FleetHealthReportProps> = ({
    initialFilters = {},
    initialDateRange = { start: '', end: '', preset: 'last_7_days' },
    onExport,
    className = '',
}) => {
    const { user } = useStore();
    const [data, setData] = useState<FleetHealthReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, _setFilters] = useState<ReportFilters>(initialFilters);
    const [dateRange, setDateRange] = useState<ReportDateRange>(initialDateRange);
    const [exporting, setExporting] = useState(false);

    // Fetch report data
    useEffect(() => {
        const fetchData = async () => {
            if (!user?.organizationId) return;

            setLoading(true);
            setError(null);

            try {
                const reportData = await AgentReportService.fetchFleetHealthReportData(
                    user.organizationId,
                    filters,
                    dateRange
                );
                setData(reportData);
            } catch (err) {
                ErrorLogger.error(err, 'FleetHealthReport.fetchData');
                setError('Erreur lors du chargement des données');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user?.organizationId, filters, dateRange]);

    // Handle export
    const handleExport = async (format: ExportFormat) => {
        if (!user?.organizationId) return;

        setExporting(true);

        try {
            const config: ReportConfig = {
                type: 'fleet_health',
                name: `Rapport santé fleet - ${new Date().toLocaleDateString('fr-FR')}`,
                dateRange,
                filters,
                format,
                includeCharts: format === 'pdf',
                includeRawData: format !== 'pdf',
                includeRecommendations: true,
                includeExecutiveSummary: true,
                sections: [],
                locale: 'fr-FR',
                timezone: 'Europe/Paris',
            };

            const reportId = await AgentReportService.generateReport(
                user.organizationId,
                config,
                user.uid
            );

            if (onExport) {
                onExport(format);
            }

            ErrorLogger.debug(`Report generated: ${reportId}`, 'FleetHealthReport.handleExport');
        } catch (err) {
            ErrorLogger.error(err, 'FleetHealthReport.handleExport');
        } finally {
            setExporting(false);
        }
    };

    // Determine metric status
    const getCpuStatus = (value: number): 'good' | 'warning' | 'critical' => {
        if (value < 60) return 'good';
        if (value < 80) return 'warning';
        return 'critical';
    };

    const getMemoryStatus = (value: number): 'good' | 'warning' | 'critical' => {
        if (value < 70) return 'good';
        if (value < 85) return 'warning';
        return 'critical';
    };

    const getDiskStatus = (value: number): 'good' | 'warning' | 'critical' => {
        if (value < 75) return 'good';
        if (value < 90) return 'warning';
        return 'critical';
    };

    if (loading) {
        return (
            <div className={`flex items-center justify-center h-96 ${className}`}>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className={`glass-panel rounded-2xl p-8 text-center ${className}`}>
                <AlertTriangle className="h-12 w-12 text-danger mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => window.location.reload()}
                >
                    Réessayer
                </Button>
            </div>
        );
    }

    if (!data) {
        return (
            <div className={`glass-panel rounded-2xl p-8 text-center ${className}`}>
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Aucune donnée disponible</p>
            </div>
        );
    }

    return (
        <motion.div
            variants={slideUpVariants}
            initial="initial"
            animate="visible"
            className={`space-y-6 ${className}`}
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Rapport Santé Fleet
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {data.summary.totalAgents} agents - {data.summary.activeAgents} actifs
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Date Range Selector */}
                    <Select
                        value={dateRange.preset || 'custom'}
                        onValueChange={(value) => setDateRange({ ...dateRange, preset: value as ReportDateRange['preset'] })}
                    >
                        <SelectTrigger className="w-40">
                            <Calendar className="h-4 w-4 mr-2" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="last_7_days">7 derniers jours</SelectItem>
                            <SelectItem value="last_30_days">30 derniers jours</SelectItem>
                            <SelectItem value="last_90_days">90 derniers jours</SelectItem>
                            <SelectItem value="this_month">Ce mois</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Export Button */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2" disabled={exporting}>
                                {exporting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                                Exporter
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2">
                            <div className="space-y-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => handleExport('pdf')}
                                >
                                    PDF
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => handleExport('excel')}
                                >
                                    Excel
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => handleExport('csv')}
                                >
                                    CSV
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Server className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Agents</p>
                            <p className="text-2xl font-bold font-display text-foreground">
                                {data.summary.totalAgents}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="glass-panel rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 text-success">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Actifs</p>
                            <p className="text-2xl font-bold font-display text-success">
                                {data.summary.activeAgents}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="glass-panel rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <XCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Hors ligne</p>
                            <p className="text-2xl font-bold font-display text-muted-foreground">
                                {data.summary.offlineAgents}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="glass-panel rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 text-success">
                            <Zap className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Uptime moyen</p>
                            <p className="text-2xl font-bold font-display text-foreground">
                                {data.summary.averageUptime.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="CPU moyen"
                    value={data.performanceMetrics.avgCpuUsage}
                    icon={<Cpu className="h-5 w-5" />}
                    status={getCpuStatus(data.performanceMetrics.avgCpuUsage)}
                />
                <MetricCard
                    title="Mémoire moyenne"
                    value={data.performanceMetrics.avgMemoryUsage}
                    icon={<Activity className="h-5 w-5" />}
                    status={getMemoryStatus(data.performanceMetrics.avgMemoryUsage)}
                />
                <MetricCard
                    title="Disque moyen"
                    value={data.performanceMetrics.avgDiskUsage}
                    icon={<HardDrive className="h-5 w-5" />}
                    status={getDiskStatus(data.performanceMetrics.avgDiskUsage)}
                />
                <MetricCard
                    title="Latence réseau"
                    value={data.performanceMetrics.avgNetworkLatency}
                    unit="ms"
                    icon={<Wifi className="h-5 w-5" />}
                    status={data.performanceMetrics.avgNetworkLatency < 100 ? 'good' : data.performanceMetrics.avgNetworkLatency < 200 ? 'warning' : 'critical'}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Status Distribution */}
                <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        <PieChart className="h-4 w-4 text-primary" />
                        Distribution des statuts
                    </h3>
                    <StatusDistributionChart data={data.statusDistribution} />
                </div>

                {/* OS Distribution */}
                <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" />
                        Distribution par OS
                    </h3>
                    <OSDistributionChart data={data.osDistribution} />
                </div>

                {/* Uptime Chart */}
                <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Historique de disponibilité
                    </h3>
                    <UptimeChart data={data.uptimeData} />
                </div>

                {/* Version Distribution */}
                <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-primary" />
                        Versions des agents
                    </h3>
                    <VersionList data={data.versionDistribution} />
                </div>
            </div>

            {/* Anomaly Summary */}
            <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Résumé des anomalies
                </h3>
                <AnomalySummary data={data.anomalySummary} />
            </div>
        </motion.div>
    );
};

export default FleetHealthReport;
