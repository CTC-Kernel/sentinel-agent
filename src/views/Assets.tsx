import React, { useDeferredValue, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { motion } from 'framer-motion';
import { Asset, Criticality } from '../types';
import { canEditResource } from '../utils/permissions';
import { toast } from 'sonner';
import { AdvancedSearch, SearchFilters } from '../components/ui/AdvancedSearch';
import { useStore } from '../store';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Pagination } from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { PageHeader } from '../components/ui/PageHeader';
import { AssetList } from '../components/assets/AssetList';
import { AssetInspector } from '../components/assets/AssetInspector';
import { AssetDashboard } from '../components/assets/AssetDashboard';
import { useAssets } from '../hooks/assets/useAssets';
import { Database, FileSpreadsheet, Link, Plus, Filter, HelpCircle } from 'lucide-react';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { CsvParser } from '../utils/csvUtils';
import { OnboardingService } from '../services/onboardingService';

const Assets: React.FC = () => {
    const { user } = useStore();
    const canEdit = canEditResource(user, 'Asset');
    const { assets, loading, createAsset, updateAsset, deleteAsset, bulkDeleteAssets, usersList, suppliers, processes, checkDependencies } = useAssets();
    const { limits } = usePlanLimits();
    const reachedAssetLimit = assets.length >= limits.maxAssets;

    // UI State
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'matrix' | 'kanban'>('grid');
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [activeFilters, setActiveFilters] = useState<SearchFilters>({ query: '', type: 'all' });
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

    // URL Params for Deep Linking
    const [searchParams] = useSearchParams();
    const deepLinkAssetId = searchParams.get('id');

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [assetToDelete, setAssetToDelete] = useState<{ id: string, name: string } | null>(null);

    // Deep Linking Effect
    React.useEffect(() => {
        if (!loading && deepLinkAssetId && assets.length > 0) {
            const asset = assets.find(a => a.id === deepLinkAssetId);
            if (asset) {
                setSelectedAsset(asset);
                setInspectorOpen(true);
            }
            // Optional: Clean URL after opening? Or keep it to allow sharing?
            // Keep it for "Masterpiece" feel (refresh stays on item).
        }
    }, [loading, deepLinkAssetId, assets]);

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
    const handleOpenInspector = (asset?: Asset) => {
        if (!asset && reachedAssetLimit) {
            toast.info("Limite d'actifs atteinte", {
                description: `Votre plan permet ${limits.maxAssets} actifs. Passez à l'offre supérieure pour en ajouter davantage.`
            });
            return;
        }
        setSelectedAsset(asset || null);
        setInspectorOpen(true);
    };

    const handleCloseInspector = () => {
        setInspectorOpen(false);
        setSelectedAsset(null);
    };

    const [dependencies, setDependencies] = useState<{ id: string; name: string; type: string }[]>([]);

    const handleDeleteClick = async (id: string, name: string) => {
        const depCheck = await checkDependencies(id);
        if (depCheck.hasDependencies) {
            setDependencies((depCheck.dependencies || []) as { id: string; name: string; type: string }[]);
        } else {
            setDependencies([]);
        }
        setAssetToDelete({ id, name });
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (assetToDelete) {
            await deleteAsset(assetToDelete.id, assetToDelete.name);
            setDeleteModalOpen(false);
            setAssetToDelete(null);
            setDependencies([]);
        }
    };



    const handleGenerateKioskLink = () => {
        const url = `${window.location.origin}/intake`;
        navigator.clipboard.writeText(url);
        toast.success("Lien Kiosque copié", {
            description: "Le lien vers le formulaire d'entrée a été copié."
        });
    };

    const handleExportCSV = () => {
        const headers = ['Nom', 'Type', 'Statut', 'Criticité', 'Propriétaire', 'Localisation', 'Valeur', 'Fin Garantie'];
        const data = filteredAssets.map(a => ({
            'Nom': a.name,
            'Type': a.type,
            'Statut': a.lifecycleStatus || '',
            'Criticité': a.confidentiality,
            'Propriétaire': a.owner,
            'Localisation': a.location || '',
            'Valeur': a.purchasePrice || '',
            'Fin Garantie': a.warrantyEnd || ''
        }));

        CsvParser.downloadCSV(headers, data, `assets_export_${new Date().toISOString().split('T')[0]}.csv`);
    };

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
        >
            <MasterpieceBackground />
            <SEO title="Inventaire des Actifs" description="Gérez votre cartographie des actifs et votre analyse d'impact." />

            <div className="flex flex-col gap-8">
                {/* Header */}
                <motion.div variants={slideUpVariants}>
                    <PageHeader
                        title="Inventaire des Actifs"
                        subtitle="Gérez votre cartographie des actifs et votre analyse d'impact."
                        icon={<Database className="h-6 w-6 text-brand-500" />}
                        breadcrumbs={[
                            { label: 'Tableau de bord', path: '/' },
                            { label: 'Inventaire', path: '/assets' }
                        ]}
                        trustType="integrity"
                    />
                </motion.div>

                {/* Dashboard KPIs */}
                <motion.div variants={slideUpVariants}>
                    {reachedAssetLimit && (
                        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm font-semibold flex items-center justify-between">
                            <span>Limite atteinte : {assets.length}/{limits.maxAssets} actifs.</span>
                            <button
                                onClick={() => toast.info("Contactez-nous pour mettre à niveau votre plan.")}
                                className="text-amber-900 underline font-bold"
                            >
                                Mettre à niveau
                            </button>
                        </div>
                    )}
                    <AssetDashboard
                        assets={filteredAssets}
                        onFilterChange={(filter) => {
                            if (filter?.type === 'criticality') {
                                setActiveFilters(prev => ({ ...prev, criticality: filter.value as Criticality }));
                            } else if (filter === null) {
                                setActiveFilters(prev => ({ ...prev, criticality: undefined }));
                            }
                        }}
                    />
                </motion.div>

                {/* Search & List */}
                <motion.div variants={slideUpVariants} className="space-y-6">
                    {showAdvancedSearch && (
                        <AdvancedSearch
                            onSearch={(filters) => {
                                setActiveFilters(filters);
                                setShowAdvancedSearch(false);
                            }}
                            onClose={() => setShowAdvancedSearch(false)}
                        />
                    )}

                    <PremiumPageControl
                        searchQuery={activeFilters.query || ''}
                        onSearchChange={(q) => setActiveFilters(prev => ({ ...prev, query: q }))}
                        searchPlaceholder="Rechercher par nom, type, propriétaire..."
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        actions={
                            <>
                                <button
                                    onClick={() => OnboardingService.startAssetsTour()}
                                    className="p-2.5 rounded-xl bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:border-white/10 dark:hover:bg-white/10 transition-all shadow-sm"
                                    title="Lancer le tour guidé"
                                >
                                    <HelpCircle className="h-5 w-5" />
                                </button>
                                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />
                                <button
                                    onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                                    className={`p-2.5 rounded-xl transition-all border shadow-sm ${showAdvancedSearch
                                        ? 'bg-brand-50 text-brand-600 border-brand-100 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-900/30'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:border-white/10 dark:hover:bg-white/10'
                                        }`}
                                    title="Filtres avancés"
                                >
                                    <Filter className="h-5 w-5" />
                                </button>
                                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />
                                <button
                                    onClick={handleGenerateKioskLink}
                                    className="hidden sm:flex items-center px-4 py-2.5 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm"
                                >
                                    <Link className="h-4 w-4 mr-2 text-slate-500" />
                                    Kiosque
                                </button>
                                <button
                                    data-tour="assets-export"
                                    onClick={handleExportCSV}
                                    className="hidden sm:flex items-center px-4 py-2.5 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm"
                                >
                                    <FileSpreadsheet className="h-4 w-4 mr-2 text-slate-500" />
                                    Export
                                </button>
                                {canEdit && (
                                    <button
                                        data-tour="assets-add"
                                        onClick={() => handleOpenInspector(undefined)}
                                        disabled={reachedAssetLimit}
                                        className={`flex items-center px-5 py-2.5 text-sm font-bold rounded-xl transition-all shadow-lg shadow-brand-500/20 ${reachedAssetLimit ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        <span className="hidden sm:inline">Nouvel Actif</span>
                                        <span className="sm:hidden">Nouveau</span>
                                    </button>
                                )}
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
                            onDelete={(id, name) => handleDeleteClick(id, name)}
                            onGenerateLabel={() => {
                                toast.info("Fonctionnalité à venir", {
                                    description: "L'impression d'étiquettes sera disponible dans la v2.1"
                                });
                            }}
                            isGeneratingLabels={false}
                            activeFiltersQuery={activeFilters.query}
                            onBulkDelete={bulkDeleteAssets}
                        />
                    </div>

                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </motion.div>
                {/* Inspector Drawer */}
                <AssetInspector
                    isOpen={inspectorOpen}
                    onClose={handleCloseInspector}
                    selectedAsset={selectedAsset}
                    onUpdate={async (id, data) => updateAsset(id, data)}
                    onCreate={async (data) => createAsset(data, null)}
                    users={usersList}
                    suppliers={suppliers}
                    processes={processes}
                    canEdit={canEdit}
                />

                {/* Delete Confirmation */}
                <ConfirmModal
                    isOpen={deleteModalOpen}
                    onClose={() => setDeleteModalOpen(false)}
                    onConfirm={handleConfirmDelete}
                    title="Supprimer l'actif ?"
                    message={
                        dependencies.length > 0
                            ? `Attention: Cet actif est lié à ${dependencies.length} risque(s) (ex: ${dependencies[0].name}). La suppression peut entraîner des incohérences.`
                            : `Êtes-vous sûr de vouloir supprimer l'actif "${assetToDelete?.name}" ? Cette action est irréversible.`
                    }
                    confirmText="Supprimer"
                    cancelText="Annuler"

                />
            </div >
        </motion.div >
    );
};

export default Assets;
