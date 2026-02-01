import React, { useEffect } from 'react';
import { Target } from '../ui/Icons';
import { ProjectTask, UserProfile } from '../../types';
import { AddToCalendar } from '../../components/ui/AddToCalendar';
import { useForm, useWatch, Controller, Resolver } from 'react-hook-form';
import { InspectorLayout } from '../ui/InspectorLayout';
import { CustomSelect } from '../ui/CustomSelect';
import { DatePicker } from '../ui/DatePicker';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectTaskSchema, ProjectTaskFormData } from '../../schemas/projectSchema';
import { Button } from '../ui/button';
import { useTranslation } from 'react-i18next';

interface TaskFormDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (task: Omit<ProjectTask, 'id'>) => void;
    existingTask?: ProjectTask;
    availableTasks?: ProjectTask[]; // For dependencies
    availableUsers?: UserProfile[]; // For assignee selection
    onCancel?: () => void;
}

export const TaskFormDrawer: React.FC<TaskFormDrawerProps> = ({
    isOpen,
    onClose,
    onSubmit,
    onCancel,
    existingTask,
    availableTasks = [],
    availableUsers = []
}) => {
    const { t } = useTranslation();

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        control,
        formState: { errors, isSubmitting, isDirty }
    } = useForm<ProjectTaskFormData>({
        resolver: zodResolver(projectTaskSchema) as Resolver<ProjectTaskFormData>,
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

    const [isFormDirty, setIsFormDirty] = React.useState(false);

    useEffect(() => {
        setIsFormDirty(isDirty);
    }, [isDirty]);

    const handleClose = () => {
        setIsFormDirty(false);
        if (onCancel) {
            onCancel();
        } else {
            onClose();
        }
    };

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

    const onFormSubmit = async (data: ProjectTaskFormData) => {
        await onSubmit(data);
        setIsFormDirty(false);
        onClose();
    };

    const progress = useWatch({ control, name: 'progress' });
    const watchedTitle = useWatch({ control, name: 'title' });
    const watchedDescription = useWatch({ control, name: 'description' });
    const watchedStartDate = useWatch({ control, name: 'startDate' });
    const watchedDueDate = useWatch({ control, name: 'dueDate' });

    return (
        <InspectorLayout
            isOpen={isOpen}
            onClose={handleClose}
            title={existingTask ? t('tasks.edit.title', { defaultValue: 'Modifier la tâche' }) : t('tasks.create.title', { defaultValue: 'Nouvelle tâche' })}
            subtitle={t('tasks.form.subtitle', { defaultValue: 'Définissez les détails de la tâche du projet' })}
            width="max-w-4xl"
            hasUnsavedChanges={isFormDirty}
            icon={Target}
        >
            <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col h-full">
                <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pb-6">
                    {/* Title */}
                    <div>
                        <Controller
                            name="title"
                            control={control}
                            render={({ field }) => (
                                <FloatingLabelInput
                                    label={t('tasks.fields.title', { defaultValue: 'Titre de la tâche' })}
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
                                    label={t('tasks.fields.description', { defaultValue: 'Description' })}
                                    value={field.value || ''}
                                    onChange={field.onChange}
                                    textarea
                                />
                            )}
                        />
                    </div>

                    {/* Row 1: Status & Priority */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                            <Controller
                                name="status"
                                control={control}
                                render={({ field }) => (
                                    <CustomSelect
                                        label={t('tasks.fields.status', { defaultValue: 'Statut' })}
                                        options={[
                                            { value: "A faire", label: t('tasks.status.todo', { defaultValue: 'À faire' }) },
                                            { value: "En cours", label: t('tasks.status.inProgress', { defaultValue: 'En cours' }) },
                                            { value: "Terminé", label: t('tasks.status.done', { defaultValue: 'Terminé' }) },
                                            { value: "Bloqué", label: t('tasks.status.blocked', { defaultValue: 'Bloqué' }) }
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
                                        label={t('tasks.fields.priority', { defaultValue: 'Priorité' })}
                                        options={[
                                            { value: "low", label: t('tasks.priority.low', { defaultValue: 'Basse' }) },
                                            { value: "medium", label: t('tasks.priority.medium', { defaultValue: 'Moyenne' }) },
                                            { value: "high", label: t('tasks.priority.high', { defaultValue: 'Haute' }) }
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
                                        label={t('tasks.fields.assignee', { defaultValue: 'Assigné à' })}
                                        options={availableUsers.map(u => ({ value: u.displayName, label: u.displayName }))}
                                        value={field.value || ''}
                                        onChange={(val) => {
                                            field.onChange(val);
                                            const selectedUser = availableUsers.find(u => u.displayName === val);
                                            setValue('assigneeId', selectedUser?.uid || '');
                                        }}
                                        placeholder={t('tasks.fields.unassigned', { defaultValue: 'Non assigné' })}
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
                                        label={t('tasks.fields.startDate', { defaultValue: 'Date de début' })}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>

                        <div className="relative">
                            <div className="absolute right-0 -top-8 z-10">
                                {watchedDueDate && watchedTitle && (
                                    <AddToCalendar
                                        event={{
                                            title: watchedTitle,
                                            description: watchedDescription,
                                            start: watchedStartDate ? new Date(watchedStartDate) : new Date(watchedDueDate),
                                            end: new Date(watchedDueDate),
                                            location: 'Sentinel GRC'
                                        }}
                                        className="scale-75 origin-right"
                                    />
                                )}
                            </div>
                            <Controller
                                name="dueDate"
                                control={control}
                                render={({ field }) => (
                                    <DatePicker
                                        label={t('tasks.fields.dueDate', { defaultValue: "Date d'échéance" })}
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    {/* Row 3: Estimated & Actual Hours */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                            <Controller
                                name="estimatedHours"
                                control={control}
                                render={({ field }) => (
                                    <FloatingLabelInput
                                        label={t('tasks.fields.estimatedHours', { defaultValue: 'Heures estimées' })}
                                        type="number"
                                        value={field.value?.toString() || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseFloat(e.target.value))}
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
                                        label={t('tasks.fields.actualHours', { defaultValue: 'Heures réelles' })}
                                        type="number"
                                        value={field.value?.toString() || ''}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => field.onChange(parseFloat(e.target.value))}
                                        error={errors.actualHours?.message}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-border/40 dark:border-white/5">
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-muted-foreground mb-2 flex items-center gap-2">
                            <Target className="h-3.5 w-3.5" />
                            {t('tasks.fields.progress', { defaultValue: 'Progression' })} ({progress}%)
                        </label>
                        <input {...register('progress', { valueAsNumber: true })}
                            type="range"
                            min="0"
                            max="100"
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 accent-brand-600"
                            aria-label={t('tasks.fields.progressAriaLabel', { defaultValue: 'Progression de la tâche' })}
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
                                        label={t('tasks.fields.dependencies', { defaultValue: 'Dépendances (Tâches bloquantes)' })}
                                        options={availableTasks.filter(t => t.id !== existingTask?.id).map(t => ({ value: t.id, label: t.title }))}
                                        value={field.value || []}
                                        onChange={field.onChange}
                                        multiple
                                    />
                                )}
                            />
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t border-border/40 dark:border-border/40 shrink-0">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isSubmitting}
                    >
                        {t('common.cancel', { defaultValue: 'Annuler' })}
                    </Button>
                    <Button
                        type="submit"
                        isLoading={isSubmitting}
                    >
                        {existingTask ? t('common.update', { defaultValue: 'Mettre à jour' }) : t('tasks.create.submit', { defaultValue: 'Créer la tâche' })}
                    </Button>
                </div>
            </form>
        </InspectorLayout>
    );
};

export default TaskFormDrawer;
