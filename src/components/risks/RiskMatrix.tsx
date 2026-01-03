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
                <div className="overflow-x-auto pb-4">
                    <div className="min-w-[600px] md:min-w-0 mx-auto max-w-4xl grid grid-cols-[auto_repeat(5,1fr)] gap-2 md:gap-4 items-center">

                        {/* Y-Axis Title (Rotated) */}
                        <div className="row-span-5 flex justify-center -mr-4 md:mr-0">
                            <div className="-rotate-90 font-bold text-xs text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap w-8">
                                Probabilité
                            </div>
                        </div>

                        {/* Matrix Rows (Labels + Cells) */}
                        {PROBABILITY_LABELS.map((probObj) => (
                            <React.Fragment key={probObj.val}>
                                {/* Y-Axis Label */}
                                <div className="text-right pr-2 md:pr-4 flex flex-col justify-center h-full">
                                    <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300 leading-tight">
                                        {probObj.label}
                                    </span>
                                    {probObj.sub && <span className="text-[10px] text-slate-400 hidden sm:inline-block">{probObj.sub}</span>}
                                </div>

                                {/* Matrix Cells for this Row */}
                                {IMPACT_LABELS.map((impactObj) => {
                                    const cellRisks = getRisksForCell(probObj.val, impactObj.val);
                                    const hasRisks = cellRisks.length > 0;
                                    const isSelected = matrixFilter?.p === probObj.val && matrixFilter?.i === impactObj.val;
                                    const score = probObj.val * impactObj.val;

                                    let bgClass = 'bg-slate-100 dark:bg-white/5';
                                    let borderClass = 'border-slate-200 dark:border-white/10';

                                    if (score >= 15) { bgClass = 'bg-rose-500/10 dark:bg-rose-500/20'; borderClass = 'border-rose-500/30'; }
                                    else if (score >= 10) { bgClass = 'bg-orange-500/10 dark:bg-orange-500/20'; borderClass = 'border-orange-500/30'; }
                                    else if (score >= 5) { bgClass = 'bg-amber-400/10 dark:bg-amber-400/20'; borderClass = 'border-amber-400/30'; }
                                    else if (hasRisks) { bgClass = 'bg-emerald-500/10 dark:bg-emerald-500/20'; borderClass = 'border-emerald-500/30'; }

                                    return (
                                        <CustomTooltip
                                            key={`${probObj.val}-${impactObj.val}`}
                                            content={`Prob: ${probObj.val}, Impact: ${impactObj.val}, ${cellRisks.length} Risques`}
                                            position="top"
                                        >
                                            <div
                                                onClick={() => hasRisks && setMatrixFilter(isSelected ? null : { p: probObj.val, i: impactObj.val })}
                                                className={`
                                                    relative aspect-square w-full rounded-lg md:rounded-xl lg:rounded-2xl 
                                                    flex items-center justify-center border transition-all duration-300
                                                    ${bgClass} ${borderClass}
                                                    ${hasRisks ? 'cursor-pointer hover:scale-105 hover:z-10 hover:shadow-lg' : 'cursor-default opacity-60'}
                                                    ${isSelected ? 'ring-2 ring-brand-500 scale-105 z-20 shadow-xl opacity-100' : matrixFilter && hasRisks ? 'opacity-40' : ''}
                                                `}
                                            >
                                                {hasRisks && (
                                                    <>
                                                        <span className={`text-sm md:text-xl lg:text-3xl font-black drop-shadow-sm
                                                            ${score >= 15 ? 'text-rose-600 dark:text-rose-400' :
                                                                score >= 10 ? 'text-orange-600 dark:text-orange-400' :
                                                                    score >= 5 ? 'text-amber-600 dark:text-amber-400' :
                                                                        'text-emerald-600 dark:text-emerald-400'
                                                            }
                                                        `}>
                                                            {cellRisks.length}
                                                        </span>
                                                        {/* Dot for >10 */}
                                                        <div className={`hidden md:block absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full
                                                            ${score >= 15 ? 'bg-rose-500 animate-pulse' :
                                                                score >= 10 ? 'bg-orange-500' :
                                                                    score >= 5 ? 'bg-amber-500' : 'bg-emerald-500'}
                                                        `} />
                                                    </>
                                                )}
                                                {/* Mobile Score Hint */}
                                                {hasRisks && <span className="md:hidden absolute bottom-0.5 right-1 text-[8px] opacity-40 font-mono">{score}</span>}
                                            </div>
                                        </CustomTooltip>
                                    );
                                })}
                            </React.Fragment>
                        ))}

                        {/* X-Axis Title & Labels */}
                        <div className="col-start-1" /> {/* Spacer for Y-axis label */}
                        <div className="col-start-2 col-span-5 pt-4">
                            <div className="grid grid-cols-5 gap-2 md:gap-4 text-center">
                                {IMPACT_LABELS.map(label => (
                                    <div key={label.val} className="flex flex-col items-center">
                                        <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300">{label.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="text-center font-bold text-xs text-slate-400 uppercase tracking-[0.2em] mt-3">
                                Impact
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
