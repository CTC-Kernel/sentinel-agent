import React from 'react';
import { Risk } from '../../types';
import { motion } from 'framer-motion';
import { RISK_THRESHOLDS } from '../../constants/complianceConfig';
import { useLocale } from '@/hooks/useLocale';

interface RiskHeatmapProps {
    risks: Risk[];
}

export const RiskHeatmap: React.FC<RiskHeatmapProps> = ({ risks }) => {
    const { t } = useLocale();

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
        // Using semantic tokens for consistency
        if (score >= RISK_THRESHOLDS.CRITICAL) return 'bg-error-text/90 dark:bg-error-text/80'; // Critical
        if (score >= RISK_THRESHOLDS.HIGH) return 'bg-warning-text/90 dark:bg-warning-text/80'; // High
        if (score >= RISK_THRESHOLDS.MEDIUM) return 'bg-info-text/90 dark:bg-info-text/80'; // Medium
        return 'bg-success-text/90 dark:bg-success-text/80'; // Low
    };

    const getCellSeverityLabel = (p: number, i: number) => {
        const score = p * i;
        if (score >= RISK_THRESHOLDS.CRITICAL) return t('risks.matrix.legend.critical', { defaultValue: 'Critique' });
        if (score >= RISK_THRESHOLDS.HIGH) return t('risks.matrix.legend.high', { defaultValue: 'Élevé' });
        if (score >= RISK_THRESHOLDS.MEDIUM) return t('risks.matrix.legend.medium', { defaultValue: 'Moyen' });
        return t('risks.matrix.legend.low', { defaultValue: 'Faible' });
    };

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="relative">
                {/* Y-Axis Label */}
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest text-center w-32">
                    {t('risks.matrix.probabilityAxis', { defaultValue: 'Probabilité' })}
                </div>

                {/* X-Axis Label */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[11px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest text-center w-32">
                    {t('risks.matrix.impactAxis', { defaultValue: 'Impact' })}
                </div>

                {/* The Grid */}
                <div className="grid grid-rows-5 gap-1.5">
                    {[5, 4, 3, 2, 1].map(p => (
                        <div key={`row-${p || 'unknown'}`} className="grid grid-cols-5 gap-1.5">
                            {[1, 2, 3, 4, 5].map(i => {
                                const count = matrixData[p][i];
                                const hasData = count > 0;
                                const cellColor = getCellColor(p, i);

                                return (
                                    <motion.div
                                        key={`${p || 'unknown'}-${i}`}
                                        className={`
                                            w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center
                                            text-xs font-bold transition-all
                                            ${hasData
                                                ? `${cellColor} text-white shadow-sm scale-100`
                                                : 'bg-slate-100 dark:bg-white/5 text-transparent scale-[0.95]'
                                            }
                                        `}
                                        whileHover={hasData ? { scale: 1.1, zIndex: 10 } : undefined}
                                        title={`${t('risks.matrix.probabilityAxis')}: ${p}, ${t('risks.matrix.impactAxis')}: ${i} | ${count} ${t('risks.matrix.risksLabel')}`}
                                        aria-label={`${getCellSeverityLabel(p, i)}: ${count} ${t('common.risks', { defaultValue: 'risque' })}${count !== 1 ? 's' : ''}, ${t('risks.matrix.probabilityAxis')} ${p}, ${t('risks.matrix.impactAxis')} ${i}`}
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
            <div className="mt-8 flex gap-4 text-[11px] font-medium text-slate-500 dark:text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-success-text" /> {t('risks.matrix.legend.low', { defaultValue: 'Faible' })}
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-info-text" /> {t('risks.matrix.legend.medium', { defaultValue: 'Moyen' })}
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-warning-text" /> {t('risks.matrix.legend.high', { defaultValue: 'Élevé' })}
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded bg-error-text" /> {t('risks.matrix.legend.critical', { defaultValue: 'Critique' })}
                </div>
            </div>
        </div>
    );
};
