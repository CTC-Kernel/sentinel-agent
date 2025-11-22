
import React, { useEffect, useState, useRef } from 'react';
import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, where, limit, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { ProcessingActivity, SystemLog, UserProfile } from '../types';
import { Plus, Search, Fingerprint, Trash2, Edit, GlobeLock, Scale, FileSpreadsheet, CheckCircle2, Clock, Activity, AlertTriangle, X, History, MessageSquare, Save, LayoutDashboard, Upload } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Comments } from '../components/ui/Comments';

export const Privacy: React.FC = () => {
    const [activities, setActivities] = useState<ProcessingActivity[]>([]);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filter, setFilter] = useState('');
    const { user, addToast } = useStore();
    const canEdit = user?.role === 'admin' || user?.role === 'auditor';
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Inspector State
    const [selectedActivity, setSelectedActivity] = useState<ProcessingActivity | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'details' | 'data' | 'history' | 'comments'>('details');
    const [activityHistory, setActivityHistory] = useState<SystemLog[]>([]);
    const [editForm, setEditForm] = useState<Partial<ProcessingActivity>>({});
    const [isEditing, setIsEditing] = useState(false);

    // Stats State
    const [stats, setStats] = useState({ total: 0, sensitive: 0, dpiaMissing: 0, review: 0 });

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const [newActivity, setNewActivity] = useState<Partial<ProcessingActivity>>({
        name: '', purpose: '', manager: '', legalBasis: 'Intérêt Légitime', dataCategories: [],
        dataSubjects: [], retentionPeriod: '', hasDPIA: false, status: 'Actif'
    });

    const fetchActivities = async () => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'processing_activities'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId)))
            ]);

            const getDocsData = <T,>(result: PromiseSettledResult<any>): T[] => {
                if (result.status === 'fulfilled') {
                    return result.value.docs.map((d: any) => ({ id: d.id, ...d.data() })) as T[];
                }
                return [];
            };

            const data = getDocsData<ProcessingActivity>(results[0]);
            // Sort client-side
            data.sort((a, b) => a.name.localeCompare(b.name));
            setActivities(data);

            const userData = getDocsData<UserProfile>(results[1]);
            setUsersList(userData);

            // Calculate Stats
            const total = data.length;
            const sensitive = data.filter(a => a.dataCategories.some(c => ['Santé (Sensible)', 'Biométrique', 'Judiciaire'].includes(c))).length;
            const dpiaMissing = data.filter(a => a.dataCategories.some(c => ['Santé (Sensible)', 'Biométrique', 'Judiciaire'].includes(c)) && !a.hasDPIA).length;
            const review = data.filter(a => a.status !== 'Actif').length;

            setStats({ total, sensitive, dpiaMissing, review });

        } catch (err) {
            addToast("Erreur chargement traitements", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchActivities(); }, [user?.organizationId]);

    const openInspector = async (activity: ProcessingActivity) => {
        setSelectedActivity(activity);
        setEditForm(activity);
        setInspectorTab('details');
        setIsEditing(false);

        try {
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user?.organizationId), limit(50));
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => d.data() as SystemLog);
            const filteredLogs = logs.filter(l => l.resource === 'Privacy' && l.details?.includes(activity.name));
            filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setActivityHistory(filteredLogs);
        } catch (e) { console.error(e); }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'processing_activities'), { ...newActivity, organizationId: user.organizationId, createdAt: new Date().toISOString() });
            await logAction(user, 'CREATE', 'Privacy', `Nouveau Traitement: ${newActivity.name}`);
            addToast("Traitement ajouté au registre", "success");
            setShowCreateModal(false);
            fetchActivities();
        } catch (e) { addToast("Erreur enregistrement", "error"); }
    };

    const handleUpdate = async () => {
        if (!canEdit || !selectedActivity) return;
        try {
            const { id, ...data } = editForm as any;
            await updateDoc(doc(db, 'processing_activities', selectedActivity.id), data);
            await logAction(user, 'UPDATE', 'Privacy', `MAJ Traitement: ${editForm.name}`);
            setActivities(prev => prev.map(a => a.id === selectedActivity.id ? { ...a, ...data } : a));
            setSelectedActivity({ ...selectedActivity, ...data });
            setIsEditing(false);
            addToast("Traitement mis à jour", "success");
            fetchActivities();
        } catch (e) { addToast("Erreur mise à jour", "error"); }
    };

    const initiateDelete = (id: string, name: string) => {
        if (!canEdit) return;
        setConfirmData({
            isOpen: true,
            title: "Supprimer le traitement ?",
            message: "Cette action retirera définitivement le traitement du registre.",
            onConfirm: () => handleDelete(id, name)
        });
    };

    const handleDelete = async (id: string, name: string) => {
        try {
            await deleteDoc(doc(db, 'processing_activities', id));
            setActivities(prev => prev.filter(a => a.id !== id));
            setSelectedActivity(null);
            await logAction(user, 'DELETE', 'Privacy', `Suppression: ${name}`);
            addToast("Traitement supprimé", "info");
            fetchActivities();
        } catch (e) { addToast("Erreur suppression", "error"); }
    };

    const handleExportCSV = () => {
        const headers = ["Nom", "Finalité", "Responsable", "Base Légale", "Catégories Données", "Durée Conservation", "DPIA"];
        const rows = filteredActivities.map(a => [
            a.name,
            a.purpose,
            a.manager,
            a.legalBasis,
            a.dataCategories.join('; '),
            a.retentionPeriod,
            a.hasDPIA ? 'Oui' : 'Non'
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `ropa_gdpr_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!canEdit || !user?.organizationId) return;
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) return;
            const lines = text.split('\n').slice(1).filter(line => line.trim() !== '');
            if (lines.length === 0) { addToast("Fichier vide", "error"); return; }

            setLoading(true);
            try {
                const batch = writeBatch(db);
                let count = 0;
                lines.forEach(line => {
                    const cols = line.split(',');
                    if (cols.length >= 3) {
                        const newRef = doc(collection(db, 'processing_activities'));
                        batch.set(newRef, {
                            organizationId: user.organizationId,
                            name: cols[0]?.trim() || 'Traitement importé',
                            purpose: cols[1]?.trim() || 'N/A',
                            manager: cols[2]?.trim() || 'N/A',
                            legalBasis: 'Intérêt Légitime',
                            dataCategories: [],
                            dataSubjects: [],
                            retentionPeriod: '5 ans',
                            hasDPIA: false,
                            status: 'Actif',
                            createdAt: new Date().toISOString()
                        });
                        count++;
                    }
                });
                await batch.commit();
                await logAction(user, 'IMPORT', 'Privacy', `Import CSV de ${count} traitements`);
                addToast(`${count} traitements importés`, "success");
                fetchActivities();
            } catch (error) { addToast("Erreur import CSV", "error"); } finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
        };
        reader.readAsText(file);
    };

    const handleMultiSelectChange = (field: 'dataCategories' | 'dataSubjects', value: string) => {
        const current = editForm[field] || [];
        if (current.includes(value)) {
            setEditForm({ ...editForm, [field]: current.filter(v => v !== value) });
        } else {
            setEditForm({ ...editForm, [field]: [...current, value] });
        }
    };

    const handleNewMultiSelectChange = (field: 'dataCategories' | 'dataSubjects', value: string) => {
        const current = newActivity[field] || [];
        if (current.includes(value)) {
            setNewActivity({ ...newActivity, [field]: current.filter(v => v !== value) });
        } else {
            setNewActivity({ ...newActivity, [field]: [...current, value] });
        }
    };

    const filteredActivities = activities.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()));

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative">
            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
            />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display tracking-tight">Registre RGPD</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Registre des Activités de Traitement (ROPA) - Art. 30.</p>
                </div>
                {canEdit && (
                    <div className="flex gap-3">
                        <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm text-slate-700 dark:text-white">
                            <Upload className="h-4 w-4 mr-2" /> Importer
                        </button>
                        <button onClick={() => {
                            setNewActivity({ name: '', purpose: '', manager: user?.displayName || '', legalBasis: 'Intérêt Légitime', dataCategories: [], dataSubjects: [], retentionPeriod: '5 ans', hasDPIA: false, status: 'Actif' });
                            setShowCreateModal(true);
                        }} className="flex items-center px-5 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 hover:scale-105 transition-all shadow-lg shadow-purple-500/30">
                            <Plus className="h-4 w-4 mr-2" /> Nouveau Traitement
                        </button>
                    </div>
                )}
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Traitements</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-600"><Activity className="h-6 w-6" /></div>
                </div>
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-1">Données Sensibles</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.sensitive}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600"><Fingerprint className="h-6 w-6" /></div>
                </div>
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">DPIA Manquants</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.dpiaMissing}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600"><AlertTriangle className="h-6 w-6" /></div>
                </div>
                <div className="glass-panel p-6 rounded-[2.5rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-1">En cours / Projet</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.review}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600"><Clock className="h-6 w-6" /></div>
                </div>
            </div>

            <div className="glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-purple-500/20 transition-all border border-slate-200 dark:border-white/5">
                <Search className="h-5 w-5 text-gray-400" />
                <input type="text" placeholder="Rechercher un traitement (ex: Paie, CRM)..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400"
                    value={filter} onChange={e => setFilter(e.target.value)} />
                <button onClick={handleExportCSV} className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors" title="Exporter le Registre">
                    <FileSpreadsheet className="h-4 w-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? <div className="col-span-full text-center py-12 text-gray-400">Chargement...</div> :
                    filteredActivities.length === 0 ? <div className="col-span-full text-center py-12 text-gray-400 italic">Aucun traitement enregistré.</div> :
                        filteredActivities.map(activity => (
                            <div key={activity.id} onClick={() => openInspector(activity)} className="glass-panel rounded-[2.5rem] p-7 shadow-sm hover:shadow-apple transition-all duration-300 hover:-translate-y-1 flex flex-col relative overflow-hidden cursor-pointer group border border-white/50 dark:border-white/5">
                                <div className="flex justify-between items-start mb-5">
                                    <div className="p-3 bg-purple-50 dark:bg-slate-800 rounded-2xl text-purple-600 shadow-inner">
                                        <Fingerprint className="h-6 w-6" />
                                    </div>
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${activity.status === 'Actif' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400' : 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-white/5 dark:border-white/10 dark:text-gray-400'}`}>
                                        {activity.status}
                                    </span>
                                </div>

                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight">{activity.name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2 flex-1 leading-relaxed">{activity.purpose}</p>

                                <div className="space-y-3 pt-5 border-t border-dashed border-gray-200 dark:border-white/10">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center"><Scale className="h-3 w-3 mr-1.5" />Base Légale</span>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg">{activity.legalBasis}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center"><GlobeLock className="h-3 w-3 mr-1.5" />Catégories</span>
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                                            {activity.dataCategories.length > 0 ? activity.dataCategories.join(', ') : '-'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center"><Clock className="h-3 w-3 mr-1.5" />Conservation</span>
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{activity.retentionPeriod}</span>
                                    </div>
                                </div>

                                {activity.hasDPIA && (
                                    <div className="mt-5 flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-900/30">
                                        <CheckCircle2 className="h-3 w-3 mr-1.5" /> DPIA Effectué
                                    </div>
                                )}

                                {canEdit && (
                                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); initiateDelete(activity.id, activity.name) }} className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-xl text-slate-400 hover:text-red-50 shadow-sm backdrop-blur-sm"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                )}
                            </div>
                        ))
                }
            </div>

            {/* Inspector Drawer */}
            {selectedActivity && (
                <div className="fixed inset-0 z-[100] overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setSelectedActivity(null)} />
                    <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex pointer-events-none">
                        <div className="w-screen max-w-2xl pointer-events-auto">
                            <div className="h-full flex flex-col bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-slide-up">
                                <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-start justify-between bg-white/50 dark:bg-white/5">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">{selectedActivity.name}</h2>
                                        <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                                            {selectedActivity.status} • {selectedActivity.manager}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        {canEdit && !isEditing && (
                                            <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                                        )}
                                        {canEdit && isEditing && (
                                            <button onClick={handleUpdate} className="p-2.5 text-brand-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Save className="h-5 w-5" /></button>
                                        )}
                                        {canEdit && (
                                            <button onClick={() => initiateDelete(selectedActivity.id, selectedActivity.name)} className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                                        )}
                                        <button onClick={() => setSelectedActivity(null)} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
                                    </div>
                                </div>

                                <div className="px-8 border-b border-gray-100 dark:border-white/5 flex gap-8 bg-white/30 dark:bg-white/5">
                                    {[
                                        { id: 'details', label: 'Fiche Registre', icon: LayoutDashboard },
                                        { id: 'data', label: 'Données & Sécurité', icon: GlobeLock },
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
                                                <>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Responsable</label>
                                                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium appearance-none" value={editForm.manager} onChange={e => setEditForm({ ...editForm, manager: e.target.value })}>
                                                                {usersList.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Finalité</label><textarea className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium resize-none" rows={3} value={editForm.purpose} onChange={e => setEditForm({ ...editForm, purpose: e.target.value })} /></div>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Base Légale</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium appearance-none" value={editForm.legalBasis} onChange={e => setEditForm({ ...editForm, legalBasis: e.target.value as any })}>{['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium appearance-none" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value as any })}> <option value="Actif">Actif</option><option value="En projet">En projet</option><option value="Archivé">Archivé</option></select></div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Finalité</h4>
                                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedActivity.purpose}</p>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm text-center">
                                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">Base Légale</span>
                                                            <span className="text-lg font-bold text-slate-900 dark:text-white">{selectedActivity.legalBasis}</span>
                                                        </div>
                                                        <div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm text-center">
                                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">Responsable</span>
                                                            <span className="text-lg font-bold text-slate-900 dark:text-white">{selectedActivity.manager}</span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {inspectorTab === 'data' && (
                                        <div className="space-y-8">
                                            {isEditing ? (
                                                <>
                                                    <div>
                                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Catégories de données</label>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {['État civil', 'Vie personnelle', 'Bancaire / Financier', 'Connexion / Trace', 'Santé (Sensible)', 'Biométrique', 'Judiciaire'].map(cat => (
                                                                <label key={cat} className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${editForm.dataCategories?.includes(cat) ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                                                    <input type="checkbox" className="rounded-md text-purple-600 focus:ring-purple-500 border-gray-300" checked={editForm.dataCategories?.includes(cat)} onChange={() => handleMultiSelectChange('dataCategories', cat)} />
                                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{cat}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Durée Conservation</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium" value={editForm.retentionPeriod} onChange={e => setEditForm({ ...editForm, retentionPeriod: e.target.value })} /></div>
                                                        <div className="flex items-end pb-4">
                                                            <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 w-full transition-colors">
                                                                <input type="checkbox" className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 border-gray-300" checked={editForm.hasDPIA} onChange={e => setEditForm({ ...editForm, hasDPIA: e.target.checked })} />
                                                                <span className="text-sm font-bold text-slate-900 dark:text-white">DPIA Requis ?</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Catégories de Données</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {selectedActivity.dataCategories.map(c => (
                                                                <span key={c} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-600">
                                                                    {c}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 p-6 rounded-3xl border border-purple-100 dark:border-purple-900/30">
                                                        <div>
                                                            <h4 className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-300 mb-1">Analyse d'Impact (DPIA)</h4>
                                                            <p className="text-2xl font-black text-purple-900 dark:text-white">{selectedActivity.hasDPIA ? 'Effectuée' : 'Non requise / Non faite'}</p>
                                                        </div>
                                                        <div className="p-3 bg-white/50 dark:bg-white/10 rounded-2xl">
                                                            {selectedActivity.hasDPIA ? <CheckCircle2 className="h-8 w-8 text-purple-600" /> : <AlertTriangle className="h-8 w-8 text-purple-400" />}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {inspectorTab === 'history' && (
                                        <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                            {activityHistory.map((log, i) => (
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
                                            <Comments collectionName="processing_activities" documentId={selectedActivity.id} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

            {/* Create Modal */}
            {
                showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] shadow-2xl w-full max-w-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-purple-50/30 dark:bg-purple-900/10">
                                <h2 className="text-2xl font-bold text-purple-900 dark:text-purple-100 tracking-tight">Nouveau Traitement</h2>
                            </div>
                            <form onSubmit={handleCreate} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom du traitement</label>
                                        <input required className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                                            value={newActivity.name} onChange={e => setNewActivity({ ...newActivity, name: e.target.value })} placeholder="ex: Gestion Paie" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Responsable</label>
                                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium appearance-none"
                                            value={newActivity.manager} onChange={e => setNewActivity({ ...newActivity, manager: e.target.value })}>
                                            <option value="">Sélectionner...</option>
                                            {usersList.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Finalité principale</label>
                                    <textarea required rows={2} className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium resize-none"
                                        value={newActivity.purpose} onChange={e => setNewActivity({ ...newActivity, purpose: e.target.value })} placeholder="ex: Payer les salaires et déclarations sociales" />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Base Légale</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium appearance-none" value={newActivity.legalBasis} onChange={e => setNewActivity({ ...newActivity, legalBasis: e.target.value as any })}>{['Consentement', 'Contrat', 'Obligation Légale', 'Intérêt Légitime'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label><select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium appearance-none" value={newActivity.status} onChange={e => setNewActivity({ ...newActivity, status: e.target.value as any })}> <option value="Actif">Actif</option><option value="En projet">En projet</option><option value="Archivé">Archivé</option></select></div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Catégories de données</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['État civil', 'Vie personnelle', 'Bancaire / Financier', 'Connexion / Trace', 'Santé (Sensible)', 'Biométrique', 'Judiciaire'].map(cat => (
                                            <label key={cat} className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${newActivity.dataCategories?.includes(cat) ? 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800' : 'border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                                <input type="checkbox" className="rounded-md text-purple-600 focus:ring-purple-500 border-gray-300" checked={newActivity.dataCategories?.includes(cat)} onChange={() => handleNewMultiSelectChange('dataCategories', cat)} />
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{cat}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Durée Conservation</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none font-medium" value={newActivity.retentionPeriod} onChange={e => setNewActivity({ ...newActivity, retentionPeriod: e.target.value })} placeholder="ex: 5 ans après départ" /></div>
                                    <div className="flex items-end pb-4"><label className="flex items-center space-x-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 w-full transition-colors"><input type="checkbox" className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 border-gray-300" checked={newActivity.hasDPIA} onChange={e => setNewActivity({ ...newActivity, hasDPIA: e.target.checked })} /><span className="text-sm font-bold text-slate-900 dark:text-white">DPIA Requis ?</span></label></div>
                                </div>
                                <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                                    <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                                    <button type="submit" className="px-8 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 hover:scale-105 transition-all font-bold text-sm shadow-lg shadow-purple-500/30">Enregistrer</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
