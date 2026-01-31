import React, { useState } from 'react';
import { Project, ProjectMilestone } from '../../types';
import { useStore } from '../../store';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { Plus, Edit, Trash2, Calendar } from '../ui/Icons';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { DatePicker } from '../ui/DatePicker';
import { CustomSelect } from '../ui/CustomSelect';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useProjectMilestones } from '../../hooks/projects/useProjectMilestones';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const milestoneSchema = z.object({
    title: z.string().min(3, 'Titre requis (min 3 caractères)').max(200, 'Titre trop long'),
    description: z.string().max(1000, 'Description trop longue').optional(),
    targetDate: z.string().min(1, 'Date cible requise'),
    status: z.enum(['pending', 'achieved', 'missed']).optional(),
    linkedTaskIds: z.array(z.string()).optional()
});

type MilestoneFormData = z.infer<typeof milestoneSchema>;

interface ProjectMilestonesProps {
    project: Project;
    milestones: ProjectMilestone[];
    onUpdate: () => void;
}

export const ProjectMilestones: React.FC<ProjectMilestonesProps> = ({ project, milestones, onUpdate }) => {
    const { user, addToast, t } = useStore();
    const { addMilestone, updateMilestone, removeMilestone } = useProjectMilestones(project.id);
    const [isEditing, setIsEditing] = useState(false);
    const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
    const [deleteMilestoneId, setDeleteMilestoneId] = useState<string | null>(null);

    const { register, handleSubmit, reset, setValue, control, formState: { errors, isSubmitting } } = useForm<MilestoneFormData>({
        resolver: zodResolver(milestoneSchema),
        defaultValues: {
            title: '',
            description: '',
            targetDate: '',
            status: 'pending',
            linkedTaskIds: []
        }
    });

    const [targetDate, status, linkedTaskIds] = useWatch({
        control,
        name: ['targetDate', 'status', 'linkedTaskIds']
    });
    const formValues = { targetDate, status, linkedTaskIds };

    const onSubmit = async (data: MilestoneFormData) => {
        if (!user?.organizationId) return;

        // Validate dates
        const milestoneDate = new Date(data.targetDate);
        const projectStart = project.startDate ? new Date(project.startDate) : null;
        const projectEnd = project.dueDate ? new Date(project.dueDate) : null;

        if (projectStart && milestoneDate < projectStart) {
            addToast(t('projects.milestones.toast.dateBeforeStart', { defaultValue: "La date du jalon ne peut pas être avant le début du projet." }), "error");
            return;
        }
        if (projectEnd && milestoneDate > projectEnd) {
            addToast(t('projects.milestones.toast.dateAfterEnd', { defaultValue: "La date du jalon ne peut pas être après la fin du projet." }), "error");
            return;
        }

        try {
            if (editingMilestoneId) {
                // Update
                await updateMilestone(editingMilestoneId, sanitizeData({
                    title: data.title,
                    description: data.description || '',
                    targetDate: data.targetDate,
                    status: data.status || 'pending',
                    linkedTaskIds: data.linkedTaskIds || []
                }));
                addToast(t('projects.milestones.toast.updated', { defaultValue: 'Jalon mis à jour' }), 'success');
            } else {
                // Create
                await addMilestone(sanitizeData({
                    projectId: project.id,
                    organizationId: user.organizationId,
                    title: data.title,
                    description: data.description || '',
                    targetDate: data.targetDate,
                    status: 'pending',
                    linkedTaskIds: data.linkedTaskIds || []
                }));
                addToast(t('projects.milestones.toast.created', { defaultValue: 'Jalon créé' }), 'success');
            }
            setIsEditing(false);
            setEditingMilestoneId(null);
            reset();
            onUpdate();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ProjectMilestones.onSubmit', 'UPDATE_FAILED');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await removeMilestone(id);
            addToast(t('projects.milestones.toast.deleted', { defaultValue: 'Jalon supprimé' }), 'info');
            onUpdate();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ProjectMilestones.handleDelete', 'DELETE_FAILED');
        } finally {
            setDeleteMilestoneId(null);
        }
    };

    const handleEdit = (milestone: ProjectMilestone) => {
        setEditingMilestoneId(milestone.id);
        reset({
            title: milestone.title,
            description: milestone.description || '',
            targetDate: milestone.targetDate,
            status: milestone.status,
            linkedTaskIds: milestone.linkedTaskIds || []
        });
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditingMilestoneId(null);
        reset();
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Jalons du projet</h3>
                <Button onClick={() => { reset(); setIsEditing(true); }} className="flex items-center gap-2 bg-brand-600 text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900">
                    <Plus className="h-4 w-4" /> Nouveau Jalon
                </Button>
            </div>

            {isEditing && (
                <div className="glass-premium p-4 sm:p-6 rounded-2xl border border-border/40 mb-6 bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl shadow-lg">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <FloatingLabelInput
                            label="Titre du jalon"
                            {...register('title')}
                            error={errors.title?.message}
                            required
                        />
                        <FloatingLabelTextarea
                            label="Description"
                            {...register('description')}
                            error={errors.description?.message}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <DatePicker
                                    label="Date cible"
                                    value={formValues.targetDate || ''}
                                    onChange={(val) => setValue('targetDate', val || '')}
                                    required
                                />
                                {errors.targetDate && <p className="text-xs text-red-500 mt-1">{errors.targetDate.message}</p>}
                            </div>
                            <CustomSelect
                                label="Statut"
                                value={formValues.status || 'pending'}
                                onChange={(val) => setValue('status', val as 'pending' | 'achieved' | 'missed')}
                                options={[
                                    { value: 'pending', label: 'En attente' },
                                    { value: 'achieved', label: 'Atteint' },
                                    { value: 'missed', label: 'Manqué' }
                                ]}
                            />
                        </div>
                        <CustomSelect
                            label="Tâches liées"
                            value={formValues.linkedTaskIds || []}
                            onChange={(val) => setValue('linkedTaskIds', val as string[])}
                            options={project.tasks?.map(t => ({ value: t.id, label: t.title, subLabel: t.status })) || []}
                            multiple
                        />
                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={handleCancel} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500">Annuler</Button>
                            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting} className="bg-brand-600 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900">
                                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                {milestones.length === 0 ? (
                    <EmptyState
                        icon={Calendar}
                        title="Aucun jalon défini"
                        description="Créez des jalons pour marquer les étapes importantes de votre projet."
                    />
                ) : (
                    milestones.map((milestone, index) => (
                        <div key={milestone.id || 'unknown'} className="flex items-center p-4 glass-premium rounded-3xl border border-border/40 hover:border-brand-300 group hover:shadow-md transition-all">
                            <div className="flex-shrink-0 mr-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${milestone.status === 'achieved' ? 'bg-green-100 text-green-600 dark:text-green-400 dark:bg-green-900/30 dark:text-green-400' :
                                    milestone.status === 'missed' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 dark:bg-slate-700 dark:text-slate-300'
                                    }`}>
                                    {index + 1}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <h4 className="font-bold text-slate-900 dark:text-white truncate">{milestone.title}</h4>
                                    <Badge
                                        status={milestone.status === 'achieved' ? 'success' : milestone.status === 'missed' ? 'error' : 'neutral'}
                                        size="sm"
                                        variant="soft"
                                    >
                                        {milestone.status === 'achieved' ? 'Atteint' : milestone.status === 'missed' ? 'Manqué' : 'En attente'}
                                    </Badge>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-1">{milestone.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(milestone.targetDate).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-70 transition-opacity">
                                <button
                                    onClick={() => handleEdit(milestone)}
                                    className="p-2 text-slate-500 dark:text-slate-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                                    aria-label="Modifier le jalon"
                                >
                                    <Edit className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setDeleteMilestoneId(milestone.id)}
                                    className="p-2 text-slate-500 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:bg-red-900/20 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                                    aria-label="Supprimer le jalon"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ConfirmModal
                isOpen={deleteMilestoneId !== null}
                onClose={() => setDeleteMilestoneId(null)}
                onConfirm={() => deleteMilestoneId && handleDelete(deleteMilestoneId)}
                title="Supprimer le jalon"
                message="Êtes-vous sûr de vouloir supprimer ce jalon ?"
                type="danger"
                confirmText="Supprimer"
                cancelText="Annuler"
            />
        </div>
    );
};
