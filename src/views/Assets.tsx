import React, { useDeferredValue, useMemo, useState } from 'react';
import { cn } from '../lib/utils';
import { useSearchParams } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { motion } from 'framer-motion';
import { Asset, Criticality } from '../types';
import { canEditResource } from '../utils/permissions';
import { toast } from '@/lib/toast';
import { AssetFormData } from '../schemas/assetSchema';
import { AdvancedSearch, SearchFilters } from '../components/ui/AdvancedSearch';
import { useStore } from '../store';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Button } from '../components/ui/button';
import { Pagination } from '../components/ui/Pagination';
import { usePagination } from '../hooks/utils/usePagination';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { PageHeader } from '../components/ui/PageHeader';
import { AssetList } from '../components/assets/AssetList';
import { AssetInspector } from '../components/assets/AssetInspector';
import { AssetDashboard } from '../components/assets/AssetDashboard';
import { useAssetLogic } from '../hooks/assets/useAssetLogic';
import { useAuth } from '../hooks/useAuth';
import { useAssetDependencies } from '../hooks/assets/useAssetDependencies';
import { FileSpreadsheet, Link, Plus, Filter, HelpCircle, BrainCircuit, MoreVertical, List, LayoutGrid, Upload, LayoutDashboard } from '../components/ui/Icons';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { CsvParser } from '../utils/csvUtils';
import { OnboardingService } from '../services/onboardingService';
import { ImportService } from '../services/ImportService';
import { aiService } from '../services/aiService';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { usePersistedState } from '../hooks/usePersistedState';
import { Menu, Transition } from '@headlessui/react';
import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { AnimatePresence } from 'framer-motion';

