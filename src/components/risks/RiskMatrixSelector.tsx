/**
 * RiskMatrixSelector - Interactive 5x5 risk evaluation matrix (Story 3.2)
 *
 * Displays a visual matrix for selecting impact and probability values.
 * Supports showing both initial and residual risk positions.
 *
 * @module RiskMatrixSelector
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRiskLevelFromScore, calculateRiskScore } from '../../utils/riskEvaluation';
import { RISK_THRESHOLDS } from '../../constants/complianceConfig';

export type { RiskLevel } from '../../utils/riskEvaluation';

interface RiskMatrixSelectorProps {
    /** Current probability value (1-5) */
    probability: number;
    /** Current impact value (1-5) */
    impact: number;
    /** Callback when values change */
    onChange: (probability: number, impact: number) => void;
    /** Optional label for the matrix */
    label?: string;
    /** Residual probability for comparison display */
    residualProbability?: number;
    /** Residual impact for comparison display */
    residualImpact?: number;
    /** Whether the matrix is read-only */
    readOnly?: boolean;
    /** Whether to show the legend */
    showLegend?: boolean;
    /** Whether to show score comparison when residual values exist */
    showComparison?: boolean;
    /** Compact mode for smaller displays */
    compact?: boolean;
}

/**
 * RiskMatrixSelector component for visual risk evaluation.
 *
 * Displays a 5x5 grid where:
 * - Y-axis represents Probability (1-5, bottom to top)
 * - X-axis represents Impact (1-5, left to right)
 * - Colors indicate risk severity (green → red)
 *
 * @example
 * ```tsx
 * <RiskMatrixSelector
 *   probability={3}
 *   impact={4}
 *   onChange={(p, i) => setValues({ probability: p, impact: i })}
 *   residualProbability={2}
 *   residualImpact={3}
 *   showLegend
 * />
 * ```
 */
