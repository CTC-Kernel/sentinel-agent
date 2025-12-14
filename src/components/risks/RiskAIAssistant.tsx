import React, { useState } from 'react';
import { Risk } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, Bot, FileText, Loader2, AlertTriangle, ShieldCheck } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';

interface RiskAIAssistantProps {
    risk: Risk;
    onUpdate?: (updates: Partial<Risk>) => void;
}

export const RiskAIAssistant: React.FC<RiskAIAssistantProps> = ({ risk, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<Record<string, unknown> | null>(
        risk.aiAnalysis?.response || null
    );
    const initialMode = risk.aiAnalysis?.type;
    const [mode, setMode] = useState<'analyze' | 'mitigate' | 'improve' | null>(
        initialMode === 'analyze' || initialMode === 'mitigate' || initialMode === 'improve' ? initialMode : null
    );
    const [error, setError] = useState<string | null>(null);

    const handleAction = async (action: 'analyze' | 'mitigate' | 'improve') => {
        setLoading(true);
        setMode(action);
        setResponse(null);
        setError(null);
        try {
            let prompt = '';
            if (action === 'analyze') {
                prompt = `
                    Analyse le risque suivant selon la norme ISO 27005 :
                    Menace : "${risk.threat}"
                    Vulnérabilité : "${risk.vulnerability}"
                    Actif concerné (ID) : "${risk.assetId}"
                    
                    Estime la probabilité (1-5) et l'impact (1-5) avec une justification courte.
                    Format de réponse JSON attendu :
                    {
                        "probability": number,
                        "impact": number,
                        "justification": "string"
                    }
                `;
            } else if (action === 'mitigate') {
                prompt = `
                    Suggère 3 mesures de sécurité (contrôles) concrètes pour atténuer ce risque :
                    Menace : "${risk.threat}"
                    Vulnérabilité : "${risk.vulnerability}"
                    
                    Format de réponse JSON attendu :
                    {
                        "measures": ["string", "string", "string"]
                    }
                `;
            } else if (action === 'improve') {
                prompt = `
                    Réécris et améliore la description de ce risque pour qu'elle soit plus professionnelle et précise (style ISO 27005) :
                    Menace actuelle : "${risk.threat}"
                    Vulnérabilité actuelle : "${risk.vulnerability}"
                    
                    Format de réponse JSON attendu :
                    {
                        "threat": "string",
                        "vulnerability": "string"
                    }
                `;
            }

            const resultText = await aiService.generateText(prompt);

            // Try to parse JSON
            try {
                let parsedResponse: Record<string, unknown>;
                const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsedResponse = JSON.parse(jsonMatch[0]);
                } else {
                    // Fallback for non-JSON response (should not happen with good prompt)
                    parsedResponse = { text: resultText };
                }

                setResponse(parsedResponse);

                // Persist logic
                if (onUpdate) {
                    onUpdate({
                        aiAnalysis: {
                            type: action,
                            response: parsedResponse,
                            timestamp: new Date().toISOString()
                        }
                    });
                }

            } catch (e) {
                ErrorLogger.warn("Failed to parse AI response", 'RiskAIAssistant.handleAction', { metadata: { error: e } });
                const fallback = { text: resultText };
                setResponse(fallback);
                if (onUpdate) {
                    onUpdate({
                        aiAnalysis: {
                            type: action,
                            response: fallback,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            }

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'RiskAIAssistant.handleAction', 'AI_ERROR');
            setError("Désolé, une erreur est survenue lors de l'analyse.");
        } finally {
            setLoading(false);
        }
    };

    const [applying, setApplying] = useState(false);

    const handleApply = async () => {
        if (!onUpdate || !response) return;

        setApplying(true);
        try {
            if (mode === 'analyze') {
                // Handle potential string vs number issues if AI returns strings
                const prob = Number(response.probability);
                const imp = Number(response.impact);

                if (!isNaN(prob) && !isNaN(imp)) {
                    await onUpdate({
                        probability: prob as 1 | 2 | 3 | 4 | 5,
                        impact: imp as 1 | 2 | 3 | 4 | 5,
                        justification: response.justification as string
                    });
                }
            } else if (mode === 'improve' && typeof response.threat === 'string' && typeof response.vulnerability === 'string') {
                await onUpdate({
                    threat: response.threat,
                    vulnerability: response.vulnerability
                });
            }
        } finally {
            setApplying(false);
        }
        // Keep result visible
    };

    const handleDismiss = () => {
        setResponse(null);
        if (onUpdate) {
            onUpdate({
                aiAnalysis: undefined
            });
        }
    }

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-500/30">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white dark:bg-slate-900/50 rounded-xl shadow-sm">
                    <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Assistant IA Sentinel</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Analyse et suggestions intelligentes</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                <button
                    onClick={() => handleAction('analyze')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'analyze' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'analyze' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />}
                    Analyser le risque
                </button>
                <button
                    onClick={() => handleAction('mitigate')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'mitigate' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'mitigate' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-2" />}
                    Suggérer mesures
                </button>
                <button
                    onClick={() => handleAction('improve')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'improve' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'improve' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-2" />}
                    Améliorer texte
                </button>
            </div>

            {error && (
                <div className="text-xs text-red-500 mb-2">{error}</div>
            )}

            {response && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-indigo-100 dark:border-indigo-500/20 shadow-sm animate-fade-in">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center">
                            <Bot className="h-3.5 w-3.5 mr-1.5" />
                            Réponse de l'IA
                        </h4>
                        <button onClick={handleDismiss} className="text-slate-500 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                    </div>

                    <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {mode === 'analyze' && typeof response.probability === 'number' && typeof response.impact === 'number' && (
                            <div>
                                <p><strong>Probabilité suggérée :</strong> {response.probability}/5</p>
                                <p><strong>Impact suggéré :</strong> {response.impact}/5</p>
                                <p className="mt-2"><em>{String(response.justification)}</em></p>
                            </div>
                        )}
                        {mode === 'mitigate' && Array.isArray(response.measures) && (
                            <ul className="list-disc pl-4 space-y-1">
                                {response.measures.map((m: unknown, i: number) => <li key={i}>{String(m)}</li>)}
                            </ul>
                        )}
                        {mode === 'improve' && typeof response.threat === 'string' && (
                            <div>
                                <p><strong>Nouvelle Menace :</strong> {response.threat}</p>
                                <p><strong>Nouvelle Vulnérabilité :</strong> {String(response.vulnerability)}</p>
                            </div>
                        )}
                        {typeof response.text === 'string' && <p>{response.text}</p>}
                    </div>

                    {onUpdate && mode !== 'mitigate' && !response.text && (
                        <button
                            onClick={handleApply}
                            disabled={applying}
                            className="mt-3 w-full flex items-center justify-center px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {applying ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-2" />}
                            {applying ? 'Application...' : 'Appliquer les changements'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

function X(props: React.SVGProps<SVGSVGElement>) {
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
