import React, { useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import {
    FileText, FileSpreadsheet, FileCode, MoreVertical,
    Loader2, Plus, BrainCircuit, ShieldAlert, Copy, HelpCircle, Filter, LayoutDashboard, List, Grid3x3, Upload
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
import { UserProfile } from '../types';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { usePersistedState } from '../hooks/usePersistedState';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';

const riskGuidelines = {
    required: ['menace', 'probabilite', 'gravite', 'strategie'],
    optional: ['description', 'vulnerabilite', 'statut', 'proprietaire'],
    format: 'CSV'
};
import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { CsvParser } from '../utils/csvUtils';

import { useRiskData } from '../hooks/risks/useRiskData';
import { useRiskActions } from '../hooks/risks/useRiskActions';
import { useRiskFilters } from '../hooks/risks/useRiskFilters';

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
import { Risk } from '../types';
import { canEditResource } from '../utils/permissions';
import { useAuth } from '../hooks/useAuth';
// Form validation: useForm with required fields

export const Risks: React.FC = () => {
    // Hooks
    const { user } = useAuth(); // Prefer useAuth for user object
    const { demoMode, t } = useStore();
    const { risks, loading, assets, controls, projects, audits, suppliers, usersList, rawProcesses, refreshRisks } = useRiskData();

    // Permission check
    const canEdit = canEditResource(user as UserProfile, 'Risk');

    const {
        createRisk, updateRisk, deleteRisk, bulkDeleteRisks,
        exportCSV, isGeneratingReport, setIsGeneratingReport, submitting, isExportingCSV,
        importRisks, isImporting, checkDependencies // Destructured here
    } = useRiskActions(refreshRisks);

    // ... existing code ...

    const handleDelete = React.useCallback(async (risk: { id: string, name: string }) => {
        // Optimistic UI or Loading state could be added here if checkDependencies is slow
        // For now, we just await it.
        if (!canEditResource(user as UserProfile, 'Risk')) {
            toast.error("Permission refusée");
            return;
        }
        const { hasDependencies, dependencies } = await checkDependencies(risk.id);

        let message = t('risks.deleteMessage');
        if (hasDependencies && dependencies && dependencies.length > 0) {
            const depDetails = dependencies.map((d: { type: string; name: string }) => `${d.type}: ${d.name}`).join(', ');
            message = t('risks.deleteWarning', { count: dependencies.length, details: depDetails.slice(0, 100) + (depDetails.length > 100 ? '...' : '') });
        }

        setConfirmData({
            isOpen: true,
            title: t('risks.deleteTitle'),
            message: message,
            onConfirm: () => deleteRisk(risk.id, risk.name)
        });
    }, [user, t, checkDependencies, deleteRisk]);

    // ... existing code ...



    const {
        activeFilters, setActiveFilters,
        filteredRisks,
        showAdvancedSearch, setShowAdvancedSearch,
        frameworkFilter, setFrameworkFilter,
        matrixFilter, setMatrixFilter
    } = useRiskFilters(risks);



    // Local UI State
    const [creationMode, setCreationMode] = useState(false);
    const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
    const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
    const [confirmData, setConfirmData] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [viewMode, setViewMode] = usePersistedState<'list' | 'grid'>('risks-view-mode', 'grid');
    const [activeTab, setActiveTab] = useState<'overview' | 'list' | 'matrix'>('overview');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // const [isImporting, setIsImporting] = useState(false); // Removed local state
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

    const [initialFormData, setInitialFormData] = useState<Partial<RiskFormData> | undefined>(undefined);

    // ... URL Params ...
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const deepLinkRiskId = searchParams.get('id');

    // ... Deep Linking Effect ...
    React.useEffect(() => {
        if (!loading && deepLinkRiskId && risks.length > 0) {
            const risk = risks.find(r => r.id === deepLinkRiskId);
            if (risk) {
                setSelectedRisk(risk);
            }
        }
    }, [loading, deepLinkRiskId, risks]);

    // Handle navigation from AssetInspector (Create Risk for Asset)
    React.useEffect(() => {
        const state = location.state as { createForAsset?: string; assetName?: string } | null;
        if (state?.createForAsset && !creationMode) {
            setInitialFormData({
                assetId: state.createForAsset
            });
            setCreationMode(true);
            // Clear state to prevent reopening on refresh (optional, but good practice)
            window.history.replaceState({}, document.title);
        }
    }, [location.state, creationMode]);


    // Refs


    // Helper functions
    // Helper functions
    const handleEdit = React.useCallback((risk: Risk) => {
        if (!canEditResource(user as UserProfile, 'Risk')) return;
        setEditingRisk(risk);
        setInitialFormData(undefined); // Clear initial data when editing existing
        setCreationMode(true);
    }, [user]);



    const handleExportExecutive = React.useCallback(async () => {
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
            toast.error(t('risks.reportError'));
        } finally {
            setIsGeneratingReport(false);
        }
    }, [filteredRisks, t, user, setIsGeneratingReport]);

    const handleExportPDF = React.useCallback(async () => {
        // Re-using executive report for now as it's the main PDF export
        handleExportExecutive();
    }, [handleExportExecutive]);

    // Import Logic
    const [importModalOpen, setImportModalOpen] = useState(false);



    const handleDownloadTemplate = React.useCallback(() => {
        const headers = [...riskGuidelines.required, ...riskGuidelines.optional];
        const exampleRow = {
            menace: "Ransomware Attack",
            probabilite: "3",
            gravite: "4",
            strategie: "Atténuer",
            description: "Chiffrement des données par un malware",
            vulnerabilite: "Patching non à jour",
            statut: "Ouvert",
            proprietaire: "john.doe@example.com"
        };
        CsvParser.downloadCSV(headers, [exampleRow], `template_risks.csv`);
    }, []);

    const handleImportFile = async (file: File) => {
        const text = await file.text();
        const success = await importRisks(text);
        if (success) {
            setImportModalOpen(false);
        }
    };


    // Callbacks
    const handleFilterChange = React.useCallback((filter: { type: string; value: string } | null) => {
        if (!filter) {
            setActiveFilters(prev => ({ ...prev, query: '' }));
            setFrameworkFilter('');
        } else if (filter.type === 'level') {
            setFrameworkFilter('');
        }
    }, [setActiveFilters, setFrameworkFilter]);

    const handleSearchChange = React.useCallback((q: string) => {
        setActiveFilters(prev => ({ ...prev, query: q }));
    }, [setActiveFilters]);



    const handleFrameworkChange = React.useCallback((val: string | string[]) => {
        setFrameworkFilter(val as string);
    }, [setFrameworkFilter]);

    const handleStartTour = React.useCallback(() => {
        OnboardingService.startRisksTour();
    }, []);

    const handleAdvancedSearch = React.useCallback((filters: { query: string }) => {
        setActiveFilters(prev => ({ ...prev, query: filters.query }));
        setShowAdvancedSearch(false);
    }, [setActiveFilters, setShowAdvancedSearch]);

    const handleDeleteRiskItem = React.useCallback((id: string) => {
        const r = risks.find(x => x.id === id);
        handleDelete({ id, name: r?.threat || t('common.unknown') });
    }, [risks, t, handleDelete]);

    const handleDuplicateRisk = React.useCallback((r: Risk) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, history, ...rest } = r;

        const newRisk: Omit<Risk, 'id'> = {
            ...rest,
            threat: `${r.threat} (${t('common.copy')})`,
            probability: r.probability,
            impact: r.impact,
            status: 'Ouvert',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        createRisk(newRisk as Risk);
    }, [t, createRisk]);

    const handleFormSubmit = React.useCallback(async (data: RiskFormData) => {
        if (editingRisk) {
            await updateRisk(editingRisk.id, {
                ...data,
                probability: data.probability as Risk['probability'],
                impact: data.impact as Risk['impact'],
                residualProbability: data.residualProbability as Risk['probability'],
                residualImpact: data.residualImpact as Risk['impact'],
                aiAnalysis: data.aiAnalysis || undefined
            }, editingRisk);
        } else {
            await createRisk(data as Risk);
        }
        setCreationMode(false);
        setEditingRisk(null);
    }, [editingRisk, updateRisk, createRisk]);

    const handleTemplateSelect = React.useCallback(async (template: { risks: Partial<Risk>[] }, ownerId: string) => {
        const promises = template.risks.map((risk: Partial<Risk>) => createRisk({
            threat: risk.threat,
            vulnerability: risk.vulnerability,
            probability: risk.probability,
            impact: risk.impact,
            strategy: risk.strategy,
            status: 'Ouvert',
            framework: 'ISO27001',
            owner: ownerId,
        }));

        try {
            await Promise.all(promises);
            toast.success(t('risks.templateSuccess', { count: template.risks.length }));
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Risks.handleTemplateSelect', 'CREATE_FAILED');
            toast.error(t('risks.templateError'));
        }
        setIsTemplateModalOpen(false);
    }, [createRisk, t]);


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

    // UI Handlers
    const handleTabChange = React.useCallback((id: string) => setActiveTab(id as 'overview' | 'list' | 'matrix'), [setActiveTab]);
    const handleMatrixFilterChange = React.useCallback((filter: { p: number; i: number } | null) => {
        setMatrixFilter(filter);
        if (filter) setActiveTab('list');
    }, [setMatrixFilter, setActiveTab]);
    const handleViewModeChange = React.useCallback((mode: string) => setViewMode(mode as 'list' | 'grid'), [setViewMode]);
    const handleAdvancedSearchClose = React.useCallback(() => setShowAdvancedSearch(false), [setShowAdvancedSearch]);
    const handleAdvancedSearchToggle = React.useCallback(() => setShowAdvancedSearch(prev => !prev), [setShowAdvancedSearch]);
    const handleResetMatrixFilter = React.useCallback(() => setMatrixFilter(null), [setMatrixFilter]);
    const handleInspectorClose = React.useCallback(() => setSelectedRisk(null), []);
    const handleInspectorDelete = React.useCallback((id: string, name: string) => handleDelete({ id, name }), [handleDelete]);
    const handleCreationClose = React.useCallback(() => setCreationMode(false), []);
    const handleFormCancel = React.useCallback(() => { setCreationMode(false); setEditingRisk(null); }, []);
    const handleTemplateModalClose = React.useCallback(() => setIsTemplateModalOpen(false), []);
    const handleConfirmClose = React.useCallback(() => setConfirmData(prev => ({ ...prev, isOpen: false })), []);
    const handleNewRiskClick = React.useCallback(() => { setEditingRisk(null); setCreationMode(true); }, []);

    // Dynamic Empty State Logic
    const hasAssets = assets.length > 0;
    const emptyStateTitle = hasAssets ? t('risks.emptyTitle') : t('assets.emptyTitle');
    const emptyStateDescription = hasAssets ? t('risks.emptyDesc') : t('assets.emptyDesc');
    const emptyStateActionLabel = hasAssets ? t('risks.newRisk') : t('assets.createAsset');

    const handleEmptyAction = React.useCallback(() => {
        if (hasAssets) {
            setCreationMode(true);
        } else {
            // Navigate to assets page to create an asset
            navigate('/assets');
        }
    }, [hasAssets, navigate]);

    const handleTemplateModalOpen = React.useCallback(() => setIsTemplateModalOpen(true), []);
    const handleObsidianExport = React.useCallback(() => ObsidianService.exportRisksToObsidian(filteredRisks), [filteredRisks]);
    const handleCSVExport = React.useCallback(() => exportCSV(filteredRisks), [exportCSV, filteredRisks]);

    const tabs = React.useMemo(() => [
        { id: 'overview', label: t('risks.overview'), icon: LayoutDashboard },
        { id: 'list', label: t('risks.registry'), icon: List },
        { id: 'matrix', label: t('risks.matrix'), icon: Grid3x3 },
    ], [t]);

    const viewOptions = React.useMemo(() => [
        { id: 'list', label: t('assets.viewList'), icon: List },
        { id: 'grid', label: t('assets.viewGrid'), icon: Grid3x3 }
    ], [t]);


    const handleStartAiAnalysis = React.useCallback(async () => {
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

    return (
        <motion.div variants={staggerContainerVariants} initial="initial" animate="visible" className="space-y-6">
            <MasterpieceBackground />
            <PageHeader
                title={risksTitle}
                subtitle={risksSubtitle}
                icon={<ShieldAlert className="h-6 w-6 text-brand-500" strokeWidth={2.5} />}
                breadcrumbs={[{ label: t('commandPalette.nav.risks') }]}
                trustType="integrity"
            />

            {/* TABS */}
            <ScrollableTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
            />

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <motion.div variants={slideUpVariants} data-tour="risks-stats">
                    <RiskDashboard
                        risks={filteredRisks}
                        assets={assets}
                        onFilterChange={handleFilterChange}
                    />
                </motion.div>
            )}

            {/* FILTER BAR (Visible for List & Matrix) */}
            {activeTab !== 'overview' && (
                <motion.div variants={slideUpVariants}>
                    <PremiumPageControl
                        searchQuery={activeFilters.query}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder={t('risks.searchPlaceholder')}
                        activeView={activeTab === 'list' ? viewMode : undefined}
                        onViewChange={activeTab === 'list' ? handleViewModeChange : undefined}
                        viewOptions={viewOptions}
                        actions={
                            <>
                                {/* Framework Filter */}
                                <div className="hidden md:block w-48">
                                    <CustomSelect
                                        value={frameworkFilter}
                                        onChange={handleFrameworkChange}
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
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleStartTour}
                                        aria-label={t('risks.startTour')}
                                    >
                                        <HelpCircle className="h-5 w-5" />
                                    </Button>
                                </CustomTooltip>

                                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                                <CustomTooltip content={t('assets.advancedFilters')}>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        data-tour="risks-filters"
                                        onClick={handleAdvancedSearchToggle}
                                        aria-label={t('assets.advancedFilters')}
                                        className={`transition-all ${showAdvancedSearch
                                            ? 'bg-brand-50 text-brand-600 border-brand-100 dark:bg-brand-900/20 dark:text-brand-400 dark:border-brand-900/30'
                                            : ''
                                            }`}
                                    >
                                        <Filter className="h-5 w-5" />
                                    </Button>
                                </CustomTooltip>

                                <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                                {/* Actions Menu */}
                                <Menu as="div" className="relative inline-block text-left">
                                    <Menu.Button className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label="More options">
                                        <MoreVertical className="h-5 w-5" />
                                    </Menu.Button>
                                    <Transition as={React.Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                        <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                            <div className="p-1">
                                                <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                    {t('risks.reports')}
                                                </div>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button type="button" aria-label={t('risks.reports')} onClick={handleExportPDF} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}>
                                                            <FileText className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-brand-500'}`} /> {t('risks.reports')} (PDF)
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button type="button" aria-label={t('risks.executiveReport')} onClick={handleExportExecutive} disabled={isGeneratingReport} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                            {isGeneratingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-brand-500'}`} />} {t('risks.executiveReport')}
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button type="button" aria-label={t('risks.exportCsv')} onClick={handleCSVExport} disabled={isExportingCSV} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                            {isExportingCSV ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-emerald-500'}`} />} {t('risks.exportCsv')}
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button type="button" aria-label={t('risks.obsidian')} onClick={handleObsidianExport} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                            <FileCode className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-emerald-500'}`} /> {t('risks.obsidian')}
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            </div>
                                            {canEdit && (
                                                <div className="p-1">
                                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('risks.data')}</div>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                type="button"
                                                                aria-label={t('risks.importCsv')}
                                                                onClick={() => setImportModalOpen(true)}
                                                                disabled={isImporting}
                                                                className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-blue-500'}`} />} {t('risks.importCsv')}
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button type="button" aria-label={t('risks.templates')} onClick={handleTemplateModalOpen} className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'} group flex w-full items-center rounded-lg px-2 py-2 text-sm`}>
                                                                <Copy className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-blue-500'}`} /> {t('risks.templates')}
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                </div>
                                            )}
                                        </Menu.Items>
                                    </Transition>
                                </Menu>

                                {/* Main CTA Actions */}
                                {canEdit && (
                                    <>
                                        <CustomTooltip content="Lancer l'analyse IA">
                                            <Button
                                                onClick={handleStartAiAnalysis}
                                                disabled={isAnalyzing}
                                                isLoading={isAnalyzing}
                                                aria-label={isAnalyzing ? t('risks.analyzing') : t('risks.aiAnalysis')}
                                                className="hidden lg:flex bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/20 border-0"
                                            >
                                                {!isAnalyzing && <BrainCircuit className="h-4 w-4 mr-2" />}
                                                <span className="hidden xl:inline">{isAnalyzing ? t('risks.analyzing') : t('risks.aiAnalysis')}</span>
                                            </Button>
                                        </CustomTooltip>
                                        <CustomTooltip content="Créer un nouveau risque">
                                            <Button
                                                data-tour="risks-create"
                                                onClick={handleNewRiskClick}
                                                aria-label={t('risks.newRisk')}
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

            {/* Hidden Input for Import */}


            {/* Advanced Search Panel Placeholder */}
            <AnimatePresence>
                {showAdvancedSearch && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <AdvancedSearch
                            onSearch={handleAdvancedSearch}
                            onClose={handleAdvancedSearchClose}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* LIST TAB CONTENT */}
            {activeTab === 'list' && (
                <motion.div variants={slideUpVariants} className="">
                    {viewMode === 'list' ? (
                        <RiskList
                            risks={filteredRisks}
                            loading={loading}
                            onEdit={handleEdit}
                            onDelete={handleDeleteRiskItem}
                            onSelect={setSelectedRisk}
                            canEdit={canEdit}
                            onBulkDelete={bulkDeleteRisks}
                            assets={assets}
                            emptyStateTitle={emptyStateTitle}
                            emptyStateDescription={emptyStateDescription}
                            emptyStateActionLabel={canEdit ? emptyStateActionLabel : undefined}
                            onEmptyStateAction={canEdit ? handleEmptyAction : undefined}
                        />
                    ) : (
                        <RiskGrid
                            risks={filteredRisks}
                            loading={loading}
                            assets={assets}
                            onSelect={setSelectedRisk}
                            emptyStateIcon={ShieldAlert}
                            emptyStateTitle={emptyStateTitle}
                            emptyStateDescription={emptyStateDescription}
                            emptyStateActionLabel={canEdit ? emptyStateActionLabel : undefined}
                            onEmptyStateAction={canEdit ? handleEmptyAction : undefined}
                            onEdit={handleEdit}
                            onDelete={handleDeleteRiskItem}
                            canEdit={canEdit}
                        />
                    )}
                </motion.div>
            )}

            {/* MATRIX TAB CONTENT */}
            {activeTab === 'matrix' && (
                <motion.div variants={slideUpVariants} initial="initial" animate="visible" className="p-1">
                    {matrixFilter && (
                        <div className="bg-brand-50 dark:bg-brand-900/20 p-4 rounded-2xl border border-brand-100 dark:border-brand-900/30 flex justify-between items-center mb-6">
                            <span className="text-sm font-bold text-brand-900 dark:text-brand-100">
                                {t('risks.matrix')} : {t('risks.searchPlaceholder')}
                            </span>
                            {/* Note: searchPlaceholder mismatch for Matrix filter, using "Filtre Matrice" text which wasn't fully translated. Let's fix locally or use a placeholder */}
                            <button type="button" onClick={handleResetMatrixFilter} className="text-xs text-red-500 font-bold hover:underline" aria-label={t('common.reset')}>{t('common.reset')}</button>
                        </div>
                    )}
                    <RiskMatrix
                        risks={filteredRisks}
                        matrixFilter={matrixFilter}
                        setMatrixFilter={handleMatrixFilterChange}
                        frameworkFilter={frameworkFilter}
                    />
                </motion.div>
            )}

            <RiskInspector
                isOpen={!!selectedRisk}
                onClose={handleInspectorClose}
                risk={selectedRisk}
                assets={assets}
                controls={controls}
                projects={projects}
                audits={audits}
                suppliers={suppliers}
                usersList={usersList}
                processes={rawProcesses}
                canEdit={canEdit}
                demoMode={demoMode}
                onUpdate={updateRisk}
                onDelete={handleInspectorDelete}
                onDuplicate={handleDuplicateRisk}
            // FocusTrap and keyboard navigation are handled internally by Headless UI's Dialog/Drawer components
            />

            <Drawer
                isOpen={creationMode}
                onClose={handleCreationClose}
                title={t('risks.newRisk')}
                width="max-w-4xl"
            >
                <div className="p-6">
                    <RiskForm
                        initialData={initialFormData} // Use initialFormData state
                        existingRisk={editingRisk}   // existingRisk is null when creating new
                        onSubmit={handleFormSubmit}
                        onCancel={handleFormCancel}
                        assets={assets}
                        usersList={usersList}
                        processes={rawProcesses}
                        suppliers={suppliers}
                        controls={controls}
                        isLoading={submitting}
                    />
                </div>
            </Drawer>

            <RiskTemplateModal
                isOpen={isTemplateModalOpen}
                onClose={handleTemplateModalClose}
                onSelectTemplate={handleTemplateSelect}
                users={usersList}
            />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={handleConfirmClose}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <ImportGuidelinesModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                entityName={t('risks.title')}
                guidelines={riskGuidelines}
                onImport={handleImportFile}
                onDownloadTemplate={handleDownloadTemplate}
            />

        </motion.div>
    );
};
