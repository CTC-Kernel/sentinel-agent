import React, { useState } from 'react';
import { Asset, Criticality } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, Bot, Loader2, AlertTriangle, ShieldCheck, Wrench } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';
import { useLocale } from '../../hooks/useLocale';

interface AssetAIAssistantProps {
 asset: Asset;
 onUpdate?: (updates: Partial<Asset>) => void;
}

export const AssetAIAssistant: React.FC<AssetAIAssistantProps> = ({ asset, onUpdate }) => {
 const { t } = useLocale();
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
 setError(t('assets.aiAssistant.error', { defaultValue: "Désolé, une erreur est survenue lors de l'analyse." }));
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
 <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-4xl p-6 border border-border/40 relative overflow-hidden">
 <div className="absolute inset-0 bg-white/40 dark:bg-black/20 backdrop-blur-sm pointer-events-none" />
 <div className="relative z-10">
 <div className="flex items-center gap-3 mb-6">
  <div className="p-2.5 bg-card rounded-2xl shadow-sm border border-border/40">
  <Sparkles className="h-5 w-5 text-primary" />
  </div>
  <div>
  <h3 className="font-bold text-foreground text-base">{t('assets.aiAssistant.title', { defaultValue: 'Assistant IA Sentinel' })}</h3>
  <p className="text-xs text-muted-foreground">{t('assets.aiAssistant.subtitle', { defaultValue: 'Expertise ISO 27001 & Automatisation' })}</p>
  </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
  <button
  onClick={() => handleAction('analyze')}
  disabled={loading}
  aria-label={t('assets.aiAssistant.analyzeAriaLabel', { defaultValue: "Lancer l'analyse de criticité" })}
  className={`flex items-center justify-center px-4 py-2.5 rounded-2xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${mode === 'analyze' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' : 'bg-card/80 text-muted-foreground hover:bg-card border border-border/40 hover:border-primary/30'}`}
  >
  {loading && mode === 'analyze' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />}
  {t('assets.aiAssistant.analyzeISO', { defaultValue: 'Analyse ISO' })}
  </button>
  <button
  onClick={() => handleAction('maintenance')}
  disabled={loading}
  aria-label={t('assets.aiAssistant.maintenanceAriaLabel', { defaultValue: 'Générer un plan de maintenance' })}
  className={`flex items-center justify-center px-4 py-2.5 rounded-2xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${mode === 'maintenance' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' : 'bg-card/80 text-muted-foreground hover:bg-card border border-border/40 hover:border-primary/30'}`}
  >
  {loading && mode === 'maintenance' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Wrench className="h-3.5 w-3.5 mr-2" />}
  {t('assets.aiAssistant.maintenance', { defaultValue: 'Maintenance' })}
  </button>
  <button
  onClick={() => handleAction('optimize')}
  disabled={loading}
  aria-label={t('assets.aiAssistant.optimizeAriaLabel', { defaultValue: "Obtenir des suggestions d'optimisation" })}
  className={`flex items-center justify-center px-4 py-2.5 rounded-2xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${mode === 'optimize' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]' : 'bg-card/80 text-muted-foreground hover:bg-card border border-border/40 hover:border-primary/30'}`}
  >
  {loading && mode === 'optimize' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-2" />}
  {t('assets.aiAssistant.optimization', { defaultValue: 'Optimisation' })}
  </button>
 </div>

 {error && (
  <div className="text-xs text-destructive mb-4 px-2">{error}</div>
 )}

 {response && (
  <div className="bg-card/90 rounded-3xl p-5 border border-border/40 shadow-sm animate-fade-in backdrop-blur-md">
  <div className="flex justify-between items-start mb-2">
  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center">
  <Bot className="h-3.5 w-3.5 mr-1.5" />
  {t('assets.aiAssistant.aiResponse', { defaultValue: "Réponse de l'IA" })}
  </h4>
  <button onClick={handleDismiss} aria-label={t('assets.aiAssistant.closeAriaLabel', { defaultValue: 'Fermer la réponse IA' })} className="text-muted-foreground hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"><X className="h-3.5 w-3.5" /></button>
  </div>

  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
  {mode === 'analyze' && typeof response.confidentiality === 'string' && (
  <div>
   <p><strong>{t('assets.aiAssistant.confidentiality', { defaultValue: 'Confidentialité' })} :</strong> {String(response.confidentiality)}</p>
   <p><strong>{t('assets.aiAssistant.integrity', { defaultValue: 'Intégrité' })} :</strong> {String(response.integrity)}</p>
   <p><strong>{t('assets.aiAssistant.availability', { defaultValue: 'Disponibilité' })} :</strong> {String(response.availability)}</p>
   <p className="mt-2"><em>{String(response.justification)}</em></p>
  </div>
  )}
  {mode === 'maintenance' && Array.isArray(response.tasks) && (
  <div>
   <p className="mb-1"><strong>{t('assets.aiAssistant.suggestedFrequency', { defaultValue: 'Fréquence suggérée' })} :</strong> {String(response.frequency)}</p>
   <ul className="list-disc pl-4 space-y-1">
   {response.tasks.map((t: unknown, i: number) => <li key={`task-${i || 'unknown'}`}>{String(t)}</li>)}
   </ul>
  </div>
  )}
  {mode === 'optimize' && Array.isArray(response.suggestions) && (
  <ul className="list-disc pl-4 space-y-1">
   {response.suggestions.map((s: unknown, i: number) => <li key={`sugg-${i || 'unknown'}`}>{String(s)}</li>)}
  </ul>
  )}
  {typeof response.text === 'string' && <p>{response.text}</p>}
  </div>

  {onUpdate && mode === 'analyze' && !response.text && (
  <button
  onClick={handleApply}
  disabled={applying}
  aria-label={t('assets.aiAssistant.applyAriaLabel', { defaultValue: 'Appliquer les recommandations de criticité' })}
  className="mt-3 w-full flex items-center justify-center px-3 py-2 bg-primary hover:bg-primary/80 text-white rounded-3xl text-xs font-bold transition-colors disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
  >
  {applying ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-2" />}
  {applying ? t('assets.aiAssistant.applying', { defaultValue: 'Application...' }) : t('assets.aiAssistant.applyChanges', { defaultValue: 'Appliquer les changements' })}
  </button>
  )}
  </div>
 )}
 </div>
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
 );
}
