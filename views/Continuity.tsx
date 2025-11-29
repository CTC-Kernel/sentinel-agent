
import React, { useEffect, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { businessProcessSchema, BusinessProcessFormData, bcpDrillSchema, BcpDrillFormData } from '../schemas/continuitySchema';

import { Drawer } from '../components/ui/Drawer';
import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { BusinessProcess, Asset, BcpDrill, SystemLog, UserProfile, Risk, Supplier } from '../types';
import { Plus, HeartPulse, Trash2, Edit, Zap, ClipboardCheck, Server, CalendarDays, AlertTriangle, History, MessageSquare, Save, LayoutDashboard, FileSpreadsheet, ShieldAlert, Truck } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Comments } from '../components/ui/Comments';
import { ErrorLogger } from '../services/errorLogger';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Controller } from 'react-hook-form';

export const Continuity: React.FC = () => {
    const [processes, setProcesses] = useState<BusinessProcess[]>([]);
    const [drills, setDrills] = useState<BcpDrill[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [risks, setRisks] = useState<Risk[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);

    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDrillModal, setShowDrillModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'bia' | 'drills'>('bia');

    const { user, addToast } = useStore();
    const canEdit = user?.role === 'admin' || user?.role === 'auditor';

    // Inspector State
    const [selectedProcess, setSelectedProcess] = useState<BusinessProcess | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'details' | 'recovery' | 'scenarios' | 'drills' | 'history' | 'comments'>('details');
    const [processHistory, setProcessHistory] = useState<SystemLog[]>([]);
    const [isEditing, setIsEditing] = useState(false);

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const createProcessForm = useForm<BusinessProcessFormData>({
        resolver: zodResolver(businessProcessSchema),
        defaultValues: {
            name: '', description: '', owner: user?.displayName || '', rto: '4h', rpo: '1h', priority: 'Moyenne',
            supportingAssetIds: [], drpDocumentId: '', relatedRiskIds: [], supplierIds: [], recoveryTasks: []
        }
    });

    const editProcessForm = useForm<BusinessProcessFormData>({
        resolver: zodResolver(businessProcessSchema),
        defaultValues: {
            name: '', description: '', owner: '', rto: '', rpo: '', priority: 'Moyenne',
            supportingAssetIds: [], drpDocumentId: '', relatedRiskIds: [], supplierIds: [], recoveryTasks: []
        }
    });

    const drillForm = useForm<BcpDrillFormData>({
        resolver: zodResolver(bcpDrillSchema),
        defaultValues: {
            processId: '', date: new Date().toISOString().split('T')[0], type: 'Tabletop', result: 'Succès', notes: ''
        }
    });

    const fetchData = async () => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // Use Promise.allSettled for robustness
            // Removed 'IN' query on documents to prevent index error
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'business_processes'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'bcp_drills'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'assets'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'risks'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'suppliers'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId)))
            ]);

            const getDocsData = <T,>(result: PromiseSettledResult<any>): T[] => {
                if (result.status === 'fulfilled') {
                    return result.value.docs.map((d: any) => ({ id: d.id, ...d.data() })) as T[];
                }
                console.warn("Failed to load some data in Continuity view");
                return [];
            };

            const procData = getDocsData<BusinessProcess>(results[0]);
            procData.sort((a, b) => a.name.localeCompare(b.name));
            setProcesses(procData);

            const drillData = getDocsData<BcpDrill>(results[1]);
            drillData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setDrills(drillData);

            const assetData = getDocsData<Asset>(results[2]);
            assetData.sort((a, b) => a.name.localeCompare(b.name));
            setAssets(assetData);

            const riskData = getDocsData<Risk>(results[3]);
            setRisks(riskData);

            const supplierData = getDocsData<Supplier>(results[4]);
            setSuppliers(supplierData);

            const usersData = getDocsData<UserProfile>(results[5]);
            setUsersList(usersData);

        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Continuity.fetchData', 'FETCH_FAILED');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [user?.organizationId]);

    // ... rest of the component code (openInspector, CRUD, etc.) ...
    // Including the rest of the file content to ensure integrity

    const openInspector = async (proc: BusinessProcess) => {
        setSelectedProcess(proc);
        editProcessForm.reset({
            name: proc.name,
            description: proc.description,
            owner: proc.owner,
            rto: proc.rto,
            rpo: proc.rpo,
            priority: proc.priority,
            supportingAssetIds: proc.supportingAssetIds || [],
            drpDocumentId: proc.drpDocumentId || '',
            lastTestDate: proc.lastTestDate,
            relatedRiskIds: proc.relatedRiskIds || [],
            supplierIds: proc.supplierIds || [],
            recoveryTasks: proc.recoveryTasks || []
        });
        setInspectorTab('details');
        setIsEditing(false);

        try {
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user?.organizationId), limit(50));
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => d.data() as SystemLog);

            const relevantLogs = logs.filter(l => l.resource === 'BCP' && l.details?.includes(proc.name));
            relevantLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setProcessHistory(relevantLogs);
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Continuity.openInspector', 'FETCH_FAILED'); }
    };

    const handleCreateProcess: SubmitHandler<BusinessProcessFormData> = async (data) => {
        if (!canEdit || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'business_processes'), { ...data, organizationId: user.organizationId });
            await logAction(user, 'CREATE', 'BCP', `Nouveau Processus: ${data.name}`);
            addToast("Processus créé", "success");
            setShowCreateModal(false);
            createProcessForm.reset();
            fetchData();
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Continuity.handleCreateProcess', 'CREATE_FAILED'); }
    };

    const handleUpdateProcess: SubmitHandler<BusinessProcessFormData> = async (data) => {
        if (!canEdit || !selectedProcess) return;
        try {
            await updateDoc(doc(db, 'business_processes', selectedProcess.id), data);
            await logAction(user, 'UPDATE', 'BCP', `MAJ Processus: ${data.name}`);

            setProcesses(prev => prev.map(p => p.id === selectedProcess.id ? { ...p, ...data } : p));
            setSelectedProcess({ ...selectedProcess, ...data });
            setIsEditing(false);
            addToast("Processus mis à jour", "success");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Continuity.handleUpdateProcess', 'UPDATE_FAILED'); }
    };

    const initiateDelete = (id: string, name: string) => {
        if (!canEdit) return;
        setConfirmData({
            isOpen: true,
            title: "Supprimer le processus ?",
            message: "Le processus et son historique seront supprimés.",
            onConfirm: () => handleDeleteProcess(id, name)
        });
    };

    const handleDeleteProcess = async (id: string, name: string) => {
        try {
            await deleteDoc(doc(db, 'business_processes', id));
            setProcesses(prev => prev.filter(p => p.id !== id));
            setSelectedProcess(null);
            await logAction(user, 'DELETE', 'BCP', `Suppression: ${name}`);
            await logAction(user, 'DELETE', 'BCP', `Suppression: ${name}`);
            addToast("Processus supprimé", "info");
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Continuity.handleDeleteProcess', 'DELETE_FAILED'); }
    };

    const openDrillModal = () => {
        drillForm.reset({
            processId: selectedProcess?.id || processes[0]?.id || '',
            date: new Date().toISOString().split('T')[0],
            type: 'Tabletop',
            result: 'Succès',
            notes: ''
        });
        setShowDrillModal(true);
    };

    const handleSubmitDrill: SubmitHandler<BcpDrillFormData> = async (data) => {
        if (!canEdit || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'bcp_drills'), { ...data, organizationId: user.organizationId, createdAt: new Date().toISOString() });
            if (data.processId) {
                await updateDoc(doc(db, 'business_processes', data.processId), { lastTestDate: data.date });
            }
            await logAction(user, 'CREATE', 'BCP', `Nouvel exercice de crise`);
            addToast("Exercice enregistré", "success");
            setShowDrillModal(false);
            fetchData();
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Continuity.handleSubmitDrill', 'CREATE_FAILED'); }
    };

    const handleExportCSV = () => {
        const headers = ["Processus", "Priorité", "RTO", "RPO", "Responsable", "Dernier Test"];
        const rows = processes.map(p => [
            p.name,
            p.priority,
            p.rto,
            p.rpo,
            p.owner,
            p.lastTestDate ? new Date(p.lastTestDate).toLocaleDateString('fr-FR') : 'Jamais'
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `bia_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const toggleAssetSelection = (assetId: string) => {
        const current = editProcessForm.getValues('supportingAssetIds') || [];
        if (current.includes(assetId)) {
            editProcessForm.setValue('supportingAssetIds', current.filter(id => id !== assetId));
        } else {
            editProcessForm.setValue('supportingAssetIds', [...current, assetId]);
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'Critique': return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30';
            case 'Elevée': return 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900/30';
            case 'Moyenne': return 'bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/30';
            default: return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30';
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative">
            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <PageHeader
                title="Continuité d'Activité"
                subtitle="Business Impact Analysis (BIA) et Exercices de crise (ISO 27001 A.5.29)."
                breadcrumbs={[
                    { label: 'Continuité' }
                ]}
                icon={<HeartPulse className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={
                    <div className="flex gap-3">
                        <button onClick={handleExportCSV} className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-white text-sm font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                            <FileSpreadsheet className="h-4 w-4 mr-2" /> Export BIA
                        </button>
                        {canEdit && (
                            <>
                                <button onClick={() => { openDrillModal(); }} className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-white text-sm font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                                    <Zap className="h-4 w-4 mr-2 text-amber-500" /> Nouvel Exercice
                                </button>
                                <button onClick={() => {
                                    createProcessForm.reset({ name: '', description: '', owner: user?.displayName || '', rto: '4h', rpo: '1h', priority: 'Moyenne', supportingAssetIds: [], drpDocumentId: '' });
                                    setShowCreateModal(true);
                                }} className="flex items-center px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 shadow-lg shadow-rose-500/20 transition-transform hover:scale-105">
                                    <Plus className="h-4 w-4 mr-2" /> Nouveau Processus
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit border border-slate-200 dark:border-white/5">
                <button onClick={() => setActiveTab('bia')} className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'bia' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    Analyse d'Impact (BIA)
                </button>
                <button onClick={() => setActiveTab('drills')} className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'drills' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    Exercices & Tests
                </button>
            </div>

            {activeTab === 'bia' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {loading ? (
                        <CardSkeleton count={6} />
                    ) : processes.length === 0 ? (
                        <div className="col-span-full">
                            <EmptyState
                                icon={HeartPulse}
                                title="Aucun processus défini"
                                description="Commencez par définir vos processus critiques pour l'analyse d'impact (BIA)."
                                actionLabel="Nouveau Processus"
                                onAction={() => {
                                    createProcessForm.reset({ name: '', description: '', owner: user?.displayName || '', rto: '4h', rpo: '1h', priority: 'Moyenne', supportingAssetIds: [], drpDocumentId: '' });
                                    setShowCreateModal(true);
                                }}
                            />
                        </div>
                    ) : (
                        processes.map(proc => {
                            const lastTest = proc.lastTestDate ? new Date(proc.lastTestDate) : null;
                            const isOverdue = lastTest ? (new Date().getTime() - lastTest.getTime() > 31536000000) : true; // 1 year

                            return (
                                <div key={proc.id} onClick={() => openInspector(proc)} className="glass-panel rounded-[2.5rem] p-7 shadow-sm hover:shadow-apple transition-all duration-300 hover:-translate-y-1 relative group flex flex-col cursor-pointer border border-white/50 dark:border-white/5">
                                    <div className="flex justify-between items-start mb-5">
                                        <div className="p-3 bg-rose-50 dark:bg-slate-800 rounded-2xl text-rose-600 shadow-inner">
                                            <HeartPulse className="h-6 w-6" />
                                        </div>
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getPriorityColor(proc.priority)}`}>
                                            {proc.priority}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">{proc.name}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 flex-1 leading-relaxed">{proc.description}</p>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-gray-100 dark:border-white/5 text-center">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">RTO (Temps)</span>
                                            <span className="text-3xl font-black text-slate-800 dark:text-white">{proc.rto}</span>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-gray-100 dark:border-white/5 text-center">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">RPO (Données)</span>
                                            <span className="text-3xl font-black text-slate-800 dark:text-white">{proc.rpo}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-4 border-t border-dashed border-gray-200 dark:border-white/10">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center font-bold text-slate-400 uppercase tracking-wide"><Server className="h-3 w-3 mr-1.5" /> Dépendances</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{proc.supportingAssetIds?.length || 0} actifs</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="flex items-center font-bold text-slate-400 uppercase tracking-wide"><ClipboardCheck className="h-3 w-3 mr-1.5" /> Dernier Test</span>
                                            <span className={`font-bold px-2 py-0.5 rounded ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                {proc.lastTestDate ? new Date(proc.lastTestDate).toLocaleDateString() : 'Jamais'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}

            {activeTab === 'drills' && (
                loading ? (
                    <TableSkeleton rows={5} columns={5} />
                ) : drills.length === 0 ? (
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden shadow-sm border border-white/50 dark:border-white/5">
                        <EmptyState
                            icon={Zap}
                            title="Aucun exercice enregistré"
                            description="Enregistrez vos exercices de crise (Tabletop, Simulation...) pour valider votre PCA."
                            actionLabel="Nouvel Exercice"
                            onAction={() => openDrillModal()}
                        />
                    </div>
                ) : (
                    <div className="glass-panel rounded-[2.5rem] overflow-hidden shadow-sm border border-white/50 dark:border-white/5">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50/80 dark:bg-slate-900/50 border-b border-gray-100 dark:border-white/5 text-slate-400 font-bold uppercase text-[10px] tracking-widest backdrop-blur-sm">
                                    <tr>
                                        <th className="px-8 py-5">Date</th>
                                        <th className="px-6 py-5">Processus testé</th>
                                        <th className="px-6 py-5">Type d'exercice</th>
                                        <th className="px-6 py-5">Résultat</th>
                                        <th className="px-6 py-5">Notes / Preuves</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {drills.map(drill => {
                                        const proc = processes.find(p => p.id === drill.processId);
                                        return (
                                            <tr key={drill.id} className="hover:bg-white/60 dark:hover:bg-slate-800/40 transition-colors group">
                                                <td className="px-8 py-5 text-slate-900 dark:text-white font-bold flex items-center">
                                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-xl mr-3 shadow-sm border border-gray-100 dark:border-white/5 group-hover:scale-110 transition-transform">
                                                        <CalendarDays className="h-4 w-4 text-slate-500" />
                                                    </div>
                                                    {new Date(drill.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-5 font-medium text-slate-600 dark:text-slate-300">
                                                    {proc ? proc.name : 'Inconnu'}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold border border-gray-200 dark:border-white/5 shadow-sm">
                                                        {drill.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`flex items-center w-fit px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${drill.result === 'Succès' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' : drill.result === 'Échec' ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30' : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30'}`}>
                                                        {drill.result === 'Succès' ? <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />}
                                                        {drill.result}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-slate-500 dark:text-slate-400 truncate max-w-xs font-medium">{drill.notes}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {/* Inspector Drawer */}
            {/* Inspector Drawer */}
            <Drawer
                isOpen={!!selectedProcess}
                onClose={() => setSelectedProcess(null)}
                title={selectedProcess?.name || ''}
                subtitle={selectedProcess?.priority}
                actions={
                    <div className="flex gap-2">
                        {canEdit && !isEditing && (
                            <button onClick={() => setIsEditing(true)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"><Edit className="h-4 w-4" /></button>
                        )}
                        {canEdit && isEditing && (
                            <button onClick={editProcessForm.handleSubmit(handleUpdateProcess)} className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"><Save className="h-4 w-4" /></button>
                        )}
                        {canEdit && (
                            <button onClick={() => selectedProcess && initiateDelete(selectedProcess.id, selectedProcess.name)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="h-4 w-4" /></button>
                        )}
                    </div>
                }
                width="max-w-6xl"
            >
                {selectedProcess && (
                    <div className="flex flex-col h-full">

                        <div className="px-8 border-b border-gray-100 dark:border-white/5 flex gap-8 bg-white/30 dark:bg-white/5">
                            {[
                                { id: 'details', label: 'Détails', icon: LayoutDashboard },
                                { id: 'recovery', label: 'Plan de Reprise', icon: ClipboardCheck },
                                { id: 'scenarios', label: 'Scénarios (Risques)', icon: ShieldAlert },
                                { id: 'drills', label: 'Exercices', icon: Zap },
                                { id: 'history', label: 'Historique', icon: History },
                                { id: 'comments', label: 'Discussion', icon: MessageSquare },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setInspectorTab(tab.id as any)}
                                    className={`py-4 text-sm font-semibold flex items-center border-b-2 transition-all ${inspectorTab === tab.id ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    <tab.icon className={`h-4 w-4 mr-2.5 ${inspectorTab === tab.id ? 'text-brand-500' : 'opacity-70'}`} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
                            {inspectorTab === 'details' && (
                                <div className="space-y-8">
                                    {isEditing ? (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium" {...editProcessForm.register('name')} /></div>
                                                <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Priorité</label>
                                                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none" {...editProcessForm.register('priority')}>
                                                        {['Critique', 'Élevée', 'Moyenne', 'Faible'].map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Description</label><textarea className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium resize-none" rows={3} {...editProcessForm.register('description')} /></div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">RTO</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium" {...editProcessForm.register('rto')} /></div>
                                                <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">RPO</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium" {...editProcessForm.register('rpo')} /></div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Actifs supports</label>
                                                <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-white/10 rounded-2xl p-2 space-y-1 custom-scrollbar bg-white dark:bg-black/20">
                                                    {assets.map(asset => (
                                                        <label key={asset.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
                                                            <input type="checkbox" checked={editProcessForm.watch('supportingAssetIds')?.includes(asset.id)}
                                                                onChange={() => toggleAssetSelection(asset.id)} className="rounded text-rose-600 focus:ring-rose-500 border-gray-300" />
                                                            <span className="text-sm font-medium dark:text-white">{asset.name} <span className="text-xs text-gray-400 ml-1">({asset.type})</span></span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Fournisseurs Critiques</label>
                                                <Controller
                                                    name="supplierIds"
                                                    control={editProcessForm.control}
                                                    render={({ field }) => (
                                                        <CustomSelect
                                                            options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.category }))}
                                                            value={field.value || []}
                                                            onChange={field.onChange}
                                                            placeholder="Sélectionner les fournisseurs..."
                                                            multiple
                                                        />
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm text-center">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">RTO (Objectif Temps)</span>
                                                    <span className="text-3xl font-black text-slate-800 dark:text-white">{selectedProcess.rto}</span>
                                                </div>
                                                <div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm text-center">
                                                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">RPO (Objectif Données)</span>
                                                    <span className="text-3xl font-black text-slate-800 dark:text-white">{selectedProcess.rpo}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Description</h4>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedProcess.description}</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Dépendances Techniques</h4>
                                                    {selectedProcess.supportingAssetIds && selectedProcess.supportingAssetIds.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {selectedProcess.supportingAssetIds.map(assetId => {
                                                                const a = assets.find(as => as.id === assetId);
                                                                return a ? (
                                                                    <div key={assetId} className="flex items-center p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                                        <Server className="h-4 w-4 mr-3 text-slate-400" />
                                                                        <span className="text-sm font-medium text-slate-700 dark:text-white">{a.name}</span>
                                                                    </div>
                                                                ) : null;
                                                            })}
                                                        </div>
                                                    ) : <p className="text-sm text-gray-400 italic">Aucune dépendance déclarée.</p>}
                                                </div>
                                                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Fournisseurs Critiques</h4>
                                                    {selectedProcess.supplierIds && selectedProcess.supplierIds.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {selectedProcess.supplierIds.map(sid => {
                                                                const s = suppliers.find(sup => sup.id === sid);
                                                                return s ? (
                                                                    <div key={sid} className="flex items-center p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                                                        <Truck className="h-4 w-4 mr-3 text-slate-400" />
                                                                        <span className="text-sm font-medium text-slate-700 dark:text-white">{s.name}</span>
                                                                    </div>
                                                                ) : null;
                                                            })}
                                                        </div>
                                                    ) : <p className="text-sm text-gray-400 italic">Aucun fournisseur lié.</p>}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {inspectorTab === 'recovery' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Plan de Reprise (DRP)</h3>
                                        {isEditing && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const currentTasks = editProcessForm.getValues('recoveryTasks') || [];
                                                    editProcessForm.setValue('recoveryTasks', [
                                                        ...currentTasks,
                                                        { id: crypto.randomUUID(), title: '', owner: '', duration: '', order: currentTasks.length + 1 }
                                                    ]);
                                                }}
                                                className="text-xs font-bold text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors"
                                            >
                                                + Ajouter une étape
                                            </button>
                                        )}
                                    </div>

                                    {isEditing ? (
                                        <div className="space-y-4">
                                            {editProcessForm.watch('recoveryTasks')?.map((task, index) => (
                                                <div key={task.id} className="flex gap-4 items-start bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
                                                    <div className="mt-3 text-xs font-bold text-slate-400 w-6">{index + 1}.</div>
                                                    <div className="flex-1 space-y-3">
                                                        <input
                                                            placeholder="Action à effectuer"
                                                            className="w-full px-3 py-2 rounded-lg border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-sm font-medium"
                                                            {...editProcessForm.register(`recoveryTasks.${index}.title` as any)}
                                                        />
                                                        <div className="flex gap-3">
                                                            <input
                                                                placeholder="Responsable"
                                                                className="flex-1 px-3 py-2 rounded-lg border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-xs"
                                                                {...editProcessForm.register(`recoveryTasks.${index}.owner` as any)}
                                                            />
                                                            <input
                                                                placeholder="Durée (ex: 30m)"
                                                                className="w-24 px-3 py-2 rounded-lg border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-xs"
                                                                {...editProcessForm.register(`recoveryTasks.${index}.duration` as any)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const tasks = editProcessForm.getValues('recoveryTasks') || [];
                                                            editProcessForm.setValue('recoveryTasks', tasks.filter((_, i) => i !== index));
                                                        }}
                                                        className="text-slate-400 hover:text-red-500 p-1"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {selectedProcess.recoveryTasks && selectedProcess.recoveryTasks.length > 0 ? (
                                                selectedProcess.recoveryTasks.sort((a, b) => a.order - b.order).map((task, index) => (
                                                    <div key={task.id} className="flex items-start gap-4 p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-900/20 text-brand-600 flex items-center justify-center font-bold text-sm">
                                                            {index + 1}
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{task.title}</h4>
                                                            <div className="flex gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                                <span className="flex items-center"><Server className="h-3 w-3 mr-1" /> {task.owner}</span>
                                                                <span className="flex items-center"><History className="h-3 w-3 mr-1" /> {task.duration}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <EmptyState
                                                    icon={ClipboardCheck}
                                                    title="Aucun plan de reprise"
                                                    description="Définissez les étapes de reprise pour ce processus."
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {inspectorTab === 'scenarios' && (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Scénarios de Risque</h3>
                                    </div>
                                    {isEditing ? (
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Lier des Risques</label>
                                            <Controller
                                                name="relatedRiskIds"
                                                control={editProcessForm.control}
                                                render={({ field }) => (
                                                    <CustomSelect
                                                        options={risks.map(r => ({ value: r.id, label: r.threat, subLabel: `Score: ${r.score}` }))}
                                                        value={field.value || []}
                                                        onChange={field.onChange}
                                                        placeholder="Sélectionner les risques..."
                                                        multiple
                                                    />
                                                )}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {selectedProcess.relatedRiskIds && selectedProcess.relatedRiskIds.length > 0 ? (
                                                selectedProcess.relatedRiskIds.map(rid => {
                                                    const risk = risks.find(r => r.id === rid);
                                                    return risk ? (
                                                        <div key={rid} className="p-4 bg-white dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex justify-between items-center">
                                                            <div>
                                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{risk.threat}</h4>
                                                                <p className="text-xs text-slate-500">{risk.vulnerability}</p>
                                                            </div>
                                                            <div className={`px-3 py-1 rounded-lg text-xs font-bold ${risk.score >= 15 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                Score: {risk.score}
                                                            </div>
                                                        </div>
                                                    ) : null;
                                                })
                                            ) : (
                                                <EmptyState
                                                    icon={ShieldAlert}
                                                    title="Aucun scénario lié"
                                                    description="Liez des risques existants à ce processus pour analyser les impacts."
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {inspectorTab === 'drills' && (
                                <div className="space-y-4">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Historique des exercices</h3>
                                    {drills.filter(d => d.processId === selectedProcess.id).length === 0 ? (
                                        <div className="text-center py-12 text-gray-400 bg-white dark:bg-slate-800/30 rounded-3xl border border-dashed border-gray-200 dark:border-white/10 italic">Aucun test effectué pour ce processus.</div>
                                    ) : (
                                        drills.filter(d => d.processId === selectedProcess.id).map(drill => (
                                            <div key={drill.id} className="bg-white dark:bg-slate-800/50 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center"><CalendarDays className="h-3.5 w-3.5 mr-2 text-slate-400" /> {new Date(drill.date).toLocaleDateString()}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${drill.result === 'Succès' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{drill.result}</span>
                                                </div>
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{drill.type}</p>
                                                <p className="text-sm text-slate-600 dark:text-slate-300">{drill.notes}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {inspectorTab === 'history' && (
                                <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                    {processHistory.map((log, i) => (
                                        <div key={i} className="relative">
                                            <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-brand-900">
                                                <div className="h-2 w-2 rounded-full bg-brand-600"></div>
                                            </span>
                                            <div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.details}</p>
                                                <p className="text-[10px] text-gray-400 mt-1">Par: {log.userEmail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {inspectorTab === 'comments' && (
                                <div className="h-full flex flex-col">
                                    <Comments collectionName="business_processes" documentId={selectedProcess.id} />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Drawer>


            {/* Create Process Modal */}
            {/* Create Process Drawer */}
            <Drawer
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Nouveau Processus Critique"
                subtitle="Définissez un nouveau processus pour l'analyse d'impact."
            >
                <form onSubmit={createProcessForm.handleSubmit(handleCreateProcess)} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom du processus</label>
                            <input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none font-medium"
                                {...createProcessForm.register('name')} placeholder="ex: Gestion des Commandes" />
                            {createProcessForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{createProcessForm.formState.errors.name.message}</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Responsable</label>
                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none font-medium appearance-none"
                                {...createProcessForm.register('owner')}>
                                <option value="">Sélectionner...</option>
                                {usersList.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">RTO</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none font-medium" {...createProcessForm.register('rto')} placeholder="4h" /></div>
                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">RPO</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none font-medium" {...createProcessForm.register('rpo')} placeholder="1h" /></div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Description</label>
                        <textarea className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none font-medium resize-none" rows={2} {...createProcessForm.register('description')} />
                    </div>
                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="px-8 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 hover:scale-105 transition-all font-bold text-sm shadow-lg shadow-rose-500/30">Créer</button>
                    </div>
                </form>
            </Drawer>

            {/* Drill Modal */}
            {/* Drill Drawer */}
            <Drawer
                isOpen={showDrillModal}
                onClose={() => setShowDrillModal(false)}
                title="Enregistrer un exercice"
                subtitle="Documentez vos tests de continuité."
            >
                <form onSubmit={drillForm.handleSubmit(handleSubmitDrill)} className="p-8 space-y-5">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Processus Testé</label>
                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                            {...drillForm.register('processId')}>
                            {processes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Date</label>
                            <input type="date" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                {...drillForm.register('date')} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Type</label>
                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                                {...drillForm.register('type')}>
                                {['Tabletop', 'Simulation', 'Bascule réelle'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Résultat</label>
                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                            {...drillForm.register('result')}>
                            {['Succès', 'Succès partiel', 'Échec'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Notes / Observations</label>
                        <textarea rows={3} className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium resize-none"
                            {...drillForm.register('notes')} placeholder="Le RTO a-t-il été respecté ?" />
                    </div>
                    <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                        <button type="button" onClick={() => setShowDrillModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                        <button type="submit" className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform font-bold text-sm shadow-lg">Enregistrer</button>
                    </div>
                </form>
            </Drawer>
        </div >
    );
};
