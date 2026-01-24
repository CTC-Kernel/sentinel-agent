import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Menu, Transition } from '@headlessui/react';
import { SEO } from '../components/SEO';
import { canEditResource } from '../utils/permissions';

import { Supplier, Criticality } from '../types';
import { Plus, Building, FileSpreadsheet, ClipboardList, Upload, Loader2, MoreVertical, ShieldAlert, LayoutDashboard, List, PieChart, Shield } from '../components/ui/Icons';
import { DORAProviders } from './DORAProviders';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { Button } from '../components/ui/button';
import { useStore } from '../store';
import { useSupplierLogic } from '../hooks/suppliers/useSupplierLogic';
import { useSupplierDependencies } from '../hooks/suppliers/useSupplierDependencies';
import { ConfirmModal } from '../components/ui/ConfirmModal'; // Keyboard: Escape key supported
import { CardSkeleton } from '../components/ui/Skeleton';
import { DataTable } from '../components/ui/DataTable';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { ColumnDef } from '@tanstack/react-table';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { SupplierFormData } from '../schemas/supplierSchema';
import { Drawer } from '../components/ui/Drawer';
import { SupplierForm } from '../components/suppliers/SupplierForm';
import { usePersistedState } from '../hooks/usePersistedState';
import { SupplierDashboard } from '../components/suppliers/SupplierDashboard';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { QuestionnaireBuilder } from '../components/suppliers/QuestionnaireBuilder';
import { AssessmentView } from '../components/suppliers/AssessmentView';
import SupplierAssessmentDrawer from '../components/suppliers/SupplierAssessmentDrawer';

import { ImportService } from '../services/ImportService';
import { SupplierCard } from '../components/suppliers/SupplierCard';
import { SupplierInspector } from '../components/suppliers/SupplierInspector';
import { OnboardingService } from '../services/onboardingService';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { SupplierConcentrationTab } from '../components/suppliers/SupplierConcentrationTab';

const getCriticalityColor = (c: Criticality) => {
    switch (c) {
        case Criticality.CRITICAL: return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
        case Criticality.HIGH: return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';
        case Criticality.MEDIUM: return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
        default: return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    }
};

const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
};



