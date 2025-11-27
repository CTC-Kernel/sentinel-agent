import React, { useMemo, useRef } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { ProjectTask } from '../../types';
import { CalendarDays } from 'lucide-react'; // Assuming lucide-react or similar icons are available, otherwise use existing icons

interface GanttChartProps {
    tasks: ProjectTask[];
    viewMode: 'Day' | 'Week' | 'Month';
    onViewModeChange: (mode: 'Day' | 'Week' | 'Month') => void;
    onTaskUpdate?: (task: ProjectTask, start: Date, end: Date) => void;
    onTaskClick?: (task: ProjectTask) => void;
}

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, viewMode, onViewModeChange, onTaskUpdate, onTaskClick }) => {
    const ganttRef = useRef<HTMLDivElement>(null);

    // Map internal view mode to library ViewMode
    const libraryViewMode = useMemo(() => {
        switch (viewMode) {
            case 'Day': return ViewMode.Day;
            case 'Week': return ViewMode.Week;
            case 'Month': return ViewMode.Month;
            default: return ViewMode.Day;
        }
    }, [viewMode]);

    const ganttTasks: Task[] = useMemo(() => {
        return tasks
            .filter(t => t.dueDate) // Ensure task has a date
            .map(task => {
                const endDate = new Date(task.dueDate!);
                let startDate = task.startDate ? new Date(task.startDate) : new Date(endDate);

                // Default start date logic if missing
                if (!task.startDate) {
                    startDate.setDate(endDate.getDate() - 7);
                }

                // Ensure start < end
                if (startDate >= endDate) {
                    startDate = new Date(endDate);
                    startDate.setDate(endDate.getDate() - 1);
                }

                return {
                    start: startDate,
                    end: endDate,
                    name: task.title || 'Sans titre',
                    id: task.id,
                    type: 'task',
                    progress: Math.max(0, Math.min(100, task.progress || 0)),
                    isDisabled: false,
                    styles: {
                        progressColor: task.status === 'Terminé' ? '#10b981' : '#3b82f6',
                        progressSelectedColor: task.status === 'Terminé' ? '#059669' : '#2563eb',
                    },
                };
            });
    }, [tasks]);

    const handleTaskChange = (task: Task) => {
        if (onTaskUpdate) {
            const originalTask = tasks.find(t => t.id === task.id);
            if (originalTask) {
                onTaskUpdate(originalTask, task.start, task.end);
            }
        }
    };

    const handleTaskClick = (task: Task) => {
        const originalTask = tasks.find(t => t.id === task.id);
        if (originalTask && onTaskClick) {
            onTaskClick(originalTask);
        }
    };

    const scrollToToday = () => {
        // This is a best-effort scroll since the library doesn't expose a direct method
        // We rely on re-centering or just letting the user find it.
        // However, switching view mode often re-centers.
        // A real implementation might try to find the "today" line in DOM.
        const todayLine = document.querySelector('.gantt-container line[x1="today"]');
        if (todayLine) {
            todayLine.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    };

    if (ganttTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <p className="font-medium text-slate-600 dark:text-slate-300">Aucune tâche planifiée</p>
                <p className="text-sm text-slate-500 mt-1">Ajoutez des tâches avec des dates pour voir le diagramme</p>
            </div>
        );
    }

    const CustomTooltip = ({ task }: { task: Task }) => {
        const startDate = task.start;
        const endDate = task.end;

        return (
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-4 min-w-[260px] transform transition-all duration-200 z-50">
                <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate pr-4">
                        {task.name}
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${task.progress === 100
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                        }`}>
                        {task.progress}%
                    </div>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-4 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${task.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                        style={{ width: `${task.progress}%` }}
                    />
                </div>

                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                    <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 mb-0.5">Début</span>
                        <span>{startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="text-slate-300 dark:text-slate-700">→</div>
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 mb-0.5">Fin</span>
                        <span>{endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                    </div>
                </div>
            </div>
        );
    };

    const [showList, setShowList] = React.useState(true);

    return (
        <div className="flex flex-col space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 px-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                        <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Chronologie</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{tasks.length} tâches planifiées</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowList(!showList)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${showList ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                        {showList ? 'Masquer Liste' : 'Afficher Liste'}
                    </button>

                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    <button
                        onClick={scrollToToday}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        Aujourd'hui
                    </button>

                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        {(['Day', 'Week', 'Month'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => onViewModeChange(mode)}
                                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all ${viewMode === mode
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {mode === 'Day' ? 'Jour' : mode === 'Week' ? 'Sem' : 'Mois'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="w-full h-[600px] overflow-hidden bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm ring-1 ring-slate-900/5 relative" ref={ganttRef}>
                <Gantt
                    tasks={ganttTasks}
                    viewMode={libraryViewMode}
                    onDateChange={handleTaskChange}
                    onProgressChange={handleTaskChange}
                    onDoubleClick={handleTaskClick}
                    listCellWidth={showList ? "160px" : ""}
                    columnWidth={viewMode === 'Month' ? 300 : viewMode === 'Week' ? 250 : 65}
                    rowHeight={50}
                    barFill={70}
                    barCornerRadius={6}
                    barProgressColor="rgba(255,255,255,0.3)"
                    barProgressSelectedColor="rgba(255,255,255,0.5)"
                    ganttHeight={600}
                    locale="fr"
                    TooltipContent={CustomTooltip}
                    fontFamily="inherit"
                    fontSize="12px"
                    arrowColor="#cbd5e1"
                    arrowIndent={20}
                    todayColor="rgba(59, 130, 246, 0.1)"
                />
            </div>
        </div>
    );
};
