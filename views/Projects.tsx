
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, limit, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Project, ProjectTask, Risk, Control, SystemLog, UserProfile, Asset, ProjectMilestone, ProjectTemplate } from '../types';
import { canEditResource } from '../utils/permissions';
import { Plus, CalendarDays, CheckSquare, MoreHorizontal, Trash2, FolderKanban, Search, FileSpreadsheet, Edit, X, History, MessageSquare, LayoutDashboard, Download, Copy, Zap } from '../components/ui/Icons';
import { ProjectFormModal } from '../components/projects/ProjectFormModal';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { Comments } from '../components/ui/Comments';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { generateICS, downloadICS } from '../utils/calendar';
import { ProjectDashboard } from '../components/projects/ProjectDashboard';
import { TemplateModal } from '../components/projects/TemplateModal';
import { createProjectFromTemplate } from '../utils/projectTemplates';
import { KanbanColumn } from '../components/projects/KanbanColumn';

import { GanttChart } from '../components/projects/GanttChart';
import { TaskFormModal } from '../components/projects/TaskFormModal';
import '../components/projects/gantt.css';

import { SubscriptionService } from '../services/subscriptionService';
import { useNavigate } from 'react-router-dom';

export const Projects: React.FC = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [controls, setControls] = useState<Control[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState<ProjectTask | undefined>(undefined);
    const { user, addToast } = useStore();
    const [filter, setFilter] = useState('');

    // Inspector State
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'overview' | 'tasks' | 'dashboard' | 'history' | 'comments' | 'gantt'>('overview');
    const [taskViewMode, setTaskViewMode] = useState<'list' | 'board'>('list');
    const [projectHistory, setProjectHistory] = useState<SystemLog[]>([]);
    const [projectMilestones, setProjectMilestones] = useState<ProjectMilestone[]>([]);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    const canEdit = canEditResource(user, 'Project');

    // Form State
    const [isEditing, setIsEditing] = useState(false);


    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const fetchData = async () => {
        if (!user?.organizationId) return;
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'projects'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'controls'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId)))
            ]);

            const getDocsData = <T,>(result: PromiseSettledResult<any>): T[] => {
                if (result.status === 'fulfilled') {
                    return result.value.docs.map((d: any) => ({ id: d.id, ...d.data() })) as T[];
                }
                return [];
            };

            const projData = getDocsData<Project>(results[0]);
            projData.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
            setProjects(projData);

            const riskData = getDocsData<Risk>(results[1]);
            riskData.sort((a, b) => b.score - a.score);
            setRisks(riskData);

            const ctrlData = getDocsData<Control>(results[2]);
            ctrlData.sort((a, b) => a.code.localeCompare(b.code));
            setControls(ctrlData);

            const assetData = getDocsData<Asset>(results[3]);
            assetData.sort((a, b) => a.name.localeCompare(b.name));
            setAssets(assetData);

            const usersData = getDocsData<UserProfile>(results[4]);
            setUsersList(usersData);

        } catch (_err) {
            addToast("Erreur chargement projets", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [user?.organizationId]);

    const openInspector = async (project: Project) => {
        setSelectedProject(project);
        setInspectorTab('overview');
        setIsEditing(false);

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
        } catch (e) { console.error(e); }

        // Fetch Milestones
        try {
            const milestonesRef = collection(db, 'project_milestones');
            const q = query(milestonesRef, where('projectId', '==', project.id), where('organizationId', '==', user?.organizationId));
            const snap = await getDocs(q);
            const milestones = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectMilestone));
            milestones.sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime());
            setProjectMilestones(milestones);
        } catch (e) { console.error(e); }
    };

    const openCreateModal = async () => {
        // Check limits
        if (user?.organizationId) {
            const canAdd = await SubscriptionService.checkLimit(user.organizationId, 'projects', projects.length);
            if (!canAdd) {
                if (confirm("Vous avez atteint la limite de projets de votre plan actuel. Voulez-vous passer au plan supérieur ?")) {
                    navigate('/pricing');
                }
                return;
            }
        }
        setIsEditing(false);
        setShowModal(true);
    };

    // Unified handler for ProjectFormModal submission (create or update)
    const handleProjectFormSubmit = async (projectData: Omit<Project, 'id' | 'organizationId' | 'tasks' | 'progress' | 'createdAt'>) => {
        if (!canEdit || !user?.organizationId) return;

        try {
            if (isEditing && selectedProject) {
                // Update existing project
                await updateDoc(doc(db, 'projects', selectedProject.id), {
                    ...projectData
                });
                await logAction(user, 'UPDATE', 'Project', `Mise à jour projet: ${projectData.name}`);
                addToast("Projet mis à jour", "success");

                // Update local state
                const updatedProject = { ...selectedProject, ...projectData };
                setSelectedProject(updatedProject);
                setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProject : p));
            } else {
                // Create new project
                await addDoc(collection(db, 'projects'), {
                    ...projectData,
                    organizationId: user.organizationId,
                    progress: 0,
                    tasks: [],
                    createdAt: new Date().toISOString()
                });
                await logAction(user, 'CREATE', 'Project', `Nouveau projet: ${projectData.name}`);
                addToast("Projet créé avec succès", "success");
            }
            setShowModal(false);
            setIsEditing(false);
            fetchData();
        } catch (_e) { addToast("Erreur sauvegarde projet", "error"); }
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
            fetchData();
        } catch (e) {
            console.error(e);
            addToast("Erreur création depuis template", "error");
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
            fetchData();
        } catch (_e) { addToast("Erreur duplication", "error"); }
    };

    const initiateDelete = (id: string, name: string) => {
        if (!canEdit) return;
        setConfirmData({
            isOpen: true,
            title: "Supprimer le projet ?",
            message: `Le projet "${name}" et tout son suivi seront supprimés.`,
            onConfirm: () => handleDeleteProject(id)
        });
    };

    const handleDeleteProject = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'projects', id));
            setProjects(prev => prev.filter(p => p.id !== id));
            setSelectedProject(null);
            addToast("Projet supprimé", "info");
        } catch (_e) { addToast("Erreur suppression", "error"); }
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
            setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, tasks, progress } : p));
            setSelectedProject({ ...selectedProject, tasks, progress });
        } catch (e) { console.error(e); }
    };

    const generateReport = () => {
        if (!selectedProject) return;
        const doc = new jsPDF();

        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text(`Rapport de Projet: ${selectedProject.name}`, 14, 25);
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(`Généré le ${new Date().toLocaleDateString()}`, 14, 32);

        let y = 50;

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("Synthèse", 14, y);
        y += 8;

        const summaryData = [
            ['Chef de Projet', selectedProject.manager],
            ['Statut', selectedProject.status],
            ['Avancement', `${selectedProject.progress}%`],
            ['Échéance', new Date(selectedProject.dueDate).toLocaleDateString()],
            ['Risques Liés', (selectedProject.relatedRiskIds?.length || 0).toString()]
        ];

        (doc as any).autoTable({
            startY: y,
            body: summaryData,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 2 }
        });

        y = (doc as any).lastAutoTable.finalY + 15;

        doc.text("Description", 14, y);
        y += 6;
        doc.setFontSize(10);
        doc.setTextColor(80);
        const splitDesc = doc.splitTextToSize(selectedProject.description, 180);
        doc.text(splitDesc, 14, y);
        y += (splitDesc.length * 5) + 15;

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("État des Tâches", 14, y);
        y += 8;

        const tasksData = selectedProject.tasks.map(t => [t.title, t.status]);
        (doc as any).autoTable({
            startY: y,
            head: [['Tâche', 'Statut']],
            body: tasksData,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] }
        });

        doc.save(`Projet_${selectedProject.name}_Report.pdf`);
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

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'En cours': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'Terminé': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'Suspendu': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-400';
        }
    };

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



    return (
        <div className="space-y-6 relative">
            {/* Task Form Modal */}
            <TaskFormModal
                isOpen={showTaskModal}
                onClose={() => {
                    setShowTaskModal(false);
                    setEditingTask(undefined);
                }}
                onSubmit={(taskData) => {
                    if (!selectedProject) return;

                    if (editingTask) {
                        // Update existing task
                        const updatedTasks = selectedProject.tasks?.map(t =>
                            t.id === editingTask.id ? { ...t, ...taskData } : t
                        ) || [];
                        updateTasks(updatedTasks);
                    } else {
                        // Create new task
                        const newTask: ProjectTask = {
                            id: Date.now().toString(),
                            ...taskData
                        };
                        const updatedTasks = [...(selectedProject.tasks || []), newTask];
                        updateTasks(updatedTasks);
                    }
                }}
                existingTask={editingTask}
                availableTasks={selectedProject?.tasks || []}
                availableUsers={usersList.map(u => u.displayName)}
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

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Projets SSI</h1>
                    <p className="text-slate-500 dark:text-slate-400">Pilotage des plans d'actions et mise en conformité.</p>
                </div>
                {canEdit && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowTemplateModal(true)}
                            className="flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20"
                        >
                            <Zap className="h-4 w-4 mr-2" />
                            Depuis Template
                        </button>
                        <button
                            onClick={openCreateModal}
                            className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nouveau Projet
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-4 bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <Search className="h-5 w-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Rechercher un projet..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white"
                    value={filter} onChange={e => setFilter(e.target.value)}
                />
                <button onClick={handleExportCSV} className="p-2 bg-gray-100 dark:bg-slate-800 rounded text-gray-500 hover:text-slate-900 dark:hover:text-white" title="Exporter CSV">
                    <FileSpreadsheet className="h-4 w-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full"><CardSkeleton count={3} /></div>
                ) : filteredProjects.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            icon={FolderKanban}
                            title="Aucun projet en cours"
                            description={filter ? "Aucun projet ne correspond à votre recherche." : "Lancez de nouveaux projets pour améliorer votre posture de sécurité."}
                            actionLabel={filter ? undefined : "Créer un projet"}
                            onAction={filter ? undefined : openCreateModal}
                        />
                    </div>
                ) : (
                    filteredProjects.map(project => (
                        <div key={project.id} onClick={() => openInspector(project)} className="glass-panel rounded-[2.5rem] p-6 card-hover flex flex-col cursor-pointer group border border-white/50 dark:border-white/5">
                            <div className="flex justify-between items-start mb-4">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border shadow-sm ${getStatusColor(project.status)}`}>
                                    {project.status}
                                </span>
                                <MoreHorizontal className="h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{project.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 line-clamp-2 h-10 leading-relaxed">{project.description}</p>

                            <div className="mb-6">
                                <div className="flex justify-between text-xs mb-1.5 font-medium">
                                    <span className="text-slate-600 dark:text-slate-300">Avancement</span>
                                    <span className="text-brand-600">{project.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                                    <div className="bg-brand-500 h-2 rounded-full transition-all duration-500 shadow-sm" style={{ width: `${project.progress}%` }}></div>
                                </div>
                            </div>

                            <div className="flex items-center text-xs text-gray-500 mb-4 space-x-4 border-t border-gray-100 dark:border-white/10 pt-4 mt-auto">
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

            {/* Inspector Drawer - Glassmorphism */}
            {selectedProject && createPortal(
                <div className="fixed inset-0 z-[9999] overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setSelectedProject(null)} />
                    <div className="absolute inset-y-0 right-0 sm:pl-10 max-w-full flex pointer-events-none">
                        <div className="w-screen max-w-3xl pointer-events-auto">
                            <div className="h-full flex flex-col bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-slide-up">
                                {/* Header */}
                                <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-start justify-between bg-white/50 dark:bg-white/5">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border shadow-sm ${getStatusColor(selectedProject.status)}`}>{selectedProject.status}</span>
                                            <span className="text-xs font-bold text-slate-500">Échéance: {new Date(selectedProject.dueDate).toLocaleDateString()}</span>
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">{selectedProject.name}</h2>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={generateReport} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Télécharger Rapport"><Download className="h-5 w-5" /></button>
                                        {canEdit && (
                                            <button onClick={handleDuplicate} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Dupliquer"><Copy className="h-5 w-5" /></button>
                                        )}
                                        {canEdit && (
                                            <button onClick={() => { setIsEditing(true); setShowModal(true); }} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                                        )}
                                        {canEdit && (
                                            <button onClick={() => initiateDelete(selectedProject.id, selectedProject.name)} className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                                        )}
                                        <button onClick={() => setSelectedProject(null)} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="px-8 border-b border-gray-100 dark:border-white/5 flex gap-8 bg-white/30 dark:bg-white/5 overflow-x-auto no-scrollbar">
                                    {[
                                        { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
                                        { id: 'tasks', label: 'Tâches', icon: CheckSquare },
                                        { id: 'gantt', label: 'Gantt', icon: CalendarDays },
                                        { id: 'dashboard', label: 'Dashboard', icon: FolderKanban },
                                        { id: 'history', label: 'Historique', icon: History },
                                        { id: 'comments', label: 'Commentaires', icon: MessageSquare }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setInspectorTab(tab.id as any)}
                                            className={`py-4 text-sm font-semibold flex items-center border-b-2 transition-all whitespace-nowrap ${inspectorTab === tab.id ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                        >
                                            <tab.icon className={`h-4 w-4 mr-2.5 ${inspectorTab === tab.id ? 'text-brand-500' : 'opacity-70'}`} />
                                            {tab.label}
                                        </button>
                                    ))}
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
                                                                const badgeColor = risk.score >= 15 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : risk.score >= 10 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : risk.score >= 5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
                                                                return (
                                                                    <div key={riskId} className="flex items-center justify-between bg-white dark:bg-slate-900/40 border border-gray-100 dark:border-white/5 rounded-2xl px-4 py-3">
                                                                        <div>
                                                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{risk.threat}</p>
                                                                            <p className="text-xs text-slate-500 dark:text-slate-400">{risk.vulnerability}</p>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${badgeColor}`}>{level}</span>
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
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{control.status}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                        </div>
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
                                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
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
                                                    {selectedProject.tasks?.length === 0 && <p className="text-center text-gray-400 text-xs py-8 italic">Aucune tâche définie.</p>}
                                                    {selectedProject.tasks?.map(task => (
                                                        <div key={task.id} className="flex items-center p-3 bg-white dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-white/5 group hover:shadow-sm transition-all">
                                                            <button onClick={() => toggleTaskStatus(task.id)} disabled={!canEdit} className={`flex-shrink-0 w-5 h-5 rounded-full border mr-3 flex items-center justify-center transition-colors ${task.status === 'Terminé' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-500'}`}>
                                                                {task.status === 'Terminé' && <CheckSquare className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <span className={`text-sm font-medium flex-1 ${task.status === 'Terminé' ? 'text-gray-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
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
                                                                    }} className="p-1.5 text-gray-400 hover:text-blue-500 transition-all" title="Ajouter au calendrier"><CalendarDays className="h-3.5 w-3.5" /></button>
                                                                    <button onClick={() => deleteTask(task.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
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
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.details}</p>
                                                        <p className="text-[10px] text-gray-400 mt-1">Par: {log.userEmail}</p>
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
                                        <div className="space-y-6 h-full">
                                            <GanttChart
                                                tasks={selectedProject.tasks || []}
                                                onTaskUpdate={async (task, _start, end) => {
                                                    if (!selectedProject.id) return;
                                                    try {
                                                        const updatedTasks = selectedProject.tasks?.map(t =>
                                                            t.id === task.id ? { ...t, dueDate: end.toISOString() } : t
                                                        ) || [];
                                                        await updateDoc(doc(db, 'projects', selectedProject.id), {
                                                            tasks: updatedTasks
                                                        });
                                                        addToast('Tâche mise à jour', 'success');
                                                        fetchData();
                                                    } catch (_error) {
                                                        addToast('Erreur de mise à jour', 'error');
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Create Modal */}
            {showModal && (
                <ProjectFormModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    onSubmit={handleProjectFormSubmit}
                    availableUsers={usersList.map(u => u.displayName)}
                    existingProject={isEditing && selectedProject ? selectedProject : undefined}
                />
            )}
        </div>
    );
};

