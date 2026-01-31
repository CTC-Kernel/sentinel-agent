import React, { useState, useMemo } from 'react';
import { Questionnaire, UserProfile } from '../../types';
import { useStore } from '../../store';
import { Plus, FileText, Trash2, Edit, Send } from '../ui/Icons';
import { ErrorLogger } from '../../services/errorLogger';

import { QuestionnaireBuilder } from './QuestionnaireBuilder';
import { ConfirmModal } from '../ui/ConfirmModal';
import { QuestionnaireResponseView } from './QuestionnaireResponse';
import { useAuditsActions } from '../../hooks/audits/useAuditsActions';

interface QuestionnaireListProps {
    auditId: string;
    organizationId: string;
    canEdit: boolean;
    users: UserProfile[];
}

export const QuestionnaireList: React.FC<QuestionnaireListProps> = ({ auditId, organizationId, canEdit }) => {
    const { addToast, t } = useStore();
    const { questionnaires: allQuestionnaires, removeQuestionnaire } = useAuditsActions();
    const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);
    const [mode, setMode] = useState<'view' | 'edit' | 'respond' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

    // Filter questionnaires for this audit
    const questionnaires = useMemo(() => {
        return allQuestionnaires.filter(q => q.auditId === auditId && q.organizationId === organizationId);
    }, [allQuestionnaires, auditId, organizationId]);

    const handleDeleteClick = (id: string) => {
        setConfirmDelete({ isOpen: true, id });
    };

    const handleConfirmDelete = async () => {
        if (!confirmDelete.id) return;
        try {
            await removeQuestionnaire(confirmDelete.id);
            addToast(t('audits.questionnaire.deleted', { defaultValue: "Questionnaire supprimé" }), "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'QuestionnaireList.handleDelete', 'DELETE_FAILED');
        } finally {
            setConfirmDelete({ isOpen: false, id: null });
        }
    };

    if (selectedQuestionnaire && mode === 'edit') {
        return (
            <QuestionnaireBuilder
                auditId={auditId}
                organizationId={organizationId}
                initialData={selectedQuestionnaire}
                onClose={() => { setSelectedQuestionnaire(null); setMode(null); }}
                onSave={() => { setSelectedQuestionnaire(null); setMode(null); }}
            />
        );
    }

    if (selectedQuestionnaire && mode === 'respond') {
        return (
            <QuestionnaireResponseView
                questionnaire={selectedQuestionnaire}
                onClose={() => { setSelectedQuestionnaire(null); setMode(null); }}
            />
        );
    }

    if (mode === 'edit' && !selectedQuestionnaire) {
        return (
            <QuestionnaireBuilder
                auditId={auditId}
                organizationId={organizationId}
                onClose={() => setMode(null)}
                onSave={() => { setMode(null); }}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Questionnaires d'Audit</h3>
                {canEdit && (
                    <button
                        onClick={() => setMode('edit')}
                        className="flex items-center px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-3xl text-sm font-bold hover:scale-105 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nouveau Questionnaire
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {questionnaires.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-300 italic bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-border/40 dark:border-border/40">
                        Aucun questionnaire créé pour cet audit.
                    </div>
                )}
                {questionnaires.map(q => (
                    <div key={q.id || 'unknown'} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-border/40 dark:border-white/5 shadow-sm hover:shadow-md transition-all group relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-3xl">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div className="flex gap-2">
                                <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wide ${q.status === 'Published' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                                    {q.status === 'Published' ? 'Publié' : 'Brouillon'}
                                </span>
                            </div>
                        </div>

                        <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{q.title}</h4>
                        <p className="text-sm text-slate-600 dark:text-muted-foreground line-clamp-2 mb-6 h-10">
                            {q.description || "Pas de description"}
                        </p>

                        <div className="flex items-center justify-between pt-4 border-t border-border/40 dark:border-white/5">
                            <div className="text-xs font-bold text-slate-500">
                                {q.questions.length} questions
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setSelectedQuestionnaire(q); setMode('respond'); }}
                                    className="p-2 text-slate-500 dark:text-slate-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                    title="Répondre / Voir"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                                {canEdit && (
                                    <>
                                        <button
                                            onClick={() => { setSelectedQuestionnaire(q); setMode('edit'); }}
                                            className="p-2 text-slate-500 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                            title="Modifier"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(q.id)}
                                            className="p-2 text-slate-500 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, id: null })}
                onConfirm={handleConfirmDelete}
                title="Supprimer le questionnaire"
                message="Êtes-vous sûr de vouloir supprimer ce questionnaire ? Cette action est irréversible."
                confirmText="Supprimer"
                type="danger"
            />
        </div >
    );
};
