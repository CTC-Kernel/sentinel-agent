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
import { SentinelAgent, AgentRealtimeData, AgentRealtimeMetrics, AgentProcess, AgentConnection } from '../../types/agent';
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

// Generate mock real-time data for demo purposes
// In production, this would come from Firestore real-time subscription
const generateMockRealtimeData = (agent: SentinelAgent): AgentRealtimeData => {
    const now = new Date();

    // Generate 60 data points for 1 minute of data
    const metricsHistory: AgentRealtimeMetrics[] = Array.from({ length: 60 }, (_, i) => {
        const timestamp = new Date(now.getTime() - (59 - i) * 1000);
        return {
            cpuPercent: Math.max(0, Math.min(100, (agent.cpuPercent || 20) + (Math.random() - 0.5) * 20)),
            memoryPercent: Math.max(0, Math.min(100, 45 + (Math.random() - 0.5) * 10)),
            memoryBytes: agent.memoryBytes || 4 * 1024 * 1024 * 1024,
            diskPercent: 65 + (Math.random() - 0.5) * 5,
            networkInBytes: Math.floor(Math.random() * 1024 * 1024),
            networkOutBytes: Math.floor(Math.random() * 512 * 1024),
            timestamp: timestamp.toISOString(),
        };
    });

    // Generate mock processes
    const processes: AgentProcess[] = [
        { pid: 1, name: 'systemd', cpuPercent: 0.1, memoryBytes: 12 * 1024 * 1024, memoryPercent: 0.3, status: 'running', user: 'root' },
        { pid: 234, name: 'sentinel-agent', cpuPercent: 2.5, memoryBytes: 85 * 1024 * 1024, memoryPercent: 2.1, status: 'running', user: 'sentinel' },
        { pid: 567, name: 'nginx', cpuPercent: 0.8, memoryBytes: 45 * 1024 * 1024, memoryPercent: 1.1, status: 'running', user: 'www-data' },
        { pid: 890, name: 'postgres', cpuPercent: 5.2, memoryBytes: 256 * 1024 * 1024, memoryPercent: 6.4, status: 'running', user: 'postgres' },
        { pid: 1234, name: 'node', cpuPercent: 12.3, memoryBytes: 512 * 1024 * 1024, memoryPercent: 12.8, status: 'running', user: 'app' },
        { pid: 1567, name: 'redis-server', cpuPercent: 1.1, memoryBytes: 128 * 1024 * 1024, memoryPercent: 3.2, status: 'running', user: 'redis' },
        { pid: 1890, name: 'docker', cpuPercent: 3.4, memoryBytes: 200 * 1024 * 1024, memoryPercent: 5.0, status: 'running', user: 'root' },
        { pid: 2123, name: 'sshd', cpuPercent: 0.0, memoryBytes: 8 * 1024 * 1024, memoryPercent: 0.2, status: 'sleeping', user: 'root' },
        { pid: 2456, name: 'cron', cpuPercent: 0.0, memoryBytes: 4 * 1024 * 1024, memoryPercent: 0.1, status: 'sleeping', user: 'root' },
        { pid: 2789, name: 'rsyslogd', cpuPercent: 0.2, memoryBytes: 16 * 1024 * 1024, memoryPercent: 0.4, status: 'running', user: 'syslog' },
    ];

    // Generate mock connections
    const connections: AgentConnection[] = [
        { id: '1', protocol: 'tcp', localAddress: '0.0.0.0', localPort: 443, remoteAddress: '', remotePort: 0, state: 'LISTEN', processName: 'nginx', pid: 567 },
        { id: '2', protocol: 'tcp', localAddress: '0.0.0.0', localPort: 80, remoteAddress: '', remotePort: 0, state: 'LISTEN', processName: 'nginx', pid: 567 },
        { id: '3', protocol: 'tcp', localAddress: '192.168.1.100', localPort: 443, remoteAddress: '203.0.113.50', remotePort: 52341, state: 'ESTABLISHED', processName: 'nginx', pid: 567 },
        { id: '4', protocol: 'tcp', localAddress: '192.168.1.100', localPort: 443, remoteAddress: '198.51.100.25', remotePort: 48123, state: 'ESTABLISHED', processName: 'nginx', pid: 567 },
        { id: '5', protocol: 'tcp', localAddress: '127.0.0.1', localPort: 5432, remoteAddress: '', remotePort: 0, state: 'LISTEN', processName: 'postgres', pid: 890 },
        { id: '6', protocol: 'tcp', localAddress: '127.0.0.1', localPort: 5432, remoteAddress: '127.0.0.1', remotePort: 41234, state: 'ESTABLISHED', processName: 'postgres', pid: 890 },
        { id: '7', protocol: 'tcp', localAddress: '0.0.0.0', localPort: 6379, remoteAddress: '', remotePort: 0, state: 'LISTEN', processName: 'redis-server', pid: 1567 },
        { id: '8', protocol: 'tcp', localAddress: '192.168.1.100', localPort: 22, remoteAddress: '10.0.0.5', remotePort: 59012, state: 'ESTABLISHED', processName: 'sshd', pid: 2123 },
        { id: '9', protocol: 'tcp', localAddress: '192.168.1.100', localPort: 49532, remoteAddress: 'api.sentinel-grc.com', remotePort: 443, state: 'ESTABLISHED', processName: 'sentinel-agent', pid: 234 },
        { id: '10', protocol: 'udp', localAddress: '0.0.0.0', localPort: 68, remoteAddress: '', remotePort: 0, state: 'LISTEN', processName: 'dhclient', pid: 456 },
    ];

    return {
        agentId: agent.id,
        metrics: metricsHistory[metricsHistory.length - 1],
        processes,
        connections,
        lastUpdate: now.toISOString(),
    };
};

