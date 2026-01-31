/**
 * Agent Report Types
 *
 * Types for agent compliance reports, fleet health reports,
 * scheduled reports, and export formats.
 *
 * Sprint 10 - Reporting & RBAC
 */

import type { AgentOS, AgentStatus } from './agent';
import type { PolicyScope } from './agentPolicy';

// ============================================================================
// Report Types
// ============================================================================

/**
 * Report types
 */
export const REPORT_TYPES = [
    'compliance',       // Agent compliance report
    'fleet_health',     // Fleet health report
    'anomaly',          // Anomaly summary report
    'policy',           // Policy deployment report
    'inventory',        // Software inventory report
    'executive',        // Executive summary
] as const;
export type ReportType = typeof REPORT_TYPES[number];

/**
 * Export formats
 */
export const EXPORT_FORMATS = ['pdf', 'excel', 'csv', 'json'] as const;
export type ExportFormat = typeof EXPORT_FORMATS[number];

/**
 * Report status
 */
export const REPORT_STATUSES = ['pending', 'generating', 'completed', 'failed'] as const;
export type ReportStatus = typeof REPORT_STATUSES[number];

/**
 * Report schedule frequency
 */
export const SCHEDULE_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly'] as const;
export type ScheduleFrequency = typeof SCHEDULE_FREQUENCIES[number];

// ============================================================================
// Report Configuration
// ============================================================================

/**
 * Report date range
 */
export interface ReportDateRange {
    /** Start date */
    start: string;

    /** End date */
    end: string;

    /** Preset (if used) */
    preset?: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_month' | 'last_month' | 'this_quarter' | 'custom';
}

/**
 * Report filter options
 */
export interface ReportFilters {
    /** Filter by agent IDs */
    agentIds?: string[];

    /** Filter by group IDs */
    groupIds?: string[];

    /** Filter by OS */
    osTypes?: AgentOS[];

    /** Filter by agent status */
    statuses?: Array<AgentStatus>;

    /** Filter by compliance score range */
    scoreRange?: { min: number; max: number };

    /** Filter by policy scope */
    policyScopes?: PolicyScope[];

    /** Filter by frameworks */
    frameworkIds?: string[];

    /** Include inactive agents */
    includeInactive?: boolean;
}

/**
 * Report configuration
 */
export interface ReportConfig {
    /** Report type */
    type: ReportType;

    /** Report name */
    name: string;

    /** Description */
    description?: string;

    /** Date range */
    dateRange: ReportDateRange;

    /** Filters */
    filters: ReportFilters;

    /** Export format */
    format: ExportFormat;

    /** Include charts/graphs */
    includeCharts: boolean;

    /** Include raw data tables */
    includeRawData: boolean;

    /** Include recommendations */
    includeRecommendations: boolean;

    /** Include executive summary */
    includeExecutiveSummary: boolean;

    /** Sections to include */
    sections: ReportSection[];

    /** Branding options */
    branding?: ReportBranding;

    /** Locale for formatting */
    locale: string;

    /** Timezone */
    timezone: string;
}

/**
 * Report branding options
 */
export interface ReportBranding {
    /** Company name */
    companyName?: string;

    /** Logo URL */
    logoUrl?: string;

    /** Primary color (hex) */
    primaryColor?: string;

    /** Footer text */
    footerText?: string;

    /** Include confidential watermark */
    confidentialWatermark?: boolean;
}

/**
 * Report section configuration
 */
export interface ReportSection {
    /** Section ID */
    id: string;

    /** Section title */
    title: string;

    /** Section type */
    type: 'summary' | 'chart' | 'table' | 'text' | 'metrics' | 'list';

    /** Is enabled */
    enabled: boolean;

    /** Sort order */
    order: number;

    /** Section-specific options */
    options?: Record<string, unknown>;
}

// ============================================================================
// Generated Report
// ============================================================================

/**
 * Generated report
 */
export interface AgentReport {
    /** Report ID */
    id: string;

    /** Organization ID */
    organizationId: string;

