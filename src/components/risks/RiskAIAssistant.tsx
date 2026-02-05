import React, { useState } from 'react';
import { Risk } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, Bot, FileText, Loader2, AlertTriangle, ShieldCheck } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';

interface RiskAIAssistantProps {
 risk: Risk;
 onUpdate?: (updates: Partial<Risk>) => void;
}

export const RiskAIAssistant: React.FC<RiskAIAssistantProps> = ({ risk, onUpdate }) => {
 const [loading, setLoading] = useState(false);
 const [response, setResponse] = useState<Record<string, unknown> | null>(
 risk.aiAnalysis?.response || null
 );
 const initialMode = risk.aiAnalysis?.type;
 const [mode, setMode] = useState<'analyze' | 'mitigate' | 'improve' | null>(
 initialMode === 'analyze' || initialMode === 'mitigate' || initialMode === 'improve' ? initialMode : null
 );
 const [error, setError] = useState<string | null>(null);

 const handleAction = async (action: 'analyze' | 'mitigate' | 'improve') => {
 setLoading(true);
 setMode(action);
 setResponse(null);
 setError(null);
 try {
 let prompt = '';
 if (action === 'analyze') {
 prompt = `
  Analyse le risque suivant selon la norme ISO 27005 :
  Menace : "${risk.threat}"
  Vulnérabilité : "${risk.vulnerability}"
  Actif concerné (ID) : "${risk.assetId}"
  
  Estime la probabilité (1-5) et l'impact (1-5) avec une justification courte.
  Format de réponse JSON attendu :
  {
  "probability": number,
  "impact": number,
  "justification": "string"
  }
 `;
 } else if (action === 'mitigate') {
 prompt = `
  Suggère 3 mesures de sécurité (contrôles) concrètes pour atténuer ce risque :
  Menace : "${risk.threat}"
  Vulnérabilité : "${risk.vulnerability}"
  
  Format de réponse JSON attendu :
  {
  "measures": ["string", "string", "string"]
  }
 `;
 } else if (action === 'improve') {
 prompt = `
  Réécris et améliore la description de ce risque pour qu'elle soit plus professionnelle et précise (style ISO 27005) :
  Menace actuelle : "${risk.threat}"
  Vulnérabilité actuelle : "${risk.vulnerability}"
  
  Format de réponse JSON attendu :
  {
  "threat": "string",
  "vulnerability": "string"
  }
 `;
 }

 const resultText = await aiService.generateText(prompt);

 // Try to parse JSON
 try {
 let parsedResponse: Record<string, unknown>;
 const jsonMatch = resultText.match(/\{[\s\S]*\}/);
 if (jsonMatch) {
  parsedResponse = JSON.parse(jsonMatch[0]);
 } else {
  // Fallback for non-JSON response (should not happen with good prompt)
  parsedResponse = { text: resultText };
 }

 setResponse(parsedResponse);

 // Persist logic
 if (onUpdate) {
  onUpdate({
  aiAnalysis: {
  type: action,
  response: parsedResponse,
  timestamp: new Date().toISOString()
  }
  });
 }

 } catch (e) {
 ErrorLogger.warn("Failed to parse AI response", 'RiskAIAssistant.handleAction', { metadata: { error: e } });
 const fallback = { text: resultText };
 setResponse(fallback);
 if (onUpdate) {
  onUpdate({
  aiAnalysis: {
  type: action,
  response: fallback,
  timestamp: new Date().toISOString()
  }
  });
 }
 }

 } catch (error) {
 ErrorLogger.handleErrorWithToast(error, 'RiskAIAssistant.handleAction', 'AI_ERROR');
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
 // Handle potential string vs number issues if AI returns strings
 const prob = Number(response.probability);
 const imp = Number(response.impact);

 if (!isNaN(prob) && !isNaN(imp)) {
  await onUpdate({
  probability: prob as 1 | 2 | 3 | 4 | 5,
  impact: imp as 1 | 2 | 3 | 4 | 5,
  justification: response.justification as string
  });
 }
 } else if (mode === 'mitigate' && Array.isArray(response.measures)) {
 // Get existing measures or empty array
 const currentMeasures = risk.treatment?.measures || [];
 // Merge new measures (avoiding duplicates if possible, though simple append is safer for now)
 const newMeasures = [...new Set([...currentMeasures, ...response.measures.map(String)])];

 await onUpdate({
  treatment: {
  strategy: risk.treatment?.strategy || risk.strategy || 'Atténuer',
  ...risk.treatment,
  measures: newMeasures
  }
 });
 } else if (mode === 'improve' && typeof response.threat === 'string' && typeof response.vulnerability === 'string') {
 await onUpdate({
  threat: response.threat,
  vulnerability: response.vulnerability
 });
 }
 } finally {
 setApplying(false);
 }
 // Keep result visible
 };

 const handleDismiss = () => {
 setResponse(null);
 if (onUpdate) {
 onUpdate({
 aiAnalysis: undefined
 });
 }
 }

 return (
 <div className="bg-gradient-to-br from-primary/10 to-violet-50 dark:from-primary/20 dark:to-violet-900/20 rounded-2xl p-5 border border-primary/20 dark:border-primary/40">
 <div className="flex items-center gap-3 mb-4">
 <div className="p-2 bg-card/50 rounded-3xl shadow-sm">
  <Sparkles className="h-5 w-5 text-primary" />
 </div>
 <div>
  <h3 className="font-bold text-foreground text-sm">Assistant IA Sentinel</h3>
  <p className="text-xs text-muted-foreground">Analyse et suggestions intelligentes</p>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
 <button
  onClick={() => handleAction('analyze')}
  disabled={loading}
  className={`flex items-center justify-center px-3 py-2 rounded-3xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'analyze' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-primary/10 dark:hover:bg-primary border border-transparent hover:border-primary/30'}`}
  aria-label="Analyser le risque avec l'IA"
 >
  {loading && mode === 'analyze' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />}
  Analyser le risque
 </button>
 <button
  onClick={() => handleAction('mitigate')}
  disabled={loading}
  className={`flex items-center justify-center px-3 py-2 rounded-3xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'mitigate' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-primary/10 dark:hover:bg-primary border border-transparent hover:border-primary/30'}`}
  aria-label="Suggérer des mesures d'atténuation par IA"
 >
  {loading && mode === 'mitigate' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-2" />}
  Suggérer mesures
 </button>
 <button
  onClick={() => handleAction('improve')}
  disabled={loading}
  className={`flex items-center justify-center px-3 py-2 rounded-3xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${mode === 'improve' ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card text-muted-foreground hover:bg-primary/10 dark:hover:bg-primary border border-transparent hover:border-primary/30'}`}
  aria-label="Améliorer le texte du risque par IA"
 >
  {loading && mode === 'improve' ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-2" />}
  Améliorer texte
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
  Réponse de l'IA
  </h4>
  <button onClick={handleDismiss} className="text-muted-foreground hover:text-muted-foreground focus:outline-none focus-visible:text-foreground" aria-label="Fermer la réponse IA"><X className="h-3.5 w-3.5" /></button>
  </div>

  <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
  {mode === 'analyze' && typeof response.probability === 'number' && typeof response.impact === 'number' && (
  <div>
  <p><strong>Probabilité suggérée :</strong> {response.probability}/5</p>
  <p><strong>Impact suggéré :</strong> {response.impact}/5</p>
  <p className="mt-2"><em>{String(response.justification)}</em></p>
  </div>
  )}
  {mode === 'mitigate' && Array.isArray(response.measures) && (
  <ul className="list-disc pl-4 space-y-1">
  {response.measures.map((m: unknown, i: number) => <li key={`measure-${i || 'unknown'}`}>{String(m)}</li>)}
  </ul>
  )}
  {mode === 'improve' && typeof response.threat === 'string' && (
  <div>
  <p><strong>Nouvelle Menace :</strong> {response.threat}</p>
  <p><strong>Nouvelle Vulnérabilité :</strong> {String(response.vulnerability)}</p>
  </div>
  )}
  {typeof response.text === 'string' && <p>{response.text}</p>}
  </div>

  {onUpdate && !response.text && (
  <button
  onClick={handleApply}
  disabled={applying}
  className="mt-3 w-full flex items-center justify-center px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold transition-colors disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed dark:disabled:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
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
