import React from 'react';
import { Risk } from '../../types';
import { ShieldAlert, ArrowRight, CheckCircle2 } from '../ui/Icons';

interface TopRisksWidgetProps {
    risks: Risk[];
    onMitigate: (risk: Risk) => void;
}

export const TopRisksWidget: React.FC<TopRisksWidgetProps> = ({ risks, onMitigate }) => {
    // Sort by score desc and take top 5
    const topRisks = [...risks].sort((a, b) => b.score - a.score).slice(0, 5);

    return (
        <div className="glass-panel p-6 rounded-[2.5rem] h-full">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Risques Critiques</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Priorité d'action</p>
                </div>
                <button className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl hover:bg-red-100 transition-colors">
                    <ShieldAlert className="h-5 w-5" />
                </button>
            </div>

            <div className="space-y-3">
                {topRisks.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm flex flex-col items-center">
                        <CheckCircle2 className="h-12 w-12 mb-2 text-green-500 opacity-50" />
                        <p>Aucun risque critique identifié.</p>
                        <p className="text-xs mt-1">Excellente posture de sécurité !</p>
                    </div>
                ) : (
                    topRisks.map(risk => (
                        <div key={risk.id} className="group p-4 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-slate-100 dark:border-white/5 rounded-2xl transition-all cursor-pointer">
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{risk.threat}</h4>
                                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 text-xs font-bold">
                                    {risk.score}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-3">
                                <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                    {risk.status === 'Fermé' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                                    {risk.strategy}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onMitigate(risk); }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center text-xs font-bold text-brand-600 hover:text-brand-700"
                                >
                                    Traiter <ArrowRight className="h-3 w-3 ml-1" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
