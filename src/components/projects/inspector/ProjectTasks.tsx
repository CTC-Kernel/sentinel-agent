import React, { useState, useCallback } from 'react';
import { Project, ProjectTask, UserProfile } from '../../../types';
import { Button } from '../../ui/button';
import { Plus, CheckSquare, CalendarDays, Trash2 } from '../../ui/Icons';
import { KanbanColumn } from '../KanbanColumn';
import { TaskFormModal } from '../TaskFormModal';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { generateICS, downloadICS } from '../../../utils/calendarUtils';
import { sanitizeData } from '../../../utils/dataSanitizer';

interface ProjectTasksProps {
    project: Project;
    canEdit: boolean;
    usersList: UserProfile[];
    onUpdateTasks: (project: Project, tasks: ProjectTask[]) => Promise<void>;
}

export const ProjectTasks: React.FC<ProjectTasksProps> = ({ project, canEdit, usersList, onUpdateTasks }) => {
    const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState<ProjectTask | undefined>(undefined);
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; taskId: string | null }>({ isOpen: false, taskId: null });

    // Task Logic
    const handleTaskSubmit = useCallback(async (taskData: Partial<ProjectTask>) => {
        const cleanTaskData = sanitizeData(taskData);
        let newTasks = [...(project.tasks || [])];

        if (editingTask) {
            newTasks = newTasks.map(t => t.id === editingTask.id ? { ...t, ...cleanTaskData } : t);
        } else {
            const newTask = { id: Date.now().toString(), ...cleanTaskData } as ProjectTask;
            newTasks.push(newTask);
        }
        await onUpdateTasks(project, newTasks);
        setShowTaskModal(false);
        setEditingTask(undefined);
    }, [project, onUpdateTasks, editingTask]);

    const toggleTaskStatus = useCallback(async (taskId: string) => {
        const task = project.tasks?.find(t => t.id === taskId);
        if (!task) return;
        const newStatus: ProjectTask['status'] = task.status === 'Terminé' ? 'A faire' : 'Terminé';
        const newTasks = project.tasks?.map(t => t.id === taskId ? { ...t, status: newStatus } : t) || [];
        await onUpdateTasks(project, newTasks);
    }, [project, onUpdateTasks]);

    const deleteTask = useCallback((taskId: string) => {
        setConfirmDelete({ isOpen: true, taskId });
    }, []);

    const handleConfirmDeleteTask = useCallback(async () => {
        if (!confirmDelete.taskId) return;
        const newTasks = project.tasks?.filter(t => t.id !== confirmDelete.taskId) || [];
        await onUpdateTasks(project, newTasks);
        setConfirmDelete({ isOpen: false, taskId: null });
    }, [project, onUpdateTasks, confirmDelete.taskId]);

    // Drag and Drop
    const handleDragStart = useCallback((_: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

    const handleDrop = useCallback(async (e: React.DragEvent, status: 'A faire' | 'En cours' | 'Terminé') => {
        e.preventDefault();
        if (!draggedTaskId) return;
        const newTasks = project.tasks?.map(t => t.id === draggedTaskId ? { ...t, status } : t) || [];
        await onUpdateTasks(project, newTasks);
        setDraggedTaskId(null);
    }, [draggedTaskId, project, onUpdateTasks]);

    // Helpers
    const handleDownloadICS = useCallback((task: ProjectTask) => {
        const startDate = task.startDate ? new Date(task.startDate) : new Date();
        const endDate = task.dueDate ? new Date(task.dueDate) : new Date(startDate.getTime() + 60 * 60 * 1000);
        const ics = generateICS([{
            title: `Tâche: ${task.title}`,
            description: task.description || '',
            startTime: startDate,
            endTime: endDate,
            location: 'Sentinel GRC'
        }]);
        downloadICS(`task_${task.id}.ics`, ics);
    }, []);

    const handleNewTask = () => {
        setEditingTask(undefined);
        setShowTaskModal(true);
    };

    const handleEditTask = (t: ProjectTask) => {
        setEditingTask(t);
        setShowTaskModal(true);
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
                    <button onClick={() => setViewMode('list')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:hover:text-slate-300'}`}>Liste</button>
                    <button onClick={() => setViewMode('board')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${viewMode === 'board' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:hover:text-slate-300'}`}>Tableau</button>
                </div>
                {canEdit && (
                    <Button onClick={handleNewTask} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Nouvelle tâche
                    </Button>
                )}
            </div>

            {viewMode === 'list' ? (
                <div className="space-y-2">
                    {project.tasks?.map(task => (
                        <div key={task.id} className="flex items-center p-3 glass-panel rounded-xl border border-white/60 dark:border-white/10 group hover:shadow-apple transition-all">
                            <button
                                onClick={() => toggleTaskStatus(task.id)}
                                disabled={!canEdit}
                                className={`flex-shrink-0 w-5 h-5 rounded-full border mr-3 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${task.status === 'Terminé' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-500'}`}
                            >
                                {task.status === 'Terminé' && <CheckSquare className="w-3.5 h-3.5" />}
                            </button>
                            <span className={`text-sm font-medium flex-1 ${task.status === 'Terminé' ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{task.title}</span>
                            {canEdit && (
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleDownloadICS(task)} className="p-1.5 text-slate-500 hover:text-brand-500 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><CalendarDays className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-500 hover:text-red-500 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 h-full">
                    {['A faire', 'En cours', 'Terminé'].map(status => (
                        <KanbanColumn
                            key={status}
                            status={status as 'A faire' | 'En cours' | 'Terminé'}
                            tasks={project.tasks?.filter(t => t.status === status) || []}
                            canEdit={canEdit}
                            draggedTaskId={draggedTaskId}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onDragStart={handleDragStart}
                            onEditTask={handleEditTask}
                            onDeleteTask={deleteTask}
                        />
                    ))}
                </div>
            )}

            <TaskFormModal
                isOpen={showTaskModal}
                onClose={() => setShowTaskModal(false)}
                onSubmit={handleTaskSubmit}
                existingTask={editingTask}
                availableTasks={project.tasks || []}
                availableUsers={usersList}
            />

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, taskId: null })}
                onConfirm={handleConfirmDeleteTask}
                title="Supprimer la tâche"
                message="Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible."
                confirmText="Supprimer"
                type="danger"
            />
        </div>
    );
};
