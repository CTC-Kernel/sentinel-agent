import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Project, Risk, Control } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, Bot, FileText, Loader2, Target, AlertTriangle } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';

interface ProjectAIAssistantProps {
    project: Project;
    risks: Risk[];
    controls: Control[];
}

export const ProjectAIAssistant: React.FC<ProjectAIAssistantProps> = ({ project, risks }) => {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string | null>(null);

    const handleAction = async (action: 'status' | 'risks' | 'tasks') => {
        setLoading(true);
        setResponse(null);
        try {
            let prompt = '';
            if (action === 'status') {
                prompt = `Génère un rapport d'avancement concis pour le projet "${project.name}".
                Description: ${project.description}
                Avancement: ${project.progress}%
                Date de fin: ${new Date(project.dueDate).toLocaleDateString()}
                Tâches: ${project.tasks?.length || 0} tâches définies.
                
                Le ton doit être professionnel et adapté à un comité de pilotage.`;
            } else if (action === 'risks') {
                const projectRisks = risks.filter(r => project.relatedRiskIds?.includes(r.id));
                const riskText = projectRisks.map(r => `- ${r.threat} (Score: ${r.score})`).join('\n');
                prompt = `Analyse les risques liés au projet "${project.name}".
                Risques identifiés :
                ${riskText}
                
                Suggère des mesures d'atténuation supplémentaires ou des points de vigilance.`;
            } else if (action === 'tasks') {
                const tasksText = project.tasks?.map(t => `- ${t.title} (${t.status})`).join('\n');
                prompt = `Analyse les tâches du projet "${project.name}" et suggère 3 à 5 prochaines étapes logiques ou tâches manquantes pour assurer le succès du projet.
                Tâches actuelles :
                ${tasksText}
                
                Description du projet : ${project.description}`;
            }

            const res = await aiService.chatWithAI(prompt);
            setResponse(res);
        } catch (error) {
            ErrorLogger.error(error, 'ProjectAIAssistant.handleAction');
            setResponse("Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-3xl p-6 border border-indigo-100 dark:border-white/5 shadow-sm relative overflow-hidden h-full flex flex-col">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Sparkles className="w-24 h-24 text-indigo-600" />
            </div>

            <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="p-2 bg-white dark:bg-white/10 rounded-xl shadow-sm text-indigo-600 dark:text-indigo-400">
                    <Bot className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">Assistant Projet IA</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Analyse, reporting et suggestions</p>
                </div>
            </div>

            {!response && !loading && (
                <div className="grid grid-cols-1 gap-3 relative z-10">
                    <button onClick={() => handleAction('status')} className="flex items-center p-4 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 transition-all text-left border border-transparent hover:border-indigo-100 dark:hover:border-white/10 group">
                        <div className="p-2 bg-blue-100 dark:bg-slate-900/30 text-blue-600 dark:text-blue-400 rounded-lg mr-4 group-hover:scale-110 transition-transform">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="block font-bold text-slate-900 dark:text-white">Générer un rapport de statut</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Synthèse d'avancement pour le COPIL</span>
                        </div>
                    </button>

                    <button onClick={() => handleAction('risks')} className="flex items-center p-4 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 transition-all text-left border border-transparent hover:border-indigo-100 dark:hover:border-white/10 group">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg mr-4 group-hover:scale-110 transition-transform">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="block font-bold text-slate-900 dark:text-white">Analyser les risques</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Identifier les points de vigilance</span>
                        </div>
                    </button>

                    <button onClick={() => handleAction('tasks')} className="flex items-center p-4 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 transition-all text-left border border-transparent hover:border-indigo-100 dark:hover:border-white/10 group">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg mr-4 group-hover:scale-110 transition-transform">
                            <Target className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="block font-bold text-slate-900 dark:text-white">Suggérer des tâches</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Prochaines étapes recommandées</span>
                        </div>
                    </button>
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400 flex-1">
                    <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                    <p className="text-sm font-medium animate-pulse">L'IA analyse le projet...</p>
                </div>
            )}

            {response && (
                <div className="animate-fade-in relative z-10 flex-1 flex flex-col min-h-0">
                    <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed shadow-sm border border-white/50 dark:border-white/5 mb-4 overflow-y-auto custom-scrollbar flex-1">
                        <div className="prose dark:prose-invert max-w-none text-sm">
                            <ReactMarkdown>
                                {response}
                            </ReactMarkdown>
                        </div>
                    </div>
                    <button onClick={() => setResponse(null)} className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                        Retour aux options
                    </button>
                </div>
            )}
        </div>
    );
};
