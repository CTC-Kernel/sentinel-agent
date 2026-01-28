import React from 'react';
import { Control } from '../../../types';
import { Clock, TrendingUp, ShieldAlert, Bot } from '../../ui/Icons';
import {
    CONTROL_STATUS,
    PARTIAL_CONTROL_WEIGHT,
    isActionableStatus,
} from '../../../constants/complianceConfig';
import { useAgentResultsByControl } from '../../../hooks/useAgentData';
import { Tooltip } from '../../ui/Tooltip';

interface ComplianceScoreCardProps {
    controls: Control[];
    currentFramework: string;
    trend?: number;
    onFilterChange?: (status: string | null) => void;
}

export const ComplianceScoreCard: React.FC<ComplianceScoreCardProps> = ({
    controls,
    currentFramework,
    trend,
    onFilterChange
}) => {
    // Agent verification data
    const agentResults = useAgentResultsByControl(currentFramework);
    const agentVerifiedControls = React.useMemo(() => {
        return controls.filter(c => agentResults.has(c.code)).length;
    }, [controls, agentResults]);

    // Calculate metrics using centralized constants (harmonized with Cloud Function)
    const implementedControls = controls.filter(c => c.status === CONTROL_STATUS.IMPLEMENTED).length;
    const partialControls = controls.filter(c => c.status === CONTROL_STATUS.PARTIAL).length;
    const inProgressControls = controls.filter(c => c.status === CONTROL_STATUS.IN_PROGRESS).length;
    const notImplementedControls = controls.filter(c => c.status === CONTROL_STATUS.NOT_STARTED).length;

    // Calculate actionable controls using centralized helper
    const actionableControls = controls.filter(c => isActionableStatus(c.status)).length;

    // Harmonized Score Formula: (Implemented + (Partial × 0.5)) / Actionable × 100
    const globalScore = actionableControls > 0
        ? ((implementedControls + (partialControls * PARTIAL_CONTROL_WEIGHT)) / actionableControls * 100)
        : 0;

    // Framework specific scores (Harmonized with Cloud Function)
    const calculateScore = (fw: string) => {
        const fwControls = controls.filter(c => c.framework === fw);
        if (fwControls.length === 0) return 0;

        const fwActionable = fwControls.filter(c => isActionableStatus(c.status)).length;
        if (fwActionable === 0) return 0;

        const fwImplemented = fwControls.filter(c => c.status === CONTROL_STATUS.IMPLEMENTED).length;
        const fwPartial = fwControls.filter(c => c.status === CONTROL_STATUS.PARTIAL).length;

        return ((fwImplemented + (fwPartial * PARTIAL_CONTROL_WEIGHT)) / fwActionable) * 100;
    };

    const isoScore = calculateScore('ISO27001');
    const rgpdScore = calculateScore('GDPR');
    const doraScore = calculateScore('DORA');

    return (
        <div className="glass-premium p-6 md:p-8 rounded-3xl shadow-lg flex flex-col xl:flex-row gap-8 relative overflow-hidden group hover:shadow-apple transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/20 dark:bg-brand-400/15 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>

            {/* Left: Global Score */}
            <div className="flex items-center gap-6 md:p-8 min-w-[240px] z-10">
                <div className="relative flex-shrink-0 group/ring">
                    <svg className="w-24 h-24 transform -rotate-90 overflow-visible" viewBox="-14 -14 124 124">
                        <circle className="text-muted-foreground/10" strokeWidth="6" stroke="currentColor" fill="transparent" r="42" cx="48" cy="48" />
                        <circle
                            className="text-brand-600 transition-all duration-1000 ease-out"
                            strokeWidth="6"
                            strokeDasharray={263.89}
                            strokeDashoffset={263.89 - (263.89 * globalScore) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="42"
                            cx="48"
                            cy="48"
                            style={{ filter: 'drop-shadow(0 0 4px currentColor)' }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-black text-foreground">{globalScore.toFixed(0)}%</span>
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-foreground">Score {currentFramework}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Conformité moyenne</p>
                    {trend !== undefined && (
                        <div className={`text-xs font-bold mt-2 px-2.5 py-1 rounded-lg w-fit inline-flex items-center gap-1 ${trend >= 0 ? 'bg-success-bg text-success-text border border-success-border/30' : 'bg-error-bg text-error-text border border-error-border/30'}`}>
                            <TrendingUp className="w-3.5 h-3.5" />
                            {trend > 0 ? '+' : ''}{trend}% vs 30j
                        </div>
                    )}
                </div>
            </div>

            {/* Middle: Frameworks Mini-Cards */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-w-0">
                {(currentFramework === 'ISO27001' || isoScore > 0) && (
                    <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 border border-border/40 dark:border-white/5 flex flex-col justify-between hover:scale-105 transition-transform duration-300">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">ISO 27001</span>
                            <span className="text-sm font-black text-blue-600 dark:text-blue-400">{Math.round(isoScore)}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${isoScore}%` }}></div>
                        </div>
                    </div>
                )}
                {(currentFramework === 'GDPR' || rgpdScore > 0) && (
                    <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 border border-border/40 dark:border-white/5 flex flex-col justify-between hover:scale-105 transition-transform duration-300">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">RGPD</span>
                            <span className="text-sm font-black text-purple-600 dark:text-purple-400">{Math.round(rgpdScore)}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-info-text rounded-full transition-all duration-1000 ease-out" style={{ width: `${rgpdScore}%` }}></div>
                        </div>
                    </div>
                )}
                {(currentFramework === 'DORA' || doraScore > 0) && (
                    <div className="bg-slate-50/50 dark:bg-white/5 rounded-2xl p-4 border border-border/40 dark:border-white/5 flex flex-col justify-between hover:scale-105 transition-transform duration-300">
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">DORA</span>
                            <span className="text-sm font-black text-green-600 dark:text-green-400">{Math.round(doraScore)}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-success-text rounded-full transition-all duration-1000 ease-out" style={{ width: `${doraScore}%` }}></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Quick Stats */}
            <div className="flex flex-wrap md:flex-nowrap xl:flex-col gap-3 min-w-0">
                {/* Agent Verified Controls */}
                {agentVerifiedControls > 0 && (
                    <Tooltip content="Contrôles vérifiés automatiquement par les agents Sentinel" position="top">
                        <div className="flex-1 flex items-center justify-between px-4 py-3 bg-brand-50 dark:bg-brand-800 rounded-2xl border border-brand-200 dark:border-brand-700">
                            <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                                <span className="text-xs font-bold text-brand-600 dark:text-brand-400">Agent</span>
                            </div>
                            <span className="text-lg font-black text-brand-600 dark:text-brand-400">{agentVerifiedControls}</span>
                        </div>
                    </Tooltip>
                )}

                <div
                    onClick={() => onFilterChange?.(CONTROL_STATUS.NOT_STARTED)}
                    onKeyDown={(e) => e.key === 'Enter' && onFilterChange?.(CONTROL_STATUS.NOT_STARTED)}
                    role="button"
                    tabIndex={0}
                    className="flex-1 flex items-center justify-between px-4 py-3 bg-error-bg rounded-2xl border border-error-border/50 cursor-pointer hover:shadow-apple-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-error-text"
                >
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-error-text" />
                        <span className="text-xs font-bold text-error-text/70">Alertes</span>
                    </div>
                    <span className="text-lg font-black text-error-text">{notImplementedControls}</span>
                </div>

                <div
                    onClick={() => onFilterChange?.(CONTROL_STATUS.IN_PROGRESS)}
                    onKeyDown={(e) => e.key === 'Enter' && onFilterChange?.(CONTROL_STATUS.IN_PROGRESS)}
                    role="button"
                    tabIndex={0}
                    className="flex-1 flex items-center justify-between px-4 py-3 bg-warning-bg rounded-2xl border border-warning-border/50 cursor-pointer hover:shadow-apple-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-text"
                >
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-warning-text" />
                        <span className="text-xs font-bold text-warning-text/70">En cours</span>
                    </div>
                    <span className="text-lg font-black text-warning-text">{inProgressControls}</span>
                </div>

                <div
                    onClick={() => onFilterChange?.(CONTROL_STATUS.PARTIAL)}
                    onKeyDown={(e) => e.key === 'Enter' && onFilterChange?.(CONTROL_STATUS.PARTIAL)}
                    role="button"
                    tabIndex={0}
                    className="flex-1 flex items-center justify-between px-4 py-3 bg-info-bg rounded-2xl border border-info-border/50 cursor-pointer hover:shadow-apple-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-info-text"
                >
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-info-text" />
                        <span className="text-xs font-bold text-info-text/70">Partiel</span>
                    </div>
                    <span className="text-lg font-black text-info-text">{partialControls}</span>
                </div>
            </div>
        </div>
    );
};
