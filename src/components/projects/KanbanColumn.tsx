import React from 'react';
import { ProjectTask } from '../../types';
import { CalendarDays, Edit, Trash2 } from '../ui/Icons';

interface KanbanColumnProps {
    status: 'A faire' | 'En cours' | 'Terminé';
    tasks: ProjectTask[];
    canEdit: boolean;
    draggedTaskId: string | null;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, status: 'A faire' | 'En cours' | 'Terminé') => void;
    onDragStart: (e: React.DragEvent, taskId: string) => void;
    onEditTask: (task: ProjectTask) => void;
    onDeleteTask: (taskId: string) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
    status,
    tasks,
    canEdit,
    draggedTaskId,
    onDragOver,
    onDrop,
    onDragStart,
    onEditTask,
    onDeleteTask
}) => {
    return (
        <div
            className={`flex-1 glass-panel rounded-[1.5rem] p-4 border border-white/20 flex flex-col min-h-[400px] transition-colors ${draggedTaskId ? 'border-dashed border-brand-300 dark:border-brand-700 bg-brand-50/20' : 'bg-slate-50/30 dark:bg-slate-900/20'}`}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, status)}
        >
            <h4 className="text-xs font-bold uppercase text-slate-600 mb-3 flex justify-between tracking-wider">
                {status} <span className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded-lg text-[10px] shadow-sm border border-black/5 dark:border-white/5">{tasks.length}</span>
            </h4>
            <div className="space-y-2.5 flex-1">
                {tasks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-500 min-h-[150px] border-2 border-dashed border-slate-200 dark:border-white/5 rounded-xl">
                        <div className="text-xs font-medium">Aucune tâche</div>
                    </div>
                ) : (
                    tasks.map(task => (
                        <div
                            key={task.id}
                            draggable={canEdit}
                            onDragStart={(e) => onDragStart(e, task.id)}
                            className={`p-4 glass-panel rounded-xl border border-white/30 dark:border-white/10 shadow-sm hover:shadow-lg transition-all group cursor-grab active:cursor-grabbing relative overflow-hidden ${draggedTaskId === task.id ? 'opacity-50 scale-95' : 'hover:scale-[1.02] hover:bg-white/60 dark:hover:bg-white/10'}`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">{task.title}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => onEditTask(task)} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded text-slate-500 hover:text-brand-500"><Edit className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => onDeleteTask(task.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-slate-500 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-slate-600">{task.assignee || 'Non assigné'}</span>
                                {task.dueDate && <span className={`text-[10px] font-bold flex items-center ${new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-slate-600'}`}><CalendarDays className="h-3 w-3 mr-1" />{new Date(task.dueDate).toLocaleDateString()}</span>}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
