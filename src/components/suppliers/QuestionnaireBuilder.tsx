import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { QuestionnaireTemplate } from '../../types/business';
import { Plus, Save } from '../ui/Icons';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';

import { SectionEditor } from './QuestionnaireBuilder/SectionEditor';
import { Button } from '../ui/button';
import { useSupplierDependencies } from '../../hooks/suppliers/useSupplierDependencies';
import { ConfirmModal } from '../ui/ConfirmModal';

interface Props {
    initialData?: QuestionnaireTemplate;
    onSave?: () => void;
    onCancel?: () => void;
}

export const QuestionnaireBuilder: React.FC<Props> = ({ initialData, onSave, onCancel }) => {
    const { user, addToast } = useStore();
    const { addTemplate, updateTemplate } = useSupplierDependencies({ fetchTemplates: true });

    const { register, control, handleSubmit, formState: { isSubmitting } } = useForm<QuestionnaireTemplate>({
        defaultValues: initialData || {
            title: '',
            description: '',
            sections: [{
                id: crypto.randomUUID(),
                title: 'Nouvelle Section',
                questions: [],
                weight: 100
            }],
            organizationId: user?.organizationId
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'sections'
    });

    const [sectionToDelete, setSectionToDelete] = useState<number | null>(null);

    const onSubmit = async (data: QuestionnaireTemplate) => {
        try {
            if (initialData?.id) {
                await updateTemplate(initialData.id, {
                    ...data,
                    updatedAt: undefined // firestore serverTimestamp handled by hook
                });
            } else {
                await addTemplate({
                    ...data,
                    organizationId: user?.organizationId || '',
                    createdAt: undefined
                });
            }
            addToast('Modèle enregistré avec succès', 'success');
            if (onSave) onSave();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'QuestionnaireBuilder.submit', 'UPDATE_FAILED');
        }
    };

    const handleAddSection = () => {
        append({
            id: crypto.randomUUID(),
            title: 'Nouvelle Section',
            questions: [],
            weight: 0
        });
    };

    const handleRemoveSectionClick = (index: number) => {
        if (fields.length <= 1) {
            addToast('Le questionnaire doit contenir au moins une section', 'info');
            return;
        }
        setSectionToDelete(index);
    };

    const confirmRemoveSection = () => {
        if (sectionToDelete !== null) {
            remove(sectionToDelete);
            setSectionToDelete(null);
            addToast('Section supprimée', 'info');
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-border/40 dark:border-slate-700 shadow-sm">
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label htmlFor="questionnaire-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Titre du Questionnaire <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="questionnaire-title"
                            {...register('title', { required: true })}
                            className="w-full px-4 py-2 rounded-3xl border border-border/40 dark:border-slate-600 bg-transparent focus:border-brand-500 focus:ring-1 focus-visible:ring-brand-500 transition-shadow outline-none dark:text-white"
                            placeholder="Ex: Évaluation ISO 27001 - Fournisseurs SaaS"
                        />
                    </div>
                    <div>
                        <label htmlFor="questionnaire-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                        <textarea
                            id="questionnaire-desc"
                            {...register('description')}
                            className="w-full px-4 py-2 rounded-3xl border border-border/40 dark:border-slate-600 bg-transparent focus:border-brand-500 focus:ring-1 focus-visible:ring-brand-500 transition-shadow outline-none min-h-[80px] dark:text-white"
                            placeholder="Description de l'usage de ce modèle..."
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {fields.map((field, index) => (
                    <SectionEditor
                        key={field.id}
                        control={control}
                        register={register}
                        sIndex={index}
                        onRemove={() => handleRemoveSectionClick(index)}
                    />
                ))}
            </div>

            <div className="flex justify-between items-center pt-4">
                <Button
                    variant="ghost"
                    type="button"
                    onClick={handleAddSection}
                    className="flex items-center text-sm font-medium text-brand-600 bg-brand-50 dark:bg-brand-800 hover:bg-brand-100"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter une Section
                </Button>

                <div className="flex gap-3">
                    {onCancel && (
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            className="text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            Annuler
                        </Button>
                    )}
                    <Button
                        variant="default"
                        type="submit"
                        disabled={isSubmitting}
                        className="shadow-lg shadow-brand-500/20"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {isSubmitting ? 'Enregistrement...' : 'Enregistrer le Modèle'}
                    </Button>
                </div>
            </div>

            <ConfirmModal
                isOpen={sectionToDelete !== null}
                onClose={() => setSectionToDelete(null)}
                onConfirm={confirmRemoveSection}
                title="Supprimer la section"
                message="Êtes-vous sûr de vouloir supprimer cette section et toutes ses questions ? Cette action est irréversible pour ce brouillon."
                confirmText="Supprimer"
                type="danger"
            />
        </form>
    );
};
