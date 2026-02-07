import React, { useEffect } from 'react';
import { X, CheckCircle2, BrainCircuit, ShieldCheck } from '../ui/Icons';

import { RiskRecommendation } from '../../types';

interface RiskRecommendationsModalProps {
 isOpen: boolean;
 onClose: () => void;
 recommendations: RiskRecommendation[];
 isLoading: boolean;
}

export const RiskRecommendationsModal: React.FC<RiskRecommendationsModalProps> = ({ isOpen, onClose, recommendations, isLoading }) => {
 // Accessibility: Handle Escape key to close modal
 useEffect(() => {
 const handleEscape = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && isOpen && !isLoading) {
 onClose();
 }
 };
 if (isOpen) {
 document.addEventListener('keydown', handleEscape);
 return () => document.removeEventListener('keydown', handleEscape);
 }
 }, [isOpen, isLoading, onClose]);

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-[var(--overlay-bg)] backdrop-blur-[var(--overlay-blur)] animate-fade-in">
 <div className="bg-card w-full max-w-4xl rounded-4xl shadow-2xl border border-border/40 flex flex-col max-h-[90vh] animate-scale-in overflow-hidden">

 {/* Header */}
 <div className="p-8 border-b border-border/40 dark:border-white/5 flex justify-between items-center bg-muted/50">
  <div className="flex items-center gap-4">
  <div className="p-3 bg-primary/10 rounded-2xl">
  <BrainCircuit className="w-8 h-8 text-primary" />
  </div>
  <div>
  <h2 className="text-2xl font-bold text-foreground">Analyse IA Hybride</h2>
  <p className="text-muted-foreground">Recommandations générées par le moteur d'IA souverain (OVH)</p>
  </div>
  </div>
  <button onClick={onClose} className="p-2.5 hover:bg-muted dark:hover:bg-muted rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Fermer">
  <X className="w-6 h-6 text-muted-foreground" />
  </button>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-8 space-y-6">
  {isLoading ? (
  <div className="flex flex-col items-center justify-center py-20 space-y-6">
  <div className="relative">
  <div className="w-20 h-20 border-4 border-primary/30 border-t-brand-600 rounded-full animate-spin"></div>
  <div className="absolute inset-0 flex items-center justify-center">
   <BrainCircuit className="w-8 h-8 text-primary animate-pulse" />
  </div>
  </div>
  <div className="text-center">
  <h3 className="text-xl font-bold text-foreground mb-2">Analyse en cours...</h3>
  <p className="text-muted-foreground">Nos algorithmes analysent vos risques sur le cloud sécurisé.</p>
  </div>
  </div>
  ) : recommendations.length > 0 ? (
  <div className="grid gap-6">
  {recommendations.map((rec) => (
  <div key={rec.title || 'unknown'} className="bg-card rounded-3xl p-6 border border-border/40 dark:border-white/5 shadow-sm hover:shadow-md transition-all group">
   <div className="flex justify-between items-start mb-4">
   <div className="flex items-center gap-3">
   <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${rec.priority === 'urgent' ? 'bg-error-bg text-error-text dark:bg-error-bg/30 dark:text-error-text' :
   rec.priority === 'high' ? 'bg-warning-bg text-warning-text dark:bg-warning-bg/30 dark:text-warning-text' :
    'bg-info-bg text-info-text/30 dark:text-info-text'
   }`}>
   {rec.priority}
   </span>
   <span className="flex items-center text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-lg">
   <ShieldCheck className="w-3 h-3 mr-1" />
   Confiance: {(rec.confidence_score * 100).toFixed(0)}%
   </span>
   </div>
   </div>

   <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
   {rec.title}
   </h3>
   <p className="text-muted-foreground mb-6 leading-relaxed">
   {rec.description}
   </p>

   <div className="bg-muted/50 dark:bg-black/20 rounded-2xl p-5">
   <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Actions Suggérées</h4>
   <ul className="space-y-3">
   {rec.suggested_actions.map((action) => (
   <li key={action.action || 'unknown'} className="flex items-start gap-3 text-sm text-foreground">
    <div className="mt-0.5 p-1 bg-primary/15 dark:bg-primary rounded-full text-primary">
    <CheckCircle2 className="w-3 h-3" />
    </div>
    {action.action}
   </li>
   ))}
   </ul>
   </div>
  </div>
  ))}
  </div>
  ) : (
  <div className="text-center py-20">
  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
  <CheckCircle2 className="w-10 h-10 text-muted-foreground" />
  </div>
  <h3 className="text-xl font-bold text-foreground mb-2">Tout semble correct</h3>
  <p className="text-muted-foreground">L'IA n'a détecté aucune recommandation critique pour le moment.</p>
  </div>
  )}
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-border/40 dark:border-white/5 bg-muted/50 flex justify-end">
  <button
  onClick={onClose}
  className="px-6 py-3 bg-card border border-border/40 rounded-3xl font-bold text-foreground dark:text-white hover:bg-muted/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  >
  Fermer
  </button>
 </div>
 </div>
 </div>
 );
};
