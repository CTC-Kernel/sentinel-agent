/**
 * Anomaly Detection Types
 *
 * Types for behavioral anomaly detection, baselines,
 * alerts, and threshold configuration.
 *
 * Sprint 8 - Anomaly Detection
 */

import type { AgentOS } from './agent';

// ============================================================================
// Anomaly Types
// ============================================================================

/**
 * Types of anomalies that can be detected
 */
export const ANOMALY_TYPES = [
    'cpu_spike',
    'memory_spike',
    'disk_spike',
    'network_spike',
    'new_process',
    'suspicious_connection',
    'unusual_login_time',
    'config_change',
    'compliance_drop',
] as const;
export type AnomalyType = typeof ANOMALY_TYPES[number];

/**
 * Anomaly severity levels
 */
export const ANOMALY_SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const;
export type AnomalySeverity = typeof ANOMALY_SEVERITIES[number];

/**
 * Anomaly status
 */
export const ANOMALY_STATUSES = ['new', 'acknowledged', 'investigating', 'resolved', 'false_positive'] as const;
export type AnomalyStatus = typeof ANOMALY_STATUSES[number];

/**
 * Get severity from deviation multiplier
 */
export function getSeverityFromDeviation(deviationMultiplier: number): AnomalySeverity {
    if (deviationMultiplier >= 4) return 'critical';
    if (deviationMultiplier >= 3) return 'high';
    if (deviationMultiplier >= 2) return 'medium';
    if (deviationMultiplier >= 1.5) return 'low';
    return 'info';
}

/**
 * Get severity color class
 */
export function getSeverityColor(severity: AnomalySeverity): string {
    switch (severity) {
        case 'critical': return 'text-destructive';
        case 'high': return 'text-orange-500';
        case 'medium': return 'text-warning';
        case 'low': return 'text-primary';
        case 'info': return 'text-muted-foreground';
    }
}

/**
 * Get severity background color class
 */
export function getSeverityBgColor(severity: AnomalySeverity): string {
    switch (severity) {
        case 'critical': return 'bg-destructive/10';
        case 'high': return 'bg-orange-500/10';
        case 'medium': return 'bg-warning/10';
        case 'low': return 'bg-primary/10';
        case 'info': return 'bg-muted';
    }
}

/**
 * Get anomaly type label
 */
export function getAnomalyTypeLabel(type: AnomalyType): string {
    switch (type) {
        case 'cpu_spike': return 'Pic CPU';
        case 'memory_spike': return 'Pic Mémoire';
        case 'disk_spike': return 'Pic Disque';
        case 'network_spike': return 'Pic Réseau';
        case 'new_process': return 'Nouveau Processus';
        case 'suspicious_connection': return 'Connexion Suspecte';
        case 'unusual_login_time': return 'Connexion Inhabituelle';
        case 'config_change': return 'Changement Config';
        case 'compliance_drop': return 'Chute Conformité';
    }
}

/**
 * Get anomaly type icon name
 */
export function getAnomalyTypeIcon(type: AnomalyType): string {
    switch (type) {
        case 'cpu_spike': return 'Cpu';
        case 'memory_spike': return 'MemoryStick';
        case 'disk_spike': return 'HardDrive';
        case 'network_spike': return 'Network';
        case 'new_process': return 'Terminal';
        case 'suspicious_connection': return 'Globe';
        case 'unusual_login_time': return 'Clock';
        case 'config_change': return 'Settings';
        case 'compliance_drop': return 'TrendingDown';
    }
}

// ============================================================================
// Detected Anomaly
// ============================================================================

/**
 * A detected anomaly event
 */
export interface DetectedAnomaly {
    /** Anomaly ID */
    id: string;

    /** Organization ID */
    organizationId: string;

    /** Agent ID */
    agentId: string;

    /** Agent hostname */
    agentHostname: string;

    /** Agent OS */
    agentOS: AgentOS;

    /** Anomaly type */
    type: AnomalyType;

    /** Severity */
    severity: AnomalySeverity;

    /** Current status */
    status: AnomalyStatus;

    /** Title */
    title: string;

    /** Description */
    description: string;

    /** Current value that triggered anomaly */
    currentValue: number;

    /** Baseline value (expected) */
    baselineValue: number;

