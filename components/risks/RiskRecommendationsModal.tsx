import React from 'react';
import { X, CheckCircle2, BrainCircuit, ShieldCheck } from '../ui/Icons';

interface Recommendation {
    title: string;
    description: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    suggested_actions: { action: string; priority: string }[];
    confidence_score: number;
}

interface RiskRecommendationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    recommendations: Recommendation[];
    isLoading: boolean;
}

export const RiskRecommendationsModal: React.FC<RiskRecommendationsModalProps> = ({ isOpen, onClose, recommendations, isLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2rem] shadow-2xl border border-white/10 flex flex-col max-h-[90vh] animate-scale-in overflow-hidden">

                {/* Header */}
                <div className="p-8 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-brand-500/10 rounded-2xl">
                            <BrainCircuit className="w-8 h-8 text-brand-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Analyse IA Hybride</h2>
                            <p className="text-slate-500 dark:text-slate-400">Recommandations générées par le moteur d'IA souverain (OVH)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-6">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <BrainCircuit className="w-8 h-8 text-brand-600 animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Analyse en cours...</h3>
                                <p className="text-slate-500">Nos algorithmes analysent vos risques sur le cloud sécurisé.</p>
                            </div>
                        </div>
                    ) : recommendations.length > 0 ? (
                        <div className="grid gap-6">
                            {recommendations.map((rec, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${rec.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                rec.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                {rec.priority}
                                            </span>
                                            <span className="flex items-center text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                                                <ShieldCheck className="w-3 h-3 mr-1" />
                                                Confiance: {(rec.confidence_score * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-brand-500 transition-colors">
                                        {rec.title}
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                                        {rec.description}
                                    </p>

                                    <div className="bg-slate-50 dark:bg-black/20 rounded-2xl p-5">
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Actions Suggérées</h4>
                                        <ul className="space-y-3">
                                            {rec.suggested_actions.map((action, i) => (
                                                <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                                                    <div className="mt-0.5 p-1 bg-brand-100 dark:bg-brand-900/30 rounded-full text-brand-600 dark:text-brand-400">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    </div>
                                                    {action.action}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-10 h-10 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Tout semble correct</h3>
                            <p className="text-slate-500">L'IA n'a détecté aucune recommandation critique pour le moment.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl font-bold text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};
