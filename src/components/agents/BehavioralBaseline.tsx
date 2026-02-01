/**
 * BehavioralBaseline Component
 *
 * Visualizes agent behavioral baselines with charts showing
 * normal ranges vs current values, hourly/weekly patterns.
 *
 * Sprint 8 - Anomaly Detection
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AgentBaseline,
    MetricBaseline,
    HourlyPattern,
    WeeklyPattern,
    BaselineMetric,
    getStabilityLabel,
    getStabilityColor,
    formatHourLabel,
} from '../../types/anomalyDetection';
import {
    subscribeToBaselines,
    recalculateBaseline,
} from '../../services/AgentAnomalyService';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import {
    Activity,
    BarChart3,
    Calendar,
    ChevronDown,
    Clock,
    Cpu,
    Database,
    HardDrive,
    MemoryStick,
    Network,
    RefreshCw,
    Shield,
    Terminal,
    TrendingUp,
    Users,
} from '../ui/Icons';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';
import { useLocale } from '@/hooks/useLocale';

interface BehavioralBaselineProps {
    agentId?: string;
    className?: string;
    showAllAgents?: boolean;
}

// Metric Icon Mapping
const MetricIcons: Record<BaselineMetric, React.FC<{ className?: string }>> = {
    cpu_percent: Cpu,
    memory_percent: MemoryStick,
    disk_percent: HardDrive,
    network_in_bytes: Network,
    network_out_bytes: Network,
    process_count: Terminal,
    connection_count: Users,
    compliance_score: Shield,
};

// Metric Labels
const MetricLabels: Record<BaselineMetric, string> = {
    cpu_percent: 'CPU',
    memory_percent: 'Mémoire',
    disk_percent: 'Disque',
    network_in_bytes: 'Réseau (In)',
    network_out_bytes: 'Réseau (Out)',
    process_count: 'Processus',
    connection_count: 'Connexions',
    compliance_score: 'Conformité',
};

// Metric Units
const MetricUnits: Record<BaselineMetric, string> = {
    cpu_percent: '%',
    memory_percent: '%',
    disk_percent: '%',
    network_in_bytes: 'KB/s',
    network_out_bytes: 'KB/s',
    process_count: '',
    connection_count: '',
    compliance_score: '%',
};

// Format value based on metric type
const formatValue = (value: number, metric: BaselineMetric): string => {
    if (metric.includes('bytes')) {
        // Convert to KB/s
        return (value / 1024).toFixed(1);
    }
    if (metric.includes('count')) {
        return Math.round(value).toString();
    }
    return value.toFixed(1);
};

// Metric Baseline Card
const MetricBaselineCard: React.FC<{
    baseline: MetricBaseline;
    currentValue?: number;
}> = ({ baseline, currentValue }) => {
    const Icon = MetricIcons[baseline.metric];
    const label = MetricLabels[baseline.metric];
    const unit = MetricUnits[baseline.metric];

    const isAnomalous = currentValue !== undefined &&
        Math.abs(currentValue - baseline.mean) > 2 * baseline.stdDev;

    // Calculate percentage of range for bar visualization
    const range = baseline.max - baseline.min;
    const safeRange = range === 0 ? 1 : range; // Prevent NaN from division by zero
    const normalLow = Math.max(0, baseline.mean - baseline.stdDev);
    const normalHigh = baseline.mean + baseline.stdDev;

    return (
        <div className="bg-accent/30 rounded-3xl p-4">
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">
                        {baseline.dataPoints} points de données
                    </div>
                </div>
                {currentValue !== undefined && (
                    <div className={cn(
                        'text-lg font-bold',
                        isAnomalous ? 'text-destructive' : 'text-foreground'
                    )}>
                        {formatValue(currentValue, baseline.metric)}{unit}
                    </div>
                )}
            </div>

            {/* Range Visualization */}
            <div className="relative h-8 bg-accent rounded-lg overflow-hidden mb-3">
                {/* Normal Range */}
                <div
                    className="absolute h-full bg-success/30"
                    style={{
                        left: `${((normalLow - baseline.min) / safeRange) * 100}%`,
                        width: `${((normalHigh - normalLow) / safeRange) * 100}%`,
                    }}
                />
                {/* Mean Line */}
                <div
                    className="absolute h-full w-0.5 bg-success"
                    style={{
                        left: `${((baseline.mean - baseline.min) / safeRange) * 100}%`,
                    }}
                />
                {/* Current Value Marker */}
                {currentValue !== undefined && (
                    <div
                        className={cn(
                            'absolute h-full w-1 rounded',
                            isAnomalous ? 'bg-destructive' : 'bg-primary'
                        )}
                        style={{
                            left: `${Math.min(100, Math.max(0, ((currentValue - baseline.min) / safeRange) * 100))}%`,
                        }}
                    />
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center">
                    <div className="text-muted-foreground">Min</div>
                    <div className="font-medium">{formatValue(baseline.min, baseline.metric)}{unit}</div>
                </div>
                <div className="text-center">
                    <div className="text-muted-foreground">Moyenne</div>
                    <div className="font-medium text-success">{formatValue(baseline.mean, baseline.metric)}{unit}</div>
                </div>
                <div className="text-center">
                    <div className="text-muted-foreground">P95</div>
                    <div className="font-medium">{formatValue(baseline.p95, baseline.metric)}{unit}</div>
                </div>
                <div className="text-center">
                    <div className="text-muted-foreground">Max</div>
                    <div className="font-medium">{formatValue(baseline.max, baseline.metric)}{unit}</div>
                </div>
            </div>
        </div>
    );
};

