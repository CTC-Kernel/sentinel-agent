/**
 * AgentComplianceReport
 *
 * Comprehensive compliance report for agent fleet.
 * Shows compliance score breakdown, trends, and recommendations.
 *
 * Sprint 10 - Reporting & RBAC
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { useStore } from '../../store';
import { AgentReportService } from '../../services/AgentReportService';
import { ErrorLogger } from '../../services/errorLogger';
import type {
    ComplianceReportData,
    ReportConfig,
    ReportFilters,
    ReportDateRange,
    ExportFormat,
} from '../../types/agentReport';
import {
    FileCheck, TrendingUp, TrendingDown, AlertTriangle,
    Download, Calendar, CheckCircle2, XCircle,
    ChevronDown, BarChart3, PieChart, ListChecks, Loader2,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { useLocale } from '@/hooks/useLocale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { RadialGauge } from '../ui/RadialGauge';

// ============================================================================
// Types
// ============================================================================

interface AgentComplianceReportProps {
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

interface ScoreCardProps {
    title: string;
    value: number;
    change?: number;
    suffix?: string;
    variant?: 'default' | 'success' | 'warning' | 'danger';
}

const ScoreCard: React.FC<ScoreCardProps> = ({
    title,
    value,
    change,
    suffix = '%',
    variant = 'default',
}) => {
    const variantStyles = {
        default: 'bg-muted/50',
        success: 'bg-success/10',
        warning: 'bg-warning/10',
        danger: 'bg-danger/10',
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-success';
        if (score >= 60) return 'text-warning';
        return 'text-danger';
    };

    return (
        <div className={`rounded-2xl p-4 ${variantStyles[variant]}`}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {title}
            </p>
            <div className="flex items-end gap-2">
                <span className={`text-3xl font-bold font-display ${getScoreColor(value)}`}>
                    {value.toFixed(0)}
                </span>
                <span className="text-muted-foreground text-sm mb-1">{suffix}</span>
                {change !== undefined && change !== 0 && (
                    <div className={`flex items-center gap-1 text-xs ml-auto ${change > 0 ? 'text-success' : 'text-danger'}`}>
                        {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
                    </div>
                )}
            </div>
        </div>
    );
};

interface FrameworkRowProps {
    framework: {
        frameworkId: string;
        frameworkName: string;
        averageScore: number;
        compliantCount: number;
        totalChecks: number;
        passedChecks: number;
    };
}

const FrameworkRow: React.FC<FrameworkRowProps> = ({ framework }) => {
    const passRate = framework.totalChecks > 0
        ? (framework.passedChecks / framework.totalChecks) * 100
        : 0;

    return (
        <div className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                    {framework.frameworkName}
                </p>
                <p className="text-xs text-muted-foreground">
                    {framework.passedChecks}/{framework.totalChecks} checks
                </p>
            </div>
            <div className="flex items-center gap-3">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${passRate >= 80 ? 'bg-success' : passRate >= 60 ? 'bg-warning' : 'bg-danger'
                            }`}
                        style={{ width: `${passRate}%` }}
                    />
                </div>
                <span className={`text-sm font-semibold w-12 text-right ${framework.averageScore >= 80 ? 'text-success' :
                        framework.averageScore >= 60 ? 'text-warning' : 'text-danger'
                    }`}>
                    {framework.averageScore.toFixed(0)}%
                </span>
            </div>
        </div>
    );
};

interface IssueRowProps {
    issue: {
        checkId: string;
        checkName: string;
        failedCount: number;
        percentage: number;
        severity: 'critical' | 'high' | 'medium' | 'low';
        recommendation: string;
    };
    totalAgents: number;
}

const IssueRow: React.FC<IssueRowProps> = ({ issue }) => {
    const severityStyles = {
        critical: 'bg-danger/10 text-danger',
        high: 'bg-orange-500/10 text-orange-500',
        medium: 'bg-warning/10 text-warning',
        low: 'bg-muted text-muted-foreground',
    };

    return (
        <div className="py-3 border-b border-border/50 last:border-0">
            <div className="flex items-start gap-3">
                <Badge variant="soft" className={severityStyles[issue.severity]}>
                    {issue.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                        {issue.checkName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {issue.failedCount} agents affectés ({issue.percentage.toFixed(1)}%)
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 italic">
                        {issue.recommendation}
                    </p>
                </div>
            </div>
        </div>
    );
};

interface TrendChartProps {
    data: Array<{
        date: string;
        averageScore: number;
        compliantCount: number;
        totalCount: number;
    }>;
}

const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
    const { config } = useLocale();
    if (data.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Pas de données de tendance disponibles
            </div>
        );
    }

    const maxScore = Math.max(...data.map(d => d.averageScore));
    const minScore = Math.min(...data.map(d => d.averageScore));
    const range = maxScore - minScore || 1;

    return (
        <div className="h-48 flex items-end gap-1">
            {data.map((point, index) => {
                const height = ((point.averageScore - minScore) / range) * 100;
                const date = new Date(point.date);

                return (
                    <div
                        key={index || 'unknown'}
                        className="flex-1 flex flex-col items-center gap-1 group"
                    >
                        <div className="relative w-full">
                            <div
                                className={`w-full rounded-t transition-all duration-300 group-hover:opacity-80 ${point.averageScore >= 80 ? 'bg-success' :
                                        point.averageScore >= 60 ? 'bg-warning' : 'bg-danger'
                                    }`}
                                style={{ height: `${Math.max(height, 5)}%`, minHeight: '4px' }}
                            />
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                                {point.averageScore.toFixed(1)}%
                            </div>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                            {date.toLocaleDateString(config.intlLocale, { day: '2-digit', month: 'short' })}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

interface ScoreDistributionProps {
    data: Array<{
        range: string;
        count: number;
        percentage: number;
    }>;
}

const ScoreDistribution: React.FC<ScoreDistributionProps> = ({ data }) => {
    const getColor = (range: string) => {
        if (range.includes('80') || range.includes('90') || range.includes('100')) return 'bg-success';
        if (range.includes('60') || range.includes('70')) return 'bg-warning';
        return 'bg-danger';
    };

    return (
        <div className="space-y-2">
            {data.map((item, index) => (
                <div key={index || 'unknown'} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">{item.range}</span>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                        <div
                            className={`h-full ${getColor(item.range)} transition-all duration-500`}
                            style={{ width: `${item.percentage}%` }}
                        />
                    </div>
                    <span className="text-xs font-medium text-foreground w-12 text-right">
                        {item.count}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const AgentComplianceReport: React.FC<AgentComplianceReportProps> = ({
    initialFilters = {},
    initialDateRange = { start: '', end: '', preset: 'last_30_days' },
    onExport,
    className = '',
}) => {
    const { t } = useTranslation();
    const { config } = useLocale();
    const { user } = useStore();
    const [data, setData] = useState<ComplianceReportData | null>(null);
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
                const reportData = await AgentReportService.fetchComplianceReportData(
                    user.organizationId,
                    filters,
                    dateRange
                );
                setData(reportData);
            } catch (err) {
                ErrorLogger.error(err, 'AgentComplianceReport.fetchData');
                setError(t('reports.loadError', { defaultValue: 'Error loading data' }));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user?.organizationId, filters, dateRange, t]);

    // Handle export
    const handleExport = async (format: ExportFormat) => {
        if (!user?.organizationId) return;

        setExporting(true);

        try {
            const reportConfig: ReportConfig = {
                type: 'compliance',
                name: `Rapport de conformité - ${new Date().toLocaleDateString(config.intlLocale)}`,
                dateRange,
                filters,
                format,
                includeCharts: format === 'pdf',
                includeRawData: format !== 'pdf',
                includeRecommendations: true,
                includeExecutiveSummary: true,
                sections: [],
                locale: config.intlLocale,
                timezone: 'Europe/Paris',
            };

            const reportId = await AgentReportService.generateReport(
                user.organizationId,
                reportConfig,
                user.uid
            );

            if (onExport) {
                onExport(format);
            }

            // TODO: Show notification with download link when ready
            ErrorLogger.debug(`Report generated: ${reportId}`, 'AgentComplianceReport.handleExport');
        } catch (err) {
            ErrorLogger.error(err, 'AgentComplianceReport.handleExport');
        } finally {
            setExporting(false);
        }
    };

    // Computed values
    const complianceRate = data
        ? (data.summary.compliantAgents / data.summary.totalAgents) * 100
        : 0;

    const scoreTrend = data?.summary.scoreChange || 0;

    if (loading) {
        return (
            <div className={`flex items-center justify-center h-96 ${className}`}>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className={`glass-premium rounded-2xl p-8 text-center border border-border/40 shadow-sm ${className}`}>
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
            <div className={`glass-premium rounded-2xl p-8 text-center border border-border/40 shadow-sm ${className}`}>
                <FileCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">{t('reports.noData', { defaultValue: 'No data available' })}</p>
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
            {/* Header with filters and export */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                        <FileCheck className="h-5 w-5 text-primary" />
                        Rapport de Conformité
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {data.summary.totalAgents} agents analysés
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
                            <SelectItem value="last_month">Mois dernier</SelectItem>
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

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <ScoreCard
                    title="Score moyen"
                    value={data.summary.averageScore}
                    change={data.summary.scoreChangePercent}
                    variant={data.summary.averageScore >= 80 ? 'success' : data.summary.averageScore >= 60 ? 'warning' : 'danger'}
                />
                <ScoreCard
                    title="Agents conformes"
                    value={complianceRate}
                    variant={complianceRate >= 80 ? 'success' : complianceRate >= 60 ? 'warning' : 'danger'}
                />
                <ScoreCard
                    title="Non conformes"
                    value={data.summary.nonCompliantAgents}
                    suffix=""
                    variant={data.summary.nonCompliantAgents > 0 ? 'danger' : 'success'}
                />
                <ScoreCard
                    title="Variation"
                    value={Math.abs(data.summary.scoreChange)}
                    suffix="pts"
                    change={data.summary.scoreChange}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Compliance Gauge */}
                <div className="glass-premium rounded-2xl p-6 border border-border/40 shadow-sm">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        <PieChart className="h-4 w-4 text-primary" />
                        Score de conformité global
                    </h3>
                    <div className="flex items-center justify-center py-4">
                        <RadialGauge
                            value={data.summary.averageScore}
                            max={100}
                            size={200}
                            thickness={20}
                            label="Score"
                            unit="%"
                            showTicks
                        />
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <span className="text-sm text-muted-foreground">
                                {data.summary.compliantAgents} conformes
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-danger" />
                            <span className="text-sm text-muted-foreground">
                                {data.summary.nonCompliantAgents} non conformes
                            </span>
                        </div>
                    </div>
                </div>

                {/* Score Distribution */}
                <div className="glass-premium rounded-2xl p-6 border border-border/40 shadow-sm">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Distribution des scores
                    </h3>
                    <ScoreDistribution data={data.scoreDistribution} />
                </div>

                {/* Trend Chart */}
                <div className="glass-premium rounded-2xl p-6 border border-border/40 shadow-sm">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        {scoreTrend >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-success" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-danger" />
                        )}
                        Évolution du score
                    </h3>
                    <TrendChart data={data.trends} />
                </div>

                {/* By Framework */}
                <div className="glass-premium rounded-2xl p-6 border border-border/40 shadow-sm">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-primary" />
                        Par framework
                    </h3>
                    <div className="max-h-64 overflow-y-auto">
                        {data.byFramework.map((framework) => (
                            <FrameworkRow key={framework.frameworkId || 'unknown'} framework={framework} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Issues */}
            <div className="glass-premium rounded-2xl p-6 border border-border/40 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Problèmes principaux
                    <Badge variant="soft" className="ml-auto">
                        {data.topIssues.length}
                    </Badge>
                </h3>
                <div className="divide-y divide-border/50">
                    {data.topIssues.slice(0, 5).map((issue) => (
                        <IssueRow
                            key={issue.checkId || 'unknown'}
                            issue={issue}
                            totalAgents={data.summary.totalAgents}
                        />
                    ))}
                </div>
                {data.topIssues.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center mt-4">
                        +{data.topIssues.length - 5} autres problèmes
                    </p>
                )}
            </div>
        </motion.div>
    );
};

export default AgentComplianceReport;
