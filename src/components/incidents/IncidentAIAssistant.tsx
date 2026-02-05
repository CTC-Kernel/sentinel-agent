import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Incident } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, BrainCircuit, Loader2, RefreshCw, AlertTriangle } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { useLocale } from '../../hooks/useLocale';

interface IncidentAIAssistantProps {
 incident: Incident;
}

export const IncidentAIAssistant: React.FC<IncidentAIAssistantProps> = ({ incident }) => {
 const { t } = useLocale();
 const [analyzing, setAnalyzing] = useState(false);
 const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
 const [analysisError, setAnalysisError] = useState<string | null>(null);

 const handleAnalyzeIncident = async () => {
 setAnalyzing(true);
 setAnalysisError(null);
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
 ErrorLogger.error(error, 'IncidentAIAssistant.analyze');
 setAnalysisError(t('incidents.ai.analysisError', { defaultValue: 'L\'analyse IA a échoué. Vérifiez votre connexion et réessayez.' }));
 } finally {
 setAnalyzing(false);
 }
 };

 return (
 <div className="animate-fade-in space-y-6 h-full overflow-y-auto p-6">
 {!aiAnalysis ? (
 <div className="bg-muted/50 dark:bg-white/5 p-8 rounded-3xl border border-dashed border-border/40 text-center">
  <BrainCircuit className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
  <h3 className="font-bold text-foreground mb-2">{t('incidents.ai.title', { defaultValue: 'Analyse IA de l\'incident' })}</h3>
  <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
  {t('incidents.ai.description', { defaultValue: 'L\'IA peut analyser les détails de l\'incident pour identifier la cause racine probable et suggérer des mesures correctives.' })}
  </p>
  {analysisError && (
  <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-left">
  <div className="flex items-center gap-2 mb-2">
  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
  <span className="text-sm font-bold text-red-700 dark:text-red-400">{t('incidents.ai.errorTitle', { defaultValue: 'Erreur d\'analyse' })}</span>
  </div>
  <p className="text-xs text-red-600 dark:text-red-400 mb-3">{analysisError}</p>
  <button
  onClick={handleAnalyzeIncident}
  disabled={analyzing}
  className="px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-xl font-bold text-xs transition-all flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
  >
  <RefreshCw className={`h-3.5 w-3.5 ${analyzing ? 'animate-spin' : ''}`} />
  {t('common.retry', { defaultValue: 'Réessayer' })}
  </button>
  </div>
  )}
  {!analysisError && (
  <button
  onClick={handleAnalyzeIncident}
  disabled={analyzing}
  className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-3xl font-bold text-sm transition-all shadow-lg shadow-primary/20 flex items-center gap-2 mx-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
  >
  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
  {analyzing ? t('incidents.ai.analyzing', { defaultValue: 'Analyse en cours...' }) : t('incidents.ai.startAnalysis', { defaultValue: 'Lancer l\'analyse' })}
  </button>
  )}
 </div>
 ) : (
 <div className="space-y-4">
  <div className="flex justify-between items-center">
  <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
  <Sparkles className="h-5 w-5 text-primary" /> {t('incidents.ai.report', { defaultValue: 'Rapport d\'analyse' })}
  </h3>
  <button
  onClick={handleAnalyzeIncident}
  disabled={analyzing}
  className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 dark:hover:bg-primary rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  title={t('incidents.ai.relaunchAnalysis', { defaultValue: 'Relancer l\'analyse' })}
  >
  <Loader2 className={`h-4 w-4 ${analyzing ? 'animate-spin' : ''}`} />
  </button>
  </div>
  <div className="bg-card p-6 rounded-2xl border border-border/40 dark:border-white/5 shadow-sm overflow-hidden">
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
