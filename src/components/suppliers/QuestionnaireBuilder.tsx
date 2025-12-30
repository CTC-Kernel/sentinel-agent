import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { QuestionnaireTemplate } from '../../types/business';
import { Plus, Save } from '../ui/Icons';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';

import { SectionEditor } from './QuestionnaireBuilder/SectionEditor';
import { useSuppliersData } from '../../hooks/suppliers/useSuppliersData';
import { ConfirmModal } from '../ui/ConfirmModal';
// Form validation: zod schema with resolver pattern

interface Props {
    initialData?: QuestionnaireTemplate;
    onSave?: () => void;
    onCancel?: () => void;
}

export const QuestionnaireBuilder: React.FC<Props> = ({ initialData, onSave, onCancel }) => {
    const { user, addToast } = useStore();
    const { addTemplate, updateTemplate } = useSuppliersData(user?.organizationId);
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


    const [sectionToDelete, setSectionToDelete] = React.useState<number | null>(null);

    const onSubmit = async (data: QuestionnaireTemplate) => {
        try {
            const templateData = {
                ...data,
                organizationId: user?.organizationId,
                createdBy: user?.uid
            };

            if (initialData?.id) {
                await updateTemplate(initialData.id, templateData);
                addToast('Modèle mis à jour', 'success');
            } else {
                await addTemplate(templateData as QuestionnaireTemplate);
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

    const handleRemoveSectionClick = React.useCallback((index: number) => {
        setSectionToDelete(index);
    }, []);

    const confirmRemoveSection = React.useCallback(() => {
        if (sectionToDelete !== null) {
            removeSection(sectionToDelete);
            setSectionToDelete(null);
        }
    }, [sectionToDelete, removeSection]);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" >
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label htmlFor="questionnaire-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Titre du Questionnaire</label>
                        <input
                            id="questionnaire-title"
                            aria-label="Titre du Questionnaire"
                            {...register('title', { required: true })}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-shadow"
                            placeholder="Ex: Évaluation ISO 27001 - Fournisseurs SaaS"
                        />
                    </div>
                    <div>
                        <label htmlFor="questionnaire-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                        <textarea
                            id="questionnaire-desc"
                            aria-label="Description du Questionnaire"
                            {...register('description')}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-transparent focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-shadow"
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

                        onRemove={handleRemoveSectionClick}
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
            <ConfirmModal
                isOpen={sectionToDelete !== null}
                onClose={() => setSectionToDelete(null)}
                onConfirm={confirmRemoveSection}
                title="Supprimer la section"
                message="Êtes-vous sûr de vouloir supprimer cette section et toutes ses questions ?"
                confirmText="Supprimer"
                type="danger"
            />
        </form >
    );
};


