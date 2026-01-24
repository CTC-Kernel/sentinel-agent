import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { motion } from 'framer-motion';
import {
    Activity, ShieldCheck, Zap, FileText, AlertOctagon, BookOpen
} from '../components/ui/Icons';
import { ImportService } from '../services/ImportService';
import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { useStore } from '../store';
import { BusinessProcess, TlptCampaign } from '../types';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { useCallback } from 'react';
import { BusinessProcessFormData } from '../schemas/continuitySchema';
import { ProcessFormDrawer } from '../components/continuity/ProcessFormDrawer';
import { ProcessInspector } from '../components/continuity/ProcessInspector';
import { DrillInspector } from '../components/continuity/inspector/DrillInspector';
import { generateContinuityReport } from '../utils/pdfGenerator';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useContinuity } from '../hooks/useContinuity';
import { useContinuityData } from '../hooks/continuity/useContinuityData';
import { ErrorLogger } from '../services/errorLogger';
import { hasPermission, canEditResource, canDeleteResource } from '../utils/permissions';
import { ContinuityContent } from '../components/continuity/ContinuityContent';
import { OnboardingService } from '../services/onboardingService';
// Form validation: useForm with required fields

type ContinuityTab = 'overview' | 'strategies' | 'pra' | 'bia' | 'drills' | 'crisis' | 'tlpt' | 'methods';

