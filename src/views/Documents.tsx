import React, { useDeferredValue, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { SEO } from '../components/SEO';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Document, UserProfile } from '../types';
import { getUserAvatarUrl } from '../utils/avatarUtils';
import { canEditResource } from '../utils/permissions';
import { Plus, MoreVertical, FileText, Upload, FileSpreadsheet, LayoutDashboard, FolderOpen, Lock } from '../components/ui/Icons';
import { Skeleton, ListSkeleton } from '../components/ui/Skeleton';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { useStore } from '../store';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { Drawer } from '../components/ui/Drawer';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/button';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { DocumentForm } from '../components/documents/DocumentForm';
import { FolderTree } from '../components/documents/FolderTree';
import { DocumentInspector } from '../components/documents/DocumentInspector';
import { DocumentSignature } from '../components/documents/DocumentSignature';
import { DocumentTemplateModal } from '../components/documents/DocumentTemplateModal';
import { DocumentTemplate } from '../data/documentTemplates';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { DocumentsCharts } from '../components/documents/DocumentsCharts';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { usePersistedState } from '../hooks/usePersistedState';
import { useDocumentWorkflow } from '../hooks/documents/useDocumentWorkflow';
import { useDocumentActions } from '../hooks/documents/useDocumentActions';
import { useDocumentsData } from '../hooks/documents/useDocumentsData';
import { useDocumentDependencies } from '../hooks/documents/useDocumentDependencies';
import { useTeamManagement } from '../hooks/useTeamManagement';
import { DocumentFormData } from '../schemas/documentSchema';
// Form error handling: error states displayed via toast

type WorkflowAction = 'submit' | 'approve' | 'reject' | 'sign';
type DocumentFormPayload = DocumentFormData & { fileUrl?: string; fileHash?: string; isSecure?: boolean };

import { ImportService } from '../services/ImportService';
import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { Menu, Transition } from '@headlessui/react';
import { OnboardingService } from '../services/onboardingService';

// --- Premium Skeleton (Matches Card Layout) ---
const DocumentCardSkeleton = () => (
    <div className="glass-premium p-5 rounded-3xl border border-border/40 flex flex-col gap-4 relative overflow-hidden animate-pulse">
        <div className="flex-1 space-y-3">
            <Skeleton className="h-5 w-3/4 rounded-md" />
            <div className="flex items-center gap-2 mt-2">
                <Skeleton className="h-3 w-12 rounded" />
                <span className="text-slate-200">.</span>
                <Skeleton className="h-3 w-8 rounded" />
                <span className="text-slate-200">.</span>
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-3 w-24 rounded" />
            </div>
        </div>
        <div className="shrink-0 flex items-center">
            <Skeleton className="h-7 w-24 rounded-2xl" />
        </div>
    </div>
);

const DocumentGridSkeleton = ({ count = 6 }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: count }).map((_, i) => (
            <DocumentCardSkeleton key={i || 'unknown'} />
        ))}
    </div>
);

