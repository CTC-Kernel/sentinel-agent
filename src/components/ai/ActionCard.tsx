import React, { useState } from 'react';
import { Check, Loader2, ShieldAlert } from 'lucide-react';
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

    if (!actionDef) return <div className="text-red-500 text-xs p-2">Action inconnue: {type}</div>;

    if (status === 'success') {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 p-3 bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-lg flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    {message}
                </div>
            </motion.div>
        );
    }

    if (status === 'error') {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500 dark:text-slate-400">
                {message}
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 mb-1 bg-white dark:bg-slate-950 border border-indigo-100 dark:border-indigo-900/50 rounded-xl overflow-hidden shadow-sm"
        >
            {/* Header */}
            <div className="bg-indigo-50/50 dark:bg-indigo-900/20 px-3 py-2 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
                    Action Recommandée
                </span>
            </div>

            {/* Content */}
            <div className="p-3">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    {actionDef.label}
                </h4>
                {reasoning && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 italic">
                        "{reasoning}"
                    </p>
                )}

                {/* Payload Preview */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2 mb-3 text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                    <pre className="whitespace-pre-wrap">
                        {JSON.stringify(payload, null, 2)}
                    </pre>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={handleCancel}
                        disabled={status === 'loading'}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Refuser
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={status === 'loading'}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                    >
                        {status === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
                        {status === 'loading' ? 'Exécution...' : 'Confirmer'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};
