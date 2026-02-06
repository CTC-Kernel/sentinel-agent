/**
 * AgentHealthGrid
 *
 * Real-time grid view of agent health status with Apple-style design.
 * Displays agents as cards with live status indicators and key metrics.
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';
import { SentinelAgent, AgentCheckResult } from '../../types/agent';
import { computeScoreFromResults } from '../../utils/agentUtils';
import {
    Monitor, Apple, Server, Cpu, HardDrive,
    Activity, Shield, Clock, MoreVertical,
    Eye, Settings, Trash2, RefreshCw, Stethoscope
} from '../ui/Icons';
import { Badge } from '../ui/Badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { useStore } from '../../store';
import { hasPermission } from '../../utils/permissions';
import { getLocaleConfig, type SupportedLocale } from '../../config/localeConfig';
import i18n from '../../i18n';
import { useTranslation } from 'react-i18next';

interface AgentHealthGridProps {
    agents: SentinelAgent[];
    onAgentClick?: (agent: SentinelAgent) => void;
    onAgentAction?: (agent: SentinelAgent, action: 'view' | 'configure' | 'refresh' | 'delete') => void;
    viewMode?: 'grid' | 'compact';
    complianceResults?: Map<string, AgentCheckResult[]>;
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

// Format bytes to human readable
const formatBytes = (bytes: number | undefined): string => {
    if (bytes === undefined || bytes === null) return '-';
    if (bytes === 0) return '0 B';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
};

// Format last seen time
const formatLastSeen = (dateStr: string, t: (key: string, options?: { defaultValue: string }) => string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (seconds < 60) return t('agent.justNow', { defaultValue: "À l'instant" });
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}j`;
    return date.toLocaleDateString(getLocaleConfig(i18n.language as SupportedLocale).intlLocale, { day: '2-digit', month: 'short' });
};

// Format relative time for offline agents
const formatRelativeTime = (isoDate: string | undefined, t: (key: string, options?: { defaultValue: string }) => string) => {
    if (!isoDate) return t('agent.unknown', { defaultValue: 'Inconnu' });
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return t('agent.agoMinutes', { defaultValue: `il y a ${mins} min` });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('agent.agoHours', { defaultValue: `il y a ${hours}h` });
    const days = Math.floor(hours / 24);
    return t('agent.agoDays', { defaultValue: `il y a ${days}j` });
};

// Score color based on value
const getScoreColor = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return 'text-muted-foreground';
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
};

// Agent Health Card Component
interface AgentHealthCardProps {
    agent: SentinelAgent;
    onClick?: () => void;
    onAction?: (action: 'view' | 'configure' | 'refresh' | 'delete') => void;
    compact?: boolean;
    reliableScore?: number | null;
    canUpdate?: boolean;
    canDelete?: boolean;
    t: (key: string, options?: { defaultValue: string }) => string;
}

const AgentHealthCard: React.FC<AgentHealthCardProps> = ({
    agent,
    onClick,
    onAction,
    compact = false,
    reliableScore,
    canUpdate = true,
    canDelete = true,
    t,
}) => {
    const isActive = agent.status === 'active';
    const hasMetrics = agent.cpuPercent !== undefined || agent.memoryBytes !== undefined;
    // Use reliable score (computed from results) when available, fallback to agent-reported
    const displayScore = reliableScore !== undefined ? reliableScore : agent.complianceScore;

    if (compact) {
        // Compact row view
        return (
            <motion.div
                variants={slideUpVariants}
                onClick={onClick}
                onKeyDown={(e) => {
                    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onClick();
                    }
                }}
                role={onClick ? "button" : undefined}
                tabIndex={onClick ? 0 : undefined}
                aria-label={`${agent.hostname || agent.name || agent.id.slice(0, 8)} - ${agent.status}`}
                className={cn(
                    'group flex items-center gap-3 p-3 rounded-2xl border border-border/40',
                    'bg-background/50 backdrop-blur-sm hover:bg-card hover:border-border/60',
                    'transition-all duration-200 cursor-pointer hover:shadow-apple-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'
                )}
            >
                {/* Status indicator + OS */}
                <div className="relative">
                    <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center',
                        'bg-muted/50 group-hover:bg-muted transition-colors'
                    )}>
                        <OSIcon os={agent.os} className="w-4 h-4 text-foreground" />
                    </div>
                    <div
                        role="img"
                        aria-label={isActive ? t('agent.active', { defaultValue: 'Actif' }) : t('agent.offline', { defaultValue: 'Hors ligne' })}
                        className={cn(
                            'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card',
                            isActive ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                        )} />
                </div>

                {/* Name + hostname */}
                <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-foreground truncate block">
                        {agent.name || agent.hostname || agent.id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-muted-foreground truncate block">
                        {agent.ipAddress || agent.hostname}
                    </span>
                    {agent.status === 'offline' && (
                        <span
                            className="text-xs text-warning font-medium block cursor-help"
                            title={t('agent.offlineTooltip', { defaultValue: "L'agent ne répond plus. Vérifiez qu'il est en cours d'exécution et que la connexion réseau est active. Heartbeat attendu toutes les ~60s." })}
                        >
                            {t('agent.seenAgo', { defaultValue: 'Vu' })} {formatRelativeTime(agent.lastHeartbeat, t)} — {t('agent.offline', { defaultValue: 'hors ligne' })}
                        </span>
                    )}
                </div>

                {/* Metrics (if available) */}
                {hasMetrics && (
                    <div className="hidden sm:flex items-center gap-3 text-xs">
                        {agent.cpuPercent !== undefined && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Cpu className="h-3 w-3" />
                                <span className={cn(
                                    agent.cpuPercent > 80 ? 'text-destructive font-medium' :
                                        agent.cpuPercent > 60 ? 'text-warning' : ''
                                )}>
                                    {agent.cpuPercent.toFixed(0)}%
                                </span>
                            </div>
                        )}
                        {(agent.memoryPercent !== undefined || agent.memoryBytes !== undefined) && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <HardDrive className="h-3 w-3" />
                                <span className={cn(
                                    agent.memoryPercent !== undefined && agent.memoryPercent > 85 ? 'text-destructive font-medium' :
                                        agent.memoryPercent !== undefined && agent.memoryPercent > 70 ? 'text-warning' : ''
                                )}>
                                    {agent.memoryPercent !== undefined
                                        ? `${agent.memoryPercent.toFixed(0)}%`
                                        : formatBytes(agent.memoryBytes)}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Score */}
                {displayScore !== undefined && displayScore !== null && (
                    <div className={cn('text-sm font-bold', getScoreColor(displayScore))}>
                        {displayScore}%
                    </div>
                )}

                {/* Last seen */}
                <div className="text-xs text-muted-foreground hidden md:block">
                    {formatLastSeen(agent.lastHeartbeat, t)}
                </div>

                {/* Status badge */}
                <Badge
                    status={isActive ? 'success' : 'neutral'}
                    className="hidden lg:inline-flex text-xs"
                >
                    {isActive ? t('agent.active', { defaultValue: 'Actif' }) : t('agent.offlineStatus', { defaultValue: 'Offline' })}
                </Badge>
            </motion.div>
        );
    }

    // Grid card view
    return (
        <motion.div
            variants={slideUpVariants}
            className={cn(
                'group relative rounded-3xl border overflow-hidden',
                'bg-background/80 backdrop-blur-sm transition-all duration-300',
                'hover:shadow-apple-md hover:-translate-y-0.5',
                isActive ? 'border-border/40 hover:border-success/40' : 'border-border/30 opacity-80'
            )}
        >
            {/* Header */}
            <div className="p-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                    {onClick && (
                        <button
                            onClick={onClick}
                            className="absolute inset-0 z-0 w-full h-full bg-transparent border-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-3xl"
                            aria-label={`${agent.hostname || agent.name || agent.id.slice(0, 8)} - ${agent.status}`}
                        />
                    )}
                    <div className="flex items-center gap-3">
                        {/* OS Icon with status */}
                        <div className="relative">
                            <div className={cn(
                                'w-11 h-11 rounded-3xl flex items-center justify-center',
                                'bg-muted/50 group-hover:bg-muted transition-colors'
                            )}>
                                <OSIcon os={agent.os} className="w-5 h-5 text-foreground" />
                            </div>
                            <div className={cn(
                                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card',
                                isActive ? 'bg-success' : 'bg-muted-foreground'
                            )}>
                                {isActive && (
                                    <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
                                )}
                            </div>
                        </div>

                        {/* Name + version */}
                        <div className="min-w-0">
                            <h3 className="font-semibold text-foreground truncate text-sm">
                                {agent.name || agent.hostname || agent.id.slice(0, 8)}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="outline" className="text-xs px-1.5 py-0 h-4">
                                    v{agent.version}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    {agent.osVersion || agent.os}
                                </span>
                            </div>
                            {agent.status === 'offline' && (
                                <div className="flex items-center gap-1 mt-1">
                                    <Clock className="h-3 w-3 text-warning" />
                                    <span className="text-xs text-warning font-medium">
                                        {t('agent.seenAgo', { defaultValue: 'Vu' })} {formatRelativeTime(agent.lastHeartbeat, t)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                className="relative z-decorator h-7 w-7 p-0 rounded-md opacity-70 md:opacity-0 md:group-hover:opacity-70 transition-opacity flex items-center justify-center hover:bg-muted"
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                aria-label={`Actions pour ${agent.hostname || agent.name || agent.id.slice(0, 8)}`}
                            >
                                <MoreVertical className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => onAction?.('view')}>
                                <Eye className="h-4 w-4 mr-2" />
                                Voir détails
                            </DropdownMenuItem>
                            {canUpdate && (
                                <DropdownMenuItem onClick={() => onAction?.('configure')}>
                                    <Settings className="h-4 w-4 mr-2" />
                                    Configurer
                                </DropdownMenuItem>
                            )}
                            {canUpdate && !isActive && agent.status === 'offline' && (
                                <DropdownMenuItem onClick={() => onAction?.('configure')}>
                                    <Stethoscope className="h-4 w-4 mr-2" />
                                    Diagnostiquer
                                </DropdownMenuItem>
                            )}
                            {canUpdate && isActive && (
                                <DropdownMenuItem onClick={() => onAction?.('refresh')}>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Rafraîchir
                                </DropdownMenuItem>
                            )}
                            {canDelete && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => onAction?.('delete')}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Supprimer
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Metrics */}
            <div className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                    {/* CPU */}
                    <div className="p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <Cpu className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className={cn(
                            'text-sm font-bold',
                            agent.cpuPercent !== undefined && agent.cpuPercent > 80 ? 'text-destructive' :
                                agent.cpuPercent !== undefined && agent.cpuPercent > 60 ? 'text-warning' : 'text-foreground'
                        )}>
                            {agent.cpuPercent !== undefined ? `${agent.cpuPercent.toFixed(0)}%` : '-'}
                        </span>
                        <span className="block text-xs text-muted-foreground uppercase tracking-wider">CPU</span>
                    </div>

                    {/* Memory - show percentage like CPU, with used/total as sublabel */}
                    <div className="p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <HardDrive className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className={cn(
                            'text-sm font-bold',
                            agent.memoryPercent !== undefined && agent.memoryPercent > 85 ? 'text-destructive' :
                                agent.memoryPercent !== undefined && agent.memoryPercent > 70 ? 'text-warning' : 'text-foreground'
                        )}>
                            {agent.memoryPercent !== undefined
                                ? `${agent.memoryPercent.toFixed(0)}%`
                                : agent.memoryBytes !== undefined
                                    ? formatBytes(agent.memoryBytes)
                                    : '-'}
                        </span>
                        <span className="block text-xs text-muted-foreground uppercase tracking-wider">RAM</span>
                    </div>

                    {/* Compliance */}
                    <div className="p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <Shield className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className={cn('text-sm font-bold', getScoreColor(displayScore))}>
                            {displayScore !== undefined && displayScore !== null
                                ? `${displayScore}%`
                                : '-'}
                        </span>
                        <span className="block text-xs text-muted-foreground uppercase tracking-wider">Score</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatLastSeen(agent.lastHeartbeat, t)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {agent.ipAddress}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// Empty state component
