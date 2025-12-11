import React, { useState } from 'react';
import { useStore } from '../../store';
import { Questionnaire, QuestionnaireQuestion, QuestionType } from '../../types';
import { addDoc, collection, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { sanitizeData } from '../../utils/dataSanitizer';
import { Plus, Trash2, Save, X, Move } from '../ui/Icons';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { CustomSelect } from '../ui/CustomSelect';
import { ErrorLogger } from '../../services/errorLogger';

interface QuestionnaireBuilderProps {
    auditId: string;
    organizationId: string;
    onClose: () => void;
    onSave: () => void;
    initialData?: Questionnaire;
}

export const QuestionnaireBuilder: React.FC<QuestionnaireBuilderProps> = ({ auditId, organizationId, onClose, onSave, initialData }) => {
    const { user, addToast } = useStore();
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
            addToast("Le titre est requis", "info");
            return;
        }
        if (questions.length === 0) {
            addToast("Ajoutez au moins une question", "info");
            return;
        }

        setSaving(true);
        try {
            const questionnaireData: Partial<Questionnaire> = {
                title,
                description,
                dueDate,
                questions,
                updatedAt: new Date().toISOString()
            };

            if (initialData) {
                await updateDoc(doc(db, 'questionnaires', initialData.id), sanitizeData(questionnaireData));
                addToast("Questionnaire mis à jour", "success");
            } else {
                await addDoc(collection(db, 'questionnaires'), sanitizeData({
                    ...questionnaireData,
                    auditId,
                    organizationId,
                    status: 'Draft',
                    createdBy: user?.uid || 'system',
                    createdAt: new Date().toISOString()
                }));
                addToast("Questionnaire créé", "success");
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {initialData ? 'Modifier le Questionnaire' : 'Nouveau Questionnaire'}
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            Configurez les questions pour vos audités
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* General Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                    <div className="border-t border-gray-200 dark:border-white/10 pt-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Questions</h3>
                            <button
                                onClick={addQuestion}
                                className="flex items-center px-4 py-2 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Ajouter une question
                            </button>
                        </div>

                        <div className="space-y-4">
                            {questions.map((q, index) => (
                                <div key={q.id} className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-gray-200 dark:border-white/10 relative group">
                                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
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
                                                onClick={() => removeQuestion(q.id)}
                                                className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>

                                        {/* Options for Choice types */}
                                        {(q.type === 'choice' || q.type === 'multiple_choice') && (
                                            <div className="md:col-span-12 pl-4 border-l-2 border-brand-500/20">
                                                <label className="text-xs font-bold uppercase text-slate-600 mb-2 block">Options de réponse</label>
                                                <div className="space-y-2">
                                                    {q.options?.map((opt, optIndex) => (
                                                        <div key={optIndex} className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={opt}
                                                                onChange={(e) => {
                                                                    const newOptions = [...(q.options || [])];
                                                                    newOptions[optIndex] = e.target.value;
                                                                    updateQuestion(q.id, { options: newOptions });
                                                                }}
                                                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-lg text-sm"
                                                                placeholder={`Option ${optIndex + 1}`}
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const newOptions = q.options?.filter((_, i) => i !== optIndex);
                                                                    updateQuestion(q.id, { options: newOptions });
                                                                }}
                                                                className="p-2 text-slate-500 hover:text-red-500"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
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
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={q.required}
                                                    onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                                                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                                />
                                                <span className="text-sm text-slate-600 dark:text-slate-300">Obligatoire</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-white/5 rounded-xl transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center px-6 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Enregistrement...' : 'Enregistrer le Questionnaire'}
                    </button>
                </div>
            </div>
        </div>
    );
};
