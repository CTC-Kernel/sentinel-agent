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
 Date de fin: ${new Date(project.dueDate).toLocaleDateString('fr-FR')}
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
 <div className="bg-gradient-to-br from-primary/10 to-violet-50 dark:from-primary/10 dark:to-violet-900/10 rounded-3xl p-6 border border-primary/20 dark:border-white/5 shadow-sm relative overflow-hidden h-full flex flex-col">
 <div className="absolute top-0 right-0 p-4 opacity-30 pointer-events-none">
 <Sparkles className="w-24 h-24 text-primary" />
 </div>

 <div className="flex items-center gap-3 mb-6 relative z-decorator">
 <div className="p-2 bg-white dark:bg-white/10 rounded-3xl shadow-sm text-primary">
  <Bot className="w-5 h-5" />
 </div>
 <div>
  <h3 className="font-bold text-foreground">Assistant Projet IA</h3>
  <p className="text-xs text-muted-foreground">Analyse, reporting et suggestions</p>
 </div>
 </div>

 {!response && !loading && (
 <div className="grid grid-cols-1 gap-3 relative z-decorator">
  <button onClick={() => handleAction('status')} className="flex items-center p-4 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-muted rounded-3xl text-sm font-medium text-foreground transition-all text-left border border-transparent hover:border-primary/20 dark:hover:border-border/40 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
  <div className="p-2 bg-info/10 text-info rounded-lg mr-4 group-hover:scale-110 transition-transform">
  <FileText className="w-5 h-5" />
  </div>
  <div>
  <span className="block font-bold text-foreground">Générer un rapport de statut</span>
  <span className="text-xs text-muted-foreground">Synthèse d'avancement pour le COPIL</span>
  </div>
  </button>

  <button onClick={() => handleAction('risks')} className="flex items-center p-4 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-muted rounded-3xl text-sm font-medium text-foreground transition-all text-left border border-transparent hover:border-primary/20 dark:hover:border-border/40 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning">
  <div className="p-2 bg-warning/10 text-warning rounded-lg mr-4 group-hover:scale-110 transition-transform">
  <AlertTriangle className="w-5 h-5" />
  </div>
  <div>
  <span className="block font-bold text-foreground">Analyser les risques</span>
  <span className="text-xs text-muted-foreground">Identifier les points de vigilance</span>
  </div>
  </button>

  <button onClick={() => handleAction('tasks')} className="flex items-center p-4 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-muted rounded-3xl text-sm font-medium text-foreground transition-all text-left border border-transparent hover:border-primary/20 dark:hover:border-border/40 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success">
  <div className="p-2 bg-success/10 text-success rounded-lg mr-4 group-hover:scale-110 transition-transform">
  <Target className="w-5 h-5" />
  </div>
  <div>
  <span className="block font-bold text-foreground">Suggérer des tâches</span>
  <span className="text-xs text-muted-foreground">Prochaines étapes recommandées</span>
  </div>
  </button>
 </div>
 )}

 {loading && (
 <div className="flex flex-col items-center justify-center py-12 text-muted-foreground flex-1">
  <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
  <p className="text-sm font-medium animate-pulse">L'IA analyse le projet...</p>
 </div>
 )}

 {response && (
 <div className="animate-fade-in relative z-decorator flex-1 flex flex-col min-h-0">
  <div className="bg-card/80 rounded-2xl p-6 text-sm text-foreground leading-relaxed shadow-sm border border-white/50 dark:border-white/5 mb-4 overflow-y-auto custom-scrollbar flex-1">
  <div className="prose dark:prose-invert max-w-none text-sm">
  <ReactMarkdown>
  {response}
  </ReactMarkdown>
  </div>
  </div>
  <button onClick={() => setResponse(null)} className="w-full py-3 bg-muted text-muted-foreground rounded-3xl text-sm font-bold hover:bg-muted dark:hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
  Retour aux options
  </button>
 </div>
 )}
 </div>
 );
};