    /** Standard deviation of baseline */
    baselineStdDev: number;

    /** How many standard deviations from baseline */
    deviationMultiplier: number;

    /** Threshold that was exceeded */
    threshold: number;

    /** Unit for values (%, bytes, count, etc.) */
    unit: string;

    /** Additional context data */
    context: AnomalyContext;

    /** Detected at */
    detectedAt: string;

    /** First occurrence (for recurring anomalies) */
    firstOccurrence: string;

    /** Occurrence count */
    occurrenceCount: number;

    /** Last occurrence */
    lastOccurrence: string;

    /** Acknowledged by (user ID) */
    acknowledgedBy?: string;

    /** Acknowledged at */
    acknowledgedAt?: string;

    /** Resolved by (user ID) */
    resolvedBy?: string;

    /** Resolved at */
    resolvedAt?: string;

    /** Resolution notes */
    resolutionNotes?: string;

    /** Related anomaly IDs (for correlation) */
    relatedAnomalyIds: string[];

    /** Is part of an anomaly cluster */
    isCluster: boolean;

    /** Cluster ID if part of a cluster */
    clusterId?: string;
}

/**
 * Additional context for anomaly
 */
export interface AnomalyContext {
    /** Process name (for process/connection anomalies) */
    processName?: string;

    /** Process ID */
    pid?: number;

    /** Command line */
    commandLine?: string;

    /** Remote address (for connection anomalies) */
    remoteAddress?: string;

    /** Remote port */
    remotePort?: number;

    /** Protocol */
    protocol?: string;

    /** User account */
    user?: string;

    /** Source IP (for login anomalies) */
    sourceIp?: string;

    /** Login time */
    loginTime?: string;

    /** Configuration key changed */
    configKey?: string;

    /** Previous config value */
    previousValue?: string;

    /** New config value */
    newValue?: string;

    /** Compliance framework affected */
    frameworkId?: string;

    /** Score before drop */
    previousScore?: number;

    /** Score after drop */
    newScore?: number;

    /** Snapshot of metrics at detection time */
    metricsSnapshot?: {
        cpuPercent: number;
        memoryPercent: number;
        diskPercent: number;
        networkInBytes: number;
        networkOutBytes: number;
    };
}

// ============================================================================
// Behavioral Baseline
// ============================================================================

/**
 * Metric types for baseline tracking
 */
export const BASELINE_METRICS = [
    'cpu_percent',
    'memory_percent',
    'disk_percent',
    'network_in_bytes',
    'network_out_bytes',
    'process_count',
    'connection_count',
    'compliance_score',
] as const;
export type BaselineMetric = typeof BASELINE_METRICS[number];

/**
 * Time window for baseline calculation
 */
export const BASELINE_WINDOWS = ['1d', '7d', '30d'] as const;
export type BaselineWindow = typeof BASELINE_WINDOWS[number];

/**
 * Single metric baseline data
 */
export interface MetricBaseline {
    /** Metric type */
    metric: BaselineMetric;

    /** Moving average */
    mean: number;

    /** Standard deviation */
    stdDev: number;

    /** Minimum observed */
    min: number;

    /** Maximum observed */
    max: number;

    /** Median */
    median: number;

    /** 95th percentile */
    p95: number;

    /** 99th percentile */
    p99: number;

    /** Number of data points */
    dataPoints: number;

    /** Last updated */
    lastUpdated: string;
}

/**
 * Hourly pattern for a metric (24 values, one per hour)
 */
export interface HourlyPattern {
    /** Metric type */
    metric: BaselineMetric;

    /** Mean values per hour (0-23) */
    hourlyMeans: number[];

    /** StdDev values per hour (0-23) */
    hourlyStdDevs: number[];

    /** Is pattern significant (enough variance between hours) */
    isSignificant: boolean;

    /** Peak hour (0-23) */
    peakHour: number;

    /** Lowest hour (0-23) */
    troughHour: number;
}

/**
 * Day of week pattern for a metric (7 values, Sunday=0)
 */
export interface WeeklyPattern {
    /** Metric type */
    metric: BaselineMetric;

    /** Mean values per day (0=Sunday to 6=Saturday) */
    dailyMeans: number[];

    /** StdDev values per day */
    dailyStdDevs: number[];

    /** Is pattern significant */
    isSignificant: boolean;

