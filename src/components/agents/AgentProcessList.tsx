/**
 * AgentProcessList
 *
 * Sortable process list component for agent live view.
 * Displays top 50 processes with CPU%, memory, PID, name.
 * Includes search and column sorting functionality.
 * Apple Activity Monitor-inspired design.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { AgentProcess } from '../../types/agent';
import { Search, ArrowUpDown, Activity, AlertTriangle } from '../ui/Icons';
import { Input } from '../ui/input';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface AgentProcessListProps {
    processes: AgentProcess[];
    loading?: boolean;
    className?: string;
    maxItems?: number;
}

type SortField = 'name' | 'cpuPercent' | 'memoryPercent' | 'pid';
type SortDirection = 'asc' | 'desc';

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

// Get status color
const getStatusColor = (status: AgentProcess['status']): 'success' | 'warning' | 'error' | 'neutral' => {
    switch (status) {
        case 'running': return 'success';
        case 'sleeping': return 'neutral';
        case 'stopped': return 'warning';
        case 'zombie': return 'error';
        default: return 'neutral';
    }
};

// Progress bar component for usage
const UsageBar: React.FC<{ value: number; variant?: 'cpu' | 'memory' }> = ({ value, variant = 'cpu' }) => {
    const getColor = () => {
        if (value > 80) return 'bg-destructive';
        if (value > 60) return 'bg-warning';
        return variant === 'cpu' ? 'bg-primary' : 'bg-success';
    };

    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all duration-300', getColor())}
                    style={{ width: `${Math.min(value, 100)}%` }}
                />
            </div>
            <span className={cn(
                'text-xs font-mono tabular-nums',
                value > 80 ? 'text-destructive font-semibold' :
                    value > 60 ? 'text-warning' : 'text-muted-foreground'
            )}>
                {value.toFixed(1)}%
            </span>
        </div>
    );
};

// Column header with sort indicator
interface ColumnHeaderProps {
    label: string;
    field: SortField;
    currentSort: SortField;
    direction: SortDirection;
    onSort: (field: SortField) => void;
    className?: string;
}

const ColumnHeader: React.FC<ColumnHeaderProps> = ({
    label, field, currentSort, direction, onSort, className
}) => (
    <button
        onClick={() => onSort(field)}
        className={cn(
            'flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground',
            'hover:text-foreground transition-colors',
            currentSort === field && 'text-foreground',
            className
        )}
    >
        {label}
        <ArrowUpDown className={cn(
            'h-3 w-3',
            currentSort === field ? 'opacity-70' : 'opacity-30'
        )} />
        {currentSort === field && (
            <span className="text-[11px]">{direction === 'asc' ? '↑' : '↓'}</span>
        )}
    </button>
);

export const AgentProcessList: React.FC<AgentProcessListProps> = ({
    processes,
    loading,
    className,
    maxItems = 50
}) => {
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<SortField>('cpuPercent');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Handle sort
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Validate and normalize process data for reliability
    // Individual processes cannot exceed 100% CPU usage
    const normalizedProcesses = useMemo(() => {
        return processes.map(process => ({
            ...process,
            cpuPercent: Math.min(100, Math.max(0, process.cpuPercent)),
            memoryPercent: Math.min(100, Math.max(0, process.memoryPercent))
        }));
    }, [processes]);

    // Filter and sort processes
    const filteredProcesses = useMemo(() => {
        let result = [...normalizedProcesses];

        // Filter by search
        if (search) {
            const searchLower = search.toLowerCase();
            result = result.filter(p =>
                p.name.toLowerCase().includes(searchLower) ||
                p.pid.toString().includes(searchLower) ||
                p.user?.toLowerCase().includes(searchLower)
            );
        }

        // Sort
        result.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'cpuPercent':
                    comparison = a.cpuPercent - b.cpuPercent;
                    break;
                case 'memoryPercent':
                    comparison = a.memoryPercent - b.memoryPercent;
                    break;
                case 'pid':
                    comparison = a.pid - b.pid;
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return result.slice(0, maxItems);
    }, [normalizedProcesses, search, sortField, sortDirection, maxItems]);

    // Stats
    // NOTE: CPU values are validated to never exceed 100% for reliability
    // Individual processes are capped at 100% as they cannot exceed this limit
    const stats = useMemo(() => {
        const validProcesses = normalizedProcesses.filter((p: AgentProcess) => p.cpuPercent >= 0);
        const totalCpu = validProcesses.reduce((sum: number, p: AgentProcess) => sum + p.cpuPercent, 0);
        const totalMemory = normalizedProcesses.reduce((sum: number, p: AgentProcess) => sum + p.memoryBytes, 0);
        const highCpuCount = normalizedProcesses.filter((p: AgentProcess) => p.cpuPercent > 80).length;
        return { totalCpu, totalMemory, highCpuCount, total: normalizedProcesses.length };
    }, [normalizedProcesses]);

    if (loading) {
        return (
            <div className={cn('space-y-4 animate-pulse', className)}>
                <div className="h-10 bg-muted/50 rounded-lg w-64" />
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
            {/* Header with search and stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher un processus..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 w-64"
                        />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                            <strong className="text-foreground">{stats.total}</strong> processus
                        </span>
                        {stats.highCpuCount > 0 && (
                            <span className="flex items-center gap-1 text-warning">
                                <AlertTriangle className="h-3 w-3" />
                                {stats.highCpuCount} haute conso
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                        <span className="text-muted-foreground">CPU Total:</span>
                        <span className="font-bold text-foreground">{stats.totalCpu.toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground ml-1" title="Somme des processus validés (max 100% par processus)">ⓘ</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Mémoire:</span>
                        <span className="font-bold text-foreground">{formatBytes(stats.totalMemory)}</span>
                    </div>
                </div>
            </div>

            {/* Process table */}
            <div className="glass-premium rounded-2xl border border-border/50 overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-muted/30 border-b border-border/50">
                    <ColumnHeader
                        label="Processus"
                        field="name"
                        currentSort={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="col-span-4"
                    />
                    <ColumnHeader
                        label="PID"
                        field="pid"
                        currentSort={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="col-span-1"
                    />
                    <div className="col-span-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Statut
                    </div>
                    <ColumnHeader
                        label="CPU"
                        field="cpuPercent"
                        currentSort={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="col-span-3"
                    />
                    <ColumnHeader
                        label="Mémoire"
                        field="memoryPercent"
                        currentSort={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="col-span-3"
                    />
                </div>

                {/* Table body */}
                <div className="max-h-[400px] overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                        {filteredProcesses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                                <Activity className="h-8 w-8 opacity-30" />
                                <span>{search ? 'Aucun processus trouvé' : 'Liste des processus non disponible'}</span>
                                {!search && (
                                    <span className="text-xs opacity-70">
                                        La collecte des processus sera disponible dans une prochaine version
                                    </span>
                                )}
                            </div>
                        ) : (
                            filteredProcesses.map((process, index) => (
                                <motion.div
                                    key={`${process.pid || 'unknown'}-${process.name || 'unknown'}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ delay: index * 0.02 }}
                                    className={cn(
                                        'grid grid-cols-12 gap-4 px-4 py-3 items-center',
                                        'hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0',
                                        process.cpuPercent > 80 && 'bg-destructive/5'
                                    )}
                                >
                                    {/* Process name */}
                                    <div className="col-span-4 flex items-center gap-2 min-w-0">
                                        <div
                                            role="img"
                                            aria-label={process.status === 'running' ? 'En cours' : process.status === 'sleeping' ? 'En veille' : process.status === 'zombie' ? 'Zombie' : 'Arrêté'}
                                            className={cn(
                                            'w-2 h-2 rounded-full shrink-0',
                                            process.status === 'running' ? 'bg-success' :
                                                process.status === 'sleeping' ? 'bg-muted-foreground' :
                                                    process.status === 'zombie' ? 'bg-destructive' : 'bg-warning'
                                        )} />
                                        <span className="font-medium text-sm text-foreground truncate">
                                            {process.name}
                                        </span>
                                        {process.user && (
                                            <span className="text-xs text-muted-foreground truncate">
                                                ({process.user})
                                            </span>
                                        )}
                                    </div>

                                    {/* PID */}
                                    <div className="col-span-1">
                                        <span className="font-mono text-xs text-muted-foreground">
                                            {process.pid}
                                        </span>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-1">
                                        <Badge
                                            status={getStatusColor(process.status)}
                                            className="text-[11px] px-1.5 py-0"
                                        >
                                            {process.status === 'running' ? 'Actif' :
                                                process.status === 'sleeping' ? 'Veille' :
                                                    process.status === 'stopped' ? 'Arrêté' : 'Zombie'}
                                        </Badge>
                                    </div>

                                    {/* CPU */}
                                    <div className="col-span-3">
                                        <UsageBar value={process.cpuPercent} variant="cpu" />
                                    </div>

                                    {/* Memory */}
                                    <div className="col-span-3">
                                        <div className="flex items-center gap-2">
                                            <UsageBar value={process.memoryPercent} variant="memory" />
                                            <span className="text-xs text-muted-foreground hidden lg:block">
                                                {formatBytes(process.memoryBytes)}
                                            </span>
                                        </div>
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

export default AgentProcessList;
