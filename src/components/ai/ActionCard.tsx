import React, { useState } from 'react';
import { Check, Loader2, ShieldAlert } from '../ui/Icons';
import { AIActionType, AIActionExecutor, ActionRegistry } from '../../services/ai/actionRegistry';
import { useAuth } from '../../hooks/useAuth';
import { ErrorLogger } from '../../services/errorLogger';
import { motion } from 'framer-motion';

interface ActionCardProps {
 type: AIActionType;
 payload: Record<string, unknown>;
 reasoning?: string;
 onComplete: (result: string) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ type, payload, reasoning, onComplete }) => {
 const { user } = useAuth();
 const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
 const [message, setMessage] = useState<string | null>(null);

 const actionDef = ActionRegistry[type];

 const handleConfirm = async () => {
 if (!user) return;
 setStatus('loading');
 try {
 const resultMsg = await AIActionExecutor.execute(type, payload, user);
 setStatus('success');
 setMessage(typeof resultMsg === 'string' ? resultMsg : "Action effectuée avec succès.");
 onComplete(typeof resultMsg === 'string' ? resultMsg : "Action effectuée avec succès.");
 } catch (error) {
 ErrorLogger.error(error, 'ActionCard.handleConfirm');
 setStatus('error');
 setMessage(error instanceof Error ? error.message : "Une erreur est survenue.");
 }
 };

 const handleCancel = () => {
 setStatus('error'); // Or 'cancelled' state visually
 setMessage("Action annulée par l'utilisateur.");
 };

 if (!actionDef) return <div className="text-error text-xs p-2">Action inconnue: {type}</div>;

 if (status === 'success') {
 return (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 p-3 bg-success/5 dark:bg-success/10 border border-success/20 dark:border-success/30 rounded-lg flex items-center gap-2">
 <div className="h-6 w-6 rounded-full bg-success/10 dark:bg-success/20 flex items-center justify-center">
  <Check className="h-3.5 w-3.5 text-success" />
 </div>
 <div className="text-xs text-success font-medium">
  {message}
 </div>
 </motion.div>
 );
 }

 if (status === 'error') {
 return (
 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 p-3 bg-muted border border-border/40 rounded-lg text-xs text-muted-foreground">
 {message}
 </motion.div>
 );
 }

 return (
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="mt-3 mb-1 bg-card border border-primary/20 dark:border-primary/90 rounded-3xl overflow-hidden shadow-sm"
 >
 {/* Header */}
 <div className="bg-primary/10 dark:bg-primary px-3 py-2 border-b border-primary/20 dark:border-primary/90 flex items-center gap-2">
 <ShieldAlert className="h-3.5 w-3.5 text-primary" />
 <span className="text-xs font-bold text-primary dark:text-primary/40 uppercase tracking-wider">
  Action Recommandée
 </span>
 </div>

 {/* Content */}
 <div className="p-3">
 <h4 className="text-sm font-semibold text-foreground mb-1">
  {actionDef.label}
 </h4>
 {reasoning && (
  <p className="text-xs text-muted-foreground mb-3 italic">
  "{reasoning}"
  </p>
 )}

 {/* Payload Preview */}
 <div className="bg-muted rounded-lg p-2 mb-3 text-xs font-mono text-muted-foreground border border-border/40">
  <pre className="whitespace-pre-wrap">
  {JSON.stringify(payload, null, 2)}
  </pre>
 </div>

 {/* Actions */}
 <div className="flex gap-2">
  <button
  onClick={handleCancel}
  disabled={status === 'loading'}
  aria-label={`Refuser l'action: ${actionDef.label}`}
  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted transition-colors"
  >
  Refuser
  </button>
  <button
  onClick={handleConfirm}
  disabled={status === 'loading'}
  aria-label={`Confirmer l'action: ${actionDef.label}`}
  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-1.5"
  >
  {status === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
  {status === 'loading' ? 'Exécution...' : 'Confirmer'}
  </button>
 </div>
 </div>
 </motion.div>
 );
};
