import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Control } from '../../types';
import { aiService } from '../../services/aiService';
import { Sparkles, Bot, Lightbulb, FileText, Loader2 } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';

interface ComplianceAIAssistantProps {
    control: Control;
    onApplyPolicy: (text: string) => void;
    canEdit?: boolean;
}

export const ComplianceAIAssistant: React.FC<ComplianceAIAssistantProps> = ({ control, onApplyPolicy, canEdit = true }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<string | null>(null);
    const [mode, setMode] = useState<'explain' | 'evidence' | 'policy' | null>(null);

    const handleAction = async (action: 'explain' | 'evidence' | 'policy') => {
        setLoading(true);
        setMode(action);
        setResponse(null);
        try {
            let prompt = '';
            if (action === 'explain') {
                prompt = t('ai.prompts.explain', { code: control.code, name: control.name });
            } else if (action === 'evidence') {
                prompt = t('ai.prompts.evidence', { code: control.code, name: control.name });
            } else if (action === 'policy') {
                prompt = t('ai.prompts.policy', { code: control.code, name: control.name });
            }

            const res = await aiService.chatWithAI(prompt);
            setResponse(res);
        } catch (error) {
            ErrorLogger.error(error, 'ComplianceAIAssistant.handleAction');
            setResponse("Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-brand-50 to-violet-50 dark:from-brand-900/10 dark:to-violet-900/10 rounded-3xl p-6 border border-brand-100 dark:border-white/5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-30 pointer-events-none">
                <Sparkles className="w-24 h-24 text-brand-600" />
            </div>

            <div className="flex items-center gap-3 mb-4 relative z-10">
                <div className="p-2 bg-white dark:bg-white/10 rounded-3xl shadow-sm text-brand-600 dark:text-brand-400">
                    <Bot className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">Assistant Conformité IA</h3>
                <span className="px-2 py-0.5 rounded-md bg-brand-500 text-[11px] font-bold text-white uppercase tracking-wider">IA Sentinel</span>
            </div>

            {!response && !loading && (
                <div className="grid grid-cols-1 gap-2 relative z-10">
                    <button onClick={() => handleAction('explain')} className="flex items-center p-3 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 rounded-3xl text-sm font-medium text-slate-700 dark:text-slate-200 transition-all text-left border border-transparent hover:border-brand-100 dark:hover:border-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Comprendre ce contrôle avec l'IA">
                        <Lightbulb className="w-4 h-4 mr-3 text-warning" />
                        Comprendre ce contrôle
                    </button>
                    {canEdit && (
                        <>
                            <button onClick={() => handleAction('evidence')} className="flex items-center p-3 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 rounded-3xl text-sm font-medium text-slate-700 dark:text-slate-200 transition-all text-left border border-transparent hover:border-brand-100 dark:hover:border-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Suggérer des preuves avec l'IA">
                                <FileText className="w-4 h-4 mr-3 text-info" />
                                Suggérer des preuves
                            </button>
                            <button onClick={() => handleAction('policy')} className="flex items-center p-3 bg-white/60 dark:bg-black/20 hover:bg-white dark:hover:bg-white/10 rounded-3xl text-sm font-medium text-slate-700 dark:text-slate-200 transition-all text-left border border-transparent hover:border-brand-100 dark:hover:border-border/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Générer une politique avec l'IA">
                                <Sparkles className="w-4 h-4 mr-3 text-violet-500" />
                                Générer une politique
                            </button>
                        </>
                    )}
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mb-3 text-brand-500" />
                    <p className="text-xs font-medium animate-pulse">L'IA réfléchit...</p>
                </div>
            )}

            {response && (
                <div className="animate-fade-in relative z-10">
                    <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed shadow-sm border border-white/50 dark:border-white/5 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                        <div className="prose dark:prose-invert max-w-none text-sm">
                            {response.split('\n').map((line, i) => <p key={`line-${i || 'unknown'}`} className="mb-2 last:mb-0">{line}</p>)}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setResponse(null)} className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-muted-foreground rounded-3xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Retour">
                            Retour
                        </button>
                        {mode === 'policy' && (
                            <button onClick={() => onApplyPolicy(response)} className="flex-1 py-2 bg-brand-600 text-white rounded-3xl text-xs font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Insérer la politique générée">
                                Insérer dans la justification
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
