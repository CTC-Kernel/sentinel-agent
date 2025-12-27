import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, ShieldCheck, Zap, FileText, AlertOctagon,
    Plus, Download
} from 'lucide-react';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { useStore } from '../store';
import { BusinessProcess } from '../types';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { usePersistedState } from '../hooks/usePersistedState';
import { useCallback } from 'react';
import { BusinessProcessFormData } from '../schemas/continuitySchema';
import { ProcessFormModal } from '../components/continuity/ProcessFormModal';
import { ProcessInspector } from '../components/continuity/ProcessInspector';
import { DrillModal } from '../components/continuity/DrillModal';
import { generateContinuityReport } from '../utils/pdfGenerator';
import { ContinuityDashboard } from '../components/continuity/ContinuityDashboard';
import { ContinuityBIA } from '../components/continuity/ContinuityBIA';
import { ContinuityDrills } from '../components/continuity/ContinuityDrills';
import { ContinuityStrategies } from '../components/continuity/ContinuityStrategies';
import { ContinuityCrisis } from '../components/continuity/ContinuityCrisis';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useContinuity } from '../hooks/useContinuity';
import { useContinuityData } from '../hooks/continuity/useContinuityData';
import { ErrorLogger } from '../services/errorLogger';
import { hasPermission, canEditResource, canDeleteResource } from '../utils/permissions';

type ContinuityTab = 'overview' | 'strategies' | 'bia' | 'drills' | 'crisis';

