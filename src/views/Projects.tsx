
import React, { useState } from 'react';
import { useStore } from '../store';
import { Project } from '../types';
import { useProjectLogic } from '../hooks/projects/useProjectLogic';
import { ProjectList } from '../components/projects/ProjectList';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectInspector } from '../components/projects/ProjectInspector';
import { ProjectForm } from '../components/projects/ProjectForm';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { PageControls } from '../components/ui/PageControls';
import { Drawer } from '../components/ui/Drawer';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { SEO } from '../components/SEO';
import { FolderKanban, Plus, MoreVertical, Zap, FileSpreadsheet } from '../components/ui/Icons';
import { TemplateModal } from '../components/projects/TemplateModal';
import { createProjectFromTemplate } from '../utils/projectTemplates';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { Menu, Transition } from '@headlessui/react';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import jsPDF from 'jspdf';

export const Projects: React.FC = () => {
    const { user, addToast } = useStore();
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

    // Reports (Simplified inline for now, ideally moved to service)
    const handleExportCSV = () => {
        const headers = ["Nom", "Statut", "Progression", "Responsable", "Echeance", "Creation"];
        const csvContent = [
            headers.join(','),
            ...projects.map(p => [
                `"${p.name.replace(/"/g, '""')}"`,
                p.status,
                `${p.progress}%`,
                `"${p.manager?.replace(/"/g, '""') || ''}"`,
                new Date(p.dueDate).toLocaleDateString(),
                new Date(p.createdAt).toLocaleDateString()
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `projets_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const generateReport = () => {
        if (!selectedProject) return;
        const doc = new jsPDF();
        doc.text(`Rapport Projet: ${selectedProject.name}`, 14, 20);
        // Minimal implementation to satisfy compilation. Real impl needs PdfService or full logic.
        doc.save(`${selectedProject.name}_report.pdf`);
    };

    const handleExportExecutiveReport = async () => {
        if (!selectedProject) return;
        // Call PDF Service
        addToast("Génération du rapport...", "info");
    };

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-8">
            <MasterpieceBackground />
            <SEO title="Gestion de Projets" description="Suivez vos projets de mise en conformité." />

            {/* Header & Stats */}
            <motion.div variants={slideUpVariants} className="glass-panel p-6 md:p-8 rounded-[2rem] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group border border-transparent dark:border-white/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 pointer-events-none" />
                {/* ... Keep the cool SVG chart if desired, explicitly copied for brevity ... */}
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90">
                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200 dark:text-slate-700" />
                            <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * (projects.length > 0 ? Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length) : 0)) / 100} className="text-brand-500 transition-all duration-1000 ease-out" />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-xl font-black text-slate-900 dark:text-white">
                                {projects.length > 0 ? Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length) : 0}%
                            </span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Avancement Global</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[200px]">Moyenne d'avancement de tous les projets.</p>
                    </div>
                </div>
                {/* Metrics */}
                <div className="flex-1 grid grid-cols-3 gap-4 border-l border-r border-slate-200 dark:border-white/10 px-6 mx-2">
                    <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{projects.length}</div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">En Cours</div>
                        <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">{projects.filter(p => p.status === 'En cours').length}</div>
                    </div>
                    <div>
                        <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">En Retard</div>
                        <div className="text-2xl font-bold text-red-500">{projects.filter(p => new Date(p.dueDate) < new Date() && p.status !== 'Terminé').length}</div>
                    </div>
                </div>
            </motion.div>

            {/* Controls */}
            <motion.div variants={slideUpVariants}>
                <PageControls
                    searchQuery={filter}
                    onSearchChange={setFilter}
                    searchPlaceholder="Rechercher un projet..."
                    totalItems={filteredProjects.length}
                    viewMode={viewMode}
                    onViewModeChange={(mode) => setViewMode(mode as 'list' | 'grid' | 'matrix')}
                    primaryAction={canEdit && (
                        <CustomTooltip content="Créer un nouveau projet">
                            <button onClick={() => { setCreationMode(true); setEditingProject(null); }} className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20">
                                <Plus className="h-4 w-4 mr-2" /> <span className="hidden sm:inline">Nouveau Projet</span>
                            </button>
                        </CustomTooltip>
                    )}
                    secondaryActions={canEdit && (
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
                    )}
                />
            </motion.div>

            {/* List / Grid */}
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
                updateTasks={updateProjectTasks}
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
