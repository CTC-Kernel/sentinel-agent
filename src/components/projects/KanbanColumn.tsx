import React from 'react';
import { ProjectTask } from '../../types';
import { CalendarDays, Edit, Trash2 } from '../ui/Icons';

interface KanbanColumnProps {
 status: 'À faire' | 'En cours' | 'Terminé';
 tasks: ProjectTask[];
 canEdit: boolean;
 draggedTaskId: string | null;
 onDragOver: (e: React.DragEvent) => void;
 onDrop: (e: React.DragEvent, status: 'À faire' | 'En cours' | 'Terminé') => void;
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
 const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set());

 const handleDelete = React.useCallback(async (taskId: string) => {
 if (deletingIds.has(taskId)) return;
 setDeletingIds(prev => new Set(prev).add(taskId));
 try {
 await onDeleteTask(taskId);
 } finally {
 setDeletingIds(prev => {
 const next = new Set(prev);
 next.delete(taskId);
 return next;
 });
 }
 }, [deletingIds, onDeleteTask]);

 return (
 // eslint-disable-next-line jsx-a11y/no-static-element-interactions
 <div
 className={`flex-1 glass-premium rounded-[1.5rem] p-4 border border-border/40 flex flex-col min-h-[400px] transition-colors ${draggedTaskId ? 'border-dashed border-primary/40 dark:border-primary/80 bg-primary/10' : 'bg-muted/50'}`}
 onDragOver={onDragOver}
 onDrop={(e) => onDrop(e, status)}
 >
 <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex justify-between tracking-wider">
 {status} <span className="bg-card px-2 py-0.5 rounded-lg text-xs shadow-sm border border-border">{tasks.length}</span>
 </h4>
 <div className="space-y-2.5 flex-1">
 {tasks.length === 0 ? (
  <div className="h-full flex flex-col items-center justify-center text-muted-foreground min-h-[150px] border-2 border-dashed border-border rounded-3xl">
  <div className="text-xs font-medium">Aucune tâche</div>
  </div>
 ) : (
  tasks.map(task => (
  <div
  key={task.id || 'unknown'}
  draggable={canEdit}
  onDragStart={(e) => onDragStart(e, task.id)}
  className={`p-4 glass-premium rounded-3xl border border-border/40 shadow-sm hover:shadow-lg transition-all group cursor-grab active:cursor-grabbing relative overflow-hidden ${draggedTaskId === task.id ? 'opacity-60 scale-95' : 'hover:scale-[1.02] hover:bg-muted/50'}`}
  role="button"
  tabIndex={0}
  aria-label={`Tâche: ${task.title || 'Sans titre'}`}
  onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
   e.preventDefault();
  }
  }}
  >
  <div className="absolute inset-0 bg-gradient-to-br from-muted/30 to-transparent pointer-events-none opacity-0 group-hover:opacity-70 transition-opacity" />
  <div className="flex justify-between items-start mb-2">
  <span className="text-sm font-bold text-foreground line-clamp-2">{task.title}</span>
  <div className="flex gap-1 opacity-0 group-hover:opacity-70 transition-opacity">
   <button onClick={() => onEditTask(task)} className="p-1 hover:bg-muted dark:hover:bg-muted rounded text-muted-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Edit className="h-3.5 w-3.5" /></button>
   <button onClick={() => handleDelete(task.id)} disabled={deletingIds.has(task.id)} className="p-1 hover:bg-error-bg rounded text-muted-foreground hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:bg-muted disabled:text-muted-foreground disabled:border-border/40 disabled:cursor-not-allowed"><Trash2 className="h-3.5 w-3.5" /></button>
  </div>
  </div>
  <div className="flex items-center justify-between mt-2">
  <span className="text-xs font-medium px-2 py-0.5 bg-muted rounded text-muted-foreground">{task.assignee || 'Non assigné'}</span>
  {task.dueDate && <span className={`text-xs font-bold flex items-center ${new Date(task.dueDate) < new Date() ? 'text-destructive' : 'text-muted-foreground'}`}><CalendarDays className="h-3 w-3 mr-1" />{new Date(task.dueDate).toLocaleDateString()}</span>}
  </div>
  </div>
  ))
 )}
 </div>
 </div>
 );
};
