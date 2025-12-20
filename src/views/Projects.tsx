
import React, { useState } from 'react';
import { useStore } from '../store';
import { Project } from '../types';
import { useProjectLogic } from '../hooks/projects/useProjectLogic';
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

import { Plus, MoreVertical, Zap, FileSpreadsheet } from '../components/ui/Icons';
import { TemplateModal } from '../components/projects/TemplateModal';
import { PortfolioDashboard } from '../components/projects/PortfolioDashboard';
import { createProjectFromTemplate } from '../utils/projectTemplates';
import { GanttChart } from '../components/projects/GanttChart';
import { CsvParser } from '../utils/csvUtils';
import { PdfService } from '../services/PdfService';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { Menu, Transition } from '@headlessui/react';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { LayoutDashboard, List, CalendarDays, FolderKanban } from 'lucide-react';

export const Projects: React.FC = () => {
    const { user, addToast } = useStore();

    // Tabs
    const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'board' | 'gantt'>('list');
    const [ganttViewMode, setGanttViewMode] = useState<'Day' | 'Week' | 'Month'>('Month');

    const tabs = [
        { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard },
        { id: 'list', label: "Liste", icon: List },
        { id: 'board', label: "Kanban", icon: FolderKanban },
        { id: 'gantt', label: "Planning", icon: CalendarDays },
    ];
    const {
        projects, risks, controls, assets, audits, usersList, loading,
        handleProjectFormSubmit, handleDuplicate, deleteProject, updateProjectTasks,
        isSubmitting, canEdit
    } = useProjectLogic();

    // UI State
    const [viewMode, setViewMode] = useState<'list' | 'grid' | 'matrix'>('grid');
    const [filter, setFilter] = useState('');
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [creationMode, setCreationMode] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [showTemplateModal, setShowTemplateModal] = useState(false);

    // Confirm Modal State
    const [confirmData, setConfirmData] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => Promise<void> | void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Filter Logic
    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.description?.toLowerCase().includes(filter.toLowerCase())
    );

    // Handlers
    const onEditProject = (project: Project) => {
        setEditingProject(project);
        // creationMode implicitly handled by Drawer 'isOpen' logic check
    };

    const onDeleteRequest = (id: string, name: string) => {
        setConfirmData({
            isOpen: true,
            title: 'Supprimer le projet',
            message: `Êtes-vous sûr de vouloir supprimer le projet "${name}" ? Cette action est irréversible.`,
            onConfirm: async () => {
                await deleteProject(id);
                setConfirmData({ ...confirmData, isOpen: false });
                if (selectedProject?.id === id) setSelectedProject(null);
            }
        });
    };

    const handleDuplicateWrapper = async (project: Project) => {
        await handleDuplicate(project);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleCreateFromTemplate = async (template: any, customName: string, startDate: Date, managerId: string) => {
        try {
            await createProjectFromTemplate(template, customName, startDate, managerId, user?.organizationId || '');
            addToast("Projet créé depuis le modèle", "success");
            setShowTemplateModal(false);
        } catch (error) {
            console.error(error);
            addToast("Erreur lors de la création", "error");
        }
    };

    // Exports
    const handleExportCSV = () => {
        CsvParser.exportToCsv(
            projects,
            "projets_export",
            ["name", "status", "progress", "manager", "dueDate", "createdAt"]
        );
    };

    const generateReport = () => {
        if (!selectedProject) return;
        try {
            PdfService.generateProjectExecutiveReport(selectedProject, {
                title: selectedProject.name,
                author: user?.displayName || 'Utilisateur',
                organizationName: user?.organizationId || 'Sentinel'
            });
            addToast("Rapport généré avec succès", "success");
        } catch (error) {
            console.error(error);
            addToast("Erreur lors de la génération du rapport", "error");
        }
    };

    const handleExportExecutiveReport = async () => {
        if (!selectedProject) return;
        generateReport();
    };

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-8 pb-20">
            <MasterpieceBackground />
            <SEO title="Gestion de Projets" description="Suivez vos projets de mise en conformité." />

            <PageHeader
                title="Tableau de Bord Projets"
                subtitle="Pilotez vos initiatives de sécurité et suivez l'avancement global."
                icon={<LayoutDashboard className="h-6 w-6 text-white" />}
                breadcrumbs={[{ label: 'Pilotage' }, { label: 'Projets' }]}
            />

            <ScrollableTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as 'overview' | 'list' | 'board' | 'gantt')}
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
                    searchPlaceholder="Rechercher un projet..."
                    viewMode={activeTab === 'list' ? viewMode : undefined}
                    onViewModeChange={activeTab === 'list' ? (mode) => setViewMode(mode as 'list' | 'grid' | 'matrix') : undefined}
                    actions={canEdit && (
                        <>
                            <CustomTooltip content="Créer un nouveau projet">
                                <button onClick={() => { setCreationMode(true); setEditingProject(null); }} className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20">
                                    <Plus className="h-4 w-4 mr-2" /> <span className="hidden sm:inline">Nouveau Projet</span>
                                </button>
                            </CustomTooltip>

                            <Menu as="div" className="relative inline-block text-left">
                                <Menu.Button className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                                    <MoreVertical className="h-5 w-5" />
                                </Menu.Button>
                                <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                        <div className="p-1">
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button onClick={() => setShowTemplateModal(true)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        <Zap className="mr-2 h-4 w-4" /> Depuis Template
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button onClick={handleExportCSV} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                        <FileSpreadsheet className="mr-2 h-4 w-4" /> Export CSV
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
                            onEdit={onEditProject}
                            onDelete={onDeleteRequest}
                            onBulkDelete={() => { }}
                            onSelect={setSelectedProject}
                        />
                    ) : (
                        <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {loading ? (
                                <div className="col-span-full text-center py-8">Chargement...</div>
                            ) : filteredProjects.length === 0 ? (
                                <div className="col-span-full">
                                    <EmptyState icon={FolderKanban} title="Aucun projet" description="Commencez par créer un nouveau projet." actionLabel={canEdit ? "Créer un projet" : undefined} onAction={() => setCreationMode(true)} />
                                </div>
                            ) : (
                                filteredProjects.map(p => (
                                    <ProjectCard
                                        key={p.id}
                                        project={p}
                                        canEdit={canEdit}
                                        user={user}
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
                        onViewModeChange={setGanttViewMode}
                    />
                </motion.div>
            )}

            {/* KANBAN TAB */}
            {activeTab === 'board' && (
                <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-300px)] min-h-[500px] overflow-x-auto pb-4">
                    {['A faire', 'En cours', 'Terminé'].map((status) => {
                        const columnProjects = filteredProjects.filter(p =>
                            status === 'A faire' ? (p.status !== 'En cours' && p.status !== 'Terminé') : p.status === status
                        );

                        return (
                            <div key={status} className="flex flex-col glass-panel rounded-2xl p-4 border border-white/20 h-full">
                                <h4 className="text-sm font-bold uppercase text-slate-600 dark:text-slate-400 mb-4 flex justify-between tracking-wider px-1">
                                    {status}
                                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg text-xs shadow-sm border border-slate-200 dark:border-white/5">
                                        {columnProjects.length}
                                    </span>
                                </h4>
                                <div className="space-y-4 overflow-y-auto pr-2 flex-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                                    {columnProjects.length === 0 ? (
                                        <div className="h-32 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-xl flex items-center justify-center text-slate-400 text-xs font-medium">
                                            Aucun projet
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
                onClose={() => setSelectedProject(null)}
                user={user}
                canEdit={canEdit}
                usersList={usersList}
                risks={risks}
                controls={controls}
                assets={assets}
                audits={audits}
                updateTasks={async (p, t) => { await updateProjectTasks(p, t); }}
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
                onClose={() => { setCreationMode(false); setEditingProject(null); }}
                title={editingProject ? "Modifier le Projet" : "Nouveau Projet"}
                subtitle={editingProject ? editingProject.name : "Création"}
                width="max-w-4xl"
            >
                <ProjectForm
                    onCancel={() => { setCreationMode(false); setEditingProject(null); }}
                    onSubmit={(data) => handleProjectFormSubmit(data, editingProject)}
                    existingProject={editingProject || undefined}
                    availableUsers={usersList.map(u => u.displayName || u.email)}
                    availableRisks={risks}
                    availableControls={controls}
                    availableAssets={assets}
                    isLoading={isSubmitting}
                />
            </Drawer>

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
        </motion.div>
    );
};