// Hourly Pattern Chart
const HourlyPatternChart: React.FC<{
    pattern: HourlyPattern;
}> = ({ pattern }) => {
    const label = MetricLabels[pattern.metric];
    const maxValue = Math.max(...pattern.hourlyMeans);

    return (
        <div className="bg-accent/30 rounded-3xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="font-medium">{label} - Pattern Horaire</div>
                {pattern.isSignificant && (
                    <Badge variant="soft" className="bg-primary/10 text-primary text-xs">
                        Significatif
                    </Badge>
                )}
            </div>

            {/* Bar Chart */}
            <div className="flex items-end gap-0.5 h-24">
                {pattern.hourlyMeans.map((value, hour) => {
                    const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                    const isPeak = hour === pattern.peakHour;
                    const isTrough = hour === pattern.troughHour;

                    return (
                        <div
                            key={hour || 'unknown'}
                            className="flex-1 relative group"
                        >
                            <div
                                className={cn(
                                    'w-full rounded-t transition-colors',
                                    isPeak ? 'bg-destructive' :
                                        isTrough ? 'bg-success' :
                                            'bg-primary/50 hover:bg-primary'
                                )}
                                style={{ height: `${height}%` }}
                            />
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2
                                           hidden group-hover:block bg-popover text-popover-foreground
                                           text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                                {formatHourLabel(hour)}: {value.toFixed(1)}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Hour Labels */}
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>00h</span>
                <span>06h</span>
                <span>12h</span>
                <span>18h</span>
                <span>23h</span>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-destructive" />
                    <span>Pic ({formatHourLabel(pattern.peakHour)})</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-success" />
                    <span>Creux ({formatHourLabel(pattern.troughHour)})</span>
                </div>
            </div>
        </div>
    );
};

// Weekly Pattern Chart
const WeeklyPatternChart: React.FC<{
    pattern: WeeklyPattern;
}> = ({ pattern }) => {
    const label = MetricLabels[pattern.metric];
    const maxValue = Math.max(...pattern.dailyMeans);
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    return (
        <div className="bg-accent/30 rounded-3xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="font-medium">{label} - Pattern Hebdo</div>
                {pattern.isSignificant && (
                    <Badge variant="soft" className="bg-primary/10 text-primary text-xs">
                        Significatif
                    </Badge>
                )}
            </div>

            {/* Bar Chart */}
            <div className="flex items-end gap-2 h-24">
                {pattern.dailyMeans.map((value, day) => {
                    const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
                    const isPeak = day === pattern.peakDay;
                    const isTrough = day === pattern.troughDay;

                    return (
                        <div key={day || 'unknown'} className="flex-1 flex flex-col items-center">
                            <div className="w-full relative group flex-1 flex items-end">
                                <div
                                    className={cn(
                                        'w-full rounded-t transition-colors',
                                        isPeak ? 'bg-destructive' :
                                            isTrough ? 'bg-success' :
                                                'bg-primary/50 hover:bg-primary'
                                    )}
                                    style={{ height: `${height}%` }}
                                />
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2
                                               hidden group-hover:block bg-popover text-popover-foreground
                                               text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                                    {days[day]}: {value.toFixed(1)}
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {days[day]}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Known Processes List
const KnownProcessesList: React.FC<{
    processes: AgentBaseline['knownProcesses'];
}> = ({ processes }) => {
    const [showAll, setShowAll] = useState(false);
    const displayProcesses = showAll ? processes : processes.slice(0, 5);

    return (
        <div className="bg-accent/30 rounded-3xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    <span className="font-medium">Processus Connus</span>
                </div>
                <Badge variant="outline">{processes.length}</Badge>
            </div>

            <div className="space-y-2">
                {displayProcesses.map((process, idx) => (
                    <div
                        key={idx || 'unknown'}
                        className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0"
                    >
                        <div className="flex items-center gap-2">
                            <span className="font-mono">{process.name}</span>
                            {process.isSystem && (
                                <Badge variant="soft" className="text-xs">Système</Badge>
                            )}
                            {process.isWhitelisted && (
                                <Badge variant="soft" className="bg-success/10 text-success text-xs">
                                    Whitelist
                                </Badge>
                            )}
                        </div>
                        <div className="text-muted-foreground text-xs">
                            {process.seenCount}x vu
                        </div>
                    </div>
                ))}
            </div>

            {processes.length > 5 && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setShowAll(!showAll)}
                >
                    {showAll ? 'Voir moins' : `Voir ${processes.length - 5} de plus`}
                    <ChevronDown className={cn(
                        'h-4 w-4 ml-1 transition-transform',
                        showAll && 'rotate-180'
                    )} />
                </Button>
            )}
        </div>
    );
};

// Known Connections List
const KnownConnectionsList: React.FC<{
    connections: AgentBaseline['knownConnections'];
}> = ({ connections }) => {
    const [showAll, setShowAll] = useState(false);
    const displayConnections = showAll ? connections : connections.slice(0, 5);

    return (
        <div className="bg-accent/30 rounded-3xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-primary" />
                    <span className="font-medium">Connexions Connues</span>
                </div>
                <Badge variant="outline">{connections.length}</Badge>
            </div>

            <div className="space-y-2">
                {displayConnections.map((conn, idx) => (
                    <div
                        key={idx || 'unknown'}
                        className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0"
                    >
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">
                                {conn.remotePattern}:{conn.remotePort}
                            </span>
                            <Badge variant="outline" className="text-xs">
                                {conn.protocol.toUpperCase()}
                            </Badge>
                            {conn.isWhitelisted && (
                                <Badge variant="soft" className="bg-success/10 text-success text-xs">
                                    Whitelist
                                </Badge>
                            )}
                        </div>
                        <div className="text-muted-foreground text-xs">
                            {conn.category || 'unknown'}
                        </div>
                    </div>
                ))}
            </div>

            {connections.length > 5 && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setShowAll(!showAll)}
                >
                    {showAll ? 'Voir moins' : `Voir ${connections.length - 5} de plus`}
                    <ChevronDown className={cn(
                        'h-4 w-4 ml-1 transition-transform',
                        showAll && 'rotate-180'
                    )} />
                </Button>
            )}
        </div>
    );
};

// Single Agent Baseline View
const AgentBaselineView: React.FC<{
    baseline: AgentBaseline;
    onRecalculate?: () => void;
    isRecalculating?: boolean;
}> = ({ baseline, onRecalculate, isRecalculating }) => {
    const { config } = useLocale();
    const [activeTab, setActiveTab] = useState<'metrics' | 'patterns' | 'entities'>('metrics');

    return (
        <motion.div
            variants={slideUpVariants}
            className="glass-premium rounded-2xl overflow-hidden border border-border/40"
        >
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-border/50">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h3 className="font-semibold text-lg">{baseline.agentHostname}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                            <span>Fenêtre: {baseline.window}</span>
                            <span>•</span>
                            <span>{baseline.currentDataPoints} / {baseline.minimumDataPoints} points</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Stability Badge */}
                        <div className="text-right">
                            <div className="text-sm text-muted-foreground">Stabilité</div>
                            <div className={cn('font-semibold', getStabilityColor(baseline.stabilityScore))}>
                                {baseline.stabilityScore}% - {getStabilityLabel(baseline.stabilityScore)}
                            </div>
                        </div>

                        {/* Recalculate Button */}
                        {onRecalculate && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRecalculate}
                                disabled={isRecalculating}
                            >
                                <RefreshCw className={cn(
                                    'h-4 w-4 mr-1',
                                    isRecalculating && 'animate-spin'
                                )} />
                                Recalculer
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mt-4">
                    <Button
                        variant={activeTab === 'metrics' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('metrics')}
                    >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Métriques
                    </Button>
                    <Button
                        variant={activeTab === 'patterns' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('patterns')}
                    >
                        <Clock className="h-4 w-4 mr-1" />
                        Patterns
                    </Button>
                    <Button
                        variant={activeTab === 'entities' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setActiveTab('entities')}
                    >
                        <Database className="h-4 w-4 mr-1" />
                        Entités
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
                {activeTab === 'metrics' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {baseline.metrics.map(metric => (
                            <MetricBaselineCard
                                key={metric.metric || 'unknown'}
                                baseline={metric}
                            />
                        ))}
                    </div>
                )}

                {activeTab === 'patterns' && (
                    <div className="space-y-6">
                        {/* Hourly Patterns */}
                        {baseline.hourlyPatterns.length > 0 && (
                            <div>
                                <h4 className="font-medium mb-3 flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Patterns Horaires
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {baseline.hourlyPatterns.map(pattern => (
                                        <HourlyPatternChart
                                            key={pattern.metric || 'unknown'}
                                            pattern={pattern}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Weekly Patterns */}
                        {baseline.weeklyPatterns.length > 0 && (
                            <div>
                                <h4 className="font-medium mb-3 flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Patterns Hebdomadaires
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {baseline.weeklyPatterns.map(pattern => (
                                        <WeeklyPatternChart
                                            key={pattern.metric || 'unknown'}
                                            pattern={pattern}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {baseline.hourlyPatterns.length === 0 && baseline.weeklyPatterns.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                <Activity className="h-12 w-12 mx-auto mb-3 opacity-60" />
                                <p>Pas assez de données pour détecter des patterns</p>
                                <p className="text-sm">Minimum 7 jours requis</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'entities' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <KnownProcessesList processes={baseline.knownProcesses} />
                        <KnownConnectionsList connections={baseline.knownConnections} />
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 bg-accent/30 text-sm text-muted-foreground">
                Dernière mise à jour: {new Date(baseline.lastRecalculated).toLocaleDateString(config.intlLocale, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                })}
            </div>
        </motion.div>
    );
};

// Main Component
export const BehavioralBaseline: React.FC<BehavioralBaselineProps> = ({
    agentId,
    className,
    showAllAgents = false,
}) => {
    const { user } = useStore();
    const organizationId = user?.organizationId;
    const [baselines, setBaselines] = useState<AgentBaseline[]>([]);
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState<string | null>(null);

    useEffect(() => {
        if (!organizationId) return;

        setLoading(true);

        const unsubscribe = subscribeToBaselines(
            organizationId,
            (data) => {
                setBaselines(data);
                setLoading(false);
            },
            (error) => {
                ErrorLogger.error(error, 'BehavioralBaseline.loadBaselines');
                setLoading(false);
            },
            agentId
        );

        return () => unsubscribe();
    }, [organizationId, agentId]);

    const handleRecalculate = async (baselineAgentId: string) => {
        if (!organizationId) return;

        setRecalculating(baselineAgentId);
        try {
            await recalculateBaseline(organizationId, baselineAgentId);
        } catch (error) {
            ErrorLogger.error(error, 'BehavioralBaseline.recalculate');
        } finally {
            setRecalculating(null);
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

    if (baselines.length === 0) {
        return (
            <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerContainerVariants}
                className={cn('space-y-4', className)}
            >
                <motion.div
                    variants={slideUpVariants}
                    className="glass-premium rounded-2xl p-8 text-center border border-border/40"
                >
                    <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">Aucune baseline disponible</h3>
                    <p className="text-sm text-muted-foreground">
                        Les baselines sont calculées automatiquement après 24h de données
                    </p>
                </motion.div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainerVariants}
            className={cn('space-y-6', className)}
        >
            {/* Summary Stats */}
            {showAllAgents && (
                <motion.div variants={slideUpVariants} className="glass-premium rounded-2xl p-4 sm:p-6 border border-border/40">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-3xl bg-primary/10">
                            <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold">Baselines Fleet</h3>
                            <p className="text-sm text-muted-foreground">
                                {baselines.length} agent{baselines.length > 1 ? 's' : ''} avec baseline
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="text-center">
                            <div className="text-3xl font-bold">
                                {baselines.filter(b => b.isStable).length}
                            </div>
                            <div className="text-sm text-muted-foreground">Stables</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-warning">
                                {baselines.filter(b => !b.isStable).length}
                            </div>
                            <div className="text-sm text-muted-foreground">En construction</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-success">
                                {Math.round(baselines.reduce((sum, b) => sum + b.stabilityScore, 0) / baselines.length)}%
                            </div>
                            <div className="text-sm text-muted-foreground">Stabilité moy.</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl font-bold">
                                {Math.round(baselines.reduce((sum, b) => sum + b.currentDataPoints, 0) / baselines.length)}
                            </div>
                            <div className="text-sm text-muted-foreground">Points moy.</div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Baselines List */}
            {baselines.map(baseline => (
                <AgentBaselineView
                    key={baseline.id || 'unknown'}
                    baseline={baseline}
                    onRecalculate={() => handleRecalculate(baseline.agentId)}
                    isRecalculating={recalculating === baseline.agentId}
                />
            ))}
        </motion.div>
    );
};

export default BehavioralBaseline;
