import React from 'react';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { Risk } from '../../types';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

interface RiskMatrixProps {
    risks: Risk[];
    matrixFilter: { p: number; i: number } | null;
    setMatrixFilter: (filter: { p: number; i: number } | null) => void;
    frameworkFilter: string;
}

export const RiskMatrix: React.FC<RiskMatrixProps> = ({ risks, matrixFilter, setMatrixFilter, frameworkFilter }) => {

    // Helper within the component to count risks per cell
    const getRisksForCell = (prob: number, impact: number) =>
        risks.filter(r => (Number(r.probability) === prob) && (Number(r.impact) === impact) && (!frameworkFilter || r.framework === frameworkFilter));

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
        <div className="w-full space-y-8">
            {/* Header & Legend */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
                <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Matrice des Risques</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg">
                        Visualisation de l'exposition aux risques selon la norme {frameworkFilter || 'ISO 27005'}.
                        Cliquez sur une case pour filtrer les risques associés.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3 bg-white dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"></span>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Faible</span>
                            <span className="text-[10px] text-slate-400">Score 1-4</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                        <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]"></span>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Moyen</span>
                            <span className="text-[10px] text-slate-400">Score 5-9</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                        <span className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]"></span>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Élevé</span>
                            <span className="text-[10px] text-slate-400">Score 10-14</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                        <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]"></span>
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Critique</span>
                            <span className="text-[10px] text-slate-400">Score 15-25</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Matrix Container */}
            <div className="relative p-8 bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden">

                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                <div className="relative z-10 overflow-x-auto pb-6 scrollbar-hide">
                    <div className="min-w-[600px] md:min-w-[700px] mx-auto max-w-5xl grid grid-cols-[auto_auto_repeat(5,1fr)] gap-2 md:gap-4">

                        {/* Y-Axis Label */}
                        <div className="row-span-5 flex items-center justify-center -mr-4">
                            <div className="-rotate-90 text-xs font-bold uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap">
                                Probabilité
                            </div>
                        </div>

                        {/* Row Labels & Matrix Cells */}
                        {PROBABILITY_LABELS.map((probObj) => (
                            <React.Fragment key={probObj.val}>
                                {/* Row Label */}
                                <div className="flex flex-col justify-center items-end pr-4 py-2">
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                        {probObj.label}
                                    </span>
                                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        {probObj.sub}
                                    </span>
                                </div>

                                {/* Cells for this Row */}
                                {IMPACT_LABELS.map((impactObj) => {
                                    const cellRisks = getRisksForCell(probObj.val, impactObj.val);
                                    const count = cellRisks.length;
                                    const hasRisks = count > 0;
                                    const isSelected = matrixFilter?.p === probObj.val && matrixFilter?.i === impactObj.val;
                                    const score = probObj.val * impactObj.val;

                                    // Determine Cell Styling
                                    let cellStyle = "bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/5"; // Default empty
                                    let textStyle = "text-slate-300 dark:text-slate-600";
                                    let ringColor = "";

                                    if (score >= 15) {
                                        cellStyle = hasRisks
                                            ? "bg-gradient-to-br from-rose-500/20 to-rose-600/5 border-rose-200 dark:border-rose-500/20 shadow-[inset_0_0_20px_rgba(244,63,94,0.1)]"
                                            : "bg-rose-50/50 dark:bg-rose-900/5 border-rose-100 dark:border-rose-500/10";
                                        textStyle = hasRisks ? "text-rose-600 dark:text-rose-400" : "text-rose-200 dark:text-rose-900/40";
                                        ringColor = "ring-rose-500";
                                    } else if (score >= 10) {
                                        cellStyle = hasRisks
                                            ? "bg-gradient-to-br from-orange-500/20 to-orange-600/5 border-orange-200 dark:border-orange-500/20 shadow-[inset_0_0_20px_rgba(249,115,22,0.1)]"
                                            : "bg-orange-50/50 dark:bg-orange-900/5 border-orange-100 dark:border-orange-500/10";
                                        textStyle = hasRisks ? "text-orange-600 dark:text-orange-400" : "text-orange-200 dark:text-orange-900/40";
                                        ringColor = "ring-orange-500";
                                    } else if (score >= 5) {
                                        cellStyle = hasRisks
                                            ? "bg-gradient-to-br from-amber-400/20 to-amber-500/5 border-amber-200 dark:border-amber-400/20 shadow-[inset_0_0_20px_rgba(251,191,36,0.1)]"
                                            : "bg-amber-50/50 dark:bg-amber-900/5 border-amber-100 dark:border-amber-400/10";
                                        textStyle = hasRisks ? "text-amber-600 dark:text-amber-400" : "text-amber-200 dark:text-amber-900/40";
                                        ringColor = "ring-amber-400";
                                    } else {
                                        cellStyle = hasRisks
                                            ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 border-emerald-200 dark:border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]"
                                            : "bg-emerald-50/50 dark:bg-emerald-900/5 border-emerald-100 dark:border-emerald-500/10";
                                        textStyle = hasRisks ? "text-emerald-600 dark:text-emerald-400" : "text-emerald-200 dark:text-emerald-900/40";
                                        ringColor = "ring-emerald-500";
                                    }

                                    return (
                                        <CustomTooltip
                                            key={`${probObj.val}-${impactObj.val}`}
                                            content={
                                                <div className="text-center">
                                                    <div className="font-bold">Score: {score}</div>
                                                    <div className="text-xs opacity-80">{count} Risque(s)</div>
                                                    <div className="text-[10px] mt-1 text-slate-400">P:{probObj.val} x I:{impactObj.val}</div>
                                                </div>
                                            }
                                        >
                                            <motion.div
                                                whileHover={hasRisks ? { scale: 1.05, zIndex: 10 } : {}}
                                                whileTap={hasRisks ? { scale: 0.95 } : {}}
                                                onClick={() => hasRisks && setMatrixFilter(isSelected ? null : { p: probObj.val, i: impactObj.val })}
                                                className={`
                                                    relative aspect-[1.1] rounded-2xl border transition-all duration-300 group
                                                    flex flex-col items-center justify-center
                                                    ${cellStyle}
                                                    ${hasRisks ? 'cursor-pointer' : 'cursor-default opacity-80'}
                                                    ${isSelected ? `ring-2 ${ringColor} shadow-lg scale-105 z-20` : matrixFilter && hasRisks ? 'opacity-40 grayscale-[0.5]' : ''}
                                                `}
                                            >
                                                {/* Score Indicator (Always visible, faint) */}
                                                <span className={`absolute top-2 right-3 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity ${textStyle}`}>
                                                    {score}
                                                </span>

                                                {/* Count */}
                                                <span className={`text-2xl lg:text-3xl font-black tracking-tight transition-all ${textStyle} ${isSelected ? 'scale-110' : ''}`}>
                                                    {count > 0 ? count : '-'}
                                                </span>

                                                {/* Label for populated cells */}
                                                {hasRisks && (
                                                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                                                        Risques
                                                    </span>
                                                )}

                                                {!hasRisks && (
                                                    <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:8px_8px] opacity-[0.15]" />
                                                )}
                                            </motion.div>
                                        </CustomTooltip>
                                    );
                                })}
                            </React.Fragment>
                        ))}

                        {/* X-Axis Labels */}
                        <div className="col-span-2" /> {/* Spacer for Y-Axis and Row Labels */}
                        {IMPACT_LABELS.map(label => (
                            <div key={label.val} className="flex flex-col items-center pt-4">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label.label}</span>
                                <span className="text-xs font-bold text-slate-400 mt-1">Niveau {label.val}</span>
                            </div>
                        ))}

                        {/* X-Axis Title */}
                        <div className="col-span-2" /> {/* Spacer for Y-Axis and Row Labels */}
                        <div className="col-span-5 text-center mt-6">
                            <span className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">
                                Impact
                            </span>
                        </div>

                    </div>
                </div>
            </div>

            {/* Info Footer */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 text-sm text-blue-700 dark:text-blue-300">
                <Info className="h-5 w-5 shrink-0 mt-0.5" />
                <p>
                    La matrice des risques permet de visualiser la répartition de vos risques selon leur criticité.
                    La zone rouge représente les risques inacceptables nécessitant une action immédiate.
                    La zone verte représente les risques acceptables ou sous contrôle.
                </p>
            </div>
        </div>
    );
};
