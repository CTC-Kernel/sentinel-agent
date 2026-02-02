import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, List, Grid3x3, Target, Scale, Calculator, Siren } from '../components/ui/Icons';
import { OnboardingService } from '../services/onboardingService';
import { ErrorLogger } from '../services/errorLogger';
import { DEFAULT_VIEWS, SavedView } from '../components/ui/SavedViewsBar';
import { PageHeader } from '../components/ui/PageHeader';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store';
import { exportRisksToExcel } from '../utils/riskExportUtils';
import { staggerContainerVariants } from '../components/ui/animationVariants';
import { UserProfile, Risk } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { RiskImportModal } from '../components/risks/RiskImportModal';
import { useRiskLogic } from '../hooks/risks/useRiskLogic';
import { useRiskDependencies } from '../hooks/risks/useRiskDependencies';
import { useRiskActions } from '../hooks/risks/useRiskActions';
import { useRiskFilters } from '../hooks/risks/useRiskFilters';
import { RiskCalculator } from '../utils/RiskCalculator';
import { useDeepLinkAction } from '../hooks/useDeepLinkAction';
import { RiskFormData } from '../schemas/riskSchema';
import { Drawer } from '../components/ui/Drawer';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { RiskTemplateModal } from '../components/risks/RiskTemplateModal';
import { aiService } from '../services/aiService';
import { PdfService } from '../services/PdfService';
import { toast } from '@/lib/toast';
import { canEditResource } from '../utils/permissions';
import { useAuth } from '../hooks/useAuth';
import { RiskDashboardSkeleton } from '../components/risks/RiskSkeletons';

// Refactored Components
import { RiskTabsContent } from '../components/risks/layout/RiskTabsContent';

// Lazy Loading Heavy Components
const RiskIntelCard = React.lazy(() => import('../components/risks/dashboard/RiskIntelCard').then(m => ({ default: m.RiskIntelCard })));
const RiskForm = React.lazy(() => import('../components/risks/RiskForm').then(m => ({ default: m.RiskForm })));
const RiskInspector = React.lazy(() => import('../components/risks/RiskInspector').then(m => ({ default: m.RiskInspector })));

// Spinner from shared component
import { Spinner as SpinnerIcon } from '@/components/ui/Spinner';
const Spinner = () => <div className="flex items-center justify-center p-8"><SpinnerIcon size="lg" className="text-primary" /></div>;

type RiskTab = 'overview' | 'list' | 'matrix' | 'context' | 'financial' | 'ebios';

