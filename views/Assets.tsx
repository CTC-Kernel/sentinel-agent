
import React, { useEffect, useState } from 'react';

import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Asset, Criticality, SystemLog, MaintenanceRecord, Risk, Incident, UserProfile, Project, Audit, Supplier, BusinessProcess } from '../types';
import { canEditResource } from '../utils/permissions';
import { AdvancedSearch, SearchFilters } from '../components/ui/AdvancedSearch';
import { Plus, Search, Server, Trash2, AlertTriangle, History, Tag, QrCode, MessageSquare, Wrench, Archive, CalendarClock, Save, ClipboardList, ShieldAlert, Siren, Flame, FileSpreadsheet, Database, Clock, Copy, Euro, FolderKanban, CheckSquare, Link, Network, ShieldCheck, Truck, HeartPulse } from '../components/ui/Icons';
import { RelationshipGraph } from '../components/RelationshipGraph';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { aiService } from '../services/aiService';
import { Sparkles } from 'lucide-react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Comments } from '../components/ui/Comments';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination, usePagination } from '../components/ui/Pagination';
import { LifecycleTimeline } from '../components/assets/LifecycleTimeline';
import { SubscriptionService } from '../services/subscriptionService';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Drawer } from '../components/ui/Drawer';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assetSchema, AssetFormData } from '../schemas/assetSchema';
import { CustomSelect } from '../components/ui/CustomSelect';

