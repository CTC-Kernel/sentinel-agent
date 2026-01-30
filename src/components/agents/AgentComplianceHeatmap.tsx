/**
 * AgentComplianceHeatmap
 *
 * Matrix visualization showing agents vs compliance checks.
 * Color-coded cells indicate pass/fail/pending status for each check.
 * Apple-style design with smooth animations and tooltips.
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { SentinelAgent, AgentCheckResult } from '../../types/agent';
import {
    Monitor, Apple, Server, Shield, CheckCircle2, XCircle,
    AlertCircle, Clock, ChevronRight, Info
} from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/Tooltip';
import { cn } from '../../lib/utils';

interface AgentComplianceHeatmapProps {
    agents: SentinelAgent[];
    results?: Map<string, AgentCheckResult[]>; // agentId -> results
    onCellClick?: (agentId: string, checkId: string) => void;
    onAgentClick?: (agent: SentinelAgent) => void;
    maxAgentsDisplay?: number;
}

// Compliance checks matching the 11 built-in agent checks
const DEFAULT_CHECKS = [
    { id: 'disk_encryption', name: 'Chiffrement Disque', category: 'Storage' },
    { id: 'firewall', name: 'Firewall', category: 'Network' },
    { id: 'antivirus', name: 'Antivirus', category: 'Security' },
    { id: 'mfa', name: 'MFA', category: 'Auth' },
    { id: 'password_policy', name: 'Politique MDP', category: 'Auth' },
    { id: 'system_updates', name: 'MAJ Système', category: 'Patches' },
    { id: 'session_lock', name: 'Verrouillage', category: 'Access' },
    { id: 'remote_access', name: 'Accès Distant', category: 'Network' },
    { id: 'backup', name: 'Sauvegarde', category: 'Data' },
    { id: 'admin_accounts', name: 'Comptes Admin', category: 'Auth' },
    { id: 'obsolete_protocols', name: 'Protocoles Obs.', category: 'Network' },
];

type CheckStatus = 'pass' | 'fail' | 'pending' | 'unknown';

// Cell status colors
const STATUS_COLORS: Record<CheckStatus, { bg: string; text: string; border: string }> = {
    pass: {
        bg: 'bg-success/20 hover:bg-success/30',
        text: 'text-success',
        border: 'border-success/30',
    },
    fail: {
        bg: 'bg-destructive/20 hover:bg-destructive/30',
        text: 'text-destructive',
        border: 'border-destructive/30',
    },
    pending: {
        bg: 'bg-warning/20 hover:bg-warning/30',
        text: 'text-warning',
        border: 'border-warning/30',
    },
    unknown: {
        bg: 'bg-muted/50 hover:bg-muted/70',
        text: 'text-muted-foreground',
        border: 'border-border/50',
    },
};

// Status icon component
const StatusIcon: React.FC<{ status: CheckStatus; className?: string }> = ({ status, className }) => {
    const iconClass = cn('h-3 w-3', className);
    switch (status) {
        case 'pass':
            return <CheckCircle2 className={iconClass} />;
        case 'fail':
            return <XCircle className={iconClass} />;
        case 'pending':
            return <Clock className={iconClass} />;
        default:
            return <AlertCircle className={iconClass} />;
    }
};

// OS Icon component - using darwin for macOS
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

// Get check status from real results
const getCheckStatus = (
    agent: SentinelAgent,
    checkId: string,
    results?: AgentCheckResult[]
): CheckStatus => {
    // Use actual results if available
    if (results && results.length > 0) {
        const result = results.find(r => r.checkId === checkId);
        if (result) {
            if (result.status === 'pass') return 'pass';
            if (result.status === 'fail') return 'fail';
            if (result.status === 'error') return 'pending';
            return 'unknown';
        }
    }

    // No result for this check — agent hasn't reported it yet
    if (agent.status === 'offline') return 'unknown';
    return 'unknown';
};

// Get status label for tooltip
const getStatusLabel = (status: CheckStatus): string => {
    switch (status) {
        case 'pass': return 'Conforme';
        case 'fail': return 'Non conforme';
        case 'pending': return 'En attente';
        default: return 'Non vérifié';
    }
};

// Heatmap Cell Component
interface HeatmapCellProps {
    status: CheckStatus;
    agentName: string;
    checkName: string;
    onClick?: () => void;
}

const HeatmapCell: React.FC<HeatmapCellProps> = ({ status, agentName, checkName, onClick }) => {
    const colors = STATUS_COLORS[status];

    return (
        <Tooltip
            content={
                <div className="text-xs">
                    <div className="font-semibold mb-1">{checkName}</div>
                    <div className="text-muted-foreground">{agentName}</div>
                    <div className={cn('mt-1 font-medium', colors.text)}>
                        {getStatusLabel(status)}
                    </div>
                </div>
            }
            position="top"
        >
            <button
                onClick={onClick}
                className={cn(
                    'w-8 h-8 rounded-md flex items-center justify-center',
                    'border transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-brand-400',
                    colors.bg,
                    colors.border
                )}
            >
                <StatusIcon status={status} className={colors.text} />
            </button>
        </Tooltip>
    );
};

// Summary Stats Component
interface SummaryStatsProps {
    agents: SentinelAgent[];
    checks: typeof DEFAULT_CHECKS;
    getStatus: (agent: SentinelAgent, checkId: string) => CheckStatus;
}

const SummaryStats: React.FC<SummaryStatsProps> = ({ agents, checks, getStatus }) => {
    const stats = useMemo(() => {
        let pass = 0;
        let fail = 0;
        let pending = 0;
        let unknown = 0;

        agents.forEach(agent => {
            checks.forEach(check => {
                const status = getStatus(agent, check.id);
                switch (status) {
                    case 'pass': pass++; break;
                    case 'fail': fail++; break;
                    case 'pending': pending++; break;
                    default: unknown++;
                }
            });
        });

        const total = pass + fail + pending + unknown;
        return {
            pass,
            fail,
            pending,
            unknown,
            passRate: total > 0 ? Math.round((pass / total) * 100) : 0,
        };
    }, [agents, checks, getStatus]);

    return (
        <div className="flex items-center gap-4 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-success/30 border border-success/50" />
                <span className="text-muted-foreground">Conforme</span>
                <span className="font-bold text-foreground">{stats.pass}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-destructive/30 border border-destructive/50" />
                <span className="text-muted-foreground">Non conforme</span>
                <span className="font-bold text-foreground">{stats.fail}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-warning/30 border border-warning/50" />
                <span className="text-muted-foreground">En attente</span>
                <span className="font-bold text-foreground">{stats.pending}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
                <span className="text-muted-foreground">Taux de conformité:</span>
                <Badge
                    status={stats.passRate >= 80 ? 'success' : stats.passRate >= 60 ? 'warning' : 'error'}
                >
                    {stats.passRate}%
                </Badge>
            </div>
        </div>
    );
};

export const AgentComplianceHeatmap: React.FC<AgentComplianceHeatmapProps> = ({
    agents,
    results,
    onCellClick,
    onAgentClick,
    maxAgentsDisplay = 10,
}) => {
    const [showAll, setShowAll] = useState(false);

    // Displayed agents (limited or all)
    const displayedAgents = useMemo(() => {
        const sorted = [...agents].sort((a, b) => {
            // Active first, then by score
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (a.status !== 'active' && b.status === 'active') return 1;
            return (b.complianceScore ?? 0) - (a.complianceScore ?? 0);
        });
        return showAll ? sorted : sorted.slice(0, maxAgentsDisplay);
    }, [agents, showAll, maxAgentsDisplay]);

    const hasMore = agents.length > maxAgentsDisplay;

    // Get check status for an agent
    const getStatus = (agent: SentinelAgent, checkId: string): CheckStatus => {
        const agentResults = results?.get(agent.id);
        return getCheckStatus(agent, checkId, agentResults);
    };

    if (agents.length === 0) {
        return (
            <motion.div
                variants={slideUpVariants}
                className="flex flex-col items-center justify-center py-12 text-center"
            >
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Shield className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                    Aucune donnée de conformité
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Déployez des agents pour voir la matrice de conformité.
                </p>
            </motion.div>
        );
    }

    return (
        <motion.div
            variants={slideUpVariants}
            className="glass-premium rounded-2xl border border-border/50 overflow-hidden"
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/50 bg-muted/20">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-sm font-bold text-foreground">Matrice de Conformité</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Vue d'ensemble des checks par agent
                        </p>
                    </div>
                    <Tooltip
                        content="Cette matrice affiche l'état de conformité de chaque agent pour les différents contrôles de sécurité."
                        position="left"
                    >
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </Tooltip>
                </div>
                <SummaryStats agents={displayedAgents} checks={DEFAULT_CHECKS} getStatus={getStatus} />
            </div>

            {/* Heatmap Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    {/* Header Row - Check Names */}
                    <thead>
                        <tr className="border-b border-border/30">
                            <th className="sticky left-0 bg-card z-10 px-4 py-3 text-left">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Agent
                                </span>
                            </th>
                            {DEFAULT_CHECKS.map((check) => (
                                <th key={check.id} className="px-1 py-3 text-center">
                                    <Tooltip
                                        content={
                                            <div className="text-xs">
                                                <div className="font-semibold">{check.name}</div>
                                                <div className="text-muted-foreground">{check.category}</div>
                                            </div>
                                        }
                                        position="top"
                                    >
                                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap max-w-[60px] truncate block cursor-help">
                                            {check.name.split(' ')[0]}
                                        </span>
                                    </Tooltip>
                                </th>
                            ))}
                            <th className="px-4 py-3 text-center">
                                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                    Score
                                </span>
                            </th>
                        </tr>
                    </thead>

                    {/* Body - Agent Rows */}
                    <tbody>
                        {displayedAgents.map((agent) => (
                            <tr
                                key={agent.id}
                                className={cn(
                                    'border-b border-border/20 transition-colors',
                                    'hover:bg-muted/30'
                                )}
                            >
                                {/* Agent Name Cell */}
                                <td className="sticky left-0 bg-card z-10 px-4 py-2">
                                    <button
                                        onClick={() => onAgentClick?.(agent)}
                                        className="flex items-center gap-2 group text-left"
                                    >
                                        <div className="relative">
                                            <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center">
                                                <OSIcon os={agent.os} className="w-3.5 h-3.5 text-foreground" />
                                            </div>
                                            <div className={cn(
                                                'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card',
                                                agent.status === 'active' ? 'bg-success' : 'bg-muted-foreground'
                                            )} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-foreground truncate max-w-[120px] group-hover:text-brand-500 transition-colors">
                                                {agent.name || agent.hostname || agent.id.slice(0, 8)}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                                                {agent.ipAddress}
                                            </div>
                                        </div>
                                        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity" />
                                    </button>
                                </td>

                                {/* Check Status Cells */}
                                {DEFAULT_CHECKS.map((check) => (
                                    <td key={check.id} className="px-1 py-2 text-center">
                                        <div className="flex items-center justify-center">
                                            <HeatmapCell
                                                status={getStatus(agent, check.id)}
                                                agentName={agent.name || agent.hostname || agent.id.slice(0, 8)}
                                                checkName={check.name}
                                                onClick={() => onCellClick?.(agent.id, check.id)}
                                            />
                                        </div>
                                    </td>
                                ))}

                                {/* Score Cell */}
                                <td className="px-4 py-2 text-center">
                                    <span className={cn(
                                        'text-sm font-bold',
                                        agent.complianceScore !== undefined && agent.complianceScore !== null
                                            ? agent.complianceScore >= 80
                                                ? 'text-success'
                                                : agent.complianceScore >= 60
                                                    ? 'text-warning'
                                                    : 'text-destructive'
                                            : 'text-muted-foreground'
                                    )}>
                                        {agent.complianceScore !== undefined && agent.complianceScore !== null
                                            ? `${agent.complianceScore}%`
                                            : '-'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Show More Button */}
            {hasMore && (
                <div className="px-5 py-3 border-t border-border/30 bg-muted/10">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAll(!showAll)}
                        className="w-full text-xs"
                    >
                        {showAll
                            ? `Afficher moins`
                            : `Afficher ${agents.length - maxAgentsDisplay} agents supplémentaires`
                        }
                    </Button>
                </div>
            )}
        </motion.div>
    );
};

export default AgentComplianceHeatmap;
