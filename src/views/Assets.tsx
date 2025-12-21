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
import { Database, FileSpreadsheet, Link, Plus, Filter, HelpCircle, BrainCircuit, Loader2, MoreVertical, List, LayoutGrid } from 'lucide-react';
import { usePlanLimits } from '../hooks/usePlanLimits';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { CsvParser } from '../utils/csvUtils';
import { OnboardingService } from '../services/onboardingService';
import { aiService } from '../services/aiService';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { usePersistedState } from '../hooks/usePersistedState';
import { Menu, Transition } from '@headlessui/react';

const Assets: React.FC = () => {
    const { user } = useStore();
    const canEdit = canEditResource(user, 'Asset');
    const { assets, loading, createAsset, updateAsset, deleteAsset, bulkDeleteAssets, usersList, suppliers, processes, checkDependencies } = useAssets();
    const { limits } = usePlanLimits();
    const reachedAssetLimit = assets.length >= limits.maxAssets;

    // UI State
    const [viewMode, setViewMode] = usePersistedState<'grid' | 'list' | 'matrix' | 'kanban'>('assets-view-mode', 'grid');
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [activeFilters, setActiveFilters] = useState<SearchFilters>({ query: '', type: 'all' });
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

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

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            const prompt = `Analyse cette liste de ${filteredAssets.length} actifs informatiques. Donne-moi 3 insights clés sur la surface d'attaque potentielle et une recommandation de sécurisation. Format court.`;
            const analysis = await aiService.chatWithAI(prompt);
            toast.info("Analyse IA terminée", { description: analysis, duration: 10000 });
        } catch (e) {
            console.error(e);
            toast.error("Erreur lors de l'analyse IA");
        } finally {
            setIsAnalyzing(false);
        }
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
                        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-3 text-sm font-semibold flex items-center justify-between backdrop-blur-md shadow-lg shadow-amber-500/10">
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
                        activeView={viewMode}
                        onViewChange={(mode) => setViewMode(mode as 'grid' | 'list' | 'matrix' | 'kanban')}
                        viewOptions={[
                            { id: 'list', label: 'Liste', icon: List },
                            { id: 'grid', label: 'Grille', icon: LayoutGrid }
                        ]}
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

                                {canEdit && (
                                    <>
                                        <CustomTooltip content="Lancer l'analyse IA">
                                            <button
                                                onClick={handleAnalyze}
                                                disabled={isAnalyzing}
                                                className="hidden lg:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg shadow-indigo-500/20 font-bold text-sm disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {isAnalyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
                                                <span className="hidden xl:inline">{isAnalyzing ? 'Analyse...' : 'Analyse IA'}</span>
                                            </button>
                                        </CustomTooltip>

                                        <CustomTooltip content="Créer un nouvel actif">
                                            <button
                                                data-tour="assets-add"
                                                onClick={() => handleOpenInspector(undefined)}
                                                disabled={reachedAssetLimit}
                                                className={`flex items-center px-4 py-2 text-sm font-bold rounded-xl transition-all shadow-lg shadow-brand-500/20 ${reachedAssetLimit ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                <span className="hidden sm:inline">Nouvel Actif</span>
                                                <span className="sm:hidden">Nouveau</span>
                                            </button>
                                        </CustomTooltip>

                                        <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                                        {/* MORE MENU -> Replaces individual Kiosk/Export Buttons */}
                                        <Menu as="div" className="relative inline-block text-left">
                                            <Menu.Button className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                                                <MoreVertical className="h-5 w-5" />
                                            </Menu.Button>
                                            <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                                <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                                    <div className="p-1">
                                                        <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Outils</div>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    onClick={handleGenerateKioskLink}
                                                                    className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                                >
                                                                    <Link className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-blue-500'}`} />
                                                                    Lien Kiosque
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    data-tour="assets-export"
                                                                    onClick={handleExportCSV}
                                                                    className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                                >
                                                                    <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-emerald-500'}`} />
                                                                    Export CSV
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                    </div>
                                                </Menu.Items>
                                            </Transition>
                                        </Menu>
                                    </>
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
                            onGenerateLabel={async (asset) => {
                                const { PdfService } = await import('../services/PdfService');
                                try {
                                    PdfService.generateAssetLabel(
                                        { name: asset.name, id: asset.id, owner: asset.owner, type: asset.type },
                                        { organizationName: limits.features.whiteLabelReports ? user?.displayName || 'Sentinel' : 'Sentinel GRC' }
                                    );
                                    toast.success("Étiquette générée");
                                } catch (e) {
                                    console.error(e);
                                    toast.error("Erreur lors de la génération de l'étiquette");
                                }
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
