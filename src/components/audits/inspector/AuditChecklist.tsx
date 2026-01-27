import React from 'react';
import { ClipboardCheck, BrainCircuit } from '../../ui/Icons';
import { EmptyState } from '../../ui/EmptyState';
import { useStore } from '../../../store';
import { AuditChecklist as AuditChecklistType } from '../../../types';

interface AuditChecklistProps {
    checklist: AuditChecklistType | null;
    canEdit: boolean;
    onGenerate: () => void;
    onAnswer: (questionId: string, response: 'Conforme' | 'Non-conforme' | 'Non-applicable') => void;
}

export const AuditChecklist: React.FC<AuditChecklistProps> = ({
    checklist,
    canEdit,
    onGenerate,
    onAnswer
}) => {
    const { t } = useStore();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('audits.checklist.title')}</h3>
                {canEdit && (
                    <button type="button" onClick={onGenerate} aria-label={t('audits.checklist.generateAI')} className="px-4 py-2.5 bg-white/70 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/60 dark:border-white/10 hover:border-brand-300 text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 text-sm font-medium flex items-center gap-2 rounded-xl shadow-sm hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                        <BrainCircuit className="h-4 w-4" /> {t('audits.checklist.generateAI')}
                    </button>
                )}
            </div>

            {checklist ? (
                <div className="space-y-4">
                    {checklist.questions.map(q => (
                        <div key={q.id} className="p-5 glass-panel rounded-2xl border border-white/60 dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                            <p className="font-medium text-slate-900 dark:text-white mb-4">{q.question}</p>
                            <div className="flex flex-wrap gap-2">
                                {(['Conforme', 'Non-conforme', 'Non-applicable'] as const).map(opt => (
                                    <button
                                        type="button"
                                        key={opt}
                                        onClick={() => onAnswer(q.id, opt)}
                                        aria-label={`Marquer comme ${opt}`}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                                            q.response === opt
                                                ? opt === 'Conforme'
                                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30 shadow-sm'
                                                    : opt === 'Non-conforme'
                                                        ? 'bg-red-100 text-red-700 dark:text-red-400 ring-1 ring-red-500/30 shadow-sm'
                                                        : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-1 ring-slate-500/30 shadow-sm'
                                                : 'bg-white/50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-brand-300 hover:text-brand-600 dark:hover:text-brand-400'
                                        }`}
                                    >
                                        {opt === 'Conforme' ? t('audits.checklist.responses.compliant') :
                                            opt === 'Non-conforme' ? t('audits.checklist.responses.nonCompliant') :
                                                t('audits.checklist.responses.notApplicable')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={ClipboardCheck}
                    title={t('audits.checklist.emptyTitle')}
                    description={t('audits.checklist.emptyDesc')}
                    actionLabel={canEdit ? t('audits.checklist.generateAction') : undefined}
                    onAction={canEdit ? onGenerate : undefined}
                    color="indigo"
                />
            )}
        </div>
    );
};