const Assets: React.FC = () => {
    const { user, t } = useStore();
    const { claimsSynced, loading: authLoading } = useAuth();
    const canEdit = canEditResource(user, 'Asset');
    // UI State
    const [activeTab, setActiveTab] = usePersistedState<string>('assets-active-tab', 'overview');
    const [viewMode, setViewMode] = usePersistedState<'grid' | 'list' | 'matrix' | 'kanban'>('assets-view-mode', 'grid');
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [activeFilters, setActiveFilters] = useState<SearchFilters>({ query: '', type: 'all' });
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);

    // Dependencies and Loading Logic...
    // (Preserve existing lines 48-58)
    const { assets, loading: assetsLoading, createAsset, updateAsset, deleteAsset, bulkDeleteAssets, checkDependencies } = useAssetLogic(claimsSynced);
    const shouldLoadDependencies = inspectorOpen || importModalOpen;
    const { usersList, suppliers, processes, loading: depsLoading } = useAssetDependencies({
        fetchUsers: (shouldLoadDependencies || viewMode === 'list') && claimsSynced,
        fetchSuppliers: shouldLoadDependencies && claimsSynced,
        fetchProcesses: shouldLoadDependencies && claimsSynced
    });
    const loading = authLoading || !claimsSynced || assetsLoading || (shouldLoadDependencies && depsLoading);
    const { limits } = usePlanLimits();
    const reachedAssetLimit = assets.length >= limits.maxAssets;

    // ... (Keep existing effects lines 63-130)

    // Start module tour
    React.useEffect(() => {
        const timer = setTimeout(() => {
            OnboardingService.startAssetsTour();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    // URL Params for Deep Linking
    const [searchParams, setSearchParams] = useSearchParams();
    const deepLinkAssetId = searchParams.get('id');
    const deepLinkAction = searchParams.get('action');

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [assetToDelete, setAssetToDelete] = useState<{ id: string, name: string } | null>(null);
    const [dependencies, setDependencies] = useState<{ id: string; name: string; type: string }[]>([]);

    // Deep Linking Effect
    React.useEffect(() => {
        if (loading) return;

        if (deepLinkAssetId && assets.length > 0) {
            const asset = assets.find(a => a.id === deepLinkAssetId);
            if (asset) {
                setSelectedAsset(asset);
                setInspectorOpen(true);
                setActiveTab('assets');
            }
        } else if (deepLinkAction === 'create') {
            setSelectedAsset(null);
            setInspectorOpen(true);
            setActiveTab('assets');
            // Consume action immediately
            setSearchParams(params => {
                params.delete('action');
                return params;
            }, { replace: true });
        }
    }, [loading, deepLinkAssetId, assets, deepLinkAction, setSearchParams, setActiveTab]);

    // Cleanup Effect
    React.useEffect(() => {
        if (loading) return;
        if (!inspectorOpen && deepLinkAssetId) {
            setSearchParams(params => {
                params.delete('id');
                return params;
            }, { replace: true });
        }
    }, [inspectorOpen, deepLinkAssetId, setSearchParams, loading]);

    // Filtering Logic
    const deferredQuery = useDeferredValue(activeFilters.query);
    const filteredAssets = useMemo(() => assets.filter(a => {
        const needle = (deferredQuery || '').toLowerCase().trim();
        const matchesQuery = !needle || (a.name.toLowerCase().includes(needle) ||
            a.type.toLowerCase().includes(needle) ||
            a.owner.toLowerCase().includes(needle));

        const matchesStatus = !activeFilters.status || a.lifecycleStatus === activeFilters.status;
        const matchesOwner = !activeFilters.owner || a.owner === activeFilters.owner;
        const matchesCriticality = !activeFilters.criticality || a.confidentiality === activeFilters.criticality; // Using confidentiality as proxy for criticality level in filters for simplicity, adjust if needed
        const matchesType = !activeFilters.type || activeFilters.type === 'all' || a.type === (activeFilters.type as unknown);

        return matchesQuery && matchesStatus && matchesOwner && matchesCriticality && matchesType;
    }), [assets, deferredQuery, activeFilters]);

    // Pagination
    const { currentPage, paginatedItems, setCurrentPage, setItemsPerPage, totalItems, itemsPerPage } = usePagination(filteredAssets, 20);

    // Handlers
    const handleOpenInspector = React.useCallback((asset?: Asset) => {
        if (!asset && reachedAssetLimit) {
            toast.info(t('assets.limitReached', { count: assets.length, max: limits.maxAssets }).split(':')[0], t('assets.contactSupport'));
            return;
        }
        setSelectedAsset(asset || null);
        setInspectorOpen(true);
    }, [reachedAssetLimit, assets.length, limits.maxAssets, t]);

    const handleCreateNew = React.useCallback(() => {
        setActiveTab('assets');
        handleOpenInspector(undefined);
    }, [handleOpenInspector, setActiveTab]);

    const handleCloseInspector = React.useCallback(() => {
        setInspectorOpen(false);
        setSelectedAsset(null);
    }, []);

    const handleDeleteClick = React.useCallback(async (id: string, name: string) => {
        const depCheck = await checkDependencies(id);
        if (depCheck.hasDependencies) {
            setDependencies((depCheck.dependencies || []) as { id: string; name: string; type: string }[]);
        } else {
            setDependencies([]);
        }
        setAssetToDelete({ id, name });
        setDeleteModalOpen(true);
    }, [checkDependencies]);

    const handleConfirmDelete = React.useCallback(async () => {
        if (assetToDelete) {
            const result = await deleteAsset(assetToDelete.id, assetToDelete.name);
            if (result.success) {
                toast.success(t('assets.deleteSuccess', { name: assetToDelete.name }));
            } else {
                toast.error(t('assets.deleteError'));
            }
            setDeleteModalOpen(false);
            setAssetToDelete(null);
            setDependencies([]);
        }
    }, [assetToDelete, deleteAsset, t]);

    const handleCloseDeleteModal = React.useCallback(() => setDeleteModalOpen(false), []);

    const handleGenerateKioskLink = React.useCallback(() => {
        const url = `${window.location.origin}/intake`;
        navigator.clipboard.writeText(url);
        toast.success(t('assets.kioskCopied'), t('assets.kioskCopiedDesc'));
    }, [t]);

    const handleExportCSV = React.useCallback(() => {
        const csvHeaders = (t('assets.csvHeaders', { returnObjects: true }) as unknown as string[]) || ['Name', 'Type', 'Status', 'Criticality', 'Owner', 'Location', 'Value', 'Warranty End'];

        const data = filteredAssets.map(a => ({
            [csvHeaders[0]]: a.name,
            [csvHeaders[1]]: a.type,
            [csvHeaders[2]]: a.lifecycleStatus || '',
            [csvHeaders[3]]: a.confidentiality,
            [csvHeaders[4]]: a.owner,
            [csvHeaders[5]]: a.location || '',
            [csvHeaders[6]]: a.purchasePrice || '',
            [csvHeaders[7]]: a.warrantyEnd || ''
        }));

        CsvParser.downloadCSV(csvHeaders, data, `${t('assets.filename', { date: new Date().toISOString().split('T')[0] })}.csv`);
    }, [filteredAssets, t]);

    const handleAnalyze = React.useCallback(async () => {
        setIsAnalyzing(true);
        try {
            // Serialize a subset of asset data to avoid huge payloads, but enough for analysis
            const assetsData = filteredAssets.map(a => ({
                name: a.name,
                type: a.type,
                criticality: a.confidentiality,
                status: a.lifecycleStatus,
                owner: a.owner
            }));

            const prompt = `${t('assets.aiPrompt', { count: filteredAssets.length })}\n\nDATA:\n${JSON.stringify(assetsData)}`;
            const analysis = await aiService.chatWithAI(prompt);
            toast.info(t('assets.analysisComplete'), analysis);
        } catch {
            toast.error(t('assets.analysisError'));
        } finally {
            setIsAnalyzing(false);
        }
    }, [filteredAssets, t]);

    const handleGenerateLabel = React.useCallback(async (asset: Asset) => {
        const { PdfService } = await import('../services/PdfService');
        try {
            PdfService.generateAssetLabel(
                { name: asset.name, id: asset.id, owner: asset.owner, type: asset.type },
                { organizationName: limits.features.whiteLabelReports ? user?.displayName || 'Sentinel' : 'Sentinel GRC' }
            );
            toast.success(t('assets.labelGenerated'));
        } catch {
            toast.error(t('assets.labelError'));
        }
    }, [limits.features.whiteLabelReports, user, t]);

    // Extra UI Handlers
    const handleSearch = React.useCallback((filters: SearchFilters) => {
        setActiveFilters(filters);
        setShowAdvancedSearch(false);
    }, []);
    const handleCloseSearch = React.useCallback(() => setShowAdvancedSearch(false), []);
    const handleToggleSearch = React.useCallback(() => setShowAdvancedSearch(prev => !prev), []);
    const handleSearchQueryChange = React.useCallback((q: string) => setActiveFilters(prev => ({ ...prev, query: q })), []);
    const handleViewModeChange = React.useCallback((mode: string) => setViewMode(mode as 'grid' | 'list' | 'matrix' | 'kanban'), [setViewMode]);
    const handleStartTour = React.useCallback(() => OnboardingService.startAssetsTour(), []);
    const handleFilterChange = React.useCallback((filter: { type: string; value: string } | null) => {
        if (filter?.type === 'criticality') {
            setActiveFilters(prev => ({ ...prev, criticality: filter.value as Criticality }));
        } else if (filter === null) {
            setActiveFilters(prev => ({ ...prev, criticality: undefined }));
        }
    }, []);

    // CRUD Handlers for Inspector
    const handleUpdateAsset = React.useCallback(async (id: string, data: Partial<Asset>) => {
        const result = await updateAsset(id, data as unknown as AssetFormData);
        if (result.success) {
            toast.success(t('assets.updateSuccess'));
            return true;
        } else {
            toast.error(t('assets.updateError'));
            return false;
        }
    }, [updateAsset, t]);

    // Create wrapper
    const handleCreateAsset = React.useCallback(async (data: AssetFormData) => {
        const result = await createAsset(data, null);
        if (result.success) {
            toast.success(t('assets.createSuccess'));
            return result.id || true;
        } else if (result.error === 'LIMIT_REACHED') {
            toast.error(t('assets.limitReachedError')); // "Upgrade plan..."
            return false;
        } else {
            toast.error(t('assets.createError'));
            return false;
        }
    }, [createAsset, t]);

    // Import Handlers
    const assetGuidelines = useMemo(() => ({
        required: [
            t('common.columns.name'),
            t('common.columns.type'),
            t('common.columns.owner'),
            t('common.columns.confidentiality')
        ],
        optional: [
            t('common.columns.notes'),
            t('common.columns.availability'),
            t('common.columns.integrity'),
            t('common.columns.lifecycleStatus'),
            t('common.columns.location'),
            t('common.columns.purchasePrice'),
            t('common.columns.purchaseDate'),
            t('common.columns.warrantyEnd')
        ],
        format: 'CSV'
    }), [t]);

    const handleImportAssets = React.useCallback(async (file: File) => {
        const text = await file.text();
        const { data, errors } = ImportService.parseAssets(text, user?.displayName || 'Unknown');
        let successCount = 0;
        // Process sequentially to avoid overwhelming Firestore
        for (const assetData of data) {
            await createAsset(assetData, null);
            successCount++;
        }
        if (successCount > 0) {
            toast.success(t('common.import.summary', { count: successCount, total: data.length + errors.length }));
        }
        if (errors.length > 0) {
            toast.warning(t('common.import.partialErrors'), `${errors.length} erreurs: ` + errors.slice(0, 3).join(', ') + (errors.length > 3 ? '...' : ''));
        }
        if (successCount === 0 && errors.length === 0) {
            toast.warning(t('common.import.noData'));
        }
    }, [createAsset, user, t]);

    const handleDownloadTemplate = React.useCallback(() => {
        ImportService.downloadAssetTemplate(t);
    }, [t]);

    const tabs = [
        { id: 'overview', label: t('common.overview'), icon: LayoutDashboard },
        { id: 'assets', label: t('assets.title'), icon: List, count: assets.length }
    ];

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
        >
            <MasterpieceBackground />
            <SEO title={t('assets.title')} description={t('assets.description')} />

            <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10">
                {/* Header */}
                <motion.div variants={slideUpVariants}>
                    <PageHeader
                        title={t('assets.title')}
                        subtitle={t('assets.description')}
                        icon={
                            <img
                                src="/images/referentiel.png"
                                alt="RÉFÉRENTIEL"
                                className="w-full h-full object-contain"
                            />
                        }
                        trustType="integrity"
                    />
                </motion.div>

                <motion.div variants={slideUpVariants}>
                    <ScrollableTabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        className="mb-6"
                    />
                </motion.div>

                <AnimatePresence mode="wait">
                    {activeTab === 'overview' ? (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {reachedAssetLimit && (
                                <div className="mb-4 rounded-3xl border border-warning/30 bg-warning/10 text-warning px-4 py-3 text-sm font-semibold flex items-center justify-between backdrop-blur-md shadow-lg shadow-warning/10">
                                    <span>{t('assets.limitReached', { count: assets.length, max: limits.maxAssets })}</span>
                                    <Button
                                        variant="link"
                                        aria-label={t('assets.upgradePlan')}
                                        onClick={() => toast.info(t('assets.contactSupport'))}
                                        className="text-foreground underline font-bold"
                                    >
                                        {t('assets.upgradePlan')}
                                    </Button>
                                </div>
                            )}
                            <AssetDashboard
                                assets={filteredAssets}
                                onFilterChange={handleFilterChange}
                                loading={loading}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="assets"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Search & List */}
                            <div className="space-y-6">
                                {showAdvancedSearch && (
                                    <AdvancedSearch
                                        onSearch={handleSearch}
                                        onClose={handleCloseSearch}
                                    />
                                )}

                                <PremiumPageControl
                                    searchQuery={activeFilters.query || ''}
                                    onSearchChange={handleSearchQueryChange}
                                    searchPlaceholder={t('assets.searchPlaceholder')}
                                    activeView={viewMode}
                                    onViewChange={handleViewModeChange}
                                    viewOptions={[
                                        { id: 'list', label: t('assets.viewList'), icon: List },
                                        { id: 'grid', label: t('assets.viewGrid'), icon: LayoutGrid }
                                    ]}
                                    actions={
                                        <>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={handleStartTour}
                                                className="p-2.5 rounded-xl bg-background text-muted-foreground border border-border hover:bg-muted/50 transition-all shadow-sm"
                                                title={t('assets.startTour')}
                                            >
                                                <HelpCircle className="h-5 w-5" />
                                            </Button>
                                            <div className="h-6 w-px bg-border mx-1" />
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={handleToggleSearch}
                                                className={cn(
                                                    "p-2.5 rounded-xl transition-all border shadow-sm",
                                                    showAdvancedSearch
                                                        ? "bg-primary/10 text-primary border-primary/20"
                                                        : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                                                )}
                                                title={t('assets.advancedFilters')}
                                            >
                                                <Filter className="h-5 w-5" />
                                            </Button>
                                            <div className="h-6 w-px bg-border mx-1" />

                                            {canEdit && (
                                                <CustomTooltip content={t('assets.createAsset')}>
                                                    <Button
                                                        aria-label={t('assets.aiAnalysis')}
                                                        onClick={handleAnalyze}
                                                        disabled={isAnalyzing}
                                                        isLoading={isAnalyzing}
                                                        className="hidden lg:flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {!isAnalyzing && <BrainCircuit className="h-4 w-4 mr-2" />}
                                                        <span className="hidden xl:inline">{isAnalyzing ? t('assets.analyzing') : t('assets.aiAnalysis')}</span>
                                                    </Button>
                                                </CustomTooltip>
                                            )}

                                            {canEdit && (
                                                <CustomTooltip content={t('assets.createAsset')}>
                                                    <Button
                                                        aria-label={t('assets.newAsset')}
                                                        data-tour="assets-add"
                                                        onClick={handleCreateNew}
                                                        disabled={reachedAssetLimit}
                                                        className={cn(
                                                            "flex items-center px-4 py-2 text-sm font-bold rounded-xl transition-all shadow-lg shadow-primary/20",
                                                            reachedAssetLimit ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90"
                                                        )}
                                                    >
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        <span className="hidden sm:inline">{t('assets.newAsset')}</span>
                                                        <span className="sm:hidden">{t('assets.new')}</span>
                                                    </Button>
                                                </CustomTooltip>
                                            )}

                                            <div className="h-6 w-px bg-border mx-1" />

                                            <Menu as="div" className="relative inline-block text-left">
                                                <Menu.Button className="p-2 bg-background border border-border text-foreground rounded-xl hover:bg-muted/50 transition-colors shadow-sm">
                                                    <MoreVertical className="h-5 w-5" />
                                                </Menu.Button>
                                                <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-70 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-70 scale-100" leaveTo="transform opacity-0 scale-95">
                                                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-border/50 rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-black ring-opacity-20 focus:outline-none z-50">
                                                        <div className="p-1">
                                                            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('assets.tools')}</div>
                                                            {canEdit && (
                                                                <Menu.Item>
                                                                    {({ active }) => (
                                                                        <Button
                                                                            variant="ghost"
                                                                            aria-label={t('assets.importCsv')}
                                                                            onClick={() => setImportModalOpen(true)}
                                                                            className={cn(
                                                                                "group flex w-full items-center rounded-lg px-2 py-2 text-sm",
                                                                                active ? "bg-primary text-primary-foreground" : "text-foreground"
                                                                            )}
                                                                        >
                                                                            <Upload className={cn("mr-2 h-4 w-4", active ? "text-primary-foreground" : "text-primary")} />
                                                                            {t('assets.importCsv')}
                                                                        </Button>
                                                                    )}
                                                                </Menu.Item>
                                                            )}
                                                            <Menu.Item>
                                                                {({ active }) => (
                                                                    <Button
                                                                        variant="ghost"
                                                                        aria-label={t('assets.exportCsv')}
                                                                        data-tour="assets-export"
                                                                        onClick={handleExportCSV}
                                                                        className={`${active ? 'bg-primary text-primary-foreground' : 'text-foreground'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                                    >
                                                                        <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-primary-foreground' : 'text-success'}`} />
                                                                        {t('assets.exportCsv')}
                                                                    </Button>
                                                                )}
                                                            </Menu.Item>
                                                            <Menu.Item>
                                                                {({ active }) => (
                                                                    <Button
                                                                        variant="ghost"
                                                                        aria-label={t('assets.kioskLink')}
                                                                        onClick={handleGenerateKioskLink}
                                                                        className={`${active ? 'bg-primary text-primary-foreground' : 'text-foreground'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                                    >
                                                                        <Link className={`mr-2 h-4 w-4 ${active ? 'text-primary-foreground' : 'text-primary'}`} />
                                                                        {t('assets.kioskLink')}
                                                                    </Button>
                                                                )}
                                                            </Menu.Item>
                                                        </div>
                                                    </Menu.Items>
                                                </Transition>
                                            </Menu>
                                        </>
                                    }
                                />

                                <div data-tour="assets-list">
                                    <AssetList
                                        assets={paginatedItems}
                                        loading={loading}
                                        viewMode={viewMode}
                                        user={user}
                                        canEdit={canEdit}
                                        onEdit={handleOpenInspector}
                                        onDelete={handleDeleteClick}
                                        onGenerateLabel={handleGenerateLabel}
                                        isGeneratingLabels={false}
                                        activeFiltersQuery={activeFilters.query}
                                        onBulkDelete={bulkDeleteAssets}
                                        users={usersList}
                                    />
                                </div>

                                <Pagination
                                    currentPage={currentPage}
                                    totalItems={totalItems}
                                    itemsPerPage={itemsPerPage}
                                    onPageChange={setCurrentPage}
                                    onItemsPerPageChange={setItemsPerPage}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Inspector Drawer */}
                <AssetInspector
                    isOpen={inspectorOpen}
                    onClose={handleCloseInspector}
                    selectedAsset={selectedAsset}
                    onUpdate={handleUpdateAsset}
                    onCreate={handleCreateAsset}
                    users={usersList}
                    suppliers={suppliers}
                    processes={processes}
                    canEdit={canEdit}
                    onDelete={handleDeleteClick}
                />

                {/* Import Modal */}
                <ImportGuidelinesModal
                    isOpen={importModalOpen}
                    onClose={() => setImportModalOpen(false)}
                    entityName={t('assets.title')}
                    guidelines={assetGuidelines}
                    onImport={handleImportAssets}
                    onDownloadTemplate={handleDownloadTemplate}
                />

                {/* Delete Confirmation */}
                <ConfirmModal
                    isOpen={deleteModalOpen}
                    onClose={handleCloseDeleteModal}
                    onConfirm={handleConfirmDelete}
                    title={t('assets.deleteTitle')}
                    message={
                        dependencies.length > 0
                            ? t('assets.deleteWarning', { count: dependencies.length, example: dependencies[0].name })
                            : t('assets.deleteConfirm', { name: assetToDelete?.name })
                    }
                    confirmText={t('assets.delete')}
                    cancelText={t('assets.cancel')}

                />
            </div >
        </motion.div >
    );
};

export default Assets;

// Headless UI handles FocusTrap and keyboard navigation
