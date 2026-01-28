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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 p-3 bg-slate-50 dark:bg-slate-900 border border-border/40 dark:border-slate-800 rounded-lg text-xs text-slate-500 dark:text-muted-foreground">
                {message}
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 mb-1 bg-white dark:bg-slate-950 border border-brand-100 dark:border-brand-800 rounded-3xl overflow-hidden shadow-sm"
        >
            {/* Header */}
            <div className="bg-brand-50 dark:bg-brand-800 px-3 py-2 border-b border-brand-100 dark:border-brand-800 flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                <span className="text-xs font-bold text-brand-900 dark:text-brand-200 uppercase tracking-wider">
                    Action Recommandée
                </span>
            </div>

            {/* Content */}
            <div className="p-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    {actionDef.label}
                </h4>
                {reasoning && (
                    <p className="text-xs text-slate-500 dark:text-muted-foreground mb-3 italic">
                        "{reasoning}"
                    </p>
                )}

                {/* Payload Preview */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2 mb-3 text-xs font-mono text-slate-600 dark:text-slate-300 border border-border/40 dark:border-slate-800">
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
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Refuser
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={status === 'loading'}
                        aria-label={`Confirmer l'action: ${actionDef.label}`}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                    >
                        {status === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
                        {status === 'loading' ? 'Exécution...' : 'Confirmer'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};