    /** Report type */
    type: ReportType;

    /** Report name */
    name: string;

    /** Configuration used */
    config: ReportConfig;

    /** Status */
    status: ReportStatus;

    /** Format */
    format: ExportFormat;

    /** File URL (when completed) */
    fileUrl?: string;

    /** File size in bytes */
    fileSize?: number;

    /** File name */
    fileName?: string;

    /** Generation started at */
    startedAt: string;

    /** Generation completed at */
    completedAt?: string;

    /** Duration in ms */
    durationMs?: number;

    /** Error message (if failed) */
    errorMessage?: string;

    /** Metadata (agent count, etc.) */
    metadata: ReportMetadata;

    /** Generated by */
    generatedBy: string;

    /** Scheduled report ID (if from schedule) */
    scheduleId?: string;

    /** Expiration date */
    expiresAt: string;

    /** Download count */
    downloadCount: number;

    /** Last downloaded at */
    lastDownloadedAt?: string;
}

/**
 * Report metadata
 */
export interface ReportMetadata {
    /** Total agents included */
    agentCount: number;

    /** Total groups included */
    groupCount: number;

    /** Date range covered */
    dateRange: ReportDateRange;

    /** Page count (for PDF) */
    pageCount?: number;

    /** Row count (for data exports) */
    rowCount?: number;

    /** Frameworks covered */
    frameworks?: string[];

    /** Checks included */
    checksIncluded?: number;
}

// ============================================================================
// Scheduled Reports
// ============================================================================

/**
 * Scheduled report
 */
export interface ScheduledReport {
    /** Schedule ID */
    id: string;

    /** Organization ID */
    organizationId: string;

    /** Schedule name */
    name: string;

    /** Description */
    description?: string;

    /** Report configuration */
    config: ReportConfig;

    /** Is enabled */
    isEnabled: boolean;

    /** Frequency */
    frequency: ScheduleFrequency;

    /** Day of week (0-6, for weekly) */
    dayOfWeek?: number;

    /** Day of month (1-31, for monthly) */
    dayOfMonth?: number;

    /** Hour to run (0-23) */
    hour: number;

    /** Minute to run (0-59) */
    minute: number;

    /** Timezone */
    timezone: string;

    /** Email recipients */
    recipients: ReportRecipient[];

    /** Last run at */
    lastRunAt?: string;

    /** Last run status */
    lastRunStatus?: ReportStatus;

    /** Last generated report ID */
    lastReportId?: string;

    /** Next run at */
    nextRunAt: string;

    /** Run count */
    runCount: number;

    /** Created at */
    createdAt: string;

    /** Updated at */
    updatedAt: string;

    /** Created by */
    createdBy: string;
}

/**
 * Report recipient
 */
export interface ReportRecipient {
    /** Recipient email */
    email: string;

    /** Recipient name */
    name?: string;

    /** User ID (if internal) */
    userId?: string;

    /** Notification preferences */
    notify: {
        /** Send on completion */
        onComplete: boolean;

        /** Send on failure */
        onFailure: boolean;
    };
}

// ============================================================================
// Report Data Structures
// ============================================================================

/**
 * Compliance report data
 */
export interface ComplianceReportData {
    /** Summary */
    summary: {
        totalAgents: number;
        compliantAgents: number;
        nonCompliantAgents: number;
        averageScore: number;
        scoreChange: number;
        scoreChangePercent: number;
    };

    /** Score distribution */
    scoreDistribution: Array<{
        range: string;
        count: number;
        percentage: number;
    }>;

    /** By framework */
    byFramework: Array<{
        frameworkId: string;
        frameworkName: string;
        averageScore: number;
        compliantCount: number;
        totalChecks: number;
        passedChecks: number;
    }>;

    /** By OS */
    byOS: Array<{
        os: AgentOS;
        agentCount: number;
        averageScore: number;
    }>;

    /** Top issues */
    topIssues: Array<{
        checkId: string;
        checkName: string;
        failedCount: number;
        percentage: number;
        severity: 'critical' | 'high' | 'medium' | 'low';
        recommendation: string;
    }>;

