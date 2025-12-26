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
import { BusinessProcess, BcpDrill } from '../types';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { usePersistedState } from '../hooks/usePersistedState';
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

type ContinuityTab = 'overview' | 'strategies' | 'bia' | 'drills' | 'crisis';

export const Continuity: React.FC = () => {
    const { user, t } = useStore();
    const [activeTab, setActiveTab] = usePersistedState<ContinuityTab>('continuity_active_tab', 'overview');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
    const [selectedProcess, setSelectedProcess] = useState<BusinessProcess | null>(null);
    const [selectedDrill, setSelectedDrill] = useState<BcpDrill | null>(null);
    const [filter, setFilter] = useState('');

    // Actions Hook
    const { addProcess, updateProcess, deleteProcess, addDrill, updateDrill, deleteDrill, loading: loadingAction } = useContinuity();

    // Data Hook
    const {
        processes,
        drills,
        assets,
        risks,
        suppliers,
        users,
        incidents,
        loading: loadingData
    } = useContinuityData(user?.organizationId);

    const [confirmData, setConfirmData] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, loading?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Derived Logic
    const filteredProcesses = useMemo(() => {
        return processes.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    }, [processes, filter]);

    const handleCreateProcess = async (data: BusinessProcessFormData) => {
        if (!user?.organizationId) return;
        try {
            await addProcess(data);
            setIsProcessModalOpen(false);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Continuity.handleCreateProcess');
        }
    };

    const handleUpdateProcess = async (data: BusinessProcessFormData) => {
        if (!selectedProcess) return;
        try {
            await updateProcess(selectedProcess.id, data);
            setSelectedProcess(null); // Close inspector/modal or update state? Inspector closes usually.
            setIsProcessModalOpen(false);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Continuity.handleUpdateProcess');
        }
    };

    const handleDeleteProcess = async (id: string) => {
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
    };

    const handleCreateDrill = async (data: any) => {
        if (!user?.organizationId) return;
        try {
            await addDrill(data);
            setIsDrillModalOpen(false);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Continuity.handleCreateDrill');
        }
    };

    const handleGenerateReport = () => {
        try {
            generateContinuityReport(processes, drills);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Continuity.generateReport');
        }
    };

    const tabs: { id: ContinuityTab; label: string; icon: any }[] = [
        { id: 'overview', label: t('continuity.tabs.overview'), icon: Activity },
        { id: 'bia', label: t('continuity.tabs.bia'), icon: AlertOctagon },
        { id: 'strategies', label: t('continuity.tabs.strategies'), icon: ShieldCheck },
        { id: 'drills', label: t('continuity.tabs.drills'), icon: Zap },
        { id: 'crisis', label: t('continuity.tabs.crisis'), icon: FileText },
    ];

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
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
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
                                onClick={handleGenerateReport}
                                className="p-2 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-colors"
                            >
                                <Download className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setIsProcessModalOpen(true)}
                                className="flex items-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-600/20"
                            >
                                <Plus className="h-5 w-5 mr-2" />
                                {t('continuity.newProcess')}
                            </button>
                        </>
                    }
                />
            </motion.div>

            <motion.div variants={slideUpVariants} className="sticky top-[80px] z-30 mb-8">
                <ScrollableTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
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
                            />
                            {filteredProcesses.length === 0 && !loading ? (
                                <EmptyState
                                    icon={AlertOctagon}
                                    title="Aucun processus défini"
                                    description="Commencez par cartographier vos processus critiques pour réaliser votre BIA."
                                    actionLabel="Ajouter un processus"
                                    onAction={() => setIsProcessModalOpen(true)}
                                />
                            ) : (
                                <ContinuityBIA
                                    processes={filteredProcesses}
                                    onSelect={setSelectedProcess}
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'strategies' && (
                        <ContinuityStrategies processes={processes} />
                    )}

                    {activeTab === 'drills' && (
                        <ContinuityDrills
                            drills={drills}
                            onCreate={() => setIsDrillModalOpen(true)}
                            onDelete={async (id) => {
                                if (window.confirm("Supprimer cet exercice ?")) {
                                    try { await deleteDrill(id); } catch (e) { ErrorLogger.handleErrorWithToast(e, 'DeleteDrill'); }
                                }
                            }}
                        />
                    )}

                    {activeTab === 'crisis' && (
                        <ContinuityCrisis incidents={incidents} />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Modals */}
            <ProcessFormModal
                isOpen={isProcessModalOpen}
                onClose={() => setIsProcessModalOpen(false)}
                onSubmit={handleCreateProcess}
                categories={['Metier', 'Support', 'IT', 'Management']} // Example
                isSubmitting={loadingAction}
                assets={assets}
                risks={risks}
                suppliers={suppliers}
            />

            {selectedProcess && (
                <ProcessInspector
                    isOpen={!!selectedProcess}
                    onClose={() => setSelectedProcess(null)}
                    process={selectedProcess}
                    onUpdate={async (data) => {
                        try {
                            await updateProcess(selectedProcess.id, data);
                            // Keep open?
                        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'UpdateProcess'); }
                    }}
                    onDelete={() => handleDeleteProcess(selectedProcess.id)}
                    assets={assets}
                    risks={risks}
                    suppliers={suppliers}
                />
            )}

            <DrillModal
                isOpen={isDrillModalOpen}
                onClose={() => setIsDrillModalOpen(false)}
                onSubmit={handleCreateDrill}
                isSubmitting={loadingAction}
            />

        </motion.div>
    );
};
