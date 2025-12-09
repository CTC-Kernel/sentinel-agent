
import React, { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import 'jspdf-autotable';
import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Project, ProjectTask, Risk, Control, SystemLog, UserProfile, Asset, ProjectMilestone, ProjectTemplate, Audit, Supplier } from '../types';
import { projectSchema, templateFormSchema } from '../schemas/projectSchema';
import { z } from 'zod';
import { canEditResource, canDeleteResource } from '../utils/permissions';
import { Plus, CalendarDays, CheckSquare, Trash2, FolderKanban, Search, FileSpreadsheet, Edit, History, MessageSquare, LayoutDashboard, Download, Copy, Zap, LayoutGrid, List, BrainCircuit, Target, ShieldAlert, Loader2 } from '../components/ui/Icons';
import { Badge } from '../components/ui/Badge';

import { Drawer } from '../components/ui/Drawer';
// import { Modal } from '../components/ui/Modal'; // Removed Modal
import { ProjectForm } from '../components/projects/ProjectForm';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { NotificationService } from '../services/notificationService';
import { getPlanLimits } from '../config/plans';
import { Comments } from '../components/ui/Comments';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { PdfService } from '../services/PdfService';
import { CardSkeleton } from '../components/ui/Skeleton';
import { DataTable } from '../components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { EmptyState } from '../components/ui/EmptyState';
import { generateICS, downloadICS } from '../utils/calendar';
import { ProjectDashboard } from '../components/projects/ProjectDashboard';
import { TemplateModal } from '../components/projects/TemplateModal';
import { createProjectFromTemplate } from '../utils/projectTemplates';
import { KanbanColumn } from '../components/projects/KanbanColumn';

import { GanttChart } from '../components/projects/GanttChart';
import { TaskFormModal } from '../components/projects/TaskFormModal';
import { ProjectAIAssistant } from '../components/projects/ProjectAIAssistant';
import { ProjectMilestones } from '../components/projects/ProjectMilestones';
import '../components/projects/gantt.css';

import { SubscriptionService } from '../services/subscriptionService';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';

import { useFirestoreCollection } from '../hooks/useFirestore';
import { usePersistedState } from '../hooks/usePersistedState';

