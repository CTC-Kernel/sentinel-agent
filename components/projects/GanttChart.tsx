import React, { useEffect, useRef } from 'react';
import Gantt from 'frappe-gantt';
import { ProjectTask } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';

interface GanttChartProps {
    tasks: ProjectTask[];
    onTaskUpdate?: (task: ProjectTask, startDate: Date, endDate: Date) => void;
    viewMode?: 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month';
}

interface GanttTask {
    id: string;
    name: string;
    start: string;
    end: string;
    progress: number;
    dependencies?: string;
    custom_class?: string;
}

export const GanttChart: React.FC<GanttChartProps> = ({
    tasks,
    onTaskUpdate,
    viewMode = 'Day'
}) => {
    const ganttRef = useRef<HTMLDivElement>(null);
    const ganttInstance = useRef<any>(null);

    const scheduledTasks = tasks.filter(task => !!task.dueDate);
    const scheduledCount = scheduledTasks.length;
    const unscheduledCount = tasks.length - scheduledCount;

    useEffect(() => {
        if (!ganttRef.current) return;

        if (scheduledTasks.length === 0) {
            ganttRef.current.innerHTML = '';
            ganttInstance.current = null;
            return;
        }

        const ganttTasks: GanttTask[] = scheduledTasks.reduce((acc: GanttTask[], task) => {
            if (!task.dueDate) return acc;

            let end: Date;
            if (task.dueDate.includes('/')) {
                const parts = task.dueDate.split('/');
                end = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else {
                end = new Date(task.dueDate);
            }

            if (Number.isNaN(end.getTime())) {
                return acc;
            }

            const start = new Date(end);
            start.setDate(start.getDate() - 7);

            let customClass = '';
            switch (task.status) {
                case 'Terminé':
                    customClass = 'bar-completed';
                    break;
                case 'En cours':
                    customClass = 'bar-in-progress';
                    break;
                case 'Bloqué':
                    customClass = 'bar-blocked';
                    break;
                default:
                    customClass = 'bar-pending';
            }

            acc.push({
                id: task.id || `task-${Math.random()}`,
                name: task.title || task.description || 'Sans titre',
                start: start.toISOString().split('T')[0],
                end: end.toISOString().split('T')[0],
                progress: task.progress ?? 0,
                custom_class: customClass,
                dependencies: task.dependencies?.join(',') || ''
            });

            return acc;
        }, []);

        // Reset container content before (re)creating Gantt instance
        ganttRef.current.innerHTML = '';

        // Create Gantt instance
        try {
            ganttInstance.current = new Gantt(ganttRef.current, ganttTasks, {
                view_mode: viewMode,
                bar_height: 30,
                bar_corner_radius: 6,
                arrow_curve: 5,
                padding: 18,
                view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
                date_format: 'YYYY-MM-DD',
                language: 'fr',
                custom_popup_html: (task: any) => {
                    const originalTask = tasks.find(t => t.id === task.id);
                    return `
                        <div class="gantt-popup-wrapper">
                            <div class="gantt-popup-title">${task.name}</div>
                            <div class="gantt-popup-subtitle">
                                ${originalTask?.assignee || 'Non assigné'} • ${task.progress}%
                            </div>
                            <div class="gantt-popup-dates">
                                ${task._start.toLocaleDateString('fr-FR')} → ${task._end.toLocaleDateString('fr-FR')}
                            </div>
                        </div>
                    `;
                },
                on_click: (task: any) => {
                    console.log('Task clicked:', task);
                },
                on_date_change: (task: any, start: Date, end: Date) => {
                    const originalTask = tasks.find(t => t.id === task.id);
                    if (originalTask && onTaskUpdate) {
                        onTaskUpdate(originalTask, start, end);
                    }
                },
                on_progress_change: (task: any, progress: number) => {
                    console.log('Progress changed:', task.name, progress);
                },
                on_view_change: (_mode: any) => {
                    console.log('View mode changed:', _mode);
                }
            } as any);
        } catch (error) {
            ErrorLogger.error(error, 'GanttChart.createInstance');
        }

        return () => {
            // Cleanup
            if (ganttRef.current) {
                ganttRef.current.innerHTML = '';
            }
            ganttInstance.current = null;
        };
    }, [tasks, viewMode]);

    if (tasks.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 text-slate-400 text-sm">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">📊</div>
                    <p className="font-semibold text-lg text-slate-600 dark:text-slate-300 mb-2">Aucune tâche dans ce projet</p>
                    <p className="text-xs mb-4">Le diagramme de Gantt s'affichera une fois que vous aurez ajouté des tâches au projet.</p>
                    <div className="text-left bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-xs">
                        <p className="font-semibold mb-2">💡 Pour ajouter des tâches :</p>
                        <ol className="space-y-1 list-decimal list-inside text-slate-500 dark:text-slate-400">
                            <li>Cliquez sur l'onglet "Tâches"</li>
                            <li>Utilisez le bouton "+" pour créer des tâches</li>
                            <li>Définissez une date d'échéance pour chaque tâche</li>
                            <li>Revenez sur l'onglet "Gantt" pour voir la timeline</li>
                        </ol>
                    </div>
                </div>
            </div>
        );
    }

    if (scheduledCount === 0) {
        return (
            <div className="flex items-center justify-center h-96 text-slate-400 text-sm">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">📅</div>
                    <p className="font-semibold text-lg text-slate-600 dark:text-slate-300 mb-2">Aucune tâche planifiée</p>
                    <p className="text-xs mb-4">Aucune tâche de ce projet n'a de date d'échéance. Ajoutez des échéances dans l'onglet Tâches pour afficher le diagramme de Gantt.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="gantt-container bg-white dark:bg-slate-900/50 rounded-2xl p-6 border border-gray-200 dark:border-white/10">
            {unscheduledCount > 0 && (
                <div className="flex items-center justify-between mb-4 text-[11px] text-slate-500 dark:text-slate-400">
                    <div>
                        <span className="font-semibold">{scheduledCount}</span> tâche(s) planifiée(s)
                        {unscheduledCount > 0 && (
                            <>
                                {' '}•{' '}
                                <span className="font-semibold">{unscheduledCount}</span> sans échéance
                            </>
                        )}
                    </div>
                </div>
            )}
            <div ref={ganttRef} className="gantt-chart"></div>

            {/* Legend */}
            <div className="flex gap-4 mt-4 text-xs font-medium">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span className="text-slate-600 dark:text-slate-400">Terminé</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-blue-500"></div>
                    <span className="text-slate-600 dark:text-slate-400">En cours</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-red-500"></div>
                    <span className="text-slate-600 dark:text-slate-400">Bloqué</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gray-400"></div>
                    <span className="text-slate-600 dark:text-slate-400">À faire</span>
                </div>
            </div>
        </div>
    );
};
