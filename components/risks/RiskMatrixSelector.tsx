import React from 'react';

interface RiskMatrixSelectorProps {
    probability: number;
    impact: number;
    onChange: (probability: number, impact: number) => void;
    label?: string;
}

export const RiskMatrixSelector: React.FC<RiskMatrixSelectorProps> = ({
    probability,
    impact,
    onChange,
    label = "Évaluation du Risque"
}) => {
    const getCellColor = (p: number, i: number) => {
        const score = p * i;
        if (score >= 15) return 'bg-rose-500';
        if (score >= 10) return 'bg-orange-500';
        if (score >= 5) return 'bg-amber-400';
        return 'bg-emerald-500';
    };

    const currentScore = probability * impact;
    const getRiskLevel = (score: number) => {
        if (score >= 15) return { label: 'Critique', color: 'text-rose-600' };
        if (score >= 10) return { label: 'Élevé', color: 'text-orange-600' };
        if (score >= 5) return { label: 'Moyen', color: 'text-amber-600' };
        return { label: 'Faible', color: 'text-emerald-600' };
    };

    const level = getRiskLevel(currentScore);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                    {label}
                </label>
                <div className="text-right">
                    <span className="text-xs font-medium text-slate-400 block">Score: {currentScore}</span>
                    <span className={`text-sm font-black uppercase ${level.color}`}>{level.label}</span>
                </div>
            </div>

            <div className="relative">
                {/* Labels */}
                <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Probabilité
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Impact
                </div>

                {/* Grid */}
                <div className="grid grid-rows-5 gap-1.5 w-full aspect-square max-w-[300px] mx-auto">
                    {[5, 4, 3, 2, 1].map(p => (
                        <div key={p} className="grid grid-cols-5 gap-1.5">
                            {[1, 2, 3, 4, 5].map(i => {
                                const isSelected = probability === p && impact === i;


                                return (
                                    <button
                                        key={`${p}-${i}`}
                                        type="button"
                                        onClick={() => onChange(p, i)}
                                        className={`
                                            w-full h-full rounded-md transition-all duration-200 relative
                                            ${getCellColor(p, i)}
                                            ${isSelected
                                                ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110 z-10 shadow-lg'
                                                : 'opacity-30 hover:opacity-80 hover:scale-105'}
                                        `}
                                        title={`Probabilité: ${p}, Impact: ${i}, Score: ${p * i}`}
                                    >
                                        {isSelected && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