export const Projects: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, addToast, organization } = useStore();

    // Data Fetching with Hooks
    const { data: rawProjects, loading: loadingProjects } = useFirestoreCollection<Project>(
        'projects',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: rawRisks, loading: loadingRisks } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    // Derived State
    const projects = React.useMemo(() => [...rawProjects].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), [rawProjects]);
    const risks = React.useMemo(() => [...rawRisks].sort((a, b) => b.score - a.score), [rawRisks]);
    const controls = React.useMemo(() => [...rawControls].sort((a, b) => a.code.localeCompare(b.code)), [rawControls]);
    const assets = React.useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);

    const loading = loadingProjects || loadingRisks || loadingControls || loadingAssets || loadingUsers;

    const role = user?.role || 'user';
    const canEdit = canEditResource(user, 'Project');

    let projectsTitle = 'Projets SSI';
    let projectsSubtitle = "Pilotage des plans d'actions et mise en conformité.";

    if (role === 'admin' || role === 'rssi') {
        projectsTitle = 'Projets SSI & Chantiers de Conformité';
        projectsSubtitle = "Planifiez et suivez les projets de sécurité, de remédiation et de mise en conformité ISO 27001.";
    } else if (role === 'direction') {
        projectsTitle = 'Portefeuille de Projets SSI';
        projectsSubtitle = "Visualisez les chantiers clés, leur avancement et les risques de dérive.";
    } else if (role === 'auditor') {
        projectsTitle = 'Projets liés aux Audits';
        projectsSubtitle = "Identifiez les projets issus des plans d'actions d'audit et suivez leur exécution.";
    } else if (role === 'project_manager') {
        projectsTitle = 'Mes Projets SSI';
        projectsSubtitle = "Pilotez vos projets de sécurité, jalons, tâches et risques associés.";
    } else {
        projectsTitle = 'Projets & Actions';
        projectsSubtitle = "Consultez les projets en cours et votre contribution aux plans d'actions.";
    }

    const [creationMode, setCreationMode] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);


    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState<ProjectTask | undefined>(undefined);
    const [filter, setFilter] = useState('');
    const [viewMode, setViewMode] = usePersistedState<'grid' | 'list'>('projects_view_mode', 'grid');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Inspector State
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'overview' | 'tasks' | 'dashboard' | 'history' | 'comments' | 'gantt' | 'intelligence' | 'milestones'>('overview');
    const [taskViewMode, setTaskViewMode] = useState<'list' | 'board'>('list');
    const [projectHistory, setProjectHistory] = useState<SystemLog[]>([]);
    const [projectMilestones, setProjectMilestones] = useState<ProjectMilestone[]>([]);
    const [linkedAudits, setLinkedAudits] = useState<Audit[]>([]);
    const [linkedSuppliers, setLinkedSuppliers] = useState<Supplier[]>([]);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [ganttViewMode, setGanttViewMode] = useState<'Day' | 'Week' | 'Month'>('Week');

    // const [isEditing, setIsEditing] = useState(false); // Removed unused

    // Form State
    // const [isEditing, setIsEditing] = useState(false); // Removed unused


    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const fetchMilestones = useCallback(async (projectId: string) => {
        try {
            const milestonesRef = collection(db, 'project_milestones');
            const q = query(milestonesRef, where('projectId', '==', projectId), where('organizationId', '==', user?.organizationId));
            const snap = await getDocs(q);
            const milestones = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectMilestone));
            milestones.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
            setProjectMilestones(milestones);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Projects.fetchMilestones', 'FETCH_FAILED');
        }
    }, [user?.organizationId]);

    const openInspector = useCallback(async (project: Project) => {
        setSelectedProject(project);
        setInspectorTab('overview');
        setGanttViewMode('Week');
        // setIsEditing(false); // Removed unused

        // Fetch History
        try {
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user?.organizationId), limit(50));
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp
                } as SystemLog;
            });
            const filteredLogs = logs.filter(l => l.resource === 'Project' && l.details?.includes(project.name));
            filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setProjectHistory(filteredLogs);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Projects.openInspector.history', 'FETCH_FAILED');
        }

        // Fetch Milestones
        await fetchMilestones(project.id);

        // Fetch Linked Audits
        try {
            const q = query(collection(db, 'audits'), where('organizationId', '==', user?.organizationId), where('relatedProjectIds', 'array-contains', project.id));
            const snap = await getDocs(q);
            setLinkedAudits(snap.docs.map(d => ({ id: d.id, ...d.data() } as Audit)));
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Projects.fetchLinkedAudits', 'FETCH_FAILED');
        }

        // Fetch Linked Suppliers
        try {
            const q = query(collection(db, 'suppliers'), where('organizationId', '==', user?.organizationId), where('relatedProjectIds', 'array-contains', project.id));
            const snap = await getDocs(q);
            setLinkedSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Projects.fetchLinkedSuppliers', 'FETCH_FAILED');
        }
    }, [user?.organizationId, fetchMilestones]);

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || projects.length === 0) return;
        const project = projects.find(p => p.id === state.voxelSelectedId);
        if (project) {
            openInspector(project);
        }
    }, [location.state, loading, projects, openInspector]);

    const openCreationDrawer = async () => {
        // Check limits only for creation
        if (user?.organizationId) {
            const canAdd = await SubscriptionService.checkLimit(user.organizationId, 'projects', projects.length);
            if (!canAdd) {
                if (confirm("Vous avez atteint la limite de projets de votre plan actuel. Voulez-vous passer au plan supérieur ?")) {
                    navigate('/pricing');
                }
                return;
            }
        }
        setEditingProject(null);
        setCreationMode(true);
    };

    const openEditDrawer = React.useCallback((project: Project) => {
        setEditingProject(project);
        setCreationMode(false);
    }, []);

    // Unified handler for ProjectFormModal submission (create or update)
    const handleProjectFormSubmit = async (projectData: Omit<Project, 'id' | 'organizationId' | 'tasks' | 'progress' | 'createdAt'>) => {
        if (!canEdit || !user?.organizationId) return;

        setIsSubmitting(true);
        try {
            // Validate data
            const validatedData = projectSchema.parse(projectData);


            if (editingProject) {
                // Update existing project
                await updateDoc(doc(db, 'projects', editingProject.id), {
                    ...validatedData
                });
                await logAction(user, 'UPDATE', 'Project', `Mise à jour projet: ${validatedData.name}`);

                // Check for Project Completion & Control Update
                if (validatedData.status === 'Terminé' && editingProject.status !== 'Terminé' && validatedData.relatedControlIds && validatedData.relatedControlIds.length > 0) {
                    const linkedControls = controls.filter(c => validatedData.relatedControlIds?.includes(c.id));
                    if (linkedControls.length > 0) {
                        const controlCodes = linkedControls.map(c => c.code).join(', ');
                        setConfirmData({
                            isOpen: true,
                            title: "Mise à jour des contrôles liés",
                            message: `Ce projet est terminé. Voulez-vous passer les contrôles liés ${controlCodes} au statut "Implémenté" ?`,
                            onConfirm: async () => {
                                try {
                                    for (const control of linkedControls) {
                                        await updateDoc(doc(db, 'controls', control.id), { status: 'Implémenté' });
                                    }
                                    addToast(`${linkedControls.length} contrôles mis à jour à "Implémenté"`, "success");
                                    setConfirmData({ isOpen: false, title: '', message: '', onConfirm: () => { } });
                                } catch (err) {
                                    ErrorLogger.error(err, 'Projects.updateLinkedControls');
                                    addToast("Erreur lors de la mise à jour des contrôles", "error");
                                }
                            }
                        });
                    }
                }

                // Update local state - No longer needed with useFirestoreCollection
                const updatedProject = { ...editingProject, ...validatedData } as Project;
                if (selectedProject?.id === editingProject.id) {
                    setSelectedProject(updatedProject);
                }
            } else {
                // Create new project
                await addDoc(collection(db, 'projects'), {
                    ...validatedData,
                    organizationId: user.organizationId,
                    progress: 0,
                    tasks: [],
                    createdAt: new Date().toISOString()
                });
                await logAction(user, 'CREATE', 'Project', `Nouveau projet: ${validatedData.name}`);
                addToast("Projet créé avec succès", "success");
            }
            setCreationMode(false);
            setEditingProject(null);
            // setIsEditing(false); // Removed unused
        } catch (e) {
            if (e instanceof z.ZodError) {
                addToast((e as z.ZodError).issues[0].message, "error");
            } else {
                ErrorLogger.handleErrorWithToast(e, 'Projects.handleProjectFormSubmit', 'UPDATE_FAILED');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateFromTemplate = async (template: ProjectTemplate, projectName: string, startDate: Date, manager: string) => {
        if (!canEdit || !user?.organizationId) return;

        // Check limits
        const canAdd = await SubscriptionService.checkLimit(user.organizationId, 'projects', projects.length);
        if (!canAdd) {
            if (confirm("Vous avez atteint la limite de projets de votre plan actuel. Voulez-vous passer au plan supérieur ?")) {
                navigate('/pricing');
            }
            return;
        }

        try {
            // Validate template inputs
            templateFormSchema.parse({ projectName, startDate: startDate.toISOString(), manager });

            const { project, milestones } = createProjectFromTemplate(template, projectName, startDate, manager, user.organizationId);

            // Create project
            const projectDoc = await addDoc(collection(db, 'projects'), project);

            // Create milestones
            for (const milestone of milestones) {
                await addDoc(collection(db, 'project_milestones'), {
                    ...milestone,
                    projectId: projectDoc.id,
                    organizationId: user.organizationId
                });
            }

            await logAction(user, 'CREATE', 'Project', `Projet créé depuis template ${template.name}: ${projectName}`);
            addToast(`Projet créé avec ${project.tasks.length} tâches et ${milestones.length} jalons`, "success");
            setShowTemplateModal(false);
        } catch (e) {
            if (e instanceof z.ZodError) {
                addToast((e as z.ZodError).issues[0].message, "error");
            } else {
                ErrorLogger.handleErrorWithToast(e, 'Projects.handleCreateFromTemplate', 'CREATE_FAILED');
            }
        }
    };



    const handleDuplicate = async () => {
        if (!selectedProject || !canEdit || !user?.organizationId) return;

        // Check limits
        const canAdd = await SubscriptionService.checkLimit(user.organizationId, 'projects', projects.length);
        if (!canAdd) {
            if (confirm("Vous avez atteint la limite de projets de votre plan actuel. Voulez-vous passer au plan supérieur ?")) {
                navigate('/pricing');
            }
            return;
        }

        setIsSubmitting(true);
        try {
            const newProjData = {
                ...selectedProject,
                name: `${selectedProject.name} (Copie)`,
                createdAt: new Date().toISOString(),
                organizationId: user.organizationId,
                progress: 0,
                tasks: selectedProject.tasks.map(t => ({ ...t, status: 'A faire', id: Date.now() + Math.random().toString() })) // Reset tasks
            };

            await addDoc(collection(db, 'projects'), newProjData);
            await logAction(user, 'CREATE', 'Project', `Duplication Projet: ${newProjData.name}`);
            addToast("Projet dupliqué", "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Projects.handleDuplicate', 'CREATE_FAILED');
        } finally {
            setIsSubmitting(false);
        }
    };

    const performDelete = React.useCallback(async (id: string) => {
        await deleteDoc(doc(db, 'projects', id));
    }, []);

    const handleDeleteProject = React.useCallback(async (id: string) => {
        if (!canDeleteResource(user, 'Project')) return;
        try {
            await performDelete(id);
            setSelectedProject(null);
            addToast("Projet supprimé", "info");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Projects.handleDeleteProject', 'DELETE_FAILED');
        }
    }, [user, performDelete, addToast]);

    const initiateDelete = React.useCallback((id: string, name: string) => {
        if (!canDeleteResource(user, 'Project')) return;
        setConfirmData({
            isOpen: true,
            title: "Supprimer le projet ?",
            message: `Le projet "${name}" et tout son suivi seront supprimés.`,
            onConfirm: () => handleDeleteProject(id)
        });
    }, [user, handleDeleteProject]);

    const handleBulkDelete = async (ids: string[]) => {
        if (!canDeleteResource(user, 'Project')) return;
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ces ${ids.length} projets ?`)) return;

        try {
            await Promise.all(ids.map(performDelete));
            if (selectedProject?.id && ids.includes(selectedProject.id)) setSelectedProject(null);
            addToast(`${ids.length} projets supprimés`, "info");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Projects.handleBulkDelete', 'DELETE_FAILED');
        }
    };

    const toggleTaskStatus = async (taskId: string) => {
        if (!canEdit || !selectedProject) return;
        const updatedTasks = selectedProject.tasks.map(t => {
            if (t.id === taskId) return { ...t, status: t.status === 'Terminé' ? 'A faire' : 'Terminé' } as ProjectTask;
            return t;
        });
        updateTasks(updatedTasks);
    };

    const moveTaskToStatus = async (taskId: string, newStatus: 'A faire' | 'En cours' | 'Terminé') => {
        if (!canEdit || !selectedProject) return;
        const updatedTasks = selectedProject.tasks.map(t => {
            if (t.id === taskId) return { ...t, status: newStatus } as ProjectTask;
            return t;
        });
        updateTasks(updatedTasks);
    }

    const deleteTask = async (taskId: string) => {
        if (!canEdit || !selectedProject) return;
        const updatedTasks = selectedProject.tasks.filter(t => t.id !== taskId);
        updateTasks(updatedTasks);
    };

    const updateTasks = async (tasks: ProjectTask[]) => {
        if (!selectedProject) return;
        const completed = tasks.filter(t => t.status === 'Terminé').length;
        const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

        try {
            await updateDoc(doc(db, 'projects', selectedProject.id), { tasks, progress });
            setSelectedProject({ ...selectedProject, tasks, progress });
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Projects.updateTasks', 'UPDATE_FAILED');
        }
    };

    const generateReport = () => {
        if (!selectedProject) return;

        const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
        const canWhiteLabel = limits.features.whiteLabelReports;

        PdfService.generateCustomReport(
            {
                title: 'Rapport de Projet',
                subtitle: `Projet: ${selectedProject.name} | ${new Date().toLocaleDateString()}`,
                filename: `Projet_${selectedProject.name}_Report.pdf`,
                organizationName: canWhiteLabel ? organization?.name : undefined,
                organizationLogo: canWhiteLabel ? organization?.logoUrl : undefined
            },
            (doc, startY) => {
                let y = startY;

                // Summary
                doc.setFontSize(12); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
                doc.text("Synthèse", 14, y);
                y += 8;

                const summaryData = [
                    ['Chef de Projet', selectedProject.manager],
                    ['Statut', selectedProject.status],
                    ['Avancement', `${selectedProject.progress}%`],
                    ['Échéance', selectedProject.dueDate ? new Date(selectedProject.dueDate).toLocaleDateString() : '-'],
                    ['Risques Liés', (selectedProject.relatedRiskIds?.length || 0).toString()]
                ];
                doc.autoTable({
                    startY: y,
                    body: summaryData,
                    theme: 'plain',
                    styles: { fontSize: 10, cellPadding: 2 },
                    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
                });

                y = doc.lastAutoTable.finalY + 15;

                // Description
                doc.setFontSize(12); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
                doc.text("Description", 14, y);
                y += 6;
                doc.setFontSize(10); doc.setTextColor(80); doc.setFont('helvetica', 'normal');

                const splitDesc = doc.splitTextToSize(selectedProject.description, 180);
                doc.text(splitDesc, 14, y);
                y += (splitDesc.length * 5) + 15;

                // Tasks
                doc.setFontSize(12); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
                doc.text("État des Tâches", 14, y);
                y += 8;

                const tasksData = selectedProject.tasks.map(t => [t.title, t.status]);
                doc.autoTable({
                    startY: y,
                    head: [['Tâche', 'Statut']],
                    body: tasksData,
                    theme: 'striped',
                    headStyles: { fillColor: [79, 70, 229] }
                });
            }
        );
    };

    const exportPDF = () => {
        const data = projects.map(p => [p.name, p.status, p.manager, p.progress + '%', p.dueDate || '-']);

        const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
        const canWhiteLabel = limits.features.whiteLabelReports;

        PdfService.generateTableReport(
            {
                title: 'Suivi des Projets SSI',
                subtitle: `Exporté le ${new Date().toLocaleDateString()}`,
                filename: 'projets_ssi.pdf',
                organizationName: canWhiteLabel ? organization?.name : undefined,
                organizationLogo: canWhiteLabel ? organization?.logoUrl : undefined
            },
            ['Nom du Projet', 'Statut', 'Responsable', 'Progression', 'Échéance'],
            data
        );
    };

    const handleExportCSV = () => {
        const headers = ["Projet", "Manager", "Statut", "Avancement", "Échéance"];
        const rows = filteredProjects.map(p => [
            p.name,
            p.manager,
            p.status,
            `${p.progress}%`,
            new Date(p.dueDate).toLocaleDateString()
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `projects_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };



    const getAssetById = (id: string) => assets.find(a => a.id === id);
    const getRiskById = (id: string) => risks.find(r => r.id === id);
    const getControlById = (id: string) => controls.find(c => c.id === id);



    const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));

    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        setDraggedTaskId(taskId);
        e.dataTransfer.effectAllowed = 'move';
        // Create a custom drag image if needed, or rely on browser default
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, status: 'A faire' | 'En cours' | 'Terminé') => {
        e.preventDefault();
        if (draggedTaskId) {
            moveTaskToStatus(draggedTaskId, status);
            setDraggedTaskId(null);
        }
    };



    const getBreadcrumbs = () => {
        const crumbs: { label: string; onClick?: () => void }[] = [{ label: 'Projets', onClick: () => { setSelectedProject(null); setCreationMode(false); setEditingProject(null); } }];

        if (creationMode) {
            crumbs.push({ label: 'Nouveau Projet' });
            return crumbs;
        }

        if (editingProject) {
            crumbs.push({ label: editingProject.name });
            crumbs.push({ label: 'Modification' });
            return crumbs;
        }

        if (selectedProject) {
            crumbs.push({ label: selectedProject.name });
        }

        return crumbs;
    };

    const columns = React.useMemo<ColumnDef<Project>[]>(() => [
        {
            accessorKey: 'name',
            header: 'Projet',
            cell: ({ row }) => (
                <div>
                    <div className="font-bold text-slate-900 dark:text-white text-[15px]">{row.original.name}</div>
                    <div className="text-xs text-slate-500 font-medium line-clamp-1">{row.original.description}</div>
                </div>
            )
        },
        {
            accessorKey: 'manager',
            header: 'Responsable',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
                        {row.original.manager.charAt(0)}
                    </div>
                    {row.original.manager}
                </div>
            )
        },
        {
            accessorKey: 'status',
            header: 'Statut',
            cell: ({ row }) => (
                <Badge status={row.original.status === 'En cours' ? 'info' : row.original.status === 'Terminé' ? 'success' : row.original.status === 'Suspendu' ? 'error' : 'neutral'} variant="soft" size="sm">
                    {row.original.status}
                </Badge>
            )
        },
        {
            accessorKey: 'progress',
            header: 'Progression',
            cell: ({ row }) => (
                <div className="flex items-center gap-3 w-32">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                        <div className="h-1.5 bg-brand-500 rounded-full" style={{ width: `${row.original.progress}%` }}></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{row.original.progress}%</span>
                </div>
            )
        },
        {
            accessorKey: 'dueDate',
            header: 'Échéance',
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {new Date(row.original.dueDate).toLocaleDateString()}
                </span>
            )
        },
        {
            header: 'Tâches',
            accessorFn: (row) => row.tasks?.length || 0,
            cell: ({ row }) => (
                <span className="text-slate-600 dark:text-slate-400 font-medium ml-4">
                    {row.original.tasks?.length || 0}
                </span>
            )
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="text-right flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()}>
                    {canEdit && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); openEditDrawer(row.original); }} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100" title="Modifier">
                                <Edit className="h-4 w-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); initiateDelete(row.original.id, row.original.name); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100" title="Supprimer">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>
            )
        }
    ], [canEdit, openEditDrawer, initiateDelete]);

    return (
        <div className="space-y-6 relative">
            <Helmet>
                <title>Gestion de Projets - Sentinel GRC</title>
                <meta name="description" content="Suivez vos projets de mise en conformité et d'amélioration continue." />
            </Helmet>
            {/* Task Form Modal */}
            <TaskFormModal
                isOpen={showTaskModal}
                onClose={() => {
                    setShowTaskModal(false);
                    setEditingTask(undefined);
                }}
                onSubmit={async (taskData) => {
                    if (!canEdit) return;
                    // Sanitize data: Firestore doesn't support 'undefined'
                    const cleanTaskData = sanitizeData(taskData);

                    if (!selectedProject || !user?.organizationId) return;

                    if (editingTask) {
                        // Update existing task
                        const updatedTasks = selectedProject.tasks?.map(t =>
                            t.id === editingTask.id ? { ...t, ...cleanTaskData } : t
                        ) || [];
                        updateTasks(updatedTasks as ProjectTask[]);

                        // Notify if assignee changed
                        if (cleanTaskData.assigneeId && cleanTaskData.assigneeId !== editingTask.assigneeId) {
                            await NotificationService.notifyTaskAssigned({
                                ...editingTask,
                                ...cleanTaskData,
                                projectName: selectedProject.name,
                                organizationId: user.organizationId
                            } as ProjectTask & { organizationId: string; projectName?: string }, cleanTaskData.assigneeId);
                        }
                    } else {
                        // Create new task
                        const newTask: ProjectTask = {

                            id: Date.now().toString(),
                            ...cleanTaskData
                        } as ProjectTask;
                        const updatedTasks = [...(selectedProject.tasks || []), newTask];
                        updateTasks(updatedTasks);

                        // Notify assignee
                        if (cleanTaskData.assigneeId) {
                            await NotificationService.notifyTaskAssigned({
                                ...newTask,
                                projectName: selectedProject.name,
                                organizationId: user.organizationId
                            } as ProjectTask & { organizationId: string; projectName?: string }, cleanTaskData.assigneeId);
                        }
                    }
                }}
                existingTask={editingTask}
                availableTasks={selectedProject?.tasks || []}
                availableUsers={usersList}
            />

            {/* Template Selection Modal */}
            <TemplateModal
                isOpen={showTemplateModal}
                onClose={() => setShowTemplateModal(false)}
                onSelectTemplate={handleCreateFromTemplate}
                managers={usersList.map(u => u.displayName || u.email)}
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <PageHeader
                title={projectsTitle}
                subtitle={projectsSubtitle}
                breadcrumbs={[
                    { label: 'Projets' }
                ]}
                icon={<FolderKanban className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={canEdit && (
                    <>
                        <button
                            onClick={() => {
                                const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
                                if (!limits.features.customTemplates) {
                                    if (confirm("Cette fonctionnalité nécessite un plan Professional ou Enterprise. Voulez-vous mettre à niveau ?")) {
                                        navigate('/pricing');
                                    }
                                    return;
                                }
                                setShowTemplateModal(true);
                            }}
                            className="flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20"
                        >
                            <Zap className="h-4 w-4 mr-2" />
                            Depuis Template
                        </button>
                        <button
                            onClick={openCreationDrawer}
                            className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nouveau Projet
                        </button>
                    </>
                )}
            />

            {/* Summary Card */}
            <div className="glass-panel p-6 md:p-7 rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group">
                <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
                </div>
                {/* Global Score */}
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90" style={{ overflow: 'visible' }}>
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-slate-200 dark:text-slate-700"
                            />
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * (projects.length > 0 ? Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length) : 0)) / 100}
                                className="text-brand-500 transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-xl font-black text-slate-900 dark:text-white">
                                {projects.length > 0 ? Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length) : 0}%
                            </span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Avancement Global</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px]">
                            Moyenne d'avancement de tous les projets en cours.
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-slate-200 dark:border-white/10 px-6 mx-2">
                    <div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Projets</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{projects.length}</div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">En Cours</div>
                        <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                            {projects.filter(p => p.status === 'En cours').length}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">En Retard</div>
                        <div className={`text-2xl font-bold ${projects.filter(p => new Date(p.dueDate) < new Date() && p.status !== 'Terminé').length > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                            {projects.filter(p => new Date(p.dueDate) < new Date() && p.status !== 'Terminé').length}
                        </div>
                    </div>
                </div>

                {/* Alerts/Status */}
                <div className="flex flex-col gap-3 min-w-[180px]">
                    {projects.filter(p => new Date(p.dueDate) < new Date() && p.status !== 'Terminé').length > 0 && (
                        <div className="flex items-center gap-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl border border-red-100 dark:border-red-800/30">
                            <ShieldAlert className="h-4 w-4 shrink-0" />
                            <span className="font-medium">{projects.filter(p => new Date(p.dueDate) < new Date() && p.status !== 'Terminé').length} projets en retard</span>
                        </div>
                    )}
                    {projects.filter(p => p.status === 'En cours').length > 0 && (
                        <div className="flex items-center gap-3 text-sm text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 px-3 py-2 rounded-xl border border-brand-100 dark:border-brand-800/30">
                            <FolderKanban className="h-4 w-4 shrink-0" />
                            <span className="font-medium">{projects.filter(p => p.status === 'En cours').length} projets actifs</span>
                        </div>
                    )}
                    {projects.length === 0 && (
                        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800/30">
                            <CheckSquare className="h-4 w-4 shrink-0" />
                            <span className="font-medium">Aucun projet</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center space-x-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Rechercher un projet..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white"
                    value={filter} onChange={e => setFilter(e.target.value)}
                />
                <button onClick={handleExportCSV} className="p-2 bg-gray-100 dark:bg-slate-800 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white" title="Exporter CSV">
                    <FileSpreadsheet className="h-4 w-4" />
                </button>
                <button onClick={exportPDF} className="p-2 bg-gray-100 dark:bg-slate-800 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white ml-2" title="Exporter PDF">
                    <Download className="h-4 w-4" />
                </button>
                <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm ml-2">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Vue Grille"><LayoutGrid className="h-4 w-4" /></button>
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Vue Liste"><List className="h-4 w-4" /></button>
                </div>
            </div>

            {viewMode === 'list' ? (
                <div className="glass-panel rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200 dark:border-white/5">
                    <DataTable
                        columns={columns}
                        data={filteredProjects}
                        selectable={true}
                        onBulkDelete={handleBulkDelete}
                        onRowClick={openInspector}
                        searchable={false}
                        loading={loading}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full"><CardSkeleton count={3} /></div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="col-span-full">
                            <EmptyState
                                icon={FolderKanban}
                                title="Aucun projet en cours"
                                description={filter ? "Aucun projet ne correspond à votre recherche." : "Lancez de nouveaux projets pour améliorer votre posture de sécurité."}
                                actionLabel={filter || !canEdit ? undefined : "Créer un projet"}
                                onAction={filter || !canEdit ? undefined : openCreationDrawer}
                            />
                        </div>
                    ) : (
                        filteredProjects.map(project => (
                            <div key={project.id} onClick={() => openInspector(project)} className="glass-panel rounded-[2.5rem] p-6 card-hover flex flex-col cursor-pointer group border border-white/50 dark:border-white/5">
                                <div className="flex justify-between items-start mb-4">
                                    <Badge
                                        status={project.status === 'En cours' ? 'info' : project.status === 'Terminé' ? 'success' : project.status === 'Suspendu' ? 'error' : 'neutral'}
                                        variant="soft"
                                    >
                                        {project.status}
                                    </Badge>
                                    <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {canEdit && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); openEditDrawer(project); }} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg text-slate-400 hover:text-indigo-500 shadow-sm backdrop-blur-sm transition-colors">
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); initiateDelete(project.id, project.name); }} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg text-slate-400 hover:text-red-500 shadow-sm backdrop-blur-sm transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{project.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 h-10 leading-relaxed">{project.description}</p>

                                <div className="mb-6">
                                    <div className="flex justify-between text-xs mb-1.5 font-medium">
                                        <span className="text-slate-600 dark:text-slate-300">Avancement</span>
                                        <span className="text-brand-600">{project.progress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                                        <div className="bg-brand-500 h-2 rounded-full transition-all duration-500 shadow-sm" style={{ width: `${project.progress}%` }}></div>
                                    </div>
                                </div>

                                <div className="flex items-center text-xs text-slate-500 mb-4 space-x-4 border-t border-gray-100 dark:border-white/10 pt-4 mt-auto">
                                    <div className="flex items-center font-medium">
                                        <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                                        {new Date(project.dueDate).toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center font-medium">
                                        <CheckSquare className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                                        {project.tasks?.length || 0} tâches
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Inspector Drawer - Glassmorphism */}
            {/* Inspector Drawer */}
            <Drawer
                isOpen={!!selectedProject}
                onClose={() => setSelectedProject(null)}
                title={selectedProject?.name || 'Détails du projet'}
                subtitle="Gestion et suivi du projet"
                width="max-w-6xl"
                breadcrumbs={getBreadcrumbs()}
                actions={
                    selectedProject && (
                        <>
                            <button onClick={generateReport} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Télécharger Rapport"><Download className="h-5 w-5" /></button>
                            {canEdit && (
                                <button onClick={handleDuplicate} disabled={isSubmitting} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm disabled:opacity-50" title="Dupliquer">
                                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Copy className="h-5 w-5" />}
                                </button>
                            )}
                            {canEdit && (
                                <button onClick={() => openEditDrawer(selectedProject)} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                            )}
                            {canDeleteResource(user, 'Project') && (
                                <button onClick={() => initiateDelete(selectedProject.id, selectedProject.name)} className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                            )}
                        </>
                    )
                }
            >
                {selectedProject && (
                    <div className="flex flex-col h-full">
                        {/* Status Header */}
                        <div className="px-8 py-4 bg-slate-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 flex items-center gap-4">
                            <Badge
                                status={selectedProject.status === 'En cours' ? 'info' : selectedProject.status === 'Terminé' ? 'success' : selectedProject.status === 'Suspendu' ? 'error' : 'neutral'}
                                variant="soft"
                            >
                                {selectedProject.status}
                            </Badge>
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                                <CalendarDays className="h-4 w-4" />
                                Échéance: {new Date(selectedProject.dueDate).toLocaleDateString()}
                            </span>
                        </div>

                        {/* Tabs */}
                        <div className="px-8 border-b border-gray-100 dark:border-white/5 bg-white/30 dark:bg-white/5">
                            <ScrollableTabs
                                tabs={[
                                    { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
                                    { id: 'tasks', label: 'Tâches', icon: CheckSquare },
                                    { id: 'milestones', label: 'Jalons', icon: Target },
                                    { id: 'gantt', label: 'Gantt', icon: CalendarDays },
                                    { id: 'dashboard', label: 'Dashboard', icon: FolderKanban },
                                    { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
                                    { id: 'history', label: 'Historique', icon: History },
                                    { id: 'comments', label: 'Commentaires', icon: MessageSquare }
                                ]}
                                activeTab={inspectorTab}
                                onTabChange={(id) => setInspectorTab(id as 'overview' | 'tasks' | 'dashboard' | 'history' | 'comments' | 'gantt' | 'intelligence' | 'milestones')}
                            />
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
                            {inspectorTab === 'overview' && (
                                <div className="space-y-8">
                                    <div className="space-y-8">
                                        <div>
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Objectif</h3>
                                            <div className="p-6 bg-white dark:bg-slate-800/50 rounded-3xl text-sm text-slate-700 dark:text-slate-300 leading-relaxed border border-gray-100 dark:border-white/5 shadow-sm">
                                                {selectedProject.description}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-6">
                                            <div className="p-5 bg-white dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Actifs Concernés</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">{selectedProject.relatedAssetIds?.length || 0}</p>
                                            </div>
                                            <div className="p-5 bg-white dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Risques Traités</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">{selectedProject.relatedRiskIds?.length || 0}</p>
                                            </div>
                                            <div className="p-5 bg-white dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Contrôles Implémentés</p>
                                                <p className="text-2xl font-black text-slate-900 dark:text-white">{selectedProject.relatedControlIds?.length || 0}</p>
                                            </div>
                                        </div>

                                        {(selectedProject.relatedAssetIds?.length || 0) > 0 && (
                                            <div className="bg-white/80 dark:bg-slate-800/40 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm p-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Actifs critiques</p>
                                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">Chaîne de valeur concernée</h4>
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{selectedProject.relatedAssetIds?.length} actifs</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {selectedProject.relatedAssetIds?.map(assetId => {
                                                        const asset = getAssetById(assetId);
                                                        if (!asset) return null;
                                                        return (
                                                            <div key={assetId} className="flex items-center justify-between bg-white dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 rounded-2xl px-4 py-3">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{asset.name}</p>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{asset.type} • {asset.owner || 'Responsable inconnu'}</p>
                                                                </div>
                                                                <div className="flex gap-1">
                                                                    {[asset.confidentiality, asset.integrity, asset.availability].map((level, idx) => (
                                                                        <span key={idx} className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{level}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {(selectedProject.relatedRiskIds?.length || 0) > 0 && (
                                            <div className="bg-white/80 dark:bg-slate-800/40 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm p-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Risques suivis</p>
                                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">Suivi ISO 27005</h4>
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{selectedProject.relatedRiskIds?.length} risques</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {selectedProject.relatedRiskIds?.map(riskId => {
                                                        const risk = getRiskById(riskId);
                                                        if (!risk) return null;
                                                        const level = risk.score >= 15 ? 'Critique' : risk.score >= 10 ? 'Élevé' : risk.score >= 5 ? 'Moyen' : 'Faible';
                                                        return (
                                                            <div key={riskId} className="flex items-center justify-between bg-white dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 rounded-2xl px-4 py-3">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{risk.threat}</p>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{risk.vulnerability}</p>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge
                                                                        status={risk.score >= 15 ? 'error' : risk.score >= 10 ? 'warning' : risk.score >= 5 ? 'info' : 'success'}
                                                                        variant="soft"
                                                                        size="sm"
                                                                    >
                                                                        {level}
                                                                    </Badge>
                                                                    <span className="text-xs text-slate-400 dark:text-slate-500">Score {risk.score}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {(selectedProject.relatedControlIds?.length || 0) > 0 && (
                                            <div className="bg-white/80 dark:bg-slate-800/40 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm p-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Contrôles ISO 27001</p>
                                                        <h4 className="text-lg font-bold text-slate-900 dark:text-white">Mesures associées</h4>
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{selectedProject.relatedControlIds?.length} contrôles</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {selectedProject.relatedControlIds?.map(controlId => {
                                                        const control = getControlById(controlId);
                                                        if (!control) return null;
                                                        return (
                                                            <div key={controlId} className="flex items-center justify-between bg-white dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 rounded-2xl px-4 py-3">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{control.code} — {control.name}</p>
                                                                    {control.description && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{control.description}</p>}
                                                                </div>
                                                                <Badge status="neutral" variant="outline" size="sm">{control.status}</Badge>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Linked Audits */}
                                    {linkedAudits.length > 0 && (
                                        <div className="bg-white/80 dark:bg-slate-800/40 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm p-6 mt-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Audits de conformité</p>
                                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">Audits liés</h4>
                                                </div>
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{linkedAudits.length} audits</span>
                                            </div>
                                            <div className="space-y-3">
                                                {linkedAudits.map(audit => (
                                                    <div key={audit.id} className="flex items-center justify-between bg-white dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 rounded-2xl px-4 py-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{audit.name}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{audit.type} • {new Date(audit.dateScheduled).toLocaleDateString()}</p>
                                                        </div>
                                                        <Badge
                                                            status={audit.status === 'Terminé' ? 'success' : 'info'}
                                                            variant="soft"
                                                            size="sm"
                                                        >
                                                            {audit.status}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Linked Suppliers */}
                                    {linkedSuppliers.length > 0 && (
                                        <div className="bg-white/80 dark:bg-slate-800/40 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm p-6 mt-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Chaîne d'approvisionnement</p>
                                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">Fournisseurs impliqués</h4>
                                                </div>
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{linkedSuppliers.length} fournisseurs</span>
                                            </div>
                                            <div className="space-y-3">
                                                {linkedSuppliers.map(supplier => (
                                                    <div key={supplier.id} className="flex items-center justify-between bg-white dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 rounded-2xl px-4 py-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{supplier.name}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{supplier.category}</p>
                                                        </div>
                                                        <Badge
                                                            status={supplier.criticality === 'Critique' ? 'error' : 'neutral'}
                                                            variant="soft"
                                                            size="sm"
                                                        >
                                                            {supplier.criticality}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            )}

                            {inspectorTab === 'milestones' && (
                                <ProjectMilestones
                                    project={selectedProject}
                                    milestones={projectMilestones}
                                    onUpdate={() => fetchMilestones(selectedProject.id)}
                                />
                            )}

                            {inspectorTab === 'dashboard' && (
                                <div className="space-y-6 h-full flex flex-col">
                                    <ProjectDashboard
                                        project={selectedProject}
                                        milestones={projectMilestones}
                                        relatedRisks={risks.filter(r => selectedProject.relatedRiskIds?.includes(r.id))}
                                    />
                                </div>
                            )}

                            {inspectorTab === 'tasks' && (
                                <div className="space-y-6 h-full flex flex-col">
                                    <div className="flex justify-between items-center">
                                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
                                            <button onClick={() => setTaskViewMode('list')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${taskViewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>Liste</button>
                                            <button onClick={() => setTaskViewMode('board')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${taskViewMode === 'board' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>Tableau</button>
                                        </div>
                                        {canEdit && (
                                            <button
                                                onClick={() => {
                                                    setEditingTask(undefined);
                                                    setShowTaskModal(true);
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-brand-600 text-white rounded-xl hover:bg-brand-700 hover:scale-105 transition-all shadow-lg shadow-brand-500/30"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Nouvelle tâche
                                            </button>
                                        )}</div>

                                    {taskViewMode === 'list' ? (
                                        <div className="space-y-2">
                                            {selectedProject.tasks?.length === 0 && <p className="text-center text-slate-400 text-xs py-8 italic">Aucune tâche définie.</p>}
                                            {selectedProject.tasks?.map(task => (
                                                <div key={task.id} className="flex items-center p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-white/5 group hover:shadow-sm transition-all">
                                                    <button onClick={() => toggleTaskStatus(task.id)} disabled={!canEdit} className={`flex-shrink-0 w-5 h-5 rounded-full border mr-3 flex items-center justify-center transition-colors ${task.status === 'Terminé' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-500'}`}>
                                                        {task.status === 'Terminé' && <CheckSquare className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <span className={`text-sm font-medium flex-1 ${task.status === 'Terminé' ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                                        {task.title}
                                                        {task.dueDate && <span className="ml-2 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{new Date(task.dueDate).toLocaleDateString()}</span>}
                                                    </span>
                                                    {canEdit && (
                                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => {
                                                                const icsContent = generateICS([{
                                                                    title: `Tâche : ${task.title}`,
                                                                    description: `Tâche du projet ${selectedProject.name}`,
                                                                    startDate: task.dueDate ? new Date(task.dueDate) : new Date(selectedProject.dueDate),
                                                                    location: 'Sentinel GRC'
                                                                }]);
                                                                downloadICS(`tache_${task.id}.ics`, icsContent);
                                                            }} className="p-1.5 text-slate-400 hover:text-blue-500 transition-all" title="Ajouter au calendrier"><CalendarDays className="h-3.5 w-3.5" /></button>
                                                            <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
                                            <KanbanColumn
                                                status="A faire"
                                                tasks={selectedProject.tasks?.filter(t => t.status === 'A faire') || []}
                                                canEdit={canEdit}
                                                draggedTaskId={draggedTaskId}
                                                onDragOver={handleDragOver}
                                                onDrop={handleDrop}
                                                onDragStart={handleDragStart}
                                                onEditTask={(task) => { setEditingTask(task); setShowTaskModal(true); }}
                                                onDeleteTask={deleteTask}
                                            />
                                            <KanbanColumn
                                                status="En cours"
                                                tasks={selectedProject.tasks?.filter(t => t.status === 'En cours') || []}
                                                canEdit={canEdit}
                                                draggedTaskId={draggedTaskId}
                                                onDragOver={handleDragOver}
                                                onDrop={handleDrop}
                                                onDragStart={handleDragStart}
                                                onEditTask={(task) => { setEditingTask(task); setShowTaskModal(true); }}
                                                onDeleteTask={deleteTask}
                                            />
                                            <KanbanColumn
                                                status="Terminé"
                                                tasks={selectedProject.tasks?.filter(t => t.status === 'Terminé') || []}
                                                canEdit={canEdit}
                                                draggedTaskId={draggedTaskId}
                                                onDragOver={handleDragOver}
                                                onDrop={handleDrop}
                                                onDragStart={handleDragStart}
                                                onEditTask={(task) => { setEditingTask(task); setShowTaskModal(true); }}
                                                onDeleteTask={deleteTask}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {inspectorTab === 'history' && (
                                <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                    {projectHistory.map((log, i) => (
                                        <div key={i} className="relative">
                                            <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-brand-900">
                                                <div className="h-2 w-2 rounded-full bg-brand-600"></div>
                                            </span>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.details}</p>
                                                <p className="text-[10px] text-slate-400 mt-1">Par: {log.userEmail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {inspectorTab === 'comments' && (
                                <div className="h-full flex flex-col">
                                    <Comments collectionName="projects" documentId={selectedProject.id} />
                                </div>
                            )}

                            {inspectorTab === 'gantt' && (
                                <div className="space-y-4 h-full min-h-[500px]">
                                    <div className="h-[600px] w-full">
                                        <GanttChart
                                            tasks={selectedProject.tasks || []}
                                            viewMode={ganttViewMode}
                                            onViewModeChange={setGanttViewMode}
                                            users={usersList}
                                            onTaskClick={(task) => {
                                                setEditingTask(task);
                                                setShowTaskModal(true);
                                            }}
                                            onTaskUpdate={(task, start, end) => {
                                                if (!canEdit) return;
                                                const updatedTasks = selectedProject.tasks.map(t => {
                                                    if (t.id === task.id) {
                                                        return {
                                                            ...t,
                                                            startDate: start.toISOString(),
                                                            dueDate: end.toISOString()
                                                        };
                                                    }
                                                    return t;
                                                });
                                                updateTasks(updatedTasks);
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {inspectorTab === 'intelligence' && (
                                <div className="h-full">
                                    <ProjectAIAssistant
                                        project={selectedProject}
                                        risks={risks}
                                        controls={controls}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Drawer>

            {/* Create/Edit Drawer */}
            <Drawer
                isOpen={creationMode || !!editingProject}
                onClose={() => { setCreationMode(false); setEditingProject(null); }}
                title={editingProject ? "Modifier le Projet" : "Nouveau Projet"}
                subtitle={editingProject ? editingProject.name : "Création"}
                width="max-w-4xl"
                breadcrumbs={getBreadcrumbs()}
            >
                <ProjectForm
                    onCancel={() => { setCreationMode(false); setEditingProject(null); }}
                    onSubmit={handleProjectFormSubmit}
                    existingProject={editingProject || undefined}
                    availableUsers={usersList.map(u => u.displayName || u.email)}
                    availableRisks={risks}
                    availableControls={controls}
                    availableAssets={assets}
                    isLoading={isSubmitting}
                />
            </Drawer>

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                title={confirmData.title}
                message={confirmData.message}
                onConfirm={confirmData.onConfirm}
                type="info"
                confirmText="Oui, mettre à jour"
                cancelText="Non, ignorer"
            />
        </div >
    );
};
