import React, { useState } from 'react';
import { Monitor, CheckCircle2, AlertTriangle, WifiOff, Settings, ExternalLink } from '../../ui/Icons';
import { Skeleton } from '../../ui/Skeleton';
import { Tooltip as CustomTooltip } from '../../ui/Tooltip';
import { DashboardCard } from '../DashboardCard';
import { useAgentData } from '../../../hooks/useAgentData';
import { cn } from '../../../lib/utils';
import { validateUrl } from '../../../utils/urlValidation';

interface AgentStatusWidgetProps {
    navigate: (path: string) => void;
    t: (key: string) => string;
}

export const AgentStatusWidget: React.FC<AgentStatusWidgetProps> = React.memo(({ navigate, t }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const {
        activeAgents,
        offlineAgents,
        errorAgents,
        averageComplianceScore,
        checkResultsSummary,
        hasAgents,
        agents,
        loading
    } = useAgentData();

    // Status color based on agent health
    const getStatusColor = () => {
        if (errorAgents > 0) return 'bg-red-500';
        if (offlineAgents > 0) return 'bg-orange-500 animate-pulse';
        if (activeAgents > 0) return 'bg-emerald-500';
        return 'bg-slate-400';
    };

    const getStatusBgColor = () => {
        if (errorAgents > 0) return 'bg-red-500/10';
        if (offlineAgents > 0) return 'bg-orange-500/10';
        if (activeAgents > 0) return 'bg-emerald-500/10';
        return 'bg-slate-500/10';
    };

    const getStatusMessage = () => {
        if (errorAgents > 0) return t('agents.widget.hasErrors');
        if (offlineAgents > 0) return t('agents.widget.someOffline');
        if (activeAgents > 0) return t('agents.widget.allHealthy');
        return t('agents.widget.noAgents');
    };

    const displayAgents = isExpanded ? agents : agents.slice(0, 4);

    const handleManageClick = () => {
        const safeUrl = validateUrl('/settings?tab=agents');
        if (safeUrl) navigate(safeUrl);
    };

    return (
        <DashboardCard
            title={t('agents.widget.title')}
            subtitle={t('agents.widget.subtitle')}
            icon={<Monitor className="w-5 h-5" />}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            expandable={agents.length > 4}
            headerAction={
                <CustomTooltip content={getStatusMessage()} position="left">
                    <div className={`p-1.5 rounded-lg ${getStatusBgColor()}`}>
                        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                    </div>
                </CustomTooltip>
            }
        >
            <div className="p-4 h-full overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-16 w-full rounded-2xl" />
                        <Skeleton className="h-24 w-full rounded-2xl" />
                    </div>
                ) : !hasAgents ? (
                    <div className="flex flex-col items-center justify-center p-6 bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200/50 dark:border-slate-700/30 backdrop-blur-sm">
                        <Monitor className="h-10 w-10 text-slate-400 dark:text-slate-500 mb-3" />
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 text-center">
                            {t('agents.widget.noAgentsInstalled')}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
                            {t('agents.widget.installDescription')}
                        </span>
                        <button
                            onClick={handleManageClick}
                            className="mt-4 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            {t('agents.widget.installNow')}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-2">
                            <CustomTooltip content={t('agents.widget.activeTooltip')} position="top">
                                <div className="flex flex-col items-center p-3 bg-emerald-50/80 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mb-1" />
                                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{activeAgents}</span>
                                    <span className="text-[10px] font-semibold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wide">
                                        {t('agents.status.active')}
                                    </span>
                                </div>
                            </CustomTooltip>

                            <CustomTooltip content={t('agents.widget.offlineTooltip')} position="top">
                                <div className="flex flex-col items-center p-3 bg-orange-50/80 dark:bg-orange-900/20 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                                    <WifiOff className="h-5 w-5 text-orange-600 dark:text-orange-400 mb-1" />
                                    <span className="text-lg font-black text-orange-700 dark:text-orange-300">{offlineAgents}</span>
                                    <span className="text-[10px] font-semibold text-orange-600/70 dark:text-orange-400/70 uppercase tracking-wide">
                                        {t('agents.status.offline')}
                                    </span>
                                </div>
                            </CustomTooltip>

                            <CustomTooltip content={t('agents.widget.errorTooltip')} position="top">
                                <div className="flex flex-col items-center p-3 bg-red-50/80 dark:bg-red-900/20 rounded-2xl border border-red-100 dark:border-red-900/30">
                                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mb-1" />
                                    <span className="text-lg font-black text-red-700 dark:text-red-300">{errorAgents}</span>
                                    <span className="text-[10px] font-semibold text-red-600/70 dark:text-red-400/70 uppercase tracking-wide">
                                        {t('agents.status.error')}
                                    </span>
                                </div>
                            </CustomTooltip>
                        </div>

                        {/* Compliance Score */}
                        {averageComplianceScore !== null && (
                            <div className="p-4 bg-gradient-to-r from-brand-50 to-indigo-50 dark:from-brand-900/20 dark:to-indigo-900/20 rounded-2xl border border-brand-100 dark:border-brand-900/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">
                                            {t('agents.widget.machineCompliance')}
                                        </span>
                                        <div className="flex items-baseline gap-1 mt-1">
                                            <span className="text-2xl font-black text-brand-700 dark:text-brand-300">
                                                {averageComplianceScore}%
                                            </span>
                                            <span className="text-xs text-brand-500 dark:text-brand-400">
                                                {t('agents.widget.avgScore')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                            {t('agents.widget.checkResults')}
                                        </div>
                                        <div className="flex gap-2 text-xs font-semibold">
                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                {checkResultsSummary.pass} {t('agents.checks.pass')}
                                            </span>
                                            <span className="text-red-600 dark:text-red-400">
                                                {checkResultsSummary.fail} {t('agents.checks.fail')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Agent List */}
                        <div className="space-y-2">
                            {displayAgents.map(agent => (
                                <div
                                    key={agent.id}
                                    className={cn(
                                        "flex items-center p-3 rounded-xl border transition-all hover:scale-[1.01]",
                                        agent.status === 'active'
                                            ? "bg-white/80 dark:bg-slate-800/50 border-slate-200/50 dark:border-slate-700/30"
                                            : agent.status === 'offline'
                                            ? "bg-orange-50/50 dark:bg-orange-900/10 border-orange-200/50 dark:border-orange-900/30"
                                            : "bg-red-50/50 dark:bg-red-900/10 border-red-200/50 dark:border-red-900/30"
                                    )}
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                                        agent.os === 'windows' ? "bg-blue-100 dark:bg-blue-900/30" :
                                        agent.os === 'darwin' ? "bg-slate-100 dark:bg-slate-800" :
                                        "bg-orange-100 dark:bg-orange-900/30"
                                    )}>
                                        <Monitor className={cn(
                                            "w-4 h-4",
                                            agent.os === 'windows' ? "text-blue-600 dark:text-blue-400" :
                                            agent.os === 'darwin' ? "text-slate-600 dark:text-slate-400" :
                                            "text-orange-600 dark:text-orange-400"
                                        )} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block truncate">
                                            {agent.name || agent.hostname || agent.id}
                                        </span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">
                                            {agent.os === 'windows' ? 'Windows' : agent.os === 'darwin' ? 'macOS' : 'Linux'}
                                            {agent.osVersion && ` ${agent.osVersion}`}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        {agent.complianceScore !== null && agent.complianceScore !== undefined && (
                                            <span className={cn(
                                                "text-sm font-bold",
                                                agent.complianceScore >= 80 ? "text-emerald-600 dark:text-emerald-400" :
                                                agent.complianceScore >= 60 ? "text-orange-600 dark:text-orange-400" :
                                                "text-red-600 dark:text-red-400"
                                            )}>
                                                {agent.complianceScore}%
                                            </span>
                                        )}
                                        <div className={cn(
                                            "w-2 h-2 rounded-full ml-auto mt-1",
                                            agent.status === 'active' ? "bg-emerald-500" :
                                            agent.status === 'offline' ? "bg-orange-500" :
                                            "bg-red-500"
                                        )} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Show more indicator */}
                        {!isExpanded && agents.length > 4 && (
                            <div className="text-center">
                                <button
                                    className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none p-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus-visible:ring-brand-500 rounded"
                                    onClick={() => setIsExpanded(true)}
                                >
                                    +{agents.length - 4} {t('common.more').toLowerCase()}
                                </button>
                            </div>
                        )}

                        {/* Manage Link */}
                        <button
                            onClick={handleManageClick}
                            className="w-full flex items-center justify-center gap-2 p-3 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-colors"
                        >
                            <Settings className="w-4 h-4" />
                            {t('agents.widget.manage')}
                            <ExternalLink className="w-3 h-3 ml-1" />
                        </button>
                    </div>
                )}
            </div>
        </DashboardCard>
    );
});

AgentStatusWidget.displayName = 'AgentStatusWidget';