    /** Trend data */
    trends: Array<{
        date: string;
        averageScore: number;
        compliantCount: number;
        totalCount: number;
    }>;

    /** Agent details */
    agentDetails: Array<{
        agentId: string;
        hostname: string;
        os: AgentOS;
        score: number;
        status: 'compliant' | 'non_compliant' | 'unknown';
        lastCheck: string;
        issues: number;
    }>;
}

/**
 * Fleet health report data
 */
export interface FleetHealthReportData {
    /** Summary */
    summary: {
        totalAgents: number;
        activeAgents: number;
        offlineAgents: number;
        healthyAgents: number;
        unhealthyAgents: number;
        averageUptime: number;
    };

    /** Status distribution */
    statusDistribution: Array<{
        status: AgentStatus;
        count: number;
        percentage: number;
    }>;

    /** OS distribution */
    osDistribution: Array<{
        os: AgentOS;
        count: number;
        percentage: number;
    }>;

    /** Version distribution */
    versionDistribution: Array<{
        version: string;
        count: number;
        percentage: number;
        isLatest: boolean;
    }>;

    /** Performance metrics */
    performanceMetrics: {
        avgCpuUsage: number;
        avgMemoryUsage: number;
        avgDiskUsage: number;
    };

    /** Anomaly summary */
    anomalySummary: {
        totalAnomalies: number;
        criticalAnomalies: number;
        resolvedAnomalies: number;
        avgResolutionTime: number;
    };

    /** Uptime data */
    uptimeData: Array<{
        date: string;
        avgUptime: number;
        activeCount: number;
        offlineCount: number;
    }>;

    /** Agent list */
    agentList: Array<{
        agentId: string;
        hostname: string;
        os: AgentOS;
        version: string;
        status: AgentStatus;
        lastSeen: string;
        uptime: number;
        cpuUsage: number;
        memoryUsage: number;
    }>;
}

/**
 * Executive summary data
 */
export interface ExecutiveSummaryData {
    /** Overall health score */
    overallScore: number;

    /** Score trend */
    scoreTrend: 'improving' | 'stable' | 'declining';

    /** Key metrics */
    keyMetrics: Array<{
        name: string;
        value: number | string;
        unit?: string;
        change?: number;
        status: 'good' | 'warning' | 'critical';
    }>;

    /** Highlights */
    highlights: Array<{
        type: 'success' | 'warning' | 'info';
        title: string;
        description: string;
    }>;

    /** Recommendations */
    recommendations: Array<{
        priority: 'high' | 'medium' | 'low';
        title: string;
        description: string;
        impact: string;
    }>;

    /** Risk summary */
    riskSummary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

// ============================================================================
// Report Templates
// ============================================================================

/**
 * Report template
 */
export interface ReportTemplate {
    /** Template ID */
    id: string;

    /** Template name */
    name: string;

    /** Description */
    description: string;

    /** Report type */
    type: ReportType;

    /** Is built-in */
    isBuiltIn: boolean;

    /** Default configuration */
    defaultConfig: Partial<ReportConfig>;

    /** Preview image URL */
    previewUrl?: string;

