import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { QuestionnaireTemplate } from '../../types/business';
import { Plus, Trash2, Save, GripVertical as Grip } from '../ui/Icons';
import { db } from '../../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';

interface Props {
    initialData?: QuestionnaireTemplate;
    onSave?: () => void;
    onCancel?: () => void;
}

export const QuestionnaireBuilder: React.FC<Props> = ({ initialData, onSave, onCancel }) => {
    const { user, addToast } = useStore();
    const { register, control, handleSubmit, formState: { isSubmitting } } = useForm<QuestionnaireTemplate>({
        defaultValues: initialData || {
            title: '',
            description: '',
            sections: [{
                id: crypto.randomUUID(),
                title: 'General Security',
                questions: []
            }],
            organizationId: user?.organizationId
        }
    });

    const { fields: sections, append: appendSection, remove: removeSection } = useFieldArray({
        control,
        name: "sections"
    });

    const onSubmit = async (data: QuestionnaireTemplate) => {
        try {
            const templateData = {
                ...data,
                organizationId: user?.organizationId,
                updatedAt: new Date().toISOString(),
                createdBy: user?.uid
            };

            if (initialData?.id) {
                await updateDoc(doc(db, 'questionnaire_templates', initialData.id), templateData);
                addToast('Modèle mis à jour', 'success');
            } else {
                await addDoc(collection(db, 'questionnaire_templates'), {
                    ...templateData,
                    createdAt: new Date().toISOString()
                });
                addToast('Nouveau modèle créé', 'success');
            }
            if (onSave) onSave();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'QuestionnaireBuilder.onSubmit', 'UPDATE_FAILED');
        }
    };

    const handleAddSection = React.useCallback(() => {
        appendSection({ id: crypto.randomUUID(), title: 'Nouvelle Section', weight: 1, questions: [] });
    }, [appendSection]);

    const handleRemoveSection = React.useCallback((index: number) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer cette section ?')) {
            removeSection(index);
        }
    }, [removeSection]);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Titre du Questionnaire</label>
                        <input
                            aria-label="Titre du Questionnaire"
                            {...register('title', { required: true })}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent"
                            placeholder="Ex: Évaluation ISO 27001 - Fournisseurs SaaS"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                        <textarea
                            aria-label="Description du Questionnaire"
                            {...register('description')}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent"
                            placeholder="Description de l'usage de ce modèle..."
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {sections.map((section, sIndex) => (
                    <SectionEditor
                        key={section.id}
                        control={control}
                        register={register}
                        sIndex={sIndex}
                        onRemove={() => handleRemoveSection(sIndex)}
                    />
                ))}
            </div>

            <div className="flex justify-between items-center pt-4">
                <button
                    aria-label="Ajouter une Section"
                    type="button"
                    onClick={handleAddSection}
                    className="flex items-center px-4 py-2 text-sm font-medium text-brand-600 bg-brand-50 dark:bg-brand-900/20 rounded-xl hover:bg-brand-100 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter une Section
                </button>

                <div className="flex gap-3">
                    {onCancel && (
                        <button
                            aria-label="Annuler"
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl"
                        >
                            Annuler
                        </button>
                    )}
                    <button
                        aria-label="Enregistrer le Modèle"
                        type="submit"
                        disabled={isSubmitting}
                        className={`flex items-center px-6 py-2 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {isSubmitting ? 'Enregistrement...' : 'Enregistrer le Modèle'}
                    </button>
                </div>
            </div>
        </form>
    );
};

import { Control, UseFormRegister } from 'react-hook-form';

const SectionEditor = ({ control, register, sIndex, onRemove }: { control: Control<QuestionnaireTemplate>, register: UseFormRegister<QuestionnaireTemplate>, sIndex: number, onRemove: () => void }) => {
    const { fields: questions, append, remove } = useFieldArray({
        control,
        name: `sections.${sIndex}.questions`
    });

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1 grid grid-cols-12 gap-4">
                    <div className="col-span-8">
                        <input
                            aria-label="Titre de la section"
                            {...register(`sections.${sIndex}.title`, { required: true })}
                            className="w-full text-lg font-bold bg-transparent border-0 border-b border-dashed border-slate-300 focus:border-brand-500 focus:ring-0 px-0"
                            placeholder="Titre de la section"
                        />
                    </div>
                    <div className="col-span-4">
                        <input
                            aria-label="Poids de la section"
                            type="number"
                            {...register(`sections.${sIndex}.weight`)}
                            className="w-full bg-transparent border border-slate-200 rounded-lg text-sm px-2 py-1"
                            placeholder="Poids (ex: 1)"
                        />
                    </div>
                </div>
                <button aria-label="Supprimer la section" type="button" onClick={onRemove} className="ml-4 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                {questions.map((q, qIndex) => (
                    <div key={q.id} className="flex gap-4 items-start bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                        <div className="mt-2 text-slate-300">
                            <Grip className="w-4 h-4 cursor-grab" />
                        </div>
                        <div className="flex-1 grid grid-cols-1 gap-3">
                            <input
                                aria-label="Question"
                                {...register(`sections.${sIndex}.questions.${qIndex}.text`, { required: true })}
                                className="w-full px-3 py-1.5 text-sm bg-transparent border border-slate-200 rounded-lg"
                                placeholder="Question..."
                            />
                            <div className="flex gap-3">
                                <select
                                    aria-label="Type de question"
                                    {...register(`sections.${sIndex}.questions.${qIndex}.type`)}
                                    className="px-3 py-1.5 text-sm bg-transparent border border-slate-200 rounded-lg text-slate-600"
                                >
                                    <option value="yes_no">Oui / Non</option>
                                    <option value="text">Texte Libre</option>
                                    <option value="rating">Score (1-5)</option>
                                    <option value="multiple_choice">Choix Multiples</option>
                                </select>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">Poids:</span>
                                    <input
                                        aria-label="Poids de la question"
                                        type="number"
                                        {...register(`sections.${sIndex}.questions.${qIndex}.weight`)}
                                        className="w-16 px-2 py-1.5 text-sm bg-transparent border border-slate-200 rounded-lg"
                                        defaultValue={1}
                                    />
                                </div>
                            </div>
                        </div>
                        <button aria-label="Supprimer la question" type="button" onClick={() => remove(qIndex)} className="text-slate-300 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}

                <button
                    aria-label="Ajouter une Question"
                    type="button"
                    onClick={() => append({ id: crypto.randomUUID(), text: '', type: 'yes_no', weight: 1, required: true })}
                    className="text-sm text-brand-600 font-medium hover:text-brand-700 flex items-center mt-2"
                >
                    <Plus className="w-3 h-3 mr-1" />
                    Ajouter une Question
                </button>
            </div>
        </div>
    );
};
