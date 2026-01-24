import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Incident } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, BrainCircuit, Loader2 } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';

interface IncidentAIAssistantProps {
    incident: Incident;
}

export const IncidentAIAssistant: React.FC<IncidentAIAssistantProps> = ({ incident }) => {
    const [analyzing, setAnalyzing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

    const handleAnalyzeIncident = async () => {
        setAnalyzing(true);
        try {
            const prompt = `
                Analyse cet incident de sécurité et fournis un rapport structuré :
                
                Titre: ${incident.title}
                Description: ${incident.description}
                Sévérité: ${incident.severity}
                Catégorie: ${incident.category}
                
                Structure attendue :
                1. Analyse de la cause racine probable (Root Cause Analysis)
                2. Impact potentiel (Business & Technique)
                3. Recommandations immédiates pour le confinement
                4. Mesures préventives à long terme
                
                Réponds en Markdown.
            `;
            const response = await aiService.chatWithAI(prompt);
            setAiAnalysis(response);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'IncidentAIAssistant.analyze', 'UNKNOWN_ERROR');
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="animate-fade-in space-y-6 h-full overflow-y-auto p-6">
            {!aiAnalysis ? (
                <div className="bg-slate-50 dark:bg-white/5 p-8 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 text-center">
                    <BrainCircuit className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">Analyse IA de l'incident</h3>
                    <p className="text-sm text-slate-600 dark:text-muted-foreground mb-6 max-w-md mx-auto">
                        L'IA peut analyser les détails de l'incident pour identifier la cause racine probable et suggérer des mesures correctives.
                    </p>
                    <button
                        onClick={handleAnalyzeIncident}
                        disabled={analyzing}
                        className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2 mx-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                    >
                        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {analyzing ? 'Analyse en cours...' : 'Lancer l\'analyse'}
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-brand-500" /> Rapport d'analyse
                        </h3>
                        <button
                            onClick={handleAnalyzeIncident}
                            disabled={analyzing}
                            className="p-2 text-muted-foreground hover:text-brand-500 hover:bg-brand-50 dark:bg-slate-900 dark:hover:bg-brand-900/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            title="Relancer l'analyse"
                        >
                            <Loader2 className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden">
                        <div className="prose dark:prose-invert max-w-none text-sm">
                            <ReactMarkdown>
                                {aiAnalysis}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
