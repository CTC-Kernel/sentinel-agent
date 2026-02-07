import React, { useMemo, useRef, useState } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import "gantt-task-react/dist/index.css";
import { ProjectTask, UserProfile } from '../../types';
import { CalendarDays, User } from '../ui/Icons';
import { EmptyChartState } from '../ui/EmptyChartState';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { SENTINEL_PALETTE, SEVERITY_COLORS } from '../../theme/chartTheme';
import { useLocale } from '@/hooks/useLocale';

interface GanttChartProps {
 tasks: ProjectTask[];
 viewMode: 'Day' | 'Week' | 'Month';
 onViewModeChange: (mode: 'Day' | 'Week' | 'Month') => void;
 onTaskUpdate?: (task: ProjectTask, start: Date, end: Date) => void;
 onTaskClick?: (task: ProjectTask) => void;
 users?: UserProfile[];
 loading?: boolean;
}

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, viewMode, onViewModeChange, onTaskUpdate, onTaskClick, users = [], loading }) => {
 const { config } = useLocale();
 const ganttRef = useRef<HTMLDivElement>(null);
 // Default to hidden on mobile (< 768px)
 const [showList, setShowList] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

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
  // Default to 1 day duration if start date is missing, ending on due date
  startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 1);
 }

 // Ensure start < end
 if (startDate >= endDate) {
  startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 1);
 }

 // Determine color based on status (using harmonized palette)
 let progressColor = SENTINEL_PALETTE.primary; // Blue default
 let backgroundColor = `${SENTINEL_PALETTE.primary}1a`; // 10% opacity

 switch (task.status) {
  case 'Terminé':
  progressColor = SENTINEL_PALETTE.success;
  backgroundColor = `${SENTINEL_PALETTE.success}1a`;
  break;
  case 'En cours':
  progressColor = SENTINEL_PALETTE.primary;
  backgroundColor = `${SENTINEL_PALETTE.primary}1a`;
  break;
  case 'Bloqué':
  progressColor = SEVERITY_COLORS.critical;
  backgroundColor = `${SEVERITY_COLORS.critical}1a`;
  break;
  default: // À faire
  progressColor = SENTINEL_PALETTE.tertiary;
  backgroundColor = `${SENTINEL_PALETTE.tertiary}1a`;
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
  progressColor: progressColor,
  progressSelectedColor: progressColor,
  backgroundColor: backgroundColor,
  },
  // Custom data for tooltip/list
  projectTask: task
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
 // The library doesn't expose a direct method, but we can try to find the "today" marker
 // Or simply reset view to 'Day' which usually centers on today
 onViewModeChange('Day');
 setTimeout(() => {
 const todayLine = document.querySelector('.gantt-container line[x1="today"]');
 if (todayLine) {
 todayLine.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
 }
 }, 100);
 };

 const handleKeyDown = (e: React.KeyboardEvent, task: Task) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 handleTaskClick(task);
 }
 };

 const getUserAvatar = (assigneeName?: string) => {
 if (!assigneeName) return null;
 const user = users.find(u => u.displayName === assigneeName || u.email === assigneeName);
 return (
 <img
 src={getUserAvatarUrl(user?.photoURL, user?.role)}
 alt={assigneeName}
 className="w-6 h-6 rounded-full border border-border shadow-sm object-cover"
 />
 );
 };

 if (loading) {
 return (
 <div className="flex flex-col space-y-4 animate-fade-in">
 {/* Toolbar Skeleton */}
 <div className="h-16 w-full bg-muted/50 rounded-2xl animate-pulse" />
 {/* Chart Skeleton */}
 <div className="w-full h-[350px] sm:h-[450px] md:h-[600px] bg-muted/50 rounded-3xl animate-pulse" />
 </div>
 );
 }

 if (ganttTasks.length === 0) {
 return (
 <EmptyChartState
 variant="bar"
 message="Aucune tâche planifiée"
 description="Ajoutez des tâches avec des dates de début et de fin pour visualiser le diagramme de Gantt."
 icon={<CalendarDays className="w-8 h-8 text-primary" />}
 />
 );
 }

 const CustomTooltip = ({ task }: { task: Task }) => {
 const startDate = task.start;
 const endDate = task.end;
 const originalTask = (task as unknown as { projectTask: ProjectTask }).projectTask;
 const assignee = originalTask?.assignee;

 return (
 <div className="bg-card/90 backdrop-blur-xl border border-border/40/50 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-4 min-w-[280px] transform transition-all duration-200 z-tooltip animate-scale-in">
 <div className="flex items-center justify-between mb-3">
  <div className="font-bold text-foreground /40 text-sm truncate pr-4 flex-1">
  {task.name}
  </div>
  <div className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${task.progress === 100
  ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
  : 'bg-info-bg text-info-text'
  }`}>
  {task.progress}%
  </div>
 </div>

 {assignee && (
  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
  {getUserAvatar(assignee)}
  <span className="text-xs text-muted-foreground font-medium">{assignee}</span>
  </div>
 )}

 <div className="w-full bg-muted rounded-full h-1.5 mb-4 overflow-hidden">
  <div
  className={`h-full rounded-full transition-all duration-500 ${task.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
  }`}
  style={{ width: `${task.progress}%` }}
  />
 </div>

 <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
  <div className="flex flex-col">
  <span className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Début</span>
  <span>{startDate.toLocaleDateString(config.intlLocale, { day: 'numeric', month: 'short' })}</span>
  </div>
  <div className="text-muted-foreground">→</div>
  <div className="flex flex-col items-end">
  <span className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Fin</span>
  <span>{endDate.toLocaleDateString(config.intlLocale, { day: 'numeric', month: 'short' })}</span>
  </div>
 </div>
 </div>
 );
 };

 const TaskListHeader = ({ headerHeight }: { headerHeight: number }) => {
 return (
 <div
 style={{ height: headerHeight }}
 className="flex items-center px-4 border-b border-border/40 bg-muted/50 backdrop-blur-md sticky top-0 z-decorator"
 >
 <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex-1">
  Tâche
 </div>
 <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground w-8 text-center">
  %
 </div>
 </div>
 );
 };

 const TaskListTable = ({ rowHeight, tasks }: { rowHeight: number; tasks: Task[] }) => {
 return (
 <div className="border-r border-border/40 bg-card/50 h-full backdrop-blur-sm">
 {tasks.map((t: Task) => {
  const originalTask = (t as unknown as { projectTask: ProjectTask }).projectTask;
  return (
  <div
  key={t.id || 'unknown'}
  style={{ height: rowHeight }}
  className="flex items-center px-4 border-b border-border/40 hover:bg-muted/50 transition-all cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
  onClick={() => handleTaskClick(t)}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => handleKeyDown(e, t)}
  >
  <div className="flex items-center gap-3 w-full overflow-hidden">
  <div className="flex-shrink-0">
   {originalTask?.assignee ? getUserAvatar(originalTask.assignee) : (
   <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border border-border/40">
   <User className="w-3 h-3 text-muted-foreground" />
   </div>
   )}
  </div>
  <div className="flex-1 min-w-0">
   <div className="text-sm font-semibold text-foreground truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
   {t.name}
   </div>
   <div className="text-xs text-muted-foreground truncate">
   {new Date(t.start).toLocaleDateString()} - {new Date(t.end).toLocaleDateString()}
   </div>
  </div>
  <div className={`text-xs font-bold ${t.progress === 100 ? 'text-green-600' : 'text-muted-foreground'}`}>
   {t.progress}%
  </div>
  </div>
  </div>
  );
 })}
 </div>
 );
 };

 return (
 <div className="flex flex-col space-y-4 animate-slide-up">
 {/* Toolbar */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card/80 backdrop-blur-xl p-2 rounded-2xl border border-border/40 shadow-sm">
 <div className="flex items-center gap-3 px-2">
  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl text-primary-foreground shadow-lg shadow-blue-500/20">
  <CalendarDays className="w-4 h-4" />
  </div>
  <div>
  <p className="text-xs font-bold text-foreground">Planning Projet</p>
  <p className="text-xs text-muted-foreground">{tasks.length} tâches • {Math.round(tasks.reduce((acc, t) => acc + (t.progress || 0), 0) / (tasks.length || 1))}% global</p>
  </div>
 </div>

 <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
  <button
  onClick={() => setShowList(!showList)}
  className={`px-3 py-1.5 text-xs font-bold rounded-3xl transition-all border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${showList
  ? 'bg-muted text-foreground border-border/40'
  : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted/50'
  }`}
  >
  {showList ? 'Masquer Liste' : 'Afficher Liste'}
  </button>

  <div className="h-6 w-px bg-muted mx-1"></div>

  <button
  onClick={scrollToToday}
  className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted rounded-3xl transition-colors flex items-center gap-1.5 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
  >
  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
  Aujourd'hui
  </button>

  <div className="h-6 w-px bg-muted mx-1"></div>

  <div className="flex bg-muted p-1 rounded-3xl">
  {(['Day', 'Week', 'Month'] as const).map(mode => (
  <button
  key={mode || 'unknown'}
  onClick={() => onViewModeChange(mode)}
  className={`px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${viewMode === mode
   ? 'bg-card text-foreground shadow-sm scale-105'
   : 'text-muted-foreground hover:text-foreground'
   }`}
  >
  {mode === 'Day' ? 'Jour' : mode === 'Week' ? 'Sem' : 'Mois'}
  </button>
  ))}
  </div>
 </div>
 </div>

 {/* Chart */}
 <div className="w-full h-[350px] sm:h-[450px] md:h-[600px] overflow-hidden bg-card/40 backdrop-blur-sm rounded-3xl border border-border shadow-inner ring-1 ring-border/60 relative" ref={ganttRef}>
 <Gantt
  tasks={ganttTasks}
  viewMode={libraryViewMode}
  onDateChange={handleTaskChange}
  onProgressChange={handleTaskChange}
  onDoubleClick={handleTaskClick}
  listCellWidth={showList ? "280px" : ""}
  columnWidth={viewMode === 'Month' ? 300 : viewMode === 'Week' ? 250 : 65}
  rowHeight={60}
  barFill={60}
  barCornerRadius={12}
  barProgressColor="rgba(255,255,255,0.4)"
  barProgressSelectedColor="rgba(255,255,255,0.6)"
  ganttHeight={600}
  locale="fr"
  TooltipContent={CustomTooltip}
  TaskListHeader={TaskListHeader}
  TaskListTable={TaskListTable}
  fontFamily="inherit"
  fontSize="12px"
  arrowColor={'hsl(var(--muted-foreground) / 0.55)'}
  arrowIndent={20}
  todayColor={`${SENTINEL_PALETTE.primary}1a`}
 />
 </div>
 </div>
 );
};
