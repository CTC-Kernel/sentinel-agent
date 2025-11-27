import React, { useEffect, useRef } from 'react';
import Gantt from 'frappe-gantt';
import { ProjectTask } from '../../types';
import { ErrorLogger } from '../../services/errorLogger';
import './gantt.css';

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

    // Helper to parse dates safely
    const parseDate = (dateStr: string): Date | null => {
        if (!dateStr) return null;

        let date: Date;
        // Handle various formats
        if (dateStr.includes('/')) {
            // Handle dd/mm/yyyy
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            } else {
                return null;
            }
        } else {
            // Handle ISO string or other formats
            date = new Date(dateStr);
        }

        // Check validity
        if (Number.isNaN(date.getTime())) {
            console.warn(`Invalid date encountered: ${dateStr}`);
            return null;
        }
        return date;
    };

    useEffect(() => {
        if (!ganttRef.current) return;

        // Clear previous instance
        ganttRef.current.innerHTML = '';
        ganttInstance.current = null;

        if (scheduledTasks.length === 0) {
            return;
        }

        const validTaskIds = new Set(scheduledTasks.map(t => t.id));

        const ganttTasks: GanttTask[] = scheduledTasks.reduce((acc: GanttTask[], task) => {
            if (!task.dueDate) return acc;

            // Determine dates
            const endDate = parseDate(task.dueDate) || new Date();
            let startDate = task.startDate ? parseDate(task.startDate) : null;

            if (!startDate) {
                // Fallback: end date - 7 days
                startDate = new Date(endDate);
                startDate.setDate(endDate.getDate() - 7);
            }

            // Ensure start date is before end date
            if (startDate >= endDate) {
                startDate = new Date(endDate);
                startDate.setDate(endDate.getDate() - 1);
            }

            // Double check to ensure we don't have same day start/end which might cause 0 width bars
            if (startDate.getTime() === endDate.getTime()) {
                startDate.setDate(startDate.getDate() - 1);
            }

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

            // Sanitize ID for DOM selector safety
            const safeId = `gantt-${task.id.replace(/[^a-zA-Z0-9-_]/g, '_')}`;

            // Filter dependencies to only include those that are in the current view AND are not self-referencing
            const validDependencies = task.dependencies
                ?.filter(depId => validTaskIds.has(depId) && depId !== task.id)
                .map(d => `gantt-${d.replace(/[^a-zA-Z0-9-_]/g, '_')}`)
                .join(',') || '';

            acc.push({
                id: safeId,
                name: task.title || task.description || 'Sans titre',
                start: startDate.toISOString().slice(0, 16).replace('T', ' '), // YYYY-MM-DD HH:mm
                end: endDate.toISOString().slice(0, 16).replace('T', ' '), // YYYY-MM-DD HH:mm
                progress: task.progress ?? 0,
                custom_class: customClass,
                dependencies: validDependencies
            });

            return acc;
        }, []);

        if (ganttTasks.length === 0) return;

        // Create Gantt instance with a slight delay to ensure DOM is ready
        const timer = setTimeout(() => {
            if (!ganttRef.current) return;

            // Check if container has dimensions
            if (ganttRef.current.clientWidth === 0) {
                console.warn('Gantt container has 0 width, skipping render');
                return;
            }

            try {
                // Ensure the container is empty before rendering
                ganttRef.current.innerHTML = '';

                ganttInstance.current = new Gantt(ganttRef.current, ganttTasks, {
                    view_mode: viewMode,
                    bar_height: 30,
                    bar_corner_radius: 6,
                    arrow_curve: 5,
                    padding: 18,
                    view_modes: ['Day', 'Week', 'Month'],
                    date_format: 'YYYY-MM-DD HH:mm',
                    language: 'fr',
                    custom_popup_html: (task: any) => {
                        const originalTask = tasks.find(t => `gantt-${t.id.replace(/[^a-zA-Z0-9-_]/g, '_')}` === task.id);
                        if (!originalTask) return '';

                        return `
                            <div class="gantt-popup-wrapper">
                                <div class="gantt-popup-title">${task.name}</div>
                                <div class="gantt-popup-subtitle">
                                    ${originalTask.assignee || 'Non assigné'} • ${task.progress}%
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
                    on_date_change: (task: any, startDate: Date, endDate: Date) => {
                        const originalTask = tasks.find(t => `gantt-${t.id.replace(/[^a-zA-Z0-9-_]/g, '_')}` === task.id);
                        if (originalTask && onTaskUpdate) {
                            onTaskUpdate(originalTask, startDate, endDate);
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
                if (ganttRef.current) {
                    ganttRef.current.innerHTML = '<div class="text-red-500 p-4 text-sm">Erreur d\'affichage du diagramme. Veuillez rafraîchir la page.</div>';
                }
            }
        }, 100);

        return () => {
            clearTimeout(timer);
            if (ganttRef.current) {
                ganttRef.current.innerHTML = '';
            }
            ganttInstance.current = null;
            const popups = document.querySelectorAll('.gantt-popup-wrapper');
            popups.forEach(p => p.remove());
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