export const Assets: React.FC = () => {
    const { user, addToast } = useStore();
    const navigate = useNavigate();
    const location = useLocation();

    const calculateDepreciation = (price: number, purchaseDate: string) => {
        if (!price || !purchaseDate) return price;
        const start = new Date(purchaseDate);
        const now = new Date();
        const ageInYears = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        // Amortissement linéaire sur 5 ans
        const value = price * (1 - (ageInYears / 5));
        return Math.max(0, Math.round(value));
    };

    // Data Fetching with Hooks
    const { data: rawAssets, loading: assetsLoading, refresh: refreshAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: suppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    const { data: processes, loading: processesLoading } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId || 'ignore')],
        { logError: true }
    );

    // Derived State
    const assets = React.useMemo(() => {
        return rawAssets.map(a => ({
            ...a,
            currentValue: calculateDepreciation(a.purchasePrice || 0, a.purchaseDate || '')
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [rawAssets]);

    const loading = assetsLoading || usersLoading || suppliersLoading || processesLoading;

    const canEdit = canEditResource(user, 'Asset');

    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'details' | 'lifecycle' | 'security' | 'projects' | 'audits' | 'history' | 'comments' | 'graph'>('details');
    const [assetHistory, setAssetHistory] = useState<SystemLog[]>([]);
    const [linkedRisks, setLinkedRisks] = useState<Risk[]>([]);
    const [linkedIncidents, setLinkedIncidents] = useState<Incident[]>([]);
    const [linkedProjects, setLinkedProjects] = useState<Project[]>([]);
    const [linkedAudits, setLinkedAudits] = useState<Audit[]>([]);
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [activeFilters, setActiveFilters] = useState<SearchFilters>({ query: '', type: 'all' });
    const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
    const [newMaintenance, setNewMaintenance] = useState<Partial<MaintenanceRecord>>({ date: new Date().toISOString().split('T')[0], type: 'Préventive', description: '', technician: user?.displayName || '' });
    const [stats, setStats] = useState({ total: 0, critical: 0, maintenanceDue: 0, totalValue: 0 });
    const [showInspector, setShowInspector] = useState(false);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const { register, control, handleSubmit, reset, setValue, watch, formState: { errors, isDirty } } = useForm<AssetFormData>({
        resolver: zodResolver(assetSchema) as any,
        defaultValues: {
            name: '',
            type: 'Matériel',
            owner: '',
            confidentiality: Criticality.LOW,
            integrity: Criticality.LOW,
            availability: Criticality.LOW,
            location: '',
            lifecycleStatus: 'Neuf',
            supplierId: ''
        }
    });

    // AI Helper State
    const [suggestingField, setSuggestingField] = useState<string | null>(null);

    const calculateTCO = () => {
        const purchase = selectedAsset?.purchasePrice || 0;
        const maintenance = maintenanceRecords.reduce((acc, rec) => acc + (rec.cost || 0), 0);
        return purchase + maintenance;
    };

    const getDepreciationData = () => {
        if (!selectedAsset?.purchasePrice || !selectedAsset?.purchaseDate) return [];
        const data = [];
        const startYear = new Date(selectedAsset.purchaseDate).getFullYear();
        const price = selectedAsset.purchasePrice;
        for (let i = 0; i <= 5; i++) {
            const year = startYear + i;
            const value = Math.max(0, price * (1 - (i / 5)));
            data.push({ year, value });
        }
        return data;
    };

    useEffect(() => {
        const nextMonth = new Date();
        nextMonth.setDate(nextMonth.getDate() + 30);

        setStats({
            total: assets.length,
            critical: assets.filter(a => a.confidentiality === Criticality.CRITICAL || a.integrity === Criticality.CRITICAL || a.availability === Criticality.CRITICAL).length,
            maintenanceDue: assets.filter(a => a.nextMaintenance && new Date(a.nextMaintenance) < nextMonth).length,
            totalValue: assets.reduce((acc, a) => acc + (a.currentValue || 0), 0)
        });
    }, [assets]);

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || assets.length === 0) return;
        const asset = assets.find(a => a.id === state.voxelSelectedId);
        if (asset) {
            openInspector(asset);
        }
    }, [location.state, loading, assets]);

    const openInspector = async (asset?: Asset) => {
        if (!asset) {
            // Creation mode: check limits
            if (user?.organizationId) {
                const canAdd = await SubscriptionService.checkLimit(user.organizationId, 'assets', assets.length);
                if (!canAdd) {
                    if (confirm("Vous avez atteint la limite d'actifs de votre plan actuel. Voulez-vous passer au plan supérieur ?")) {
                        navigate('/pricing');
                    }
                    return;
                }
            }

            reset({
                name: 'Nouvel Actif',
                type: 'Matériel',
                owner: '',
                confidentiality: Criticality.LOW,
                integrity: Criticality.LOW,
                availability: Criticality.LOW,
                location: '',
                lifecycleStatus: 'Neuf',
                supplierId: ''
            });
            setSelectedAsset(null);
            setInspectorTab('details');
            setShowInspector(true);
        } else {
            setSelectedAsset(asset);
            reset(asset);
            setInspectorTab('details');
            setShowInspector(true);

            try {
                const q = query(collection(db, 'system_logs'), where('organizationId', '==', user?.organizationId), where('resource', '==', 'Asset'), limit(20));
                const snap = await getDocs(q);
                const logs = snap.docs.map(d => d.data() as SystemLog);
                const filtered = logs.filter(l => l.details?.includes(asset.name));
                filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setAssetHistory(filtered);
            } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Assets.openInspector', 'FETCH_FAILED'); }

            const maintQ = query(collection(db, 'assets', asset.id, 'maintenance'), orderBy('date', 'desc'));
            const unsubMaint = onSnapshot(maintQ, (snap) => { setMaintenanceRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceRecord))); });

            const risksQ = query(collection(db, 'risks'), where('organizationId', '==', user?.organizationId), where('assetId', '==', asset.id));
            getDocs(risksQ).then(snap => { setLinkedRisks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Risk))); });

            const incQ = query(collection(db, 'incidents'), where('organizationId', '==', user?.organizationId), where('affectedAssetId', '==', asset.id));
            getDocs(incQ).then(snap => { setLinkedIncidents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Incident))); });

            const projQ = query(collection(db, 'projects'), where('organizationId', '==', user?.organizationId), where('relatedAssetIds', 'array-contains', asset.id));
            getDocs(projQ).then(snap => { setLinkedProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project))); });

            const auditQ = query(collection(db, 'audits'), where('organizationId', '==', user?.organizationId), where('relatedAssetIds', 'array-contains', asset.id));
            getDocs(auditQ).then(snap => { setLinkedAudits(snap.docs.map(d => ({ id: d.id, ...d.data() } as Audit))); });

            return () => unsubMaint();
        }
    };

    const onFormSubmit: SubmitHandler<AssetFormData> = async (data) => {
        if (!canEdit || !user?.organizationId) return;

        try {
            const cleanData = sanitizeData(data);

            if (selectedAsset) {
                await updateDoc(doc(db, 'assets', selectedAsset.id), cleanData);
                await logAction(user, 'UPDATE', 'Asset', `MAJ Actif: ${cleanData.name}`);
                const updatedAsset = { ...selectedAsset, ...cleanData, currentValue: calculateDepreciation(cleanData.purchasePrice || 0, cleanData.purchaseDate || '') } as Asset;
                refreshAssets();
                setSelectedAsset(updatedAsset);
                addToast("Modifications enregistrées", "success");
            } else {
                const newDoc = { ...cleanData, organizationId: user.organizationId, createdAt: new Date().toISOString() };
                const docRef = await addDoc(collection(db, 'assets'), newDoc);
                const newAsset = { id: docRef.id, ...newDoc, currentValue: calculateDepreciation(newDoc.purchasePrice || 0, newDoc.purchaseDate || '') } as Asset;
                refreshAssets();
                setSelectedAsset(newAsset);
                await logAction(user, 'CREATE', 'Asset', `Création Actif: ${cleanData.name}`);
                addToast("Actif créé avec succès", "success");
            }
            reset(data); // Reset form state to clean
            refreshAssets(); // Refresh stats
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Assets.onFormSubmit', 'UPDATE_FAILED'); }
    };

    const handleDuplicate = async () => {
        if (!selectedAsset || !canEdit || !user?.organizationId) return;
        try {
            const newAssetData = { ...selectedAsset, name: `${selectedAsset.name} (Copie)`, createdAt: new Date().toISOString() };
            const docRef = await addDoc(collection(db, 'assets'), newAssetData);
            await logAction(user, 'CREATE', 'Asset', `Duplication Actif: ${newAssetData.name}`);
            addToast("Actif dupliqué", "success");
            refreshAssets();
            openInspector({ ...newAssetData, id: docRef.id } as Asset);
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Assets.handleDuplicate', 'CREATE_FAILED'); }
    };





    const handleSuggestField = async (field: keyof AssetFormData) => {
        setSuggestingField(field);
        try {
            const currentValues = watch();
            const suggestion = await aiService.suggestField(currentValues, field);
            if (suggestion.value) {
                setValue(field, suggestion.value, { shouldDirty: true });
                addToast(`Suggestion: ${suggestion.value}`, "info");
            }
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Assets.handleSuggestField', 'AI_ERROR');
        } finally {
            setSuggestingField(null);
        }
    };

    const getCriticalityColor = (level: Criticality) => {
        switch (level) {
            case Criticality.CRITICAL: return 'bg-red-100/80 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
            case Criticality.HIGH: return 'bg-orange-100/80 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
            case Criticality.MEDIUM: return 'bg-yellow-100/80 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
            default: return 'bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
        }
    };

    const filteredAssets = assets.filter(a => {
        const matchesQuery = (a.name.toLowerCase().includes(activeFilters.query.toLowerCase()) ||
            a.type.toLowerCase().includes(activeFilters.query.toLowerCase()) ||
            a.owner.toLowerCase().includes(activeFilters.query.toLowerCase()));

        const matchesType = activeFilters.type === 'all' || activeFilters.type === 'asset';
        const matchesStatus = !activeFilters.status || a.lifecycleStatus?.toLowerCase().includes(activeFilters.status?.toLowerCase() || '');
        const matchesOwner = !activeFilters.owner || a.owner.toLowerCase().includes(activeFilters.owner.toLowerCase());
        const matchesCriticality = !activeFilters.criticality || a.confidentiality === activeFilters.criticality || a.integrity === activeFilters.criticality || a.availability === activeFilters.criticality;

        return matchesQuery && matchesType && matchesStatus && matchesOwner && matchesCriticality;
    });
    const { currentPage, paginatedItems, setCurrentPage, setItemsPerPage, totalItems, itemsPerPage } = usePagination(filteredAssets, 20);

    const handleAddMaintenance = async () => {
        if (!selectedAsset || !newMaintenance.description) return;
        try {
            await addDoc(collection(db, 'assets', selectedAsset.id, 'maintenance'), newMaintenance);
            if (newMaintenance.type === 'Préventive') {
                const nextDate = new Date(newMaintenance.date!);
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                const nextStr = nextDate.toISOString().split('T')[0];
                await updateDoc(doc(db, 'assets', selectedAsset.id), { nextMaintenance: nextStr });
                setValue('nextMaintenance', nextStr, { shouldDirty: true });
                addToast("Maintenance ajoutée et prochaine échéance planifiée (+1 an)", "success");
            } else {
                addToast("Intervention enregistrée", "success");
            }
            setNewMaintenance({ date: new Date().toISOString().split('T')[0], type: 'Préventive', description: '', technician: user?.displayName || '' });
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Assets.handleAddMaintenance', 'CREATE_FAILED'); }
    };

    const initiateDelete = async (id: string, name: string) => {
        if (!canEdit) return;
        const risksQ = query(collection(db, 'risks'), where('organizationId', '==', user?.organizationId), where('assetId', '==', id));
        const incQ = query(collection(db, 'incidents'), where('organizationId', '==', user?.organizationId), where('affectedAssetId', '==', id));
        const projQ = query(collection(db, 'projects'), where('organizationId', '==', user?.organizationId), where('relatedAssetIds', 'array-contains', id));
        const auditQ = query(collection(db, 'audits'), where('organizationId', '==', user?.organizationId), where('relatedAssetIds', 'array-contains', id));
        const bcpQ = query(collection(db, 'business_processes'), where('organizationId', '==', user?.organizationId), where('supportingAssetIds', 'array-contains', id));

        const [rSnap, iSnap, pSnap, aSnap, bSnap] = await Promise.all([
            getDocs(risksQ),
            getDocs(incQ),
            getDocs(projQ),
            getDocs(auditQ),
            getDocs(bcpQ)
        ]);

        if (!rSnap.empty || !iSnap.empty || !pSnap.empty || !aSnap.empty || !bSnap.empty) {
            let msg = "Impossible de supprimer cet actif car il est lié à :";
            if (!rSnap.empty) msg += `\n- ${rSnap.size} risque(s)`;
            if (!iSnap.empty) msg += `\n- ${iSnap.size} incident(s)`;
            if (!pSnap.empty) msg += `\n- ${pSnap.size} projet(s)`;
            if (!aSnap.empty) msg += `\n- ${aSnap.size} audit(s)`;
            if (!bSnap.empty) msg += `\n- ${bSnap.size} processus métier`;

            return addToast(msg, "error");
        }
        setConfirmData({ isOpen: true, title: "Supprimer l'actif ?", message: `Voulez-vous vraiment supprimer "${name}" ?`, onConfirm: () => handleDeleteAsset(id, name) });
    };

    const handleDeleteAsset = async (id: string, name: string) => {
        try {
            await deleteDoc(doc(db, 'assets', id));
            await logAction(user, 'DELETE', 'Asset', `Suppression actif: ${name}`);
            refreshAssets();
            setSelectedAsset(null);
            addToast("Actif supprimé", "info");
        } catch (error) { ErrorLogger.handleErrorWithToast(error, 'Assets.handleDeleteAsset', 'DELETE_FAILED'); }
    };

    const handleExportCSV = () => {
        const headers = ["Nom", "Type", "Propriétaire", "Confidentialité", "Intégrité", "Disponibilité", "Localisation", "Statut", "Valeur Actuelle"];
        const rows = filteredAssets.map(a => [a.name, a.type, a.owner, a.confidentiality, a.integrity, a.availability, a.location, a.lifecycleStatus || 'Neuf', a.currentValue || 0]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })); link.download = `assets_export.csv`; link.click();
    };

    const generateLabel = async (asset: Asset) => {
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [50, 30] });
            const qrData = await QRCode.toDataURL(JSON.stringify({ id: asset.id, name: asset.name }), { margin: 1 });
            doc.addImage(qrData, 'PNG', 2, 2, 26, 26);
            doc.setFontSize(8); doc.setFont("times", "bold"); doc.text(asset.name.substring(0, 15), 30, 6);
            doc.setFontSize(6); doc.setFont("times", "normal"); doc.text(asset.id.substring(0, 8) + '...', 30, 10); doc.text(asset.owner.substring(0, 15), 30, 14);
            doc.setFillColor(0, 0, 0); doc.rect(30, 20, 18, 5, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(6); doc.setFont("times", "bold"); doc.text(asset.confidentiality.toUpperCase(), 39, 23.5, { align: 'center' });
            doc.save(`Label_${asset.name}.pdf`);
        } catch (error) { ErrorLogger.handleErrorWithToast(error, 'Assets.generateLabel', 'UNKNOWN_ERROR'); }
    };

    const generateIntakeLink = () => {
        if (!user?.organizationId) return;
        const url = `${window.location.origin}/#/intake?org=${user.organizationId}`;
        navigator.clipboard.writeText(url);
        addToast("Lien kiosque copié !", "success");
    };

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            {/* Confirm Modal */}
            <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} />



            <PageHeader
                title="Inventaire des Actifs"
                subtitle="Base de connaissance de l'infrastructure."
                breadcrumbs={[
                    { label: 'Actifs' }
                ]}
                icon={<Server className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={canEdit && (
                    <>
                        <button
                            onClick={generateIntakeLink}
                            className="flex items-center px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm text-slate-700 dark:text-white"
                            title="Copier le lien Kiosque"
                        >
                            <Link className="h-4 w-4 mr-2 text-brand-500" /> Lien Kiosque
                        </button>
                        <button
                            onClick={() => openInspector(undefined)}
                            className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Nouvel Actif
                        </button>
                    </>
                )}
            />

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-apple cursor-default"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Actifs</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p></div><div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600"><Database className="h-6 w-6" /></div></div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-apple cursor-default"><div><p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">Critiques (DIC)</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.critical}</p></div><div className="p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-600"><ShieldAlert className="h-6 w-6" /></div></div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-apple cursor-default"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">Valorisation Parc</p><p className="text-3xl font-black text-slate-900 dark:text-white">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(stats.totalValue)}</p></div><div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"><Euro className="h-6 w-6" /></div></div>
                <div className="glass-panel p-6 rounded-[2rem] border border-white/50 dark:border-white/5 shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-apple cursor-default"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-500 mb-1">Maintenance &lt; 30j</p><p className="text-3xl font-black text-slate-900 dark:text-white">{stats.maintenanceDue}</p></div><div className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600"><Wrench className="h-6 w-6" /></div></div>
            </div>

            {showAdvancedSearch && (
                <AdvancedSearch
                    onSearch={(filters) => { setActiveFilters(filters); setShowAdvancedSearch(false); }}
                    onClose={() => setShowAdvancedSearch(false)}
                />
            )}

            <div className="glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all border border-slate-200 dark:border-white/5">
                <Search className="h-5 w-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Rechercher un actif..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-700 dark:text-white py-2.5 font-medium placeholder-slate-400"
                    value={activeFilters.query}
                    onChange={e => setActiveFilters({ ...activeFilters, query: e.target.value })}
                />
                <button
                    onClick={() => setShowAdvancedSearch(true)}
                    className="px-4 py-2 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                >
                    Filtres Avancés
                </button>
                <button onClick={handleExportCSV} className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors"><FileSpreadsheet className="h-4 w-4" /></button>
            </div>

            {/* List */}
            <div className="glass-panel rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200 dark:border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-white/5">
                            <tr><th className="px-8 py-4">Actif</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Classification</th><th className="px-6 py-4">Statut</th><th className="px-6 py-4">Localisation</th><th className="px-6 py-4 text-right">Actions</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {loading ? (
                                <tr><td colSpan={6}><TableSkeleton rows={5} columns={6} /></td></tr>
                            ) : paginatedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <EmptyState
                                            icon={Server}
                                            title="Aucun actif trouvé"
                                            description={activeFilters.query ? "Aucun actif ne correspond à votre recherche." : "Commencez par ajouter votre premier actif pour suivre votre parc."}
                                            actionLabel={activeFilters.query ? undefined : "Nouvel Actif"}
                                            onAction={activeFilters.query ? undefined : () => openInspector(undefined)}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                paginatedItems.map((asset) => {
                                    const warrantyExpired = asset.warrantyEnd && new Date(asset.warrantyEnd) < new Date();
                                    const maintenanceOverdue = asset.nextMaintenance && new Date(asset.nextMaintenance) < new Date();
                                    return (
                                        <tr key={asset.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-200 group cursor-pointer hover:scale-[1.002]" onClick={() => openInspector(asset)}>
                                            <td className="px-8 py-5"><div className="flex items-center"><div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center mr-4 text-slate-500 dark:text-slate-300"><Server className="h-5 w-5" strokeWidth={1.5} /></div><div><div className="font-bold text-slate-900 dark:text-white text-[15px]">{asset.name}</div><div className="flex items-center gap-2 mt-0.5 flex-wrap"><span className="text-xs text-slate-500 font-medium">{asset.owner}</span>{warrantyExpired && <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900 px-1.5 py-0.5 rounded font-bold">Garantie Exp.</span>}{maintenanceOverdue && <span className="text-[9px] bg-orange-50 text-orange-600 border border-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-900 px-1.5 py-0.5 rounded font-bold flex items-center"><Clock className="h-2.5 w-2.5 mr-1" />Maint.</span>}{asset.scope && asset.scope.map(s => <span key={s} className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-900 px-1.5 py-0.5 rounded font-bold">{s}</span>)}</div></div></div></td>
                                            <td className="px-6 py-5 text-slate-600 dark:text-slate-400 font-medium">{asset.type}</td>
                                            <td className="px-6 py-5"><span className={`px-3 py-1 rounded-lg text-[11px] font-bold tracking-wide border shadow-sm ${getCriticalityColor(asset.confidentiality)}`}>{asset.confidentiality}</span></td>
                                            <td className="px-6 py-5"><span className={`flex items-center w-fit px-2.5 py-1 rounded-full text-[11px] font-bold border ${asset.lifecycleStatus === 'En service' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}><span className={`w-1.5 h-1.5 rounded-full mr-2 ${asset.lifecycleStatus === 'En service' ? 'bg-green-500' : 'bg-slate-400'}`}></span>{asset.lifecycleStatus || 'Neuf'}</span></td>
                                            <td className="px-6 py-5 text-slate-500 dark:text-slate-400 font-medium text-xs">{asset.location}</td>
                                            <td className="px-6 py-5 text-right flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()}><button onClick={() => generateLabel(asset)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100" title="Imprimer Étiquette"><QrCode className="h-4 w-4" /></button>{canEdit && (<button onClick={() => initiateDelete(asset.id, asset.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100" title="Supprimer"><Trash2 className="h-4 w-4" /></button>)}</td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {!loading && filteredAssets.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                />
            )}

            {/* Inspector Drawer */}
            {/* Inspector Drawer */}
            <Drawer
                isOpen={showInspector}
                onClose={() => { setShowInspector(false); setSelectedAsset(null); reset({}); }}
                title={selectedAsset ? selectedAsset.name : 'Nouvel Actif'}
                subtitle={
                    <div className="flex items-center gap-2">
                        {watch('type')}
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        {selectedAsset?.id || 'Brouillon'}
                    </div>
                }
                actions={
                    <>
                        {canEdit && selectedAsset && (
                            <button onClick={handleDuplicate} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Dupliquer" aria-label="Dupliquer l'actif">
                                <Copy className="h-5 w-5" />
                            </button>
                        )}
                        {canEdit && isDirty && (
                            <button onClick={handleSubmit(onFormSubmit as any)} className="flex items-center px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl shadow-lg hover:scale-105 transition-all" aria-label="Enregistrer les modifications">
                                <Save className="h-4 w-4 mr-2" /> Enregistrer
                            </button>
                        )}
                    </>
                }
            >
                <div className="px-8 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-transparent">
                    <ScrollableTabs
                        tabs={[
                            { id: 'details', label: 'Général', icon: Tag },
                            { id: 'lifecycle', label: 'Cycle de Vie', icon: CalendarClock },
                            { id: 'security', label: 'Sécurité & Risques', icon: ShieldAlert },
                            { id: 'projects', label: 'Projets', icon: FolderKanban },
                            { id: 'audits', label: 'Audits', icon: CheckSquare },
                            { id: 'history', label: 'Audit Trail', icon: History },
                            { id: 'comments', label: 'Discussion', icon: MessageSquare },
                            { id: 'graph', label: 'Graphe', icon: Network }
                        ].filter(tab => selectedAsset || ['details', 'lifecycle'].includes(tab.id))}
                        activeTab={inspectorTab}
                        onTabChange={(id) => setInspectorTab(id as typeof inspectorTab)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-black/20 custom-scrollbar">
                    {inspectorTab === 'details' && (
                        <div className="space-y-8">
                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Informations Principales</h3>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nom de l'actif</label>
                                        <div className="relative">
                                            <input type="text" disabled={!canEdit} className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium pr-10" {...register('name')} />
                                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                                            {canEdit && <button onClick={() => handleSuggestField('name')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500 transition-colors" title="Suggérer un nom"><Sparkles className={`h-4 w-4 ${suggestingField === 'name' ? 'animate-spin' : ''}`} /></button>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Type</label>
                                        <div className="relative">
                                            <select disabled={!canEdit} className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium" {...register('type')}>{['Matériel', 'Logiciel', 'Données', 'Service', 'Humain'].map(t => <option key={t} value={t}>{t}</option>)}</select>
                                            {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message}</p>}
                                            {canEdit && <button onClick={() => handleSuggestField('type')} className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500 transition-colors" title="Suggérer le type"><Sparkles className={`h-4 w-4 ${suggestingField === 'type' ? 'animate-spin' : ''}`} /></button>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Propriétaire</label>
                                        <div className="relative">
                                            <select disabled={!canEdit} className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none font-medium" {...register('owner')}>
                                                <option value="">Sélectionner...</option>
                                                {usersList.map(u => <option key={u.uid} value={u.displayName}>{u.displayName}</option>)}
                                            </select>
                                            {errors.owner && <p className="text-red-500 text-xs mt-1">{errors.owner.message}</p>}
                                        </div>
                                    </div>
                                    <div className="col-span-2"><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Localisation</label><input type="text" disabled={!canEdit} className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium" {...register('location')} /></div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Fournisseur / Mainteneur</label>
                                        <Controller
                                            name="supplierId"
                                            control={control}
                                            render={({ field }) => (
                                                <CustomSelect
                                                    options={suppliers.map(s => ({ value: s.id, label: s.name, subLabel: s.category }))}
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                    placeholder="Sélectionner un fournisseur..."
                                                    disabled={!canEdit}
                                                />
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600/80 mb-6 flex items-center justify-between">
                                    <div className="flex items-center"><AlertTriangle className="h-4 w-4 mr-2" /> Classification DIC</div>
                                    {canEdit && <button onClick={() => handleSuggestField('confidentiality')} className="text-xs normal-case font-medium text-brand-500 hover:text-brand-600 flex items-center bg-brand-50 dark:bg-brand-900/20 px-3 py-1.5 rounded-lg transition-colors"><Sparkles className="h-3 w-3 mr-1.5" /> Suggérer Classification</button>}
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {['confidentiality', 'integrity', 'availability'].map((field) => (
                                        <div key={field} className="p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5">
                                            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-3 tracking-wider">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                                            <select disabled={!canEdit} className="w-full bg-transparent border-none p-0 font-bold text-slate-900 dark:text-white focus:ring-0 cursor-pointer text-sm" {...register(field as keyof AssetFormData)}>
                                                {Object.values(Criticality).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center">
                                    <ShieldCheck className="h-4 w-4 mr-2" /> Périmètre de Conformité (Scope)
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {['NIS2', 'DORA', 'PCI_DSS', 'HDS', 'ISO27001', 'SOC2'].map((scope) => (
                                        <label key={scope} className={`cursor-pointer px-4 py-2 rounded-xl border transition-all ${(watch('scope') || []).includes(scope as any)
                                            ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 font-bold'
                                            : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'
                                            }`}>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                value={scope}
                                                disabled={!canEdit}
                                                checked={(watch('scope') || []).includes(scope as any)}
                                                onChange={(e) => {
                                                    const current = watch('scope') || [];
                                                    if (e.target.checked) {
                                                        setValue('scope', [...current, scope as any], { shouldDirty: true });
                                                    } else {
                                                        setValue('scope', current.filter((s: string) => s !== scope), { shouldDirty: true });
                                                    }
                                                }}
                                            />
                                            {scope.replace('_', ' ')}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Dependencies & Relationships */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center">
                                        <Truck className="h-4 w-4 mr-2" /> Fournisseur Associé
                                    </h3>
                                    {watch('supplierId') ? (
                                        (() => {
                                            const sup = suppliers.find(s => s.id === watch('supplierId'));
                                            return sup ? (
                                                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                                    <div className="font-bold text-slate-900 dark:text-white">{sup.name}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sup.category}</div>
                                                    <div className="mt-3 flex gap-2">
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${sup.status === 'Actif' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{sup.status}</span>
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${sup.criticality === 'Critique' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{sup.criticality}</span>
                                                    </div>
                                                </div>
                                            ) : <p className="text-sm text-gray-400 italic">Fournisseur introuvable.</p>;
                                        })()
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">Aucun fournisseur lié.</p>
                                    )}
                                </div>

                                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center">
                                        <HeartPulse className="h-4 w-4 mr-2" /> Processus Supportés
                                    </h3>
                                    {(() => {
                                        const supported = processes.filter(p => p.supportingAssetIds?.includes(selectedAsset?.id || ''));
                                        return supported.length > 0 ? (
                                            <div className="space-y-2">
                                                {supported.map(p => (
                                                    <div key={p.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center">
                                                        <span className="text-sm font-medium text-slate-700 dark:text-white">{p.name}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${p.priority === 'Critique' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{p.priority}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <p className="text-sm text-gray-400 italic">Cet actif ne supporte aucun processus critique.</p>;
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}
                    {inspectorTab === 'lifecycle' && (
                        <div className="space-y-8">
                            <div className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm overflow-x-auto">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-8">Timeline du cycle de vie</h3>
                                <div className="min-w-[600px] px-4">
                                    <LifecycleTimeline
                                        status={watch('lifecycleStatus') || 'Neuf'}
                                        purchaseDate={watch('purchaseDate')}
                                        warrantyEnd={watch('warrantyEnd')}
                                        nextMaintenance={watch('nextMaintenance')}
                                    />
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-blue-600/80 flex items-center"><Archive className="h-4 w-4 mr-2" /> État du cycle de vie</h3>
                                    <div className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-bold">{watch('lifecycleStatus') || 'Neuf'}</div>
                                </div>
                                <div className="space-y-4">
                                    <select disabled={!canEdit} className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none" {...register('lifecycleStatus')}>
                                        {['Neuf', 'En service', 'En réparation', 'Fin de vie', 'Rebut'].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <div className="grid grid-cols-2 gap-6 pt-2">
                                        <div><label className="block text-xs font-bold uppercase text-slate-400 mb-2">Date d'achat</label><input type="date" disabled={!canEdit} className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white text-sm font-medium" {...register('purchaseDate')} /></div>
                                        <div><label className="block text-xs font-bold uppercase text-slate-400 mb-2">Fin de garantie</label><input type="date" disabled={!canEdit} className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white text-sm font-medium" {...register('warrantyEnd')} /></div>
                                        <div><label className="block text-xs font-bold uppercase text-slate-400 mb-2">Prix d'achat (€)</label><input type="number" disabled={!canEdit} className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white text-sm font-medium" {...register('purchasePrice', { valueAsNumber: true })} /></div>
                                        <div><label className="block text-xs font-bold uppercase text-slate-400 mb-2">Coût Maintenance (€)</label><div className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/5 text-sm font-bold">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(maintenanceRecords.reduce((acc, m) => acc + (m.cost || 0), 0))}</div></div>
                                    </div>

                                    {/* Financial Charts */}
                                    {selectedAsset?.purchasePrice && (
                                        <div className="mt-6 pt-6 border-t border-dashed border-slate-200 dark:border-white/10">
                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                                    <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">Valeur Actuelle (Net)</p>
                                                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(calculateDepreciation(selectedAsset.purchasePrice, selectedAsset.purchaseDate || ''))}</p>
                                                </div>
                                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                                    <p className="text-[10px] font-bold uppercase text-blue-600 mb-1">TCO (Coût Total)</p>
                                                    <p className="text-xl font-black text-blue-700 dark:text-blue-400">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(calculateTCO())}</p>
                                                </div>
                                            </div>
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Courbe d'amortissement (5 ans)</h4>
                                            <div className="h-40 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={getDepreciationData()}>
                                                        <defs>
                                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                                                        <XAxis dataKey="year" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                                        <YAxis hide />
                                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} itemStyle={{ color: '#fff' }} formatter={(val: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val)} />
                                                        <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div><div className="flex items-center justify-between mb-4 px-1"><h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center"><ClipboardList className="h-4 w-4 mr-2 text-brand-500" /> Historique Maintenance</h3></div>{canEdit && (<div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-white/5 mb-6 shadow-sm"><div className="grid grid-cols-2 gap-4 mb-4"><input type="date" className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm dark:text-white outline-none focus:ring-2 focus:ring-brand-500" value={newMaintenance.date} onChange={e => setNewMaintenance({ ...newMaintenance, date: e.target.value })} /><select className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm dark:text-white outline-none focus:ring-2 focus:ring-brand-500" value={newMaintenance.type} onChange={e => setNewMaintenance({ ...newMaintenance, type: e.target.value as MaintenanceRecord['type'] })}>{['Préventive', 'Corrective', 'Mise à jour', 'Inspection'].map(t => <option key={t} value={t}>{t}</option>)}</select></div><div className="flex gap-4 mb-4"><input type="text" placeholder="Description..." className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm dark:text-white outline-none focus:ring-2 focus:ring-brand-500" value={newMaintenance.description} onChange={e => setNewMaintenance({ ...newMaintenance, description: e.target.value })} /><input type="number" placeholder="Coût (€)..." className="w-24 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm dark:text-white outline-none focus:ring-2 focus:ring-brand-500" value={newMaintenance.cost || ''} onChange={e => setNewMaintenance({ ...newMaintenance, cost: parseFloat(e.target.value) })} /></div><button onClick={handleAddMaintenance} className="w-full py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:scale-[1.02] transition-transform">Ajouter Intervention</button></div>)}<div className="space-y-3">{maintenanceRecords.length === 0 ? <p className="text-sm text-gray-400 text-center italic py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucune intervention enregistrée.</p> : maintenanceRecords.map(rec => (<div key={rec.id} className="flex items-start p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm hover:shadow-md transition-all"><div className={`mt-1.5 w-2.5 h-2.5 rounded-full mr-4 flex-shrink-0 ${rec.type === 'Corrective' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`}></div><div className="flex-1"><div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-slate-900 dark:text-white">{new Date(rec.date).toLocaleDateString()}</span><span className="text-[10px] uppercase tracking-wider bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md text-slate-600 dark:text-gray-300 font-bold">{rec.type}</span></div><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{rec.description}</p><div className="flex justify-between mt-2"><span className="text-[10px] text-gray-400 font-medium">Tech: {rec.technician}</span>{rec.cost && <span className="text-[10px] font-bold text-slate-500">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(rec.cost)}</span>}</div></div></div>))}</div></div>
                        </div>
                    )}
                    {inspectorTab === 'security' && (<div className="space-y-8"><div><h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center"><ShieldAlert className="h-4 w-4 mr-2" /> Risques Identifiés ({linkedRisks.length})</h3>{linkedRisks.length === 0 ? (<p className="text-sm text-gray-400 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun risque associé.</p>) : (<div className="grid gap-4">{linkedRisks.map(risk => (<div key={risk.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all"><div className="flex justify-between items-start mb-2"><span className="text-sm font-bold text-slate-900 dark:text-white">{risk.threat}</span><span className={`text-[10px] px-2 py-1 rounded-lg font-bold ${risk.score >= 15 ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'}`}>Score {risk.score}</span></div><p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{risk.vulnerability}</p>{risk.score >= 15 && <div className="flex items-center text-[10px] text-red-600 font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-xl w-fit"><Flame className="h-3 w-3 mr-1.5" /> Risque Critique</div>}</div>))}</div>)}</div><div><h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center"><Siren className="h-4 w-4 mr-2" /> Incidents ({linkedIncidents.length})</h3>{linkedIncidents.length === 0 ? (<p className="text-sm text-gray-400 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun incident signalé.</p>) : (<div className="grid gap-4">{linkedIncidents.map(inc => (<div key={inc.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all"><div className="flex justify-between items-start mb-2"><span className="text-sm font-bold text-slate-900 dark:text-white">{inc.title}</span><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${inc.status === 'Résolu' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inc.status}</span></div><p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{new Date(inc.dateReported).toLocaleDateString()}</p></div>))}</div>)}</div></div>)}
                    {inspectorTab === 'projects' && (
                        <div className="space-y-8">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center"><FolderKanban className="h-4 w-4 mr-2" /> Projets Liés ({linkedProjects.length})</h3>
                            {linkedProjects.length === 0 ? (
                                <p className="text-sm text-gray-400 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun projet associé.</p>
                            ) : (
                                <div className="grid gap-4">
                                    {linkedProjects.map(proj => (
                                        <div key={proj.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{proj.name}</span>
                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${proj.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{proj.status}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{proj.description}</p>
                                            <div className="flex items-center justify-between">
                                                <div className="w-full bg-slate-200 rounded-full h-1.5 mr-4 max-w-[100px]">
                                                    <div className="bg-brand-500 h-1.5 rounded-full" style={{ width: `${proj.progress}%` }}></div>
                                                </div>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{proj.progress}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {inspectorTab === 'audits' && (
                        <div className="space-y-8">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center"><CheckSquare className="h-4 w-4 mr-2" /> Audits Liés ({linkedAudits.length})</h3>
                            {linkedAudits.length === 0 ? (
                                <p className="text-sm text-gray-400 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun audit associé.</p>
                            ) : (
                                <div className="grid gap-4">
                                    {linkedAudits.map(audit => (
                                        <div key={audit.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{audit.name}</span>
                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${audit.status === 'Terminé' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{audit.status}</span>
                                            </div>
                                            <div className="flex items-center gap-4 mt-2">
                                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                    <CalendarClock className="h-3 w-3" />
                                                    {new Date(audit.dateScheduled).toLocaleDateString()}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    {audit.findingsCount} constats
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {inspectorTab === 'history' && (<div className="relative border-l-2 border-slate-200 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">{assetHistory.map((log, i) => (<div key={i} className="relative"><span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-900"><div className="h-2 w-2 rounded-full bg-brand-500"></div></span><div><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span><p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{log.details}</p><div className="mt-2 inline-flex items-center px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-[10px] font-medium text-gray-500">{log.userEmail}</div></div></div>))}</div>)}
                    {inspectorTab === 'graph' && selectedAsset && (
                        <div className="h-[500px]">
                            <RelationshipGraph rootId={selectedAsset.id} rootType="Asset" />
                        </div>
                    )}
                    {inspectorTab === 'comments' && selectedAsset && (<div className="h-full flex flex-col"><Comments collectionName="assets" documentId={selectedAsset.id} /></div>)}
                </div>
            </Drawer >
        </div >
    );
};
