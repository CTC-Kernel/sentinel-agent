/**
 * AgentEvidencePanel
 *
 * Panel displaying agent-collected evidence for compliance controls.
 * Shows evidence status, confidence scores, and verification details.
 * Apple-style design with glassmorphism effects.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../ui/animationVariants';
import {
    AgentEvidence,
    ControlEvidenceSummary,
    AGENT_CHECK_DEFINITIONS,
    AgentCheckId,
} from '../../types/agentEvidence';
import { AgentEvidenceService } from '../../services/AgentEvidenceService';
import { useStore } from '../../store';
import {
    Shield, ShieldCheck, ShieldAlert, Clock, Check, X,
    AlertTriangle, RefreshCw, Eye, ChevronRight, Server
} from '../ui/Icons';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/Tooltip';
import { cn } from '../../lib/utils';

interface AgentEvidencePanelProps {
    controlId: string;
    controlCode: string;
    controlName: string;
    className?: string;
    onEvidenceClick?: (evidence: AgentEvidence) => void;
}

// Confidence gauge component
const ConfidenceGauge: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({
    score,
    size = 'md'
}) => {
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-16 h-16',
    };

    const strokeWidth = size === 'sm' ? 3 : size === 'md' ? 4 : 5;
    const radius = size === 'sm' ? 12 : size === 'md' ? 18 : 24;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    const getColor = () => {
        if (score >= 80) return 'stroke-success';
        if (score >= 50) return 'stroke-warning';
        return 'stroke-destructive';
    };

    return (
        <div className={cn('relative', sizeClasses[size])}>
            <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
                <circle
                    cx="24"
                    cy="24"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-muted/30"
                />
                <circle
                    cx="24"
                    cy="24"
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className={cn('transition-all duration-500', getColor())}
                />
            </svg>
            <span className={cn(
                'absolute inset-0 flex items-center justify-center font-bold',
                size === 'sm' ? 'text-[9px]' : size === 'md' ? 'text-xs' : 'text-sm',
                getColor().replace('stroke-', 'text-')
            )}>
                {score}%
            </span>
        </div>
    );
};

// Status icon component
const StatusIcon: React.FC<{ status: AgentEvidence['status']; className?: string }> = ({
    status,
    className
}) => {
    switch (status) {
        case 'pass':
            return <ShieldCheck className={cn('text-success', className)} />;
        case 'fail':
            return <ShieldAlert className={cn('text-destructive', className)} />;
        case 'error':
            return <AlertTriangle className={cn('text-warning', className)} />;
        default:
            return <Shield className={cn('text-muted-foreground', className)} />;
    }
};

// Format relative time
const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'À l\'instant';
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days}j`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

// Evidence row component
interface EvidenceRowProps {
    evidence: AgentEvidence;
    onClick?: () => void;
}

const EvidenceRow: React.FC<EvidenceRowProps> = ({ evidence, onClick }) => {
    const checkDef = AGENT_CHECK_DEFINITIONS[evidence.checkId];

    return (
        <motion.div
            variants={slideUpVariants}
            onClick={onClick}
            className={cn(
                'group flex items-center gap-3 p-3 rounded-xl border border-border/30',
                'bg-card/50 hover:bg-card hover:border-border transition-all duration-200',
                onClick && 'cursor-pointer hover:shadow-apple-sm'
            )}
        >
            {/* Status icon */}
            <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                evidence.status === 'pass' ? 'bg-success/10' :
                evidence.status === 'fail' ? 'bg-destructive/10' : 'bg-warning/10'
            )}>
                <StatusIcon status={evidence.status} className="h-4 w-4" />
            </div>

            {/* Check info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">
                        {checkDef?.name || evidence.checkId}
                    </span>
                    <Badge
                        status={evidence.status === 'pass' ? 'success' : evidence.status === 'fail' ? 'error' : 'warning'}
                        className="text-[9px] px-1.5 py-0"
                    >
                        {evidence.status === 'pass' ? 'Conforme' : evidence.status === 'fail' ? 'Non conforme' : 'Erreur'}
                    </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                        <Server className="h-3 w-3" />
                        Agent {evidence.agentId.slice(0, 8)}
                    </span>
                    <span>•</span>
                    <span>{evidence.articleReference}</span>
                </div>
            </div>

            {/* Confidence & time */}
            <div className="flex items-center gap-3 shrink-0">
                <Tooltip content={`Confiance: ${evidence.confidenceScore}%`} position="top">
                    <div>
                        <ConfidenceGauge score={evidence.confidenceScore} size="sm" />
                    </div>
                </Tooltip>
                <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(evidence.verifiedAt)}
                </div>
                {onClick && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </div>
        </motion.div>
    );
};

