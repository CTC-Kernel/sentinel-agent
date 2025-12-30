
import React, { useState, useMemo, useCallback } from 'react';

import { useStore } from '../store';
import { Project, ProjectTemplate, UserProfile } from '../types';
import { useProjectLogic } from '../hooks/projects/useProjectLogic';
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
import { TemplateModal } from '../components/projects/TemplateModal';
import { PortfolioDashboard } from '../components/projects/PortfolioDashboard';
import { createProjectFromTemplate } from '../utils/projectTemplates';
import { GanttChart } from '../components/projects/GanttChart';
import { CsvParser } from '../utils/csvUtils';
import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { PdfService } from '../services/PdfService';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { Menu, Transition } from '@headlessui/react';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { LayoutDashboard, List, CalendarDays, FolderKanban } from 'lucide-react';
// Form validation: useForm with required fields

export const Projects: React.FC = () => {
    const { user, addToast, t } = useStore();

    // Tabs
    const [activeTab, setActiveTab] = usePersistedState<'overview' | 'list' | 'board' | 'gantt'>('projects_active_tab', 'overview');
    const [ganttViewMode, setGanttViewMode] = useState<'Day' | 'Week' | 'Month'>('Month');
    const handleGanttViewModeChange = useCallback((mode: 'Day' | 'Week' | 'Month') => setGanttViewMode(mode), []);

    const tabs = useMemo(() => [
        { id: 'overview', label: t('projects.overview'), icon: LayoutDashboard },
        { id: 'list', label: t('projects.list'), icon: List },
        { id: 'board', label: t('projects.board.title'), icon: FolderKanban },
        { id: 'gantt', label: t('projects.planning'), icon: CalendarDays },
    ], [t]);
    const {
        projects, risks, controls, assets, audits, usersList, loading,
        handleProjectFormSubmit, handleDuplicate, deleteProject, updateProjectTasks,
        isSubmitting, canEdit, checkDependencies, importProjects // Destructured
    } = useProjectLogic();

    // UI State
    const [viewMode, setViewMode] = useState<'list' | 'grid' | 'matrix' | 'kanban'>('grid');
    const [filter, setFilter] = useState('');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [creationMode, setCreationMode] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [csvImportOpen, setCsvImportOpen] = useState(false);

    // Confirm Modal State
    const [confirmData, setConfirmData] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => Promise<void> | void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Filter Logic
    // Filter Logic
    const filteredProjects = useMemo(() => projects.filter(p =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.description?.toLowerCase().includes(filter.toLowerCase())
    ), [projects, filter]);

    // Handlers
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
            await createProjectFromTemplate(template, customName, startDate, managerPayload, user?.organizationId || '');
            addToast(t('projects.toastCreated'), "success");
            setShowTemplateModal(false);
        } catch (error) {
            console.error(error);
            addToast(t('projects.toastError'), "error");
        }
    }, [usersList, user, addToast, t]);

    // Exports
    const handleExportCSV = useCallback(() => {
        CsvParser.exportToCsv(
            projects as unknown as Record<string, unknown>[],
            t('projects.filename', { date: new Date().toISOString().split('T')[0] }),
            ["name", "status", "progress", "manager", "managerId", "dueDate", "createdAt"]
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
        } catch (error) {
            console.error(error);
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
        const headers = ['Nom', 'Description', 'Statut', 'Priorité', 'Responsable', 'Echéance'];
        const rows = [{
            Nom: 'Projet de certification ISO27001',
            Description: 'Mise en conformité du SI',
            Statut: 'Nouveau',
            Priorité: 'Elevee',
            Responsable: user?.displayName || 'Admin',
            Echéance: '2025-12-31'
        }];
        CsvParser.downloadCSV(headers, rows, 'template_projets.csv');
    }, [user]);

    const handleImportCsvFile = React.useCallback(async (file: File) => {
        if (!file) return;
        const text = await file.text();
        await importProjects(text);
        setCsvImportOpen(false);
    }, [importProjects]);

    // UI Checks
    const handleTabChange = useCallback((id: string) => setActiveTab(id as 'overview' | 'list' | 'board' | 'gantt'), [setActiveTab]);
    const handleViewModeChange = useCallback((mode: string) => setViewMode(mode as 'list' | 'grid' | 'matrix' | 'kanban'), []);
    const handleNewProjectClick = useCallback(() => { setCreationMode(true); setEditingProject(null); }, []);
    const handleOpenTemplateModal = useCallback(() => setShowTemplateModal(true), []);
    const handleCloseTemplateModal = useCallback(() => setShowTemplateModal(false), []);
    const handleCloseDrawer = useCallback(() => { setCreationMode(false); setEditingProject(null); }, []);
    const handleCloseInspector = useCallback(() => setSelectedProject(null), []);
    const handleConfirmClose = useCallback(() => setConfirmData(prev => ({ ...prev, isOpen: false })), []);
    const handleDrawerSubmit = useCallback((data: import('../schemas/projectSchema').ProjectFormData) => handleProjectFormSubmit(data as unknown as import('../types').Project, editingProject), [handleProjectFormSubmit, editingProject]);
    const handleInspectorUpdateTasks = useCallback(async (p: Project, t: import('../types').ProjectTask[]) => { await updateProjectTasks(p, t); }, [updateProjectTasks]);

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-8 pb-20">
            <MasterpieceBackground />
            <SEO title={t('sidebar.projects')} description={t('projects.subtitle')} />

            <PageHeader
                title={t('projects.dashboard')}
                subtitle={t('projects.subtitle')}
                icon={<LayoutDashboard className="h-6 w-6 text-brand-500" />}
                breadcrumbs={[{ label: t('common.pilotage') }, { label: t('sidebar.projects') }]}
                trustType="integrity"
            />

            <ScrollableTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
            />

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <motion.div variants={slideUpVariants} className="space-y-6">
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
                                <button
                                    aria-label={t('projects.newProject')}
                                    onClick={handleNewProjectClick}
                                    className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">{t('projects.newProject')}</span>
                                </button>
                            </CustomTooltip>

                            <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                            {/* Secondary Actions Menu */}
                            <Menu as="div" className="relative inline-block text-left">
                                <Menu.Button className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                                    <MoreVertical className="h-5 w-5" />
                                </Menu.Button>
                                <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                        <div className="p-1">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('common.actions.title')}</div>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button aria-label={t('projects.createFromTemplate')} onClick={handleOpenTemplateModal} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        <Zap className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-amber-500'}`} /> {t('projects.createFromTemplate')}
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button aria-label={t('common.importCsv')} onClick={() => setCsvImportOpen(true)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        <Upload className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-blue-500'}`} /> {t('common.importCsv')}
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button aria-label={t('projects.exportCsv')} onClick={handleExportCSV} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-emerald-500'}`} /> {t('projects.exportCsv')}
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
                <motion.div variants={slideUpVariants} className="space-y-6">
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
                                <div className="col-span-full text-center py-8">{t('projects.loading')}</div>
                            ) : filteredProjects.length === 0 ? (
                                <div className="col-span-full">
                                    <EmptyState icon={FolderKanban} title={t('projects.emptyTitle')} description={t('projects.emptyDesc')} actionLabel={canEdit ? t('projects.createAction') : undefined} onAction={handleNewProjectClick} />
                                </div>
                            ) : (
                                filteredProjects.map(p => (
                                    <ProjectCard
                                        key={p.id}
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
                <motion.div variants={slideUpVariants} className="space-y-6">
                    <GanttChart
                        tasks={filteredProjects.flatMap(p => p.tasks || [])}
                        viewMode={ganttViewMode}
                        onViewModeChange={handleGanttViewModeChange}
                    />
                </motion.div>
            )}

            {/* KANBAN TAB */}
            {activeTab === 'board' && (
                <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-300px)] min-h-[500px] overflow-x-auto pb-4">
                    {['todo', 'inProgress', 'done'].map((statusKey) => {
                        const statusLabel = t(`projects.kanban.${statusKey}`);
                        const columnProjects = filteredProjects.filter(p =>
                            statusKey === 'todo' ? (p.status !== 'En cours' && p.status !== 'Terminé') :
                                statusKey === 'inProgress' ? p.status === 'En cours' :
                                    p.status === 'Terminé'
                        );

                        return (
                            <div key={statusKey} className="flex flex-col glass-panel rounded-2xl p-4 border border-white/20 h-full">
                                <h4 className="text-sm font-bold uppercase text-slate-600 dark:text-slate-400 mb-4 flex justify-between tracking-wider px-1">
                                    {statusLabel}
                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-xs shadow-sm border border-slate-200 dark:border-white/5">
                                        {columnProjects.length}
                                    </span>
                                </h4>
                                <div className="space-y-4 overflow-y-auto pr-2 flex-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                                    {columnProjects.length === 0 ? (
                                        <div className="h-32 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-xl flex items-center justify-center text-slate-400 text-xs font-medium">
                                            {t('projects.emptyTitle')}
                                        </div>
                                    ) : (
                                        columnProjects.map(p => (
                                            <ProjectCard
                                                key={p.id}
                                                project={p}
                                                canEdit={canEdit}
                                                user={user}
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
                width="max-w-4xl"
                disableScroll={true}
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
