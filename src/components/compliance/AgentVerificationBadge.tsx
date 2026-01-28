import React from 'react';
import { useControlAgentVerification } from '../../hooks/useAgentData';
import { CheckCircle2, XCircle, AlertTriangle, Bot, Clock } from '../ui/Icons';
import { Tooltip } from '../ui/Tooltip';
import { cn } from '../../lib/utils';
import { useStore } from '../../store';

interface AgentVerificationBadgeProps {
    controlId: string;
    framework?: string;
    showLabel?: boolean;
    className?: string;
}

/**
 * Badge component showing if a control has been verified by an agent
 * Shows the verification status, last check time, and evidence link
 */
export const AgentVerificationBadge: React.FC<AgentVerificationBadgeProps> = ({
    controlId,
    framework,
    showLabel = false,
    className
}) => {
    const { t } = useStore();
    const { verified, status, lastCheck } = useControlAgentVerification(controlId, framework);

    if (!verified) {
        return showLabel ? (
            <span className={cn(
                "inline-flex items-center gap-1 text-xs text-muted-foreground dark:text-slate-400",
                className
            )}>
                <Bot className="w-3 h-3" />
                <span>{t('common.agents.verification.notVerified')}</span>
            </span>
        ) : null;
    }

    const getStatusConfig = () => {
        switch (status) {
            case 'pass':
                return {
                    icon: CheckCircle2,
                    color: 'text-green-600 dark:text-green-400',
                    bgColor: 'bg-green-50 dark:bg-green-900/20',
                    borderColor: 'border-green-200 dark:border-green-900/30',
                    label: 'OK'
                };
            case 'fail':
                return {
                    icon: XCircle,
                    color: 'text-red-600 dark:text-red-400',
                    bgColor: 'bg-red-50 dark:bg-red-900/20',
                    borderColor: 'border-red-200 dark:border-red-900/30',
                    label: 'Fail'
                };
            case 'error':
                return {
                    icon: AlertTriangle,
                    color: 'text-yellow-600 dark:text-yellow-400',
                    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
                    borderColor: 'border-yellow-200 dark:border-yellow-900/30',
                    label: 'Error'
                };
            default:
                return {
                    icon: Clock,
                    color: 'text-slate-500 dark:text-slate-300',
                    bgColor: 'bg-slate-50 dark:bg-slate-800/50',
                    borderColor: 'border-border/40 dark:border-slate-700',
                    label: 'N/A'
                };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    const formatLastCheck = (timestamp: string | null) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours}h`;
        return `Il y a ${diffDays}j`;
    };

    const tooltipContent = (
        <div className="text-xs">
            <div className="font-semibold">{t('common.agents.verification.verifiedByAgent')}</div>
            {lastCheck && (
                <div className="text-muted-foreground mt-1">
                    {t('common.agents.verification.lastCheck')}: {formatLastCheck(lastCheck)}
                </div>
            )}
        </div>
    );

    return (
        <Tooltip content={tooltipContent} position="top">
            <span className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-medium transition-colors",
                config.bgColor,
                config.borderColor,
                config.color,
                className
            )}>
                <Bot className="w-3 h-3 opacity-60" />
                <Icon className="w-3.5 h-3.5" />
                {showLabel && <span>{config.label}</span>}
            </span>
        </Tooltip>
    );
};

/**
 * Inline indicator for tables/lists showing agent verification
 */
export const AgentVerificationIndicator: React.FC<{
    controlId: string;
    framework?: string;
}> = ({ controlId, framework }) => {
    const { verified, status } = useControlAgentVerification(controlId, framework);
    const { t } = useStore();

    if (!verified) return null;

    const getStatusColor = () => {
        switch (status) {
            case 'pass': return 'bg-green-500';
            case 'fail': return 'bg-red-500';
            case 'error': return 'bg-yellow-500';
            default: return 'bg-slate-400';
        }
    };

    return (
        <Tooltip content={t('common.agents.verification.verifiedByAgent')} position="top">
            <span className="inline-flex items-center gap-1">
                <Bot className="w-3 h-3 text-brand-500" />
                <span className={cn("w-2 h-2 rounded-full", getStatusColor())} />
            </span>
        </Tooltip>
    );
};

export default AgentVerificationBadge;