// Summary stats card
interface SummaryCardProps {
    summary: ControlEvidenceSummary;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ summary }) => {
    const statusConfig = {
        verified: { label: 'Vérifié', color: 'text-success', bg: 'bg-success/10', icon: ShieldCheck },
        partial: { label: 'Partiel', color: 'text-warning', bg: 'bg-warning/10', icon: AlertTriangle },
        non_compliant: { label: 'Non conforme', color: 'text-destructive', bg: 'bg-destructive/10', icon: ShieldAlert },
        pending: { label: 'En attente', color: 'text-muted-foreground', bg: 'bg-muted', icon: Shield },
    };

    const config = statusConfig[summary.complianceStatus];
    const Icon = config.icon;

    return (
        <div className="glass-panel rounded-2xl p-4 border border-border/50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', config.bg)}>
                        <Icon className={cn('h-6 w-6', config.color)} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={cn('font-bold text-lg', config.color)}>
                                {config.label}
                            </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {summary.totalEvidence} preuves collectées
                        </span>
                    </div>
                </div>
                <ConfidenceGauge score={summary.averageConfidence} size="lg" />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/30">
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-success">
                        <Check className="h-4 w-4" />
                        <span className="text-lg font-bold">{summary.passingEvidence}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Conformes</span>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-destructive">
                        <X className="h-4 w-4" />
                        <span className="text-lg font-bold">{summary.failingEvidence}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Non conformes</span>
                </div>
                <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <Server className="h-4 w-4" />
                        <span className="text-lg font-bold">{summary.agentIds.length}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Agents</span>
                </div>
            </div>
        </div>
    );
};

// Empty state
const EmptyState: React.FC = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-muted-foreground" />
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-1">
            Aucune preuve agent
        </h4>
        <p className="text-xs text-muted-foreground max-w-xs">
            Déployez des agents Sentinel pour collecter automatiquement des preuves de conformité.
        </p>
    </div>
);

// Loading skeleton
const LoadingSkeleton: React.FC = () => (
    <div className="space-y-4 animate-pulse">
        <div className="h-32 bg-muted/50 rounded-2xl" />
        <div className="space-y-2">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted/50 rounded-xl" />
            ))}
        </div>
    </div>
);

export const AgentEvidencePanel: React.FC<AgentEvidencePanelProps> = ({
    controlId,
    controlCode,
    controlName,
    className,
    onEvidenceClick
}) => {
    const { user } = useStore();
    const [evidence, setEvidence] = useState<AgentEvidence[]>([]);
    const [summary, setSummary] = useState<ControlEvidenceSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Subscribe to evidence
    useEffect(() => {
        if (!user?.organizationId) return;

        // Note: loading is initialized to true, no need to set it here

        const unsubscribe = AgentEvidenceService.subscribeToControlEvidence(
            user.organizationId,
            controlId,
            (evidenceList) => {
                setEvidence(evidenceList);
                setLoading(false);
            },
            (error) => {
                console.error('Failed to load evidence:', error);
                setLoading(false);
            }
        );

        return unsubscribe;
    }, [user?.organizationId, controlId]);

    // Load summary
    useEffect(() => {
        const organizationId = user?.organizationId;
        if (!organizationId) return;

        const loadSummary = async () => {
            try {
                const summaryData = await AgentEvidenceService.getControlEvidenceSummary(
                    organizationId,
                    controlId,
                    controlCode,
                    controlName
                );
                setSummary(summaryData);
            } catch (error) {
                console.error('Failed to load evidence summary:', error);
            }
        };

        loadSummary();
    }, [user?.organizationId, controlId, controlCode, controlName, evidence]);

    // Handle refresh
    const handleRefresh = async () => {
        setRefreshing(true);
        // In production, this would trigger a re-scan on agents
        await new Promise(resolve => setTimeout(resolve, 1000));
        setRefreshing(false);
    };

    // Group evidence by check (for future use in expanded view)
    const _evidenceByCheck = useMemo(() => {
        const groups = new Map<AgentCheckId, AgentEvidence[]>();
        for (const e of evidence) {
            const existing = groups.get(e.checkId) || [];
            groups.set(e.checkId, [...existing, e]);
        }
        return groups;
    }, [evidence]);
    void _evidenceByCheck; // Suppress unused variable warning - reserved for future grouped view

    if (loading) {
        return <LoadingSkeleton />;
    }

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className={cn('space-y-4', className)}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-foreground">Preuves Agent</h3>
                    <p className="text-xs text-muted-foreground">
                        Collecte automatique via Sentinel Agent
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="h-8 gap-2"
                >
                    <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                    <span className="hidden sm:inline">Rafraîchir</span>
                </Button>
            </div>

            {evidence.length === 0 ? (
                <EmptyState />
            ) : (
                <>
                    {/* Summary card */}
                    {summary && (
                        <motion.div variants={slideUpVariants}>
                            <SummaryCard summary={summary} />
                        </motion.div>
                    )}

                    {/* Evidence list */}
                    <motion.div
                        variants={staggerContainerVariants}
                        className="space-y-2"
                    >
                        <AnimatePresence mode="popLayout">
                            {evidence.slice(0, 10).map((e) => (
                                <EvidenceRow
                                    key={e.id}
                                    evidence={e}
                                    onClick={onEvidenceClick ? () => onEvidenceClick(e) : undefined}
                                />
                            ))}
                        </AnimatePresence>
                    </motion.div>

                    {/* Show more */}
                    {evidence.length > 10 && (
                        <div className="text-center pt-2">
                            <Button variant="ghost" size="sm" className="gap-2">
                                <Eye className="h-4 w-4" />
                                Voir les {evidence.length - 10} autres preuves
                            </Button>
                        </div>
                    )}
                </>
            )}
        </motion.div>
    );
};

export default AgentEvidencePanel;
