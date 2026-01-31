/**
 * AnomalyAlerts Component
 *
 * Displays detected agent anomalies with severity indicators,
 * timeline visualization, and acknowledgment/resolution actions.
 *
 * Sprint 8 - Anomaly Detection
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DetectedAnomaly,
    AnomalyStats,
    AnomalySeverity,
    AnomalyStatus,
    AnomalyType,
    ANOMALY_TYPES,
    ANOMALY_SEVERITIES,
    ANOMALY_STATUSES,
    getSeverityColor,
    getSeverityBgColor,
    getAnomalyTypeLabel,
} from '../../types/anomalyDetection';
import {
    subscribeToAgentAnomalies,
    subscribeToAnomalyStats,
    acknowledgeAnomaly,
    investigateAnomaly,
    resolveAnomaly,
    markFalsePositive,
    bulkAcknowledge,
    bulkResolve,
} from '../../services/AgentAnomalyService';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import {
    AlertTriangle,
    AlertCircle,
    Bell,
    BellOff,
    Check,
    CheckCircle,
    ChevronDown,
    Clock,
    Cpu,
    Eye,
    Filter,
    Globe,
    HardDrive,
    MemoryStick,
    Network,
    RefreshCw,
    Search,
    Settings,
    Terminal,
    TrendingDown,
    TrendingUp,
    X,
    XCircle,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/input';
import { cn } from '../../utils/cn';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';

interface AnomalyAlertsProps {
    agentId?: string;
    className?: string;
    maxAlerts?: number;
    showStats?: boolean;
}

// Anomaly Type Icon Mapping
const AnomalyTypeIcons: Record<AnomalyType, React.FC<{ className?: string }>> = {
    cpu_spike: Cpu,
    memory_spike: MemoryStick,
    disk_spike: HardDrive,
    network_spike: Network,
    new_process: Terminal,
    suspicious_connection: Globe,
    unusual_login_time: Clock,
    config_change: Settings,
    compliance_drop: TrendingDown,
};

// Severity Icon Mapping
const SeverityIcons: Record<AnomalySeverity, React.FC<{ className?: string }>> = {
    critical: XCircle,
    high: AlertTriangle,
    medium: AlertCircle,
    low: Bell,
    info: Bell,
};

// Stats Summary Card
const StatsSummaryCard: React.FC<{
    stats: AnomalyStats;
}> = ({ stats }) => {
    const trendIcon = stats.trend === 'increasing' ? TrendingUp :
        stats.trend === 'decreasing' ? TrendingDown : null;
    const trendColor = stats.trend === 'increasing' ? 'text-destructive' :
        stats.trend === 'decreasing' ? 'text-success' : 'text-muted-foreground';

    return (
        <motion.div
            variants={slideUpVariants}
            className="glass-premium rounded-2xl p-4 sm:p-6 border border-border/40"
        >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Active Anomalies */}
                <div className="text-center">
                    <div className="text-3xl font-bold text-destructive">
                        {stats.activeAnomalies}
                    </div>
                    <div className="text-sm text-muted-foreground">Actives</div>
                </div>

                {/* Last 24h */}
                <div className="text-center">
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-3xl font-bold">{stats.last24h}</span>
                        {trendIcon && React.createElement(trendIcon, {
                            className: cn('h-5 w-5', trendColor)
                        })}
                    </div>
                    <div className="text-sm text-muted-foreground">Dernières 24h</div>
                </div>

                {/* Mean Time to Acknowledge */}
                <div className="text-center">
                    <div className="text-3xl font-bold text-primary">
                        {stats.meanTimeToAcknowledge.toFixed(1)}h
                    </div>
                    <div className="text-sm text-muted-foreground">MTTA</div>
                </div>

                {/* Mean Time to Resolve */}
                <div className="text-center">
                    <div className="text-3xl font-bold text-success">
                        {stats.meanTimeToResolve.toFixed(1)}h
                    </div>
                    <div className="text-sm text-muted-foreground">MTTR</div>
                </div>
            </div>

            {/* Severity Breakdown */}
            <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex flex-wrap gap-2 justify-center">
                    {stats.bySeverity.critical > 0 && (
                        <Badge variant="soft" className="bg-destructive/10 text-destructive">
                            {stats.bySeverity.critical} Critique{stats.bySeverity.critical > 1 ? 's' : ''}
                        </Badge>
                    )}
                    {stats.bySeverity.high > 0 && (
                        <Badge variant="soft" className="bg-orange-500/10 text-orange-500">
                            {stats.bySeverity.high} Haute{stats.bySeverity.high > 1 ? 's' : ''}
                        </Badge>
                    )}
                    {stats.bySeverity.medium > 0 && (
                        <Badge variant="soft" className="bg-warning/10 text-warning">
                            {stats.bySeverity.medium} Moyenne{stats.bySeverity.medium > 1 ? 's' : ''}
                        </Badge>
                    )}
                    {stats.bySeverity.low > 0 && (
                        <Badge variant="soft" className="bg-primary/10 text-primary">
                            {stats.bySeverity.low} Basse{stats.bySeverity.low > 1 ? 's' : ''}
                        </Badge>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// Single Anomaly Card
const AnomalyCard: React.FC<{
    anomaly: DetectedAnomaly;
    expanded: boolean;
    onToggle: () => void;
    onAcknowledge: () => void;
    onInvestigate: () => void;
    onResolve: () => void;
    onFalsePositive: () => void;
    selected: boolean;
    onSelect: (selected: boolean) => void;
}> = ({
    anomaly,
    expanded,
    onToggle,
    onAcknowledge,
    onInvestigate,
    onResolve,
    onFalsePositive,
    selected,
    onSelect,
}) => {
        const TypeIcon = AnomalyTypeIcons[anomaly.type];
        const SeverityIcon = SeverityIcons[anomaly.severity];

        const timeAgo = useMemo(() => {
            const now = new Date();
            const detected = new Date(anomaly.detectedAt);
            const diffMs = now.getTime() - detected.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffDays > 0) return `Il y a ${diffDays}j`;
            if (diffHours > 0) return `Il y a ${diffHours}h`;
            if (diffMins > 0) return `Il y a ${diffMins}min`;
            return "À l'instant";
        }, [anomaly.detectedAt]);

        const statusBadge = useMemo(() => {
            switch (anomaly.status) {
                case 'new':
                    return <Badge variant="soft" className="bg-destructive/10 text-destructive">Nouveau</Badge>;
                case 'acknowledged':
                    return <Badge variant="soft" className="bg-primary/10 text-primary">Pris en compte</Badge>;
                case 'investigating':
                    return <Badge variant="soft" className="bg-warning/10 text-warning">Investigation</Badge>;
                case 'resolved':
                    return <Badge variant="soft" className="bg-success/10 text-success">Résolu</Badge>;
                case 'false_positive':
                    return <Badge variant="soft" className="bg-muted text-muted-foreground">Faux positif</Badge>;
            }
        }, [anomaly.status]);

        return (
            <motion.div
                layout
                variants={slideUpVariants}
                className={cn(
                    'glass-premium rounded-3xl overflow-hidden transition-all border border-border/40',
                    anomaly.severity === 'critical' && 'ring-2 ring-destructive/50',
                    anomaly.severity === 'high' && 'ring-1 ring-orange-500/30',
                    selected && 'ring-2 ring-primary'
                )}
            >
                {/* Header */}
                <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-accent/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    onClick={onToggle}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onToggle();
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                >
                    {/* Selection Checkbox */}
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onSelect(e.target.checked);
                        }}
                        className="h-4 w-4 rounded border-border"
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* Severity Icon */}
                    <div className={cn(
                        'p-2 rounded-lg',
                        getSeverityBgColor(anomaly.severity)
                    )}>
                        <SeverityIcon className={cn('h-4 w-4', getSeverityColor(anomaly.severity))} />
                    </div>

                    {/* Type Icon */}
                    <div className="p-2 rounded-lg bg-accent">
                        <TypeIcon className="h-4 w-4 text-foreground" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{anomaly.title}</span>
                            {statusBadge}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                            <span>{anomaly.agentHostname}</span>
                            <span>•</span>
                            <span>{getAnomalyTypeLabel(anomaly.type)}</span>
                            <span>•</span>
                            <span>{timeAgo}</span>
                            {anomaly.occurrenceCount > 1 && (
                                <>
                                    <span>•</span>
                                    <Badge variant="outline" className="text-xs">
                                        {anomaly.occurrenceCount}x
                                    </Badge>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Expand Icon */}
                    <motion.div
                        animate={{ rotate: expanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    </motion.div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-border/50"
                        >
                            <div className="p-4 space-y-4">
                                {/* Description */}
                                <p className="text-sm">{anomaly.description}</p>

                                {/* Metrics */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-accent/50 rounded-lg p-3">
                                        <div className="text-xs text-muted-foreground">Valeur actuelle</div>
                                        <div className="font-semibold">
                                            {anomaly.currentValue.toFixed(1)}{anomaly.unit}
                                        </div>
                                    </div>
                                    <div className="bg-accent/50 rounded-lg p-3">
                                        <div className="text-xs text-muted-foreground">Baseline</div>
                                        <div className="font-semibold">
                                            {anomaly.baselineValue.toFixed(1)}{anomaly.unit}
                                        </div>
                                    </div>
                                    <div className="bg-accent/50 rounded-lg p-3">
                                        <div className="text-xs text-muted-foreground">Écart-type</div>
                                        <div className="font-semibold">
                                            ±{anomaly.baselineStdDev.toFixed(1)}{anomaly.unit}
                                        </div>
                                    </div>
                                    <div className="bg-accent/50 rounded-lg p-3">
                                        <div className="text-xs text-muted-foreground">Déviation</div>
                                        <div className={cn('font-semibold', getSeverityColor(anomaly.severity))}>
                                            {anomaly.deviationMultiplier.toFixed(1)}σ
                                        </div>
                                    </div>
                                </div>

                                {/* Context */}
                                {anomaly.context && Object.keys(anomaly.context).length > 0 && (
                                    <div className="bg-accent/30 rounded-lg p-3">
                                        <div className="text-xs text-muted-foreground mb-2">Contexte</div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            {anomaly.context.processName && (
                                                <div>
                                                    <span className="text-muted-foreground">Processus: </span>
                                                    <span className="font-mono">{anomaly.context.processName}</span>
                                                </div>
                                            )}
                                            {anomaly.context.remoteAddress && (
                                                <div>
                                                    <span className="text-muted-foreground">Adresse: </span>
                                                    <span className="font-mono">
                                                        {anomaly.context.remoteAddress}:{anomaly.context.remotePort}
                                                    </span>
                                                </div>
                                            )}
                                            {anomaly.context.user && (
                                                <div>
                                                    <span className="text-muted-foreground">Utilisateur: </span>
                                                    <span>{anomaly.context.user}</span>
                                                </div>
                                            )}
                                            {anomaly.context.configKey && (
                                                <div className="col-span-2">
                                                    <span className="text-muted-foreground">Config: </span>
                                                    <span className="font-mono">{anomaly.context.configKey}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                {anomaly.status !== 'resolved' && anomaly.status !== 'false_positive' && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        {anomaly.status === 'new' && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAcknowledge();
                                                    }}
                                                >
                                                    <Check className="h-4 w-4 mr-1" />
                                                    Prendre en compte
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onInvestigate();
                                                    }}
                                                >
                                                    <Eye className="h-4 w-4 mr-1" />
                                                    Investiguer
                                                </Button>
                                            </>
                                        )}
                                        {(anomaly.status === 'acknowledged' || anomaly.status === 'investigating') && (
                                            <Button
                                                variant="default"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onResolve();
                                                }}
                                            >
                                                <CheckCircle className="h-4 w-4 mr-1" />
                                                Résoudre
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onFalsePositive();
                                            }}
                                        >
                                            <BellOff className="h-4 w-4 mr-1" />
                                            Faux positif
                                        </Button>
                                    </div>
                                )}

                                {/* Resolution Info */}
                                {(anomaly.status === 'resolved' || anomaly.status === 'false_positive') && anomaly.resolvedAt && (
                                    <div className="text-sm text-muted-foreground">
                                        {anomaly.status === 'resolved' ? 'Résolu' : 'Marqué faux positif'} le{' '}
                                        {new Date(anomaly.resolvedAt).toLocaleDateString('fr-FR', {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                        {anomaly.resolutionNotes && (
                                            <span> - {anomaly.resolutionNotes}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    };

// Main Component
export const AnomalyAlerts: React.FC<AnomalyAlertsProps> = ({
    agentId,
    className,
    maxAlerts = 50,
    showStats = true,
}) => {
    const { user } = useStore();
    const organizationId = user?.organizationId;

    // Force re-render every minute to update relative timestamps
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => forceUpdate(n => n + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    const [anomalies, setAnomalies] = useState<DetectedAnomaly[]>([]);
    const [stats, setStats] = useState<AnomalyStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<AnomalyStatus[]>(['new', 'acknowledged', 'investigating']);
    const [severityFilter, setSeverityFilter] = useState<AnomalySeverity[]>([]);
    const [typeFilter, setTypeFilter] = useState<AnomalyType[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [showResolved, setShowResolved] = useState(false);

    // Subscribe to anomalies
    useEffect(() => {
        if (!organizationId) return;

        // Note: loading is initialized to true, no need to set it here

        const unsubscribe = subscribeToAgentAnomalies(
            organizationId,
            (data) => {
                setAnomalies(data);
                setLoading(false);
            },
            (error) => {
                ErrorLogger.error(error, 'AnomalyAlerts.loadAnomalies');
                setLoading(false);
            },
            {
                agentId,
                limit: maxAlerts,
            }
        );

        return () => unsubscribe();
    }, [organizationId, agentId, maxAlerts]);

    // Subscribe to stats
    useEffect(() => {
        if (!organizationId || !showStats) return;

        const unsubscribe = subscribeToAnomalyStats(
            organizationId,
            setStats,
            (error) => ErrorLogger.error(error, 'AnomalyAlerts.loadStats')
        );

        return () => unsubscribe();
    }, [organizationId, showStats]);

    // Filtered anomalies
    const filteredAnomalies = useMemo(() => {
        return anomalies.filter(a => {
            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matches =
                    a.title.toLowerCase().includes(term) ||
                    a.description.toLowerCase().includes(term) ||
                    a.agentHostname.toLowerCase().includes(term);
                if (!matches) return false;
            }

            // Show resolved toggle: if not showing resolved, exclude resolved and false_positive
            if (!showResolved && (a.status === 'resolved' || a.status === 'false_positive')) {
                // Only hide if the status filter does not explicitly include them
                if (statusFilter.length === 0 || !statusFilter.includes(a.status)) {
                    return false;
                }
            }

            // Status filter
            if (statusFilter.length > 0 && !statusFilter.includes(a.status)) {
                return false;
            }

            // Severity filter
            if (severityFilter.length > 0 && !severityFilter.includes(a.severity)) {
                return false;
            }

            // Type filter
            if (typeFilter.length > 0 && !typeFilter.includes(a.type)) {
                return false;
            }

            return true;
        });
    }, [anomalies, searchTerm, statusFilter, severityFilter, typeFilter, showResolved]);

    // Action handlers
    const handleAcknowledge = async (anomalyId: string) => {
        if (!organizationId || !user?.uid) return;
        try {
            await acknowledgeAnomaly(organizationId, anomalyId, user.uid);
        } catch (error) {
            ErrorLogger.error(error, 'AnomalyAlerts.acknowledge');
        }
    };

    const handleInvestigate = async (anomalyId: string) => {
        if (!organizationId || !user?.uid) return;
        try {
            await investigateAnomaly(organizationId, anomalyId, user.uid);
        } catch (error) {
            ErrorLogger.error(error, 'AnomalyAlerts.investigate');
        }
    };

    const handleResolve = async (anomalyId: string) => {
        if (!organizationId || !user?.uid) return;
        try {
            await resolveAnomaly(organizationId, anomalyId, user.uid);
        } catch (error) {
            ErrorLogger.error(error, 'AnomalyAlerts.resolve');
        }
    };

    const handleFalsePositive = async (anomalyId: string) => {
        if (!organizationId || !user?.uid) return;
        try {
            await markFalsePositive(organizationId, anomalyId, user.uid);
        } catch (error) {
            ErrorLogger.error(error, 'AnomalyAlerts.markFalsePositive');
        }
    };

    const handleBulkAcknowledge = async () => {
        if (!organizationId || !user?.uid || selectedIds.size === 0) return;
        try {
            await bulkAcknowledge(organizationId, Array.from(selectedIds), user.uid);
            setSelectedIds(new Set());
        } catch (error) {
            ErrorLogger.error(error, 'AnomalyAlerts.bulkAcknowledge');
        }
    };

    const handleBulkResolve = async () => {
        if (!organizationId || !user?.uid || selectedIds.size === 0) return;
        try {
            await bulkResolve(organizationId, Array.from(selectedIds), user.uid);
            setSelectedIds(new Set());
        } catch (error) {
            ErrorLogger.error(error, 'AnomalyAlerts.bulkResolve');
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredAnomalies.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredAnomalies.map(a => a.id)));
        }
    };

    if (loading) {
        return (
            <div className={cn('space-y-4', className)}>
                <div className="glass-premium rounded-2xl p-8 flex items-center justify-center border border-border/40">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainerVariants}
            className={cn('space-y-4', className)}
        >
            {/* Stats */}
            {showStats && stats && (
                <StatsSummaryCard stats={stats} />
            )}

            {/* Toolbar */}
            <motion.div variants={slideUpVariants} className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Show Resolved Toggle */}
                <Button
                    variant={showResolved ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setShowResolved(!showResolved)}
                >
                    {showResolved ? (
                        <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Masquer resolues
                        </>
                    ) : (
                        <>
                            <Eye className="h-4 w-4 mr-2" />
                            Voir resolues
                        </>
                    )}
                </Button>

                {/* Filter Toggle */}
                <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(showFilters && 'bg-accent')}
                >
                    <Filter className="h-4 w-4 mr-2" />
                    Filtres
                    {(statusFilter.length > 0 || severityFilter.length > 0 || typeFilter.length > 0) && (
                        <Badge variant="soft" className="ml-2">
                            {statusFilter.length + severityFilter.length + typeFilter.length}
                        </Badge>
                    )}
                </Button>

                {/* Bulk Actions */}
                {selectedIds.size > 0 && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleBulkAcknowledge}>
                            <Check className="h-4 w-4 mr-1" />
                            Ack ({selectedIds.size})
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleBulkResolve}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Résoudre ({selectedIds.size})
                        </Button>
                    </div>
                )}
            </motion.div>

            {/* Filter Panel */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="glass-premium rounded-3xl p-4 space-y-4 overflow-hidden border border-border/40"
                    >
                        {/* Status Filter */}
                        <div>
                            <span className="text-sm font-medium mb-2 block">Statut</span>
                            <div className="flex flex-wrap gap-2">
                                {ANOMALY_STATUSES.map(status => (
                                    <Badge
                                        key={status}
                                        variant={statusFilter.includes(status) ? 'default' : 'outline'}
                                        className="cursor-pointer"
                                        onClick={() => {
                                            if (statusFilter.includes(status)) {
                                                setStatusFilter(statusFilter.filter(s => s !== status));
                                            } else {
                                                setStatusFilter([...statusFilter, status]);
                                            }
                                        }}
                                    >
                                        {status === 'new' && 'Nouveau'}
                                        {status === 'acknowledged' && 'Pris en compte'}
                                        {status === 'investigating' && 'Investigation'}
                                        {status === 'resolved' && 'Résolu'}
                                        {status === 'false_positive' && 'Faux positif'}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Severity Filter */}
                        <div>
                            <span className="text-sm font-medium mb-2 block">Sévérité</span>
                            <div className="flex flex-wrap gap-2">
                                {ANOMALY_SEVERITIES.map(severity => (
                                    <Badge
                                        key={severity}
                                        variant={severityFilter.includes(severity) ? 'default' : 'outline'}
                                        className={cn(
                                            'cursor-pointer',
                                            severityFilter.includes(severity) && getSeverityBgColor(severity)
                                        )}
                                        onClick={() => {
                                            if (severityFilter.includes(severity)) {
                                                setSeverityFilter(severityFilter.filter(s => s !== severity));
                                            } else {
                                                setSeverityFilter([...severityFilter, severity]);
                                            }
                                        }}
                                    >
                                        {severity === 'critical' && 'Critique'}
                                        {severity === 'high' && 'Haute'}
                                        {severity === 'medium' && 'Moyenne'}
                                        {severity === 'low' && 'Basse'}
                                        {severity === 'info' && 'Info'}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Type Filter */}
                        <div>
                            <span className="text-sm font-medium mb-2 block">Type</span>
                            <div className="flex flex-wrap gap-2">
                                {ANOMALY_TYPES.map(type => (
                                    <Badge
                                        key={type}
                                        variant={typeFilter.includes(type) ? 'default' : 'outline'}
                                        className="cursor-pointer"
                                        onClick={() => {
                                            if (typeFilter.includes(type)) {
                                                setTypeFilter(typeFilter.filter(t => t !== type));
                                            } else {
                                                setTypeFilter([...typeFilter, type]);
                                            }
                                        }}
                                    >
                                        {getAnomalyTypeLabel(type)}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        {/* Clear Filters */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setStatusFilter(['new', 'acknowledged', 'investigating']);
                                setSeverityFilter([]);
                                setTypeFilter([]);
                            }}
                        >
                            <X className="h-4 w-4 mr-1" />
                            Réinitialiser
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Select All */}
            {filteredAnomalies.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={selectedIds.size === filteredAnomalies.length && filteredAnomalies.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-muted-foreground">
                        {selectedIds.size > 0
                            ? `${selectedIds.size} sélectionné${selectedIds.size > 1 ? 's' : ''}`
                            : `${filteredAnomalies.length} anomalie${filteredAnomalies.length > 1 ? 's' : ''}`}
                    </span>
                </div>
            )}

            {/* Anomaly List */}
            <motion.div
                variants={staggerContainerVariants}
                className="space-y-3"
            >
                {filteredAnomalies.length === 0 ? (
                    <motion.div
                        variants={slideUpVariants}
                        className="glass-premium rounded-2xl p-8 text-center border border-border/40"
                    >
                        <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                        <h3 className="font-semibold mb-2">Aucune anomalie</h3>
                        <p className="text-sm text-muted-foreground">
                            {searchTerm || statusFilter.length > 0 || severityFilter.length > 0 || typeFilter.length > 0
                                ? "Aucune anomalie ne correspond aux filtres"
                                : "Tous les agents fonctionnent normalement"}
                        </p>
                    </motion.div>
                ) : (
                    filteredAnomalies.map(anomaly => (
                        <AnomalyCard
                            key={anomaly.id}
                            anomaly={anomaly}
                            expanded={expandedId === anomaly.id}
                            onToggle={() => setExpandedId(expandedId === anomaly.id ? null : anomaly.id)}
                            onAcknowledge={() => handleAcknowledge(anomaly.id)}
                            onInvestigate={() => handleInvestigate(anomaly.id)}
                            onResolve={() => handleResolve(anomaly.id)}
                            onFalsePositive={() => handleFalsePositive(anomaly.id)}
                            selected={selectedIds.has(anomaly.id)}
                            onSelect={(selected) => {
                                const newSet = new Set(selectedIds);
                                if (selected) {
                                    newSet.add(anomaly.id);
                                } else {
                                    newSet.delete(anomaly.id);
                                }
                                setSelectedIds(newSet);
                            }}
                        />
                    ))
                )}
            </motion.div>
        </motion.div>
    );
};

export default AnomalyAlerts;