const EmptyState: React.FC = () => (
    <motion.div
        variants={slideUpVariants}
        className="flex flex-col items-center justify-center py-16 text-center"
    >
        <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-4">
            <Activity className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
            Aucun agent à afficher
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
            Déployez des agents Sentinel sur vos endpoints pour les voir apparaître ici en temps réel.
        </p>
    </motion.div>
);

export const AgentHealthGrid: React.FC<AgentHealthGridProps> = ({
    agents,
    onAgentClick,
    onAgentAction,
    viewMode = 'grid',
    complianceResults
}) => {
    const { t } = useTranslation();
    const { user } = useStore();
    const canUpdate = hasPermission(user, 'Agent', 'update');
    const canDelete = hasPermission(user, 'Agent', 'delete');
    // Compute reliable scores from actual results
    const reliableScores = useMemo(() => {
        const scores = new Map<string, number | null>();
        agents.forEach(a => {
            const results = complianceResults?.get(a.id);
            const computed = results ? computeScoreFromResults(results) : null;
            scores.set(a.id, computed ?? a.complianceScore ?? null);
        });
        return scores;
    }, [agents, complianceResults]);
    // Sort agents: active first, then by last heartbeat
    const sortedAgents = useMemo(() => {
        return [...agents].sort((a, b) => {
            // Active agents first
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (a.status !== 'active' && b.status === 'active') return 1;
            // Then by last heartbeat (most recent first)
            return new Date(b.lastHeartbeat).getTime() - new Date(a.lastHeartbeat).getTime();
        });
    }, [agents]);

    if (agents.length === 0) {
        return <EmptyState />;
    }

    if (viewMode === 'compact') {
        return (
            <motion.div
                variants={staggerContainerVariants}
                initial="initial"
                animate="visible"
                className="flex flex-col gap-2"
            >
                {sortedAgents.map((agent) => (
                    <AgentHealthCard
                        key={agent.id || 'unknown'}
                        agent={agent}
                        compact
                        reliableScore={reliableScores.get(agent.id)}
                        onClick={() => onAgentClick?.(agent)}
                        onAction={(action) => onAgentAction?.(agent, action)}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        t={t}
                    />
                ))}
            </motion.div>
        );
    }

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
            <AnimatePresence mode="popLayout">
                {sortedAgents.map((agent) => (
                    <AgentHealthCard
                        key={agent.id || 'unknown'}
                        agent={agent}
                        reliableScore={reliableScores.get(agent.id)}
                        onClick={() => onAgentClick?.(agent)}
                        onAction={(action) => onAgentAction?.(agent, action)}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        t={t}
                    />
                ))}
            </AnimatePresence>
        </motion.div>
    );
};

export default AgentHealthGrid;
