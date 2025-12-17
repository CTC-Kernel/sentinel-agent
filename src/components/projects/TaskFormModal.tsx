import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, User, Clock, Target, AlertCircle } from 'lucide-react';
import { ProjectTask, UserProfile } from '../../types';
import { AddToCalendar } from '../../components/ui/AddToCalendar';
import { useForm, useWatch } from 'react-hook-form';
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

    const watchedDependencies = useWatch({ control, name: 'dependencies' }) || [];
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
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                            Titre de la tâche *
                        </label>
                        <input
                            type="text"
                            {...register('title')}
                            className={`w-full px-4 py-3.5 rounded-2xl border ${errors.title ? 'border-red-500' : 'border-gray-200 dark:border-white/10'} bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium transition-all`}
                            placeholder="Ex: Développer la fonctionnalité..."
                        />
                        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                            Description
                        </label>
                        <textarea
                            {...register('description')}
                            rows={3}
                            className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium resize-none"
                            placeholder="Détails de la tâche..."
                        />
                    </div>

                    {/* Row 1: Status & Priority */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                                Statut
                            </label>
                            <select
                                {...register('status')}
                                className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                            >
                                <option value="A faire">À faire</option>
                                <option value="En cours">En cours</option>
                                <option value="Terminé">Terminé</option>
                                <option value="Bloqué">Bloqué</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2">
                                Priorité
                            </label>
                            <select
                                {...register('priority')}
                                className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                            >
                                <option value="low">Basse</option>
                                <option value="medium">Moyenne</option>
                                <option value="high">Haute</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Assignee & Dates */}
                    <div className="grid grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 flex items-center gap-2">
                                <User className="h-3.5 w-3.5" />
                                Assigné à
                            </label>
                            {availableUsers.length > 0 ? (
                                <select
                                    {...register('assignee', {
                                        onChange: (e) => {
                                            const selectedUser = availableUsers.find(u => u.displayName === e.target.value);
                                            setValue('assigneeId', selectedUser?.uid);
                                        }
                                    })}
                                    className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                                >
                                    <option value="">Non assigné</option>
                                    {availableUsers.map(user => (
                                        <option key={user.uid} value={user.displayName}>{user.displayName}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    {...register('assignee')}
                                    className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                    placeholder="Nom de l'utilisateur"
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" />
                                Date de début
                            </label>
                            <input
                                type="date"
                                {...register('startDate')}
                                className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5" />
                                    Date d'échéance
                                </label>
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
                            <input
                                type="date"
                                {...register('dueDate')}
                                className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                            />
                        </div>
                    </div>

                    {/* Row 3: Estimated & Actual Hours */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5" />
                                Heures estimées
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                {...register('estimatedHours', { valueAsNumber: true })}
                                className={`w-full px-4 py-3.5 rounded-2xl border ${errors.estimatedHours ? 'border-red-500' : 'border-gray-200 dark:border-white/10'} bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium`}
                                placeholder="0.0"
                            />
                            {errors.estimatedHours && <p className="text-red-500 text-xs mt-1">{errors.estimatedHours.message}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5" />
                                Heures réelles
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                {...register('actualHours', { valueAsNumber: true })}
                                className={`w-full px-4 py-3.5 rounded-2xl border ${errors.actualHours ? 'border-red-500' : 'border-gray-200 dark:border-white/10'} bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium`}
                                placeholder="0.0"
                            />
                            {errors.actualHours && <p className="text-red-500 text-xs mt-1">{errors.actualHours.message}</p>}
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
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-600 mb-2 flex items-center gap-2">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Dépendances
                            </label>
                            <div className="space-y-2 max-h-32 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                {availableTasks.filter(t => t.id !== existingTask?.id).map(task => (
                                    <label key={task.id} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={watchedDependencies.includes(task.id)}
                                            onChange={(e) => {
                                                const deps = watchedDependencies;
                                                if (e.target.checked) {
                                                    setValue('dependencies', [...deps, task.id], { shouldDirty: true });
                                                } else {
                                                    setValue('dependencies', deps.filter(d => d !== task.id), { shouldDirty: true });
                                                }
                                            }}
                                            className="rounded border-gray-300"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300">{task.title}</span>
                                    </label>
                                ))}
                            </div>
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

