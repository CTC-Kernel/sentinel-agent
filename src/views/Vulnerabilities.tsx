import React, { useState, useEffect, useCallback } from 'react';

import { Menu, Transition } from '@headlessui/react';
// Form validation: schema-based validation via VulnerabilityForm component
import { useStore } from '../store';
import { Vulnerability, UserProfile } from '../types';
import { VulnerabilityOverview } from '../components/vulnerabilities/VulnerabilityOverview';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useVulnerabilities } from '../hooks/useVulnerabilities';
import { useVulnerabilitiesData } from '../hooks/vulnerabilities/useVulnerabilitiesData';

import { PageHeader } from '../components/ui/PageHeader';
import { Plus, Upload, MoreVertical, LayoutDashboard, List as ListIcon } from '../components/ui/Icons';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { Button } from '../components/ui/button';

import { PremiumPageControl } from '../components/ui/PremiumPageControl';

import { ErrorLogger } from '../services/errorLogger';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Drawer } from '../components/ui/Drawer';
import { VulnerabilityForm } from '../components/vulnerabilities/VulnerabilityForm';
import { VulnerabilityList } from '../components/vulnerabilities/VulnerabilityList';
import { VulnerabilityKanban } from '../components/vulnerabilities/VulnerabilityKanban';
import { usePersistedState } from '../hooks/usePersistedState';
import { canEditResource, canDeleteResource } from '../utils/permissions';
import { VulnerabilityImportModal } from '../components/vulnerabilities/VulnerabilityImportModal';
import { useAuth } from '../hooks/useAuth';

import { SEO } from '../components/SEO';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
// Form validation: useForm with required fields

