import React, { useState } from 'react';
import { Project, ProjectMilestone } from '../../types';
import { useStore } from '../../store';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { ErrorLogger } from '../../services/errorLogger';
import { Plus, Edit, Trash2, Calendar } from '../ui/Icons';
import { Button } from '../ui/button';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { CustomDatePicker } from '../ui/CustomDatePicker';
import { CustomSelect } from '../ui/CustomSelect';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';

interface ProjectMilestonesProps {
    project: Project;
    milestones: ProjectMilestone[];
    onUpdate: () => void;
}

export const ProjectMilestones: React.FC<ProjectMilestonesProps> = ({ project, milestones, onUpdate }) => {
    const { user, addToast } = useStore();
    const [isEditing, setIsEditing] = useState(false);
    const [currentMilestone, setCurrentMilestone] = useState<Partial<ProjectMilestone>>({});
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.organizationId) return;
        setLoading(true);

        try {
            if (currentMilestone.id) {
                // Update
                await updateDoc(doc(db, 'project_milestones', currentMilestone.id), {
                    title: currentMilestone.title,
                    description: currentMilestone.description,
                    targetDate: currentMilestone.targetDate,
                    status: currentMilestone.status,
                    linkedTaskIds: currentMilestone.linkedTaskIds || []
                });
                addToast('Jalon mis à jour', 'success');
            } else {
                // Create
                await addDoc(collection(db, 'project_milestones'), {
                    projectId: project.id,
                    organizationId: user.organizationId,
                    title: currentMilestone.title,
                    description: currentMilestone.description || '',
                    targetDate: currentMilestone.targetDate,
                    status: 'pending',
                    linkedTaskIds: currentMilestone.linkedTaskIds || [],
                    createdAt: new Date().toISOString()
                });
                addToast('Jalon créé', 'success');
            }
            setIsEditing(false);
            setCurrentMilestone({});
            onUpdate();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ProjectMilestones.handleSubmit', 'UPDATE_FAILED');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce jalon ?')) return;
        try {
            await deleteDoc(doc(db, 'project_milestones', id));
            addToast('Jalon supprimé', 'info');
            onUpdate();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'ProjectMilestones.handleDelete', 'DELETE_FAILED');
        }
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Jalons du projet</h3>
                <Button onClick={() => { setCurrentMilestone({}); setIsEditing(true); }} className="flex items-center gap-2 bg-brand-600 text-white hover:bg-brand-700">
                    <Plus className="h-4 w-4" /> Nouveau Jalon
                </Button>
            </div>

            {isEditing && (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <FloatingLabelInput
                            label="Titre du jalon"
                            value={currentMilestone.title || ''}
                            onChange={(e) => setCurrentMilestone({ ...currentMilestone, title: e.target.value })}
                            required
                        />
                        <FloatingLabelTextarea
                            label="Description"
                            value={currentMilestone.description || ''}
                            onChange={(e) => setCurrentMilestone({ ...currentMilestone, description: e.target.value })}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <CustomDatePicker
                                label="Date cible"
                                value={currentMilestone.targetDate || ''}
                                onChange={(val) => setCurrentMilestone({ ...currentMilestone, targetDate: val })}
                                required
                            />
                            <CustomSelect
                                label="Statut"
                                value={currentMilestone.status || 'pending'}
                                onChange={(val) => setCurrentMilestone({ ...currentMilestone, status: val as 'pending' | 'achieved' | 'missed' })}
                                options={[
                                    { value: 'pending', label: 'En attente' },
                                    { value: 'achieved', label: 'Atteint' },
                                    { value: 'missed', label: 'Manqué' }
                                ]}
                            />
                        </div>
                        <CustomSelect
                            label="Tâches liées"
                            value={currentMilestone.linkedTaskIds || []}
                            onChange={(val) => setCurrentMilestone({ ...currentMilestone, linkedTaskIds: val as string[] })}
                            options={project.tasks?.map(t => ({ value: t.id, label: t.title, subLabel: t.status })) || []}
                            multiple
                        />
                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Annuler</Button>
                            <Button type="submit" isLoading={loading} className="bg-brand-600 text-white">Enregistrer</Button>
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
                        <div key={milestone.id} className="flex items-center p-4 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-white/5 group hover:shadow-sm transition-all">
                            <div className="flex-shrink-0 mr-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${milestone.status === 'achieved' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                                    milestone.status === 'missed' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                                        'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
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
                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{milestone.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(milestone.targetDate).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => { setCurrentMilestone(milestone); setIsEditing(true); }}
                                    className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
                                >
                                    <Edit className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(milestone.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
