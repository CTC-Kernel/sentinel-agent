import React, { useState, useMemo } from 'react';

import { motion } from 'framer-motion';
import {
    Activity, ShieldCheck, Zap, FileText, AlertOctagon
} from 'lucide-react';
import { CsvParser } from '../utils/csvUtils';
import { ImportGuidelinesModal } from '../components/ui/ImportGuidelinesModal';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { SEO } from '../components/SEO';
import { PageHeader } from '../components/ui/PageHeader';
import { useStore } from '../store';
import { BusinessProcess } from '../types';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { useCallback } from 'react';
import { BusinessProcessFormData } from '../schemas/continuitySchema';
import { ProcessFormModal } from '../components/continuity/ProcessFormModal';
import { ProcessInspector } from '../components/continuity/ProcessInspector';
import { DrillModal } from '../components/continuity/DrillModal';
import { generateContinuityReport } from '../utils/pdfGenerator';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useContinuity } from '../hooks/useContinuity';
import { useContinuityData } from '../hooks/continuity/useContinuityData';
import { ErrorLogger } from '../services/errorLogger';
import { hasPermission, canEditResource, canDeleteResource } from '../utils/permissions';
import { ContinuityContent } from '../components/continuity/ContinuityContent';
// Form validation: useForm with required fields

type ContinuityTab = 'overview' | 'strategies' | 'bia' | 'drills' | 'crisis';

export const Continuity: React.FC = () => {
    const { user, t } = useStore();
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
    const { addProcess, updateProcess, deleteProcess, addDrill, deleteDrill, importProcesses, loading: loadingAction } = useContinuity();

    const [csvImportOpen, setCsvImportOpen] = useState(false);

    // CSV Import Handlers
    const processGuidelines = {
        required: ['Nom'],
        optional: ['Description', 'Responsable', 'Priorite', 'RTO', 'RPO'],
        format: 'CSV'
    };

    const handleDownloadTemplate = React.useCallback(() => {
        const headers = ['Nom', 'Description', 'Responsable', 'Priorite', 'RTO', 'RPO'];
        const rows = [{
            Nom: 'Processus Critique A',
            Description: 'Description du processus',
            Responsable: user?.displayName || 'Admin',
            Priorite: 'High',
            RTO: '4h',
            RPO: '1h'
        }];
        CsvParser.downloadCSV(headers, rows, 'template_processes.csv');
    }, [user]);

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
            title: "Supprimer l'exercice",
            message: "Êtes-vous sûr de vouloir supprimer cet exercice de continuité ?",
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
                    actions={undefined}
                />
            </motion.div>

            <motion.div variants={slideUpVariants} className="mb-2">
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
            />

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
