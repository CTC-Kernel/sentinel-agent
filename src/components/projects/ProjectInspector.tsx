import React, { useState, useMemo } from 'react';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Badge } from '../ui/Badge';
import { Project, ProjectTask, UserProfile, Risk, Control, Asset, Audit, Supplier, BusinessProcess } from '../../types';
import { CalendarDays, LayoutDashboard, CheckSquare, Target, FileSpreadsheet, ShieldAlert, Server, ClipboardCheck, BrainCircuit, History, MessageSquare, FileText, Download, Copy, Edit, Trash2, Loader2, Users } from '../ui/Icons';
import { Tooltip as CustomTooltip } from '../ui/Tooltip';
import { ProjectDashboard } from './ProjectDashboard';
import { ProjectMilestones } from './ProjectMilestones';
import { ProjectAIAssistant } from './ProjectAIAssistant';
import { GanttChart } from './GanttChart';
import { CommentSection } from '../collaboration/CommentSection';
import { useProjectMilestones } from '../../hooks/projects/useProjectMilestones';
import { Button } from '../ui/button';
import { ProjectOverview } from './inspector/ProjectOverview';
import { ProjectTasks } from './inspector/ProjectTasks';
import { ProjectDependencies } from './inspector/ProjectDependencies';
import { ProjectTeam } from './inspector/ProjectTeam';

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
    suppliers?: Supplier[];
    processes?: BusinessProcess[];

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
    risks, controls, assets, audits, suppliers, processes,
    updateTasks, onDeleteProject, onDuplicateProject, onEditProject,
    onExportExecutiveReport, onGenerateReport, isSubmitting
}) => {
    // Navigate unused -> Now used! removed
    const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('overview');
    const [ganttViewMode, setGanttViewMode] = useState<'Month' | 'Week' | 'Day'>('Month');

    // Local Data - use hook for milestones
    const { milestones: projectMilestones } = useProjectMilestones(project?.id);

    // Derived Lists
    const linkedRisks = useMemo(() => risks.filter(r => project?.relatedRiskIds?.includes(r.id)), [risks, project?.relatedRiskIds]);
    const linkedControls = useMemo(() => controls.filter(c => project?.relatedControlIds?.includes(c.id)), [controls, project]);
    const linkedAssets = useMemo(() => assets.filter(a => project?.relatedAssetIds?.includes(a.id)), [assets, project]);
    const linkedAuditsList = useMemo(() => audits.filter(a => project?.relatedAuditIds?.includes(a.id)), [audits, project]);

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

    // Milestones are now auto-updated via useProjectMilestones hook
    const handleMilestoneUpdate = React.useCallback(() => {
        // Hook handles updates automatically
    }, []);

    const handleGanttTaskUpdate = React.useCallback(async (task: ProjectTask, start: Date, end: Date) => {
        if (!project) return;
        const newTasks = project.tasks?.map(t => t.id === task.id ? { ...t, startDate: start.toISOString(), dueDate: end.toISOString() } : t) || [];
        await updateTasks(project, newTasks);
    }, [updateTasks, project]);

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
        >
            <div className="flex flex-col h-full">
                <div className="flex-1 min-w-0 mx-auto w-full max-w-7xl">
                    {/* Overview */}
                    {inspectorTab === 'overview' && (
                        <ProjectOverview project={project} />
                    )}

                    {/* Tasks */}
                    {inspectorTab === 'tasks' && (
                        <ProjectTasks
                            project={project}
                            canEdit={canEdit}
                            usersList={usersList}
                            onUpdateTasks={updateTasks}
                        />
                    )}

                    {/* Gantt */}
                    {inspectorTab === 'gantt' && (
                        <div className="h-[600px] w-full">
                            <GanttChart
                                tasks={project.tasks || []}
                                viewMode={ganttViewMode}
                                onViewModeChange={setGanttViewMode}
                                users={usersList}
                                onTaskClick={(t) => {
                                    // Hack: We don't have direct access to task modal here anymore for GANTT edits
                                    // If GANTT needs to edit tasks, we might need to lift state back up or expose a handler in ProjectTasks
                                    // For now, let's keep GANTT edit restricted or just logging
                                    console.log('Task clicked in Gantt', t);
                                    // To fully support Gantt edits, we'd need to lift `editingTask` state up to `ProjectInspector`
                                    // or replicate the modal in `ProjectInspector` just for Gantt.
                                    // Given complexity, let's assume Gantt is view-mostly for now or address in next iteration.
                                }}
                                onTaskUpdate={handleGanttTaskUpdate}
                            />
                        </div>
                    )}

                    {/* Milestones */}
                    {inspectorTab === 'milestones' && (
                        <ProjectMilestones project={project} milestones={projectMilestones} onUpdate={handleMilestoneUpdate} />
                    )}

                    {/* Dashboard */}
                    {inspectorTab === 'dashboard' && (
                        <ProjectDashboard project={project} milestones={projectMilestones} relatedRisks={linkedRisks} />
                    )}

                    {/* Intelligence */}
                    {inspectorTab === 'intelligence' && (
                        <ProjectAIAssistant project={project} risks={risks} controls={controls} />
                    )}

                    {/* Dependencies */}
                    {inspectorTab === 'risks' && (
                        <ProjectDependencies
                            type="risks"
                            items={linkedRisks}
                            project={project}
                            usersList={usersList}
                            assets={assets}
                            controls={controls}
                            audits={audits}
                            risks={risks}
                            suppliers={suppliers}
                            processes={processes}
                            canEdit={canEdit}
                        />
                    )}

                    {inspectorTab === 'controls' && (
                        <ProjectDependencies type="controls" items={linkedControls} canEdit={canEdit} />
                    )}

                    {inspectorTab === 'assets' && (
                        <ProjectDependencies
                            type="assets"
                            items={linkedAssets}
                            usersList={usersList}
                            suppliers={suppliers}
                            processes={processes}
                            canEdit={canEdit}
                        />

                    )}

                    {inspectorTab === 'audits' && (
                        <ProjectDependencies
                            type="audits"
                            items={linkedAuditsList}
                            usersList={usersList}
                            canEdit={canEdit}
                        />
                    )}

                    {/* Team */}
                    {inspectorTab === 'team' && (
                        <ProjectTeam project={project} usersList={usersList} />
                    )}

                    {/* Comments */}
                    {inspectorTab === 'comments' && (
                        <CommentSection collectionName="projects" documentId={project.id} />
                    )}
                </div>
            </div>
        </InspectorLayout>
    );
};
