import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'react-router-dom';

import { useStore } from '../store';
import { Project, ProjectTemplate, UserProfile } from '../types';
import { useProjectLogic } from '../hooks/projects/useProjectLogic';
import { useProjectDependencies } from '../hooks/projects/useProjectDependencies';
import { useSupplierLogic } from '../hooks/suppliers/useSupplierLogic';
import { usePersistedState } from '../hooks/usePersistedState';
import { ProjectList } from '../components/projects/ProjectList';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectInspector } from '../components/projects/ProjectInspector';
import { ProjectForm } from '../components/projects/ProjectForm';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { Drawer } from '../components/ui/Drawer';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';

import { Plus, MoreVertical, Zap, FileSpreadsheet, Upload } from '../components/ui/Icons';
import { CardSkeleton, SkeletonCard } from '../components/ui/Skeleton';
import { TemplateModal } from '../components/projects/TemplateModal';
import { PortfolioDashboard } from '../components/projects/PortfolioDashboard';
import { createProjectFromTemplate } from '../utils/projectTemplates';
import { GanttChart } from '../components/projects/GanttChart';
import { ImportService } from '../services/ImportService';
import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { PdfService } from '../services/PdfService';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { Menu, Transition } from '@headlessui/react';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { LayoutDashboard, List, CalendarDays, FolderKanban } from '../components/ui/Icons';
import { Button } from '../components/ui/button';
// Form validation: useForm with required fields

import { OnboardingService } from '../services/onboardingService';

