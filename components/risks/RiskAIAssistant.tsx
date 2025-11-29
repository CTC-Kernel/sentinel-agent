import React, { useState } from 'react';
import { Risk } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, Bot, FileText, Loader2, AlertTriangle, ShieldCheck } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';

interface RiskAIAssistantProps {
    risk: Risk;
    onUpdate?: (updates: Partial<Risk>) => void;
}

export const RiskAIAssistant: React.FC<RiskAIAssistantProps> = ({ risk }) => {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string | null>(null);
    const [mode, setMode] = useState<'analyze' | 'mitigate' | 'improve' | null>(null);

    const handleAction = async (action: 'analyze' | 'mitigate' | 'improve') => {
        setLoading(true);
        setMode(action);
        setResponse(null);
        try {
            let prompt = '';
            if (action === 'analyze') {
                prompt = `
                    Analyse le risque suivant selon la norme ISO 27005 :
                    Menace : "${risk.threat}"
                    Vulnérabilité : "${risk.vulnerability}"
                    Actif concerné (ID) : "${risk.assetId}"
                    
                    Estime la probabilité (1-5) et l'impact (1-5) avec une justification courte.
                    Format de réponse attendu :
                    Probabilité : [X]/5
                    Impact : [Y]/5
                    Justification : [Texte]
                `;
            } else if (action === 'mitigate') {
                prompt = `
                    Suggère 3 mesures de sécurité (contrôles) concrètes pour atténuer ce risque :
                    Menace : "${risk.threat}"
                    Vulnérabilité : "${risk.vulnerability}"
                    
                    Réponds sous forme de liste à puces.
                `;
            } else if (action === 'improve') {
                prompt = `
                    Réécris et améliore la description de ce risque pour qu'elle soit plus professionnelle et précise (style ISO 27005) :
                    Menace actuelle : "${risk.threat}"
                    Vulnérabilité actuelle : "${risk.vulnerability}"
                    
                    Format :
                    Menace : [Nouvelle formulation]
                    Vulnérabilité : [Nouvelle formulation]
                `;
            }

            const result = await aiService.generateText(prompt);
            setResponse(result);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RiskAIAssistant.handleAction', 'AI_ERROR');
            setResponse("Désolé, une erreur est survenue lors de l'analyse.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-500/30">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white dark:bg-indigo-900/50 rounded-xl shadow-sm">
                    <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Assistant IA Sentinel</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Analyse et suggestions intelligentes</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                <button
                    onClick={() => handleAction('analyze')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'analyze' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'analyze' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />}
                    Analyser le risque
                </button>
                <button
                    onClick={() => handleAction('mitigate')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'mitigate' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'mitigate' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-2" />}
                    Suggérer mesures
                </button>
                <button
                    onClick={() => handleAction('improve')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'improve' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'improve' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-2" />}
                    Améliorer texte
                </button>
            </div>

            {response && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-indigo-100 dark:border-indigo-500/20 shadow-sm animate-fade-in">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center">
                            <Bot className="h-3.5 w-3.5 mr-1.5" />
                            Réponse de l'IA
                        </h4>
                        <button onClick={() => setResponse(null)} className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {response}
                    </div>
                    {/* Future: Add "Apply" button if onUpdate is provided and response can be parsed */}
                </div>
            )}
        </div>
    );
};

function X(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    )
}
