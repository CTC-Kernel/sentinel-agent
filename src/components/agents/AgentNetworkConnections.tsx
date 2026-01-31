/**
 * AgentNetworkConnections
 *
 * Network connections table for agent live view.
 * Displays active connections with local/remote addresses, ports, protocol, state.
 * Includes filtering by protocol and state.
 * Apple Activity Monitor-inspired design.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { AgentConnection } from '../../types/agent';
import { Search, Network, Globe, Server } from '../ui/Icons';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface AgentNetworkConnectionsProps {
    connections: AgentConnection[];
    loading?: boolean;
    className?: string;
}

type ConnectionStateFilter = 'all' | 'ESTABLISHED' | 'LISTEN' | 'TIME_WAIT' | 'other';

// Get state badge variant
const getStateVariant = (state: AgentConnection['state']): 'success' | 'warning' | 'error' | 'neutral' => {
    switch (state) {
        case 'ESTABLISHED': return 'success';
        case 'LISTEN': return 'neutral';
        case 'TIME_WAIT':
        case 'CLOSE_WAIT':
        case 'FIN_WAIT1':
        case 'FIN_WAIT2': return 'warning';
        case 'CLOSED':
        case 'CLOSING': return 'error';
        default: return 'neutral';
    }
};

// Format address display
const formatAddress = (address: string, port: number): string => {
    if (address === '0.0.0.0' || address === '::') return `*:${port}`;
    if (address === '127.0.0.1' || address === '::1') return `localhost:${port}`;
    return `${address}:${port}`;
};

// Check if address is local
const isLocalAddress = (address: string): boolean => {
    return address === '127.0.0.1' || address === '::1' || address === 'localhost';
};

// Protocol badge colors
const getProtocolColor = (protocol: AgentConnection['protocol']): string => {
    switch (protocol) {
        case 'tcp': return 'bg-primary/15 text-primary';
        case 'udp': return 'bg-success/15 text-success';
        case 'tcp6': return 'bg-info/15 text-info';
        case 'udp6': return 'bg-secondary/15 text-secondary';
        default: return 'bg-muted text-muted-foreground';
    }
};

export const AgentNetworkConnections: React.FC<AgentNetworkConnectionsProps> = ({
    connections,
    loading,
    className
}) => {
    const [search, setSearch] = useState('');
    const [stateFilter, setStateFilter] = useState<ConnectionStateFilter>('all');

    // Filter connections
    const filteredConnections = useMemo(() => {
        let result = [...connections];

        // Filter by search
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(c =>
                c.localAddress.includes(searchLower) ||
                c.remoteAddress.includes(searchLower) ||
                c.localPort.toString().includes(searchLower) ||
                c.remotePort.toString().includes(searchLower) ||
                c.processName?.toLowerCase().includes(searchLower) ||
                c.protocol.includes(searchLower)
            );
        }

        // Filter by state
        if (stateFilter !== 'all') {
            if (stateFilter === 'other') {
                result = result.filter(c =>
                    !['ESTABLISHED', 'LISTEN', 'TIME_WAIT'].includes(c.state)
                );
            } else {
                result = result.filter(c => c.state === stateFilter);
            }
        }

        return result;
    }, [connections, search, stateFilter]);

    // Stats
    const stats = useMemo(() => {
        const established = connections.filter(c => c.state === 'ESTABLISHED').length;
        const listening = connections.filter(c => c.state === 'LISTEN').length;
        const waiting = connections.filter(c => ['TIME_WAIT', 'CLOSE_WAIT'].includes(c.state)).length;
        const uniqueRemotes = new Set(connections.map(c => c.remoteAddress)).size;
        return { total: connections.length, established, listening, waiting, uniqueRemotes };
    }, [connections]);

    if (loading) {
        return (
            <div className={cn('space-y-4 animate-pulse', className)}>
                <div className="flex gap-4">
                    <div className="h-10 bg-muted/50 rounded-lg w-64" />
                    <div className="h-10 bg-muted/50 rounded-lg w-48" />
                </div>
                <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i || 'unknown'} className="h-12 bg-muted/50 rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <motion.div
            variants={slideUpVariants}
            className={cn('space-y-4', className)}
        >
            {/* Header with search and filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher une connexion..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 w-64"
                        />
                    </div>
                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                        <Button
                            variant={stateFilter === 'all' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setStateFilter('all')}
                            className="h-7 text-xs"
                        >
                            Toutes
                        </Button>
                        <Button
                            variant={stateFilter === 'ESTABLISHED' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setStateFilter('ESTABLISHED')}
                            className="h-7 text-xs gap-1"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            Établies
                        </Button>
                        <Button
                            variant={stateFilter === 'LISTEN' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setStateFilter('LISTEN')}
                            className="h-7 text-xs gap-1"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                            Écoute
                        </Button>
                        <Button
                            variant={stateFilter === 'TIME_WAIT' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setStateFilter('TIME_WAIT')}
                            className="h-7 text-xs gap-1"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                            Attente
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <Network className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-bold text-foreground">{stats.total}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        <span className="font-bold text-foreground">{stats.established}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Hôtes distants:</span>
                        <span className="font-bold text-foreground">{stats.uniqueRemotes}</span>
                    </div>
                </div>
            </div>

            {/* Connections table */}
            <div className="glass-premium rounded-2xl border border-border/50 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-muted/30 border-b border-border/50">
                    <div className="col-span-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Proto
                    </div>
                    <div className="col-span-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Local
                    </div>
                    <div className="col-span-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Distant
                    </div>
                    <div className="col-span-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        État
                    </div>
                    <div className="col-span-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Processus
                    </div>
                </div>

                {/* Table body */}
                <div className="max-h-[400px] overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                        {filteredConnections.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                                <Network className="h-8 w-8 opacity-30" />
                                <span>{search || stateFilter !== 'all' ? 'Aucune connexion trouvée' : 'Connexions réseau non disponibles'}</span>
                                {!search && stateFilter === 'all' && (
                                    <span className="text-xs opacity-70">
                                        La collecte des connexions sera disponible dans une prochaine version
                                    </span>
                                )}
                            </div>
                        ) : (
                            filteredConnections.map((connection, index) => (
                                <motion.div
                                    key={connection.id || 'unknown'}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ delay: index * 0.01 }}
                                    className={cn(
                                        'grid grid-cols-12 gap-4 px-4 py-3 items-center',
                                        'hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0'
                                    )}
                                >
                                    {/* Protocol */}
                                    <div className="col-span-1">
                                        <span className={cn(
                                            'inline-flex px-1.5 py-0.5 rounded text-[11px] font-bold uppercase',
                                            getProtocolColor(connection.protocol)
                                        )}>
                                            {connection.protocol}
                                        </span>
                                    </div>

                                    {/* Local address */}
                                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                                        <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="font-mono text-xs text-foreground truncate">
                                            {formatAddress(connection.localAddress, connection.localPort)}
                                        </span>
                                    </div>

                                    {/* Remote address */}
                                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                                        {connection.state === 'LISTEN' ? (
                                            <span className="text-xs text-muted-foreground italic">
                                                (en écoute)
                                            </span>
                                        ) : (
                                            <>
                                                <Globe className={cn(
                                                    'h-3.5 w-3.5 shrink-0',
                                                    isLocalAddress(connection.remoteAddress)
                                                        ? 'text-muted-foreground'
                                                        : 'text-primary'
                                                )} />
                                                <span className="font-mono text-xs text-foreground truncate">
                                                    {formatAddress(connection.remoteAddress, connection.remotePort)}
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    {/* State */}
                                    <div className="col-span-2">
                                        <Badge
                                            status={getStateVariant(connection.state)}
                                            className="text-[11px] px-1.5 py-0"
                                        >
                                            {connection.state}
                                        </Badge>
                                    </div>

                                    {/* Process */}
                                    <div className="col-span-3 flex items-center gap-2 min-w-0">
                                        {connection.processName ? (
                                            <>
                                                <span className="text-sm text-foreground truncate">
                                                    {connection.processName}
                                                </span>
                                                {connection.pid && (
                                                    <span className="text-xs text-muted-foreground">
                                                        ({connection.pid})
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">
                                                Inconnu
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
};

export default AgentNetworkConnections;
