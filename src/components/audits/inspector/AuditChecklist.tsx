import React from 'react';
import { ClipboardCheck, BrainCircuit } from 'lucide-react';
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
                <h3 className="text-lg font-bold">{t('audits.checklist.title')}</h3>
                {canEdit && (
                    <button type="button" onClick={onGenerate} aria-label={t('audits.checklist.generateAI')} className="btn-secondary text-sm flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                        <BrainCircuit className="h-4 w-4" /> {t('audits.checklist.generateAI')}
                    </button>
                )}
            </div>

            {checklist ? (
                <div className="space-y-4">
                    {checklist.questions.map(q => (
                        <div key={q.id} className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5">
                            <p className="font-medium mb-3">{q.question}</p>
                            <div className="flex gap-2">
                                {(['Conforme', 'Non-conforme', 'Non-applicable'] as const).map(opt => (
                                    <button
                                        type="button"
                                        key={opt}
                                        onClick={() => onAnswer(q.id, opt)}
                                        aria-label={`Marquer comme ${opt}`}
                                        className={`px-3 py-1 rounded-lg text-sm border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${q.response === opt ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30' : 'border-slate-200 text-slate-600'}`}
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
