import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
    LayoutDashboard, List, Grid3x3, ShieldAlert, Loader, Target
} from '../components/ui/Icons';
import { OnboardingService } from '../services/onboardingService';
import { ErrorLogger } from '../services/errorLogger';
import { PageHeader } from '../components/ui/PageHeader';
// PremiumPageControl removed
// AdvancedSearch replaced by RiskAdvancedFilters
import { RiskAdvancedFilters } from '../components/risks/RiskAdvancedFilters';
// Tooltip removed
// ObsidianService removed
import { RisksToolbar } from '../components/risks/RisksToolbar';
import { exportRisksToExcel } from '../utils/riskExportUtils';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile, Risk } from '../types';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { usePersistedState } from '../hooks/usePersistedState';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';


import { RiskImportModal } from '../components/risks/RiskImportModal';

// New Optimized Hooks
import { useRiskLogic } from '../hooks/risks/useRiskLogic';
import { useRiskDependencies } from '../hooks/risks/useRiskDependencies';
import { useRiskActions } from '../hooks/risks/useRiskActions';
import { useRiskFilters } from '../hooks/risks/useRiskFilters';
import { RiskCalculator } from '../utils/RiskCalculator';
import { useDeepLinkAction } from '../hooks/useDeepLinkAction';

import { RiskFormData } from '../schemas/riskSchema';
import { RiskList } from '../components/risks/RiskList';
import { RiskGrid } from '../components/risks/RiskGrid';
import { RiskStatsWidget } from '../components/risks/RiskStatsWidget';
// RiskMatrix removed for lazy load
import { RiskDashboard } from '../components/risks/RiskDashboard';
import { RiskContextManager } from '../components/risks/context/RiskContextManager';
// CustomSelect removed
// Button removed


// ... existing imports ...
import { Drawer } from '../components/ui/Drawer';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { RiskTemplateModal } from '../components/risks/RiskTemplateModal';
import { aiService } from '../services/aiService';
import { PdfService } from '../services/PdfService';
import { useStore } from '../store';
import { toast } from '@/lib/toast';
import { canEditResource } from '../utils/permissions';
import { useAuth } from '../hooks/useAuth';

// Lazy Loading Heavy Components
const RiskForm = React.lazy(() => import('../components/risks/RiskForm').then(m => ({ default: m.RiskForm })));
const RiskInspector = React.lazy(() => import('../components/risks/RiskInspector').then(m => ({ default: m.RiskInspector })));
const RiskMatrix = React.lazy(() => import('../components/risks/RiskMatrix').then(m => ({ default: m.RiskMatrix })));

// Inline Loader
const Spinner = () => <div className="flex items-center justify-center p-8"><Loader className="w-8 h-8 animate-spin text-primary" /></div>;

