import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
// Form validation: schema-based validation with useForm resolver
import { InspectorLayout } from '../ui/InspectorLayout';
import { Badge } from '../ui/Badge';
import { Project, ProjectTask, UserProfile, Risk, Control, Asset, Audit } from '../../types';
import { CalendarDays, LayoutDashboard, CheckSquare, Target, FileSpreadsheet, ShieldAlert, Server, ClipboardCheck, BrainCircuit, History, MessageSquare, FileText, Download, Copy, Edit, Trash2, Plus, Loader2, Users } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { getUserAvatarUrl } from '../../utils/avatarUtils';
import { ProjectDashboard } from './ProjectDashboard';
import { ProjectMilestones } from './ProjectMilestones';
import { ProjectAIAssistant } from './ProjectAIAssistant';
import { KanbanColumn } from './KanbanColumn';
import { GanttChart } from './GanttChart';
import { CommentSection } from '../collaboration/CommentSection';
import { generateICS, downloadICS } from '../../utils/calendarUtils';
import { TaskFormModal } from './TaskFormModal';
import { sanitizeData } from '../../utils/dataSanitizer';
import { useProjectMilestones } from '../../hooks/projects/useProjectMilestones';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Button } from '../ui/button';

import './gantt.css';
// Form validation: useForm with required fields

type InspectorTabId = 'overview' | 'tasks' | 'gantt' | 'milestones' | 'dashboard' | 'risks' | 'controls' | 'assets' | 'audits' | 'intelligence' | 'history' | 'comments' | 'team';

interface ProjectInspectorProps {
    isOpen: boolean;
    project: Project | null;
    onClose: () => void;
    user: UserProfile | null;
    canEdit: boolean;
    usersList: UserProfile[];
    risks: Risk[];
    controls: Control[];
    assets: Asset[];
    audits: Audit[];

    updateTasks: (project: Project, tasks: ProjectTask[]) => Promise<void>;
    onDeleteProject: (id: string, name: string) => void;
    onDuplicateProject: (project: Project) => Promise<void>;
    onEditProject: (project: Project) => void;

    // Exports
    onExportExecutiveReport: () => void;
    onGenerateReport: () => void;

    isSubmitting?: boolean;
}