export const Documents: React.FC = () => {
    const { t, addToast } = useStore();
    const { user, claimsSynced, loading: authLoading } = useAuth();
    const { users: usersList } = useTeamManagement(claimsSynced);
    const location = useLocation();

    // DEBUG LOG

    const canCreate = canEditResource(user, 'Document');

    // Start module tour
    React.useEffect(() => {
        const timer = setTimeout(() => {
            OnboardingService.startDocumentsTour();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    // --- Data Fetching ---
    const {
        documents,
        folders,
        loading: docsLoading
    } = useDocumentsData(user?.organizationId, claimsSynced);

    // Optimized: Lazy load dependencies
    const { dependencies, loadDependencies } = useDocumentDependencies(user?.organizationId, claimsSynced);

    // Destructure lazy dependencies (empty initially)
    const {
        controls,
        assets: rawAssets,
        risks: rawRisks,
        audits: rawAudits
    } = dependencies;


    // FIX: Ensure usersList is never empty if logged in
    const effectiveUsers = useMemo(() => {
        if (usersList && usersList.length > 0) return usersList;
        if (user && user.uid) return [user];
        return [];
    }, [usersList, user]);

    // --- State ---
    const [activeTab, setActiveTab] = usePersistedState<'overview' | 'documents'>('documents-active-tab', 'overview');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filter, setFilter] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'matrix' | 'kanban'>('grid');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [isDigitalSafeMode, setIsDigitalSafeMode] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateData, setTemplateData] = useState<DocumentTemplate | null>(null);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const pendingSelectId = useRef<string | null>(null);

    // Tabs configuration
    const tabs = useMemo(() => [
        { id: 'overview', label: t('documents.overview') || 'Vue d\'ensemble', icon: LayoutDashboard },
        { id: 'documents', label: t('documents.list') || 'Documents', icon: FolderOpen },
    ], [t]);

    // --- Hooks Integration ---
    const {
        selectedDocument,
        setSelectedDocument,
        showSignatureModal,
        setShowSignatureModal,
        signaturePadRef,
        handleWorkflowAction,
        handleSignatureSubmit,
        handleSecureView
    } = useDocumentWorkflow(effectiveUsers);

    const {
        handleCreate,
        handleUpdate,
        initiateDelete,
        handleCreateFolder,
        handleUpdateFolder,
        handleDeleteFolder,
        handleExportCSV,
        importDocuments,
        isSubmitting,
        isExportingCSV,
        confirmData,
        setConfirmData
    } = useDocumentActions(effectiveUsers, useCallback((deletedId: string) => {
        if (selectedDocument?.id === deletedId) setSelectedDocument(null);
    }, [selectedDocument, setSelectedDocument]));

    const [csvImportOpen, setCsvImportOpen] = useState(false);

    // CSV Import Handlers
    const documentGuidelines = {
        required: ['Titre'],
        optional: ['Description', 'Statut', 'Type', 'Version', 'Proprietaire', 'Prochaine_Revue', 'URL'],
        format: 'CSV'
    };

    const handleDownloadTemplate = React.useCallback(() => {
        ImportService.downloadDocumentTemplate();
    }, []);

    const handleImportCsvFile = React.useCallback(async (file: File) => {
        if (!file) return;
        const text = await file.text();
        await importDocuments(text);
        setCsvImportOpen(false);
    }, [importDocuments]);

    // --- Effects ---
    // URL Params for Deep Linking
    const [searchParams, setSearchParams] = useSearchParams();
    const deepLinkDocId = searchParams.get('id');
    const deepLinkAction = searchParams.get('action');

    const loading = authLoading || !claimsSynced || docsLoading;

    React.useEffect(() => {
        if (loading) return;

        // 1. Open Inspector
        if (deepLinkDocId && documents.length > 0) {
            const doc = documents.find(d => d.id === deepLinkDocId);
            if (doc && selectedDocument?.id !== doc.id) {
                loadDependencies();
                setSelectedDocument(doc);
            }
        }

        // 2. Open Create Modal
        if (deepLinkAction === 'create' && !showCreateModal) {
            setShowCreateModal(true);
            // Consume action immediately
            setSearchParams(params => {
                const next = new URLSearchParams(params);
                next.delete('action');
                return next;
            }, { replace: true });
        }
    }, [loading, deepLinkDocId, deepLinkAction, documents, selectedDocument, setSelectedDocument, showCreateModal, setSearchParams, loadDependencies]);

    // Cleanup Effect
    React.useEffect(() => {
        if (loading) return;

        if (!selectedDocument && deepLinkDocId) {
            setSearchParams(params => {
                const next = new URLSearchParams(params);
                next.delete('id');
                return next;
            }, { replace: true });
        }
    }, [selectedDocument, deepLinkDocId, setSearchParams, loading]);

    // Auto-open inspector on newly created document
    useEffect(() => {
        if (!pendingSelectId.current || loading) return;
        const created = documents.find(d => d.id === pendingSelectId.current);
        if (created) {
            pendingSelectId.current = null;
            setSelectedDocument(created);
            setActiveTab('documents');
        }
    }, [documents, loading, setSelectedDocument, setActiveTab]);

    // Handle Voxel/Link Navigation (Legacy/State based)
    React.useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || documents.length === 0) return;
        const doc = documents.find(d => d.id === state.voxelSelectedId);
        if (doc && selectedDocument?.id !== doc.id) {
            setSelectedDocument(doc);
        }
    }, [location.state, loading, documents, selectedDocument, setSelectedDocument]);

    // --- Metrics ---
    const totalDocs = documents.length;
    const publishedDocs = documents.filter(d => d.status === 'Publié' || d.status === 'Approuvé').length;
    // Note: Additional metrics (inReviewDocs, draftDocs, expiredDocs, validationRate) available if needed for future dashboard widgets
    void totalDocs; // Used in calculations
    void publishedDocs; // Used in calculations

    // --- Filtering ---
    const deferredFilter = useDeferredValue(filter);
    const filteredDocuments = useMemo(() => documents.filter(doc => {
        const needle = (deferredFilter || '').toLowerCase().trim();
        const matchesSearch = !needle || (doc.title || '').toLowerCase().includes(needle) ||
            (doc.type || '').toLowerCase().includes(needle) ||
            (doc.owner || '').toLowerCase().includes(needle);
        const matchesFolder = selectedFolderId === null || doc.folderId === selectedFolderId;
        const matchesCategory = categoryFilter === 'all' || doc.type === categoryFilter;
        const matchesDigitalSafe = !isDigitalSafeMode || !!doc.isSecure;

        return matchesSearch && matchesFolder && matchesCategory && matchesDigitalSafe;
    }), [documents, deferredFilter, selectedFolderId, categoryFilter, isDigitalSafeMode]);

    // --- Handlers (Moved here to access filteredDocuments) ---
    const handleDeleteFolderClick = React.useCallback(async (id: string) => {
        setConfirmData({
            isOpen: true,
            title: t('documents.deleteFolderTitle', { defaultValue: 'Supprimer le dossier' }),
            message: t('documents.deleteFolderMessage', { defaultValue: 'Voulez-vous vraiment supprimer ce dossier ? Les documents qu\'il contient seront d\u00e9plac\u00e9s \u00e0 la racine.' }),
            onConfirm: async () => {
                setConfirmData(prev => ({ ...prev, loading: true }));
                try {
                    await handleDeleteFolder(id, folders, documents, selectedFolderId, setSelectedFolderId);
                } finally {
                    setConfirmData(prev => ({ ...prev, isOpen: false, loading: false }));
                }
            },
            closeOnConfirm: false,
            loading: false
        });
    }, [handleDeleteFolder, folders, documents, selectedFolderId, setConfirmData, t]);

    const handleExportClick = React.useCallback(() => {
        handleExportCSV(filteredDocuments);
        addToast(t('documents.exportSuccess', { defaultValue: 'Documents export\u00e9s avec succ\u00e8s' }), 'success');
    }, [handleExportCSV, filteredDocuments, addToast, t]);

    const handleDigitalSafeToggle = React.useCallback(() => {
        setIsDigitalSafeMode(prev => !prev);
    }, []);

    const handleCategoryChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setCategoryFilter(e.target.value);
    }, []);

    const handleCreateClick = React.useCallback(() => {
        setShowCreateModal(true);
    }, []);

    const handleCloseInspector = React.useCallback(() => {
        setSelectedDocument(null);
    }, [setSelectedDocument]);

    const handleEditClick = React.useCallback(() => {
        setIsEditing(true);
    }, []);

    const handleDeleteDocumentClick = React.useCallback(() => {
        if (selectedDocument) initiateDelete(selectedDocument);
    }, [selectedDocument, initiateDelete]);

    const handleWorkflowActionClick = useCallback((action: WorkflowAction) => {
        if (selectedDocument) handleWorkflowAction(selectedDocument, action);
    }, [selectedDocument, handleWorkflowAction]);

    const handleCloseDrawer = React.useCallback(() => {
        setShowCreateModal(false);
        setIsEditing(false);
        setTemplateData(null);
        setIsFormDirty(false);
    }, []);

    const handleOpenTemplateModal = useCallback(() => {
        setShowTemplateModal(true);
    }, []);

    const handleTemplateSelect = useCallback((template: DocumentTemplate) => {
        setTemplateData(template);
        setShowTemplateModal(false);
        setShowCreateModal(true);
    }, []);

    const handleFormSubmit = useCallback(async (data: DocumentFormPayload) => {
        if (isEditing && selectedDocument) {
            const updated = await handleUpdate(selectedDocument.id, data, selectedDocument);
            if (updated) {
                setIsFormDirty(false);
                setIsEditing(false);
            }
        } else {
            const result = await handleCreate(data);
            if (result) {
                if (typeof result === 'string') {
                    pendingSelectId.current = result;
                }
                setIsFormDirty(false);
                setShowCreateModal(false);
            }
        }
    }, [isEditing, selectedDocument, handleUpdate, handleCreate]);

    const handleCloseSignatureModal = useCallback(() => {
        setShowSignatureModal(false);
    }, [setShowSignatureModal]);

    const handleConfirmClose = useCallback(() => {
        setConfirmData(prev => ({ ...prev, isOpen: false }));
    }, [setConfirmData]);



    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
        >
            <MasterpieceBackground />
            <SEO
                title={t('documents.title')}
                description={t('documents.subtitle')}
                keywords="Documents, Politiques, Procédures, ISO 27001"
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={handleConfirmClose}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
                loading={confirmData.loading}
                closeOnConfirm={confirmData.closeOnConfirm}
            />

            <DocumentSignature
                isOpen={showSignatureModal}
                onClose={handleCloseSignatureModal}
                onSign={handleSignatureSubmit}
                signaturePadRef={signaturePadRef}
            />

            <PageHeader
                title={t('documents.title')}
                subtitle={t('documents.subtitle')}
                icon={
                    <img
                        src="/images/referentiel.png"
                        alt="RÉFÉRENTIEL"
                        className="w-full h-full object-contain"
                    />
                }
                trustType="integrity"
                actions={canCreate && (
                    <div className="flex items-center gap-2">
                        <CustomTooltip content={t('documents.createFromTemplate', { defaultValue: 'Créer depuis un modèle' })}>
                            <Button
                                aria-label={t('documents.createFromTemplate', { defaultValue: 'Créer depuis un modèle' })}
                                onClick={handleOpenTemplateModal}
                                variant="outline"
                                className="gap-2"
                            >
                                <FileText className="h-4 w-4" />
                                {t('documents.templates', { defaultValue: 'Modèles' })}
                            </Button>
                        </CustomTooltip>
                        <CustomTooltip content={t('documents.newDocument')}>
                            <Button
                                aria-label={t('documents.newDocument')}
                                onClick={handleCreateClick}
                                className="gap-2 bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20"
                            >
                                <Plus className="h-4 w-4" />
                                {t('documents.newDocument')}
                            </Button>
                        </CustomTooltip>
                    </div>
                )}
            />

            {/* Tabs Navigation */}
            <div className="mb-6">
                <ScrollableTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={(id) => setActiveTab(id as 'overview' | 'documents')}
                    isChanging={loading}
                />
            </div>

            <AnimatePresence mode="wait">
                {/* Overview Tab - Charts Dashboard */}
                {activeTab === 'overview' && (
                    <motion.div
                        key="overview"
                        variants={slideUpVariants}
                        initial="initial"
                        animate="visible"
                        exit="exit"
                    >
                        {loading ? (
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i || 'unknown'} className="glass-premium p-6 rounded-4xl h-48 animate-pulse bg-slate-100 dark:bg-slate-800/50" />
                                ))}
                            </div>
                        ) : (
                            <DocumentsCharts documents={documents} loading={loading} />
                        )}
                    </motion.div>
                )}

                {/* Documents Tab - Folder Tree & List */}
                {activeTab === 'documents' && (
                    <motion.div
                        key="documents"
                        variants={slideUpVariants}
                        initial="initial"
                        animate="visible"
                        exit="exit"
                    >
                        <div className="flex flex-col lg:flex-row gap-6 lg:min-h-[calc(100vh-200px)] min-h-0">
                            {/* Folder Tree Sidebar */}
                            <div className="w-full lg:w-72 flex-shrink-0 glass-premium rounded-3xl border border-border/50 shadow-apple-sm overflow-hidden flex flex-col min-w-0">
                                <FolderTree
                                    folders={folders}
                                    selectedFolderId={selectedFolderId}
                                    onSelectFolder={setSelectedFolderId}
                                    onCreateFolder={handleCreateFolder}
                                    onUpdateFolder={handleUpdateFolder}
                                    onDeleteFolder={handleDeleteFolderClick}
                                />
                            </div>

                            {/* Main Content Area */}
                            <div className="flex-1 min-w-0 flex flex-col gap-6 overflow-hidden">
                                <div className="mb-6">
                                    <PremiumPageControl
                                        onViewModeChange={setViewMode}
                                        searchQuery={filter}
                                        onSearchChange={setFilter}
                                        actions={
                                            <div className="flex items-center gap-2">
                                                {/* Secondary Actions Menu */}
                                                <Menu as="div" className="relative inline-block text-left">
                                                    <Menu.Button className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                                                        <MoreVertical className="h-5 w-5" />
                                                    </Menu.Button>
                                                    <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-70 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-70 scale-100" leaveTo="transform opacity-0 scale-95">
                                                        <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-20 focus:outline-none z-dropdown">
                                                            <div className="p-1">
                                                                <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wider">{t('common.actions.title')}</div>
                                                                <Menu.Item>
                                                                    {({ active }) => (
                                                                        <button aria-label={t('documents.newDocument')} onClick={handleCreateClick} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm md:hidden`}>
                                                                            <Plus className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-brand-500'}`} /> {t('documents.newDocument')}
                                                                        </button>
                                                                    )}
                                                                </Menu.Item>
                                                                <Menu.Item>
                                                                    {({ active }) => (
                                                                        <button
                                                                            aria-label={t('documents.exportCsv')}
                                                                            onClick={handleExportClick}
                                                                            disabled={isExportingCSV}
                                                                            className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400 disabled:cursor-wait`}
                                                                        >
                                                                            <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-emerald-500'} ${isExportingCSV ? 'animate-pulse' : ''}`} />
                                                                            {isExportingCSV ? 'Export...' : t('documents.exportCsv')}
                                                                        </button>
                                                                    )}
                                                                </Menu.Item>
                                                                {canCreate && (
                                                                    <Menu.Item>
                                                                        {({ active }) => (
                                                                            <button aria-label={t('common.importCsv')} onClick={() => setCsvImportOpen(true)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                                                <Upload className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-blue-500'}`} /> {t('common.importCsv')}
                                                                            </button>
                                                                        )}
                                                                    </Menu.Item>
                                                                )}
                                                            </div>
                                                        </Menu.Items>
                                                    </Transition>
                                                </Menu>

                                                {canCreate && (
                                                    <>
                                                        <CustomTooltip content={t('documents.createFromTemplate', { defaultValue: 'Créer depuis un modèle' })}>
                                                            <Button
                                                                aria-label={t('documents.createFromTemplate', { defaultValue: 'Créer depuis un modèle' })}
                                                                onClick={handleOpenTemplateModal}
                                                                variant="outline"
                                                                className="gap-2"
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                                {t('documents.templates', { defaultValue: 'Modèles' })}
                                                            </Button>
                                                        </CustomTooltip>
                                                        <CustomTooltip content={t('documents.newDocument')}>
                                                            <Button
                                                                aria-label={t('documents.newDocument')}
                                                                onClick={handleCreateClick}
                                                                className="gap-2 bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20"
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                                {t('documents.newDocument')}
                                                            </Button>
                                                        </CustomTooltip>
                                                    </>
                                                )}
                                            </div>
                                        }
                                    >
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant={isDigitalSafeMode ? "default" : "outline"}
                                                onClick={handleDigitalSafeToggle}
                                                aria-label={isDigitalSafeMode ? t('documents.digitalSafeActive', { defaultValue: 'Coffre-fort numérique activé — cliquez pour désactiver' }) : t('documents.digitalSafeInactive', { defaultValue: 'Coffre-fort numérique désactivé — cliquez pour activer' })}
                                                aria-pressed={isDigitalSafeMode}
                                                className={`gap-2 transition-all ${isDigitalSafeMode
                                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 border-indigo-500'
                                                    : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border-slate-200 dark:border-white/10'
                                                    }`}
                                            >
                                                <Lock className={`w-4 h-4 ${isDigitalSafeMode ? 'text-white' : 'text-current'}`} />
                                                <span className="text-sm font-medium hidden sm:inline">{t('documents.digitalSafe')}</span>
                                            </Button>

                                            <select
                                                value={categoryFilter}
                                                onChange={handleCategoryChange}
                                                className="bg-slate-100 dark:bg-white/5 border-none rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus-visible:ring-brand-500"
                                                aria-label={t('documents.category.filter')}
                                            >
                                                <option value="all">{t('documents.allCategories')}</option>
                                                <option value="Politique">{t('documents.category.policy')}</option>
                                                <option value="Procédure">{t('documents.category.procedure')}</option>
                                                <option value="Preuve">{t('documents.category.evidence')}</option>
                                                <option value="Contrat">{t('documents.category.contract')}</option>
                                            </select>
                                        </div>
                                    </PremiumPageControl>
                                </div>

                                {loading ? (
                                    viewMode === 'list' ? (
                                        <ListSkeleton items={6} />
                                    ) : (
                                        <DocumentGridSkeleton count={6} />
                                    )
                                ) : filteredDocuments.length === 0 ? (
                                    <EmptyState
                                        icon={FileText}
                                        title={t('documents.emptyTitle')}
                                        description={canCreate ? t('documents.emptyDesc') : t('documents.emptyDescReadOnly', { defaultValue: 'Contactez votre administrateur pour ajouter des documents.' })}
                                        actionLabel={canCreate ? t('documents.newDocument') : undefined}
                                        onAction={canCreate ? handleCreateClick : undefined}
                                    />
                                ) : (
                                    <div
                                        className={`
                                grid gap-6 
                                ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : ''}
                                ${viewMode === 'list' ? 'grid-cols-1' : ''}
                            `}
                                    >
                                        {filteredDocuments.map(doc => (
                                            <MemoizedDocumentCard
                                                key={doc.id || 'unknown'}
                                                doc={doc}
                                                viewMode={viewMode}
                                                onSelect={setSelectedDocument}
                                                users={effectiveUsers}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Document Details Drawer (Inspector) */}
            <DocumentInspector
                isOpen={!!selectedDocument && !showSignatureModal && !isEditing}
                onClose={handleCloseInspector}
                document={selectedDocument}
                controls={controls}
                canEdit={canEditResource(user, 'Document', selectedDocument?.ownerId || selectedDocument?.owner)}
                users={effectiveUsers}
                onEdit={handleEditClick}
                onDelete={handleDeleteDocumentClick}
                onWorkflowAction={handleWorkflowActionClick}
                onSecureView={handleSecureView}
            />

            {/* Create/Edit Drawer */}
            <Drawer
                isOpen={showCreateModal || (isEditing && !!selectedDocument)}
                onClose={handleCloseDrawer}
                title={isEditing ? t('documents.editDocument', { defaultValue: 'Modifier le document' }) : templateData ? t('documents.newFromTemplate', { defaultValue: 'Nouveau document depuis un modèle' }) : t('documents.newDocument', { defaultValue: 'Nouveau document' })}
                subtitle={isEditing && selectedDocument ? selectedDocument.title : templateData ? templateData.title : t('documents.createNewDocument', { defaultValue: 'Créer un nouveau document' })}
                width="max-w-6xl"
                disableScroll={true}
                hasUnsavedChanges={isFormDirty}
            >
                <div className="h-full overflow-y-auto px-6 py-8 custom-scrollbar">
                    <DocumentForm
                        initialData={isEditing ? selectedDocument! : templateData ? {
                            id: '',
                            organizationId: user?.organizationId || '',
                            title: templateData.title,
                            type: templateData.type,
                            description: templateData.description,
                            content: templateData.content,
                            version: '1.0',
                            status: 'Brouillon',
                            owner: user?.displayName || '',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        } as Document : undefined}
                        onCancel={handleCloseDrawer}
                        onSubmit={handleFormSubmit}
                        isLoading={isSubmitting}
                        users={effectiveUsers}
                        folders={folders}
                        controls={controls}
                        assets={rawAssets}
                        audits={rawAudits}
                        risks={rawRisks}
                        onDirtyChange={setIsFormDirty}
                    />
                </div>
            </Drawer>

            <ImportGuidelinesModal
                isOpen={csvImportOpen}
                onClose={() => setCsvImportOpen(false)}
                entityName={t('sidebar.documents')}
                guidelines={documentGuidelines}
                onImport={handleImportCsvFile}
                onDownloadTemplate={handleDownloadTemplate}
            />

            <DocumentTemplateModal
                isOpen={showTemplateModal}
                onClose={() => setShowTemplateModal(false)}
                onSelect={handleTemplateSelect}
            />
        </motion.div >
    );
};

// Mini-component for rendering card (Internal)
const MemoizedDocumentCard = React.memo(({ doc, viewMode, onSelect, users }: { doc: Document; viewMode: string; onSelect: (d: Document) => void; users: UserProfile[] }) => {
    const handleClick = React.useCallback(() => onSelect(doc), [onSelect, doc]);
    const ownerUser = users.find(u => u.displayName === doc.owner || u.email === doc.owner);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick();
                }
            }}
            className={`glass-premium p-5 rounded-3xl border border-border/40 hover:border-brand-400 hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden flex flex-col gap-4 shadow-sm hover:shadow-apple-sm ${viewMode === 'list' ? 'flex-row items-center border-l-4' : ''}`}
        >
            <div className="flex-1">
                <h4 className="text-base font-black text-slate-900 dark:text-white truncate tracking-tight">{doc.title}</h4>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">{doc.type}</span>
                    <span className="text-slate-300 dark:text-slate-300">•</span>
                    <span className="text-xs font-bold text-muted-foreground">v{doc.version}</span>
                    <span className="text-slate-300 dark:text-slate-300">•</span>
                    <div className="flex items-center gap-2 min-w-0">
                        <img
                            src={getUserAvatarUrl(ownerUser?.photoURL, ownerUser?.role)}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover bg-slate-100 dark:bg-slate-800 flex-shrink-0 ring-1 ring-border/50"
                        />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-300 truncate">{doc.owner}</span>
                    </div>
                </div>
            </div>
            <div className="shrink-0 flex items-center">
                <span className={`px-4 py-1.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm border ${doc.status === 'Publié' || doc.status === 'Approuvé' ? 'bg-success-bg text-success-text border-success-border/30' :
                    doc.status === 'En revue' ? 'bg-warning-bg text-warning-text border-warning-border/30' : 'bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-700'
                    }`}>
                    {doc.status}
                </span>
            </div>
        </div>
    );
});

// Headless UI handles FocusTrap and keyboard navigation
