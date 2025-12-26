import React, { useState } from 'react';
import { Audit, Finding } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, Bot, Loader2, FileText, ClipboardCheck, AlertTriangle } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';

interface AuditAIAssistantProps {
    audit: Audit;
    findings: Finding[];
    onUpdate?: (updates: Partial<Audit>) => void;
}

export const AuditAIAssistant: React.FC<AuditAIAssistantProps> = ({ audit, findings, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<Record<string, unknown> | null>(null);
    const [mode, setMode] = useState<'summary' | 'analysis' | 'scope' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleAction = async (action: 'summary' | 'analysis' | 'scope') => {
        setLoading(true);
        setMode(action);
        setResponse(null);
        setError(null);
        try {
            let prompt = '';
            if (action === 'summary') {
                prompt = `
                    Génère un résumé exécutif pour cet audit :
                    Nom : "${audit.name}"
                    Type : "${audit.type}"
                    Statut : "${audit.status}"
                    Nombre de constats : ${findings.length}
                    Constats majeurs : ${findings.filter(f => f.type === 'Majeure').length}
                    
                    Format de réponse JSON attendu :
                    {
                        "summary": "string",
                        "keyTakeaways": ["string", "string"],
                        "overallRating": "Excellent/Good/Fair/Poor"
                    }
                `;
            } else if (action === 'analysis') {
                prompt = `
                    Analyse les constats de cet audit et identifie les tendances :
                    Constats : ${JSON.stringify(findings.map(f => ({ type: f.type, description: f.description })))}
                    
                    Format de réponse JSON attendu :
                    {
                        "trends": ["string", "string"],
                        "rootCauses": ["string", "string"],
                        "recommendations": ["string", "string"]
                    }
                `;
            } else if (action === 'scope') {
                prompt = `
                    Suggère des améliorations pour le périmètre de cet audit :
                    Périmètre actuel : "${audit.scope || 'Non défini'}"
                    Type : "${audit.type}"
                    
                    Format de réponse JSON attendu :
                    {
                        "suggestions": ["string", "string"],
                        "missingAreas": ["string", "string"]
                    }
                `;
            }

            const resultText = await aiService.generateText(prompt);

            try {
                const jsonMatch = resultText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    setResponse(parsed);
                } else {
                    setResponse({ text: resultText });
                }
            } catch (e) {
                ErrorLogger.warn("Failed to parse AI response", 'AuditAIAssistant.handleAction', { metadata: { error: e } });
                setResponse({ text: resultText });
            }

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'AuditAIAssistant.handleAction', 'AI_ERROR');
            setError("Désolé, une erreur est survenue lors de l'analyse.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-500/30">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white dark:bg-slate-900/50 rounded-xl shadow-sm">
                    <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Assistant IA Sentinel</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Analyse et rapports intelligents</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                <button
                    onClick={() => handleAction('summary')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'summary' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                    aria-label="Générer un résumé exécutif"
                >
                    {loading && mode === 'summary' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-2" />}
                    Résumé Exécutif
                </button>
                <button
                    onClick={() => handleAction('analysis')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'analysis' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                    aria-label="Analyser les constats"
                >
                    {loading && mode === 'analysis' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />}
                    Analyse Constats
                </button>
                <button
                    onClick={() => handleAction('scope')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'scope' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                    aria-label="Revoir le périmètre"
                >
                    {loading && mode === 'scope' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5 mr-2" />}
                    Revue Périmètre
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
                        <button onClick={() => setResponse(null)} className="text-slate-500 hover:text-slate-600" aria-label="Fermer la réponse IA"><X className="h-3.5 w-3.5" /></button>
                    </div>

                    <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {mode === 'summary' && typeof response.summary === 'string' && (
                            <div>
                                <p>{String(response.summary)}</p>
                                {Array.isArray(response.keyTakeaways) && (
                                    <div className="mt-2">
                                        <p className="font-bold mb-1">Points Clés :</p>
                                        <ul className="list-disc pl-4 space-y-1">
                                            {response.keyTakeaways.map((r: unknown, i: number) => <li key={`takeaway-${i}`}>{String(r)}</li>)}
                                        </ul>
                                    </div>
                                )}
                                <p className="mt-2 text-xs font-bold text-indigo-600">Note Globale: {String(response.overallRating)}</p>
                            </div>
                        )}
                        {mode === 'analysis' && Array.isArray(response.rootCauses) && (
                            <div>
                                <p className="font-bold mb-1">Causes Racines :</p>
                                <ul className="list-disc pl-4 mb-2 space-y-1">
                                    {response.rootCauses.map((r: unknown, i: number) => <li key={`cause-${i}`}>{String(r)}</li>)}
                                </ul>
                                <p className="font-bold mb-1">Recommandations :</p>
                                <ul className="list-disc pl-4 space-y-1">
                                    {Array.isArray(response.recommendations) && response.recommendations.map((r: unknown, i: number) => <li key={`rec-${i}`}>{String(r)}</li>)}
                                </ul>
                            </div>
                        )}
                        {mode === 'scope' && Array.isArray(response.suggestions) && (
                            <div>
                                <p className="font-bold mb-1">Suggestions :</p>
                                <ul className="list-disc pl-4 mb-2 space-y-1">
                                    {response.suggestions.map((r: unknown, i: number) => <li key={`sugg-${i}`}>{String(r)}</li>)}
                                </ul>
                                {Array.isArray(response.missingAreas) && response.missingAreas.length > 0 && (
                                    <>
                                        <p className="font-bold mb-1">Zones Manquantes :</p>
                                        <ul className="list-disc pl-4 space-y-1">
                                            {response.missingAreas.map((r: unknown, i: number) => <li key={`missing-${i}`}>{String(r)}</li>)}
                                        </ul>
                                    </>
                                )}
                                {onUpdate && (
                                    <button
                                        onClick={() => {
                                            // Example: Append suggestions to scope
                                            const newScope = (audit.scope || '') + '\n\nSuggestions IA:\n' + (response.suggestions as string[]).join('\n');
                                            onUpdate({ scope: newScope });
                                        }}
                                        className="mt-2 text-xs text-indigo-600 hover:underline"
                                        aria-label="Ajouter les suggestions au périmètre"
                                    >
                                        Ajouter au périmètre
                                    </button>
                                )}
                            </div>
                        )}
                        {typeof response.text === 'string' && <p>{response.text}</p>}
                    </div>
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
