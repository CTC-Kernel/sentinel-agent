
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, where, limit, writeBatch, QuerySnapshot, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Supplier, SupplierAssessment, SupplierIncident, Document, SystemLog, Criticality, UserProfile } from '../types';
import { Plus, Search, Building, Trash2, Edit, Handshake, Truck, Mail, ShieldAlert, FileText, ClipboardList, X, History, MessageSquare, Save, FileSpreadsheet, Link, CalendarDays, TrendingUp, Upload } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { Comments } from '../components/ui/Comments';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorLogger } from '../services/errorLogger';

export const Suppliers: React.FC = () => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [assessments, setAssessments] = useState<SupplierAssessment[]>([]);
    const [incidents, setIncidents] = useState<SupplierIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filter, setFilter] = useState('');
    const { user, addToast } = useStore();
    const canEdit = user?.role === 'admin';

    // Inspector State
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'profile' | 'assessment' | 'incidents' | 'history' | 'comments'>('profile');
    const [supplierHistory, setSupplierHistory] = useState<SystemLog[]>([]);

    // Stats State
    const [stats, setStats] = useState({ total: 0, critical: 0, avgScore: 0, expired: 0, highRisk: 0, activeIncidents: 0 });

    // Edit Form State
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Supplier>>({});

    // Import
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const fetchSuppliers = async () => {
        if (!user?.organizationId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // Use Promise.allSettled for robustness
            const results = await Promise.allSettled([
                getDocs(query(collection(db, 'suppliers'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'documents'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'supplierAssessments'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'supplierIncidents'), where('organizationId', '==', user.organizationId))),
                getDocs(query(collection(db, 'users'), where('organizationId', '==', user.organizationId)))
            ]);

            const getDocsData = <T,>(result: PromiseSettledResult<QuerySnapshot<DocumentData>>): T[] => {
                if (result.status === 'fulfilled') {
                    return result.value.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() })) as unknown as T[];
                }
                return [];
            };

            const userData = getDocsData<UserProfile>(results[4]);
            setUsersList(userData);

            const data = getDocsData<Supplier>(results[0]);
            // Resolve ownerId for legacy data
            const resolvedData = data.map(s => {
                if (!s.ownerId && s.owner) {
                    const ownerUser = userData.find(u => u.displayName === s.owner);
                    if (ownerUser) return { ...s, ownerId: ownerUser.uid };
                }
                return s;
            });
            resolvedData.sort((a, b) => a.name.localeCompare(b.name));
            setSuppliers(resolvedData);

            const docData = getDocsData<Document>(results[1]);
            setDocuments(docData);

            const assessmentData = getDocsData<SupplierAssessment>(results[2]);
            setAssessments(assessmentData);

            const incidentData = getDocsData<SupplierIncident>(results[3]);
            setIncidents(incidentData);

            // Calculate Stats
            const total = data.length;
            const critical = data.filter(s => s.riskLevel === 'Critical' || s.riskLevel === 'High').length;
            const avgScore = total > 0 ? Math.round(data.reduce((acc, s) => acc + s.riskAssessment.overallScore, 0) / total) : 0;
            const today = new Date();
            const expired = data.filter(s => s.contract.endDate && new Date(s.contract.endDate) < today).length;
            const highRisk = data.filter(s => s.riskLevel === 'High' || s.riskLevel === 'Critical').length;
            const activeIncidents = incidentData.filter(i => i.status === 'Open' || i.status === 'Investigating').length;

            setStats({ total, critical, avgScore, expired, highRisk, activeIncidents });

        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Suppliers.fetchSuppliers', 'FETCH_FAILED');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSuppliers(); }, [user?.organizationId]);

    // ... (Rest of the file logic unchanged)

    const openInspector = async (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setInspectorTab('profile');
        setFormData(supplier);
        setIsEditing(false);

        try {
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user?.organizationId), limit(50));
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemLog));
            const relevantLogs = logs.filter(l => l.resource === 'Supplier' && l.details?.includes(supplier.name));
            relevantLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setSupplierHistory(relevantLogs);
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Suppliers.handleSelectSupplier'); }
    };

    const openCreateModal = () => {
        setFormData({
            name: '',
            category: 'Software',
            contact: {
                email: '',
                phone: '',
                address: '',
                website: '',
                contactName: ''
            },
            contract: {
                startDate: new Date().toISOString(),
                value: 0,
                currency: 'EUR'
            },
            compliance: {
                iso27001: false,
                gdpr: false,
                soc2: false,
                hipaa: false,
                otherCertifications: []
            },
            riskAssessment: {
                overallScore: 3,
                dataAccess: 'Medium',
                dependencyLevel: 'Medium',
                geographicRisk: 'Low',
                financialStability: 3,
                securityMaturity: 3,
                lastAssessment: new Date().toISOString(),
                nextAssessment: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            },
            documents: {},
            status: 'Active',
            riskLevel: 'Medium',
            owner: user?.displayName || '',
            ownerId: user?.uid || '',
            reviewDates: {
                contractReview: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                securityReview: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
                complianceReview: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            }
        });
        setIsEditing(false);
        setShowModal(true);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'suppliers'), {
                ...formData,
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            await logAction(user, 'CREATE', 'Supplier', `Ajout Fournisseur: ${formData.name}`);
            addToast("Fournisseur ajouté", "success");
            setShowModal(false);
            fetchSuppliers();
        } catch (e) { addToast("Erreur enregistrement", "error"); }
    };

    const handleUpdate = async () => {
        if (!canEdit || !selectedSupplier) return;
        try {
            const { id, ...data } = formData as any;
            await updateDoc(doc(db, 'suppliers', selectedSupplier.id), {
                ...data,
                updatedAt: new Date().toISOString()
            });
            await logAction(user, 'UPDATE', 'Supplier', `MAJ Fournisseur: ${formData.name}`);
            setSuppliers(prev => prev.map(s => s.id === selectedSupplier.id ? { ...s, ...data } : s));
            setSelectedSupplier({ ...selectedSupplier, ...data });
            setIsEditing(false);
            addToast("Fournisseur mis à jour", "success");
            fetchSuppliers(); // Refresh stats
        } catch (_e) { addToast("Erreur mise à jour", "error"); }
    };

    const initiateDelete = (id: string, name: string) => {
        if (!canEdit) return;
        setConfirmData({
            isOpen: true,
            title: `Supprimer ${name} ?`,
            message: "Cette action est définitive et supprimera toutes les données associées à ce fournisseur.",
            onConfirm: () => handleDelete(id)
        });
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ? Cette action supprimera également les évaluations et incidents associés.')) return;

        try {
            // 1. Delete related assessments
            const assessmentsQuery = query(collection(db, 'supplierAssessments'), where('supplierId', '==', id));
            const assessmentsSnap = await getDocs(assessmentsQuery);
            const deleteAssessments = assessmentsSnap.docs.map(doc => deleteDoc(doc.ref));

            // 2. Delete related incidents
            const incidentsQuery = query(collection(db, 'supplierIncidents'), where('supplierId', '==', id));
            const incidentsSnap = await getDocs(incidentsQuery);
            const deleteIncidents = incidentsSnap.docs.map(doc => deleteDoc(doc.ref));

            // 3. Delete the supplier itself
            await Promise.all([...deleteAssessments, ...deleteIncidents, deleteDoc(doc(db, 'suppliers', id))]);

            setSuppliers(prev => prev.filter(s => s.id !== id));
            addToast('Fournisseur et données associées supprimés', 'success');
            if (selectedSupplier?.id === id) setSelectedSupplier(null);
            fetchSuppliers(); // Refresh stats and clear related data
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Suppliers.handleDelete');
            addToast('Erreur lors de la suppression', 'error');
        }
    };

    const toggleAssessment = (field: keyof NonNullable<Supplier['assessment']>) => {
        if (!formData.assessment) return;
        const updated = { ...formData.assessment, [field]: !(formData.assessment as any)[field] };

        // Recalculate score
        let score = 0;
        if (updated.hasIso27001) score += 30;
        if (updated.hasGdprPolicy) score += 20;
        if (updated.hasEncryption) score += 20;
        if (updated.hasBcp) score += 15;
        if (updated.hasIncidentProcess) score += 15;

        setFormData(prev => ({ ...prev, assessment: updated, securityScore: score }));
        setIsEditing(true); // Flag as edited so we can save
    };

    const handleExportCSV = () => {
        const headers = ["Nom", "Catégorie", "Criticité", "Score Sécurité", "Contact", "Fin Contrat", "Statut"];
        const rows = filteredSuppliers.map(s => [
            s.name,
            s.category,
            s.criticality,
            s.securityScore?.toString() || '0',
            s.contactEmail,
            s.contractEnd ? new Date(s.contractEnd).toLocaleDateString() : '',
            s.status
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `suppliers_export_${new Date().toISOString().split('T')[0]}.csv`;
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
                        const newRef = doc(collection(db, 'suppliers'));
                        batch.set(newRef, {
                            organizationId: user.organizationId,
                            name: cols[0]?.trim() || 'Inconnu',
                            category: (cols[1]?.trim() || 'Autre') as any,
                            criticality: (cols[2]?.trim() || 'Moyenne') as any,
                            contactName: cols[3]?.trim() || '',
                            contactEmail: cols[4]?.trim() || '',
                            status: 'Actif',
                            securityScore: 0,
                            assessment: {
                                hasIso27001: false, hasGdprPolicy: false, hasEncryption: false,
                                hasBcp: false, hasIncidentProcess: false, lastAssessmentDate: new Date().toISOString()
                            },
                            owner: user.displayName || 'Importé',
                            ownerId: user.uid,
                            createdAt: new Date().toISOString()
                        });
                        count++;
                    }
                });
                await batch.commit();
                await logAction(user, 'IMPORT', 'Supplier', `Import CSV de ${count} fournisseurs`);
                addToast(`${count} fournisseurs importés`, "success");
                fetchSuppliers();
            } catch (_error) { addToast("Erreur import CSV", "error"); } finally { setLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
        };
        reader.readAsText(file);
    };

    const getCriticalityColor = (c: Criticality) => {
        switch (c) {
            case Criticality.CRITICAL: return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
            case Criticality.HIGH: return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800';
            case Criticality.MEDIUM: return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800';
            default: return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'bg-emerald-500';
        if (score >= 50) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const filteredSuppliers = suppliers.filter(s => s.name.toLowerCase().includes(filter.toLowerCase()));

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
                title="Fournisseurs"
                subtitle="Gestion des tiers et des contrats (ISO 27001 A.15)."
                breadcrumbs={[
                    { label: 'Fournisseurs' }
                ]}
                icon={<Handshake className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={canEdit && (
                    <>
                        <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm text-slate-700 dark:text-white"
                        >
                            <Upload className="h-4 w-4 mr-2" /> Importer
                        </button>
                        <button
                            onClick={openCreateModal}
                            className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Nouveau Fournisseur
                        </button>
                    </>
                )}
            />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Fournisseurs</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600"><Building className="h-6 w-6" /></div>
                </div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">Critiques / Élevés</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.critical}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600"><ShieldAlert className="h-6 w-6" /></div>
                </div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">Score Moyen</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.avgScore}/100</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"><TrendingUp className="h-6 w-6" /></div>
                </div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-1">Contrats Expirés</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{stats.expired}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600"><CalendarDays className="h-6 w-6" /></div>
                </div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-purple-600 mb-1">Évaluations</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{assessments.length}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-900/20 text-purple-600"><ClipboardList className="h-6 w-6" /></div>
                </div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">Incidents</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">{incidents.length}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600"><ShieldAlert className="h-6 w-6" /></div>
                </div>
            </div>

            <div className="glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all border border-slate-200 dark:border-white/5">
                <Search className="h-5 w-5 text-gray-400" />
                <input type="text" placeholder="Rechercher un fournisseur..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400"
                    value={filter} onChange={e => setFilter(e.target.value)} />
                <button onClick={handleExportCSV} className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors" title="Exporter CSV">
                    <FileSpreadsheet className="h-4 w-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full"><CardSkeleton count={3} /></div>
                ) : filteredSuppliers.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            icon={Building}
                            title="Aucun fournisseur"
                            description={filter ? "Aucun fournisseur ne correspond à votre recherche." : "Gérez vos fournisseurs et évaluez leur sécurité."}
                            actionLabel={filter ? undefined : "Nouveau Fournisseur"}
                            onAction={filter ? undefined : openCreateModal}
                        />
                    </div>
                ) : (
                    filteredSuppliers.map(supplier => {
                        const linkedDoc = documents.find(d => d.id === supplier.contractDocumentId);
                        const isExpired = supplier.contractEnd && new Date(supplier.contractEnd) < new Date();

                        return (
                            <div key={supplier.id} onClick={() => openInspector(supplier)} className="glass-panel rounded-[2.5rem] border border-white/50 dark:border-white/5 p-7 shadow-sm card-hover relative group cursor-pointer flex flex-col h-full">
                                <div className="flex justify-between items-start mb-5">
                                    <div className="p-3 bg-indigo-50 dark:bg-slate-800 rounded-2xl text-indigo-600 shadow-inner">
                                        {supplier.category === 'Matériel' ? <Truck className="h-6 w-6" /> : <Building className="h-6 w-6" />}
                                    </div>
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase border ${getCriticalityColor(supplier.criticality || Criticality.MEDIUM)}`}>
                                        {supplier.criticality}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{supplier.name}</h3>
                                <div className="flex flex-wrap gap-2 mb-6">
                                    <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">{supplier.category}</span>
                                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wide border ${supplier.status === 'Actif' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{supplier.status}</span>
                                </div>

                                <div className="mb-6 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <div className="flex justify-between text-xs mb-2">
                                        <span className="text-slate-500 dark:text-slate-400 flex items-center font-bold uppercase tracking-wide"><ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> Sécurité</span>
                                        <span className={`font-black ${getScoreColor(supplier.securityScore || 0).replace('bg-', 'text-')}`}>{supplier.securityScore || 0}/100</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                        <div className={`h-2 rounded-full transition-all duration-500 ${getScoreColor(supplier.securityScore || 0)}`} style={{ width: `${supplier.securityScore || 0}%` }}></div>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-4 border-t border-dashed border-gray-200 dark:border-white/10 mt-auto">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center font-medium text-slate-600 dark:text-slate-300">
                                            <Handshake className="h-3.5 w-3.5 mr-2 text-slate-400" /> {supplier.contactName || 'Non spécifié'}
                                        </div>
                                        {supplier.contractEnd && (
                                            <div className={`flex items-center font-bold ${isExpired ? 'text-red-500' : 'text-slate-400'}`}>
                                                <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                                                {new Date(supplier.contractEnd).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-300">
                                        <FileText className="h-3.5 w-3.5 mr-2 text-slate-400" />
                                        {linkedDoc ? (
                                            <span className="text-brand-600 truncate max-w-[180px] hover:underline">{linkedDoc.title}</span>
                                        ) : <span className="text-gray-400 italic">Aucun contrat lié</span>}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Inspector Drawer */}
            {selectedSupplier && createPortal(
                <div className="fixed inset-0 z-[9999] overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setSelectedSupplier(null)} />
                    <div className="absolute inset-y-0 right-0 sm:pl-10 max-w-full flex pointer-events-none">
                        <div className="w-screen max-w-2xl pointer-events-auto">
                            <div className="h-full flex flex-col bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-slide-up">
                                {/* Header */}
                                <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-start justify-between bg-white/50 dark:bg-white/5">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">{selectedSupplier.name}</h2>
                                        <p className="text-sm text-slate-500 mt-1 font-medium">{selectedSupplier.category} • {selectedSupplier.status}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {canEdit && !isEditing && (
                                            <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                                        )}
                                        {canEdit && isEditing && (
                                            <button onClick={handleUpdate} className="p-2.5 text-brand-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Save className="h-5 w-5" /></button>
                                        )}
                                        {canEdit && (
                                            <button onClick={() => initiateDelete(selectedSupplier.id, selectedSupplier.name)} className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                                        )}
                                        <button onClick={() => setSelectedSupplier(null)} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="px-8 border-b border-gray-100 dark:border-white/5 flex gap-8 bg-white/30 dark:bg-white/5">
                                    {[
                                        { id: 'profile', label: 'Profil', icon: Building },
                                        { id: 'assessment', label: 'Évaluation Sécurité', icon: ClipboardList },
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

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
                                    {inspectorTab === 'profile' && (
                                        <div className="space-y-8">
                                            {isEditing ? (
                                                <>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Catégorie</label>
                                                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as any })}>
                                                                {['SaaS', 'Hébergement', 'Matériel', 'Consulting', 'Autre'].map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Responsable</label>
                                                        <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                                                            value={formData.ownerId || ''}
                                                            onChange={e => {
                                                                const selectedUser = usersList.find(u => u.uid === e.target.value);
                                                                setFormData({ ...formData, ownerId: e.target.value, owner: selectedUser?.displayName || '' });
                                                            }}>
                                                            <option value="">Sélectionner...</option>
                                                            {usersList.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                                                        </select>
                                                    </div>
                                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Description</label><textarea className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium resize-none" rows={2} value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Contact Nom</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium" value={formData.contactName} onChange={e => setFormData({ ...formData, contactName: e.target.value })} /></div>
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium" value={formData.contactEmail} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Criticité</label>
                                                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none" value={formData.criticality} onChange={e => setFormData({ ...formData, criticality: e.target.value as any })}>
                                                                {Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}
                                                            </select>
                                                        </div>
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label>
                                                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                                                                <option value="Actif">Actif</option><option value="En cours">En cours</option><option value="Terminé">Terminé</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Contrat (Document)</label>
                                                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none" value={formData.contractDocumentId} onChange={e => setFormData({ ...formData, contractDocumentId: e.target.value })}>
                                                                <option value="">Sélectionner...</option>
                                                                {documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Fin de Contrat</label>
                                                            <input type="date" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium" value={formData.contractEnd || ''} onChange={e => setFormData({ ...formData, contractEnd: e.target.value })} />
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div className="p-5 bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">Criticité</span>
                                                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border ${getCriticalityColor(selectedSupplier.criticality || Criticality.MEDIUM)}`}>{selectedSupplier.criticality}</span>
                                                        </div>
                                                        <div className="p-5 bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">Score Sécurité</span>
                                                            <span className={`font-bold text-xl ${selectedSupplier.securityScore! >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>{selectedSupplier.securityScore}/100</span>
                                                        </div>
                                                    </div>
                                                    <div className="p-6 bg-white dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Contact</h4>
                                                        <div className="flex items-center mb-3 text-sm font-medium text-slate-900 dark:text-white"><Handshake className="h-4 w-4 mr-3 text-slate-400" /> {selectedSupplier.contactName}</div>
                                                        <div className="flex items-center text-sm font-medium text-slate-900 dark:text-white"><Mail className="h-4 w-4 mr-3 text-slate-400" /> {selectedSupplier.contactEmail}</div>
                                                    </div>
                                                    <div className="p-6 bg-blue-50/80 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
                                                        <div className="flex justify-between items-center mb-4">
                                                            <div className="flex items-center text-blue-700 dark:text-blue-300 text-sm font-bold">
                                                                <FileText className="h-5 w-5 mr-3" />
                                                                Contrat & Documents
                                                            </div>
                                                            {selectedSupplier.contractEnd && (
                                                                <div className="flex items-center text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg shadow-sm">
                                                                    <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Fin: {new Date(selectedSupplier.contractEnd).toLocaleDateString()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {documents.find(d => d.id === selectedSupplier.contractDocumentId) ? (
                                                            <a href={documents.find(d => d.id === selectedSupplier.contractDocumentId)?.url} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-sm hover:text-brand-600 flex items-center justify-center transition-all w-full border border-blue-200 dark:border-blue-900/30">
                                                                <Link className="h-3 w-3 mr-2" /> Ouvrir le contrat
                                                            </a>
                                                        ) : <span className="text-xs text-blue-400 font-medium italic text-center block">Aucun document lié</span>}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {inspectorTab === 'assessment' && (
                                        <div className="space-y-6">
                                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <div className="flex items-center justify-between mb-6">
                                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center uppercase tracking-wide">
                                                        <ShieldAlert className="h-4 w-4 mr-2 text-brand-500" /> Questionnaire de Sécurité
                                                    </h3>
                                                    <div className={`text-2xl font-black ${formData.securityScore! >= 80 ? 'text-emerald-500' : formData.securityScore! >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                                        {formData.securityScore}/100
                                                    </div>
                                                </div>

                                                {canEdit ? (
                                                    <div className="space-y-3">
                                                        {[
                                                            { id: 'hasIso27001', label: 'Certification ISO 27001 / SOC 2 (+30 pts)' },
                                                            { id: 'hasGdprPolicy', label: 'Politique RGPD / DPA signé (+20 pts)' },
                                                            { id: 'hasEncryption', label: 'Chiffrement des données (At rest/Transit) (+20 pts)' },
                                                            { id: 'hasBcp', label: 'Plan de Continuité (PCA/PRA) (+15 pts)' },
                                                            { id: 'hasIncidentProcess', label: 'Processus de réponse aux incidents (+15 pts)' },
                                                        ].map(item => (
                                                            <label key={item.id} className={`flex items-center p-4 rounded-2xl border cursor-pointer transition-all ${(formData.assessment as any)?.[item.id] ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800 shadow-sm' : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                                                <input type="checkbox" className="h-5 w-5 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                                                    checked={(formData.assessment as any)?.[item.id]}
                                                                    onChange={() => toggleAssessment(item.id as any)}
                                                                />
                                                                <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 italic text-center py-4">Mode lecture seule. Contactez un administrateur pour modifier.</p>
                                                )}

                                                {isEditing && (
                                                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 flex justify-end">
                                                        <button onClick={handleUpdate} className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:scale-105 transition-transform shadow-lg">Enregistrer le score</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {inspectorTab === 'history' && (
                                        <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                            {supplierHistory.length === 0 ? <p className="text-sm text-gray-500 pl-6">Aucun historique récent.</p> :
                                                supplierHistory.map((log, i) => (
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
                                            <Comments collectionName="suppliers" documentId={selectedSupplier.id} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Create Modal */}
            {showModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-slate-900/50">
                            <h2 className="text-2xl font-bold dark:text-white tracking-tight">Nouveau Fournisseur</h2>
                            <p className="text-sm text-slate-500 mt-1">Enregistrement d'un tiers.</p>
                        </div>

                        <form onSubmit={handleCreate} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Nom de l'entreprise</label>
                                <input required className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Responsable</label>
                                <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                                    value={formData.ownerId || ''}
                                    onChange={e => {
                                        const selectedUser = usersList.find(u => u.uid === e.target.value);
                                        setFormData({ ...formData, ownerId: e.target.value, owner: selectedUser?.displayName || '' });
                                    }}>
                                    <option value="">Sélectionner...</option>
                                    {usersList.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Catégorie</label>
                                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                                        value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as any })}>
                                        {['SaaS', 'Hébergement', 'Matériel', 'Consulting', 'Autre'].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Criticité</label>
                                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium appearance-none"
                                        value={formData.criticality} onChange={e => setFormData({ ...formData, criticality: e.target.value as any })}>
                                        {Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Contact (Nom)</label>
                                    <input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                        value={formData.contactName} onChange={e => setFormData({ ...formData, contactName: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email Contact</label>
                                    <input type="email" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                        value={formData.contactEmail} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Fin de Contrat</label>
                                <input type="date" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-medium"
                                    value={formData.contractEnd || ''} onChange={e => setFormData({ ...formData, contractEnd: e.target.value })} />
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-white/5">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                                <button type="submit" className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:scale-105 transition-transform font-bold text-sm shadow-lg">Créer</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
