import React, { useEffect } from 'react';
import { Project, Risk, Control, Asset } from '../../types';
import { AIAssistButton } from '../ai/AIAssistButton';
import { CustomSelect } from '../ui/CustomSelect';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectSchema, ProjectFormData } from '../../schemas/projectSchema';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';

interface ProjectFormProps {
    onSubmit: (project: ProjectFormData) => void;
    onCancel: () => void;
    existingProject?: Project;
    availableUsers?: string[]; // list of manager display names
    availableRisks?: Risk[];
    availableControls?: Control[];
    availableAssets?: Asset[];
    initialData?: Partial<ProjectFormData>;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
    onSubmit,
    onCancel,
    existingProject,
    availableUsers = [],
    availableRisks = [],
    availableControls = [],
    availableAssets = [],
    initialData,
}) => {
    const {
        register,
        handleSubmit,
        control,
        reset,
        setValue,
        formState: { errors }
    } = useForm<ProjectFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(projectSchema) as any,
        defaultValues: {
            name: '',
            description: '',
            manager: '',
            status: 'Planifié',
            startDate: '',
            dueDate: '',
            relatedRiskIds: [],
            relatedControlIds: [],
            relatedAssetIds: [],
        }
    });

    useEffect(() => {
        if (existingProject) {
            reset({
                name: existingProject.name || '',
                description: existingProject.description || '',
                manager: existingProject.manager || '',
                status: existingProject.status || 'Planifié',
                startDate: existingProject.startDate || '',
                dueDate: existingProject.dueDate || '',
                relatedRiskIds: existingProject.relatedRiskIds || [],
                relatedControlIds: existingProject.relatedControlIds || [],
                relatedAssetIds: existingProject.relatedAssetIds || [],
            });
        } else {
            reset({
                name: initialData?.name || '',
                description: initialData?.description || '',
                manager: initialData?.manager || '',
                status: initialData?.status || 'Planifié',
                startDate: initialData?.startDate || '',
                dueDate: initialData?.dueDate || '',
                relatedRiskIds: initialData?.relatedRiskIds || [],
                relatedControlIds: initialData?.relatedControlIds || [],
                relatedAssetIds: initialData?.relatedAssetIds || [],
            });
        }
    }, [existingProject, initialData, reset]);

    const onFormSubmit = (data: ProjectFormData) => {
        onSubmit(data);
    };

    // Watch values for AI context
    const watchedName = useWatch({ control, name: 'name' });
    const relatedRiskIds = useWatch({ control, name: 'relatedRiskIds' });

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="p-8 space-y-8 overflow-y-auto custom-scrollbar h-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="relative">
                        <FloatingLabelInput
                            label="Nom du projet"
                            {...register('name')}
                            error={errors.name?.message}
                        />
                        <div className="absolute right-2 top-2 z-10">
                            <AIAssistButton
                                context={{ relatedRisks: availableRisks.filter(r => relatedRiskIds?.includes(r.id)) }}
                                fieldName="Nom du projet"
                                prompt="Suggère un nom de projet professionnel pour traiter ces risques. Sois concis."
                                onSuggest={(val: string) => setValue('name', val, { shouldDirty: true })}
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <FloatingLabelTextarea
                            label="Description"
                            {...register('description')}
                            rows={4}
                            error={errors.description?.message}
                        />
                        <div className="absolute right-2 top-2 z-10">
                            <AIAssistButton
                                context={{ name: watchedName }}
                                fieldName="Description"
                                prompt="Rédige une description courte et professionnelle pour ce projet de sécurité."
                                onSuggest={(val: string) => setValue('description', val, { shouldDirty: true })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Controller
                            name="manager"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Responsable"
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    options={availableUsers.map(u => ({ value: u, label: u }))}
                                    placeholder="Sélectionner..."
                                />
                            )}
                        />
                        <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Statut"
                                    value={field.value || 'Planifié'}
                                    onChange={field.onChange}
                                    options={['Planifié', 'En cours', 'Terminé', 'En pause'].map(s => ({ value: s, label: s }))}
                                />
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Controller
                            name="startDate"
                            control={control}
                            render={({ field }) => (
                                <CustomDatePicker
                                    label="Date de début"
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    error={errors.startDate?.message}
                                />
                            )}
                        />
                        <Controller
                            name="dueDate"
                            control={control}
                            render={({ field }) => (
                                <CustomDatePicker
                                    label="Date de fin"
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    error={errors.dueDate?.message}
                                />
                            )}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <Controller
                        name="relatedRiskIds"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Risques liés"
                                value={field.value || []}
                                onChange={field.onChange}
                                options={availableRisks.map(r => ({ value: r.id, label: r.threat, subLabel: `Score: ${r.score}` }))}
                                multiple
                            />
                        )}
                    />

                    <Controller
                        name="relatedControlIds"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Contrôles liés"
                                value={field.value || []}
                                onChange={field.onChange}
                                options={availableControls.map(c => ({ value: c.id, label: c.code, subLabel: c.name }))}
                                multiple
                            />
                        )}
                    />

                    <Controller
                        name="relatedAssetIds"
                        control={control}
                        render={({ field }) => (
                            <CustomSelect
                                label="Actifs concernés"
                                value={field.value || []}
                                onChange={field.onChange}
                                options={availableAssets.map(a => ({ value: a.id, label: a.name }))}
                                multiple
                            />
                        )}
                    />
                </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-100 dark:border-white/5">
                <button type="button" onClick={onCancel} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                <button type="submit" className="px-8 py-3 text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform shadow-xl shadow-slate-900/20 dark:shadow-none">
                    {existingProject ? 'Enregistrer' : 'Créer le Projet'}
                </button>
            </div>
        </form>
    );
};
