import React from 'react';
import { Risk } from '../../types';
import { motion } from 'framer-motion';

interface RiskHeatmapProps {
    risks: Risk[];
}

export const RiskHeatmap: React.FC<RiskHeatmapProps> = ({ risks }) => {

    // 1. Aggregate risks by coordinate (p, i)
    const matrixData = React.useMemo(() => {
        const grid = Array(6).fill(null).map(() => Array(6).fill(0)); // 1-based indexing for ease
        risks.forEach(r => {
            if (r.probability >= 1 && r.probability <= 5 && r.impact >= 1 && r.impact <= 5) {
                grid[r.probability][r.impact] += 1;
            }
        });
        return grid;
    }, [risks]);

    const getCellColor = (p: number, i: number) => {
        const score = p * i;
        // Using Tailwind classes that match SENTINEL_PALETTE indirectly or SEVERITY_COLORS
        // These mimic the RiskMatrixSelector colors for consistency
        if (score >= 15) return 'bg-rose-500/90 dark:bg-rose-600/90'; // Critical
        if (score >= 10) return 'bg-orange-500/90 dark:bg-orange-600/90'; // High
        if (score >= 5) return 'bg-amber-400/90 dark:bg-amber-500/90'; // Medium
        return 'bg-emerald-500/90 dark:bg-emerald-600/90'; // Low
    };

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="relative">
                {/* Y-Axis Label */}
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center w-32">
                    Probabilité
                </div>

                {/* X-Axis Label */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center w-32">
                    Impact
                </div>

                {/* The Grid */}
                <div className="grid grid-rows-5 gap-1.5">
                    {[5, 4, 3, 2, 1].map(p => (
                        <div key={`row-${p}`} className="grid grid-cols-5 gap-1.5">
                            {[1, 2, 3, 4, 5].map(i => {
                                const count = matrixData[p][i];
                                const hasData = count > 0;
                                const cellColor = getCellColor(p, i);

                                return (
                                    <motion.div
                                        key={`${p}-${i}`}
                                        className={`
                                            w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center
                                            text-xs font-bold transition-all
                                            ${hasData
                                                ? `${cellColor} text-white shadow-sm scale-100`
                                                : 'bg-slate-100 dark:bg-white/5 text-transparent scale-[0.95]'
                                            }
                                        `}
                                        whileHover={hasData ? { scale: 1.1, zIndex: 10 } : undefined}
                                        title={`Prob: ${p}, Imp: ${i} | ${count} Risques`}
                                    >
                                        <span className={hasData ? 'visible' : 'invisible'}>
                                            {count}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-8 flex gap-4 text-[10px] font-medium text-slate-500 dark:text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-emerald-500" /> Faible
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-amber-400" /> Moyen
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-orange-500" /> Élevé
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-rose-500" /> Critique
                </div>
            </div>
        </div>
    );
};
