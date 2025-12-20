import React, { useState } from 'react';
import { Supplier } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, Bot, Loader2, AlertTriangle, ShieldCheck, Scale } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';

interface SupplierAIAssistantProps {
    supplier: Supplier;
    onUpdate?: (updates: Partial<Supplier>) => void;
}

interface AIClause {
    title: string;
    description: string;
    importance: 'High' | 'Medium' | 'Low';
}

export const SupplierAIAssistant: React.FC<SupplierAIAssistantProps> = ({ supplier, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<Record<string, unknown> | null>(null);
    const [mode, setMode] = useState<'risk' | 'clauses' | 'dora' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleAction = async (action: 'risk' | 'clauses' | 'dora') => {
        setLoading(true);
        setMode(action);
        setResponse(null);
        setError(null);
        try {
            let prompt = '';
            if (action === 'risk') {
                prompt = `
                    Analyse le risque de ce fournisseur :
                    Nom : "${supplier.name}"
                    Catégorie : "${supplier.category}"
                    Criticité actuelle : "${supplier.criticality}"
                    Description : "${supplier.description || 'N/A'}"
                    
                    Estime le niveau de risque (Low, Medium, High, Critical) et fournis une justification.
                    Format de réponse JSON attendu :
                    {
                        "riskLevel": "string",
                        "justification": "string",
                        "recommendations": ["string", "string"]
                    }
                `;
            } else if (action === 'clauses') {
                prompt = `
                    Suggère des clauses contractuelles essentielles pour ce fournisseur :
                    Nom : "${supplier.name}"
                    Catégorie : "${supplier.category}"
                    Type de service : "${supplier.serviceType || 'N/A'}"
                    
                    Format de réponse JSON attendu :
                    {
                        "clauses": [
                            { "title": "string", "description": "string", "importance": "High/Medium/Low" }
                        ]
                    }
                `;
            } else if (action === 'dora') {
                prompt = `
                    Évalue la pertinence et les exigences DORA pour ce fournisseur :
                    Nom : "${supplier.name}"
                    Catégorie : "${supplier.category}"
                    Est prestataire TIC : ${supplier.isICTProvider ? 'Oui' : 'Non'}
                    Fonction critique : ${supplier.supportsCriticalFunction ? 'Oui' : 'Non'}
                    
                    Format de réponse JSON attendu :
                    {
                        "isDoraApplicable": boolean,
                        "criticalityAssessment": "string",
                        "requirements": ["string", "string"]
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
                ErrorLogger.warn("Failed to parse AI response", 'SupplierAIAssistant.handleAction', { metadata: { error: e } });
                setResponse({ text: resultText });
            }

        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'SupplierAIAssistant.handleAction', 'AI_ERROR');
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
                    <p className="text-xs text-slate-600 dark:text-slate-400">Analyse et suggestions intelligentes</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                <button
                    onClick={() => handleAction('risk')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'risk' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'risk' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />}
                    Analyse Risque
                </button>
                <button
                    onClick={() => handleAction('clauses')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'clauses' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'clauses' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Scale className="h-3.5 w-3.5 mr-2" />}
                    Clauses Contrat
                </button>
                <button
                    onClick={() => handleAction('dora')}
                    disabled={loading}
                    className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition-all ${mode === 'dora' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-indigo-900/30 border border-transparent hover:border-indigo-200'}`}
                >
                    {loading && mode === 'dora' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-2" />}
                    Conformité DORA
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
                        <button onClick={() => setResponse(null)} className="text-slate-500 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                    </div>

                    <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {mode === 'risk' && typeof response.riskLevel === 'string' && (
                            <div>
                                <p><strong>Niveau de Risque :</strong> {String(response.riskLevel)}</p>
                                <p className="mt-1"><em>{String(response.justification)}</em></p>
                                {Array.isArray(response.recommendations) && (
                                    <ul className="list-disc pl-4 mt-2 space-y-1">
                                        {response.recommendations.map((r: unknown, i: number) => <li key={i}>{String(r)}</li>)}
                                    </ul>
                                )}
                                {onUpdate && (
                                    <button
                                        onClick={() => {
                                            if (typeof response.riskLevel === 'string') {
                                                // Map risk level to Criticality if possible, or just ignore for now as Criticality is enum
                                                // Assuming AI returns compatible string or we map it.
                                                // For now just logging or simple update if matches
                                                // Better to just show it for now as Criticality enum is strict (Faible, Moyenne, etc)
                                            }
                                        }}
                                        className="mt-2 text-xs text-indigo-600 hover:underline hidden" // Hidden for now until strict mapping
                                    >
                                        Appliquer
                                    </button>
                                )}
                            </div>
                        )}
                        {mode === 'clauses' && Array.isArray(response.clauses) && (
                            <div className="space-y-3">
                                {response.clauses.map((c: AIClause, i: number) => (
                                    <div key={i} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-white/5">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{c.title}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${c.importance === 'High' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{c.importance}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">{c.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        {mode === 'dora' && (
                            <div>
                                <p><strong>Applicabilité DORA :</strong> {response.isDoraApplicable ? 'Oui' : 'Non'}</p>
                                <p className="mt-1"><strong>Analyse :</strong> {String(response.criticalityAssessment)}</p>
                                {Array.isArray(response.requirements) && (
                                    <div className="mt-2">
                                        <p className="font-bold mb-1">Exigences clés :</p>
                                        <ul className="list-disc pl-4 space-y-1">
                                            {response.requirements.map((r: unknown, i: number) => <li key={i}>{String(r)}</li>)}
                                        </ul>
                                    </div>
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
