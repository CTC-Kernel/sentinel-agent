import React, { useState } from 'react';
import { Supplier } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, Bot, Loader2, AlertTriangle, ShieldCheck, Scale } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { useLocale } from '../../hooks/useLocale';

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
 const { t } = useLocale();
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
 setError(t('suppliers.aiAssistant.error', { defaultValue: "Désolé, une erreur est survenue lors de l'analyse." }));
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
  <h3 className="font-bold text-foreground text-sm">{t('suppliers.aiAssistant.title', { defaultValue: 'Assistant IA Sentinel' })}</h3>
  <p className="text-xs text-muted-foreground">{t('suppliers.aiAssistant.subtitle', { defaultValue: 'Analyse et suggestions intelligentes' })}</p>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
 <button
  onClick={() => handleAction('risk')}
  disabled={loading}
  className={`flex items-center justify-center px-3 py-2 rounded-3xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'risk' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-primary/10 dark:hover:bg-primary border border-transparent hover:border-primary/30'}`}
  aria-label={t('suppliers.aiAssistant.riskAnalysisAria', { defaultValue: "Lancer l'analyse de risque par IA" })}
 >
  {loading && mode === 'risk' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />}
  {t('suppliers.aiAssistant.riskAnalysis', { defaultValue: 'Analyse Risque' })}
 </button>
 <button
  onClick={() => handleAction('clauses')}
  disabled={loading}
  className={`flex items-center justify-center px-3 py-2 rounded-3xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'clauses' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-primary/10 dark:hover:bg-primary border border-transparent hover:border-primary/30'}`}
  aria-label={t('suppliers.aiAssistant.clausesAria', { defaultValue: 'Suggérer des clauses contractuelles par IA' })}
 >
  {loading && mode === 'clauses' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Scale className="h-3.5 w-3.5 mr-2" />}
  {t('suppliers.aiAssistant.contractClauses', { defaultValue: 'Clauses Contrat' })}
 </button>
 <button
  onClick={() => handleAction('dora')}
  disabled={loading}
  className={`flex items-center justify-center px-3 py-2 rounded-3xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'dora' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-primary/10 dark:hover:bg-primary border border-transparent hover:border-primary/30'}`}
  aria-label={t('suppliers.aiAssistant.doraComplianceAria', { defaultValue: 'Vérifier la conformité DORA par IA' })}
 >
  {loading && mode === 'dora' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-2" />}
  {t('suppliers.aiAssistant.doraCompliance', { defaultValue: 'Conformité DORA' })}
 </button>
 </div>

 {error && (
 <div className="text-xs text-error mb-2">{error}</div>
 )}

 {response && (
 <div className="glass-premium rounded-3xl p-4 border border-primary/20 dark:border-primary/80 shadow-sm animate-fade-in relative overflow-hidden">
  <div className="flex justify-between items-start mb-2">
  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center">
  <Bot className="h-3.5 w-3.5 mr-1.5" />
  {t('suppliers.aiAssistant.aiResponse', { defaultValue: "Réponse de l'IA" })}
  </h4>
  <button onClick={() => setResponse(null)} className="text-muted-foreground hover:text-muted-foreground focus-visible:outline-none focus-visible:text-foreground" aria-label={t('suppliers.aiAssistant.closeAria', { defaultValue: 'Fermer la réponse IA' })}><X className="h-3.5 w-3.5" /></button>
  </div>

  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
  {mode === 'risk' && typeof response.riskLevel === 'string' && (
  <div>
  <p><strong>{t('suppliers.aiAssistant.riskLevel', { defaultValue: 'Niveau de Risque' })} :</strong> {String(response.riskLevel)}</p>
  <p className="mt-1"><em>{String(response.justification)}</em></p>
  {Array.isArray(response.recommendations) && (
   <ul className="list-disc pl-4 mt-2 space-y-1">
   {response.recommendations.map((r: unknown, i: number) => <li key={`rec-${i || 'unknown'}`}>{String(r)}</li>)}
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
   className="mt-2 text-xs text-primary hover:underline hidden" // Hidden for now until strict mapping
   >
   {t('suppliers.aiAssistant.apply', { defaultValue: 'Appliquer' })}
   </button>
  )}
  </div>
  )}
  {mode === 'clauses' && Array.isArray(response.clauses) && (
  <div className="space-y-3">
  {response.clauses.map((c: AIClause, i: number) => (
   <div key={`risk-${i || 'unknown'}`} className="bg-muted/50 p-3 rounded-lg border border-border/40 dark:border-white/5">
   <div className="flex justify-between items-center mb-1">
   <span className="font-bold text-foreground">{c.title}</span>
   <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${c.importance === 'High' ? 'bg-error/10 text-error' : 'bg-info/10 text-info'}`}>{c.importance}</span>
   </div>
   <p className="text-xs text-muted-foreground">{c.description}</p>
   </div>
  ))}
  </div>
  )}
  {mode === 'dora' && (
  <div>
  <p><strong>{t('suppliers.aiAssistant.doraApplicability', { defaultValue: 'Applicabilité DORA' })} :</strong> {response.isDoraApplicable ? t('common.yes', { defaultValue: 'Oui' }) : t('common.no', { defaultValue: 'Non' })}</p>
  <p className="mt-1"><strong>{t('suppliers.aiAssistant.analysis', { defaultValue: 'Analyse' })} :</strong> {String(response.criticalityAssessment)}</p>
  {Array.isArray(response.requirements) && (
   <div className="mt-2">
   <p className="font-bold mb-1">{t('suppliers.aiAssistant.keyRequirements', { defaultValue: 'Exigences clés' })} :</p>
   <ul className="list-disc pl-4 space-y-1">
   {response.requirements.map((r: unknown, i: number) => <li key={`req-${i || 'unknown'}`}>{String(r)}</li>)}
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
