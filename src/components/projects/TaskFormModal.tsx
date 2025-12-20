import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Target } from 'lucide-react';
import { ProjectTask, UserProfile } from '../../types';
import { AddToCalendar } from '../../components/ui/AddToCalendar';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { CustomSelect } from '../ui/CustomSelect';
import { DatePicker } from '../ui/DatePicker';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectTaskSchema, ProjectTaskFormData } from '../../schemas/projectSchema';

interface TaskFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (task: Omit<ProjectTask, 'id'>) => void;
    existingTask?: ProjectTask;
    availableTasks?: ProjectTask[]; // For dependencies
    availableUsers?: UserProfile[]; // For assignee selection
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    existingTask,
    availableTasks = [],
    availableUsers = []
}) => {
    const {
        register,
        handleSubmit,
        reset,
        setValue,
        control,
        formState: { errors }
    } = useForm<ProjectTaskFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(projectTaskSchema) as any,
        defaultValues: {
            title: '',
            description: '',
            status: 'A faire',
            assignee: '',
            assigneeId: '',
            startDate: '',
            dueDate: '',
            priority: 'medium',
            estimatedHours: undefined,
            actualHours: undefined,
            dependencies: [],
            progress: 0
        }
    });

    useEffect(() => {
        if (isOpen) {
            reset({
                title: existingTask?.title || '',
                description: existingTask?.description || '',
                status: existingTask?.status || 'A faire',
                assignee: existingTask?.assignee || '',
                assigneeId: existingTask?.assigneeId || '',
                startDate: existingTask?.startDate || '',
                dueDate: existingTask?.dueDate || '',
                priority: existingTask?.priority || 'medium',
                estimatedHours: existingTask?.estimatedHours,
                actualHours: existingTask?.actualHours,
                dependencies: existingTask?.dependencies || [],
                progress: existingTask?.progress || 0
            });
        }
    }, [isOpen, existingTask, reset]);

    const onFormSubmit = (data: ProjectTaskFormData) => {
        onSubmit(data);
        onClose();
    };


    const progress = useWatch({ control, name: 'progress' });
    const watchedTitle = useWatch({ control, name: 'title' });
    const watchedDescription = useWatch({ control, name: 'description' });
    const watchedStartDate = useWatch({ control, name: 'startDate' });
    const watchedDueDate = useWatch({ control, name: 'dueDate' });

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-max flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="glass-panel rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20 animate-scale-in relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-white/10 dark:to-transparent pointer-events-none" />
                {/* Header */}
                {/* Header */}
                <div className="sticky top-0 glass-panel border-b border-white/10 px-8 py-6 flex items-center justify-between z-10 backdrop-blur-md">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {existingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}
                        </h2>
                        <p className="text-sm text-slate-600 mt-1">
                            Définissez les détails de la tâche du projet
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onFormSubmit)} className="p-8 space-y-6 relative z-10">
                    {/* Title */}
                    <div>
                        <Controller
                            name="title"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label="Titre de la tâche"
                                    value={field.value}
                                    onChange={field.onChange}
                                    error={errors.title?.message}
                                />
                            )}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <Controller
                            name="description"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label="Description"
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    textarea
                                />
                            )}
                        />
                    </div>

                    {/* Row 1: Status & Priority */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Controller
                                name="status"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Statut"
                                        options={[
                                            { value: "A faire", label: "À faire" },
                                            { value: "En cours", label: "En cours" },
                                            { value: "Terminé", label: "Terminé" },
                                            { value: "Bloqué", label: "Bloqué" }
                                        ]}
                                        value={field.value}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <Controller
                                name="priority"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Priorité"
                                        options={[
                                            { value: "low", label: "Basse" },
                                            { value: "medium", label: "Moyenne" },
                                            { value: "high", label: "Haute" }
                                        ]}
                                        value={field.value}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    {/* Row 2: Assignee & Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <Controller
                                name="assignee"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Assigné à"
                                        options={availableUsers.map(u => ({ value: u.displayName, label: u.displayName }))}
                                        value={field.value || ''}
                                        onChange={(val) => {
                                            field.onChange(val);
                                            const selectedUser = availableUsers.find(u => u.displayName === val);
                                            setValue('assigneeId', selectedUser?.uid || '');
                                        }}
                                        placeholder="Non assigné"
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <Controller
                                name="startDate"
                                control={control}
                                render={({ field }) => (
                                    <DatePicker
                                        label="Date de début"
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                {/* Spacer or Label hidden? DatePicker handles label */}
                                {watchedDueDate && watchedTitle && (
                                    <AddToCalendar
                                        event={{
                                            title: watchedTitle,
                                            description: watchedDescription,
                                            start: watchedStartDate ? new Date(watchedStartDate) : new Date(watchedDueDate),
                                            end: new Date(watchedDueDate),
                                            location: 'Sentinel GRC'
                                        }}
                                        className="scale-75 origin-right absolute right-0 top-0 z-10" // Adjust positioning if needed
                                    />
                                )}
                            </div>
                            <Controller
                                name="dueDate"
                                control={control}
                                render={({ field }) => (
                                    <DatePicker
                                        label="Date d'échéance"
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    {/* Row 3: Estimated & Actual Hours */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Controller
                                name="estimatedHours"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Heures estimées"
                                        type="number"
                                        value={field.value?.toString() || ''}
                                        onChange={(e: any) => field.onChange(parseFloat(e.target.value))}
                                        error={errors.estimatedHours?.message}
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <Controller
                                name="actualHours"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label="Heures réelles"
                                        type="number"
                                        value={field.value?.toString() || ''}
                                        onChange={(e: any) => field.onChange(parseFloat(e.target.value))}
                                        error={errors.actualHours?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    {/* Progress */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 flex items-center gap-2">
                            <Target className="h-3.5 w-3.5" />
                            Progression ({progress}%)
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            {...register('progress', { valueAsNumber: true })}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                        />
                        {errors.progress && <p className="text-red-500 text-xs mt-1">{errors.progress.message}</p>}
                    </div>

                    {/* Dependencies */}
                    {availableTasks.length > 0 && (
                        <div>
                            <Controller
                                name="dependencies"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label="Dépendances"
                                        options={availableTasks.filter(t => t.id !== existingTask?.id).map(t => ({ value: t.id, label: t.title }))}
                                        value={field.value || []}
                                        onChange={field.onChange}
                                        multiple
                                    />
                                )}
                            />
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="px-8 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl hover:from-brand-500 hover:to-brand-400 hover:scale-105 transition-all font-bold text-sm shadow-lg shadow-brand-500/30"
                        >
                            {existingTask ? 'Mettre à jour' : 'Créer la tâche'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