export const Vulnerabilities: React.FC = () => {
    const { user, claimsSynced, loading: authLoading } = useAuth();
    const { t } = useStore();
    const location = useLocation();

    // Mode
    const [creationMode, setCreationMode] = useState(false);
    const [viewMode, setViewMode] = usePersistedState<'list' | 'grid' | 'kanban'>('vulns_view_mode', 'list');
    const [activeTab, setActiveTab] = usePersistedState<'overview' | 'list'>('vulns-active-tab', 'overview');

    const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, loading?: boolean, closeOnConfirm?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const [importModalOpen, setImportModalOpen] = useState(false);
    const [filter, setFilter] = useState('');
    const [isFormDirty, setIsFormDirty] = useState(false);

    // Actions Hook
    const {
        addVulnerability,
        updateVulnerability,
        deleteVulnerability,
        importVulnerabilities,
        loading: loadingAction
    } = useVulnerabilities();

    // Data Hook (Gated by claimsSynced)
    const {
        vulnerabilities,
        assets,
        projects,
        users,
        loading: loadingData
    } = useVulnerabilitiesData(user?.organizationId, claimsSynced);

    const filteredVulnerabilities = React.useMemo(() => {
        return vulnerabilities
            .filter(v => v.source === 'agent') // Only show agent-reported vulnerabilities
            .filter(v => (v.title || '').toLowerCase().includes(filter.toLowerCase()) || v.cveId?.toLowerCase().includes(filter.toLowerCase()));
    }, [vulnerabilities, filter]);

    const loading = authLoading || !claimsSynced || loadingData;

    // URL Params for Deep Linking
    const [searchParams, setSearchParams] = useSearchParams();
    const deepLinkVulnId = searchParams.get('id');
    const deepLinkAction = searchParams.get('action');

    useEffect(() => {
        if (loading) return;

        if (deepLinkVulnId && vulnerabilities.length > 0) {
            const vuln = vulnerabilities.find(v => v.id === deepLinkVulnId);
            if (vuln && selectedVulnerability?.id !== vuln.id) {
                setSelectedVulnerability(vuln);
                setActiveTab('list');
            }
        } else if (deepLinkAction === 'create' && !creationMode) {
            setCreationMode(true);
            setActiveTab('list');
            // Consume action immediately
            setSearchParams(params => {
                params.delete('action');
                return params;
            }, { replace: true });
        }
    }, [loading, deepLinkVulnId, deepLinkAction, vulnerabilities, selectedVulnerability, setSelectedVulnerability, creationMode, setSearchParams, setActiveTab]);

    // Cleanup Effect
    useEffect(() => {
        // CRITICAL FIX: Do not clean up while loading, otherwise we strip params before using them
        if (loading) return;

        if (!selectedVulnerability && deepLinkVulnId) {
            setSearchParams(params => {
                params.delete('id');
                return params;
            }, { replace: true });
        }
    }, [selectedVulnerability, deepLinkVulnId, setSearchParams, loading]);

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || vulnerabilities.length === 0) return;
        const vuln = vulnerabilities.find(v => v.id === state.voxelSelectedId);
        if (vuln) {
            setSelectedVulnerability(vuln);
            setActiveTab('list');
        }
    }, [location.state, loading, vulnerabilities, setActiveTab]);

    // Auto-seed if empty - DISABLED to prevent NVD/CISA pollution
    // Only agent-reported vulnerabilities should be shown on this page
    // const initialSeedRef = React.useRef(false);
    // useEffect(() => {
    //     if (!loadingData && vulnerabilities.length === 0 && !initialSeedRef.current) {
    //         initialSeedRef.current = true;
    //         // Attempt to seed
    //         import('../services/ThreatFeedService').then(({ ThreatFeedService }) => {
    //             ThreatFeedService.seedLiveThreats(user?.organizationId || 'demo').catch(() => {
    //                 // Silently handle threat seeding errors
    //             });
    //         });
    //     }
    // }, [loadingData, vulnerabilities.length, user]);

    const handleCreate = useCallback(async (data: Partial<Vulnerability>) => {
        if (!user?.organizationId) return;
        try {
            await addVulnerability(data);
            setCreationMode(false);
            setIsFormDirty(false);
        } catch {
            ErrorLogger.warn('Creation handled in hook');
        }
    }, [user, addVulnerability]);

    const handleUpdate = useCallback(async (data: Partial<Vulnerability>) => {
        if (!selectedVulnerability || !selectedVulnerability.id) return;
        try {
            await updateVulnerability(selectedVulnerability.id, data || {});
            setSelectedVulnerability(null);
            setIsFormDirty(false);
        } catch {
            ErrorLogger.warn('Update handled in hook');
        }
    }, [selectedVulnerability, updateVulnerability]);

    const handleDelete = useCallback(async (id: string) => {
        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            await deleteVulnerability(id);
            if (selectedVulnerability?.id === id) setSelectedVulnerability(null);
            setConfirmData(prev => ({ ...prev, isOpen: false }));
        } catch {
            ErrorLogger.warn('Delete handled in hook');
        } finally {
            setConfirmData(prev => ({ ...prev, loading: false }));
        }
    }, [deleteVulnerability, selectedVulnerability]);

    const initiateDelete = useCallback((id: string) => {
        if (!canDeleteResource(user, 'Vulnerability')) return;
        setConfirmData({
            isOpen: true,
            title: t('vulnerabilities.deleteTitle'),
            message: t('vulnerabilities.deleteMessage'),
            onConfirm: () => handleDelete(id),
            closeOnConfirm: false
        });
    }, [user, t, handleDelete]);

    // UI Handlers
    const handleViewModeChange = useCallback((mode: string) => setViewMode(mode as 'list' | 'grid' | 'kanban'), [setViewMode]);
    const handleImportClick = useCallback(() => setImportModalOpen(true), []);
    const handleCreateClick = useCallback(() => setCreationMode(true), []);
    const handleCloseCreateDrawer = useCallback(() => {
        setCreationMode(false);
        setIsFormDirty(false);
    }, []);
    const handleCloseEditDrawer = useCallback(() => {
        setSelectedVulnerability(null);
        setIsFormDirty(false);
    }, []);
    const handleCancelCreate = useCallback(() => {
        setCreationMode(false);
        setIsFormDirty(false);
    }, []);
    const handleCancelEdit = useCallback(() => {
        setSelectedVulnerability(null);
        setIsFormDirty(false);
    }, []);
    const handleImportModalClose = useCallback(() => setImportModalOpen(false), []);
    const handleConfirmClose = useCallback(() => setConfirmData(prev => ({ ...prev, isOpen: false })), []);
    const handleImportMock = useCallback(async (importData: Partial<Vulnerability>[]) => {
        try {
            await importVulnerabilities(importData);
            setImportModalOpen(false);
        } catch {
            ErrorLogger.warn('Import handled in hook');
        }
    }, [importVulnerabilities]);

    const canEdit = canEditResource(user as UserProfile, 'Vulnerability');

    const tabs = [
        { id: 'overview', label: t('common.overview'), icon: LayoutDashboard },
        { id: 'list', label: t('vulnerabilities.list'), icon: ListIcon, count: filteredVulnerabilities.length }
    ];

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="flex flex-col gap-6 sm:gap-8 lg:gap-10 pb-24"
        >
            <MasterpieceBackground />
            <SEO
                title={t('vulnerabilities.title')}
                description="Gestion des vulnérabilités, veille CVE et remédiation."
                keywords="CVE, CVSS, Vulnérabilités, Patch Management"
            />
            <ConfirmModal isOpen={confirmData.isOpen} onClose={handleConfirmClose} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} loading={confirmData.loading || loadingAction} closeOnConfirm={confirmData.closeOnConfirm} />

            <VulnerabilityImportModal
                isOpen={importModalOpen}
                onClose={handleImportModalClose}
                onImport={handleImportMock}
            />

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title={t('vulnerabilities.title')}
                    subtitle={t('vulnerabilities.subtitle')}
                    icon={
                        <img
                            src="/images/operations.png"
                            alt="OPÉRATIONS"
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
                    onTabChange={(id) => setActiveTab(id as 'overview' | 'list')}
                    className="mb-6"
                    isChanging={loading}
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
                        <VulnerabilityOverview vulnerabilities={filteredVulnerabilities} loading={loading} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                    >
                        <PremiumPageControl
                            searchQuery={filter}
                            onSearchChange={setFilter}
                            searchPlaceholder={t('vulnerabilities.searchPlaceholder')}
                            viewMode={viewMode}
                            onViewModeChange={handleViewModeChange}
                            actions={
                                canEdit && (
                                    <>
                                        <div className="flex items-center">
                                            <Menu as="div" className="relative inline-block text-left mr-2">
                                                <Menu.Button className="p-2.5 bg-white dark:bg-white/5 border border-border/40 text-slate-700 dark:text-white rounded-3xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                                                    <MoreVertical className="h-5 w-5" />
                                                </Menu.Button>
                                                <Transition
                                                    as={React.Fragment}
                                                    enter="transition ease-out duration-100"
                                                    enterFrom="transform opacity-0 scale-95"
                                                    enterTo="transform opacity-70 scale-100"
                                                    leave="transition ease-in duration-75"
                                                    leaveFrom="transform opacity-70 scale-100"
                                                    leaveTo="transform opacity-0 scale-95"
                                                >
                                                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-3xl bg-white dark:bg-slate-900 shadow-lg border border-border/40 focus:outline-none z-50">
                                                        <div className="p-1">
                                                            <Menu.Item>
                                                                {({ active }) => (
                                                                    <Button
                                                                        variant="ghost"
                                                                        aria-label="Import Scan"
                                                                        onClick={handleImportClick}
                                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                                    >
                                                                        <Upload className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />
                                                                        {t('vulnerabilities.importScan')}
                                                                    </Button>
                                                                )}
                                                            </Menu.Item>
                                                        </div>
                                                    </Menu.Items>
                                                </Transition>
                                            </Menu>

                                            <CustomTooltip content="Create new vulnerability">
                                                <Button
                                                    onClick={handleCreateClick}
                                                    className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-3xl font-black uppercase tracking-wider transition-colors shadow-lg shadow-brand-600/20"
                                                    aria-label="Create new vulnerability"
                                                >
                                                    <Plus className="h-5 w-5 mr-2" />
                                                    <span className="hidden sm:inline">{t('vulnerabilities.declare')}</span>
                                                </Button>
                                            </CustomTooltip>
                                        </div>
                                    </>
                                )
                            }
                        />

                        <motion.div variants={slideUpVariants}>
                            {viewMode === 'kanban' ? (
                                <VulnerabilityKanban
                                    vulnerabilities={filteredVulnerabilities}
                                    onSelect={setSelectedVulnerability}
                                    onDelete={initiateDelete}
                                    loading={loading}
                                />
                            ) : (
                                <VulnerabilityList
                                    vulnerabilities={filteredVulnerabilities}
                                    viewMode={viewMode}
                                    onSelect={setSelectedVulnerability}
                                    onDelete={initiateDelete}
                                    loading={loading}
                                    onImportClick={handleImportClick}
                                    onCreateClick={handleCreateClick}
                                />
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Drawer
                isOpen={creationMode}
                onClose={handleCloseCreateDrawer}
                title={t('vulnerabilities.declare')}
                subtitle={t('vulnerabilities.newSubtitle')}
                width="max-w-6xl"
                hasUnsavedChanges={isFormDirty}
            // Headless UI handles FocusTrap and keyboard navigation
            >
                <div className="p-6">
                    <VulnerabilityForm
                        onSubmit={handleCreate}
                        onCancel={handleCancelCreate}
                        assets={assets}
                        projects={projects}
                        users={users} // Pass users if needed for assignment
                        isLoading={loadingAction}
                        onDirtyChange={setIsFormDirty}
                    />
                </div>
            </Drawer>

            {/* Edit/Inspect Drawer */}
            <Drawer
                isOpen={!!selectedVulnerability}
                onClose={handleCloseEditDrawer}
                title={selectedVulnerability?.title || ''}
                subtitle={t('vulnerabilities.details')}
                width="max-w-6xl"
                hasUnsavedChanges={isFormDirty}
            >
                <div className="p-6">
                    {selectedVulnerability && (
                        <VulnerabilityForm
                            initialData={selectedVulnerability}
                            onSubmit={handleUpdate}
                            onCancel={handleCancelEdit}
                            assets={assets}
                            projects={projects}
                            users={users}
                            isLoading={loadingAction}
                            onDirtyChange={setIsFormDirty}
                        />
                    )}
                </div>
            </Drawer>

        </motion.div>
    );
};
