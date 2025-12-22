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
import { useFirestoreCollection } from '../hooks/useFirestore';
import { BusinessProcess, BcpDrill, Asset, Risk, Supplier, UserProfile } from '../types';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { usePersistedState } from '../hooks/usePersistedState';
import { BusinessProcessFormData } from '../schemas/continuitySchema';
import { ProcessFormModal } from '../components/continuity/ProcessFormModal';
import { ProcessInspector } from '../components/continuity/ProcessInspector';
import { DrillModal } from '../components/continuity/DrillModal';
import { doc, deleteDoc, updateDoc, addDoc, collection, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { generateContinuityReport } from '../utils/pdfGenerator';
import { ContinuityDashboard } from '../components/continuity/ContinuityDashboard';
import { ContinuityBIA } from '../components/continuity/ContinuityBIA';
import { ContinuityDrills } from '../components/continuity/ContinuityDrills';
import { ContinuityStrategies } from '../components/continuity/ContinuityStrategies';
import { ContinuityCrisis } from '../components/continuity/ContinuityCrisis';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/ConfirmModal';

type ContinuityTab = 'overview' | 'strategies' | 'bia' | 'drills' | 'crisis';

const Continuity: React.FC = () => {
    const { user, addToast } = useStore();
    const [activeTab, setActiveTab] = usePersistedState<ContinuityTab>('continuity_active_tab', 'overview');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
    const [selectedProcess, setSelectedProcess] = useState<BusinessProcess | null>(null);
    const [editingProcess, setEditingProcess] = useState<BusinessProcess | null>(null);
    const [filter, setFilter] = useState('');

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    // Data Fetching
    const { data: processes, loading, refresh } = useFirestoreCollection<BusinessProcess>('business_processes',
        user?.organizationId ? [where('organizationId', '==', user.organizationId)] : []
    );
    // ... (keep intermediate code) ...



    const { data: drills, refresh: refreshDrills } = useFirestoreCollection<BcpDrill>('bcp_drills',
        user?.organizationId ? [where('organizationId', '==', user.organizationId), orderBy('date', 'desc')] : []
    );

    const { data: assets } = useFirestoreCollection<Asset>('assets', user?.organizationId ? [where('organizationId', '==', user.organizationId)] : []);
    const { data: risks } = useFirestoreCollection<Risk>('risks', user?.organizationId ? [where('organizationId', '==', user.organizationId)] : []);
    const { data: suppliers } = useFirestoreCollection<Supplier>('suppliers', user?.organizationId ? [where('organizationId', '==', user.organizationId)] : []);
    const { data: users } = useFirestoreCollection<UserProfile>('users', user?.organizationId ? [where('organizationId', '==', user.organizationId)] : []);

    const filteredProcesses = useMemo(() => {
        return processes.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
    }, [processes, filter]);

    const filteredDrills = useMemo(() => {
        return drills.filter(d => d.type.toLowerCase().includes(filter.toLowerCase()));
    }, [drills, filter]);

    const handleCreateProcess = async (data: BusinessProcessFormData) => {
        try {
            const newProcess = {
                ...data,
                organizationId: user?.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'Draft',
                lastTestDate: null
            };

            await addDoc(collection(db, 'business_processes'), newProcess);

            addToast('Processus créé avec succès', 'success');
            setIsProcessModalOpen(false);
            refresh();
        } catch (error) {
            console.error(error);
            addToast('Erreur lors de la création', 'error');
        }
    };

    const handleUpdateProcess = async (data: BusinessProcessFormData) => {
        if (!editingProcess) return;
        try {
            await updateDoc(doc(db, 'business_processes', editingProcess.id), {
                ...data,
                updatedAt: new Date().toISOString()
            });
            addToast('Processus mis à jour', 'success');
            setIsProcessModalOpen(false);
            setEditingProcess(null);
            refresh();
            if (selectedProcess?.id === editingProcess.id) {
                setSelectedProcess({ ...editingProcess, ...data });
            }
        } catch {
            addToast('Erreur lors de la mise à jour', 'error');
        }
    };

    const handleDeleteProcess = async (id: string) => {
        setConfirmData({
            isOpen: true,
            title: "Supprimer le processus ?",
            message: "Cette action est irréversible et supprimera l'historique associé.",
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, 'business_processes', id));
                    addToast('Processus supprimé', 'success');
                    setSelectedProcess(null);
                    refresh();
                } catch {
                    addToast('Erreur suppression', 'error');
                }
            }
        });
    };

    const handleLogDrill = async (data: Partial<BcpDrill>) => {
        try {
            const newDrill = {
                ...data,
                organizationId: user?.organizationId,
                createdAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'bcp_drills'), newDrill);

            if (data.processId) {
                await updateDoc(doc(db, 'business_processes', data.processId), {
                    lastTestDate: data.date
                });
            }

            addToast('Exercice enregistré', 'success');
            setIsDrillModalOpen(false);
            refreshDrills();
            refresh();
        } catch {
            addToast('Erreur enregistrement', 'error');
        }
    };


    // Tabs Definition
    const tabs = useMemo(() => [
        { id: 'overview', label: "Vue d'ensemble", icon: Activity },
        { id: 'bia', label: "Analyses d'Impact (BIA)", icon: ShieldCheck },
        { id: 'strategies', label: "Stratégies & Plans", icon: FileText },
        { id: 'drills', label: "Exercices & Tests", icon: Zap },
        { id: 'crisis', label: "Gestion de Crise", icon: AlertOctagon },
    ], []);

    return (
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-6"
        >
            <PageHeader
                title="Continuité d'Activité"
                subtitle="Pilotage des plans de continuité (PCA/PRA), analyses BIA et gestion de crise."
                icon={<Activity className="h-6 w-6 text-white" />}
                breadcrumbs={[{ label: 'Continuité' }]}
                trustType="availability"
            />
            <MasterpieceBackground />
            <SEO title="Continuité d'Activité" description="Pilotage des plans de continuité (PCA/PRA)" />

            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            {/* Main Tabs Navigation */}
            <ScrollableTabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(id) => { setActiveTab(id as ContinuityTab); setFilter(''); }}
            />

            {/* Page Controls (Contextual) */}
            <motion.div variants={slideUpVariants}>
                <PremiumPageControl
                    searchQuery={filter}
                    onSearchChange={setFilter}
                    searchPlaceholder={
                        activeTab === 'bia' ? "Rechercher un processus..." :
                            activeTab === 'drills' ? "Rechercher un exercice..." :
                                "Rechercher..."
                    }
                    viewMode={activeTab === 'bia' ? viewMode : undefined} // Only BIA supports grid/list for now
                    onViewModeChange={activeTab === 'bia' ? (m) => setViewMode(m as 'grid' | 'list') : undefined}
                    actions={
                        <div className="flex gap-2">
                            <button
                                onClick={() => generateContinuityReport(processes, drills)}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 text-slate-700 dark:text-white rounded-xl text-sm font-bold border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/20 transition-all shadow-sm"
                            >
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Rapport</span>
                            </button>

                            {activeTab === 'bia' && (
                                <button
                                    onClick={() => { setEditingProcess(null); setIsProcessModalOpen(true); }}
                                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Nouveau Processus</span>
                                </button>
                            )}

                            {activeTab === 'drills' && (
                                <button
                                    onClick={() => setIsDrillModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Nouvel Exercice</span>
                                </button>
                            )}
                        </div>
                    }
                />
            </motion.div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <ContinuityDashboard processes={processes} drills={drills} />
                            {/* Additional dashboard widgets could go here */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <div className="glass-panel p-6 rounded-2xl border border-white/10">
                                    <h3 className="font-bold text-lg mb-4">Prochaines Revues</h3>
                                    <EmptyState
                                        icon={Activity}
                                        title="Tout est à jour"
                                        description="Aucune revue de processus BIA planifiée pour les 7 prochains jours."
                                        color="emerald"
                                    />
                                </div>
                                {/* More placeholders or summary charts */}
                            </div>
                        </div>
                    )}

                    {activeTab === 'bia' && (
                        <ContinuityBIA
                            processes={filteredProcesses}
                            loading={loading}
                            viewMode={viewMode}
                            onOpenInspector={setSelectedProcess}
                            onNewProcess={() => { setEditingProcess(null); setIsProcessModalOpen(true); }}
                            onDelete={handleDeleteProcess}
                        />
                    )}

                    {activeTab === 'strategies' && (
                        <ContinuityStrategies assets={assets} />
                    )}

                    {activeTab === 'drills' && (
                        <ContinuityDrills
                            processes={processes}
                            drills={filteredDrills}
                            loading={loading}
                            onNewDrill={() => setIsDrillModalOpen(true)}
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
                onClose={() => { setIsProcessModalOpen(false); setEditingProcess(null); }}
                onSubmit={editingProcess ? handleUpdateProcess : handleCreateProcess}
                initialData={editingProcess || undefined}
                title={editingProcess ? "Modifier le processus" : "Nouveau Processus"}
                isEditing={!!editingProcess}
                assets={assets}
                suppliers={suppliers}
                risks={risks}
                users={users}
            />

            <DrillModal
                isOpen={isDrillModalOpen}
                onClose={() => setIsDrillModalOpen(false)}
                onSubmit={handleLogDrill}
                processes={processes}
            />

            <ProcessInspector
                process={selectedProcess}
                isOpen={!!selectedProcess}
                onClose={() => setSelectedProcess(null)}
                onEdit={(p) => { setSelectedProcess(null); setEditingProcess(p); setIsProcessModalOpen(true); }}
                onDelete={handleDeleteProcess}
                assets={assets}
                suppliers={suppliers}
                risks={risks}
                drills={drills.filter(d => d.processId === selectedProcess?.id)}
            />
        </motion.div >
    );
};

export default Continuity;
