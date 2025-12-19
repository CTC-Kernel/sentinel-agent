import React, { useDeferredValue, useMemo, useState } from 'react';
import { SEO } from '../components/SEO';
import { motion } from 'framer-motion';
import { Asset, Criticality } from '../types';
import { canEditResource } from '../utils/permissions';
import { toast } from 'sonner';
import { AdvancedSearch, SearchFilters } from '../components/ui/AdvancedSearch';
import { useStore } from '../store';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Pagination } from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import { AssetList } from '../components/assets/AssetList';
import { AssetHeader } from '../components/assets/AssetHeader';
import { AssetInspector } from '../components/assets/AssetInspector';
import { AssetDashboard } from '../components/assets/AssetDashboard';
import { useAssets } from '../hooks/assets/useAssets';
import { Search, MoreVertical } from 'lucide-react';

const Assets: React.FC = () => {
    const { user } = useStore();
    const canEdit = canEditResource(user, 'Asset');
    const { assets, loading, createAsset, updateAsset, deleteAsset, usersList, suppliers, processes } = useAssets();

    // UI State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [activeFilters, setActiveFilters] = useState<SearchFilters>({ query: '', type: 'all' });
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [assetToDelete, setAssetToDelete] = useState<{ id: string, name: string } | null>(null);

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
        setSelectedAsset(asset || null);
        setInspectorOpen(true);
    };

    const handleCloseInspector = () => {
        setInspectorOpen(false);
        setSelectedAsset(null);
    };

    const handleConfirmDelete = async () => {
        if (assetToDelete) {
            await deleteAsset(assetToDelete.id, assetToDelete.name);
            setDeleteModalOpen(false);
            setAssetToDelete(null);
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
        // Simple CSV export logic from original file
        const headers = ['Nom', 'Type', 'Statut', 'Criticité', 'Propriétaire', 'Localisation', 'Valeur', 'Fin Garantie'];
        const csvContent = [
            headers.join(','),
            ...filteredAssets.map(a => [
                `"${a.name}"`,
                `"${a.type}"`,
                `"${a.lifecycleStatus || ''}"`,
                `"${a.confidentiality}"`,
                `"${a.owner}"`,
                `"${a.location || ''}"`,
                `"${a.purchasePrice || ''}"`,
                `"${a.warrantyEnd || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `assets_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <>
            <MasterpieceBackground />
            <SEO title="Inventaire des Actifs" description="Gérez votre cartographie des actifs et votre analyse d'impact." />

            <div className="relative min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-[1920px] mx-auto">
                <motion.div
                    variants={staggerContainerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-8"
                >
                    <div className="flex flex-col gap-8">
                        {/* Header */}
                        <motion.div variants={slideUpVariants}>
                            <AssetHeader
                                onGenerateLink={handleGenerateKioskLink}
                                onExportCSV={handleExportCSV}
                                onNewAsset={() => handleOpenInspector(undefined)}
                                canEdit={canEdit}
                            />
                        </motion.div>

                        {/* Dashboard KPIs */}
                        <motion.div variants={slideUpVariants}>
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
                        <motion.div variants={slideUpVariants}>
                            {showAdvancedSearch && (
                                <AdvancedSearch
                                    onSearch={(filters) => {
                                        setActiveFilters(filters);
                                        setShowAdvancedSearch(false);
                                    }}
                                    onClose={() => setShowAdvancedSearch(false)}
                                />
                            )}

                            <div className="flex flex-col gap-6">
                                {/* Page Controls (Search Bar + View Toggle) */}
                                {/* We can use PageControls component here if we want to match exact layout */}
                                <div className="glass-panel p-4 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 dark:border-white/5">
                                    <div className="w-full sm:w-96">
                                        <div className="relative group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-hover:text-brand-500 transition-colors" />
                                            <input
                                                type="text"
                                                placeholder="Rechercher un actif..."
                                                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-black/20 border-none rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/50 transition-all font-medium"
                                                value={activeFilters.query || ''}
                                                onChange={(e) => setActiveFilters(prev => ({ ...prev, query: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                                            className={`p-3 rounded-xl transition-all ${showAdvancedSearch ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'}`}
                                        >
                                            <MoreVertical className="h-5 w-5" />
                                        </button>
                                        <div className="bg-slate-100 dark:bg-white/5 p-1 rounded-xl flex">
                                            <button
                                                onClick={() => setViewMode('list')}
                                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                            </button>
                                            <button
                                                onClick={() => setViewMode('grid')}
                                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-brand-600 shadow-sm dark:bg-slate-800 dark:text-brand-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <AssetList
                                    assets={paginatedItems}
                                    loading={loading}
                                    viewMode={viewMode}
                                    user={user}
                                    canEdit={canEdit}
                                    onEdit={handleOpenInspector}
                                    onDelete={(id, name) => { setAssetToDelete({ id, name }); setDeleteModalOpen(true); }}
                                    onGenerateLabel={() => {
                                        toast.info("Fonctionnalité à venir", {
                                            description: "L'impression d'étiquettes sera disponible dans la v2.1"
                                        });
                                    }}
                                    activeFiltersQuery={activeFilters.query}
                                />

                                <Pagination
                                    currentPage={currentPage}
                                    totalItems={totalItems}
                                    itemsPerPage={itemsPerPage}
                                    onPageChange={setCurrentPage}
                                    onItemsPerPageChange={setItemsPerPage}
                                />
                            </div>
                        </motion.div>
                    </div>
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
                    message={`Êtes-vous sûr de vouloir supprimer l'actif "${assetToDelete?.name}" ? Cette action est irréversible.`}
                    confirmText="Supprimer"
                    cancelText="Annuler"
                />
            </div>
        </>
    );
};

export default Assets;
