import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, ShieldCheck, Zap, FileText, AlertOctagon,
    Plus, Download
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { useStore } from '../store';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { BusinessProcess, BcpDrill, Asset, Risk, Supplier, UserProfile } from '../types';
import { BusinessProcessFormData } from '../schemas/continuitySchema';
import { ProcessFormModal } from '../components/continuity/ProcessFormModal';
import { ProcessInspector } from '../components/continuity/ProcessInspector';
import { DrillModal } from '../components/continuity/DrillModal';
import { doc, deleteDoc, updateDoc, addDoc, collection, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { generateContinuityReport } from '../utils/pdfGenerator';
import { ContinuityStats } from '../components/continuity/ContinuityStats';
import { ContinuityBIA } from '../components/continuity/ContinuityBIA';
import { ContinuityDrills } from '../components/continuity/ContinuityDrills';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { EmptyState } from '../components/ui/EmptyState';

const Continuity: React.FC = () => {
    const { user, addToast } = useStore();
    const [activeTab, setActiveTab] = useState<'overview' | 'strategies' | 'bia' | 'drills' | 'crisis'>('overview');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
    const [selectedProcess, setSelectedProcess] = useState<BusinessProcess | null>(null);
    const [editingProcess, setEditingProcess] = useState<BusinessProcess | null>(null);
    const [filter, setFilter] = useState('');

    // Data Fetching
    const { data: processes, loading, refresh } = useFirestoreCollection<BusinessProcess>('business_processes',
        user?.organizationId ? [where('organizationId', '==', user.organizationId)] : []
    );

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
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce processus ?')) return;
        try {
            await deleteDoc(doc(db, 'business_processes', id));
            addToast('Processus supprimé', 'success');
            setSelectedProcess(null);
            refresh();
        } catch {
            addToast('Erreur suppression', 'error');
        }
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

    const tabs = [
        { id: 'overview', label: "Vue d'ensemble", icon: Activity },
        { id: 'bia', label: "Analyses d'Impact (BIA)", icon: ShieldCheck },
        { id: 'strategies', label: "Stratégies & Plans", icon: FileText },
        { id: 'drills', label: "Exercices & Tests", icon: Zap },
        { id: 'crisis', label: "Gestion de Crise", icon: AlertOctagon },
    ] as const;

    type ContinuityTab = typeof tabs[number]['id'];

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

            {/* Main Tabs Navigation */}
            <div className="flex overflow-x-auto pb-2 gap-2 hide-scrollbar border-b border-slate-200 dark:border-white/10 px-1">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id as ContinuityTab); setFilter(''); }}
                            className={`
                                relative flex items-center gap-2 px-4 py-3 text-sm font-bold rounded-t-xl transition-all whitespace-nowrap
                                ${isActive
                                    ? 'text-brand-600 dark:text-brand-400 bg-white dark:bg-white/5 border-t border-x border-slate-200 dark:border-white/10 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'
                                }
                            `}
                        >
                            <Icon className={`h-4 w-4 ${isActive ? 'text-brand-500' : 'text-slate-400'}`} />
                            {tab.label}
                            {isActive && (
                                <motion.div
                                    layoutId="activeTabIndicator"
                                    className="absolute -bottom-px left-0 right-0 h-0.5 bg-brand-500"
                                />
                            )}
                        </button>
                    );
                })}
            </div>

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
                            <ContinuityStats processes={processes} drills={drills} />
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
                        />
                    )}

                    {activeTab === 'strategies' && (
                        <div className="glass-panel p-8 rounded-3xl border border-white/10 min-h-[400px] flex items-center justify-center">
                            <EmptyState
                                icon={FileText}
                                title="Module Stratégies en cours de déploiement"
                                description="La gestion des plans de continuité (PCA/PRA) sera bientôt disponible. Vous pourrez définir vos stratégies de reprise et procédures dégradées."
                                actionLabel="En savoir plus"
                                onAction={() => addToast('Fonctionnalité bientôt disponible', 'info')}
                                color="blue"
                            />
                        </div>
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
                        <div className="glass-panel p-8 rounded-3xl border border-white/10 min-h-[400px] flex items-center justify-center">
                            <EmptyState
                                icon={AlertOctagon}
                                title="Module Gestion de Crise"
                                description="Le centre de commandement de crise (Salle de Crise Virtuelle) est en cours de finalisation."
                                color="rose"
                            />
                        </div>
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
        </motion.div>
    );
};

export default Continuity;