export const Continuity: React.FC = () => {
    const { user, t } = useStore();

    // Start module tour
    React.useEffect(() => {
        const timer = setTimeout(() => {
            OnboardingService.startContinuityTour();
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    // Use utility functions instead of non-existent hook
    const canCreate = hasPermission(user, 'BusinessProcess', 'create');
    const canUpdate = canEditResource(user, 'BusinessProcess');
    const canDelete = canDeleteResource(user, 'BusinessProcess');
    const [activeTab, setActiveTab] = useState<ContinuityTab>('overview');
    const [viewMode, setViewMode] = useState<'grid' | 'list' | 'matrix' | 'kanban'>('grid');
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
    const [selectedProcess, setSelectedProcess] = useState<BusinessProcess | null>(null);
    const [filter, setFilter] = useState('');

    // Actions Hook
    const { addProcess, updateProcess, deleteProcess, addDrill, deleteDrill, importProcesses, addTlptCampaign, updateTlptCampaign, deleteTlptCampaign, addRecoveryPlan, updateRecoveryPlan, deleteRecoveryPlan, loading: loadingAction } = useContinuity();

    const [csvImportOpen, setCsvImportOpen] = useState(false);

    // CSV Import Handlers
    const processGuidelines = {
        required: ['Nom'],
        optional: ['Description', 'Responsable', 'Priorite', 'RTO', 'RPO'],
        format: 'CSV'
    };

    const handleDownloadTemplate = React.useCallback(() => {
        ImportService.downloadProcessTemplate();
    }, []);

    const handleImportCsvFile = React.useCallback(async (file: File) => {
        if (!file) return;
        const text = await file.text();
        await importProcesses(text);
        setCsvImportOpen(false);
    }, [importProcesses]);

    // Data Hook
    const {
        processes,
        drills,
        tlptCampaigns,
        assets,
        risks,
        suppliers,
        users,
        recoveryPlans,
        loading: loadingData
    } = useContinuityData(user?.organizationId);

    const [confirmData, setConfirmData] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, loading?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // URL Params for Deep Linking
    const [searchParams, setSearchParams] = useSearchParams();
    const deepLinkProcessId = searchParams.get('id');
    const deepLinkAction = searchParams.get('action');

    React.useEffect(() => {
        if (loadingData) return;

        if (deepLinkProcessId && processes.length > 0) {
            const process = processes.find(p => p.id === deepLinkProcessId);
            if (process && selectedProcess?.id !== process.id) {
                setSelectedProcess(process);
            }
        } else if (deepLinkAction === 'create' && !isProcessModalOpen) {
            setIsProcessModalOpen(true);
            // Consume action immediately
            setSearchParams(params => {
                params.delete('action');
                return params;
            }, { replace: true });
        }
    }, [loadingData, deepLinkProcessId, deepLinkAction, processes, selectedProcess, setSelectedProcess, isProcessModalOpen, setSearchParams]);

    // Cleanup Effect
    React.useEffect(() => {
        // CRITICAL FIX: Do not clean up while loading, otherwise we strip params before using them
        if (loadingData) return;

        if (!selectedProcess && deepLinkProcessId) {
            setSearchParams(params => {
                params.delete('id');
                return params;
            }, { replace: true });
        }
    }, [selectedProcess, deepLinkProcessId, setSearchParams, loadingData]);

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

    const handleCreateDrill = useCallback(async (data: Partial<import('../types').BcpDrill>) => {
        if (!user?.organizationId) return;
        try {
            await addDrill(data);
            setIsDrillModalOpen(false);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Continuity.handleCreateDrill');
        }
    }, [user, addDrill]);

    const handleDeleteDrill = useCallback((id: string) => {
        setConfirmData({
            isOpen: true,
            title: t('continuity.deleteDrillTitle'),
            message: t('continuity.deleteDrillMessage'),
            onConfirm: async () => {
                setConfirmData(prev => ({ ...prev, loading: true }));
                try {
                    await deleteDrill(id);
                    setConfirmData(prev => ({ ...prev, isOpen: false }));
                } catch (e) {
                    ErrorLogger.handleErrorWithToast(e, 'DeleteDrill');
                } finally {
                    setConfirmData(prev => ({ ...prev, loading: false }));
                }
            }
        });
    }, [deleteDrill, t]);

    const handleGenerateReport = useCallback(async () => {
        try {
            await generateContinuityReport(processes, drills);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Continuity.generateReport');
        }
    }, [processes, drills]);

    // UI Handlers
    const handleTabChange = useCallback((id: string) => setActiveTab(id as ContinuityTab), [setActiveTab]);
    const handleViewModeChange = useCallback((mode: string) => setViewMode(mode as 'grid' | 'list' | 'matrix' | 'kanban'), []);
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
        { id: 'pra', label: t('continuity.tabs.pra'), icon: FileText },
        { id: 'drills', label: t('continuity.tabs.drills'), icon: Zap },
        { id: 'tlpt', label: t('continuity.tabs.tlpt'), icon: ShieldCheck },
        { id: 'crisis', label: t('continuity.tabs.crisis'), icon: FileText },
        { id: 'methods', label: t('continuity.tabs.methods') || 'Méthodes', icon: BookOpen },
    ], [t]);

    const loading = loadingData;

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="flex flex-col gap-10 pb-24"
        >
            <MasterpieceBackground />
            <SEO
                title={t('continuity.title')}
                description={t('continuity.subtitle')}
                keywords={t('continuity.keywords')}
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
                    icon={
                        <img
                            src="/images/gouvernance.png"
                            alt="GOUVERNANCE"
                            className="w-full h-full object-contain"
                        />
                    }
                    trustType="availability"
                    actions={undefined}
                />
            </motion.div>

            <motion.div variants={slideUpVariants} className="mb-2" data-tour="continuity-tabs">
                <ScrollableTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                />
            </motion.div>

            <ContinuityContent
                activeTab={activeTab}
                loading={loading || loadingData}
                viewMode={viewMode}
                filteredProcesses={filteredProcesses}
                assets={assets}
                drills={drills}
                users={users}
                searchQuery={filter}
                onSearchChange={setFilter}
                onViewModeChange={handleViewModeChange}
                onGenerateReport={handleGenerateReport}
                onImportCsv={() => setCsvImportOpen(true)}
                canCreate={canCreate}
                onOpenProcessModal={handleOpenProcessModal}
                onSetSelectedProcess={setSelectedProcess}
                onOpenDrillModal={handleOpenDrillModal}
                onDeleteDrill={handleDeleteDrill}
                _tlptCampaigns={tlptCampaigns}
                _onAddTlpt={async (data) => { await addTlptCampaign(data as Partial<TlptCampaign>); }}
                _onUpdateTlpt={(id, data) => updateTlptCampaign(id, data as Partial<TlptCampaign>)}
                _onDeleteTlpt={deleteTlptCampaign}
                // PRA
                recoveryPlans={recoveryPlans}
                onAddPlan={async (data) => { await addRecoveryPlan(data); }}
                onUpdatePlan={async (id, data) => { await updateRecoveryPlan(id, data); }}
                onDeletePlan={deleteRecoveryPlan}
            />

            {/* Modals */}
            <ProcessFormDrawer
                isOpen={isProcessModalOpen}
                onClose={handleCloseProcessModal}
                onSubmit={selectedProcess ? handleUpdateProcess : handleCreateProcess}
                isLoading={loadingAction}
                title={selectedProcess ? t('continuity.editProcess') : t('continuity.newProcess')}
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
                    users={users}
                />
            )}

            <DrillInspector
                isOpen={isDrillModalOpen}
                onClose={handleCloseDrillModal}
                onSubmit={handleCreateDrill}
                isLoading={loadingAction}
                processes={processes}
            />

            <ImportGuidelinesModal
                isOpen={csvImportOpen}
                onClose={() => setCsvImportOpen(false)}
                entityName={t('continuity.title')}
                guidelines={processGuidelines}
                onImport={handleImportCsvFile}
                onDownloadTemplate={handleDownloadTemplate}
            />

        </motion.div>
    );
};

export default Continuity;

// Headless UI handles FocusTrap and keyboard navigation