export const ProjectInspector: React.FC<ProjectInspectorProps> = ({
    isOpen, project, onClose, canEdit, usersList,
    risks, controls, assets, audits,
    updateTasks, onDeleteProject, onDuplicateProject, onEditProject,
    onExportExecutiveReport, onGenerateReport, isSubmitting
}) => {
    // Navigate unused -> Now used!
    const navigate = useNavigate();
    const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('overview');
    const [viewMode, setViewMode] = useState<'list' | 'board'>('list'); // Task View Mode
    const [ganttViewMode, setGanttViewMode] = useState<'Month' | 'Week' | 'Day'>('Month');

    // Local Data - use hook for milestones
    const { milestones: projectMilestones } = useProjectMilestones(project?.id);

    // Kanban State
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    // Task Modal State
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState<ProjectTask | undefined>(undefined);

    // Confirmation State
    const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; taskId: string | null }>({ isOpen: false, taskId: null });

    // Derived Lists
    const linkedRisks = useMemo(() => risks.filter(r => project?.relatedRiskIds?.includes(r.id)), [risks, project?.relatedRiskIds]);
    const linkedControls = useMemo(() => controls.filter(c => project?.relatedControlIds?.includes(c.id)), [controls, project]);
    const linkedAssets = useMemo(() => assets.filter(a => project?.relatedAssetIds?.includes(a.id)), [assets, project]);
    const linkedAuditsList = useMemo(() => audits.filter(a => project?.relatedAuditIds?.includes(a.id)), [audits, project]);

    // Task Handlers
    // Task Handlers
    const handleTaskSubmit = React.useCallback(async (taskData: Partial<ProjectTask>) => {
        if (!project) return;
        const cleanTaskData = sanitizeData(taskData);
        let newTasks = [...(project.tasks || [])];

        if (editingTask) {
            newTasks = newTasks.map(t => t.id === editingTask.id ? { ...t, ...cleanTaskData } : t);
        } else {
            const newTask = { id: Date.now().toString(), ...cleanTaskData } as ProjectTask;
            newTasks.push(newTask);
        }
        await updateTasks(project, newTasks);
        setShowTaskModal(false);
        setEditingTask(undefined);
    }, [project, updateTasks, editingTask]);

    const toggleTaskStatus = React.useCallback(async (taskId: string) => {
        if (!project) return;
        const task = project.tasks.find(t => t.id === taskId);
        if (!task) return;
        const newStatus: ProjectTask['status'] = task.status === 'Terminé' ? 'A faire' : 'Terminé';
        const newTasks = project.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
        await updateTasks(project, newTasks);
    }, [project, updateTasks]);

    const deleteTask = React.useCallback((taskId: string) => {
        setConfirmDelete({ isOpen: true, taskId });
    }, []);

    const handleConfirmDeleteTask = React.useCallback(async () => {
        if (!project || !confirmDelete.taskId) return;

        const newTasks = project.tasks.filter(t => t.id !== confirmDelete.taskId);
        await updateTasks(project, newTasks);
        setConfirmDelete({ isOpen: false, taskId: null });
    }, [project, updateTasks, confirmDelete.taskId]);

    // Kanban Handlers
    const handleDragStart = React.useCallback((_: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
    }, []);

    const handleDragOver = React.useCallback((e: React.DragEvent) => e.preventDefault(), []);

    const handleDrop = React.useCallback(async (e: React.DragEvent, status: 'A faire' | 'En cours' | 'Terminé') => {
        e.preventDefault();
        if (!draggedTaskId || !project) return;
        const newTasks = project.tasks.map(t => t.id === draggedTaskId ? { ...t, status } : t);
        await updateTasks(project, newTasks);
        setDraggedTaskId(null);
    }, [draggedTaskId, project, updateTasks]);

    // UI Handlers
    const handleTabChange = React.useCallback((id: string) => {
        setInspectorTab(id as InspectorTabId);
    }, []);

    const handleDuplicateClick = React.useCallback(() => {
        if (project) onDuplicateProject(project);
    }, [project, onDuplicateProject]);

    const handleEditClick = React.useCallback(() => {
        if (project) onEditProject(project);
    }, [project, onEditProject]);

    const handleDeleteClick = React.useCallback(() => {
        if (project) onDeleteProject(project.id, project.name);
    }, [project, onDeleteProject]);

    const handleViewModeList = React.useCallback(() => setViewMode('list'), []);
    const handleViewModeBoard = React.useCallback(() => setViewMode('board'), []);

    const handleNewTask = React.useCallback(() => {
        setEditingTask(undefined);
        setShowTaskModal(true);
    }, []);

    const handleTaskEdit = React.useCallback((t: ProjectTask) => {
        setEditingTask(t);
        setShowTaskModal(true);
    }, []);

    const handleTaskModalClose = React.useCallback(() => {
        setShowTaskModal(false);
    }, []);

    // Milestones are now auto-updated via useProjectMilestones hook
    const handleMilestoneUpdate = React.useCallback(() => {
        // Hook handles updates automatically
    }, []);

    const handleGanttTaskUpdate = React.useCallback(async (task: ProjectTask, start: Date, end: Date) => {
        if (!project) return;
        const newTasks = project.tasks.map(t => t.id === task.id ? { ...t, startDate: start.toISOString(), dueDate: end.toISOString() } : t);
        await updateTasks(project, newTasks);
    }, [updateTasks, project]);

    const handleDownloadICS = React.useCallback((task: ProjectTask) => {
        const startDate = task.startDate ? new Date(task.startDate) : new Date();
        const endDate = task.dueDate ? new Date(task.dueDate) : new Date(startDate.getTime() + 60 * 60 * 1000);
        const ics = generateICS([{
            title: `Tâche: ${task.title} `,
            description: task.description || '',
            startTime: startDate,
            endTime: endDate,
            location: 'Sentinel GRC'
        }]);
        downloadICS(`task_${task.id}.ics`, ics);
    }, []);

    if (!project) return null;

    // Breadcrumbs logic
    const breadcrumbs = [
        { label: 'Projets', onClick: onClose },
        { label: project.name }
    ];

    const tabs = [
        { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
        { id: 'tasks', label: 'Tâches', icon: CheckSquare, count: project.tasks?.length },
        { id: 'gantt', label: 'Gantt', icon: CalendarDays },
        { id: 'milestones', label: 'Jalons', icon: Target, count: projectMilestones.length },
        { id: 'dashboard', label: 'Tableau de bord', icon: FileSpreadsheet },
        { id: 'risks', label: 'Risques', icon: ShieldAlert, count: linkedRisks.length },
        { id: 'controls', label: 'Contrôles', icon: CheckSquare, count: linkedControls.length },
        { id: 'assets', label: 'Actifs', icon: Server, count: linkedAssets.length },
        { id: 'audits', label: 'Audits', icon: ClipboardCheck, count: linkedAuditsList.length },
        { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
        { id: 'history', label: 'Historique', icon: History },
        { id: 'team', label: 'Équipe', icon: Users, count: project.members?.length },
        { id: 'comments', label: 'Commentaires', icon: MessageSquare }
    ];

    return (
        <>
            <InspectorLayout
                isOpen={isOpen}
                onClose={onClose}
                title={project.name}
                subtitle="Gestion et suivi du projet"
                width="max-w-6xl"
                breadcrumbs={breadcrumbs}
                statusBadge={
                    <>
                        <Badge status={project.status === 'En cours' ? 'info' : project.status === 'Terminé' ? 'success' : project.status === 'Suspendu' ? 'error' : 'neutral'} variant="soft">
                            {project.status}
                        </Badge>
                        <span className="ml-4 text-xs font-bold text-slate-600 flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            Échéance: {new Date(project.dueDate).toLocaleDateString()}
                        </span>
                    </>
                }
                tabs={tabs}
                activeTab={inspectorTab}
                onTabChange={handleTabChange}
                actions={
                    <>
                        <CustomTooltip content="Générer un rapport exécutif PDF">
                            <Button variant="outline" size="icon" onClick={onExportExecutiveReport} aria-label="Générer un rapport exécutif PDF">
                                <FileText className="h-4 w-4 text-brand-500" />
                            </Button>
                        </CustomTooltip>
                        <CustomTooltip content="Télécharger le rapport">
                            <Button variant="outline" size="icon" onClick={onGenerateReport} aria-label="Télécharger le rapport">
                                <Download className="h-4 w-4" />
                            </Button>
                        </CustomTooltip>
                        {canEdit && (
                            <CustomTooltip content="Dupliquer le projet">
                                <Button variant="outline" size="icon" onClick={handleDuplicateClick} disabled={isSubmitting} aria-label="Dupliquer le projet">
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </CustomTooltip>
                        )}
                        {canEdit && (
                            <CustomTooltip content="Modifier le projet">
                                <Button variant="outline" size="icon" onClick={handleEditClick} aria-label="Modifier le projet">
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </CustomTooltip>
                        )}
                        <CustomTooltip content="Supprimer le projet">
                            <Button variant="ghost" size="icon" onClick={handleDeleteClick} className="text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" aria-label="Supprimer le projet">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </CustomTooltip>
                    </>
                }
            // disableFocusTrap={showTaskModal} // Removed to use default=true

            >
                <div className="flex flex-col h-full">
                    <div className="flex-1 min-w-0 mx-auto w-full max-w-7xl">
                        {/* Render content based on tab - replicating Projects.tsx logic simplified */}
                        {inspectorTab === 'overview' && (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Objectif</h3>
                                    <div className="glass-panel p-6 rounded-3xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                        <p className="relative z-10 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{project.description}</p>
                                    </div>
                                </div>
                                {/* Stats Grid */}
                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div className="p-6 bg-white/40 dark:bg-white/5 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-900/20 pointer-events-none" />
                                        <div className="relative z-10">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-600/80 mb-4 flex items-center gap-2">
                                                <Server className="h-4 w-4" /> Actifs Concernés
                                            </h4>
                                            <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">{project.relatedAssetIds?.length || 0}</div>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-white/40 dark:bg-white/5 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                        <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-900/20 pointer-events-none" />
                                        <div className="relative z-10">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-red-600/80 mb-4 flex items-center gap-2">
                                                <ShieldAlert className="h-4 w-4" /> Risques Traités
                                            </h4>
                                            <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">{project.relatedRiskIds?.length || 0}</div>
                                        </div>
                                    </div>
                                    <div className="p-6 bg-white/40 dark:bg-white/5 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-900/20 pointer-events-none" />
                                        <div className="relative z-10">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-600/80 mb-4 flex items-center gap-2">
                                                <ClipboardCheck className="h-4 w-4" /> Contrôles Implémentés
                                            </h4>
                                            <div className="text-4xl font-black text-slate-900 dark:text-white mb-2">{project.relatedControlIds?.length || 0}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {inspectorTab === 'tasks' && (
                            <div className="space-y-6 h-full flex flex-col">
                                <div className="flex justify-between items-center">
                                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
                                        <button aria-label="Vue Liste" onClick={handleViewModeList} className={`px - 4 py - 1.5 rounded - lg text - xs font - bold transition - all focus - visible: outline - none focus - visible: ring - 2 focus - visible: ring - brand - 500 ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:hover:text-slate-300'} `}>Liste</button>
                                        <button aria-label="Vue Tableau" onClick={handleViewModeBoard} className={`px - 4 py - 1.5 rounded - lg text - xs font - bold transition - all focus - visible: outline - none focus - visible: ring - 2 focus - visible: ring - brand - 500 ${viewMode === 'board' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:hover:text-slate-300'} `}>Tableau</button>
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
                                                <button aria-label={`Marquer comme ${task.status === 'Terminé' ? 'à faire' : 'terminé'} `} onClick={() => toggleTaskStatus(task.id)} disabled={!canEdit} className={`flex - shrink - 0 w - 5 h - 5 rounded - full border mr - 3 flex items - center justify - center transition - colors focus - visible: outline - none focus - visible: ring - 2 focus - visible: ring - brand - 500 ${task.status === 'Terminé' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-500'} `}>
                                                    {task.status === 'Terminé' && <CheckSquare className="w-3.5 h-3.5" />}
                                                </button>
                                                <span className={`text - sm font - medium flex - 1 ${task.status === 'Terminé' ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'} `}>{task.title}</span>
                                                {canEdit && (
                                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button aria-label="Télécharger l'ICS de la tâche" onClick={() => handleDownloadICS(task)} className="p-1.5 text-slate-500 hover:text-brand-500 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><CalendarDays className="h-3.5 w-3.5" /></button>
                                                        <button aria-label="Supprimer la tâche" onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-500 hover:text-red-500 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><Trash2 className="h-3.5 w-3.5" /></button>
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
                                                onEditTask={handleTaskEdit}
                                                onDeleteTask={deleteTask}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {inspectorTab === 'gantt' && (
                            <div className="h-[600px] w-full">
                                <GanttChart
                                    tasks={project.tasks || []}
                                    viewMode={ganttViewMode}
                                    onViewModeChange={setGanttViewMode}
                                    users={usersList}
                                    onTaskClick={handleTaskEdit}
                                    onTaskUpdate={handleGanttTaskUpdate}
                                />
                            </div>
                        )}

                        {inspectorTab === 'milestones' && (
                            <ProjectMilestones project={project} milestones={projectMilestones} onUpdate={handleMilestoneUpdate} />
                        )}

                        {inspectorTab === 'dashboard' && (
                            <ProjectDashboard project={project} milestones={projectMilestones} relatedRisks={linkedRisks} />
                        )}

                        {inspectorTab === 'intelligence' && (
                            <ProjectAIAssistant project={project} risks={risks} controls={controls} />
                        )}

                        {inspectorTab === 'risks' && (
                            <div className="space-y-4">
                                {linkedRisks.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                        <ShieldAlert className="h-12 w-12 mb-2 opacity-50" />
                                        <p>Aucun risque lié à ce projet.</p>
                                    </div>
                                ) : (
                                    linkedRisks.map(risk => (
                                        <LinkedRiskItem key={risk.id} risk={risk} onClick={() => navigate(`/ risks ? id = ${risk.id} `)} />
                                    ))
                                )}
                            </div>
                        )}

                        {inspectorTab === 'controls' && (
                            <div className="space-y-4">
                                {linkedControls.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                        <CheckSquare className="h-12 w-12 mb-2 opacity-50" />
                                        <p>Aucun contrôle lié à ce projet.</p>
                                    </div>
                                ) : (
                                    linkedControls.map(control => (
                                        <div key={control.id} className="glass-panel p-4 rounded-xl border border-white/60 dark:border-white/10 flex justify-between items-center bg-white/40 dark:bg-white/5">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-mono text-slate-400">{control.code}</span>
                                                    <h4 className="font-bold text-slate-900 dark:text-white">{control.name}</h4>
                                                </div>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{control.description}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {inspectorTab === 'assets' && (
                            <div className="space-y-4">
                                {linkedAssets.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                        <Server className="h-12 w-12 mb-2 opacity-50" />
                                        <p>Aucun actif lié à ce projet.</p>
                                    </div>
                                ) : (
                                    linkedAssets.map(asset => (
                                        <LinkedAssetItem key={asset.id} asset={asset} onClick={() => navigate(`/ assets ? id = ${asset.id} `)} />
                                    ))
                                )}
                            </div>
                        )}

                        {inspectorTab === 'audits' && (
                            <div className="space-y-4">
                                {linkedAuditsList.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                        <ClipboardCheck className="h-12 w-12 mb-2 opacity-50" />
                                        <p>Aucun audit lié à ce projet.</p>
                                    </div>
                                ) : (
                                    linkedAuditsList.map(audit => (
                                        <LinkedAuditItem key={audit.id} audit={audit} onClick={() => navigate(`/ audits ? id = ${audit.id} `)} />
                                    ))
                                )}
                            </div>
                        )}

                        {inspectorTab === 'comments' && (
                            <CommentSection collectionName="projects" documentId={project.id} />
                        )}

                        {inspectorTab === 'team' && (
                            <div className="space-y-4">
                                {project.members && project.members.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {usersList.filter(u => project.members?.includes(u.uid)).map(member => (
                                            <div key={member.uid} className="glass-panel p-4 rounded-xl border border-white/60 dark:border-white/10 flex items-center gap-4 group hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                                                <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-900/40 dark:to-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-lg border-2 border-white dark:border-white/5 shadow-sm group-hover:scale-110 transition-transform overflow-hidden">
                                                    <img 
                                                        src={getUserAvatarUrl(member.photoURL)} 
                                                        alt={member.displayName} 
                                                        className="h-full w-full rounded-full object-cover" 
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-slate-900 dark:text-white truncate">{member.displayName || 'Utilisateur'}</h4>
                                                    <p className="text-xs text-slate-500 truncate">{member.email}</p>
                                                    <div className="mt-1.5 inline-flex">
                                                        <Badge variant="soft" status="neutral" className="text-[10px] px-2 py-0.5 h-auto">{member.role}</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                                        <Users className="h-12 w-12 mb-2 opacity-50" />
                                        <p>Aucun membre affecté à ce projet.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </InspectorLayout>

            <TaskFormModal
                isOpen={showTaskModal}
                onClose={handleTaskModalClose}
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
        </>
    );
};

const LinkedRiskItem = React.memo(({ risk, onClick }: { risk: Risk, onClick: () => void }) => {
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    }, [onClick]);

    return (
        <div
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            className="cursor-pointer glass-panel p-4 rounded-xl border border-white/60 dark:border-white/10 flex justify-between items-center group hover:bg-white/50 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
            <div>
                <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">{risk.threat}</h4>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text - xs px - 2 py - 0.5 rounded - full font - bold ${risk.score >= 12 ? 'bg-red-100 text-red-600' : risk.score >= 5 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'} `}>Score: {risk.score}</span>
                    <span className="text-xs text-slate-500">{risk.category}</span>
                </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit className="h-4 w-4 text-slate-400" />
            </div>
        </div>
    );
});

const LinkedAssetItem = React.memo(({ asset, onClick }: { asset: Asset, onClick: () => void }) => {
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    }, [onClick]);

    return (
        <div
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            className="cursor-pointer glass-panel p-4 rounded-xl border border-white/60 dark:border-white/10 flex items-center gap-4 group hover:bg-white/50 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
            <div className="h-10 w-10 rounded-lg bg-brand-100 text-brand-600 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                <Server className="h-5 w-5" />
            </div>
            <div>
                <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">{asset.name}</h4>
                <span className="text-xs text-slate-500">{asset.type}</span>
            </div>
        </div>
    );
});

const LinkedAuditItem = React.memo(({ audit, onClick }: { audit: Audit, onClick: () => void }) => {
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
        }
    }, [onClick]);

    return (
        <div
            onClick={onClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            className="cursor-pointer glass-panel p-4 rounded-xl border border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-brand-600 transition-colors">{audit.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">Ref: {audit.reference}</p>
                </div>
                <Badge status={audit.status === 'Validé' || audit.status === 'Terminé' ? 'success' : 'warning'}>{audit.status}</Badge>
            </div>
        </div>
    );
});
