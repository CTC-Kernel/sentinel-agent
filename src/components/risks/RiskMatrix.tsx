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

    return (
        <div className="glass-panel p-4 sm:p-8 rounded-[2.5rem] shadow-lg overflow-x-auto animate-fade-in border border-white/60 dark:border-white/10 relative backdrop-blur-xl bg-white/40 dark:bg-black/40">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 pointer-events-none" />
            <div className="relative z-10 w-full mb-8">
                <div>
                    <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 tracking-tight">Matrice des Risques</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Distribution selon la probabilité et l'impact</p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-medium bg-white/50 dark:bg-white/5 p-2 rounded-xl backdrop-blur-md border border-white/20 dark:border-white/5 mt-4">
                    <span className="flex items-center px-2 py-1 rounded-lg"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 mr-2 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>Critique (15-25)</span>
                    <span className="flex items-center px-2 py-1 rounded-lg"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 mr-2 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></span>Élevé (10-14)</span>
                    <span className="flex items-center px-2 py-1 rounded-lg"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 mr-2 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></span>Moyen (5-9)</span>
                    <span className="flex items-center px-2 py-1 rounded-lg"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>Faible (1-4)</span>
                </div>
            </div>

            <div className="relative p-8 bg-slate-50/50 dark:bg-black/20 rounded-[2rem] border border-slate-200/50 dark:border-white/5 shadow-inner">
                <div className="grid grid-cols-[auto_1fr] gap-6">
                    <div className="flex items-center justify-center w-8">
                        <div className="-rotate-90 font-bold text-xs text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">Probabilité</div>
                    </div>
                    <div className="grid grid-rows-5 grid-cols-5 gap-4 w-full min-w-[600px] aspect-square mx-auto">
                        {[5, 4, 3, 2, 1].map(prob => (
                            <React.Fragment key={prob}>
                                {[1, 2, 3, 4, 5].map(impact => {
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
                                                        relative rounded-2xl flex items-center justify-center transition-all duration-300 border cursor-pointer
                                                        ${bgClass} ${borderClass}
                                                        ${hasRisks ? 'hover:scale-105 hover:z-10 hover:shadow-lg cursor-pointer' : 'opacity-60 cursor-default grayscale'}
                                                        ${isSelected ? 'ring-2 ring-brand-500 scale-105 z-20 shadow-xl opacity-100' : matrixFilter && hasRisks ? 'opacity-40' : ''}
                                                    `}
                                            >
                                                {hasRisks && (
                                                    <>
                                                        <div className="flex flex-col items-center">
                                                            <span className={`text-2xl font-black drop-shadow-sm
                                                                    ${score >= 15 ? 'text-rose-600 dark:text-rose-400' :
                                                                    score >= 10 ? 'text-orange-600 dark:text-orange-400' :
                                                                        score >= 5 ? 'text-amber-600 dark:text-amber-400' :
                                                                            'text-emerald-600 dark:text-emerald-400'
                                                                }
                                                                `}>{cellRisks.length}</span>
                                                        </div>
                                                        {/* Corner Indicator */}
                                                        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full
                                                                 ${score >= 15 ? 'bg-rose-500 animate-pulse' :
                                                                score >= 10 ? 'bg-orange-500' :
                                                                    score >= 5 ? 'bg-amber-500' :
                                                                        'bg-emerald-500'
                                                            }
                                                             `}></div>
                                                    </>
                                                )}
                                            </div>
                                        </CustomTooltip>
                                    )
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-6 mt-4">
                    <div className="w-8"></div>
                    <div className="text-center font-bold text-xs text-slate-500 uppercase tracking-[0.2em]">Impact</div>
                </div>
            </div>
        </div>
    );
};
