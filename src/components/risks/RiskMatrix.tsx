import React from 'react';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { Risk } from '../../types';

interface RiskMatrixProps {
    risks: Risk[];
    matrixFilter: { p: number; i: number } | null;
    setMatrixFilter: (filter: { p: number; i: number } | null) => void;
    frameworkFilter: string;
}

export const RiskMatrix: React.FC<RiskMatrixProps> = ({ risks, matrixFilter, setMatrixFilter, frameworkFilter }) => {

    // Helper within the component to count risks per cell
    const getRisksForCell = (prob: number, impact: number) =>
        risks.filter(r => r.probability === prob && r.impact === impact && (!frameworkFilter || r.framework === frameworkFilter));

    const PROBABILITY_LABELS = [
        { val: 5, label: "Très Élevé", sub: "Certain" },
        { val: 4, label: "Élevé", sub: "Probable" },
        { val: 3, label: "Moyen", sub: "Possible" },
        { val: 2, label: "Faible", sub: "Improbable" },
        { val: 1, label: "Très Faible", sub: "Rare" },
    ];

    const IMPACT_LABELS = [
        { val: 1, label: "Négligeable", sub: "" },
        { val: 2, label: "Mineur", sub: "" },
        { val: 3, label: "Modéré", sub: "" },
        { val: 4, label: "Majeur", sub: "" },
        { val: 5, label: "Critique", sub: "" },
    ];

    return (
        <div className="w-full">
            <div className="relative z-10 w-full mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 tracking-tight">Matrice des Risques</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Analyse cartographique selon la norme {frameworkFilter || 'ISO 27005'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] md:text-xs font-medium bg-white/50 dark:bg-white/5 p-2 rounded-xl backdrop-blur-md border border-white/20 dark:border-white/5">
                    <span className="flex items-center px-2 py-1 rounded-lg"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-2 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>Critique (15-25)</span>
                    <span className="flex items-center px-2 py-1 rounded-lg"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-2 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></span>Élevé (10-14)</span>
                    <span className="flex items-center px-2 py-1 rounded-lg"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 mr-2 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></span>Moyen (5-9)</span>
                    <span className="flex items-center px-2 py-1 rounded-lg"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>Faible (1-4)</span>
                </div>
            </div>

            <div className="relative p-6 lg:p-10 bg-slate-50/50 dark:bg-black/20 rounded-[2rem] border border-slate-200/50 dark:border-white/5 shadow-inner overflow-x-auto">
                <div className="min-w-[700px] grid grid-cols-[auto_1fr] gap-4 lg:gap-8 justify-items-center">

                    {/* Y-Axis Label */}
                    <div className="flex flex-col justify-center items-center w-8 md:w-16 lg:w-24 relative">
                        <div className="-rotate-90 font-bold text-xs text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap absolute -left-8 lg:-left-6 top-1/2 -translate-y-1/2">
                            Probabilité
                        </div>
                        <div className="grid grid-rows-5 gap-3 md:gap-4 w-full h-full">
                            {PROBABILITY_LABELS.map(label => (
                                <div key={label.val} className="flex flex-col justify-center items-end w-full pr-4">
                                    <span className="text-xs lg:text-sm font-bold text-slate-700 dark:text-slate-300 text-right leading-tight">{label.label}</span>
                                    {label.sub && <span className="text-[10px] text-slate-400 text-right">{label.sub}</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col w-full items-center">
                        {/* Grid */}
                        <div className="grid grid-rows-5 grid-cols-5 gap-3 md:gap-4 w-full max-w-2xl">
                            {PROBABILITY_LABELS.map(probObj => {
                                const prob = probObj.val;
                                return (
                                    <React.Fragment key={prob}>
                                        {IMPACT_LABELS.map(impactObj => {
                                            const impact = impactObj.val;
                                            const cellRisks = getRisksForCell(prob, impact);
                                            const hasRisks = cellRisks.length > 0;
                                            const isSelected = matrixFilter?.p === prob && matrixFilter?.i === impact;
                                            const score = prob * impact;

                                            // Determine styles based on score
                                            let bgClass = 'bg-slate-100 dark:bg-white/5';
                                            let borderClass = 'border-slate-200 dark:border-white/10';

                                            if (score >= 15) { bgClass = 'bg-rose-500/10 dark:bg-rose-500/20'; borderClass = 'border-rose-500/30'; }
                                            else if (score >= 10) { bgClass = 'bg-orange-500/10 dark:bg-orange-500/20'; borderClass = 'border-orange-500/30'; }
                                            else if (score >= 5) { bgClass = 'bg-amber-400/10 dark:bg-amber-400/20'; borderClass = 'border-amber-400/30'; }
                                            else if (hasRisks) { bgClass = 'bg-emerald-500/10 dark:bg-emerald-500/20'; borderClass = 'border-emerald-500/30'; }

                                            return (
                                                <CustomTooltip key={`${prob}-${impact}`} content={`Prob: ${prob}, Impact: ${impact}, ${cellRisks.length} Risques (Score: ${score})`} position="top">
                                                    <div
                                                        onClick={() => hasRisks && setMatrixFilter(isSelected ? null : { p: prob, i: impact })}
                                                        className={`
                                                                relative rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-300 border cursor-pointer aspect-square
                                                                ${bgClass} ${borderClass}
                                                                ${hasRisks ? 'hover:scale-105 hover:z-10 hover:shadow-lg cursor-pointer' : 'opacity-60 cursor-default'}
                                                                ${isSelected ? 'ring-2 ring-brand-500 scale-105 z-20 shadow-xl opacity-100' : matrixFilter && hasRisks ? 'opacity-40' : ''}
                                                            `}
                                                    >
                                                        {hasRisks && (
                                                            <>
                                                                <div className="flex flex-col items-center">
                                                                    <span className={`text-lg md:text-3xl font-black drop-shadow-sm transition-all
                                                                            ${score >= 15 ? 'text-rose-600 dark:text-rose-400' :
                                                                            score >= 10 ? 'text-orange-600 dark:text-orange-400' :
                                                                                score >= 5 ? 'text-amber-600 dark:text-amber-400' :
                                                                                    'text-emerald-600 dark:text-emerald-400'
                                                                        }
                                                                        `}>{cellRisks.length}</span>
                                                                </div>
                                                                {/* Corner Indicator */}
                                                                <div className={`hidden md:block absolute top-2 right-2 w-2 h-2 rounded-full
                                                                         ${score >= 15 ? 'bg-rose-500 animate-pulse' :
                                                                        score >= 10 ? 'bg-orange-500' :
                                                                            score >= 5 ? 'bg-amber-500' :
                                                                                'bg-emerald-500'
                                                                    }
                                                                     `}></div>
                                                            </>
                                                        )}

                                                        {/* Mobile Score Indicator */}
                                                        {hasRisks && <span className="md:hidden absolute bottom-1 right-2 text-[8px] opacity-50">{score}</span>}
                                                    </div>
                                                </CustomTooltip>
                                            )
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </div>

                        {/* X-Axis Labels */}
                        <div className="grid grid-cols-5 gap-3 md:gap-4 mt-4 w-full max-w-2xl px-0">
                            {IMPACT_LABELS.map(label => (
                                <div key={label.val} className="flex flex-col items-center text-center">
                                    <span className="text-xs lg:text-sm font-bold text-slate-700 dark:text-slate-300">{label.label}</span>
                                </div>
                            ))}
                        </div>
                        <div className="text-center font-bold text-xs text-slate-400 uppercase tracking-[0.2em] mt-2">
                            Impact
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