export const RiskMatrixSelector: React.FC<RiskMatrixSelectorProps> = ({
    probability,
    impact,
    onChange,
    label = "Évaluation du Risque",
    residualProbability,
    residualImpact,
    readOnly = false,
    showLegend = true,
    showComparison = true,
    compact = false
}) => {
    // Calculate scores
    const currentScore = useMemo(() =>
        calculateRiskScore(impact, probability),
        [impact, probability]
    );

    const residualScore = useMemo(() =>
        residualProbability && residualImpact
            ? calculateRiskScore(residualImpact, residualProbability)
            : null,
        [residualImpact, residualProbability]
    );

    const currentLevel = useMemo(() => getRiskLevelFromScore(currentScore), [currentScore]);
    const residualLevel = useMemo(() =>
        residualScore ? getRiskLevelFromScore(residualScore) : null,
        [residualScore]
    );

    // Get cell color based on position
    const getCellColor = (p: number, i: number): string => {
        const score = p * i;
        if (score >= RISK_THRESHOLDS.CRITICAL) return 'bg-error-text';
        if (score >= RISK_THRESHOLDS.HIGH) return 'bg-warning-text';
        if (score >= RISK_THRESHOLDS.MEDIUM) return 'bg-info-text';
        return 'bg-success-text';
    };

    // Check if this cell is the current selection
    const isCurrentPosition = (p: number, i: number): boolean =>
        probability === p && impact === i;

    // Check if this cell is the residual position
    const isResidualPosition = (p: number, i: number): boolean =>
        !!(residualProbability && residualImpact &&
            residualProbability === p && residualImpact === i);

    // Handle cell click
    const handleCellClick = (p: number, i: number) => {
        if (!readOnly) {
            onChange(p, i);
        }
    };

    // Grid size classes
    const gridSize = compact ? 'max-w-[220px]' : 'max-w-[300px]';
    const cellGap = compact ? 'gap-1' : 'gap-1.5';

    return (
        <div className="space-y-4">
            {/* Header with label and score */}
            <div className="flex justify-between items-end">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-muted-foreground">
                    {label}
                </label>
                <div className="text-right">
                    <div className="flex items-center gap-2">
                        {/* Current score */}
                        <div>
                            <span className="text-xs font-medium text-muted-foreground block">
                                {residualScore !== null ? 'Brut' : 'Score'}: {currentScore}
                            </span>
                            <span className={`text-sm font-black uppercase ${currentLevel.textColor}`}>
                                {currentLevel.label}
                            </span>
                        </div>

                        {/* Residual score (if exists) */}
                        {showComparison && residualScore !== null && residualLevel && (
                            <>
                                <span className="text-slate-300 dark:text-slate-300">→</span>
                                <div>
                                    <span className="text-xs font-medium text-muted-foreground block">
                                        Résiduel: {residualScore}
                                    </span>
                                    <span className={`text-sm font-black uppercase ${residualLevel.textColor}`}>
                                        {residualLevel.label}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Matrix Grid */}
            <div className="relative">
                {/* Y-axis label (Probability) */}
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[11px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                    Probabilité
                </div>

                {/* X-axis label (Impact) */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    Impact
                </div>

                {/* Grid */}
                <div className={`grid grid-rows-5 ${cellGap} w-full aspect-square ${gridSize} mx-auto`}>
                    {[5, 4, 3, 2, 1].map(p => (
                        <div key={p || 'unknown'} className={`grid grid-cols-5 ${cellGap}`}>
                            {[1, 2, 3, 4, 5].map(i => {
                                const isCurrent = isCurrentPosition(p, i);
                                const isResidual = isResidualPosition(p, i);
                                const score = p * i;

                                return (
                                    <button
                                        key={`${p || 'unknown'}-${i}`}
                                        type="button"
                                        onClick={() => handleCellClick(p, i)}
                                        disabled={readOnly}
                                        aria-label={`Probabilité ${p}, Impact ${i}, Score ${score}`}
                                        aria-pressed={isCurrent}
                                        className={`
                                            w-full h-full rounded-lg transition-all duration-300 relative
                                            focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500
                                            ${getCellColor(p, i)}
                                            ${isCurrent
                                                ? 'ring-4 ring-offset-2 ring-slate-900/10 dark:ring-white/20 scale-110 z-10 shadow-xl'
                                                : isResidual
                                                    ? 'ring-2 ring-offset-1 ring-blue-500/50 dark:ring-blue-400/50 opacity-80'
                                                    : 'opacity-40 hover:opacity-70 hover:scale-105 hover:shadow-md'}
                                            ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                                        `}
                                        title={`Probabilité: ${p}, Impact: ${i}, Score: ${score}`}
                                    >
                                        {/* Current position marker */}
                                        <AnimatePresence>
                                            {isCurrent && (
                                                <motion.div
                                                    initial={{ scale: 0, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0, opacity: 0 }}
                                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                    className="absolute inset-0 flex items-center justify-center"
                                                >
                                                    <div className="w-3 h-3 bg-white rounded-full shadow-md animate-pulse" />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Residual position marker (if different from current) */}
                                        <AnimatePresence>
                                            {isResidual && !isCurrent && (
                                                <motion.div
                                                    initial={{ scale: 0, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0, opacity: 0 }}
                                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                    className="absolute inset-0 flex items-center justify-center"
                                                >
                                                    <div className="w-2.5 h-2.5 bg-blue-500 dark:bg-blue-400 rounded-full shadow-md ring-2 ring-white" />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Score tooltip on hover */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-70 transition-opacity">
                                            <span className="text-[11px] font-bold text-white drop-shadow-md">
                                                {score}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            {showLegend && (
                <div className="flex justify-center items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 mt-4">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-success-text" />
                        <span>Faible (1-4)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-info-text" />
                        <span>Moyen (5-9)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-warning-text" />
                        <span>Élevé (10-14)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-error-text" />
                        <span>Critique (15-25)</span>
                    </div>
                </div>
            )}

            {/* Position markers legend (when residual exists) */}
            {residualScore !== null && (
                <div className="flex justify-center items-center gap-4 text-[11px] text-slate-500 dark:text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 bg-white rounded-full shadow ring-2 ring-slate-300" />
                        <span>Position brute</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-white" />
                        <span>Position résiduelle</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RiskMatrixSelector;
