import React, { useState } from 'react';
import { useStore } from '../../store';
import { Questionnaire, QuestionnaireQuestion, QuestionType } from '../../types';
import { sanitizeData } from '../../utils/dataSanitizer';
import { Plus, Trash2, Save, X, Move } from '../ui/Icons';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { CustomSelect } from '../ui/CustomSelect';
import { Modal } from '../ui/Modal';
import { ErrorLogger } from '../../services/errorLogger';
import { useAuditsActions } from '../../hooks/audits/useAuditsActions';

interface QuestionnaireBuilderProps {
    auditId: string;
    organizationId: string;
    onClose: () => void;
    onSave: () => void;
    initialData?: Questionnaire;
}

export const QuestionnaireBuilder: React.FC<QuestionnaireBuilderProps> = ({ auditId, organizationId, onClose, onSave, initialData }) => {
    const { user, addToast, t } = useStore();
    const { addQuestionnaire, updateQuestionnaire } = useAuditsActions();
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [dueDate, setDueDate] = useState(initialData?.dueDate || '');
    const [questions, setQuestions] = useState<QuestionnaireQuestion[]>(initialData?.questions || []);
    const [saving, setSaving] = useState(false);

    const addQuestion = () => {
        const newQuestion: QuestionnaireQuestion = {
            id: crypto.randomUUID(),
            text: '',
            type: 'text',
            required: true,
            options: []
        };
        setQuestions([...questions, newQuestion]);
    };

    const updateQuestion = (id: string, updates: Partial<QuestionnaireQuestion>) => {
        setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
    };

    const removeQuestion = (id: string) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const handleSave = async () => {
        if (!title.trim()) {
            addToast(t('audits.toast.titleRequired', { defaultValue: "Le titre est requis" }), "info");
            return;
        }
        if (questions.length === 0) {
            addToast(t('audits.toast.addAtLeastOneQuestion', { defaultValue: "Ajoutez au moins une question" }), "info");
            return;
        }

        setSaving(true);
        try {
            const questionnaireData: Partial<Questionnaire> = {
                title,
                description,
                dueDate,
                questions
            };

            if (initialData) {
                await updateQuestionnaire(initialData.id, sanitizeData(questionnaireData));
                addToast(t('audits.toast.questionnaireUpdated', { defaultValue: "Questionnaire mis à jour" }), "success");
            } else {
                await addQuestionnaire(sanitizeData({
                    ...questionnaireData,
                    auditId,
                    organizationId,
                    status: 'Draft',
                    createdBy: user?.uid || 'system'
                }) as Questionnaire);
                addToast(t('audits.toast.questionnaireCreated', { defaultValue: "Questionnaire créé" }), "success");
            }
            onSave();
            onClose();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'QuestionnaireBuilder.handleSave', 'CREATE_FAILED');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={initialData ? 'Modifier le Questionnaire' : 'Nouveau Questionnaire'}
            maxWidth="max-w-4xl"
        >
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-1 space-y-8 pr-2 custom-scrollbar">
                {/* General Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <FloatingLabelInput
                        label="Titre du questionnaire"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                    <FloatingLabelInput
                        label="Date d'échéance"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                    />
                    <div className="md:col-span-2">
                        <FloatingLabelTextarea
                            label="Description / Instructions"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <div className="border-t border-border/40 dark:border-border/40 pt-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Questions</h3>
                        <button
                            aria-label="Ajouter une question"
                            onClick={addQuestion}
                            className="flex items-center px-4 py-2 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white rounded-3xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Ajouter une question
                        </button>
                    </div>

                    <div className="space-y-4">
                        {questions.map((q, index) => (
                            <div key={q.id || 'unknown'} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-border/40 dark:border-border/40 relative group">
                                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 cursor-move opacity-0 group-hover:opacity-70 transition-opacity">
                                    <Move className="w-5 h-5" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pl-6">
                                    <div className="md:col-span-8">
                                        <FloatingLabelInput
                                            label={`Question ${index + 1}`}
                                            value={q.text}
                                            onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="md:col-span-3">
                                        <CustomSelect
                                            label="Type"
                                            value={q.type}
                                            onChange={(val) => updateQuestion(q.id, { type: val as QuestionType })}
                                            options={[
                                                { value: 'text', label: 'Texte libre' },
                                                { value: 'yes_no', label: 'Oui / Non' },
                                                { value: 'choice', label: 'Choix unique' },
                                                { value: 'multiple_choice', label: 'Choix multiple' },
                                                { value: 'rating', label: 'Note (1-5)' }
                                            ]}
                                        />
                                    </div>
                                    <div className="md:col-span-1 flex items-center justify-end">
                                        <button
                                            aria-label="Supprimer la question"
                                            onClick={() => removeQuestion(q.id)}
                                            className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Options for Choice types */}
                                    {(q.type === 'choice' || q.type === 'multiple_choice') && (
                                        <div className="md:col-span-12 pl-4 border-l-2 border-brand-200">
                                            <div className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-2 block">Options de réponse</div>
                                            <div className="space-y-2">
                                                {q.options?.map((opt, optIndex) => (
                                                    <div key={optIndex || 'unknown'} className="flex gap-2">
                                                        <input
                                                            value={opt}
                                                            aria-label={`Option ${optIndex + 1}`}
                                                            onChange={(e) => {
                                                                const newOptions = [...(q.options || [])];
                                                                newOptions[optIndex] = e.target.value;
                                                                updateQuestion(q.id, { options: newOptions });
                                                            }}
                                                            type="text"
                                                            className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-border/40 dark:border-border/40 rounded-lg text-sm transition-colors focus:border-brand-500 focus:ring-1 focus-visible:ring-primary outline-none"
                                                            placeholder={`Option ${optIndex + 1}`}
                                                        />
                                                        <button
                                                            aria-label="Supprimer l'option"
                                                            onClick={() => {
                                                                const newOptions = q.options?.filter((_, i) => i !== optIndex);
                                                                updateQuestion(q.id, { options: newOptions });
                                                            }}
                                                            className="p-2 text-muted-foreground hover:text-red-500"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    aria-label="Ajouter une option à la question"
                                                    onClick={() => updateQuestion(q.id, { options: [...(q.options || []), ''] })}
                                                    className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center mt-2"
                                                >
                                                    <Plus className="w-3 h-3 mr-1" />
                                                    Ajouter une option
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="md:col-span-12 flex items-center gap-4 mt-2">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input checked={q.required} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                                                type="checkbox"
                                                className="rounded border-border/40 text-brand-600 focus-visible:ring-primary transition-colors"
                                            />
                                            <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Obligatoire</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border/40 dark:border-border/40">
                <button
                    aria-label="Annuler les modifications"
                    onClick={onClose}
                    className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-3xl transition-colors"
                >
                    Annuler
                </button>
                <button
                    aria-label="Enregistrer le questionnaire"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center px-6 py-2 bg-brand-600 text-white rounded-3xl font-bold hover:bg-brand-700 transition-colors disabled:bg-muted disabled:text-muted-foreground shadow-lg shadow-brand-600/20"
                >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Enregistrement...' : 'Enregistrer le Questionnaire'}
                </button>
            </div>
        </Modal>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