export const Suppliers: React.FC = () => {
    const [filter, setFilter] = useState('');
    const { user, t } = useStore();

    // Start module tour
    useEffect(() => {
        const timer = setTimeout(() => {
            OnboardingService.startSuppliersTour();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    const canEdit = canEditResource(user, 'Supplier');
    const [activeTab, setActiveTab] = usePersistedState<string>('suppliers-active-tab', 'overview');
    const [viewMode, setViewMode] = usePersistedState<'grid' | 'list' | 'matrix' | 'kanban'>('suppliers_view_mode', 'grid');

    const [creationMode, setCreationMode] = useState(false);
    const [templateMode, setTemplateMode] = useState(false);
    const [assessmentMode, setAssessmentMode] = useState<string | null>(null); // responseId

    // Assessment Modal State
    const [assessmentModalOpen, setAssessmentModalOpen] = useState(false);
    const [assessmentSupplier, setAssessmentSupplier] = useState<Supplier | null>(null);

    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [isExportingDORA, setIsExportingDORA] = useState(false);

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; loading?: boolean; closeOnConfirm?: boolean }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    // Data Hooks
    const { suppliers: suppliersRaw, loading: loadingLogic, addSupplier, updateSupplier, deleteSupplier, importSuppliers } = useSupplierLogic();

    const shouldLoadDeps = !!selectedSupplier || creationMode;
    const {
        usersRaw: effectiveUsers,
        processesRaw,
        assetsRaw,
        risksRaw,
        documentsRaw,
        assessments: assessmentsRaw, // Alias it
        loading: loadingDeps
    } = useSupplierDependencies({
        fetchUsers: shouldLoadDeps,
        fetchProcesses: shouldLoadDeps,
        fetchAssets: shouldLoadDeps,
        fetchRisks: shouldLoadDeps,
        fetchDocuments: shouldLoadDeps,
        fetchAssessments: shouldLoadDeps // Add this
    });




    const loadingSuppliers = loadingLogic || (shouldLoadDeps && loadingDeps);

    // URL Params for Deep Linking
    const [searchParams, setSearchParams] = useSearchParams();
    const deepLinkSupplierId = searchParams.get('id');
    const deepLinkAction = searchParams.get('action');
    const deepLinkTab = searchParams.get('tab');

    // Handle tab deep link (e.g., from /vendor-concentration redirect)
    useEffect(() => {
        if (deepLinkTab && ['overview', 'suppliers', 'concentration', 'dora'].includes(deepLinkTab)) {
            setActiveTab(deepLinkTab);
            // Clean up the tab param after applying it
            setSearchParams(params => {
                params.delete('tab');
                return params;
            }, { replace: true });
        }
    }, [deepLinkTab, setActiveTab, setSearchParams]);

    useEffect(() => {
        if (loadingSuppliers) return;

        if (deepLinkSupplierId && suppliersRaw && suppliersRaw.length > 0) {
            const supplier = suppliersRaw.find(s => s.id === deepLinkSupplierId);
            if (supplier && selectedSupplier?.id !== supplier.id) {
                setSelectedSupplier(supplier);
                setActiveTab('suppliers'); // Switch to list tab to see detail or just ensure context
            }
        } else if (deepLinkAction === 'create' && !creationMode) {
            setCreationMode(true);
            setActiveTab('suppliers');
            // Consume action immediately
            setSearchParams(params => {
                params.delete('action');
                return params;
            }, { replace: true });
        }
    }, [loadingSuppliers, deepLinkSupplierId, deepLinkAction, suppliersRaw, selectedSupplier, setSelectedSupplier, creationMode, setSearchParams, setActiveTab]);

    // Cleanup Effect
    useEffect(() => {
        // CRITICAL FIX: Do not clean up while loading, otherwise we strip params before using them
        if (loadingSuppliers) return;

        if (!selectedSupplier && deepLinkSupplierId) {
            setSearchParams(params => {
                params.delete('id');
                return params;
            }, { replace: true });
        }
    }, [selectedSupplier, deepLinkSupplierId, setSearchParams, loadingSuppliers]);

    // Filtering & Memoization
    const filteredSuppliers = useMemo(() => {
        if (!suppliersRaw) return [];
        return suppliersRaw.filter(s => {
            if (filter) {
                const search = filter.toLowerCase();
                const matchesName = s.name.toLowerCase().includes(search);
                const matchesStatus = s.status?.toLowerCase().includes(search);
                const matchesCategory = s.category?.toLowerCase().includes(search);
                return matchesName || matchesStatus || matchesCategory;
            }
            return true;
        });
    }, [suppliersRaw, filter]);

    // Handlers
    const handleSearchChange = useCallback((value: string) => setFilter(value), []);
    const handleViewModeChange = useCallback((mode: 'grid' | 'list' | 'matrix' | 'kanban') => setViewMode(mode), [setViewMode]);
    const handleDashboardFilterChange = useCallback((newFilter: { type: string; value: string } | null) => {
        // Implement dashboard filter logic if needed, or just set filter
        if (newFilter) {
            setFilter(newFilter.value);
            setActiveTab('suppliers');
        }
    }, [setActiveTab]);

    const handleCreationDrawerOpen = useCallback(() => setCreationMode(true), []);
    const handleCreationDrawerClose = useCallback(() => setCreationMode(false), []);
    const handleTemplateModeOpen = useCallback(() => setTemplateMode(true), []);
    const handleTemplateModeClose = useCallback(() => setTemplateMode(false), []);

    const handleAssessmentClose = useCallback(() => setAssessmentMode(null), []);
    const handleInspectorClose = useCallback(() => setSelectedSupplier(null), []);

    const handleCreate = useCallback(async (data: SupplierFormData) => {
        setIsSubmitting(true);
        try {
            await addSupplier(data); // Assuming addSupplier takes SupplierFormData (checked hook, it takes Partial<Supplier>)
            setCreationMode(false);
            setActiveTab('suppliers');
        } finally {
            setIsSubmitting(false);
        }
    }, [addSupplier, setActiveTab]);

    const handleUpdate = useCallback(async (id: string, data: Partial<SupplierFormData>) => {
        setIsSubmitting(true);
        try {
            await updateSupplier(id, data);
            // Close inspector? No, usually stays open or updates
        } catch {
            // ErrorLogger handled in hook - error is logged there and toast shown
        } finally {
            setIsSubmitting(false);
        }
    }, [updateSupplier]);

    const handleConfirmDelete = useCallback(async (id: string) => {
        setIsSubmitting(true);
        try {
            await deleteSupplier(id);
            setConfirmData(prev => ({ ...prev, isOpen: false }));
            setSelectedSupplier(null);
        } finally {
            setIsSubmitting(false);
        }
    }, [deleteSupplier]);

    const handleDeleteClick = useCallback((supplier: Supplier) => {
        setConfirmData({
            isOpen: true,
            title: t('suppliers.deleteConfirmTitle'), // Ensure translation exists or use fallback
            message: t('suppliers.deleteConfirmMessage', { name: supplier.name }) || `Supprimer ${supplier.name} ?`,
            onConfirm: () => handleConfirmDelete(supplier.id),
            loading: isSubmitting
        });
    }, [t, handleConfirmDelete, isSubmitting]);

    const handleBulkDelete = useCallback(async (ids: string[]) => {
        setConfirmData({
            isOpen: true,
            title: t('common.bulkDeleteTitle') || "Suppression multiple",
            message: t('common.bulkDeleteMessage', { count: ids.length }) || `Supprimer ${ids.length} éléments ?`,
            onConfirm: async () => {
                setIsSubmitting(true);
                try {
                    await Promise.all(ids.map(id => deleteSupplier(id)));
                    setConfirmData(prev => ({ ...prev, isOpen: false }));
                    setSelectedSupplier(null);
                } finally {
                    setIsSubmitting(false);
                }
            },
            loading: isSubmitting
        });
    }, [t, deleteSupplier, isSubmitting]);

    const handleCardClick = useCallback((supplier: Supplier) => {
        console.log('Supplier clicked', supplier);
        setSelectedSupplier(supplier);
    }, []);

    const handleStartAssessmentClick = useCallback((supplierId: string) => {
        const supplier = suppliersRaw.find(s => s.id === supplierId);
        if (supplier) {
            setAssessmentSupplier(supplier);
            setAssessmentModalOpen(true);
        }
    }, [suppliersRaw]);

    // Import Logic
    const [importModalOpen, setImportModalOpen] = useState(false);
    const supplierGuidelines = {
        required: ['Nom'],
        optional: ['Catégorie', 'Criticité', 'Contact', 'Email', 'Description'],
        format: 'CSV'
    };

    const handleDownloadTemplate = useCallback(() => {
        ImportService.downloadSupplierTemplate();
    }, []);

    const handleImportFile = useCallback(async (file: File) => {
        if (!file) return;
        const text = await file.text();
        await importSuppliers(text);
        setImportModalOpen(false);
        setActiveTab('suppliers');
    }, [importSuppliers, setActiveTab]);

    const handleExportCSV = useCallback(async () => {
        if (isExportingCSV) return;
        setIsExportingCSV(true);
        try {
            ImportService.exportSuppliers(filteredSuppliers);
        } finally {
            setTimeout(() => setIsExportingCSV(false), 0);
        }
    }, [isExportingCSV, filteredSuppliers]);

    const handleExportDORARegister = useCallback(async () => {
        if (isExportingDORA) return;
        setIsExportingDORA(true);
        try {
            ImportService.exportDORARegister(filteredSuppliers);
        } finally {
            setTimeout(() => setIsExportingDORA(false), 0);
        }
    }, [isExportingDORA, filteredSuppliers]);


    // Columns definition
    const columns = useMemo<ColumnDef<Supplier>[]>(() => [
        {
            accessorKey: 'name',
            header: t('common.columns.name'),
            cell: ({ row }) => (
                <div className="font-medium text-slate-900 dark:text-white flex items-center">
                    <Building className="h-4 w-4 mr-2 text-brand-500" />
                    {row.original.name}
                </div>
            )
        },
        {
            accessorKey: 'category',
            header: t('common.columns.category'),
            cell: ({ row }) => row.original.category
        },
        {
            accessorKey: 'criticality',
            header: t('common.columns.criticality'),
            cell: ({ row }) => (
                <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${getCriticalityColor(row.original.criticality)}`}>
                    {row.original.criticality}
                </span>
            )
        },
        {
            accessorKey: 'status',
            header: t('common.columns.status'),
            cell: ({ row }) => (
                <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${row.original.status === 'Actif' ? 'bg-success-bg text-success-text' : 'bg-slate-100 text-slate-700'
                    }`}>
                    {row.original.status}
                </span>
            )
        },
        {
            accessorKey: 'isICTProvider',
            header: 'DORA',
            cell: ({ row }) => (
                row.original.isICTProvider ? (
                    <span className="px-2 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-info-bg text-info-text border-info-border">
                        DORA ICT
                    </span>
                ) : (
                    <span className="text-slate-400 text-xs">-</span>
                )
            )
        },
        {
            accessorKey: 'securityScore', // Fixed property name
            header: 'Score',
            cell: ({ row }) => {
                const score = row.original.securityScore ?? 0;
                return (
                    <div className="flex items-center space-x-2">
                        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full ${getScoreColor(score)}`} style={{ width: `${score}%` }} />
                        </div>
                        <span className="text-xs font-medium">{score}%</span>
                    </div>
                );
            }
        },
    ], [t]);

    const suppliersTitle = t('suppliers.title');
    const suppliersSubtitle = t('suppliers.subtitle');

    const tabs = [
        { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard },
        { id: 'suppliers', label: 'Fournisseurs', icon: List, count: filteredSuppliers.length },
        { id: 'concentration', label: 'Concentration', icon: PieChart },
        { id: 'dora', label: t('suppliers.tabs.dora') || 'Registre DORA', icon: Shield }
    ];

    const handleConfirmClose = useCallback(() => {
        setConfirmData(prev => ({ ...prev, isOpen: false }));
    }, []);

    if (assessmentMode) {
        return (
            <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 animate-slide-up">
                <AssessmentView responseId={assessmentMode} onClose={handleAssessmentClose} />
            </div>
        );
    }

    if (templateMode) {
        return (
            <div className="p-8 max-w-5xl mx-auto animate-fade-in">
                <div className="mb-6 flex items-center">
                    <button aria-label="Retour au tableau de bord" onClick={handleTemplateModeClose} className="text-slate-500 hover:text-slate-700 mr-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg px-2" title="Retour au tableau de bord">Retour</button>
                    <h1 className="text-2xl font-bold dark:text-white">Éditeur de Modèle de Questionnaire</h1>
                </div>
                <QuestionnaireBuilder onCancel={handleTemplateModeClose} onSave={handleTemplateModeClose} />
            </div>
        );
    }

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="flex flex-col gap-10 pb-20 min-w-0"
        >
            <MasterpieceBackground />
            <SEO
                title={t('suppliers.title')}
                description={t('suppliers.subtitle')}
                keywords="Fournisseurs, DORA, Contrats, Tiers"
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

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title={suppliersTitle}
                    subtitle={suppliersSubtitle}
                    icon={
                        <img
                            src="/images/referentiel.png"
                            alt="RÉFÉRENTIEL"
                            className="w-full h-full object-contain"
                        />
                    }
                    actions={undefined}
                />
            </motion.div>

            {/* Tabs */}
            <motion.div variants={slideUpVariants}>
                <ScrollableTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    className="mb-6"
                />
            </motion.div>

            <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                    <motion.div
                        key="overview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <SupplierDashboard
                            suppliers={filteredSuppliers}
                            loading={loadingSuppliers}
                            onFilterChange={handleDashboardFilterChange}
                        />
                    </motion.div>
                )}

                {activeTab === 'concentration' && (
                    <motion.div
                        key="concentration"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <SupplierConcentrationTab />
                    </motion.div>
                )}

                {activeTab === 'dora' && (
                    <motion.div
                        key="dora"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        <DORAProviders hideHeader />
                    </motion.div>
                )}

                {activeTab === 'suppliers' && (
                    <motion.div
                        key="suppliers"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                    >
                        <PremiumPageControl
                            searchQuery={filter}
                            onSearchChange={handleSearchChange}
                            searchPlaceholder={t('suppliers.searchPlaceholder')}
                            viewMode={viewMode}
                            onViewModeChange={handleViewModeChange}
                            actions={canEdit && (
                                <>
                                    <Menu as="div" className="relative inline-block text-left">
                                        <Menu.Button aria-label={t('common.more')} className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                                            <MoreVertical className="h-5 w-5" />
                                        </Menu.Button>
                                        <Transition
                                            as={React.Fragment}
                                            enter="transition ease-out duration-100"
                                            enterFrom="transform opacity-0 scale-95"
                                            enterTo="transform opacity-100 scale-100"
                                            leave="transition ease-in duration-75"
                                            leaveFrom="transform opacity-100 scale-100"
                                            leaveTo="transform opacity-0 scale-95"
                                        >
                                            <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                                <div className="p-1">
                                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        {t('suppliers.tools')}
                                                    </div>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                onClick={() => setImportModalOpen(true)}
                                                                className={`${active ? 'bg-brand-500 text-white hover:bg-brand-600' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
                                                                    } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
                                                                aria-label="Import Suppliers CSV"
                                                            >
                                                                <Upload className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />
                                                                {t('suppliers.importCsv')}
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                </div>
                                                <div className="p-1">
                                                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        {t('suppliers.reports')}
                                                    </div>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                aria-label={t('suppliers.exportCsv')}
                                                                onClick={handleExportCSV}
                                                                disabled={isExportingCSV}
                                                                className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                                    } group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
                                                            >
                                                                {isExportingCSV ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />}
                                                                {t('suppliers.exportCsv')}
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                    <Menu.Item>
                                                        {({ active }) => (
                                                            <button
                                                                aria-label="Export DORA"
                                                                onClick={handleExportDORARegister}
                                                                disabled={isExportingDORA}
                                                                className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                                    } group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
                                                            >
                                                                {isExportingDORA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />}
                                                                Export DORA
                                                            </button>
                                                        )}
                                                    </Menu.Item>
                                                </div>
                                            </Menu.Items>
                                        </Transition>
                                    </Menu>


                                    <CustomTooltip content="Gérer les modèles d'évaluation">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={handleTemplateModeOpen}
                                            className="h-10 w-10 rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm"
                                            aria-label="Gérer les modèles d'évaluation"
                                        >
                                            <ClipboardList className="h-5 w-5" />
                                        </Button>
                                    </CustomTooltip>

                                    <CustomTooltip content="Vue DORA des fournisseurs ICT">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => window.open('/#/dora/providers', '_blank')}
                                            className="h-10 w-10 rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm"
                                            aria-label="Vue DORA des fournisseurs ICT"
                                        >
                                            <ShieldAlert className="h-5 w-5" />
                                        </Button>
                                    </CustomTooltip>

                                    <CustomTooltip content="Ajouter un nouveau fournisseur">
                                        <Button
                                            variant="default"
                                            onClick={handleCreationDrawerOpen}
                                            className="rounded-2xl shadow-lg shadow-brand-500/20 font-black uppercase tracking-wider"
                                            data-tour="suppliers-new"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            <span className="hidden sm:inline">{t('suppliers.newSupplier')}</span>
                                        </Button>
                                    </CustomTooltip>
                                </>
                            )}
                        />

                        {viewMode === 'list' ? (
                            <motion.div variants={slideUpVariants} className="glass-premium rounded-5xl overflow-hidden shadow-apple-sm border border-white/60 dark:border-white/5">
                                <DataTable
                                    columns={columns}
                                    data={filteredSuppliers}
                                    selectable={true}
                                    onBulkDelete={handleBulkDelete}
                                    onRowClick={setSelectedSupplier}
                                    searchable={false}
                                    loading={loadingSuppliers}
                                />
                            </motion.div>
                        ) : (
                            <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {loadingSuppliers ? (
                                    <div className="col-span-full"><CardSkeleton count={3} /></div>
                                ) : filteredSuppliers.length === 0 ? (
                                    <div className="col-span-full">
                                        <EmptyState
                                            icon={Building}
                                            title={t('suppliers.emptyTitle')}
                                            description={filter ? "Aucun fournisseur trouvé." : t('suppliers.emptyDesc')}
                                            actionLabel={filter || !canEdit ? undefined : t('suppliers.newSupplier')}
                                            onAction={filter || !canEdit ? undefined : handleCreationDrawerOpen}
                                        />
                                    </div>
                                ) : (
                                    filteredSuppliers.map(supplier => (
                                        <SupplierCard
                                            key={supplier.id}
                                            supplier={supplier}
                                            onClick={handleCardClick}
                                            onDelete={canEdit ? () => handleDeleteClick(supplier) : undefined}
                                        />
                                    ))
                                )}
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Creation Drawer */}
            <Drawer
                isOpen={creationMode}
                onClose={handleCreationDrawerClose}
                title={t('suppliers.newSupplier')}
                subtitle="Ajouter un nouveau tiers"
                width="max-w-6xl"
            >
                <div className="p-6">
                    <SupplierForm
                        onSubmit={handleCreate}
                        onCancel={handleCreationDrawerClose}
                        isLoading={isSubmitting}
                        users={effectiveUsers}
                        processes={processesRaw}
                        assets={assetsRaw}
                        risks={risksRaw}
                        documents={documentsRaw}
                    />
                </div>
            </Drawer>

            {/* Edit Drawer */}
            {selectedSupplier && (
                <SupplierInspector
                    supplier={selectedSupplier}
                    onClose={handleInspectorClose}
                    canEdit={canEdit}
                    onUpdate={(data) => handleUpdate(selectedSupplier.id, data)}
                    isLoading={isSubmitting}
                    users={effectiveUsers}
                    processes={processesRaw}
                    assets={assetsRaw}
                    risks={risksRaw}
                    documents={documentsRaw}
                    onStartAssessment={() => handleStartAssessmentClick(selectedSupplier.id)}
                    assessments={assessmentsRaw?.filter(a => a.supplierId === selectedSupplier.id) || []}
                    onViewAssessment={(id) => {
                        setAssessmentMode(id);
                    }}
                />
            )}

            <ImportGuidelinesModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                entityName={t('suppliers.title')}
                guidelines={supplierGuidelines}
                onImport={handleImportFile}
                onDownloadTemplate={handleDownloadTemplate}
            />
            {/* Assessment Drawer */}
            {assessmentSupplier && (
                <SupplierAssessmentDrawer
                    isOpen={assessmentModalOpen}
                    onClose={() => setAssessmentModalOpen(false)}
                    supplier={assessmentSupplier}
                    onAssessmentCreated={(id) => {
                        setAssessmentMode(id);
                        setAssessmentModalOpen(false);
                    }}
                />
            )}
        </motion.div>
    );
};