    /** Tags */
    tags: string[];
}

/**
 * Default report templates
 */
export const DEFAULT_REPORT_TEMPLATES: ReportTemplate[] = [
    {
        id: 'compliance-monthly',
        name: 'Rapport de conformité mensuel',
        description: 'Rapport complet de conformité des agents pour le mois en cours',
        type: 'compliance',
        isBuiltIn: true,
        defaultConfig: {
            type: 'compliance',
            dateRange: { start: '', end: '', preset: 'this_month' },
            filters: {},
            format: 'pdf',
            includeCharts: true,
            includeRawData: false,
            includeRecommendations: true,
            includeExecutiveSummary: true,
            sections: [
                { id: 'summary', title: 'Résumé', type: 'summary', enabled: true, order: 0 },
                { id: 'score-trend', title: 'Évolution du score', type: 'chart', enabled: true, order: 1 },
                { id: 'by-framework', title: 'Par framework', type: 'table', enabled: true, order: 2 },
                { id: 'top-issues', title: 'Problèmes principaux', type: 'list', enabled: true, order: 3 },
                { id: 'recommendations', title: 'Recommandations', type: 'list', enabled: true, order: 4 },
            ],
            locale: 'fr-FR',
            timezone: 'Europe/Paris',
        },
        tags: ['compliance', 'monthly', 'recommended'],
    },
    {
        id: 'fleet-health-weekly',
        name: 'Rapport santé fleet hebdomadaire',
        description: 'État de santé de la flotte d\'agents sur les 7 derniers jours',
        type: 'fleet_health',
        isBuiltIn: true,
        defaultConfig: {
            type: 'fleet_health',
            dateRange: { start: '', end: '', preset: 'last_7_days' },
            filters: {},
            format: 'pdf',
            includeCharts: true,
            includeRawData: false,
            includeRecommendations: true,
            includeExecutiveSummary: true,
            sections: [
                { id: 'summary', title: 'Résumé', type: 'summary', enabled: true, order: 0 },
                { id: 'status-chart', title: 'Distribution des statuts', type: 'chart', enabled: true, order: 1 },
                { id: 'os-chart', title: 'Distribution OS', type: 'chart', enabled: true, order: 2 },
                { id: 'performance', title: 'Métriques de performance', type: 'metrics', enabled: true, order: 3 },
                { id: 'anomalies', title: 'Résumé des anomalies', type: 'table', enabled: true, order: 4 },
            ],
            locale: 'fr-FR',
            timezone: 'Europe/Paris',
        },
        tags: ['health', 'weekly', 'recommended'],
    },
    {
        id: 'executive-quarterly',
        name: 'Rapport exécutif trimestriel',
        description: 'Synthèse exécutive pour la direction sur le trimestre',
        type: 'executive',
        isBuiltIn: true,
        defaultConfig: {
            type: 'executive',
            dateRange: { start: '', end: '', preset: 'this_quarter' },
            filters: {},
            format: 'pdf',
            includeCharts: true,
            includeRawData: false,
            includeRecommendations: true,
            includeExecutiveSummary: true,
            sections: [
                { id: 'kpis', title: 'KPIs clés', type: 'metrics', enabled: true, order: 0 },
                { id: 'highlights', title: 'Points saillants', type: 'list', enabled: true, order: 1 },
                { id: 'trends', title: 'Tendances', type: 'chart', enabled: true, order: 2 },
                { id: 'risks', title: 'Risques', type: 'summary', enabled: true, order: 3 },
                { id: 'next-steps', title: 'Prochaines étapes', type: 'list', enabled: true, order: 4 },
            ],
            locale: 'fr-FR',
            timezone: 'Europe/Paris',
        },
        tags: ['executive', 'quarterly', 'management'],
    },
    {
        id: 'inventory-export',
        name: 'Export inventaire logiciels',
        description: 'Export complet de l\'inventaire logiciels au format Excel',
        type: 'inventory',
        isBuiltIn: true,
        defaultConfig: {
            type: 'inventory',
            dateRange: { start: '', end: '', preset: 'last_30_days' },
            filters: {},
            format: 'excel',
            includeCharts: false,
            includeRawData: true,
            includeRecommendations: false,
            includeExecutiveSummary: false,
            sections: [
                { id: 'software-list', title: 'Liste des logiciels', type: 'table', enabled: true, order: 0 },
                { id: 'by-agent', title: 'Par agent', type: 'table', enabled: true, order: 1 },
                { id: 'unauthorized', title: 'Logiciels non autorisés', type: 'table', enabled: true, order: 2 },
            ],
            locale: 'fr-FR',
            timezone: 'Europe/Paris',
        },
        tags: ['inventory', 'export', 'data'],
    },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get report type label
 */
export function getReportTypeLabel(type: ReportType): string {
    switch (type) {
        case 'compliance': return 'Conformité';
        case 'fleet_health': return 'Santé Fleet';
        case 'anomaly': return 'Anomalies';
        case 'policy': return 'Politiques';
        case 'inventory': return 'Inventaire';
        case 'executive': return 'Exécutif';
    }
}

/**
 * Get report type icon
 */
export function getReportTypeIcon(type: ReportType): string {
    switch (type) {
        case 'compliance': return 'FileCheck';
        case 'fleet_health': return 'Activity';
        case 'anomaly': return 'AlertTriangle';
        case 'policy': return 'FileCode';
        case 'inventory': return 'Package';
        case 'executive': return 'Briefcase';
    }
}

/**
 * Get format label
 */
export function getFormatLabel(format: ExportFormat): string {
    switch (format) {
        case 'pdf': return 'PDF';
        case 'excel': return 'Excel';
        case 'csv': return 'CSV';
        case 'json': return 'JSON';
    }
}

/**
 * Get format icon
 */
export function getFormatIcon(format: ExportFormat): string {
    switch (format) {
        case 'pdf': return 'FileText';
        case 'excel': return 'FileSpreadsheet';
        case 'csv': return 'FileCode';
        case 'json': return 'Braces';
    }
}

/**
 * Get status label
 */
export function getReportStatusLabel(status: ReportStatus): string {
    switch (status) {
        case 'pending': return 'En attente';
        case 'generating': return 'Génération...';
        case 'completed': return 'Terminé';
        case 'failed': return 'Échec';
    }
}

/**
 * Get status color
 */
export function getReportStatusColor(status: ReportStatus): string {
    switch (status) {
        case 'pending': return 'text-muted-foreground';
        case 'generating': return 'text-primary';
        case 'completed': return 'text-success';
        case 'failed': return 'text-destructive';
    }
}

/**
 * Get frequency label
 */
export function getFrequencyLabel(frequency: ScheduleFrequency): string {
    switch (frequency) {
        case 'daily': return 'Quotidien';
        case 'weekly': return 'Hebdomadaire';
        case 'monthly': return 'Mensuel';
        case 'quarterly': return 'Trimestriel';
    }
}

/**
 * Calculate next run date
 */
export function calculateNextRunDate(schedule: ScheduledReport): Date {
    const now = new Date();
    const next = new Date();

    // Set time
    next.setHours(schedule.hour, schedule.minute, 0, 0);

    // If time has passed today, start from tomorrow
    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }

    switch (schedule.frequency) {
        case 'daily':
            // Already set to next occurrence
            break;

        case 'weekly':
            // Find next occurrence of target day
            while (next.getDay() !== schedule.dayOfWeek) {
                next.setDate(next.getDate() + 1);
            }
            break;

        case 'monthly':
            // Find next occurrence of target day of month
            next.setDate(schedule.dayOfMonth || 1);
            if (next <= now) {
                next.setMonth(next.getMonth() + 1);
            }
            break;

        case 'quarterly': {
            // Find next quarter start
            const quarterMonth = Math.floor(next.getMonth() / 3) * 3;
            next.setMonth(quarterMonth + 3);
            next.setDate(schedule.dayOfMonth || 1);
            break;
        }
    }

    return next;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Get date range dates
 */
export function getDateRangeDates(preset: ReportDateRange['preset']): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    switch (preset) {
        case 'last_7_days':
            start.setDate(start.getDate() - 7);
            break;

        case 'last_30_days':
            start.setDate(start.getDate() - 30);
            break;

        case 'last_90_days':
            start.setDate(start.getDate() - 90);
            break;

        case 'this_month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            break;

        case 'last_month':
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end.setDate(0); // Last day of previous month
            break;

        case 'this_quarter': {
            const quarterStart = Math.floor(now.getMonth() / 3) * 3;
            start = new Date(now.getFullYear(), quarterStart, 1);
            break;
        }

        default:
            // Custom - use provided dates
            break;
    }

    return { start, end };
}