export const AgentLiveView: React.FC<AgentLiveViewProps> = ({
    agent,
    onClose,
    className
}) => {
    const [activeTab, setActiveTab] = useState('metrics');
    const [realtimeData, setRealtimeData] = useState<AgentRealtimeData | null>(() => generateMockRealtimeData(agent));
    const [metricsHistory, setMetricsHistory] = useState<AgentRealtimeMetrics[]>(() => {
        // Generate initial metrics history using real agent data where available
        const now = new Date();
        const baseCpu = agent.cpuPercent ?? 0;
        const baseMem = agent.memoryPercent ?? 0;
        const baseDisk = agent.diskPercent ?? 0;
        return Array.from({ length: 60 }, (_, i) => {
            const timestamp = new Date(now.getTime() - (59 - i) * 1000);
            const cpuVariation = ((i % 7) - 3) * 2;
            const memVariation = ((i % 5) - 2) * 1;
            return {
                cpuPercent: Math.max(0, Math.min(100, baseCpu + cpuVariation)),
                memoryPercent: Math.max(0, Math.min(100, baseMem + memVariation)),
                memoryBytes: agent.memoryBytes || 0,
                diskPercent: Math.max(0, Math.min(100, baseDisk + ((i % 3) - 1))),
                networkInBytes: (i * 17389) % (1024 * 1024),
                networkOutBytes: (i * 8731) % (512 * 1024),
                timestamp: timestamp.toISOString(),
            };
        });
    });
    const [loading, _setLoading] = useState(false);
    void _setLoading; // Reserved for future use with real-time data loading
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Update data when agent changes
    useEffect(() => {
        setRealtimeData(generateMockRealtimeData(agent));
    }, [agent]);

    // Simulate real-time metric updates using real agent base values
    // TODO: Replace with Firestore real-time subscription when agent pushes live metrics
    useEffect(() => {
        if (!realtimeData) return;

        const baseCpu = agent.cpuPercent ?? 0;
        const baseMem = agent.memoryPercent ?? 0;
        const baseDisk = agent.diskPercent ?? 0;

        const interval = setInterval(() => {
            const now = new Date();
            const newMetric: AgentRealtimeMetrics = {
                cpuPercent: Math.max(0, Math.min(100, baseCpu + (Math.random() - 0.5) * 10)),
                memoryPercent: Math.max(0, Math.min(100, baseMem + (Math.random() - 0.5) * 5)),
                memoryBytes: agent.memoryBytes || 0,
                diskPercent: Math.max(0, Math.min(100, baseDisk + (Math.random() - 0.5) * 2)),
                networkInBytes: Math.floor(Math.random() * 1024 * 1024),
                networkOutBytes: Math.floor(Math.random() * 512 * 1024),
                timestamp: now.toISOString(),
            };

            setMetricsHistory(prev => {
                const updated = [...prev, newMetric];
                // Keep last 60 entries (1 minute at 1 sample/sec)
                return updated.slice(-60);
            });

            setRealtimeData(prev => prev ? {
                ...prev,
                metrics: newMetric,
                lastUpdate: now.toISOString(),
            } : null);
        }, 1000);

        return () => clearInterval(interval);
    }, [realtimeData, agent.cpuPercent, agent.memoryPercent, agent.diskPercent, agent.memoryBytes]);

    // Manual refresh
    const handleRefresh = useCallback(() => {
        const data = generateMockRealtimeData(agent);
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
                                {realtimeData && (
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
                                {realtimeData && (
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
                                    loading={loading}
                                />
                            </TabsContent>

                            <TabsContent value="processes" className="mt-0 h-full">
                                <AgentProcessList
                                    processes={realtimeData?.processes || []}
                                    loading={loading}
                                />
                            </TabsContent>

                            <TabsContent value="network" className="mt-0 h-full">
                                <AgentNetworkConnections
                                    connections={realtimeData?.connections || []}
                                    loading={loading}
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
                    {isActive ? 'Métriques basées sur le dernier heartbeat' : 'Agent hors ligne'}
                </span>
            </div>
        </motion.div>
    );
};

export default AgentLiveView;
