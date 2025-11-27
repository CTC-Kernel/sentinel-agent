import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Project } from '../../types';
import { AIAssistButton } from '../ai/AIAssistButton';
import { CustomSelect } from '../ui/CustomSelect';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectSchema, ProjectFormData } from '../../schemas/projectSchema';

interface ProjectFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (project: Omit<Project, 'id' | 'organizationId' | 'tasks' | 'progress' | 'createdAt'>) => void;
    existingProject?: Project;
    availableUsers?: string[]; // list of manager display names
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    existingProject,
    availableUsers = [],
}) => {
    const {
        register,
        handleSubmit,
        control,
        reset,
        setValue,
        watch,
        formState: { errors }
    } = useForm<ProjectFormData>({
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
        if (isOpen) {
            reset({
                name: existingProject?.name || '',
                description: existingProject?.description || '',
                manager: existingProject?.manager || '',
                status: existingProject?.status || 'Planifié',
                startDate: existingProject?.startDate || '',
                dueDate: existingProject?.dueDate || '',
                relatedRiskIds: existingProject?.relatedRiskIds || [],
                relatedControlIds: existingProject?.relatedControlIds || [],
                relatedAssetIds: existingProject?.relatedAssetIds || [],
            });
        }
    }, [isOpen, existingProject, reset]);

    const onFormSubmit = (data: ProjectFormData) => {
        onSubmit(data);
        onClose();
    };

    // Watch values for AI context
    const watchedName = watch('name');
    const watchedManager = watch('manager');
    const watchedDueDate = watch('dueDate');

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/10 animate-scale-in">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-white/10 px-8 py-6 flex items-center justify-between z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {existingProject ? 'Modifier le projet' : 'Nouveau Projet'}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {existingProject ? 'Mettez à jour les informations du projet' : "Définissez les détails du projet"}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                {/* Form */}
                <form onSubmit={handleSubmit(onFormSubmit)} className="p-8 space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom *</label>
                        <input
                            {...register('name')}
                            className={`w-full px-4 py-3.5 rounded-2xl border ${errors.name ? 'border-red-500' : 'border-gray-200 dark:border-white/10'} bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium`}
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                    </div>
                    {/* Description */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">Description *</label>
                            <AIAssistButton
                                context={{
                                    projectName: watchedName,
                                    manager: watchedManager,
                                    dueDate: watchedDueDate
                                }}
                                fieldName="description"
                                onSuggest={(val: string) => setValue('description', val, { shouldDirty: true, shouldValidate: true })}
                                prompt="Génère une description professionnelle et concise pour ce projet de sécurité (SSI/GRC). Inclus les objectifs principaux basés sur le nom du projet."
                            />
                        </div>
                        <textarea
                            {...register('description')}
                            className={`w-full px-4 py-3.5 rounded-2xl border ${errors.description ? 'border-red-500' : 'border-gray-200 dark:border-white/10'} bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium resize-none`}
                            rows={3}
                        />
                        {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
                    </div>
                    {/* Manager & Dates */}
                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            {availableUsers.length > 0 ? (
                                <Controller
                                    name="manager"
                                    control={control}
                                    render={({ field }) => (
                                        <CustomSelect
                                            label="Manager"
                                            value={field.value}
                                            onChange={field.onChange}
                                            options={[
                                                { value: '', label: 'Non assigné' },
                                                ...availableUsers.map(u => ({ value: u, label: u }))
                                            ]}
                                            required
                                            error={errors.manager?.message}
                                        />
                                    )}
                                />
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Manager *</label>
                                    <input
                                        {...register('manager')}
                                        className={`w-full px-4 py-3.5 rounded-2xl border ${errors.manager ? 'border-red-500' : 'border-gray-200 dark:border-white/10'} bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium`}
                                        placeholder="Nom du manager"
                                    />
                                    {errors.manager && <p className="text-red-500 text-xs mt-1">{errors.manager.message}</p>}
                                </div>
                            )}
                        </div>
                        <div>
                            <Controller
                                name="startDate"
                                control={control}
                                render={({ field }) => (
                                    <CustomDatePicker
                                        label="Date de début"
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                        <div>
                            <Controller
                                name="dueDate"
                                control={control}
                                render={({ field }) => (
                                    <CustomDatePicker
                                        label="Échéance"
                                        value={field.value}
                                        onChange={field.onChange}
                                        required
                                        error={errors.dueDate?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>
                    {/* Status */}
                    <div>
                        <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                                <CustomSelect
                                    label="Statut"
                                    value={field.value}
                                    onChange={field.onChange}
                                    options={[
                                        { value: 'Planifié', label: 'Planifié' },
                                        { value: 'En cours', label: 'En cours' },
                                        { value: 'Terminé', label: 'Terminé' },
                                        { value: 'Suspendu', label: 'Suspendu' }
                                    ]}
                                />
                            )}
                        />
                    </div>
                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button type="button" onClick={onClose} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                            Annuler
                        </button>
                        <button type="submit" className="px-8 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 hover:scale-105 transition-all font-bold text-sm shadow-lg shadow-brand-500/30">
                            {existingProject ? 'Mettre à jour' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

