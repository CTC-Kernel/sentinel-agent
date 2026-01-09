import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import {
    FileText, FileSpreadsheet, FileCode, MoreVertical,
    Plus, BrainCircuit, ShieldAlert, Copy, HelpCircle, Filter, LayoutDashboard, List, Grid3x3, Upload
} from 'lucide-react';
import { OnboardingService } from '../services/onboardingService';
import { ErrorLogger } from '../services/errorLogger';
import { PageHeader } from '../components/ui/PageHeader';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { AdvancedSearch } from '../components/ui/AdvancedSearch';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { ObsidianService } from '../services/ObsidianService';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile, Risk } from '../types';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { usePersistedState } from '../hooks/usePersistedState';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';


import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { ImportService } from '../services/ImportService';

// New Optimized Hooks
import { useRiskLogic } from '../hooks/risks/useRiskLogic';
import { useRiskDependencies } from '../hooks/risks/useRiskDependencies';
import { useRiskActions } from '../hooks/risks/useRiskActions';
import { useRiskFilters } from '../hooks/risks/useRiskFilters';
import { RiskCalculator } from '../utils/RiskCalculator';

import { RiskFormData } from '../schemas/riskSchema';
import { RiskList } from '../components/risks/RiskList';
import { RiskGrid } from '../components/risks/RiskGrid';
import { RiskMatrix } from '../components/risks/RiskMatrix';
import { RiskDashboard } from '../components/risks/RiskDashboard';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Button } from '../components/ui/button';

import { Drawer } from '../components/ui/Drawer';
import { RiskForm } from '../components/risks/RiskForm';
import { RiskInspector } from '../components/risks/RiskInspector';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { RiskTemplateModal } from '../components/risks/RiskTemplateModal';
import { aiService } from '../services/aiService';
import { PdfService } from '../services/PdfService';
import { useStore } from '../store';
import { toast } from 'sonner';
import { canEditResource } from '../utils/permissions';
import { useAuth } from '../hooks/useAuth';

