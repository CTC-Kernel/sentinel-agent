/**
 * AgentLiveView
 *
 * Main container for real-time agent monitoring.
 * Orchestrates AgentMetricsChart, AgentProcessList, and AgentNetworkConnections.
 * Features tabs for switching between views and real-time data subscription.
 * Apple Activity Monitor-inspired design.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { SentinelAgent, AgentRealtimeData, AgentRealtimeMetrics } from '../../types/agent';
import { AgentService } from '../../services/AgentService';
import { AgentMetricsChart } from './AgentMetricsChart';
import { AgentProcessList } from './AgentProcessList';
import { AgentNetworkConnections } from './AgentNetworkConnections';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import {
    Activity, Cpu, Network, X, RefreshCw,
    Clock, Server, Apple, Monitor
} from '../ui/Icons';
import { cn } from '../../lib/utils';

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

    // Fetch metrics history on mount
    useEffect(() => {
        const fetchHistory = async () => {
            if (!agent.id || !agent.organizationId) return;
            try {
                setHistoryLoading(true);
                const history = await AgentService.getAgentMetricsHistory(agent.organizationId, agent.id, 1);
                if (history && history.metrics) {
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
                console.error('Failed to fetch agent metrics history:', error);
            } finally {
                setHistoryLoading(false);
            }
        };

        fetchHistory();
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
    const handleRefresh = useCallback(() => {
        const data = buildRealtimeDataFromAgent(agent);
        setRealtimeData(data);
        setLastRefresh(new Date());
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
