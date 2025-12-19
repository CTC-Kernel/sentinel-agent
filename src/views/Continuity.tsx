import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldCheck, Plus, Zap, Download, Activity
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
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
import { PremiumPageControl } from '../components/ui/PremiumPageControl';

const Continuity: React.FC = () => {
    const { user, addToast } = useStore();
    const [activeTab, setActiveTab] = useState<'bia' | 'drills'>('bia');
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
            // Also update selectedProcess if inspector is open
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

            // Update last test date on process
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

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F1115] pb-20 font-sans">
            <MasterpieceBackground />

            <PageHeader
                title="Continuité d'Activité"
                subtitle="Gérez vos plans de continuité (PCA), analysez les impacts (BIA) et documentez vos exercices de crise."
                icon={<Activity className="h-6 w-6 text-white" />}
            />

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">

                <ContinuityStats processes={processes} drills={drills} />

                {/* Tabs */}
                <div className="flex gap-6 mb-8 border-b border-slate-200 dark:border-white/10">
                    <button
                        onClick={() => { setActiveTab('bia'); setFilter(''); }}
                        className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 transition-all relative ${activeTab === 'bia' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <ShieldCheck className="h-4 w-4" />
                        Analyses d'Impact (BIA)
                        {activeTab === 'bia' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 dark:bg-brand-400 rounded-full" />}
                    </button>
                    <button
                        onClick={() => { setActiveTab('drills'); setFilter(''); }}
                        className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 transition-all relative ${activeTab === 'drills' ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Zap className="h-4 w-4" />
                        Exercices & Tests
                        {activeTab === 'drills' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 dark:bg-brand-400 rounded-full" />}
                    </button>
                </div>

                <div className="mb-6">
                    <PremiumPageControl
                        searchQuery={filter}
                        onSearchChange={setFilter}
                        searchPlaceholder={activeTab === 'bia' ? "Rechercher un processus..." : "Rechercher un exercice..."}
                        actions={
                            <div className="flex gap-3">
                                <button
                                    onClick={() => generateContinuityReport(processes, drills)}
                                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/10 text-slate-700 dark:text-white rounded-xl text-sm font-bold border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/20 transition-all shadow-sm"
                                >
                                    <Download className="h-4 w-4" />
                                    <span className="hidden sm:inline">Rapport</span>
                                </button>
                                {activeTab === 'bia' ? (
                                    <button
                                        onClick={() => { setEditingProcess(null); setIsProcessModalOpen(true); }}
                                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span className="hidden sm:inline">Nouveau Processus</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setIsDrillModalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span className="hidden sm:inline">Saisir un Exercice</span>
                                    </button>
                                )}
                            </div>
                        }
                    />
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'bia' ? (
                        <ContinuityBIA
                            key="bia"
                            processes={filteredProcesses}
                            loading={loading}
                            onOpenInspector={setSelectedProcess}
                            onNewProcess={() => { setEditingProcess(null); setIsProcessModalOpen(true); }}
                        />
                    ) : (
                        <ContinuityDrills
                            key="drills"
                            processes={processes} // Drills usually need raw processes for lookup, but the list is drills
                            drills={filteredDrills}
                            loading={loading}
                            onNewDrill={() => setIsDrillModalOpen(true)}
                        />
                    )}
                </AnimatePresence>
            </main>

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
        </div>
    );
};

export default Continuity;
