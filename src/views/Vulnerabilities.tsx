import React, { useState, useEffect } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { useStore } from '../store';
import { Vulnerability } from '../types';
import { VulnerabilityDashboard } from '../components/vulnerabilities/VulnerabilityDashboard';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useVulnerabilities } from '../hooks/useVulnerabilities';
import { useVulnerabilitiesData } from '../hooks/vulnerabilities/useVulnerabilitiesData';

import { PageHeader } from '../components/ui/PageHeader';
import { Bug, Plus, Upload, MoreVertical } from '../components/ui/Icons';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';

import { PremiumPageControl } from '../components/ui/PremiumPageControl';

import { ErrorLogger } from '../services/errorLogger';
import { useLocation } from 'react-router-dom';
import { Drawer } from '../components/ui/Drawer';
import { VulnerabilityForm } from '../components/vulnerabilities/VulnerabilityForm';
import { VulnerabilityList } from '../components/vulnerabilities/VulnerabilityList';
import { VulnerabilityKanban } from '../components/vulnerabilities/VulnerabilityKanban';
import { usePersistedState } from '../hooks/usePersistedState';
import { canEditResource, canDeleteResource } from '../utils/permissions';
import { VulnerabilityImportModal } from '../components/vulnerabilities/VulnerabilityImportModal';

import { SEO } from '../components/SEO';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';