export const Risks: React.FC = () => {
    // Hooks
    const { user } = useAuth();
    const { demoMode, t } = useStore();

    // 1. Core Data (Always Fetch)
    const { risks, loading: loadingRisks } = useRiskLogic();

    // Permissions
    const canEdit = canEditResource(user as UserProfile, 'Risk');

    // UI State
    const [creationMode, setCreationMode] = useState(false);
    const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
    const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
    const [viewMode, setViewMode] = usePersistedState<'list' | 'grid' | 'matrix'>('risks-view-mode', 'grid');
    const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'matrix'>('overview');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [confirmData, setConfirmData] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [initialFormData, setInitialFormData] = useState<Partial<RiskFormData> | undefined>(undefined);

    // 2. Dependency Fetches (Lazy Loading)
    // We fetch dependencies if:
    // - We are creating/editing a risk (Form needs assets, controls, etc)
    // - A risk is selected (Inspector needs details)
    // - Logic requires users check (Assignment)
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
        fetchUsers: true, // Always fetch users for avatars in list
        fetchAssets: true, // List consumes asset names often, and empty state checks assets. Keep it active for now or optimize further.
        fetchControls: shouldFetchDetails,
        fetchProcesses: shouldFetchDetails,
        fetchSuppliers: shouldFetchDetails,
        fetchAudits: shouldFetchDetails,
        fetchProjects: shouldFetchDetails
    });

    const loading = loadingRisks || (shouldFetchDetails && loadingDeps);

    // 3. Actions
    // Refresh is handled via Firestore realtime, so onRefresh can be no-op or specific trigger if needed
    const {
        createRisk, updateRisk, deleteRisk, bulkDeleteRisks,
        exportCSV, setIsGeneratingReport, submitting,
        importRisks, checkDependencies
    } = useRiskActions(() => { }); // Realtime updates handle refresh

    // Start module tour
    useEffect(() => {
        const timer = setTimeout(() => {
            OnboardingService.startRisksTour();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    // Sanitize and Filters
    // Sanitize and Filters
    // Risks are already sanitized in useRiskLogic

    const {
        activeFilters, setActiveFilters,
        filteredRisks,
        showAdvancedSearch, setShowAdvancedSearch,
        frameworkFilter, setFrameworkFilter,
        matrixFilter, setMatrixFilter
    } = useRiskFilters(risks);

    // URL Params
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const deepLinkRiskId = searchParams.get('id');
    const deepLinkAction = searchParams.get('action');
    const deepLinkAssetId = searchParams.get('createForAsset');

    // Deep Link Logic
    useEffect(() => {
        if (loading) return;

        if (deepLinkRiskId && risks.length > 0) {
            const risk = risks.find(r => r.id === deepLinkRiskId);
            if (risk && selectedRisk?.id !== risk.id) {
                setSelectedRisk(risk);
            }
        } else if (deepLinkAction === 'create' && !creationMode) {
            setInitialFormData(undefined);
            setCreationMode(true);
            setSearchParams(params => { params.delete('action'); return params; }, { replace: true });
        } else if (deepLinkAssetId && !creationMode) {
            setInitialFormData({ assetId: deepLinkAssetId });
            setCreationMode(true);
            setSearchParams(params => { params.delete('createForAsset'); return params; }, { replace: true });
        }
    }, [loading, deepLinkRiskId, deepLinkAction, deepLinkAssetId, risks, creationMode, selectedRisk, setSearchParams]);

    // Cleanup ID param
    useEffect(() => {
        if (loading) return;
        if (!selectedRisk && deepLinkRiskId) {
            setSearchParams(params => { params.delete('id'); return params; }, { replace: true });
        }
    }, [selectedRisk, deepLinkRiskId, setSearchParams, loading]);

    // Legacy State Support (Asset Inspector)
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
        // Check dependencies when user tries to delete
        const { hasDependencies, dependencies } = await checkDependencies(risk.id);

        let message = t('risks.deleteMessage');
        if (hasDependencies && dependencies && dependencies.length > 0) {
            const depDetails = dependencies.slice(0, 5).map((d) => `${d.type}: ${d.name}`).join(', ');
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
        const prob = Number(data.probability) || 1;
        const imp = Number(data.impact) || 1;
        const resProb = Number(data.residualProbability) || prob;
        const resImp = Number(data.residualImpact) || imp;

        // Use Calculator for consistent scoring
        const score = RiskCalculator.calculateScore(undefined, prob, imp);
        const residualScore = RiskCalculator.calculateResidualScore(resProb, resImp);

        const cleanedData = {
            ...data,
            probability: prob as Risk['probability'],
            impact: imp as Risk['impact'],
            residualProbability: resProb as Risk['probability'],
            residualImpact: resImp as Risk['impact'],
            score: score,
            residualScore: residualScore,
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

    const handleStartAiAnalysis = useCallback(async () => {
        setIsAnalyzing(true);
        try {
            const prompt = t('risks.aiPrompt', { count: filteredRisks.length });
            const analysis = await aiService.chatWithAI(prompt);
            toast.info(t('risks.analysisComplete'), { description: analysis, duration: 10000 });
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Risks.handleStartAiAnalysis', 'AI_ERROR');
            toast.error(t('risks.analysisError'));
        } finally {
            setIsAnalyzing(false);
        }
    }, [filteredRisks.length, t]);

    const handleTemplateSelect = useCallback(async (template: { risks: Partial<Risk>[] }, ownerId: string) => {
        const promises = template.risks.map((risk: Partial<Risk>) => {
            const prob = Number(risk.probability) || 1;
            const imp = Number(risk.impact) || 1;
            const score = RiskCalculator.calculateScore(undefined, prob, imp);

            return createRisk({
                threat: risk.threat,
                vulnerability: risk.vulnerability,
                probability: risk.probability,
                impact: risk.impact,
                score, // Calculated score
                strategy: risk.strategy,
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

    // Helpers
    const handleDuplicateRisk = useCallback((r: Risk) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, history, ...rest } = r;
        createRisk({
            ...rest,
            threat: `${r.threat} (${t('common.copy')})`,
            status: 'Ouvert'
        });
    }, [t, createRisk]);

    const handleEmptyAction = useCallback(() => {
        if (assets.length > 0) {
            setCreationMode(true);
        } else {
            navigate('/assets');
        }
    }, [assets.length, navigate]);

    const handleImportFile = async (file: File) => {
        const text = await file.text();
        const success = await importRisks(text);
        if (success) setImportModalOpen(false);
    };

    // Role Logic
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

            <ScrollableTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as 'overview' | 'list' | 'matrix')}
            />

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" key="overview-tab" data-tour="risks-stats">
                    <RiskDashboard risks={filteredRisks} />
                </motion.div>
            )}

            {/* CONTENT TABS */}
            {activeTab !== 'overview' && (
                <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" key="filter-bar">
                    <PremiumPageControl
                        searchQuery={activeFilters.query}
                        onSearchChange={(q) => setActiveFilters(prev => ({ ...prev, query: q }))}
                        searchPlaceholder={t('risks.searchPlaceholder')}
                        activeView={activeTab === 'list' ? viewMode : undefined}
                        onViewChange={activeTab === 'list' ? (m) => setViewMode(m as 'list' | 'grid' | 'matrix') : undefined}
                        viewOptions={[
                            { id: 'list', label: t('assets.viewList'), icon: List },
                            { id: 'grid', label: t('assets.viewGrid'), icon: Grid3x3 }
                        ]}
                        actions={
                            <>
                                <div className="hidden md:block w-48">
                                    <CustomSelect
                                        value={frameworkFilter}
                                        onChange={(v) => setFrameworkFilter(v as string)}
                                        options={[
                                            { value: '', label: t('risks.allFrameworks') },
                                            { value: 'ISO 27001', label: 'ISO 27001' },
                                            { value: 'ISO 27005', label: 'ISO 27005' },
                                            { value: 'EBIOS', label: 'EBIOS RM' },
                                            { value: 'NIST', label: 'NIST' }
                                        ]}
                                        placeholder={t('risks.framework')}
                                    />
                                </div>

                                <div className="h-8 w-px bg-slate-200 dark:bg-white/10 mx-2 hidden md:block" />

                                <CustomTooltip content={t('risks.startTour')}>
                                    <Button variant="outline" size="icon" onClick={() => OnboardingService.startRisksTour()}>
                                        <HelpCircle className="h-5 w-5" />
                                    </Button>
                                </CustomTooltip>

                                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                                <CustomTooltip content={t('assets.advancedFilters')}>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        data-tour="risks-filters"
                                        onClick={() => setShowAdvancedSearch(prev => !prev)}
                                        className={showAdvancedSearch ? 'bg-brand-50 text-brand-600 border-brand-100' : ''}
                                    >
                                        <Filter className="h-5 w-5" />
                                    </Button>
                                </CustomTooltip>

                                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                                <Menu as="div" className="relative inline-block text-left">
                                    <Menu.Button as={Button} variant="outline" size="icon">
                                        <MoreVertical className="h-5 w-5" />
                                    </Menu.Button>
                                    <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                        <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                            <div className="p-1">
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button onClick={handleCommonExport} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                            <FileText className="mr-2 h-4 w-4" /> {t('risks.reports')} (PDF)
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button onClick={() => exportCSV(filteredRisks)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                            <FileSpreadsheet className="mr-2 h-4 w-4" /> {t('risks.exportCsv')}
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button onClick={() => ObsidianService.exportRisksToObsidian(filteredRisks)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                            <FileCode className="mr-2 h-4 w-4" /> {t('risks.obsidian')}
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            </div>
                                            {canEdit && (
                                                <div className="p-1">
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button onClick={() => setImportModalOpen(true)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                                <Upload className="mr-2 h-4 w-4" /> {t('risks.importCsv')}
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button onClick={() => setIsTemplateModalOpen(true)} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                                <Copy className="mr-2 h-4 w-4" /> {t('risks.templates')}
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                </div>
                                            )}
                                        </Menu.Items>
                                    </Transition>
                                </Menu>

                                {canEdit && (
                                    <>
                                        <CustomTooltip content="Lancer l'analyse IA">
                                            <Button
                                                onClick={handleStartAiAnalysis}
                                                disabled={isAnalyzing}
                                                isLoading={isAnalyzing}
                                                variant="premium"
                                                className="hidden lg:flex"
                                            >
                                                {!isAnalyzing && <BrainCircuit className="h-4 w-4 mr-2" />}
                                                <span className="hidden xl:inline">{isAnalyzing ? t('risks.analyzing') : t('risks.aiAnalysis')}</span>
                                            </Button>
                                        </CustomTooltip>
                                        <CustomTooltip content="Créer un nouveau risque">
                                            <Button
                                                data-tour="risks-create"
                                                onClick={() => { setEditingRisk(null); setCreationMode(true); }}
                                                variant="default"
                                                className="shadow-lg shadow-brand-500/20"
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                <span className="hidden sm:inline">{t('risks.newRisk')}</span>
                                            </Button>
                                        </CustomTooltip>
                                    </>
                                )}
                            </>
                        }
                    />
                </motion.div>
            )}

            <AnimatePresence>
                {showAdvancedSearch && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <AdvancedSearch onSearch={(filters) => { setActiveFilters(prev => ({ ...prev, query: filters.query })); setShowAdvancedSearch(false); }} onClose={() => setShowAdvancedSearch(false)} />
                    </motion.div>
                )}
            </AnimatePresence>

            {activeTab === 'list' && (
                <motion.div variants={slideUpVariants} initial="initial" animate="visible" exit="exit" className="mt-8">
                    {viewMode === 'list' ? (
                        <RiskList
                            risks={filteredRisks}
                            loading={loading}
                            canEdit={canEdit}
                            onEdit={handleEdit}
                            onDelete={handleDeleteRiskItem}
                            onBulkDelete={bulkDeleteRisks}
                            onSelect={setSelectedRisk}
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
                <motion.div variants={slideUpVariants} initial="initial" animate="visible" className="p-1">
                    {matrixFilter && (
                        <div className="bg-brand-50 dark:bg-brand-900/20 p-4 rounded-2xl border border-brand-100 dark:border-brand-900/30 flex justify-between items-center mb-6">
                            <span className="text-sm font-bold text-brand-900 dark:text-brand-100">
                                {t('risks.matrix')} : {t('risks.searchPlaceholder')}
                            </span>
                            <button type="button" onClick={() => setMatrixFilter(null)} className="text-xs text-red-500 font-bold hover:underline">{t('common.reset')}</button>
                        </div>
                    )}
                    <RiskMatrix
                        risks={filteredRisks}
                        matrixFilter={matrixFilter}
                        setMatrixFilter={(f) => { setMatrixFilter(f); if (f) setActiveTab('list'); }}
                        frameworkFilter={frameworkFilter}
                    />
                </motion.div>
            )}

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

            <Drawer
                isOpen={creationMode}
                onClose={() => setCreationMode(false)}
                title={editingRisk ? t('risks.editRisk') : t('risks.newRisk')}
                width="max-w-6xl"
            >
                <div className="p-6">
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

            <ImportGuidelinesModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                entityName={t('risks.title')}
                guidelines={{
                    required: ['menace', 'probabilite', 'gravite', 'strategie'],
                    optional: ['description', 'vulnerabilite', 'statut', 'proprietaire'],
                    format: 'CSV'
                }}
                onImport={handleImportFile}
                onDownloadTemplate={() => ImportService.downloadRiskTemplate()}
            />
        </motion.div>
    );
};