export const Risks: React.FC = () => {
    // Hooks
    const { user } = useAuth();
    const { demoMode, t } = useStore();

    // ... (keep state logic same) ...
    // 1. Core Data (Always Fetch)
    const { risks, loading: loadingRisks } = useRiskLogic();

    // Permissions
    const canEdit = canEditResource(user as UserProfile, 'Risk');

    // UI State
    const [creationMode, setCreationMode] = useState(false);
    const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
    const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
    const [viewMode, setViewMode] = usePersistedState<'list' | 'grid' | 'matrix'>('risks-view-mode', 'grid');
    const [activeTab, setActiveTab] = usePersistedState<'overview' | 'list' | 'matrix' | 'context'>('risks-active-tab', 'overview');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [confirmData, setConfirmData] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [initialFormData, setInitialFormData] = useState<Partial<RiskFormData> | undefined>(undefined);

    // 2. Dependency Fetches (Lazy Loading)
    const shouldFetchDetails = creationMode || !!editingRisk || !!selectedRisk;

    const {
        assets,
        controls,
        projects,
        audits,
        suppliers,
        processes,
        usersList,
        loading: loadingDeps
    } = useRiskDependencies({
        fetchUsers: true,
        fetchAssets: true,
        fetchControls: shouldFetchDetails,
        fetchProcesses: shouldFetchDetails,
        fetchSuppliers: shouldFetchDetails,
        fetchAudits: shouldFetchDetails,
        fetchProjects: shouldFetchDetails
    });

    const loading = loadingRisks || (shouldFetchDetails && loadingDeps);

    // ... (keep actions and effects same) ...
    const {
        createRisk, updateRisk, deleteRisk, bulkDeleteRisks,
        exportCSV, setIsGeneratingReport, submitting,
        importRisks, checkDependencies
    } = useRiskActions(() => { });

    useEffect(() => {
        // Use requestIdleCallback if available to avoid blocking main thread during initial render
        const startTour = () => {
            OnboardingService.startRisksTour();
        };

        interface IOSWindow {
            requestIdleCallback: (cb: () => void, options?: { timeout: number }) => number;
            cancelIdleCallback: (handle: number) => void;
        }

        if ('requestIdleCallback' in window) {
            const handle = (window as unknown as IOSWindow).requestIdleCallback(startTour, { timeout: 3000 });
            return () => (window as unknown as IOSWindow).cancelIdleCallback(handle);
        } else {
            const timer = setTimeout(startTour, 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const {
        activeFilters, setActiveFilters,
        filteredRisks,
        showAdvancedSearch, setShowAdvancedSearch,
        frameworkFilter, setFrameworkFilter,
        matrixFilter, setMatrixFilter,
        availableCategories
    } = useRiskFilters(risks);

    const navigate = useNavigate();
    const location = useLocation();

    const [searchParams, setSearchParams] = useSearchParams();
    const deepLinkTab = searchParams.get('tab');

    // Handle tab deep link (e.g., from /risk-context redirect)
    useEffect(() => {
        if (deepLinkTab && ['overview', 'list', 'matrix', 'context'].includes(deepLinkTab)) {
            setActiveTab(deepLinkTab as any);
            // Clean up the tab param after applying it
            setSearchParams(params => {
                params.delete('tab');
                return params;
            }, { replace: true });
        }
    }, [deepLinkTab, setActiveTab, setSearchParams]);

    useDeepLinkAction({
        data: risks,
        loading,
        currentSelection: selectedRisk,
        isCreationMode: creationMode,
        onOpen: setSelectedRisk,
        onCreate: () => {
            setInitialFormData(undefined);
            setCreationMode(true);
        },
        onCreateWithPreset: (preset) => {
            setInitialFormData({ assetId: preset.assetId });
            setCreationMode(true);
        }
    });

    useEffect(() => {
        const state = location.state as { createForAsset?: string; assetName?: string } | null;
        if (state?.createForAsset && !creationMode) {
            setInitialFormData({ assetId: state.createForAsset });
            setCreationMode(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state, creationMode]);

    // Handlers
    const handleEdit = useCallback((risk: Risk) => {
        if (!canEditResource(user as UserProfile, 'Risk')) return;
        setEditingRisk(risk);
        setInitialFormData(undefined);
        setCreationMode(true);
    }, [user]);

    const handleDelete = useCallback(async (risk: { id: string, name: string }) => {
        if (!canEditResource(user as UserProfile, 'Risk')) {
            toast.error("Permission refusée");
            return;
        }
        const { hasDependencies, dependencies } = await checkDependencies(risk.id);

        let message = t('risks.deleteMessage');
        if (hasDependencies && dependencies && dependencies.length > 0) {
            const depDetails = dependencies.slice(0, 5).map((d) => `${d.type}: ${d.name} `).join(', ');
            message = t('risks.deleteWarning', { count: dependencies.length, details: depDetails + (dependencies.length > 5 ? '...' : '') });
        }

        setConfirmData({
            isOpen: true,
            title: t('risks.deleteTitle'),
            message: message,
            onConfirm: async () => {
                await deleteRisk(risk.id, risk.name);
                setConfirmData(prev => ({ ...prev, isOpen: false }));
                if (selectedRisk?.id === risk.id) setSelectedRisk(null);
            }
        });
    }, [user, t, checkDependencies, deleteRisk, selectedRisk]);

    const handleDeleteRiskItem = useCallback((id: string) => {
        const r = risks.find(x => x.id === id);
        handleDelete({ id, name: r?.threat || t('common.unknown') });
    }, [risks, t, handleDelete]);

    const handleFormSubmit = useCallback(async (data: RiskFormData) => {
        const calculatedValues = RiskCalculator.parseRiskValues(data);

        const cleanedData = {
            ...data,
            ...calculatedValues,
            aiAnalysis: data.aiAnalysis || undefined
        };

        if (editingRisk) {
            await updateRisk(editingRisk.id, cleanedData, editingRisk);
        } else {
            await createRisk(cleanedData as Risk);
        }
        setCreationMode(false);
        setEditingRisk(null);
    }, [editingRisk, updateRisk, createRisk]);

    const handleCommonExport = useCallback(async () => {
        setIsGeneratingReport(true);
        try {
            await PdfService.generateRiskExecutiveReport(filteredRisks, {
                title: t('risks.executiveReport'),
                subtitle: `Généré par ${user?.displayName || 'Utilisateur'} le ${new Date().toLocaleDateString()} `,
                filename: `risques_exec_${new Date().toISOString().split('T')[0]}.pdf`,
                organizationName: user?.organizationName || 'Sentinel GRC',
                author: user?.displayName || 'Sentinel User'
            });
            toast.success(t('risks.reportSuccess'));
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Risks.handleExportExecutive', 'REPORT_GENERATION_FAILED');
        } finally {
            setIsGeneratingReport(false);
        }
    }, [filteredRisks, t, user, setIsGeneratingReport]);

    const handleExportExcel = useCallback(async () => {
        try {
            await exportRisksToExcel({
                risks: filteredRisks,
                assets,
                users: usersList,
                organizationName: user?.organizationName || 'Sentinel GRC'
            });
            toast.success(t('risks.exportSuccess') || 'Export Excel réussi');
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Risks.handleExportExcel', 'UNKNOWN_ERROR');
        }
    }, [filteredRisks, assets, usersList, user?.organizationName, t]);

    const handleStartAiAnalysis = useCallback(async () => {
        setIsAnalyzing(true);
        try {
            const prompt = t('risks.aiPrompt', { count: filteredRisks.length });
            const analysis = await aiService.chatWithAI(prompt);
            toast.info(t('risks.analysisComplete'), typeof analysis === 'string' ? analysis : 'Analyse terminée');
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Risks.handleStartAiAnalysis', 'AI_ERROR');
            toast.error(t('risks.analysisError'));
        } finally {
            setIsAnalyzing(false);
        }
    }, [filteredRisks.length, t]);

    const handleTemplateSelect = useCallback(async (template: { risks: Partial<Risk>[] }, ownerId: string) => {
        const promises = template.risks.map((risk: Partial<Risk>) => {
            const calculatedValues = RiskCalculator.parseRiskValues(risk);

            return createRisk({
                threat: risk.threat,
                vulnerability: risk.vulnerability,
                strategy: risk.strategy,
                ...calculatedValues,
                status: 'Ouvert',
                framework: 'ISO27001',
                owner: ownerId,
            });
        });
        try {
            await Promise.all(promises);
            toast.success(t('risks.templateSuccess', { count: template.risks.length }));
        } catch {
            toast.error(t('risks.templateError'));
        }
        setIsTemplateModalOpen(false);
    }, [createRisk, t]);

    const [duplicatingIds, setDuplicatingIds] = React.useState<Set<string>>(new Set());

    const handleDuplicateRisk = useCallback(async (r: Risk) => {
        if (duplicatingIds.has(r.id)) return;
        setDuplicatingIds(prev => new Set(prev).add(r.id));
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, history, ...rest } = r;
            await createRisk({
                ...rest,
                threat: `${r.threat} (${t('common.copy')})`,
                status: 'Ouvert'
            });
            toast.success(t('risks.duplicateSuccess') || 'Risque dupliqué avec succès');
        } catch {
            toast.error(t('risks.duplicateError') || 'Erreur lors de la duplication');
        } finally {
            setDuplicatingIds(prev => {
                const next = new Set(prev);
                next.delete(r.id);
                return next;
            });
        }
    }, [t, createRisk, duplicatingIds]);

    const handleEmptyAction = useCallback(() => {
        if (assets.length > 0) {
            setCreationMode(true);
        } else {
            navigate('/assets');
        }
    }, [assets.length, navigate]);

    const role = user?.role || 'user';
    let risksTitle = t('risks.title');
    let risksSubtitle = t('risks.subtitle');
    if (role === 'admin' || role === 'rssi') {
        risksTitle = t('risks.title_admin');
        risksSubtitle = t('risks.subtitle_admin');
    } else if (role === 'direction') {
        risksTitle = t('risks.title_exec');
        risksSubtitle = t('risks.subtitle_exec');
    }

    const hasAssets = assets.length > 0;
    const emptyStateTitle = hasAssets ? t('risks.emptyTitle') : t('assets.emptyTitle');
    const emptyStateDescription = hasAssets ? t('risks.emptyDesc') : t('assets.emptyDesc');
    const emptyStateActionLabel = hasAssets ? t('risks.newRisk') : t('assets.createAsset');

    const tabs = useMemo(() => [
        { id: 'overview', label: t('risks.overview'), icon: LayoutDashboard },
        { id: 'list', label: t('risks.registry'), icon: List },
        { id: 'matrix', label: t('risks.matrix'), icon: Grid3x3 },
        { id: 'context', label: 'Contexte', icon: Target },
    ], [t]);

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-6">
            <MasterpieceBackground />
            <PageHeader
                title={risksTitle}
                subtitle={risksSubtitle}
                icon={
                    <img
                        src="/images/gouvernance.png"
                        alt="GOUVERNANCE"
                        className="w-full h-full object-contain"
                    />
                }
                breadcrumbs={[{ label: t('commandPalette.nav.risks') }]}
                trustType="integrity"
            />


            <RiskStatsWidget risks={filteredRisks} />

            <ScrollableTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as any)}
            />

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <motion.div
                    variants={slideUpVariants}
                    initial="initial"
                    animate="visible"
                    exit="exit"
                    key="overview-tab"
                    data-tour="risks-stats"
                    role="tabpanel"
                    id="panel-overview"
                    aria-labelledby="tab-overview"
                    tabIndex={0}
                    className="focus:outline-none"
                >
                    <RiskDashboard risks={filteredRisks} />
                </motion.div>
            )}

            {/* CONTEXT TAB */}
            {activeTab === 'context' && (
                <motion.div
                    variants={slideUpVariants}
                    initial="initial"
                    animate="visible"
                    exit="exit"
                    key="context-tab"
                    role="tabpanel"
                    id="panel-context"
                    aria-labelledby="tab-context"
                    className="focus:outline-none"
                >
                    <div className="glass-panel p-6 rounded-[2rem]">
                        <RiskContextManager />
                    </div>
                </motion.div>
            )}

            {/* CONTENT TABS */}
            {activeTab !== 'overview' && activeTab !== 'context' && (
                <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" key="filter-bar">
                    <RisksToolbar
                        searchQuery={activeFilters.query}
                        onSearchChange={(q) => setActiveFilters(prev => ({ ...prev, query: q }))}
                        viewMode={viewMode}
                        onViewModeChange={(m) => setViewMode(m)}
                        activeTab={activeTab as any}
                        frameworkFilter={frameworkFilter}
                        setFrameworkFilter={setFrameworkFilter}
                        showAdvancedSearch={showAdvancedSearch}
                        setShowAdvancedSearch={setShowAdvancedSearch}
                        filteredRisks={filteredRisks}
                        handleCommonExport={handleCommonExport}
                        exportCSV={exportCSV}
                        onExportExcel={handleExportExcel}
                        setImportModalOpen={setImportModalOpen}
                        setIsTemplateModalOpen={setIsTemplateModalOpen}
                        handleStartAiAnalysis={handleStartAiAnalysis}
                        handleCreateRisk={() => { setEditingRisk(null); setCreationMode(true); }}
                        canEdit={canEdit}
                        isAnalyzing={isAnalyzing}
                    />
                </motion.div>
            )}

            <AnimatePresence>
                {showAdvancedSearch && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <RiskAdvancedFilters
                            statusFilter={activeFilters.status || ''}
                            onStatusFilterChange={(status) => setActiveFilters(prev => ({ ...prev, status: status || null }))}
                            categoryFilter={activeFilters.category || ''}
                            onCategoryFilterChange={(category) => setActiveFilters(prev => ({ ...prev, category: category || null }))}
                            criticalityFilter={activeFilters.criticality || ''}
                            onCriticalityFilterChange={(criticality) => setActiveFilters(prev => ({ ...prev, criticality: criticality || null }))}
                            availableCategories={availableCategories.filter((c): c is string => !!c)}
                            onClose={() => setShowAdvancedSearch(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {activeTab === 'list' && (
                <motion.div
                    variants={slideUpVariants}
                    initial="initial"
                    animate="visible"
                    exit="exit"
                    className="mt-8 focus:outline-none"
                    role="tabpanel"
                    id="panel-list"
                    aria-labelledby="tab-list"
                    tabIndex={0}
                >
                    {viewMode === 'list' ? (
                        <RiskList
                            risks={filteredRisks}
                            loading={loading}
                            canEdit={canEdit}
                            onEdit={handleEdit}
                            onDelete={handleDeleteRiskItem}
                            onDuplicate={handleDuplicateRisk}
                            onBulkDelete={bulkDeleteRisks}
                            onSelect={setSelectedRisk}
                            duplicatingIds={duplicatingIds}
                            users={[]}
                            assets={assets}
                            emptyStateTitle={emptyStateTitle}
                            emptyStateDescription={emptyStateDescription}
                            emptyStateActionLabel={!activeFilters.query ? emptyStateActionLabel : undefined}
                            onEmptyStateAction={!activeFilters.query ? handleEmptyAction : undefined}
                        />
                    ) : (
                        <RiskGrid
                            risks={filteredRisks}
                            loading={loading}
                            onSelect={setSelectedRisk}
                            assets={assets}
                            emptyStateIcon={ShieldAlert}
                            emptyStateTitle={emptyStateTitle}
                            emptyStateDescription={emptyStateDescription}
                            emptyStateActionLabel={!activeFilters.query ? emptyStateActionLabel : undefined}
                            onEmptyStateAction={!activeFilters.query ? handleEmptyAction : undefined}
                            canEdit={canEdit}
                            onEdit={handleEdit}
                            onDelete={handleDeleteRiskItem}
                        />
                    )}
                </motion.div>
            )}

            {activeTab === 'matrix' && (
                <motion.div
                    variants={slideUpVariants}
                    initial="initial"
                    animate="visible"
                    className="p-1 focus:outline-none"
                    role="tabpanel"
                    id="panel-matrix"
                    aria-labelledby="tab-matrix"
                    tabIndex={0}
                >
                    {matrixFilter && (
                        <div className="bg-primary/5 dark:bg-primary/20 p-4 rounded-2xl border border-primary/20 dark:border-primary/30 flex justify-between items-center mb-6">
                            <span className="text-sm font-bold text-primary">
                                {t('risks.matrix')} : {t('risks.searchPlaceholder')}
                            </span>
                            <button type="button" onClick={() => setMatrixFilter(null)} className="text-xs text-destructive font-bold hover:underline">{t('common.reset')}</button>
                        </div>
                    )}
                    <React.Suspense fallback={<Spinner />}>
                        <RiskMatrix
                            risks={filteredRisks}
                            matrixFilter={matrixFilter}
                            setMatrixFilter={(f) => { setMatrixFilter(f); if (f) setActiveTab('list'); }}
                            frameworkFilter={frameworkFilter}
                        />
                    </React.Suspense>
                </motion.div>
            )}

            <React.Suspense fallback={null}>
                <RiskInspector
                    isOpen={!!selectedRisk}
                    onClose={() => setSelectedRisk(null)}
                    risk={selectedRisk}
                    assets={assets}
                    controls={controls}
                    projects={projects}
                    audits={audits}
                    suppliers={suppliers}
                    usersList={usersList}
                    processes={processes}
                    canEdit={canEdit}
                    demoMode={demoMode}
                    onUpdate={updateRisk}
                    onDelete={(id, name) => handleDelete({ id, name })}
                    onDuplicate={handleDuplicateRisk}
                />
            </React.Suspense>

            <Drawer
                isOpen={creationMode}
                onClose={() => setCreationMode(false)}
                title={editingRisk ? t('risks.editRisk') : t('risks.newRisk')}
                width="max-w-6xl"
            >
                <div className="p-6">
                    <React.Suspense fallback={<Spinner />}>
                        <RiskForm
                            initialData={initialFormData}
                            existingRisk={editingRisk}
                            onSubmit={handleFormSubmit}
                            onCancel={() => { setCreationMode(false); setEditingRisk(null); }}
                            assets={assets}
                            usersList={usersList}
                            processes={processes}
                            suppliers={suppliers}
                            controls={controls}
                            isLoading={submitting}
                        />
                    </React.Suspense>
                </div>
            </Drawer>

            <RiskTemplateModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onSelectTemplate={handleTemplateSelect}
                users={usersList}
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <RiskImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                importRisks={importRisks}
            />
        </motion.div>
    );
};