export const Vulnerabilities: React.FC = () => {
    const { user, t } = useStore();
    const location = useLocation();

    // Mode
    const [creationMode, setCreationMode] = useState(false);
    const [viewMode, setViewMode] = usePersistedState<'list' | 'grid' | 'kanban'>('vulns_view_mode', 'list');

    const [selectedVulnerability, setSelectedVulnerability] = useState<Vulnerability | null>(null);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, loading?: boolean, closeOnConfirm?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const [importModalOpen, setImportModalOpen] = useState(false);
    const [filter, setFilter] = useState('');

    // Actions Hook
    const {
        addVulnerability,
        updateVulnerability,
        deleteVulnerability,
        loading: loadingAction
    } = useVulnerabilities();

    // Data Hook
    const {
        vulnerabilities,
        assets,
        projects,
        users,
        loading: loadingData
    } = useVulnerabilitiesData(user?.organizationId);

    const filteredVulnerabilities = React.useMemo(() => {
        return vulnerabilities.filter(v => (v.title || '').toLowerCase().includes(filter.toLowerCase()) || v.cveId?.toLowerCase().includes(filter.toLowerCase()));
    }, [vulnerabilities, filter]);

    const loading = loadingData;

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || vulnerabilities.length === 0) return;
        const vuln = vulnerabilities.find(v => v.id === state.voxelSelectedId);
        if (vuln) {
            setSelectedVulnerability(vuln);
        }
    }, [location.state, loading, vulnerabilities]);

    const handleCreate = async (data: Partial<Vulnerability>) => {
        if (!user?.organizationId) return;
        try {
            await addVulnerability(data);
            setCreationMode(false);
        } catch (error) {
            ErrorLogger.warn('Creation handled in hook');
        }
    };

    const handleUpdate = async (data: Partial<Vulnerability>) => {
        if (!selectedVulnerability || !selectedVulnerability.id) return;
        try {
            await updateVulnerability(selectedVulnerability.id, data || {});
            setSelectedVulnerability(null);
        } catch (error) {
            ErrorLogger.warn('Update handled in hook');
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            await deleteVulnerability(id);
            if (selectedVulnerability?.id === id) setSelectedVulnerability(null);
            setConfirmData(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            ErrorLogger.warn('Delete handled in hook');
        } finally {
            setConfirmData(prev => ({ ...prev, loading: false }));
        }
    };

    const initiateDelete = (id: string) => {
        if (!canDeleteResource(user, 'Vulnerability')) return;
        setConfirmData({
            isOpen: true,
            title: t('vulnerabilities.deleteTitle'),
            message: t('vulnerabilities.deleteMessage'),
            onConfirm: () => handleDelete(id),
            closeOnConfirm: false
        });
    };

    const canEdit = canEditResource(user, 'Vulnerability');

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO
                title={t('vulnerabilities.title')}
                description="Gestion des vulnérabilités, veille CVE et remédiation."
                keywords="CVE, CVSS, Vulnérabilités, Patch Management"
            />
            <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} loading={confirmData.loading || loadingAction} closeOnConfirm={confirmData.closeOnConfirm} />

            <VulnerabilityImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onImport={async () => {
                    // Logic for file handling usually in component or hook
                    // Here passing empty implementation as Placeholder for future CSV logic if needed
                }}
            />

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title={t('vulnerabilities.title')}
                    subtitle={t('vulnerabilities.subtitle')}
                    icon={<Bug className="h-6 w-6 text-white" strokeWidth={2.5} />}
                    trustType="integrity"
                    breadcrumbs={[{ label: t('common.pilotage') }, { label: t('sidebar.vulnerabilities') }]}
                />
            </motion.div>

            <motion.div variants={slideUpVariants} className="glass-panel p-6 md:p-8 rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-lg relative overflow-hidden">
                <VulnerabilityDashboard vulnerabilities={vulnerabilities} />
            </motion.div>

            <PremiumPageControl
                searchQuery={filter}
                onSearchChange={setFilter}
                searchPlaceholder={t('vulnerabilities.searchPlaceholder')}
                viewMode={viewMode}
                onViewModeChange={(mode) => setViewMode(mode as any)}
                actions={
                    canEdit && (
                        <>
                            <div className="flex items-center">
                                <Menu as="div" className="relative inline-block text-left mr-2">
                                    <Menu.Button className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
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
                                                <Menu.Item>
                                                    {({ active }) => (
                                                        <button
                                                            aria-label="Import Scan"
                                                            onClick={() => setImportModalOpen(true)}
                                                            className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                                } group flex w-full items-center rounded-lg px-2 py-2 text-sm`}
                                                        >
                                                            <Upload className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />
                                                            Import Scan
                                                        </button>
                                                    )}
                                                </Menu.Item>
                                            </div>
                                        </Menu.Items>
                                    </Transition>
                                </Menu>

                                <CustomTooltip content="Create new vulnerability">
                                    <button
                                        onClick={() => setCreationMode(true)}
                                        className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-brand-600/20"
                                        aria-label="Create new vulnerability"
                                    >
                                        <Plus className="h-5 w-5 mr-2" />
                                        <span className="hidden sm:inline">{t('vulnerabilities.declare')}</span>
                                    </button>
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
                    />
                ) : (
                    <VulnerabilityList
                        vulnerabilities={filteredVulnerabilities}
                        viewMode={viewMode}
                        onSelect={setSelectedVulnerability}
                        onDelete={initiateDelete}
                        loading={loading}
                    />
                )}
            </motion.div>

            {/* Create Drawer */}
            <Drawer
                isOpen={creationMode}
                onClose={() => setCreationMode(false)}
                title={t('vulnerabilities.declare')}
                subtitle="Nouvealle vulnérabilité"
                width="max-w-4xl"
            >
                <div className="p-6">
                    <VulnerabilityForm
                        onSubmit={handleCreate}
                        onCancel={() => setCreationMode(false)}
                        assets={assets}
                        projects={projects}
                        users={users} // Pass users if needed for assignment
                        isLoading={loadingAction}
                    />
                </div>
            </Drawer>

            {/* Edit/Inspect Drawer */}
            <Drawer
                isOpen={!!selectedVulnerability}
                onClose={() => setSelectedVulnerability(null)}
                title={selectedVulnerability?.title || ''}
                subtitle="Détails de la vulnérabilité"
                width="max-w-4xl"
            >
                <div className="p-6">
                    {selectedVulnerability && (
                        <VulnerabilityForm
                            initialData={selectedVulnerability}
                            onSubmit={handleUpdate}
                            onCancel={() => setSelectedVulnerability(null)}
                            assets={assets}
                            projects={projects}
                            users={users}
                            isLoading={loadingAction}
                        />
                    )}
                </div>
            </Drawer>

        </motion.div>
    );
};
