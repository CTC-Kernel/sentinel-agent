
import React, { useEffect, useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { canEditResource } from '../utils/permissions';

import { collection, addDoc, query, deleteDoc, doc, updateDoc, where, limit, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Supplier, SupplierIncident, Document, SystemLog, Criticality, UserProfile, BusinessProcess, Asset, Risk, Project } from '../types';
import { Plus, Search, Building, Trash2, Edit, Handshake, Truck, Mail, ShieldAlert, FileText, ClipboardList, History, MessageSquare, Save, FileSpreadsheet, Link, CalendarDays, Upload, Server, LayoutGrid, List } from '../components/ui/Icons';
import { useStore } from '../store';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { logAction } from '../services/logger';
import { Comments } from '../components/ui/Comments';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton, TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorLogger } from '../services/errorLogger';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { useLocation } from 'react-router-dom';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supplierSchema, SupplierFormData } from '../schemas/supplierSchema';
import { Drawer } from '../components/ui/Drawer';
import { SupplierForm } from '../components/suppliers/SupplierForm';
import { usePersistedState } from '../hooks/usePersistedState';

export const Suppliers: React.FC = () => {
    const [filter, setFilter] = useState('');
    const { user, addToast } = useStore();
    const location = useLocation();
    const canEdit = canEditResource(user, 'Supplier');
    const [viewMode, setViewMode] = usePersistedState<'grid' | 'list'>('suppliers_view_mode', 'grid');

    const [creationMode, setCreationMode] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    // Removed duplicate/unused states



    // Inspector State
    const [inspectorTab, setInspectorTab] = useState<'profile' | 'assessment' | 'incidents' | 'history' | 'comments'>('profile');
    const [supplierHistory, setSupplierHistory] = useState<SystemLog[]>([]);

    const editForm = useForm<SupplierFormData>({
        resolver: zodResolver(supplierSchema),
        defaultValues: {
            name: '', category: 'SaaS', criticality: Criticality.MEDIUM, status: 'Actif',
            owner: '', ownerId: '',
            assessment: { hasIso27001: false, hasGdprPolicy: false, hasEncryption: false, hasBcp: false, hasIncidentProcess: false },
            relatedAssetIds: [], relatedRiskIds: [], relatedProjectIds: []
        }
    });

    useEffect(() => {
        if (selectedSupplier) {
            editForm.reset({
                name: selectedSupplier.name,
                category: selectedSupplier.category,
                criticality: selectedSupplier.criticality,
                status: selectedSupplier.status,
                contactName: selectedSupplier.contactName,
                contactEmail: selectedSupplier.contactEmail || '',
                owner: selectedSupplier.owner,
                ownerId: selectedSupplier.ownerId,
                description: selectedSupplier.description,
                contractDocumentId: selectedSupplier.contractDocumentId,
                contractEnd: selectedSupplier.contractEnd,
                securityScore: selectedSupplier.securityScore,

                assessment: selectedSupplier.assessment,
                isICTProvider: selectedSupplier.isICTProvider,
                supportsCriticalFunction: selectedSupplier.supportsCriticalFunction,
                doraCriticality: selectedSupplier.doraCriticality,
                serviceType: selectedSupplier.serviceType,
                relatedAssetIds: selectedSupplier.relatedAssetIds || [],
                relatedRiskIds: selectedSupplier.relatedRiskIds || [],
                relatedProjectIds: selectedSupplier.relatedProjectIds || []
            });
        }
    }, [selectedSupplier, editForm]);



    const { data: suppliersRaw, loading: loadingSuppliers } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    const { data: usersRaw } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    const selectedOwnerId = editForm.watch('ownerId');

    useEffect(() => {
        if (selectedOwnerId) {
            const selectedUser = usersRaw.find(u => u.uid === selectedOwnerId);
            editForm.setValue('owner', selectedUser?.displayName || '');
        }
    }, [selectedOwnerId, usersRaw, editForm]);

    const { data: documentsRaw } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    const { data: incidentsRaw } = useFirestoreCollection<SupplierIncident>(
        'supplierIncidents',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    const { data: processesRaw, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    const { data: assetsRaw } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    const { data: risksRaw } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    const { data: projectsRaw } = useFirestoreCollection<Project>(
        'projects',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    // Derived State
    const suppliers = React.useMemo(() => {
        const resolved = suppliersRaw.map(s => {
            if (!s.ownerId && s.owner) {
                const ownerUser = usersRaw.find(u => u.displayName === s.owner);
                if (ownerUser) return { ...s, ownerId: ownerUser.uid };
            }
            return s;
        });
        return resolved.sort((a, b) => a.name.localeCompare(b.name));
    }, [suppliersRaw, usersRaw]);

    const stats = React.useMemo(() => {
        const total = suppliers.length;
        const critical = suppliers.filter(s => s.criticality === Criticality.CRITICAL || s.criticality === Criticality.HIGH).length;
        const avgScore = total > 0 ? Math.round(suppliers.reduce((acc, s) => acc + (s.securityScore || 0), 0) / total) : 0;
        const today = new Date();
        const expired = suppliers.filter(s => s.contractEnd && new Date(s.contractEnd) < today).length;
        const highRisk = suppliers.filter(s => s.criticality === Criticality.HIGH || s.criticality === Criticality.CRITICAL).length;
        const activeIncidents = incidentsRaw.filter(i => i.status === 'Open' || i.status === 'Investigating').length;

        return { total, critical, avgScore, expired, highRisk, activeIncidents };
    }, [suppliers, incidentsRaw]);

    // Import
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;

        if (loadingSuppliers || loadingProcesses || suppliers.length === 0) return;
        const supplier = suppliers.find(s => s.id === state.voxelSelectedId);
        if (supplier) {
            setSelectedSupplier(supplier);
            setInspectorTab('profile');
        }
    }, [location.state, loadingSuppliers, loadingProcesses, suppliers]);

    // ... (Rest of the file logic unchanged)

    const openInspector = async (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setInspectorTab('profile');
        editForm.reset({
            name: supplier.name,
            category: supplier.category,
            criticality: supplier.criticality,
            contactName: supplier.contactName,
            contactEmail: supplier.contactEmail,
            status: supplier.status,
            owner: supplier.owner,
            ownerId: supplier.ownerId,
            description: supplier.description,
            contractDocumentId: supplier.contractDocumentId,
            contractEnd: supplier.contractEnd,
            securityScore: supplier.securityScore,
            assessment: supplier.assessment,
            isICTProvider: supplier.isICTProvider,
            supportsCriticalFunction: supplier.supportsCriticalFunction,
            doraCriticality: supplier.doraCriticality,
            serviceType: supplier.serviceType,
            supportedProcessIds: supplier.supportedProcessIds || []
        });
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

    const openCreationDrawer = () => {
        setCreationMode(true);
        setSelectedSupplier(null);
    };

    const handleCreate: SubmitHandler<SupplierFormData> = async (data) => {
        if (!canEdit || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'suppliers'), {
                ...data,
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            await logAction(user, 'CREATE', 'Supplier', `Ajout Fournisseur: ${data.name}`);
            addToast("Fournisseur ajouté", "success");
            setCreationMode(false);
        } catch { addToast("Erreur enregistrement", "error"); }
    };

    const handleUpdate: SubmitHandler<SupplierFormData> = async (data) => {
        if (!canEdit || !selectedSupplier) return;
        try {
            await updateDoc(doc(db, 'suppliers', selectedSupplier.id), {
                ...data,
                updatedAt: new Date().toISOString()
            });
            await logAction(user, 'UPDATE', 'Supplier', `MAJ Fournisseur: ${data.name}`);
            setSelectedSupplier({ ...selectedSupplier, ...data, criticality: data.criticality as Criticality });
            setIsEditing(false);
            setIsEditing(false);
            addToast("Fournisseur mis à jour", "success");
        } catch { addToast("Erreur mise à jour", "error"); }
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
        if (!canEdit) return;
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

            addToast('Fournisseur et données associées supprimés', 'success');
            if (selectedSupplier?.id === id) setSelectedSupplier(null);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Suppliers.handleDelete');
            addToast('Erreur lors de la suppression', 'error');
        }
    };

    const toggleAssessment = (field: keyof NonNullable<Supplier['assessment']>) => {
        const currentAssessment = editForm.getValues('assessment') || {};
        const updated = { ...currentAssessment, [field]: !currentAssessment[field] };

        // Recalculate score
        let score = 0;
        if (updated.hasIso27001) score += 30;
        if (updated.hasGdprPolicy) score += 20;
        if (updated.hasEncryption) score += 20;
        if (updated.hasBcp) score += 15;
        if (updated.hasIncidentProcess) score += 15;

        editForm.setValue('assessment', updated);
        editForm.setValue('securityScore', score);
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

    const handleExportDORARegister = () => {
        const headers = ["Nom Fournisseur", "Type Service", "Prestataire TIC", "Fonction Critique", "Criticité DORA", "Localisation Données", "Date Contrat"];
        const rows = filteredSuppliers.filter(s => s.isICTProvider).map(s => [
            s.name,
            s.serviceType || 'N/A',
            s.isICTProvider ? 'OUI' : 'NON',
            s.supportsCriticalFunction ? 'OUI' : 'NON',
            s.doraCriticality || 'None',
            'UE (Simulé)', // Placeholder as we don't have location field yet
            s.contractEnd ? new Date(s.contractEnd).toLocaleDateString() : ''
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `dora_register_of_information_${new Date().toISOString().split('T')[0]}.csv`;
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

            if (lines.length === 0) { addToast("Fichier vide", "error"); return; }

            addToast("Import en cours...", "info");
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
                            category: (cols[1]?.trim() || 'Autre') as Supplier['category'],
                            criticality: (cols[2]?.trim() || 'Moyenne') as Criticality,
                            contactName: cols[3]?.trim() || '',
                            contactEmail: cols[4]?.trim() || '',
                            status: 'Actif',
                            securityScore: 0,
                            assessment: {
                                hasIso27001: false, hasGdprPolicy: false, hasEncryption: false,
                                hasBcp: false, hasIncidentProcess: false, lastAssessmentDate: new Date().toISOString()
                            },
                            isICTProvider: false,
                            supportsCriticalFunction: false,
                            doraCriticality: 'None',
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
            } catch { addToast("Erreur import CSV", "error"); } finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
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

    const getBreadcrumbs = () => {
        const crumbs: { label: string; onClick?: () => void }[] = [{ label: 'Fournisseurs', onClick: () => { setSelectedSupplier(null); setCreationMode(false); setIsEditing(false); } }];

        if (creationMode) {
            crumbs.push({ label: 'Création' });
            return crumbs;
        }

        if (selectedSupplier) {
            if (selectedSupplier.category) {
                crumbs.push({ label: selectedSupplier.category });
            }
            crumbs.push({ label: selectedSupplier.name });
        }

        return crumbs;
    };

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative">
            <Helmet>
                <title>Gestion des Fournisseurs - Sentinel GRC</title>
                <meta name="description" content="Gérez vos fournisseurs, évaluez leur conformité DORA et suivez les contrats." />
            </Helmet>
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
                            onClick={() => openCreationDrawer()}
                            className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Nouveau Fournisseur
                        </button>
                    </>
                )}
            />

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-[#1A1D24] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl"><Building className="h-5 w-5 text-blue-500" /></div>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-green-500/10 text-green-500">+12%</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{stats.total}</div>
                    <div className="text-sm text-slate-500">Fournisseurs Actifs</div>
                </div>
                <div className="bg-white dark:bg-[#1A1D24] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-orange-500/10 rounded-xl"><ShieldAlert className="h-5 w-5 text-orange-500" /></div>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-500">High Risk</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{stats.critical}</div>
                    <div className="text-sm text-slate-500">Critiques / Élevés</div>
                </div>
                <div className="bg-white dark:bg-[#1A1D24] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-purple-500/10 rounded-xl"><Handshake className="h-5 w-5 text-purple-500" /></div>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500">Avg</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{stats.avgScore}/100</div>
                    <div className="text-sm text-slate-500">Score Moyen</div>
                </div>
                <div className="bg-white dark:bg-[#1A1D24] p-6 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-red-500/10 rounded-xl"><FileText className="h-5 w-5 text-red-500" /></div>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-500/10 text-red-500">Action Req</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{stats.expired}</div>
                    <div className="text-sm text-slate-500">Contrats Expirés</div>
                </div>
            </div>

            <div className="glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all border border-slate-200 dark:border-white/5">
                <Search className="h-5 w-5 text-gray-400" />
                <input type="text" placeholder="Rechercher un fournisseur..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400"
                    value={filter} onChange={e => setFilter(e.target.value)} />
                <button onClick={handleExportCSV} className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors" title="Exporter CSV">
                    <FileSpreadsheet className="h-4 w-4" />
                </button>
                <button onClick={handleExportDORARegister} className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors ml-2" title="Exporter Registre DORA">
                    <ShieldAlert className="h-4 w-4" />
                </button>
                <div className="flex bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm ml-2">
                    <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Vue Grille"><LayoutGrid className="h-4 w-4" /></button>
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Vue Liste"><List className="h-4 w-4" /></button>
                </div>
            </div>

            {viewMode === 'list' ? (
                <div className="glass-panel rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200 dark:border-white/5">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-white/5">
                                <tr>
                                    <th className="px-8 py-4">Fournisseur</th>
                                    <th className="px-6 py-4">Catégorie</th>
                                    <th className="px-6 py-4">Criticité</th>
                                    <th className="px-6 py-4">Score Sécurité</th>
                                    <th className="px-6 py-4">Contact</th>
                                    <th className="px-6 py-4">Fin Contrat</th>
                                    <th className="px-6 py-4">Statut</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {loadingSuppliers ? (
                                    <tr><td colSpan={8}><TableSkeleton rows={5} columns={8} /></td></tr>
                                ) : filteredSuppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={8}>
                                            <EmptyState
                                                icon={Building}
                                                title="Aucun fournisseur"
                                                description={filter ? "Aucun fournisseur ne correspond à votre recherche." : "Gérez vos fournisseurs et évaluez leur sécurité."}
                                                actionLabel={filter ? undefined : "Nouveau Fournisseur"}
                                                onAction={filter ? undefined : openCreationDrawer}
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSuppliers.map((supplier) => {
                                        const isExpired = supplier.contractEnd && new Date(supplier.contractEnd) < new Date();
                                        return (
                                            <tr key={supplier.id} onClick={() => openInspector(supplier)} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-200 group cursor-pointer hover:scale-[1.002]">
                                                <td className="px-8 py-5">
                                                    <div className="font-bold text-slate-900 dark:text-white text-[15px]">{supplier.name}</div>
                                                    {supplier.isICTProvider && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 mt-1">
                                                            DORA ICT
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">
                                                        {supplier.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase border ${getCriticalityColor(supplier.criticality || Criticality.MEDIUM)}`}>
                                                        {supplier.criticality}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
                                                            <div className={`h-1.5 rounded-full transition-all duration-500 ${getScoreColor(supplier.securityScore || 0)}`} style={{ width: `${supplier.securityScore || 0}%` }}></div>
                                                        </div>
                                                        <span className={`text-xs font-bold ${getScoreColor(supplier.securityScore || 0).replace('bg-', 'text-')}`}>
                                                            {supplier.securityScore || 0}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-slate-600 dark:text-slate-400 font-medium">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{supplier.contactName || '-'}</span>
                                                        <span className="text-[10px] text-slate-400">{supplier.contactEmail}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    {supplier.contractEnd ? (
                                                        <span className={`text-sm font-medium ${isExpired ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                                                            {new Date(supplier.contractEnd).toLocaleDateString()}
                                                        </span>
                                                    ) : <span className="text-slate-400">-</span>}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border ${supplier.status === 'Actif' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                        {supplier.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()}>
                                                    {canEdit && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                initiateDelete(supplier.id, supplier.name);
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100"
                                                            title="Supprimer"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {loadingSuppliers ? (
                        <div className="col-span-full"><CardSkeleton count={3} /></div>
                    ) : filteredSuppliers.length === 0 ? (
                        <div className="col-span-full">
                            <EmptyState
                                icon={Building}
                                title="Aucun fournisseur"
                                description={filter ? "Aucun fournisseur ne correspond à votre recherche." : "Gérez vos fournisseurs et évaluez leur sécurité."}
                                actionLabel={filter ? undefined : "Nouveau Fournisseur"}
                                onAction={filter ? undefined : openCreationDrawer}
                            />
                        </div>
                    ) : (
                        filteredSuppliers.map(supplier => {
                            const linkedDoc = documentsRaw.find(d => d.id === supplier.contractDocumentId);
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
                                        {supplier.isICTProvider && (
                                            <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800">DORA ICT</span>
                                        )}
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
            )}

            {/* Inspector Drawer */}
            <Drawer
                isOpen={!!selectedSupplier}
                onClose={() => setSelectedSupplier(null)}
                title={selectedSupplier?.name || ''}
                subtitle={selectedSupplier ? `${selectedSupplier.category} • ${selectedSupplier.status}` : ''}
                width="max-w-6xl"
                breadcrumbs={getBreadcrumbs()}
                actions={
                    <div className="flex gap-2">
                        {canEdit && !isEditing && (
                            <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                        )}
                        {canEdit && isEditing && (
                            <button onClick={editForm.handleSubmit(handleUpdate)} className="p-2.5 text-brand-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Save className="h-5 w-5" /></button>
                        )}
                        {canEdit && (
                            <button onClick={() => initiateDelete(selectedSupplier!.id, selectedSupplier!.name)} className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                        )}
                    </div>
                }
            >
                {selectedSupplier && (
                    <>
                        <div className="px-8 border-b border-gray-100 dark:border-white/5 bg-white/30 dark:bg-white/5">
                            <ScrollableTabs
                                tabs={[
                                    { id: 'profile', label: 'Profil', icon: Building },
                                    { id: 'assessment', label: 'Évaluation Sécurité', icon: ClipboardList },
                                    { id: 'history', label: 'Historique', icon: History },
                                    { id: 'comments', label: 'Discussion', icon: MessageSquare },
                                ]}
                                activeTab={inspectorTab}
                                onTabChange={(id) => setInspectorTab(id as typeof inspectorTab)}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
                            {inspectorTab === 'profile' && (
                                <div className="space-y-8">
                                    {isEditing ? (
                                        <SupplierForm
                                            onSubmit={handleUpdate}
                                            onCancel={() => setIsEditing(false)}
                                            initialData={editForm.getValues()}
                                            isEditing={true}
                                            users={usersRaw}
                                            processes={processesRaw}
                                            assets={assetsRaw}
                                            risks={risksRaw}
                                            documents={documentsRaw}
                                        />
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
                                                {documentsRaw.find(d => d.id === selectedSupplier.contractDocumentId) ? (
                                                    <a href={documentsRaw.find(d => d.id === selectedSupplier.contractDocumentId)?.url} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-sm hover:text-brand-600 flex items-center justify-center transition-all w-full border border-blue-200 dark:border-blue-900/30">
                                                        <Link className="h-3 w-3 mr-2" /> Ouvrir le contrat
                                                    </a>
                                                ) : <span className="text-xs text-blue-400 font-medium italic text-center block">Aucun document lié</span>}
                                            </div>

                                            {selectedSupplier.isICTProvider && (
                                                <div className="p-6 bg-indigo-50/80 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4 flex items-center">
                                                        <ShieldAlert className="h-4 w-4 mr-2" /> DORA Status
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="block text-xs text-slate-500 mb-1">Type Service</span>
                                                            <span className="font-bold text-slate-900 dark:text-white">{selectedSupplier.serviceType || 'N/A'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-xs text-slate-500 mb-1">Fonction Critique</span>
                                                            <span className={`font-bold ${selectedSupplier.supportsCriticalFunction ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                                                                {selectedSupplier.supportsCriticalFunction ? 'OUI' : 'NON'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-xs text-slate-500 mb-1">Criticité DORA</span>
                                                            <span className="font-bold text-slate-900 dark:text-white">{selectedSupplier.doraCriticality || 'None'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedSupplier.supportedProcessIds && selectedSupplier.supportedProcessIds.length > 0 && (
                                                <div className="p-6 bg-purple-50/80 dark:bg-purple-900/10 rounded-3xl border border-purple-100 dark:border-purple-900/30 shadow-sm mt-6">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-4 flex items-center">
                                                        <FileText className="h-4 w-4 mr-2" /> Processus Supportés
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {selectedSupplier.supportedProcessIds.map(pid => {
                                                            const process = processesRaw.find(p => p.id === pid);
                                                            return process ? (
                                                                <div key={pid} className="flex items-center justify-between text-sm p-2 bg-white dark:bg-slate-800 rounded-lg border border-purple-100 dark:border-purple-900/20">
                                                                    <span className="font-medium text-slate-700 dark:text-slate-300">{process.name}</span>
                                                                    <span className="text-xs text-slate-500">RTO: {process.rto}</span>
                                                                </div>
                                                            ) : null;
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Linked Assets */}
                                            <div className="p-6 bg-slate-50/80 dark:bg-slate-800/30 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm mt-6">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center">
                                                    <Server className="h-4 w-4 mr-2" /> Actifs Fournis ({assetsRaw.filter(a => a.supplierId === selectedSupplier.id || selectedSupplier.relatedAssetIds?.includes(a.id)).length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {assetsRaw.filter(a => a.supplierId === selectedSupplier.id || selectedSupplier.relatedAssetIds?.includes(a.id)).map(asset => (
                                                        <div key={asset.id} className="flex items-center justify-between text-sm p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5">
                                                            <span className="font-medium text-slate-700 dark:text-slate-300">{asset.name}</span>
                                                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500">{asset.type}</span>
                                                        </div>
                                                    ))}
                                                    {assetsRaw.filter(a => a.supplierId === selectedSupplier.id || selectedSupplier.relatedAssetIds?.includes(a.id)).length === 0 && (
                                                        <p className="text-sm text-gray-400 italic">Aucun actif associé.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Linked Risks */}
                                            <div className="p-6 bg-red-50/50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30 shadow-sm mt-6">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400 mb-4 flex items-center">
                                                    <ShieldAlert className="h-4 w-4 mr-2" /> Risques Associés ({risksRaw.filter(r => r.relatedSupplierIds?.includes(selectedSupplier.id) || selectedSupplier.relatedRiskIds?.includes(r.id)).length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {risksRaw.filter(r => r.relatedSupplierIds?.includes(selectedSupplier.id) || selectedSupplier.relatedRiskIds?.includes(r.id)).map(risk => (
                                                        <div key={risk.id} className="flex items-center justify-between text-sm p-3 bg-white dark:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900/20">
                                                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{risk.threat}</span>
                                                            <span className={`text-xs px-2 py-1 rounded-lg font-bold ${risk.score >= 15 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>Score: {risk.score}</span>
                                                        </div>
                                                    ))}
                                                    {risksRaw.filter(r => r.relatedSupplierIds?.includes(selectedSupplier.id) || selectedSupplier.relatedRiskIds?.includes(r.id)).length === 0 && (
                                                        <p className="text-sm text-gray-400 italic">Aucun risque associé.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Linked Projects */}
                                            <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm mt-6">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-4 flex items-center">
                                                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Projets Associés ({projectsRaw.filter(p => selectedSupplier.relatedProjectIds?.includes(p.id)).length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {projectsRaw.filter(p => selectedSupplier.relatedProjectIds?.includes(p.id)).map(project => (
                                                        <div key={project.id} className="flex items-center justify-between text-sm p-3 bg-white dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-blue-900/20">
                                                            <span className="font-medium text-slate-700 dark:text-slate-300">{project.name}</span>
                                                            <span className={`text-xs px-2 py-1 rounded-lg font-bold ${project.status === 'Terminé' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{project.status}</span>
                                                        </div>
                                                    ))}
                                                    {projectsRaw.filter(p => selectedSupplier.relatedProjectIds?.includes(p.id)).length === 0 && (
                                                        <p className="text-sm text-gray-400 italic">Aucun projet associé.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div >
                            )}

                            {
                                inspectorTab === 'assessment' && (
                                    <div className="space-y-6">
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <div className="flex items-center justify-between mb-6">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center uppercase tracking-wide">
                                                    <ShieldAlert className="h-4 w-4 mr-2 text-brand-500" /> Questionnaire de Sécurité
                                                </h3>
                                                <div className={`text-2xl font-black ${editForm.watch('securityScore')! >= 80 ? 'text-emerald-500' : editForm.watch('securityScore')! >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                                    {editForm.watch('securityScore')}/100
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
                                                        <label key={item.id} className={`flex items-center p-4 rounded-2xl border cursor-pointer transition-all ${editForm.watch(`assessment.${item.id as keyof NonNullable<Supplier['assessment']>}`) ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800 shadow-sm' : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                                            <input type="checkbox" className="h-5 w-5 rounded text-brand-600 focus:ring-brand-500 border-gray-300"
                                                                checked={!!editForm.watch(`assessment.${item.id as keyof NonNullable<Supplier['assessment']>}`)}
                                                                onChange={() => toggleAssessment(item.id as keyof NonNullable<Supplier['assessment']>)}
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
                                                    <button onClick={editForm.handleSubmit(handleUpdate)} className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:scale-105 transition-transform shadow-lg">Enregistrer le score</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            }

                            {
                                inspectorTab === 'history' && (
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
                                )
                            }

                            {
                                inspectorTab === 'comments' && (
                                    <div className="h-full flex flex-col">
                                        <Comments collectionName="suppliers" documentId={selectedSupplier.id} />
                                    </div>
                                )
                            }
                        </div>
                    </>
                )}
            </Drawer>

            {/* Create Drawer */}
            <Drawer
                isOpen={creationMode}
                onClose={() => setCreationMode(false)}
                title="Nouveau Fournisseur"
                subtitle="Enregistrement d'un tiers"
                width="max-w-4xl"
            >
                <div className="h-full overflow-y-auto p-6">
                    <SupplierForm
                        onSubmit={handleCreate}
                        onCancel={() => setCreationMode(false)}
                        users={usersRaw}
                        processes={processesRaw}
                        assets={assetsRaw}
                        risks={risksRaw}
                        documents={documentsRaw}
                    />
                </div>
            </Drawer>
        </div>
    );
};