    /** Busiest day */
    peakDay: number;

    /** Quietest day */
    troughDay: number;
}

/**
 * Complete behavioral baseline for an agent
 */
export interface AgentBaseline {
    /** Baseline ID */
    id: string;

    /** Organization ID */
    organizationId: string;

    /** Agent ID */
    agentId: string;

    /** Agent hostname */
    agentHostname: string;

    /** Baseline window used */
    window: BaselineWindow;

    /** Metric baselines */
    metrics: MetricBaseline[];

    /** Hourly patterns */
    hourlyPatterns: HourlyPattern[];

    /** Weekly patterns */
    weeklyPatterns: WeeklyPattern[];

    /** Known processes (normal for this agent) */
    knownProcesses: KnownProcess[];

    /** Known connections (normal for this agent) */
    knownConnections: KnownConnection[];

    /** Is baseline stable (enough data) */
    isStable: boolean;

    /** Stability score (0-100) */
    stabilityScore: number;

    /** Minimum data points needed for stability */
    minimumDataPoints: number;

    /** Current data points */
    currentDataPoints: number;

    /** Baseline calculation started */
    calculationStarted: string;

    /** Last recalculated */
    lastRecalculated: string;

    /** Next scheduled recalculation */
    nextRecalculation: string;
}

/**
 * Known process for baseline
 */
export interface KnownProcess {
    /** Process name */
    name: string;

    /** Hash of executable (if available) */
    hash?: string;

    /** Typical CPU usage */
    typicalCpu: number;

    /** Typical memory usage */
    typicalMemory: number;

    /** First seen */
    firstSeen: string;

    /** Times seen */
    seenCount: number;

    /** Is system process */
    isSystem: boolean;

    /** Is whitelisted by admin */
    isWhitelisted: boolean;
}

/**
 * Known connection for baseline
 */
export interface KnownConnection {
    /** Remote address or domain pattern */
    remotePattern: string;

    /** Remote port */
    remotePort: number;

    /** Protocol */
    protocol: 'tcp' | 'udp';

    /** Associated process */
    processName?: string;

    /** First seen */
    firstSeen: string;

    /** Times seen */
    seenCount: number;

    /** Is whitelisted by admin */
    isWhitelisted: boolean;

    /** Category (if known) */
    category?: 'system' | 'business' | 'cloud' | 'unknown';
}

// ============================================================================
// Threshold Configuration
// ============================================================================

/**
 * Threshold configuration for anomaly detection
 */
export interface AnomalyThresholdConfig {
    /** Config ID */
    id: string;

    /** Organization ID */
    organizationId: string;

    /** Name */
    name: string;

    /** Description */
    description: string;

    /** Is default config */
    isDefault: boolean;

    /** Agent group IDs this applies to (empty = all) */
    agentGroupIds: string[];

    /** Metric thresholds */
    metricThresholds: MetricThreshold[];

    /** Process detection settings */
    processDetection: ProcessDetectionConfig;

    /** Connection detection settings */
    connectionDetection: ConnectionDetectionConfig;

    /** Alert settings */
    alertSettings: AlertSettings;

    /** Created at */
    createdAt: string;

    /** Updated at */
    updatedAt: string;

    /** Created by */
    createdBy: string;
}

/**
 * Threshold for a specific metric
 */
export interface MetricThreshold {
    /** Metric type */
    metric: BaselineMetric;

    /** Is enabled */
    enabled: boolean;

    /** Standard deviation multiplier for anomaly */
    stdDevMultiplier: number;

    /** Absolute threshold (override baseline if exceeded) */
    absoluteThreshold?: number;

    /** Minimum severity to alert on */
    minimumSeverity: AnomalySeverity;

    /** Sustained duration before alerting (seconds) */
    sustainedDuration: number;

    /** Cooldown between alerts (seconds) */
    cooldownSeconds: number;
}

/**
 * Process detection configuration
 */
export interface ProcessDetectionConfig {
    /** Detect new processes */
    detectNewProcesses: boolean;

    /** Minimum run time to consider (seconds) */
    minimumRunTime: number;

    /** Ignore system processes */
    ignoreSystemProcesses: boolean;

    /** Process name patterns to ignore (regex) */
    ignorePatterns: string[];

