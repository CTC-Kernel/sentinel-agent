import React, { useDeferredValue, useMemo, useState } from 'react';
import { SEO } from '../components/SEO';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { useLocation } from 'react-router-dom';
import { Document } from '../types';
import { canEditResource } from '../utils/permissions';
import { Plus, Bell, FileText, History, Edit, CheckCircle2 } from '../components/ui/Icons';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { useStore } from '../store';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { Drawer } from '../components/ui/Drawer';
import { PageHeader } from '../components/ui/PageHeader';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { DocumentForm } from '../components/documents/DocumentForm';
import { FolderTree } from '../components/documents/FolderTree';
import { DocumentInspector } from '../components/documents/DocumentInspector';
import { DocumentSignature } from '../components/documents/DocumentSignature';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { useDocumentWorkflow } from '../hooks/documents/useDocumentWorkflow';
import { useDocumentActions } from '../hooks/documents/useDocumentActions';
import { useDocumentsData } from '../hooks/documents/useDocumentsData';

export const Documents: React.FC = () => {
    const { user, t } = useStore();
    const location = useLocation();
    const canCreate = canEditResource(user, 'Document');

    // --- Data Fetching ---
    const {
        documents,
        usersList,
        controls,
        folders,
        rawAssets,
        rawAudits,
        rawRisks,
        loading
    } = useDocumentsData(user?.organizationId);

    // FIX: Ensure usersList is never empty if logged in
    const effectiveUsers = useMemo(() => {
        if (usersList && usersList.length > 0) return usersList;
        if (user && user.uid) return [user];
        return [];
    }, [usersList, user]);

    // --- State ---
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filter, setFilter] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'matrix' | 'kanban'>('grid');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [isDigitalSafeMode, setIsDigitalSafeMode] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

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
        isSubmitting,
        isExportingCSV,
        confirmData,
        setConfirmData
    } = useDocumentActions(effectiveUsers);

    // --- Effects ---
    // Handle Voxel/Link Navigation
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
    const inReviewDocs = documents.filter(d => d.status === 'En revue').length;
    const draftDocs = documents.filter(d => d.status === 'Brouillon').length;
    const expiredDocs = documents.filter(d => d.nextReviewDate && new Date(d.nextReviewDate) < new Date()).length;
    const validationRate = totalDocs > 0 ? (publishedDocs / totalDocs) * 100 : 0;

    // --- Filtering ---
    const deferredFilter = useDeferredValue(filter);
    const filteredDocuments = useMemo(() => documents.filter(doc => {
        const needle = (deferredFilter || '').toLowerCase().trim();
        const matchesSearch = !needle || doc.title.toLowerCase().includes(needle) ||
            doc.type.toLowerCase().includes(needle) ||
            doc.owner.toLowerCase().includes(needle);
        const matchesFolder = selectedFolderId === null || doc.folderId === selectedFolderId;
        const matchesCategory = categoryFilter === 'all' || doc.type === categoryFilter;
        const matchesDigitalSafe = !isDigitalSafeMode || !!doc.isSecure;

        return matchesSearch && matchesFolder && matchesCategory && matchesDigitalSafe;
    }), [documents, deferredFilter, selectedFolderId, categoryFilter, isDigitalSafeMode]);

    // --- Handlers (Moved here to access filteredDocuments) ---
    const handleDeleteFolderClick = React.useCallback(async (id: string) => {
        await handleDeleteFolder(id, folders, documents, selectedFolderId, setSelectedFolderId);
    }, [handleDeleteFolder, folders, documents, selectedFolderId]);

    const handleExportClick = React.useCallback(() => {
        handleExportCSV(filteredDocuments);
    }, [handleExportCSV, filteredDocuments]);

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
        if (selectedDocument) initiateDelete(selectedDocument, controls);
    }, [selectedDocument, initiateDelete, controls]);

    const handleWorkflowActionClick = React.useCallback((action: any) => {
        if (selectedDocument) handleWorkflowAction(selectedDocument, action);
    }, [selectedDocument, handleWorkflowAction]);

    const handleCloseDrawer = React.useCallback(() => {
        setShowCreateModal(false);
        setIsEditing(false);
    }, []);

    const handleFormSubmit = React.useCallback(async (data: any) => {
        if (isEditing && selectedDocument) {
            const updated = await handleUpdate(selectedDocument.id, data, selectedDocument);
            if (updated) setIsEditing(false);
        } else {
            const success = await handleCreate(data);
            if (success) setShowCreateModal(false);
        }
    }, [isEditing, selectedDocument, handleUpdate, handleCreate]);

    const handleCloseSignatureModal = React.useCallback(() => {
        setShowSignatureModal(false);
    }, [setShowSignatureModal]);


    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO
                title={t('documents.title')}
                description={t('documents.subtitle')}
                keywords="Documents, Politiques, Procédures, ISO 27001"
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={React.useCallback(() => setConfirmData(prev => ({ ...prev, isOpen: false })), [setConfirmData])}
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
                breadcrumbs={[
                    { label: t('sidebar.documents') }
                ]}
                icon={<FileText className="h-6 w-6 text-white" strokeWidth={2.5} />}
                trustType="storage"
                actions={canCreate && (
                    <CustomTooltip content={t('documents.newDocument')}>
                        <button
                            aria-label={t('documents.newDocument')}
                            onClick={handleCreateClick}
                            className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                        >
                            <Plus className="h-4 w-4 mr-2" /> {t('documents.newDocument')}
                        </button>
                    </CustomTooltip>
                )}
            />

            {/* Metrics Dashboard */}
            <motion.div variants={slideUpVariants} className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative group min-w-0">
                <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none transition-opacity group-hover:opacity-70"></div>
                </div>

                {/* Score */}
                <div className="flex items-center gap-6 relative z-10">
                    <div className="relative">
                        <svg className="w-24 h-24 transform -rotate-90" style={{ overflow: 'visible' }}>
                            <circle className="text-slate-100 dark:text-slate-800" strokeWidth="8" stroke="currentColor" fill="transparent" r="44" cx="48" cy="48" />
                            <circle
                                className={`${validationRate >= 80 ? 'text-emerald-500' : validationRate >= 50 ? 'text-blue-500' : 'text-amber-500'} transition-all duration-1000 ease-out`}
                                strokeWidth="8"
                                strokeDasharray={276}
                                strokeDashoffset={276 - (276 * validationRate) / 100}
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="transparent"
                                r="44"
                                cx="48"
                                cy="48"
                            />
                        </svg>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-xl font-black text-slate-900 dark:text-white">{Math.round(validationRate)}%</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('documents.validated')}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-[200px]">
                            {t('documents.validatedDesc')}
                        </p>
                    </div>
                </div>

                {/* Stat Counters */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:border-l sm:border-r border-slate-200 dark:border-white/10 sm:px-6 sm:mx-2">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('documents.total')}</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{totalDocs}</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <CheckCircle2 className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('documents.published')}</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{publishedDocs}</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Edit className="h-4 w-4 text-slate-500" />
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('documents.drafts')}</div>
                        </div>
                        <div className="text-xl font-black text-slate-900 dark:text-white">{draftDocs}</div>
                    </div>
                </div>

                {/* Alerts */}
                <div className="flex flex-col gap-3 w-full md:min-w-[180px]">
                    <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                        <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">{t('documents.inReview')}</span>
                        </div>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-400">{inReviewDocs}</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/30">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-red-600 dark:text-red-400" />
                            <span className="text-xs font-bold text-red-700 dark:text-red-300">{t('documents.expired')}</span>
                        </div>
                        <span className="text-sm font-black text-red-700 dark:text-red-400">{expiredDocs}</span>
                    </div>
                </div>
            </motion.div>

            <div className="flex flex-col lg:flex-row gap-6 lg:min-h-[calc(100vh-200px)] min-h-0">
                {/* Folder Tree Sidebar */}
                <div className="w-full lg:w-64 flex-shrink-0 glass-panel rounded-2xl border border-white/50 dark:border-white/5 shadow-sm overflow-hidden flex flex-col min-w-0">
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
                                <button
                                    aria-label={t('documents.exportCsv')}
                                    onClick={handleExportClick}
                                    className="p-2 text-slate-500 hover:text-brand-600 transition-colors"
                                    title={t('documents.exportCsv')}
                                >
                                    {isExportingCSV ? (
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
                                    ) : (
                                        <FileText className="h-5 w-5" />
                                    )}
                                </button>
                            }
                        >
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-transparent hover:border-brand-200 transition-all">
                                    <input
                                        aria-label={t('documents.digitalSafe')}
                                        type="checkbox"
                                        checked={isDigitalSafeMode}
                                        onChange={handleDigitalSafeToggle}
                                        className="rounded text-brand-600 focus:ring-brand-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('documents.digitalSafe')}</span>
                                </label>

                                <select
                                    value={categoryFilter}
                                    onChange={handleCategoryChange}
                                    className="bg-slate-100 dark:bg-white/5 border-none rounded-lg text-sm px-3 py-1.5 focus:ring-2 focus:ring-brand-500"
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

                    {filteredDocuments.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title={t('documents.emptyTitle')}
                            description={t('documents.emptyDesc')}
                            actionLabel={t('documents.newDocument')}
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
                                    key={doc.id}
                                    doc={doc}
                                    viewMode={viewMode}
                                    onSelect={setSelectedDocument}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

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
                title={isEditing ? "Modifier le document" : "Nouveau Document"}
                subtitle={isEditing && selectedDocument ? selectedDocument.title : "Créer un nouveau document"}
                width="max-w-4xl"
                disableScroll={true}
            >
                <div className="h-full overflow-y-auto px-6 py-8 custom-scrollbar">
                    <DocumentForm
                        initialData={isEditing ? selectedDocument! : undefined}
                        onCancel={handleCloseDrawer}
                        onSubmit={handleFormSubmit}
                        isLoading={isSubmitting}
                        users={effectiveUsers}
                        folders={folders}
                        controls={controls}
                        assets={rawAssets}
                        audits={rawAudits}
                        risks={rawRisks}
                    />
                </div>
            </Drawer>
        </motion.div>
    );
};

// Mini-component for rendering card (Internal)
// Mini-component for rendering card (Internal)
const MemoizedDocumentCard = React.memo(({ doc, viewMode, onSelect }: { doc: Document; viewMode: string; onSelect: (d: Document) => void }) => {
    const handleClick = React.useCallback(() => onSelect(doc), [onSelect, doc]);

    return (
        <div
            onClick={handleClick}
            className={`glass-panel p-4 rounded-xl border border-white/50 dark:border-white/5 hover:border-brand-500/50 transition-all cursor-pointer group relative overflow-hidden flex flex-col gap-3 ${viewMode === 'list' ? 'flex-row items-center' : ''}`}
        >
            <div className="flex-1">
                <h4 className="font-bold text-slate-800 dark:text-white truncate">{doc.title}</h4>
                <p className="text-sm text-slate-500 truncate">{doc.type} • v{doc.version}</p>
            </div>
            <div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${doc.status === 'Publié' || doc.status === 'Approuvé' ? 'bg-emerald-100 text-emerald-800' :
                    doc.status === 'En revue' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                    {doc.status}
                </span>
            </div>
        </div>
    );
});
