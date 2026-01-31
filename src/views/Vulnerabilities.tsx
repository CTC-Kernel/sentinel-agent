import React, { useState, useEffect, useCallback } from 'react';

// Form validation: schema-based validation via VulnerabilityForm component
import { useStore } from '../store';
import { Vulnerability } from '../types';
import { VulnerabilityOverview } from '../components/vulnerabilities/VulnerabilityOverview';
import { useVulnerabilities } from '../hooks/useVulnerabilities';
import { useVulnerabilitiesData } from '../hooks/vulnerabilities/useVulnerabilitiesData';
import { usePersistedState } from '../hooks/usePersistedState';

import { PageHeader } from '../components/ui/PageHeader';
import { LayoutDashboard, List as ListIcon } from '../components/ui/Icons';

import { PremiumPageControl } from '../components/ui/PremiumPageControl';

import { ErrorLogger } from '../services/errorLogger';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Drawer } from '../components/ui/Drawer';
import { VulnerabilityForm } from '../components/vulnerabilities/VulnerabilityForm';
import { VulnerabilityList } from '../components/vulnerabilities/VulnerabilityList';
import { VulnerabilityKanban } from '../components/vulnerabilities/VulnerabilityKanban';

import { AgentVulnerabilityPanel } from '../components/vulnerabilities/AgentVulnerabilityPanel';
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
    const [searchParams, setSearchParams] = useSearchParams();

    // Mode
    const [viewMode, setViewMode] = usePersistedState<'list' | 'grid' | 'kanban'>('vulns_view_mode', 'list');
    const [activeTab, setActiveTab] = usePersistedState<'overview' | 'list'>('vulns-active-tab', 'overview');

    const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);
    const [filter, setFilter] = useState('');
    const [isFormDirty, setIsFormDirty] = useState(false);

    // Actions Hook
    const {
        updateVulnerability,
        deleteVulnerability,
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
    const deepLinkVulnId = searchParams.get('id');

    useEffect(() => {
        if (loading) return;

        if (deepLinkVulnId && vulnerabilities.length > 0) {
            const vuln = vulnerabilities.find(v => v.id === deepLinkVulnId);
            if (vuln && selectedVulnerability?.id !== vuln.id) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setSelectedVulnerability(vuln);
                setActiveTab('list');
            }
        }
    }, [loading, deepLinkVulnId, vulnerabilities, selectedVulnerability, setSelectedVulnerability, setActiveTab]);

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
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedVulnerability(vuln);
            setActiveTab('list');
        }
    }, [location.state, loading, vulnerabilities, setActiveTab]);

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
        try {
            await deleteVulnerability(id);
            if (selectedVulnerability?.id === id) setSelectedVulnerability(null);
        } catch {
            ErrorLogger.warn('Delete handled in hook');
        }
    }, [deleteVulnerability, selectedVulnerability]);

    // UI Handlers
    const handleViewModeChange = useCallback((mode: string) => setViewMode(mode as 'list' | 'grid' | 'kanban'), [setViewMode]);

    const handleCloseEditDrawer = useCallback(() => {
        setSelectedVulnerability(null);
        setIsFormDirty(false);
    }, []);
    const handleCancelEdit = useCallback(() => {
        setSelectedVulnerability(null);
        setIsFormDirty(false);
    }, []);



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

            <AnimatePresence mode="popLayout">
                {activeTab === 'overview' ? (
                    <motion.div
                        key="overview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                    >
                        <VulnerabilityOverview vulnerabilities={filteredVulnerabilities} loading={loading} />
                        <AgentVulnerabilityPanel
                            onVulnerabilityClick={(vuln) => {
                                const match = vulnerabilities.find(v => v.cveId === vuln.cveId);
                                if (match) {
                                    setSelectedVulnerability(match);
                                    setActiveTab('list');
                                }
                            }}
                        />
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
                        // No actions for Agent-only view
                        />

                        <motion.div variants={slideUpVariants}>
                            {viewMode === 'kanban' ? (
                                <VulnerabilityKanban
                                    vulnerabilities={filteredVulnerabilities}
                                    onSelect={setSelectedVulnerability}
                                    onDelete={handleDelete}
                                    loading={loading}
                                />
                            ) : (
                                <VulnerabilityList
                                    vulnerabilities={filteredVulnerabilities}
                                    viewMode={viewMode}
                                    onSelect={setSelectedVulnerability}
                                    onDelete={handleDelete}
                                    loading={loading}
                                />
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
