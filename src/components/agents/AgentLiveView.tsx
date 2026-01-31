/**
 * AgentLiveView
 *
 * Main container for real-time agent monitoring.
 * Orchestrates AgentMetricsChart, AgentProcessList, and AgentNetworkConnections.
 * Features tabs for switching between views and real-time data subscription.
 * Includes detailed metrics summary with compliance score, disk/memory details, uptime.
 * Apple Activity Monitor-inspired design.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { SentinelAgent, AgentRealtimeData, AgentRealtimeMetrics, AgentDetails } from '../../types/agent';
import { AgentService } from '../../services/AgentService';
import { AgentMetricsChart } from './AgentMetricsChart';
import { AgentProcessList } from './AgentProcessList';
import { AgentNetworkConnections } from './AgentNetworkConnections';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import {
    Activity, Cpu, Network, X, RefreshCw,
    Clock, Server, Apple, Monitor, Shield, HardDrive,
    CheckCircle, XCircle, AlertTriangle
} from '../ui/Icons';
import { cn } from '../../lib/utils';
import { ErrorLogger } from '../../services/errorLogger';

interface AgentLiveViewProps {
    agent: SentinelAgent;
    onClose?: () => void;
    className?: string;
}

// OS Icon component
const OSIcon: React.FC<{ os: SentinelAgent['os']; className?: string }> = ({ os, className }) => {
    switch (os) {
        case 'darwin':
            return <Apple className={className} />;
        case 'windows':
            return <Monitor className={className} />;
        case 'linux':
        default:
            return <Server className={className} />;
    }
};

// Format last seen
const formatLastSeen = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Format bytes to human readable
const formatBytes = (bytes: number | undefined): string => {
    if (bytes === undefined || bytes === null) return '-';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// Format uptime
const formatUptime = (seconds: number | undefined): string => {
    if (seconds === undefined || seconds === null) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}j ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

// Score color based on value
const getScoreColor = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return 'text-muted-foreground';
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
};

// Score background based on value
const getScoreBg = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return 'bg-muted/30';
    if (score >= 80) return 'bg-success/10';
    if (score >= 60) return 'bg-warning/10';
    return 'bg-destructive/10';
};

// Build real-time data from actual agent heartbeat values
// Processes and connections are not yet collected from agents
const buildRealtimeDataFromAgent = (agent: SentinelAgent): AgentRealtimeData => {
    const now = new Date();

    const currentMetric: AgentRealtimeMetrics = {
        cpuPercent: agent.cpuPercent ?? 0,
        memoryPercent: agent.memoryPercent ?? 0,
        memoryBytes: agent.memoryBytes ?? 0,
        diskPercent: agent.diskPercent ?? 0,
        networkInBytes: 0,
        networkOutBytes: 0,
        timestamp: now.toISOString(),
    };

    return {
        agentId: agent.id,
        metrics: currentMetric,
        processes: [],      // Not yet collected by the agent
        connections: [],    // Not yet collected by the agent
        lastUpdate: agent.lastHeartbeat || now.toISOString(),
    };
};

export const AgentLiveView: React.FC<AgentLiveViewProps> = ({
    agent,
    onClose,
    className
}) => {
    const [activeTab, setActiveTab] = useState('metrics');
    const [realtimeData, setRealtimeData] = useState<AgentRealtimeData | null>(() => buildRealtimeDataFromAgent(agent));
    const [metricsHistory, setMetricsHistory] = useState<AgentRealtimeMetrics[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [agentDetails, setAgentDetails] = useState<AgentDetails | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(true);

    // Compute compliance score from actual results (reliable)
    const computedComplianceScore = useMemo(() => {
        if (!agentDetails?.resultsSummary) return null;
        const { pass, fail, error } = agentDetails.resultsSummary;
        const total = pass + fail + error;
        if (total === 0) return null;
        return Math.round((pass / total) * 100);
    }, [agentDetails]);

    // Use computed score when available, fallback to agent-reported score
    const reliableComplianceScore = computedComplianceScore ?? agent.complianceScore ?? null;

    // Fetch agent details (results summary) on mount
    useEffect(() => {
        let cancelled = false;
        const fetchDetails = async () => {
            if (!agent.id || !agent.organizationId) return;
            try {
                setDetailsLoading(true);
                const details = await AgentService.getAgentDetails(agent.organizationId, agent.id);
                if (!cancelled) setAgentDetails(details);
            } catch (error) {
                if (!cancelled) {
                    ErrorLogger.error(error, 'AgentLiveView.fetchDetails', {
                        component: 'AgentLiveView',
                        action: 'fetchDetails',
                        metadata: { agentId: agent.id }
                    });
                }
            } finally {
                if (!cancelled) setDetailsLoading(false);
            }
        };

        fetchDetails();
        return () => { cancelled = true; };
    }, [agent.id, agent.organizationId]);

    // Fetch metrics history on mount
    useEffect(() => {
        let cancelled = false;
        const fetchHistory = async () => {
            if (!agent.id || !agent.organizationId) return;
            try {
                setHistoryLoading(true);
                const history = await AgentService.getAgentMetricsHistory(agent.organizationId, agent.id, 1);
                if (!cancelled && history && history.metrics) {
                    // Map AgentMetricPoint to AgentRealtimeMetrics
                    const mappedMetrics: AgentRealtimeMetrics[] = history.metrics.map(m => ({
                        ...m,
                        diskPercent: m.diskPercent,
                        networkInBytes: undefined, // Network history not currently collected
                        networkOutBytes: undefined,
                        timestamp: m.timestamp
                    }));
                    setMetricsHistory(mappedMetrics);
                }
            } catch (error) {
                if (!cancelled) {
                    ErrorLogger.error(error, 'AgentLiveView.fetchHistory', {
                        component: 'AgentLiveView',
                        action: 'fetchHistory',
                        metadata: { agentId: agent.id }
                    });
                }
            } finally {
                if (!cancelled) setHistoryLoading(false);
            }
        };

        fetchHistory();
        return () => { cancelled = true; };
    }, [agent.id, agent.organizationId]);

    // Update data when agent changes
    useEffect(() => {
        setRealtimeData(buildRealtimeDataFromAgent(agent));
    }, [agent]);

    // Update metrics when agent heartbeat data changes (real data from Firestore subscription)
    useEffect(() => {
        if (!realtimeData) return;

        const now = new Date();
        const newMetric: AgentRealtimeMetrics = {
            cpuPercent: agent.cpuPercent ?? 0,
            memoryPercent: agent.memoryPercent ?? 0,
            memoryBytes: agent.memoryBytes ?? 0,
            diskPercent: agent.diskPercent ?? 0,
            networkInBytes: 0,
            networkOutBytes: 0,
            timestamp: now.toISOString(),
        };

        setMetricsHistory(prev => {
            const updated = [...prev, newMetric];
            // Keep last 60 entries for chart history
            return updated.slice(-60);
        });

        setRealtimeData(prev => prev ? {
            ...prev,
            metrics: newMetric,
            lastUpdate: agent.lastHeartbeat || now.toISOString(),
        } : null);
        // Only re-run when agent data actually changes (new heartbeat)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agent.cpuPercent, agent.memoryPercent, agent.diskPercent, agent.memoryBytes, agent.lastHeartbeat]);

    // Manual refresh
    const handleRefresh = useCallback(async () => {
        const data = buildRealtimeDataFromAgent(agent);
        setRealtimeData(data);
        setLastRefresh(new Date());
        // Also refresh agent details
        if (agent.id && agent.organizationId) {
            try {
                const details = await AgentService.getAgentDetails(agent.organizationId, agent.id);
                setAgentDetails(details);
            } catch {
                // Non-critical, keep existing details
            }
        }
    }, [agent]);

    const isActive = agent.status === 'active';

    return (
        <motion.div
            variants={slideUpVariants}
            initial="initial"
            animate="visible"
            exit="exit"
            className={cn(
                'flex flex-col h-full bg-background rounded-3xl overflow-hidden',
                'border border-border/50 shadow-apple-xl',
                className
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-3xl bg-muted/50 flex items-center justify-center">
                            <OSIcon os={agent.os} className="w-6 h-6 text-foreground" />
                        </div>
                        <div className={cn(
                            'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background',
                            isActive ? 'bg-success' : 'bg-muted-foreground'
                        )}>
                            {isActive && (
                                <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-foreground">
                                {agent.name || agent.hostname || agent.id.slice(0, 8)}
                            </h2>
                            <Badge status={isActive ? 'success' : 'neutral'} className="text-[11px]">
                                {isActive ? 'En ligne' : 'Hors ligne'}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            <span>{agent.ipAddress}</span>
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatLastSeen(agent.lastHeartbeat)}
                            </span>
                            {agent.version && (
                                <span>v{agent.version}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        className="h-8 w-8 p-0"
                        title="Rafraîchir"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    {onClose && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="h-8 w-8 p-0"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Metrics Summary */}
            <div className="px-4 pt-4 space-y-3">
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* CPU */}
                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/30">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">CPU</span>
                            <span className="text-xs text-muted-foreground" title="Utilisation CPU validée (max 100%)">ⓘ</span>
                        </div>
                        <span className={cn(
                            'text-xl font-bold block',
                            agent.cpuPercent !== undefined && agent.cpuPercent > 80 ? 'text-destructive' :
                                agent.cpuPercent !== undefined && agent.cpuPercent > 60 ? 'text-warning' : 'text-foreground'
                        )}>
                            {agent.cpuPercent !== undefined ? `${agent.cpuPercent.toFixed(1)}%` : '-'}
                        </span>
                    </div>

                    {/* Memory */}
                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/30">
                        <div className="flex items-center gap-1.5 mb-1">
                            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">RAM</span>
                        </div>
                        <span className={cn(
                            'text-xl font-bold block',
                            agent.memoryPercent !== undefined && agent.memoryPercent > 85 ? 'text-destructive' :
                                agent.memoryPercent !== undefined && agent.memoryPercent > 70 ? 'text-warning' : 'text-foreground'
                        )}>
                            {agent.memoryPercent !== undefined ? `${agent.memoryPercent.toFixed(1)}%` : formatBytes(agent.memoryBytes) || '-'}
                        </span>
                        {agent.memoryBytes !== undefined && agent.memoryTotalBytes !== undefined && (
                            <span className="text-[11px] text-muted-foreground block mt-0.5">
                                {formatBytes(agent.memoryBytes)} / {formatBytes(agent.memoryTotalBytes)}
                            </span>
                        )}
                    </div>

                    {/* Disk */}
                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/30">
                        <div className="flex items-center gap-1.5 mb-1">
                            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Disque</span>
                        </div>
                        <span className={cn(
                            'text-xl font-bold block',
                            agent.diskPercent !== undefined && agent.diskPercent > 90 ? 'text-destructive' :
                                agent.diskPercent !== undefined && agent.diskPercent > 80 ? 'text-warning' : 'text-foreground'
                        )}>
                            {agent.diskPercent !== undefined ? `${agent.diskPercent.toFixed(1)}%` : '-'}
                        </span>
                        {agent.diskUsedBytes !== undefined && agent.diskTotalBytes !== undefined && (
                            <span className="text-[11px] text-muted-foreground block mt-0.5">
                                {formatBytes(agent.diskUsedBytes)} / {formatBytes(agent.diskTotalBytes)}
                            </span>
                        )}
                    </div>

                    {/* Uptime */}
                    <div className="p-3 rounded-2xl bg-muted/30 border border-border/30">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Uptime</span>
                        </div>
                        <span className="text-xl font-bold text-foreground block">
                            {formatUptime(agent.uptimeSeconds)}
                        </span>
                    </div>
                </div>

                {/* Compliance Score + Results Summary */}
                <div className="flex flex-col sm:flex-row gap-2">
                    {/* Compliance Score */}
                    <div className={cn(
                        'flex-1 p-3 rounded-2xl border border-border/30',
                        getScoreBg(reliableComplianceScore)
                    )}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Score Conformité</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className={cn('text-2xl font-black', getScoreColor(reliableComplianceScore))}>
                                {reliableComplianceScore !== null ? `${reliableComplianceScore}%` : '-'}
                            </span>
                            {computedComplianceScore !== null && (
                                <span className="text-[11px] text-muted-foreground">
                                    (calculé depuis {agentDetails?.resultsSummary?.total ?? 0} résultats)
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Results Summary */}
                    <div className="flex-1 p-3 rounded-2xl bg-muted/30 border border-border/30">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Résultats des Checks</span>
                        </div>
                        {detailsLoading ? (
                            <div className="h-6 bg-muted/50 rounded animate-pulse" />
                        ) : agentDetails?.resultsSummary ? (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <CheckCircle className="h-3.5 w-3.5 text-success" />
                                    <span className="text-sm font-bold text-success">{agentDetails.resultsSummary.pass}</span>
                                    <span className="text-[11px] text-muted-foreground">pass</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                                    <span className="text-sm font-bold text-destructive">{agentDetails.resultsSummary.fail}</span>
                                    <span className="text-[11px] text-muted-foreground">fail</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                                    <span className="text-sm font-bold text-warning">{agentDetails.resultsSummary.error}</span>
                                    <span className="text-[11px] text-muted-foreground">erreur</span>
                                </div>
                                {agentDetails.resultsSummary.not_applicable > 0 && (
                                    <div className="flex items-center gap-1">
                                        <span className="text-sm font-bold text-muted-foreground">{agentDetails.resultsSummary.not_applicable}</span>
                                        <span className="text-[11px] text-muted-foreground">N/A</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <span className="text-sm text-muted-foreground">Aucun résultat disponible</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex-1 overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <div className="px-4 pt-4">
                        <TabsList className="w-full justify-start bg-muted/30 p-1 rounded-3xl">
                            <TabsTrigger
                                value="metrics"
                                className="gap-2 data-[state=active]:bg-background rounded-lg"
                            >
                                <Activity className="h-4 w-4" />
                                <span className="hidden sm:inline">Métriques</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="processes"
                                className="gap-2 data-[state=active]:bg-background rounded-lg"
                            >
                                <Cpu className="h-4 w-4" />
                                <span className="hidden sm:inline">Processus</span>
                                {realtimeData && realtimeData.processes.length > 0 && (
                                    <Badge status="neutral" className="text-[11px] ml-1">
                                        {realtimeData.processes.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger
                                value="network"
                                className="gap-2 data-[state=active]:bg-background rounded-lg"
                            >
                                <Network className="h-4 w-4" />
                                <span className="hidden sm:inline">Réseau</span>
                                {realtimeData && realtimeData.connections.length > 0 && (
                                    <Badge status="neutral" className="text-[11px] ml-1">
                                        {realtimeData.connections.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-auto p-4">
                        <AnimatePresence mode="wait">
                            <TabsContent value="metrics" className="mt-0 h-full">
                                <AgentMetricsChart
                                    metrics={metricsHistory}
                                    loading={historyLoading}
                                />
                            </TabsContent>

                            <TabsContent value="processes" className="mt-0 h-full">
                                <AgentProcessList
                                    processes={realtimeData?.processes || []}
                                    loading={historyLoading}
                                />
                            </TabsContent>

                            <TabsContent value="network" className="mt-0 h-full">
                                <AgentNetworkConnections
                                    connections={realtimeData?.connections || []}
                                    loading={historyLoading}
                                />
                            </TabsContent>
                        </AnimatePresence>
                    </div>
                </Tabs>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-muted/10 text-xs text-muted-foreground">
                <span>
                    Dernière mise à jour: {lastRefresh.toLocaleTimeString('fr-FR')}
                </span>
                <span className="flex items-center gap-1">
                    <span className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isActive ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                    )} />
                    {isActive ? 'Données du dernier heartbeat (intervalle ~60s)' : 'Agent hors ligne — dernières données connues'}
                </span>
            </div>
        </motion.div>
    );
};

export default AgentLiveView;
