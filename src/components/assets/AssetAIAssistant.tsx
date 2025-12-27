import React, { useState } from 'react';
import { Asset, Criticality } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, Bot, Loader2, AlertTriangle, ShieldCheck, Wrench } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';

interface AssetAIAssistantProps {
    asset: Asset;
    onUpdate?: (updates: Partial<Asset>) => void;
}

export const AssetAIAssistant: React.FC<AssetAIAssistantProps> = ({ asset, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    interface AIAnalysisResponse {
        confidentiality: string;
        integrity: string;
        availability: string;
        justification: string;
        tasks?: string[];
        frequency?: string;
        suggestions?: string[];
        text?: string;
    }

    const [response, setResponse] = useState<AIAnalysisResponse | null>(
        asset.aiAnalysis?.response ? (asset.aiAnalysis.response as unknown as AIAnalysisResponse) : null
    );
    const [mode, setMode] = useState<'analyze' | 'maintenance' | 'optimize' | null>(
        asset.aiAnalysis?.type === 'analyze' || asset.aiAnalysis?.type === 'maintenance' || asset.aiAnalysis?.type === 'optimize'
            ? asset.aiAnalysis.type
            : null
    );
    const [error, setError] = useState<string | null>(null);

    const handleAction = async (action: 'analyze' | 'maintenance' | 'optimize') => {
        setLoading(true);
        setMode(action);
        setResponse(null);
        setError(null);
        try {
            let prompt = '';
            if (action === 'analyze') {
                prompt = `
                    Analyse la criticité de cet actif selon la norme ISO 27001 :
                    Nom : "${asset.name}"
                    Type : "${asset.type}"
                    Description : "${asset.type} - ${asset.location || 'N/A'}"
                    
                    Estime la confidentialité, l'intégrité et la disponibilité (Low, Medium, High, Critical) avec une justification courte.
                    Format de réponse JSON attendu :
                    {
                        "confidentiality": "string",
                        "integrity": "string",
                        "availability": "string",
                        "justification": "string"
                    }
                `;
            } else if (action === 'maintenance') {
                prompt = `
                    Suggère un plan de maintenance préventive pour cet actif :
                    Nom : "${asset.name}"
                    Type : "${asset.type}"
                    
                    Format de réponse JSON attendu :
                    {
                        "tasks": ["string", "string", "string"],
                        "frequency": "string"
                    }
                `;
            } else if (action === 'optimize') {
                prompt = `
                    Suggère des optimisations pour réduire le coût ou améliorer la sécurité de cet actif :
                    Nom : "${asset.name}"
                    Type : "${asset.type}"
                    
                    Format de réponse JSON attendu :
                    {
                        "suggestions": ["string", "string"]
                    }
                `;
            }

            const resultText = await aiService.generateText(prompt);

            try {
                let parsedResponse: AIAnalysisResponse;
                const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsedResponse = JSON.parse(jsonMatch[0]);
                } else {
                    parsedResponse = { text: resultText } as AIAnalysisResponse;
                }

                setResponse(parsedResponse);

                // Persist the result
                if (onUpdate) {
                    onUpdate({
                        aiAnalysis: {
                            type: action,
                            response: parsedResponse as unknown as Record<string, unknown>,
                            timestamp: new Date().toISOString()
                        }
                    });
                }

            } catch (e) {
                ErrorLogger.warn("Failed to parse AI response", 'AssetAIAssistant.handleAction', { metadata: { error: e } });
                const fallbackResponse = { text: resultText } as AIAnalysisResponse;
                setResponse(fallbackResponse);
                if (onUpdate) {
                    onUpdate({
                        aiAnalysis: {
                            type: action,
                            response: fallbackResponse as unknown as Record<string, unknown>,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            }

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'AssetAIAssistant.handleAction', 'AI_ERROR');
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
                // Rough mapping to handle case sensitivity
                const mapCriticality = (val: string): Criticality => {
                    const v = val.toLowerCase();
                    if (v.includes('low') || v.includes('faible')) return Criticality.LOW;
                    if (v.includes('medium') || v.includes('moyenne')) return Criticality.MEDIUM;
                    if (v.includes('high') || v.includes('élevée') || v.includes('elevee')) return Criticality.HIGH;
                    if (v.includes('critical') || v.includes('critique')) return Criticality.CRITICAL;
                    return Criticality.MEDIUM; // Default
                };

                if (response.confidentiality) {
                    await onUpdate({
                        confidentiality: mapCriticality(response.confidentiality),
                        integrity: mapCriticality(response.integrity),
                        availability: mapCriticality(response.availability),
                    });
                }
            }
        } finally {
            setApplying(false);
        }
        // Do not clear the response, keep it visible as requested
    };

    const handleDismiss = () => {
        setResponse(null);
        if (onUpdate) {
            // Clear the persisted analysis
            onUpdate({
                aiAnalysis: null
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
                    aria-label="Lancer l'analyse de criticité"
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${mode === 'analyze' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'analyze' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />}
                    Analyser Criticité
                </button>
                <button
                    onClick={() => handleAction('maintenance')}
                    disabled={loading}
                    aria-label="Générer un plan de maintenance"
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${mode === 'maintenance' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'maintenance' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Wrench className="h-3.5 w-3.5 mr-2" />}
                    Plan Maintenance
                </button>
                <button
                    onClick={() => handleAction('optimize')}
                    disabled={loading}
                    aria-label="Obtenir des suggestions d'optimisation"
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${mode === 'optimize' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'optimize' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-2" />}
                    Optimiser
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
                        <button onClick={handleDismiss} aria-label="Fermer la réponse IA" className="text-slate-500 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"><X className="h-3.5 w-3.5" /></button>
                    </div>

                    <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {mode === 'analyze' && typeof response.confidentiality === 'string' && (
                            <div>
                                <p><strong>Confidentialité :</strong> {String(response.confidentiality)}</p>
                                <p><strong>Intégrité :</strong> {String(response.integrity)}</p>
                                <p><strong>Disponibilité :</strong> {String(response.availability)}</p>
                                <p className="mt-2"><em>{String(response.justification)}</em></p>
                            </div>
                        )}
                        {mode === 'maintenance' && Array.isArray(response.tasks) && (
                            <div>
                                <p className="mb-1"><strong>Fréquence suggérée :</strong> {String(response.frequency)}</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    {response.tasks.map((t: unknown, i: number) => <li key={`task-${i}`}>{String(t)}</li>)}
                                </ul>
                            </div>
                        )}
                        {mode === 'optimize' && Array.isArray(response.suggestions) && (
                            <ul className="list-disc pl-4 space-y-1">
                                {response.suggestions.map((s: unknown, i: number) => <li key={`sugg-${i}`}>{String(s)}</li>)}
                            </ul>
                        )}
                        {typeof response.text === 'string' && <p>{response.text}</p>}
                    </div>

                    {onUpdate && mode === 'analyze' && !response.text && (
                        <button
                            onClick={handleApply}
                            disabled={applying}
                            aria-label="Appliquer les recommandations de criticité"
                            className="mt-3 w-full flex items-center justify-center px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
