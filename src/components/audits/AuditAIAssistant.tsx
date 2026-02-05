import React, { useState } from 'react';
import { Audit, Finding } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, Bot, Loader2, FileText, ClipboardCheck, AlertTriangle } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { useLocale } from '@/hooks/useLocale';

interface AuditAIAssistantProps {
 audit: Audit;
 findings: Finding[];
 onUpdate?: (updates: Partial<Audit>) => void;
}

export const AuditAIAssistant: React.FC<AuditAIAssistantProps> = ({ audit, findings, onUpdate }) => {
 const { t } = useLocale();
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
 setError(t('audits.aiAssistant.error', { defaultValue: "Désolé, une erreur est survenue lors de l'analyse." }));
 } finally {
 setLoading(false);
 }
 };

 return (
 <div className="bg-gradient-to-br from-primary/10 to-violet-50 dark:from-primary/20 dark:to-violet-900/20 rounded-2xl p-5 border border-primary/20 dark:border-primary/40">
 <div className="flex items-center gap-3 mb-4">
 <div className="p-2 bg-card/50 rounded-3xl shadow-sm">
  <Sparkles className="h-5 w-5 text-primary" />
 </div>
 <div>
  <h3 className="font-bold text-foreground text-sm">{t('audits.aiAssistant.title', { defaultValue: 'Assistant IA Sentinel' })}</h3>
  <p className="text-xs text-muted-foreground">{t('audits.aiAssistant.subtitle', { defaultValue: 'Analyse et rapports intelligents' })}</p>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
 <button
  onClick={() => handleAction('summary')}
  disabled={loading}
  className={`flex items-center justify-center px-3 py-2 rounded-3xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'summary' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-primary/10 dark:hover:bg-primary border border-transparent hover:border-primary/30'}`}
  aria-label={t('audits.aiAssistant.generateSummary', { defaultValue: 'Générer un résumé exécutif' })}
 >
  {loading && mode === 'summary' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-2" />}
  {t('audits.aiAssistant.executiveSummary', { defaultValue: 'Résumé Exécutif' })}
 </button>
 <button
  onClick={() => handleAction('analysis')}
  disabled={loading}
  className={`flex items-center justify-center px-3 py-2 rounded-3xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'analysis' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-primary/10 dark:hover:bg-primary border border-transparent hover:border-primary/30'}`}
  aria-label={t('audits.aiAssistant.analyzeFindings', { defaultValue: 'Analyser les constats' })}
 >
  {loading && mode === 'analysis' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />}
  {t('audits.aiAssistant.findingsAnalysis', { defaultValue: 'Analyse Constats' })}
 </button>
 <button
  onClick={() => handleAction('scope')}
  disabled={loading}
  className={`flex items-center justify-center px-3 py-2 rounded-3xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'scope' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-primary/10 dark:hover:bg-primary border border-transparent hover:border-primary/30'}`}
  aria-label={t('audits.aiAssistant.reviewScope', { defaultValue: 'Revoir le périmètre' })}
 >
  {loading && mode === 'scope' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5 mr-2" />}
  {t('audits.aiAssistant.scopeReview', { defaultValue: 'Revue Périmètre' })}
 </button>
 </div>

 {error && (
 <div className="text-xs text-error mb-2">{error}</div>
 )}

 {response && (
 <div className="bg-card rounded-3xl p-4 border border-primary/20 dark:border-primary/80 shadow-sm animate-fade-in">
  <div className="flex justify-between items-start mb-2">
  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center">
  <Bot className="h-3.5 w-3.5 mr-1.5" />
  {t('audits.aiAssistant.aiResponse', { defaultValue: "Réponse de l'IA" })}
  </h4>
  <button onClick={() => setResponse(null)} className="text-muted-foreground hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded" aria-label={t('audits.aiAssistant.closeResponse', { defaultValue: 'Fermer la réponse IA' })}><X className="h-3.5 w-3.5" /></button>
  </div>

  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
  {mode === 'summary' && typeof response.summary === 'string' && (
  <div>
  <p>{String(response.summary)}</p>
  {Array.isArray(response.keyTakeaways) && (
   <div className="mt-2">
   <p className="font-bold mb-1">{t('audits.aiAssistant.keyTakeaways', { defaultValue: 'Points Clés :' })}</p>
   <ul className="list-disc pl-4 space-y-1">
   {response.keyTakeaways.map((r: unknown, i: number) => <li key={`takeaway-${i || 'unknown'}`}>{String(r)}</li>)}
   </ul>
   </div>
  )}
  <p className="mt-2 text-xs font-bold text-primary">{t('audits.aiAssistant.overallRating', { defaultValue: 'Note Globale:' })} {String(response.overallRating)}</p>
  </div>
  )}
  {mode === 'analysis' && Array.isArray(response.rootCauses) && (
  <div>
  <p className="font-bold mb-1">{t('audits.aiAssistant.rootCauses', { defaultValue: 'Causes Racines :' })}</p>
  <ul className="list-disc pl-4 mb-2 space-y-1">
   {response.rootCauses.map((r: unknown, i: number) => <li key={`cause-${i || 'unknown'}`}>{String(r)}</li>)}
  </ul>
  <p className="font-bold mb-1">{t('audits.aiAssistant.recommendations', { defaultValue: 'Recommandations :' })}</p>
  <ul className="list-disc pl-4 space-y-1">
   {Array.isArray(response.recommendations) && response.recommendations.map((r: unknown, i: number) => <li key={`rec-${i || 'unknown'}`}>{String(r)}</li>)}
  </ul>
  </div>
  )}
  {mode === 'scope' && Array.isArray(response.suggestions) && (
  <div>
  <p className="font-bold mb-1">{t('audits.aiAssistant.suggestions', { defaultValue: 'Suggestions :' })}</p>
  <ul className="list-disc pl-4 mb-2 space-y-1">
   {response.suggestions.map((r: unknown, i: number) => <li key={`sugg-${i || 'unknown'}`}>{String(r)}</li>)}
  </ul>
  {Array.isArray(response.missingAreas) && response.missingAreas.length > 0 && (
   <>
   <p className="font-bold mb-1">{t('audits.aiAssistant.missingAreas', { defaultValue: 'Zones Manquantes :' })}</p>
   <ul className="list-disc pl-4 space-y-1">
   {response.missingAreas.map((r: unknown, i: number) => <li key={`missing-${i || 'unknown'}`}>{String(r)}</li>)}
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
   className="mt-2 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
   aria-label={t('audits.aiAssistant.addToScope', { defaultValue: 'Ajouter les suggestions au périmètre' })}
   >
   {t('audits.aiAssistant.addToScopeButton', { defaultValue: 'Ajouter au périmètre' })}
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