export const Projects: React.FC = () => {
    const { user, addToast, t } = useStore();

    // Start module tour
    React.useEffect(() => {
        const timer = setTimeout(() => {
            OnboardingService.startProjectsTour();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    // Tabs
    const [activeTab, setActiveTab] = usePersistedState<'overview' | 'list' | 'board' | 'gantt'>('projects_active_tab', 'overview');
    const [ganttViewMode, setGanttViewMode] = useState<'Day' | 'Week' | 'Month'>('Month');
    const handleGanttViewModeChange = useCallback((mode: 'Day' | 'Week' | 'Month') => setGanttViewMode(mode), []);

    // UI State
    const [viewMode, setViewMode] = useState<'list' | 'grid' | 'matrix' | 'kanban'>('grid');
    const [filter, setFilter] = useState('');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [creationMode, setCreationMode] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [csvImportOpen, setCsvImportOpen] = useState(false);
    const [isFormDirty, setIsFormDirty] = useState(false);

    // Dependencies Logic: Only fetch detailed collections when needed (optimization)
    const shouldFetchDetails = creationMode || !!editingProject || !!selectedProject;

    const tabs = useMemo(() => [
        { id: 'overview', label: t('projects.overview'), icon: LayoutDashboard },
        { id: 'list', label: t('projects.list'), icon: List },
        { id: 'board', label: t('projects.board.title'), icon: FolderKanban },
        { id: 'gantt', label: t('projects.planning'), icon: CalendarDays },
    ], [t]);

    const {
        projects, loading: loadingProjects,
        handleProjectFormSubmit, handleDuplicate, deleteProject, updateProjectTasks,
        isSubmitting, canEdit, checkDependencies, importProjects, createProjectFromTemplateData
    } = useProjectLogic();

    const {
        risks, controls, assets, audits, usersList, loading: loadingDeps
    } = useProjectDependencies({
        fetchUsers: true, // Always needed for avatars/assignees
        fetchRisks: shouldFetchDetails,
        fetchControls: shouldFetchDetails,
        fetchAssets: shouldFetchDetails,
        fetchAudits: shouldFetchDetails
    });

    const loading = loadingProjects || (shouldFetchDetails && loadingDeps);

    const { suppliers } = useSupplierLogic();

    // Confirm Modal State
    const [confirmData, setConfirmData] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => Promise<void> | void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // URL Params for Deep Linking
    const [searchParams, setSearchParams] = useSearchParams();
    const deepLinkProjectId = searchParams.get('id');
    const deepLinkAction = searchParams.get('action');

    // Deep Linking Effect
    useEffect(() => {
        if (loading) return;

        if (deepLinkProjectId && projects.length > 0) {
            const project = projects.find(p => p.id === deepLinkProjectId);
            if (project) {
                flushSync(() => {
                    setSelectedProject(project);
                });
            }
        } else if (deepLinkAction === 'create' && !creationMode) {
            // Fix: Wrap in setTimeout to avoid "setState synchronously within an effect" warning
            setTimeout(() => {
                setCreationMode(true);
                // Consume action immediately
                setSearchParams(params => {
                    params.delete('action');
                    return params;
                }, { replace: true });
            }, 0);
        }
    }, [loading, deepLinkProjectId, deepLinkAction, projects, creationMode, setSearchParams]);

    // Cleanup URL param when closing inspector
    useEffect(() => {
        // CRITICAL FIX: Do not clean up while loading, otherwise we strip params before using them
        if (loading) return;

        if (!selectedProject && deepLinkProjectId) {
            setSearchParams(params => {
                params.delete('id');
                return params;
            }, { replace: true });
        }
    }, [selectedProject, deepLinkProjectId, setSearchParams, loading]);

    // Filter Logic
    const filteredProjects = useMemo(() => projects.filter(p =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.description?.toLowerCase().includes(filter.toLowerCase()) ||
        p.status.toLowerCase().includes(filter.toLowerCase())
    ), [projects, filter]);

    // Handlers
    const onEditProject = useCallback((project: Project) => {
        setEditingProject(project);
    }, []);

    const onDeleteRequest = useCallback(async (id: string, name: string) => {
        // Dependencies check
        const { hasDependencies, dependencies } = await checkDependencies(id);

        let message = t('projects.deleteMessage', { name });

        if (hasDependencies && dependencies && dependencies.length > 0) {
            const depDetails = dependencies.slice(0, 5).map(d => `${d.type}: ${d.name}`).join(', ');
            const count = dependencies.length;
            message = t('projects.deleteWarning', { count, details: depDetails + (count > 5 ? '...' : '') });
        }

        setConfirmData({
            isOpen: true,
            title: t('projects.deleteTitle'),
            message: message,
            onConfirm: async () => {
                await deleteProject(id, name);
                setConfirmData(prev => ({ ...prev, isOpen: false }));
                if (selectedProject?.id === id) setSelectedProject(null);
            }
        });
    }, [checkDependencies, t, deleteProject, selectedProject]);

    const handleDuplicateWrapper = useCallback(async (project: Project) => {
        await handleDuplicate(project);
    }, [handleDuplicate]);

    const handleCreateFromTemplate = useCallback(async (template: ProjectTemplate, customName: string, startDate: Date, managerId: string) => {
        try {
            const managerUser = usersList.find((u: UserProfile) => u.uid === managerId);
            const managerPayload = {
                id: managerId,
                label: managerUser?.displayName || managerUser?.email || 'Responsable'
            };
            const { project, milestones } = await createProjectFromTemplate(template, customName, startDate, managerPayload, user?.organizationId || '');

            await createProjectFromTemplateData(project, milestones);

            // Success toast is handled in createProjectFromTemplateData
            setShowTemplateModal(false);
        } catch {
            addToast(t('projects.toastError'), "error");
        }
    }, [usersList, user, addToast, t, createProjectFromTemplateData]);

    // Exports
    const handleExportCSV = useCallback(() => {
        ImportService.exportProjects(
            projects,
            t('projects.filename', { date: new Date().toISOString().split('T')[0] })
        );
    }, [projects, t]);

    const generateReport = useCallback(() => {
        if (!selectedProject) return;
        try {
            PdfService.generateProjectExecutiveReport(selectedProject, {
                title: selectedProject.name,
                author: user?.displayName || 'Utilisateur',
                organizationName: user?.organizationId || 'Sentinel'
            });
            addToast(t('projects.toastReportSuccess'), "success");
        } catch {
            addToast(t('projects.toastReportError'), "error");
        }
    }, [selectedProject, user, addToast, t]);

    const handleExportExecutiveReport = useCallback(async () => {
        if (!selectedProject) return;
        generateReport();
    }, [selectedProject, generateReport]);

    // CSV Import Handlers
    const projectGuidelines = {
        required: ['Nom'],
        optional: ['Description', 'Statut', 'Priorité', 'Responsable', 'Echéance'],
        format: 'CSV'
    };

    const handleDownloadTemplate = React.useCallback(() => {
        ImportService.downloadProjectTemplate();
    }, []);

    const handleImportCsvFile = React.useCallback(async (file: File) => {
        if (!file) return;
        const text = await file.text();
        await importProjects(text);
        setCsvImportOpen(false);
    }, [importProjects]);

    // Debug: Monitor activeTab changes
    useEffect(() => {
    }, [activeTab]);

    // UI Checks
    const handleTabChange = useCallback((id: string) => {
        if (id !== activeTab) {
            setActiveTab(id as 'overview' | 'list' | 'board' | 'gantt');
        }
        // If same tab, no action needed
    }, [activeTab, setActiveTab]);
    const handleViewModeChange = useCallback((mode: string) => setViewMode(mode as 'list' | 'grid' | 'matrix' | 'kanban'), []);
    const handleNewProjectClick = useCallback(() => { setCreationMode(true); setEditingProject(null); }, []);
    const handleOpenTemplateModal = useCallback(() => setShowTemplateModal(true), []);
    const handleCloseTemplateModal = useCallback(() => setShowTemplateModal(false), []);
    const handleCloseDrawer = useCallback(() => {
        setCreationMode(false);
        setEditingProject(null);
        setIsFormDirty(false);
    }, []);
    const handleCloseInspector = useCallback(() => setSelectedProject(null), []);
    const handleConfirmClose = useCallback(() => setConfirmData(prev => ({ ...prev, isOpen: false })), []);
    const handleDrawerSubmit = useCallback(async (data: import('../schemas/projectSchema').ProjectFormData) => {
        await handleProjectFormSubmit(data as unknown as import('../types').Project, editingProject);
        setIsFormDirty(false);
    }, [handleProjectFormSubmit, editingProject]);
    const handleInspectorUpdateTasks = useCallback(async (p: Project, t: import('../types').ProjectTask[]) => { await updateProjectTasks(p, t); }, [updateProjectTasks]);

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24">
            <MasterpieceBackground />
            <SEO title={t('sidebar.projects')} description={t('projects.subtitle')} />

            <PageHeader
                title={t('projects.title')}
                subtitle={t('projects.subtitle')}
                icon={
                    <img
                        src="/images/pilotage.png"
                        alt="PILOTAGE"
                        className="w-full h-full object-contain"
                    />
                }
                trustType="integrity"
            />

            <ScrollableTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
            />

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <motion.div
                    variants={slideUpVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-6"
                >
                    <PortfolioDashboard projects={projects} />
                </motion.div>
            )}

            {/* Shared Controls for List, Board, Gantt */}
            {activeTab !== 'overview' && (
                <PremiumPageControl
                    searchQuery={filter}
                    onSearchChange={setFilter}
                    searchPlaceholder={t('projects.searchPlaceholder')}
                    viewMode={activeTab === 'list' ? viewMode : undefined}
                    onViewModeChange={activeTab === 'list' ? handleViewModeChange : undefined}
                    actions={canEdit && (
                        <>
                            {/* Primary Action */}
                            <CustomTooltip content={t('projects.newProject')}>
                                <Button
                                    aria-label={t('projects.newProject')}
                                    onClick={handleNewProjectClick}
                                    className="shadow-lg shadow-brand-500/20"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">{t('projects.newProject')}</span>
                                </Button>
                            </CustomTooltip>

                            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                            {/* Secondary Actions Menu */}
                            <Menu as="div" className="relative inline-block text-left">
                                <Menu.Button as={Button} variant="ghost" size="icon" className="border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm">
                                    <MoreVertical className="h-5 w-5" />
                                </Menu.Button>
                                <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-70 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-70 scale-100" leaveTo="transform opacity-0 scale-95">
                                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-20 focus:outline-none z-50">
                                        <div className="p-1">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">{t('common.actions.title')}</div>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button aria-label={t('projects.createFromTemplate')} onClick={handleOpenTemplateModal} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        <Zap className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-warning-text'}`} /> {t('projects.createFromTemplate')}
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button aria-label={t('common.importCsv')} onClick={() => setCsvImportOpen(true)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        <Upload className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-brand-500'}`} /> {t('common.importCsv')}
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button aria-label={t('projects.exportCsv')} onClick={handleExportCSV} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-success-text'}`} /> {t('projects.exportCsv')}
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>
                        </>
                    )}
                />
            )}

            {/* LIST TAB */}
            {activeTab === 'list' && (
                <motion.div
                    variants={slideUpVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-6"
                >
                    {viewMode === 'list' ? (
                        <ProjectList
                            projects={filteredProjects}
                            loading={loading}
                            canEdit={canEdit}
                            user={user}
                            usersList={usersList}
                            onEdit={onEditProject}
                            onDelete={onDeleteRequest}
                            onBulkDelete={() => { }}
                            onSelect={setSelectedProject}
                        />
                    ) : (
                        <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {loading ? (
                                <CardSkeleton count={6} className="col-span-full" />
                            ) : filteredProjects.length === 0 ? (
                                <div className="col-span-full">
                                    <EmptyState icon={FolderKanban} title={t('projects.emptyTitle')} description={t('projects.emptyDesc')} actionLabel={canEdit ? t('projects.createAction') : undefined} onAction={handleNewProjectClick} />
                                </div>
                            ) : (
                                filteredProjects.map(p => (
                                    <ProjectCard
                                        key={p.id || 'unknown'}
                                        project={p}
                                        canEdit={canEdit}
                                        user={user}
                                        usersList={usersList}
                                        onEdit={onEditProject}
                                        onDelete={onDeleteRequest}
                                        onClick={setSelectedProject}
                                        onDuplicate={handleDuplicateWrapper}
                                    />
                                ))
                            )}
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* PLANNING TAB */}
            {activeTab === 'gantt' && (
                <motion.div
                    variants={slideUpVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-6"
                >
                    <GanttChart
                        tasks={filteredProjects.flatMap(p => p.tasks || [])}
                        viewMode={ganttViewMode}
                        onViewModeChange={handleGanttViewModeChange}
                        loading={loading}
                    />
                </motion.div>
            )}

            {/* KANBAN TAB */}
            {activeTab === 'board' && (
                <motion.div
                    variants={slideUpVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-300px)] min-h-[500px] overflow-x-auto pb-4"
                >
                    {(['todo', 'inProgress', 'done'] as const).map((statusKey) => {
                        const statusLabel = t(`projects.kanban.${statusKey}`);
                        const columnProjects = filteredProjects.filter(p => {
                            // Map project status to Kanban columns (Explicit Mapping)
                            const category =
                                (p.status === 'En cours') ? 'inProgress' :
                                    (p.status === 'Terminé') ? 'done' :
                                        'todo'; // 'Planifié', 'Suspendu' fallback to Todo
                            return category === statusKey;
                        });

                        return (
                            <div key={statusKey || 'unknown'} className="flex flex-col glass-premium rounded-3xl p-5 h-full border border-border/40">
                                <h4 className="flex justify-between px-1 mb-4 text-sm font-bold tracking-wider uppercase text-slate-600 dark:text-muted-foreground">
                                    {statusLabel}
                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-xs shadow-sm border border-slate-200 dark:border-white/5">
                                        {columnProjects.length}
                                    </span>
                                </h4>
                                <div className="flex-1 pr-2 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                                    {loading ? (
                                        <>
                                            <SkeletonCard />
                                            <SkeletonCard />
                                        </>
                                    ) : columnProjects.length === 0 ? (
                                        <div className="flex items-center justify-center h-32 text-xs font-medium border-2 border-dashed border-slate-200 dark:border-white/5 rounded-xl text-muted-foreground">
                                            {t('projects.emptyTitle')}
                                        </div>
                                    ) : (
                                        columnProjects.map(p => (
                                            <ProjectCard
                                                key={p.id || 'unknown'}
                                                project={p}
                                                canEdit={canEdit}
                                                user={user}
                                                usersList={usersList} // Added missing prop relative to line 317
                                                onEdit={onEditProject}
                                                onDelete={onDeleteRequest}
                                                onClick={setSelectedProject}
                                                onDuplicate={handleDuplicateWrapper}
                                                compact
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </motion.div>
            )}

            {/* Inspector */}
            <ProjectInspector
                isOpen={!!selectedProject}
                project={selectedProject}
                onClose={handleCloseInspector}
                user={user}
                canEdit={canEdit}
                usersList={usersList}
                risks={risks}
                controls={controls}
                assets={assets}
                audits={audits}
                suppliers={suppliers}
                processes={[]}
                updateTasks={handleInspectorUpdateTasks}
                onDeleteProject={onDeleteRequest}
                onDuplicateProject={handleDuplicateWrapper}
                onEditProject={onEditProject}
                onExportExecutiveReport={handleExportExecutiveReport}
                onGenerateReport={generateReport}
                isSubmitting={isSubmitting}
            />

            {/* Create/Edit Drawer */}
            <Drawer
                isOpen={creationMode || !!editingProject}
                onClose={handleCloseDrawer}
                title={editingProject ? t('projects.editProject') : t('projects.newProject')}
                subtitle={editingProject ? editingProject.name : t('common.create')}
                width="max-w-6xl"
                disableScroll={true}
                hasUnsavedChanges={isFormDirty}
            >
                <ProjectForm
                    onCancel={handleCloseDrawer}
                    onSubmit={handleDrawerSubmit}
                    existingProject={editingProject || undefined}
                    usersList={usersList}
                    availableRisks={risks}
                    availableControls={controls}
                    availableAssets={assets}
                    isLoading={isSubmitting}
                    onDirtyChange={setIsFormDirty}
                />
            </Drawer>

            <TemplateModal
                isOpen={showTemplateModal}
                onClose={handleCloseTemplateModal}
                onSelectTemplate={handleCreateFromTemplate}
                managers={usersList}
            />

            <ImportGuidelinesModal
                isOpen={csvImportOpen}
                onClose={() => setCsvImportOpen(false)}
                entityName={t('sidebar.projects')}
                guidelines={projectGuidelines}
                onImport={handleImportCsvFile}
                onDownloadTemplate={handleDownloadTemplate}
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={handleConfirmClose}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />
        </motion.div>
    );
};

// Headless UI handles FocusTrap and keyboard navigation