    /** Process name patterns to always alert on (regex) */
    alertPatterns: string[];
}

/**
 * Connection detection configuration
 */
export interface ConnectionDetectionConfig {
    /** Detect new outbound connections */
    detectNewOutbound: boolean;

    /** Detect new listening ports */
    detectNewListening: boolean;

    /** Ignore local connections */
    ignoreLocal: boolean;

    /** Trusted domains/IPs (regex patterns) */
    trustedPatterns: string[];

    /** Suspicious domains/IPs (regex patterns) */
    suspiciousPatterns: string[];

    /** Suspicious ports */
    suspiciousPorts: number[];
}

/**
 * Alert settings
 */
export interface AlertSettings {
    /** Aggregate similar anomalies */
    aggregateSimilar: boolean;

    /** Aggregation window (seconds) */
    aggregationWindow: number;

    /** Maximum anomalies before escalation */
    escalationThreshold: number;

    /** Auto-resolve after (hours, 0 = never) */
    autoResolveHours: number;

    /** Notification channels */
    notificationChannels: NotificationChannel[];
}

/**
 * Notification channel
 */
export interface NotificationChannel {
    /** Channel type */
    type: 'email' | 'slack' | 'webhook' | 'in_app';

    /** Is enabled */
    enabled: boolean;

    /** Minimum severity to notify */
    minimumSeverity: AnomalySeverity;

    /** Target (email, webhook URL, etc.) */
    target: string;
}

// ============================================================================
// Anomaly Statistics
// ============================================================================

/**
 * Anomaly statistics for dashboard
 */
export interface AnomalyStats {
    /** Total anomalies (all time) */
    totalAnomalies: number;

    /** Active anomalies (new + acknowledged + investigating) */
    activeAnomalies: number;

    /** By status */
    byStatus: Record<AnomalyStatus, number>;

    /** By severity */
    bySeverity: Record<AnomalySeverity, number>;

    /** By type */
    byType: Record<AnomalyType, number>;

    /** Anomalies last 24h */
    last24h: number;

    /** Anomalies last 7 days */
    last7d: number;

    /** Trend (increasing, decreasing, stable) */
    trend: 'increasing' | 'decreasing' | 'stable';

    /** Mean time to acknowledge (hours) */
    meanTimeToAcknowledge: number;

    /** Mean time to resolve (hours) */
    meanTimeToResolve: number;

    /** Top affected agents */
    topAffectedAgents: {
        agentId: string;
        hostname: string;
        anomalyCount: number;
    }[];

    /** Calculated at */
    calculatedAt: string;
}

/**
 * Anomaly timeline entry
 */
export interface AnomalyTimelineEntry {
    /** Timestamp */
    timestamp: string;

    /** Hour of day */
    hour: number;

    /** Count by severity */
    bySeverity: Record<AnomalySeverity, number>;

    /** Total count */
    total: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format deviation as human-readable
 */
export function formatDeviation(deviation: number): string {
    if (deviation >= 3) return `${deviation.toFixed(1)}x au-dessus de la normale`;
    if (deviation >= 2) return 'Significativement au-dessus';
    if (deviation >= 1.5) return 'Au-dessus de la normale';
    return 'Légèrement élevé';
}

/**
 * Get baseline stability label
 */
export function getStabilityLabel(score: number): string {
    if (score >= 90) return 'Très stable';
    if (score >= 70) return 'Stable';
    if (score >= 50) return 'En construction';
    if (score >= 30) return 'Insuffisant';
    return 'Nouveau';
}

/**
 * Get stability color
 */
export function getStabilityColor(score: number): string {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-primary';
    if (score >= 50) return 'text-warning';
    return 'text-muted-foreground';
}

/**
 * Calculate Z-score
 */
export function calculateZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
}

/**
 * Check if value is anomalous
 */
export function isAnomalous(
    value: number,
    mean: number,
    stdDev: number,
    multiplier: number = 2
): boolean {
    const zScore = Math.abs(calculateZScore(value, mean, stdDev));
    return zScore > multiplier;
}

/**
 * Get day of week label
 */
export function getDayLabel(dayIndex: number): string {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return days[dayIndex] || '';
}

/**
 * Format hour label
 */
export function formatHourLabel(hour: number): string {
    return `${hour.toString().padStart(2, '0')}:00`;
}