export const Risks: React.FC = () => {
    // Hooks
    const { user, claimsSynced, loading: authLoading } = useAuth();
    const { demoMode, t } = useStore();

    // 1. Core Data (Always Fetch)
    const { risks, loading: loadingRisks } = useRiskLogic(claimsSynced);

    // Permissions
    const canEdit = canEditResource(user as UserProfile, 'Risk');

    // UI State
    const [creationMode, setCreationMode] = useState(false);
    const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
    const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
    const [viewMode, setViewMode] = usePersistedState<'list' | 'grid' | 'matrix'>('risks-view-mode', 'grid');
    const [activeTab, setActiveTab] = usePersistedState<RiskTab>('risks-active-tab', 'overview');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [showSaveViewModal, setShowSaveViewModal] = useState(false);
    const [viewName, setViewName] = useState('');
    const [confirmData, setConfirmData] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [initialFormData, setInitialFormData] = useState<Partial<RiskFormData> | undefined>(undefined);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const pendingSelectId = useRef<string | null>(null);

    // 2. Dependency Fetches (Lazy Loading)
    const shouldFetchDetails = creationMode || !!editingRisk || !!selectedRisk;

    const {
        assets,
        controls,
        processes,
        suppliers,
        projects,
        audits,
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

    const loading = authLoading || !claimsSynced || loadingRisks || (shouldFetchDetails && loadingDeps);

    const {
        createRisk, updateRisk, deleteRisk, bulkDeleteRisks,
        exportCSV, setIsGeneratingReport, isGeneratingReport,
        importRisks, checkDependencies,
        bulkCreateRisks,
        submitting
    } = useRiskActions(() => { });

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

    // --- Saved Views Logic ---
    const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
        const saved = localStorage.getItem('sentinel_risk_views');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch { return DEFAULT_VIEWS; }
        }
        return DEFAULT_VIEWS;
    });

    const [activeViewId, setActiveViewId] = useState('all');

    const isFiltersModified = useMemo(() => {
        const activeView = savedViews.find(v => v.id === activeViewId);
        if (!activeView) return true;
        const current = { status: activeFilters.status, category: activeFilters.category, criticality: activeFilters.criticality };
        return JSON.stringify(current) !== JSON.stringify(activeView.filters);
    }, [activeFilters.status, activeFilters.category, activeFilters.criticality, activeViewId, savedViews]);

    const handleSaveView = () => {
        setShowSaveViewModal(true);
    };

    const handleConfirmSaveView = () => {
        if (!viewName.trim()) return;
        const newView: SavedView = {
            id: `custom-${Date.now()}`,
            name: viewName.trim(),
            filters: { status: activeFilters.status, category: activeFilters.category, criticality: activeFilters.criticality }
        };
        const updated = [...savedViews, newView];
        setSavedViews(updated);
        setActiveViewId(newView.id);
        localStorage.setItem('sentinel_risk_views', JSON.stringify(updated));
        setShowSaveViewModal(false);
        setViewName('');
    };

    const handleViewSelect = (view: SavedView) => {
        setActiveViewId(view.id);
        setActiveFilters(prev => ({
            ...prev,
            ...view.filters
        }));
    };

    useEffect(() => {
        OnboardingService.startRisksTour();
    }, []);

    useEffect(() => {
        if (deepLinkTab && ['overview', 'list', 'matrix', 'context', 'financial', 'ebios'].includes(deepLinkTab)) {
            setActiveTab(deepLinkTab as RiskTab);
            setSearchParams(params => {
                const next = new URLSearchParams(params);
                next.delete('tab');
                return next;
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

    // Auto-open inspector on newly created risk
    useEffect(() => {
        if (!pendingSelectId.current || loading) return;
        const created = risks.find(r => r.id === pendingSelectId.current);
        if (created) {
            pendingSelectId.current = null;
            setSelectedRisk(created);
            setActiveTab('list');
        }
    }, [risks, loading, setActiveTab]);

    useEffect(() => {
        const state = location.state as { createForAsset?: string; assetName?: string } | null;
        if (state?.createForAsset && !creationMode) {
            setInitialFormData({ assetId: state.createForAsset });
            setCreationMode(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state, creationMode]);

    const handleEdit = useCallback((risk: Risk) => {
        if (!canEditResource(user as UserProfile, 'Risk')) return;
        setEditingRisk(risk);
        setInitialFormData(undefined);
        setCreationMode(true);
    }, [user]);

    const handleDelete = useCallback(async (risk: { id: string, name: string }) => {
        if (!canEditResource(user as UserProfile, 'Risk')) {
            toast.error(t('errors.permissionDenied') || t('risks.errors.permissionDenied', { defaultValue: 'Permission refusée' }));
            return;
        }
        const { hasDependencies, dependencies } = await checkDependencies(risk.id);

        let message = t('risks.deleteMessage');
        if (hasDependencies && dependencies && dependencies.length > 0) {
            const depDetails = dependencies.slice(0, 5).map((d) => `${d.name}`).join(', ');
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
        const cleanedData: Partial<Risk> = {
            ...data,
            ...calculatedValues,
            aiAnalysis: data.aiAnalysis || undefined
        };

        if (editingRisk) {
            await updateRisk(editingRisk.id, cleanedData, editingRisk);
        } else {
            const result = await createRisk(cleanedData);
            if (typeof result === 'string') {
                pendingSelectId.current = result;
            }
        }
        setIsFormDirty(false);
        setCreationMode(false);
        setEditingRisk(null);
    }, [editingRisk, updateRisk, createRisk]);

    const handleCommonExport = useCallback(async () => {
        if (isGeneratingReport) return;
        setIsGeneratingReport(true);
        try {
            await PdfService.generateRiskExecutiveReport(filteredRisks, {
                title: t('risks.executiveReport'),
                subtitle: t('risks.generatedBy', { defaultValue: 'Généré par {{name}} le {{date}}', name: user?.displayName || t('common.user', { defaultValue: 'Utilisateur' }), date: new Date().toLocaleDateString() }),
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
    }, [filteredRisks, t, user, setIsGeneratingReport, isGeneratingReport]);

    const handleExportExcel = useCallback(async () => {
        try {
            await exportRisksToExcel({
                risks: filteredRisks,
                assets,
                users: usersList,
                organizationName: user?.organizationName || 'Sentinel GRC'
            });
            toast.success(t('risks.exportSuccess') || t('risks.excelExportSuccess', { defaultValue: 'Export Excel réussi' }));
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Risks.handleExportExcel', 'UNKNOWN_ERROR');
        }
    }, [filteredRisks, assets, usersList, user?.organizationName, t]);

    const handleStartAiAnalysis = useCallback(async () => {
        setIsAnalyzing(true);
        try {
            const prompt = t('risks.aiPrompt', { count: filteredRisks.length });
            const analysis = await aiService.chatWithAI(prompt);
            toast.info(t('risks.analysisComplete'), typeof analysis === 'string' ? analysis : t('risks.analysisFinished', { defaultValue: 'Analyse terminée' }));
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Risks.handleStartAiAnalysis', 'AI_ERROR');
            toast.error(t('risks.analysisError'));
        } finally {
            setIsAnalyzing(false);
        }
    }, [filteredRisks.length, t]);

    const handleTemplateSelect = useCallback(async (template: { risks: Partial<Risk>[] }, ownerId: string) => {
        const risksToCreate = template.risks.map(r => ({ ...r, owner: ownerId }));
        const success = await bulkCreateRisks(risksToCreate);
        if (success) {
            setIsTemplateModalOpen(false);
        }
    }, [bulkCreateRisks]);

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
            toast.success(t('risks.duplicateSuccess') || t('risks.duplicated', { defaultValue: 'Risque dupliqué avec succès' }));
        } catch {
            toast.error(t('risks.duplicateError') || t('risks.errors.duplicationFailed', { defaultValue: 'Erreur lors de la duplication' }));
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

    const hasAssets = assets.length > 0;
    const emptyStateTitle = hasAssets ? t('risks.emptyTitle') : t('assets.emptyTitle');
    const emptyStateDescription = hasAssets ? t('risks.emptyDesc') : t('assets.emptyDesc');
    const emptyStateActionLabel = hasAssets ? t('risks.newRisk') : t('assets.createAsset');

    const tabs = useMemo(() => [
        { id: 'overview', label: t('risks.overview'), icon: LayoutDashboard },
        { id: 'context', label: t('risks.context') || t('risks.tabs.context', { defaultValue: 'Contexte' }), icon: Target },
        { id: 'ebios', label: t('risks.ebios') || t('risks.tabs.ebios', { defaultValue: 'EBIOS RM' }), icon: Scale },
        { id: 'list', label: t('risks.registry'), icon: List },
        { id: 'financial', label: t('risks.financial') || t('risks.tabs.financial', { defaultValue: 'Risques financiers' }), icon: Calculator },
        { id: 'matrix', label: t('risks.matrix'), icon: Grid3x3 },
    ], [t]);

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24 rounded-3xl">
            <PageHeader
                title={t('risks.title')}
                subtitle={t('risks.subtitle')}
                icon={
                    <Siren className="text-red-600 dark:text-red-400" />
                }
            />

            <React.Suspense fallback={<RiskDashboardSkeleton />}>
                <RiskIntelCard risks={filteredRisks} />
            </React.Suspense>

            <ScrollableTabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as RiskTab)} isChanging={loading} />

            <RiskTabsContent
                activeTab={activeTab}
                loading={loading}
                filteredRisks={filteredRisks}
                activeFilters={activeFilters}
                setActiveFilters={setActiveFilters}
                savedViews={savedViews}
                activeViewId={activeViewId}
                handleViewSelect={handleViewSelect}
                handleSaveView={handleSaveView}
                isFiltersModified={isFiltersModified}
                viewMode={viewMode}
                setViewMode={setViewMode}
                frameworkFilter={frameworkFilter}
                setFrameworkFilter={setFrameworkFilter}
                showAdvancedSearch={showAdvancedSearch}
                setShowAdvancedSearch={setShowAdvancedSearch}
                handleCommonExport={handleCommonExport}
                exportCSV={exportCSV}
                handleExportExcel={handleExportExcel}
                setImportModalOpen={setImportModalOpen}
                setIsTemplateModalOpen={setIsTemplateModalOpen}
                handleStartAiAnalysis={handleStartAiAnalysis}
                setCreationMode={setCreationMode}
                canEdit={canEdit}
                isAnalyzing={isAnalyzing}
                availableCategories={availableCategories.filter((c): c is string => !!c)}
                matrixFilter={matrixFilter}
                setMatrixFilter={setMatrixFilter}
                handleEdit={handleEdit}
                handleDeleteRiskItem={handleDeleteRiskItem}
                handleDuplicateRisk={handleDuplicateRisk}
                bulkDeleteRisks={bulkDeleteRisks}
                setSelectedRisk={setSelectedRisk}
                duplicatingIds={duplicatingIds}
                assets={assets}
                emptyStateTitle={emptyStateTitle}
                emptyStateDescription={emptyStateDescription}
                emptyStateActionLabel={emptyStateActionLabel}
                handleEmptyAction={handleEmptyAction}
            />

            {/* Modals & Inspectors */}
            <AnimatePresence>
                {selectedRisk && (
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
                        onUpdate={async (id, data) => { await updateRisk(id, data as Partial<Risk>, selectedRisk); return true; }}
                        onDelete={handleDeleteRiskItem}
                        onDuplicate={handleDuplicateRisk}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {creationMode && (
                    <Drawer
                        isOpen={creationMode}
                        onClose={() => { setCreationMode(false); setEditingRisk(null); setIsFormDirty(false); }}
                        title={editingRisk ? t('risks.editRisk') : t('risks.newRisk')}
                        hasUnsavedChanges={isFormDirty}
                    >
                        <React.Suspense fallback={<Spinner />}>
                            <RiskForm
                                onSubmit={handleFormSubmit}
                                onCancel={() => { setCreationMode(false); setEditingRisk(null); setIsFormDirty(false); }}
                                onDirtyChange={setIsFormDirty}
                                initialData={editingRisk || initialFormData || undefined}
                                isLoading={submitting}
                                assets={assets}
                                processes={processes}
                                controls={controls}
                                suppliers={suppliers}
                                usersList={usersList}
                            />
                        </React.Suspense>
                    </Drawer>
                )}
            </AnimatePresence>

            <RiskTemplateModal
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onSelectTemplate={handleTemplateSelect}
                users={usersList}
            />
            <RiskImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                importRisks={importRisks}
            />
            <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData(prev => ({ ...prev, isOpen: false }))} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} />

            {/* Save View Modal */}
            {showSaveViewModal && (
                <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-card rounded-2xl p-6 max-w-md mx-4 shadow-apple-xl border border-border/50">
                        <h3 className="text-lg font-semibold mb-4">{t('risks.saveViewTitle', { defaultValue: 'Sauvegarder la vue' })}</h3>
                        <input
                            type="text"
                            value={viewName}
                            onChange={(e) => setViewName(e.target.value)}
                            placeholder={t('risks.viewNamePlaceholder', { defaultValue: 'Nom de la vue...' })}
                            className="w-full px-4 py-2 rounded-xl border border-border bg-background text-foreground mb-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmSaveView(); }}
                        />
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => { setShowSaveViewModal(false); setViewName(''); }} className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                                {t('common.cancel', { defaultValue: 'Annuler' })}
                            </button>
                            <button onClick={handleConfirmSaveView} disabled={!viewName.trim()} className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {t('common.save', { defaultValue: 'Enregistrer' })}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
};
