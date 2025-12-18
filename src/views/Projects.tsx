
import React, { useDeferredValue, useEffect, useMemo, useState, useCallback } from 'react';
import { SEO } from '../components/SEO';
import 'jspdf-autotable';
import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, limit, where, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Menu, Transition } from '@headlessui/react';
import { db } from '../firebase';
import { Project, ProjectTask, Risk, Control, SystemLog, UserProfile, Asset, ProjectMilestone, ProjectTemplate, Audit, Supplier } from '../types';
import { projectSchema, templateFormSchema } from '../schemas/projectSchema';
import { z } from 'zod';
import { canEditResource, canDeleteResource } from '../utils/permissions';
import { Plus, CheckSquare, FolderKanban, MessageSquare, Download, CalendarDays, LayoutDashboard, History, BrainCircuit, ShieldAlert, Server, ClipboardCheck, Edit, Trash2, MoreVertical, Zap, Loader2, FileSpreadsheet, Copy, Target, FileText } from '../components/ui/Icons';
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
import { CardSkeleton } from '../components/ui/Skeleton';
import { DataTable } from '../components/ui/DataTable';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
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
import { PageControls } from '../components/ui/PageControls';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';

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

    const { data: rawAudits, loading: loadingAudits } = useFirestoreCollection<Audit>(
        'audits',
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
    const audits = React.useMemo(() => [...rawAudits].sort((a, b) => new Date(b.dateScheduled).getTime() - new Date(a.dateScheduled).getTime()), [rawAudits]);
    const controls = React.useMemo(() => [...rawControls].sort((a, b) => a.code.localeCompare(b.code)), [rawControls]);
    const assets = React.useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);

    const loading = loadingProjects || loadingRisks || loadingControls || loadingAssets || loadingUsers || loadingAudits;

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
    const [preSelectedContext, setPreSelectedContext] = useState<{ type: 'risk' | 'control' | 'asset' | 'audit', id: string } | null>(null);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState<ProjectTask | undefined>(undefined);
    const [filter, setFilter] = useState('');
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [viewMode, setViewMode] = usePersistedState<'grid' | 'list' | 'matrix'>('projects_view_mode', 'grid');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Inspector State
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    type InspectorTabId = 'overview' | 'tasks' | 'dashboard' | 'history' | 'comments' | 'gantt' | 'intelligence' | 'milestones' | 'risks' | 'controls' | 'assets' | 'audits';
    const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('overview');
    const [taskViewMode, setTaskViewMode] = useState<'list' | 'board'>('list');
    const [projectHistory, setProjectHistory] = useState<SystemLog[]>([]);
    const [projectMilestones, setProjectMilestones] = useState<ProjectMilestone[]>([]);
    const [linkedAudits, setLinkedAudits] = useState<Audit[]>([]);
    const [linkedSuppliers, setLinkedSuppliers] = useState<Supplier[]>([]);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [ganttViewMode, setGanttViewMode] = useState<'Day' | 'Week' | 'Month'>('Week');

    // Derived states for linked items
    const linkedRisks = React.useMemo(() => risks.filter(r => selectedProject?.relatedRiskIds?.includes(r.id)), [risks, selectedProject]);
    const linkedControls = React.useMemo(() => controls.filter(c => selectedProject?.relatedControlIds?.includes(c.id)), [controls, selectedProject]);
    const linkedAssets = React.useMemo(() => assets.filter(a => selectedProject?.relatedAssetIds?.includes(a.id)), [assets, selectedProject]);
    const linkedAuditsList = React.useMemo(() => {
        if (!selectedProject) return [];
        return audits.filter(a => (a.relatedProjectIds || []).includes(selectedProject.id));
    }, [audits, selectedProject]);

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
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string, createForRisk?: string, createForControl?: string, createForAsset?: string, createForAudit?: string };

        if (state.createForRisk) {
            setCreationMode(true);
            setPreSelectedContext({ type: 'risk', id: state.createForRisk });
        } else if (state.createForControl) {
            setCreationMode(true);
            setPreSelectedContext({ type: 'control', id: state.createForControl });
        } else if (state.createForAsset) {
            setCreationMode(true);
            setPreSelectedContext({ type: 'asset', id: state.createForAsset });
        } else if (state.createForAudit) {
            setCreationMode(true);
            setPreSelectedContext({ type: 'audit', id: state.createForAudit });
        }

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
            // Sanitize data to remove undefined values
            const cleanData = sanitizeData(validatedData);


            if (editingProject) {
                // Update existing project
                await updateDoc(doc(db, 'projects', editingProject.id), {
                    ...cleanData
                });
                await logAction(user, 'UPDATE', 'Project', `Mise à jour projet: ${validatedData.name}`);

                // Sync Bidirectional Links (Risks)
                const newRisks = validatedData.relatedRiskIds || [];
                const oldRisks = editingProject.relatedRiskIds || [];
                const addedRisks = newRisks.filter(id => !oldRisks.includes(id));
                const removedRisks = oldRisks.filter(id => !newRisks.includes(id));

                for (const riskId of addedRisks) {
                    await updateDoc(doc(db, 'risks', riskId), { relatedProjectIds: arrayUnion(editingProject.id) });
                }
                for (const riskId of removedRisks) {
                    await updateDoc(doc(db, 'risks', riskId), { relatedProjectIds: arrayRemove(editingProject.id) });
                }

                // Sync Bidirectional Links (Controls)
                const newControls = validatedData.relatedControlIds || [];
                const oldControls = editingProject.relatedControlIds || [];
                const addedControls = newControls.filter(id => !oldControls.includes(id));
                const removedControls = oldControls.filter(id => !newControls.includes(id));

                for (const controlId of addedControls) {
                    await updateDoc(doc(db, 'controls', controlId), { relatedProjectIds: arrayUnion(editingProject.id) });
                }
                for (const controlId of removedControls) {
                    await updateDoc(doc(db, 'controls', controlId), { relatedProjectIds: arrayRemove(editingProject.id) });
                }

                // Sync Bidirectional Links (Assets)
                const newAssets = validatedData.relatedAssetIds || [];
                const oldAssets = editingProject.relatedAssetIds || [];
                const addedAssets = newAssets.filter(id => !oldAssets.includes(id));
                const removedAssets = oldAssets.filter(id => !newAssets.includes(id));

                for (const assetId of addedAssets) {
                    await updateDoc(doc(db, 'assets', assetId), { relatedProjectIds: arrayUnion(editingProject.id) });
                }
                for (const assetId of removedAssets) {
                    await updateDoc(doc(db, 'assets', assetId), { relatedProjectIds: arrayRemove(editingProject.id) });
                }

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
                // Inject Pre-selected Context
                const finalData = { ...cleanData };
                if (preSelectedContext) {
                    if (preSelectedContext.type === 'risk') finalData.relatedRiskIds = [...(finalData.relatedRiskIds || []), preSelectedContext.id];
                }

                const newProjectRef = await addDoc(collection(db, 'projects'), {
                    ...finalData,
                    organizationId: user.organizationId,
                    progress: 0,
                    tasks: [],
                    createdAt: new Date().toISOString()
                });

                // Sync Bidirectional Links for New Project
                const pId = newProjectRef.id;

                const risksToSync = finalData.relatedRiskIds || [];
                for (const id of risksToSync) {
                    await updateDoc(doc(db, 'risks', id), { relatedProjectIds: arrayUnion(pId) });
                }

                const controlsToSync = finalData.relatedControlIds || [];
                for (const id of controlsToSync) {
                    await updateDoc(doc(db, 'controls', id), { relatedProjectIds: arrayUnion(pId) });
                }

                const assetsToSync = finalData.relatedAssetIds || [];
                for (const id of assetsToSync) {
                    await updateDoc(doc(db, 'assets', id), { relatedProjectIds: arrayUnion(pId) });
                }

                const auditsToSync = finalData.relatedAuditIds || [];
                for (const id of auditsToSync) {
                    await updateDoc(doc(db, 'audits', id), { relatedProjectIds: arrayUnion(pId) });
                }

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

            await addDoc(collection(db, 'projects'), sanitizeData(newProjData));
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

    const handleExportExecutiveReport = async () => {
        if (!selectedProject) return;

        // Prevent concurrent exports
        if (isExportingPDF) return;
        setIsExportingPDF(true);
        addToast("Génération du rapport exécutif de projet...", "info");

        try {
            const { PdfService } = await import('../services/PdfService');
            const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
            const canWhiteLabel = limits.features.whiteLabelReports;

            PdfService.generateProjectExecutiveReport(
                [selectedProject],
                {
                    title: "RAPPORT DE PROJET",
                    orientation: 'portrait',
                    organizationName: canWhiteLabel ? (organization?.name || user?.email?.split('@')[1] || 'Sentinel GRC') : 'Sentinel GRC',
                    organizationLogo: canWhiteLabel ? organization?.logoUrl : undefined,
                    author: selectedProject.manager || user?.displayName || 'Chef de Projet',
                    coverImage: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=2070&auto=format&fit=crop'
                }
            );

            addToast("Rapport téléchargé avec succès", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Projects.handleExportExecutiveReport', 'REPORT_GENERATION_FAILED');
        } finally {
            setIsExportingPDF(false);
        }
    };

    const generateReport = () => {
        if (!selectedProject) return;

        void (async () => {
            const { PdfService } = await import('../services/PdfService');

            const limits = getPlanLimits(organization?.subscription?.planId || 'discovery');
            const canWhiteLabel = limits.features.whiteLabelReports;

            const reportOptions = {
                title: 'Rapport de Projet',
                subtitle: `Projet: ${selectedProject.name} | ${new Date().toLocaleDateString()}`,
                filename: `Projet_${selectedProject.name}_Report.pdf`,
                organizationName: canWhiteLabel ? organization?.name : undefined,
                organizationLogo: canWhiteLabel ? organization?.logoUrl : undefined,
                footerText: 'Sentinel GRC - Rapport Projet'
            };

            PdfService.generateCustomReport(
                reportOptions,
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

                    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

                    // Task Stats Chart
                    if (selectedProject.tasks.length > 0) {
                        const pending = selectedProject.tasks.filter(t => t.status === 'A faire').length;
                        const inProgress = selectedProject.tasks.filter(t => t.status === 'En cours').length;
                        const done = selectedProject.tasks.filter(t => t.status === 'Terminé').length;

                        doc.setFontSize(12); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
                        doc.text("Avancement des Tâches", 14, y);

                        // Draw Chart (Right aligned)
                        PdfService.drawDonutChart(
                            doc,
                            120, // x position (right side)
                            y - 10, // y position
                            20, // radius
                            [
                                { label: 'A faire', value: pending, color: '#94a3b8' }, // Slate 400
                                { label: 'En cours', value: inProgress, color: '#3b82f6' }, // Blue 500
                                { label: 'Terminé', value: done, color: '#10b981' } // Emerald 500
                            ],
                            `${Math.round((done / selectedProject.tasks.length) * 100)}%`
                        );

                        y += 40; // Space for chart
                    }


                    // Description
                    doc.setFontSize(12); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
                    doc.text("Description", 14, y);
                    y += 6;
                    doc.setFontSize(10); doc.setTextColor(80); doc.setFont('helvetica', 'normal');

                    // Use Safe Text with Page Breaks
                    y = PdfService.addSafeText(
                        doc,
                        selectedProject.description || "Aucune description.",
                        14,
                        y,
                        180,
                        5,
                        doc.internal.pageSize.height,
                        20,
                        reportOptions
                    );

                    y += 10;

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
        })().catch((error) => {
            ErrorLogger.error(error, 'Projects.generateReport');
        });
    };

    const exportPDF = async () => {
        if (isExportingPDF) return;
        setIsExportingPDF(true);
        try {
            const { PdfService } = await import('../services/PdfService');
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
        } catch (error) {
            ErrorLogger.error(error, 'Projects.exportPDF');
        } finally {
            setTimeout(() => setIsExportingPDF(false), 0);
        }
    };



    const handleExportCSV = async () => {
        if (isExportingCSV) return;
        setIsExportingCSV(true);
        try {
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
        } finally {
            setTimeout(() => setIsExportingCSV(false), 0);
        }
    };







    const deferredFilter = useDeferredValue(filter);
    const filteredProjects = useMemo(() => {
        const needle = (deferredFilter || '').toLowerCase().trim();
        if (!needle) return projects;
        return projects.filter(p => p.name.toLowerCase().includes(needle));
    }, [projects, deferredFilter]);

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
                    <div className="text-xs text-slate-600 font-medium line-clamp-1">{row.original.description}</div>
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
                            <CustomTooltip content="Modifier le projet">
                                <button onClick={(e) => { e.stopPropagation(); openEditDrawer(row.original); }} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100">
                                    <Edit className="h-4 w-4" />
                                </button>
                            </CustomTooltip>
                            {canDeleteResource(user, 'Project') && (
                                <CustomTooltip content="Supprimer le projet">
                                    <button onClick={(e) => { e.stopPropagation(); initiateDelete(row.original.id, row.original.name); }} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </CustomTooltip>
                            )}
                        </>
                    )}
                </div>
            )
        }
    ], [canEdit, openEditDrawer, initiateDelete, user]);

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO
                title="Gestion de Projets"
                description="Suivez vos projets de mise en conformité et d'amélioration continue."
            />
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

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title={projectsTitle}
                    subtitle={projectsSubtitle}
                    breadcrumbs={[
                        { label: 'Projets' }
                    ]}
                    icon={<FolderKanban className="h-6 w-6 text-white" strokeWidth={2.5} />}
                    actions={canEdit && (
                        <>
                            <Menu as="div" className="relative inline-block text-left">
                                <Menu.Button className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                                    <MoreVertical className="h-5 w-5" />
                                </Menu.Button>
                                <Transition
                                    as={React.Fragment}
                                    enter="transition ease-out duration-100"
                                    enterFrom="transform opacity-0 scale-95"
                                    enterTo="transform opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="transform opacity-100 scale-100"
                                    leaveTo="transform opacity-0 scale-95"
                                >
                                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                        <div className="p-1">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Outils
                                            </div>
                                            <Menu.Item>
                                                {({ active }) => (
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
                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                    >
                                                        <Zap className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />
                                                        Depuis Template
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </div>
                                        <div className="p-1">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Rapports & Exports
                                            </div>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        onClick={handleExportCSV}
                                                        disabled={isExportingCSV}
                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50`}
                                                    >
                                                        {isExportingCSV ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />}
                                                        Export CSV
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        onClick={exportPDF}
                                                        disabled={isExportingPDF}
                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50`}
                                                    >
                                                        {isExportingPDF ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />}
                                                        Export PDF
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>

                            <CustomTooltip content="Créer un nouveau projet">
                                <button
                                    onClick={() => {
                                        setCreationMode(true);
                                        setEditingProject({
                                            id: '',
                                            name: '',
                                            description: '',
                                            status: 'En cours',
                                            dueDate: new Date().toISOString(),
                                            tasks: [],
                                            progress: 0,
                                            manager: user?.displayName || '',
                                            organizationId: user?.organizationId || '',
                                            createdAt: new Date().toISOString()
                                        });
                                        // setIsEditing(true); // Removed
                                    }}
                                    className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Nouveau Projet</span>
                                </button>
                            </CustomTooltip>
                        </>
                    )}
                />
            </motion.div>
            <motion.div variants={slideUpVariants} className="glass-panel p-6 md:p-8 rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group border border-transparent dark:border-white/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 pointer-events-none" />
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
                        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[200px]">
                            Moyenne d'avancement de tous les projets en cours.
                        </p>
                    </div>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-slate-200 dark:border-white/10 px-6 mx-2">
                    <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Projets</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{projects.length}</div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">En Cours</div>
                        <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                            {projects.filter(p => p.status === 'En cours').length}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">En Retard</div>
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
                        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800/30">
                            <CheckSquare className="h-4 w-4 shrink-0" />
                            <span className="font-medium">Aucun projet</span>
                        </div>
                    )}
                </div>
            </motion.div>

            <motion.div variants={slideUpVariants}>
                <PageControls
                    searchQuery={filter}
                    onSearchChange={setFilter}
                    searchPlaceholder="Rechercher un projet..."
                    totalItems={filteredProjects.length}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    secondaryActions={null}
                />
            </motion.div>

            {
                viewMode === 'list' ? (
                    <motion.div variants={slideUpVariants} className="glass-panel w-full max-w-full rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200 dark:border-white/5 relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                        <div className="relative z-10">
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
                    </motion.div>
                ) : (
                    <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
                                                    <button onClick={(e) => { e.stopPropagation(); openEditDrawer(project); }} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg text-slate-500 hover:text-indigo-500 shadow-sm backdrop-blur-sm transition-colors">
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); initiateDelete(project.id, project.name); }} className="p-1.5 bg-white/80 dark:bg-slate-800/80 rounded-lg text-slate-500 hover:text-red-500 shadow-sm backdrop-blur-sm transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{project.name}</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 line-clamp-2 h-10 leading-relaxed">{project.description}</p>

                                    <div className="mb-6">
                                        <div className="flex justify-between text-xs mb-1.5 font-medium">
                                            <span className="text-slate-600 dark:text-slate-300">Avancement</span>
                                            <span className="text-brand-600">{project.progress}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                                            <div className="bg-brand-500 h-2 rounded-full transition-all duration-500 shadow-sm" style={{ width: `${project.progress}%` }}></div>
                                        </div>
                                    </div>

                                    <div className="flex items-center text-xs text-slate-600 mb-4 space-x-4 border-t border-gray-100 dark:border-white/10 pt-4 mt-auto">
                                        <div className="flex items-center font-medium">
                                            <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                                            {new Date(project.dueDate).toLocaleDateString()}
                                        </div>
                                        <div className="flex items-center font-medium">
                                            <CheckSquare className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                                            {project.tasks?.length || 0} tâches
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </motion.div>
                )
            }

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
                            <CustomTooltip content="Générer un rapport exécutif PDF">
                                <button onClick={handleExportExecutiveReport} className="p-2.5 text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><FileText className="h-5 w-5 text-indigo-500" /></button>
                            </CustomTooltip>
                            <CustomTooltip content="Télécharger le rapport">
                                <button onClick={generateReport} className="p-2.5 text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Download className="h-5 w-5" /></button>
                            </CustomTooltip>
                            {canEdit && (
                                <CustomTooltip content="Dupliquer le projet">
                                    <button onClick={handleDuplicate} disabled={isSubmitting} className="p-2.5 text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm disabled:opacity-50">
                                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Copy className="h-5 w-5" />}
                                    </button>
                                </CustomTooltip>
                            )}
                            {canEdit && (
                                <CustomTooltip content="Modifier le projet">
                                    <button onClick={() => openEditDrawer(selectedProject)} className="p-2.5 text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                                </CustomTooltip>
                            )}
                            {canDeleteResource(user, 'Project') && (
                                <CustomTooltip content="Supprimer le projet">
                                    <button onClick={() => initiateDelete(selectedProject.id, selectedProject.name)} className="p-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                                </CustomTooltip>
                            )}
                        </>
                    )
                }
            >
                {selectedProject && (
                    <div className="flex flex-col h-full">
                        {/* Status Header */}
                        <div className="px-4 sm:px-8 py-4 bg-slate-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 flex flex-wrap items-center gap-4">
                            <Badge
                                status={selectedProject.status === 'En cours' ? 'info' : selectedProject.status === 'Terminé' ? 'success' : selectedProject.status === 'Suspendu' ? 'error' : 'neutral'}
                                variant="soft"
                            >
                                {selectedProject.status}
                            </Badge>
                            <span className="text-xs font-bold text-slate-600 flex items-center gap-2">
                                <CalendarDays className="h-4 w-4" />
                                Échéance: {new Date(selectedProject.dueDate).toLocaleDateString()}
                            </span>
                        </div>

                        {/* Tabs */}
                        <div className="px-4 sm:px-8 border-b border-gray-100 dark:border-white/5 bg-white/30 dark:bg-white/5">
                            <ScrollableTabs
                                tabs={[
                                    { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
                                    { id: 'tasks', label: 'Tâches', icon: CheckSquare, count: selectedProject.tasks?.length },
                                    { id: 'gantt', label: 'Gantt', icon: CalendarDays },
                                    { id: 'milestones', label: 'Jalons', icon: Target, count: projectMilestones.length },
                                    { id: 'dashboard', label: 'Tableau de bord', icon: FileSpreadsheet },
                                    { id: 'risks', label: 'Risques', icon: ShieldAlert, count: linkedRisks.length },
                                    { id: 'controls', label: 'Contrôles', icon: CheckSquare, count: linkedControls.length },
                                    { id: 'assets', label: 'Actifs', icon: Server, count: linkedAssets.length },
                                    { id: 'audits', label: 'Audits', icon: ClipboardCheck, count: linkedAuditsList.length },
                                    { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
                                    { id: 'history', label: 'Historique', icon: History },
                                    { id: 'comments', label: 'Commentaires', icon: MessageSquare }
                                ]}
                                activeTab={inspectorTab}
                                onTabChange={(id) => setInspectorTab(id as InspectorTabId)}
                            />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
                            {inspectorTab === 'overview' && (
                                <>
                                    <div className="space-y-8">
                                        <div>
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Objectif</h3>
                                            <div className="glass-panel p-6 rounded-3xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                                <div className="relative z-10 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                    {selectedProject.description}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                            <div className="glass-panel p-5 rounded-3xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                                <div className="relative z-10">
                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Actifs Concernés</p>
                                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{selectedProject.relatedAssetIds?.length || 0}</p>
                                                </div>
                                            </div>
                                            <div className="glass-panel p-5 rounded-3xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                                <div className="relative z-10">
                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Risques Traités</p>
                                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{selectedProject.relatedRiskIds?.length || 0}</p>
                                                </div>
                                            </div>
                                            <div className="glass-panel p-5 rounded-3xl border border-white/60 dark:border-white/10 shadow-sm relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                                <div className="relative z-10">
                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Contrôles Implémentés</p>
                                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{selectedProject.relatedControlIds?.length || 0}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Linked Audits */}
                                        {linkedAudits.length > 0 && (
                                            <div className="glass-panel rounded-3xl border border-white/60 dark:border-white/10 shadow-sm p-6 mt-6 relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                                <div className="relative z-10">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Audits de conformité</p>
                                                            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Audits liés</h4>
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{linkedAudits.length} audits</span>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {linkedAudits.map(audit => (
                                                            <div key={audit.id} className="flex items-center justify-between bg-white dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 rounded-2xl px-4 py-3">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{audit.name}</p>
                                                                    <p className="text-xs text-slate-600 dark:text-slate-400">{audit.type} • {new Date(audit.dateScheduled).toLocaleDateString()}</p>
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
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chaîne d'approvisionnement</p>
                                            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Fournisseurs impliqués</h4>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{linkedSuppliers.length} fournisseurs</span>
                                    </div>
                                    <div className="space-y-3">
                                        {linkedSuppliers.map(supplier => (
                                            <div key={supplier.id} className="flex items-center justify-between bg-white dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 rounded-2xl px-4 py-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{supplier.name}</p>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400">{supplier.category}</p>
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
                                </>
                            )}


                            {
                                inspectorTab === 'milestones' && (
                                    <ProjectMilestones
                                        project={selectedProject}
                                        milestones={projectMilestones}
                                        onUpdate={() => fetchMilestones(selectedProject.id)}
                                    />
                                )
                            }

                            {
                                inspectorTab === 'dashboard' && (
                                    <div className="space-y-6 h-full flex flex-col">
                                        <ProjectDashboard
                                            project={selectedProject}
                                            milestones={projectMilestones}
                                            relatedRisks={risks.filter(r => selectedProject.relatedRiskIds?.includes(r.id))}
                                        />
                                    </div>
                                )
                            }

                            {
                                inspectorTab === 'tasks' && (
                                    <div className="space-y-6 h-full flex flex-col">
                                        <div className="flex justify-between items-center">
                                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
                                                <button onClick={() => setTaskViewMode('list')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${taskViewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600'}`}>Liste</button>
                                                <button onClick={() => setTaskViewMode('board')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${taskViewMode === 'board' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600'}`}>Tableau</button>
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
                                                {selectedProject.tasks?.length === 0 && <p className="text-center text-slate-500 text-xs py-8 italic">Aucune tâche définie.</p>}
                                                {selectedProject.tasks?.map(task => (
                                                    <div key={task.id} className="flex items-center p-3 glass-panel rounded-xl border border-white/60 dark:border-white/10 group hover:shadow-apple transition-all relative overflow-hidden">
                                                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                                        <div className="relative z-10 flex items-center w-full">
                                                            <button onClick={() => toggleTaskStatus(task.id)} disabled={!canEdit} className={`flex-shrink-0 w-5 h-5 rounded-full border mr-3 flex items-center justify-center transition-colors ${task.status === 'Terminé' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-500'}`}>
                                                                {task.status === 'Terminé' && <CheckSquare className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <span className={`text-sm font-medium flex-1 ${task.status === 'Terminé' ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                {task.title}
                                                                {task.dueDate && <span className="ml-2 text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{new Date(task.dueDate).toLocaleDateString()}</span>}
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
                                                                    }} className="p-1.5 text-slate-500 hover:text-blue-500 transition-all" title="Ajouter au calendrier"><CalendarDays className="h-3.5 w-3.5" /></button>
                                                                    <button onClick={() => deleteTask(task.id)} className="p-1.5 text-slate-500 hover:text-red-500 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                                                                </div>
                                                            )}
                                                        </div>
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
                                )
                            }

                            {/* --- REMOVED OLD LINKED ITEMS DISPLAY IN OVERVIEW --- */}

                            {
                                inspectorTab === 'risks' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center"><ShieldAlert className="h-4 w-4 mr-2" /> Risques liés ({linkedRisks.length})</h3>
                                            {canEdit && (
                                                <button
                                                    onClick={() => {
                                                        navigate('/risks', { state: { createForProject: selectedProject.id, projectName: selectedProject.name } });
                                                    }}
                                                    className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors flex items-center shadow-sm"
                                                >
                                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Nouveau Risque
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {linkedRisks.length === 0 && <p className="text-sm text-slate-500 italic col-span-2 text-center py-8">Aucun risque associé.</p>}
                                            {linkedRisks.map(risk => {
                                                const riskLevel = risk.score >= 15 ? 'Critique' : risk.score >= 10 ? 'Élevé' : risk.score >= 5 ? 'Moyen' : 'Faible';
                                                return (
                                                    <div key={risk.id} className="glass-panel p-4 rounded-2xl border border-white/60 dark:border-white/10 flex flex-col gap-2 relative overflow-hidden group hover:shadow-apple transition-all">
                                                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                                        <div className="relative z-10">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">#{risk.id.substring(0, 4)}</span>
                                                                    <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1" title={risk.threat}>{risk.threat}</h4>
                                                                </div>
                                                                <Badge status={riskLevel === 'Critique' || riskLevel === 'Élevé' ? 'error' : riskLevel === 'Moyen' ? 'warning' : 'success'} size="sm" variant="soft">{riskLevel}</Badge>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <span className="text-xs text-slate-500">Score: {risk.score}</span>
                                                                <span className="text-xs text-slate-400">•</span>
                                                                <span className="text-xs text-slate-500">Impact: {risk.impact}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            }

                            {
                                inspectorTab === 'controls' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center"><CheckSquare className="h-4 w-4 mr-2" /> Contrôles liés ({linkedControls.length})</h3>
                                            {canEdit && (
                                                <button
                                                    onClick={() => {
                                                        // This assumes we have a way to create controls linked to a project, or just nav to compliance
                                                        // Since controls are usually standard, maybe we just navigate to compliance?
                                                        // Or create a request? For now, navigate to Compliance with state.
                                                        navigate('/compliance', { state: { createForProject: selectedProject.id, projectName: selectedProject.name } });
                                                    }}
                                                    className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors flex items-center shadow-sm"
                                                >
                                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Ajouter Contrôle
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            {linkedControls.length === 0 && <p className="text-sm text-slate-500 italic text-center py-8">Aucun contrôle associé.</p>}
                                            {linkedControls.map(control => (
                                                <div key={control.id} className="flex items-center justify-between glass-panel border border-white/60 dark:border-white/10 rounded-2xl px-4 py-3 hover:shadow-sm transition-all relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                                    <div className="relative z-10 flex items-center justify-between w-full">
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{control.code} — {control.name}</p>
                                                            {control.description && <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">{control.description}</p>}
                                                        </div>
                                                        <Badge status="neutral" variant="outline" size="sm">{control.status}</Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            }


                            {
                                inspectorTab === 'assets' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center"><Server className="h-4 w-4 mr-2" /> Actifs liés ({linkedAssets.length})</h3>
                                            {canEdit && (
                                                <button
                                                    onClick={() => {
                                                        navigate('/assets', { state: { createForProject: selectedProject.id, projectName: selectedProject.name } });
                                                    }}
                                                    className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors flex items-center shadow-sm"
                                                >
                                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Nouvel Actif
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {linkedAssets.length === 0 && <p className="text-sm text-slate-500 italic col-span-2 text-center py-8">Aucun actif associé.</p>}
                                            {linkedAssets.map(asset => (
                                                <div key={asset.id} className="glass-panel p-4 rounded-2xl border border-white/60 dark:border-white/10 flex items-center gap-3 relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                                    <div className="relative z-10 flex items-center gap-3 w-full">
                                                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 flex-shrink-0">
                                                            <Server className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">{asset.name}</h4>
                                                            <p className="text-xs text-slate-500">{asset.type} • {asset.confidentiality}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            }

                            {
                                inspectorTab === 'audits' && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center"><ClipboardCheck className="h-4 w-4 mr-2" /> Audits liés ({linkedAuditsList.length})</h3>
                                            {canEdit && (
                                                <button
                                                    onClick={() => {
                                                        navigate('/audits', { state: { createForProject: selectedProject.id, projectName: selectedProject.name } });
                                                    }}
                                                    className="text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors flex items-center shadow-sm"
                                                >
                                                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Nouvel Audit
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            {linkedAuditsList.length === 0 && <p className="text-sm text-slate-500 italic text-center py-8">Aucun audit associé.</p>}
                                            {linkedAuditsList.map(audit => (
                                                <div key={audit.id} className="flex items-center justify-between glass-panel border border-white/60 dark:border-white/10 rounded-2xl px-4 py-3 relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                                    <div className="relative z-10 flex items-center justify-between w-full">
                                                        <div>
                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{audit.name}</p>
                                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                                {new Date(audit.dateScheduled).toLocaleDateString()} • {audit.type} • {audit.auditor}
                                                            </p>
                                                        </div>
                                                        <Badge status={audit.status === 'Terminé' ? 'success' : audit.status === 'En cours' ? 'info' : 'neutral'} variant="outline" size="sm">{audit.status}</Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            }



                            {
                                inspectorTab === 'history' && (
                                    <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                        {projectHistory.map((log, i) => (
                                            <div key={i} className="relative">
                                                <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-brand-900">
                                                    <div className="h-2 w-2 rounded-full bg-brand-600"></div>
                                                </span>
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{log.details}</p>
                                                    <p className="text-[10px] text-slate-500 mt-1">Par: {log.userEmail}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            }

                            {
                                inspectorTab === 'comments' && (
                                    <div className="h-full flex flex-col">
                                        <Comments collectionName="projects" documentId={selectedProject.id} />
                                    </div>
                                )
                            }

                            {
                                inspectorTab === 'gantt' && (
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
                                )
                            }

                            {
                                inspectorTab === 'intelligence' && (
                                    <div className="h-full">
                                        <ProjectAIAssistant
                                            project={selectedProject}
                                            risks={risks}
                                            controls={controls}
                                        />
                                    </div>
                                )
                            }
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
        </motion.div>
    );
};