export const Continuity: React.FC = () => {
    const { user, t } = useStore();
    // Use utility functions instead of non-existent hook
    const canCreate = hasPermission(user, 'BusinessProcess', 'create');
    const canUpdate = canEditResource(user, 'BusinessProcess');
    const canDelete = canDeleteResource(user, 'BusinessProcess');
    const [activeTab, setActiveTab] = usePersistedState<ContinuityTab>('continuity_active_tab', 'overview');
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'matrix' | 'kanban'>('grid');
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
    const [selectedProcess, setSelectedProcess] = useState<BusinessProcess | null>(null);
    const [filter, setFilter] = useState('');

    // Actions Hook
    const { addProcess, updateProcess, deleteProcess, addDrill, deleteDrill, loading: loadingAction } = useContinuity();

    // Data Hook
    const {
        processes,
        drills,
        assets,
        risks,
        suppliers,
        users,
        loading: loadingData
    } = useContinuityData(user?.organizationId);

    const [confirmData, setConfirmData] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, loading?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Derived Logic
    const filteredProcesses = useMemo(() => {
        return processes.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    }, [processes, filter]);

    const handleCreateProcess = useCallback(async (data: BusinessProcessFormData) => {
        if (!user?.organizationId) return;
        try {
            await addProcess(data);
            setIsProcessModalOpen(false);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Continuity.handleCreateProcess');
        }
    }, [user, addProcess]);

    const handleUpdateProcess = useCallback(async (data: BusinessProcessFormData) => {
        if (!selectedProcess) return;
        if (!canUpdate) return;
        try {
            await updateProcess(selectedProcess.id, data);
            setSelectedProcess(null);
            setIsProcessModalOpen(false);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Continuity.handleUpdateProcess');
        }
    }, [selectedProcess, canUpdate, updateProcess]);

    const handleDeleteProcess = useCallback(async (id: string) => {
        if (!canDelete) return;
        setConfirmData({
            isOpen: true,
            title: t('continuity.deleteProcessTitle'),
            message: t('continuity.deleteProcessMessage'),
            onConfirm: async () => {
                setConfirmData(prev => ({ ...prev, loading: true }));
                try {
                    await deleteProcess(id);
                    if (selectedProcess?.id === id) setSelectedProcess(null);
                    setConfirmData(prev => ({ ...prev, isOpen: false }));
                } catch (e) {
                    ErrorLogger.handleErrorWithToast(e, 'Continuity.handleDeleteProcess');
                } finally {
                    setConfirmData(prev => ({ ...prev, loading: false }));
                }
            }
        });
    }, [canDelete, t, deleteProcess, selectedProcess]);

    const handleCreateDrill = useCallback(async (data: any) => {
        if (!user?.organizationId) return;
        try {
            await addDrill(data);
            setIsDrillModalOpen(false);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Continuity.handleCreateDrill');
        }
    }, [user, addDrill]);

    const handleDeleteDrill = useCallback(async (id: string) => {
        if (window.confirm("Supprimer cet exercice ?")) {
            try { await deleteDrill(id); } catch (e) { ErrorLogger.handleErrorWithToast(e, 'DeleteDrill'); }
        }
    }, [deleteDrill]);

    const handleGenerateReport = useCallback(() => {
        try {
            generateContinuityReport(processes, drills);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Continuity.generateReport');
        }
    }, [processes, drills]);

    // UI Handlers
    const handleTabChange = useCallback((id: string) => setActiveTab(id as ContinuityTab), [setActiveTab]);
    const handleViewModeChange = useCallback((mode: string) => setViewMode(mode as any), []);
    const handleOpenProcessModal = useCallback(() => setIsProcessModalOpen(true), []);
    const handleCloseProcessModal = useCallback(() => setIsProcessModalOpen(false), []);
    const handleOpenDrillModal = useCallback(() => setIsDrillModalOpen(true), []);
    const handleCloseDrillModal = useCallback(() => setIsDrillModalOpen(false), []);
    const handleInspectorClose = useCallback(() => setSelectedProcess(null), []);
    const handleConfirmClose = useCallback(() => setConfirmData(prev => ({ ...prev, isOpen: false })), []);

    const handleInspectorDelete = useCallback(() => {
        if (selectedProcess) handleDeleteProcess(selectedProcess.id);
    }, [selectedProcess, handleDeleteProcess]);

    const tabs: { id: ContinuityTab; label: string; icon: React.ElementType<{ className?: string }> }[] = useMemo(() => [
        { id: 'overview', label: t('continuity.tabs.overview'), icon: Activity },
        { id: 'bia', label: t('continuity.tabs.bia'), icon: AlertOctagon },
        { id: 'strategies', label: t('continuity.tabs.strategies'), icon: ShieldCheck },
        { id: 'drills', label: t('continuity.tabs.drills'), icon: Zap },
        { id: 'crisis', label: t('continuity.tabs.crisis'), icon: FileText },
    ], [t]);

    const loading = loadingData;

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8"
        >
            <MasterpieceBackground />
            <SEO
                title={t('continuity.title')}
                description={t('continuity.subtitle')}
                keywords="BIA, PCA, PRA, Crise, Audit"
            />
            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={handleConfirmClose}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
                loading={confirmData.loading || loadingAction}
            />

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title={t('continuity.title')}
                    subtitle={t('continuity.subtitle')}
                    icon={<Activity className="h-6 w-6 text-white" strokeWidth={2.5} />}
                    trustType="availability"
                    actions={
                        <>
                            <button
                                aria-label="Générer le rapport"
                                onClick={handleGenerateReport}
                                className="p-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            >
                                <Download className="h-5 w-5" />
                            </button>
                            {canCreate && (
                                <button
                                    aria-label={t('continuity.newProcess')}
                                    onClick={handleOpenProcessModal}
                                    className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-600"
                                >
                                    <Plus className="h-5 w-5 mr-2" />
                                    {t('continuity.newProcess')}
                                </button>
                            )}
                        </>
                    }
                />
            </motion.div>

            <motion.div variants={slideUpVariants} className="sticky top-[80px] z-30 mb-8">
                <ScrollableTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                />
            </motion.div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'overview' && (
                        <ContinuityDashboard
                            processes={processes}
                            drills={drills}
                            loading={loading}
                        />
                    )}

                    {activeTab === 'bia' && (
                        <div className="space-y-6">
                            <PremiumPageControl
                                searchQuery={filter}
                                onSearchChange={setFilter}
                                searchPlaceholder={t('continuity.searchPlaceholder')}
                                viewMode={viewMode}
                                onViewModeChange={handleViewModeChange}
                            />
                            {filteredProcesses.length === 0 && !loading ? (
                                <EmptyState
                                    icon={AlertOctagon}
                                    title="Aucun processus défini"
                                    description="Commencez par cartographier vos processus critiques pour réaliser votre BIA."
                                    actionLabel="Ajouter un processus"
                                    onAction={handleOpenProcessModal}
                                />
                            ) : (
                                <ContinuityBIA
                                    processes={filteredProcesses}
                                    loading={loading}
                                    viewMode={viewMode as 'grid' | 'list'}
                                    onOpenInspector={setSelectedProcess}
                                    onNewProcess={handleOpenProcessModal}
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'strategies' && (
                        <ContinuityStrategies assets={assets} />
                    )}

                    {activeTab === 'drills' && (
                        <ContinuityDrills
                            drills={drills}
                            processes={processes}
                            loading={loading}
                            onNewDrill={handleOpenDrillModal}
                            onDelete={handleDeleteDrill}
                        />
                    )}

                    {activeTab === 'crisis' && (
                        <ContinuityCrisis users={users} />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Modals */}
            <ProcessFormModal
                isOpen={isProcessModalOpen}
                onClose={handleCloseProcessModal}
                onSubmit={selectedProcess ? handleUpdateProcess : handleCreateProcess}
                isLoading={loadingAction}
                title={selectedProcess ? "Modifier Processus" : "Nouveau Processus"}
                initialData={selectedProcess || undefined}
                isEditing={!!selectedProcess}
                assets={assets}
                risks={risks}
                suppliers={suppliers}
                users={users}
            />

            {selectedProcess && (
                <ProcessInspector
                    isOpen={!!selectedProcess}
                    onClose={handleInspectorClose}
                    process={selectedProcess}
                    onEdit={handleOpenProcessModal}
                    onDelete={handleInspectorDelete}
                    assets={assets}
                    risks={risks}
                    suppliers={suppliers}
                    drills={drills}
                />
            )}

            <DrillModal
                isOpen={isDrillModalOpen}
                onClose={handleCloseDrillModal}
                onSubmit={handleCreateDrill}
                isLoading={loadingAction}
                processes={processes}
            />

        </motion.div>
    );
};

export default Continuity;
