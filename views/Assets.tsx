
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Helmet } from 'react-helmet-async';

import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, where, limit, onSnapshot, writeBatch } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { Asset, Criticality, SystemLog, MaintenanceRecord, Risk, Incident, UserProfile, Project, BusinessProcess, Supplier, Audit, Vulnerability, AssetHistory } from '../types';
import { canEditResource, canDeleteResource } from '../utils/permissions';
import { AdvancedSearch, SearchFilters } from '../components/ui/AdvancedSearch';
import { Plus, Search, Server, Trash2, AlertTriangle, History, Tag, QrCode, MessageSquare, Archive, CalendarClock, ClipboardList, ShieldAlert, Siren, Flame, FileSpreadsheet, Clock, Copy, FolderKanban, CheckSquare, Link, Network, ShieldCheck, HeartPulse, LayoutGrid, List, BrainCircuit } from '../components/ui/Icons';
import { RelationshipGraph } from '../components/RelationshipGraph';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { SlideUp } from '../components/ui/Animations';

import { PdfService } from '../services/PdfService';

import { Comments } from '../components/ui/Comments';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TableSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import { LifecycleTimeline } from '../components/assets/LifecycleTimeline';
import { SubscriptionService } from '../services/subscriptionService';
import { useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Drawer } from '../components/ui/Drawer';
import { ErrorLogger } from '../services/errorLogger';
import { sanitizeData } from '../utils/dataSanitizer';
import { ScrollableTabs } from '../components/ui/ScrollableTabs';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { AssetForm } from '../components/assets/AssetForm';
import { AssetDashboard } from '../components/assets/AssetDashboard';
import { AssetAIAssistant } from '../components/assets/AssetAIAssistant';
import { AssetFormData, assetSchema } from '../schemas/assetSchema';
import { z } from 'zod';

import { Edit } from '../components/ui/Icons';
import { integrationService } from '../services/integrationService';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { DataTable } from '../components/ui/DataTable';

interface ShodanResult {
    ip_str?: string;
    os?: string;
    ports?: number[];
    org?: string;
    [key: string]: unknown;
}

export const Assets: React.FC = () => {
    const { user, addToast, demoMode } = useStore();
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
    // Data Fetching with Hooks
    const { data: rawAssets, loading: assetsLoading, refresh: refreshAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );

    const { data: usersList, loading: usersLoading } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );

    const { data: suppliers, loading: suppliersLoading } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
    );

    const { data: processes, loading: processesLoading } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, enabled: !!user?.organizationId, realtime: true }
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

    const role = user?.role || 'user';

    let assetsTitle = 'Inventaire des Actifs';
    let assetsSubtitle = "Base de connaissance de l'infrastructure.";

    if (role === 'admin' || role === 'rssi') {
        assetsTitle = 'Cartographie des Actifs & Criticité';
        assetsSubtitle = "Gérez l'inventaire des actifs, leurs propriétaires, criticités et dépendances métiers.";
    } else if (role === 'direction') {
        assetsTitle = 'Vue Stratégique des Actifs';
        assetsSubtitle = "Comprenez vos actifs critiques, leur valeur et les unités métier associées.";
    } else if (role === 'auditor') {
        assetsTitle = 'Actifs à Auditer';
        assetsSubtitle = "Accédez aux actifs et à leur contexte pour préparer vos missions d'audit.";
    } else if (role === 'project_manager') {
        assetsTitle = 'Actifs Impactés par les Projets';
        assetsSubtitle = "Suivez les actifs concernés par vos projets et leurs dépendances.";
    } else {
        assetsTitle = 'Mes Actifs';
        assetsSubtitle = "Consultez les actifs que vous utilisez ou dont vous êtes responsable.";
    }

    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [creationMode, setCreationMode] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [inspectorTab, setInspectorTab] = useState<'details' | 'lifecycle' | 'security' | 'projects' | 'audits' | 'history' | 'comments' | 'graph' | 'intelligence'>('details');
    const [assetHistory, setAssetHistory] = useState<SystemLog[]>([]);
    const [linkedRisks, setLinkedRisks] = useState<Risk[]>([]);
    const [linkedIncidents, setLinkedIncidents] = useState<Incident[]>([]);
    const [linkedProjects, setLinkedProjects] = useState<Project[]>([]);
    const [linkedAudits, setLinkedAudits] = useState<Audit[]>([]);

    // Security Scan State
    const [shodanResult, setShodanResult] = useState<ShodanResult | null>(null);
    const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
    const [scanning, setScanning] = useState(false);
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [activeFilters, setActiveFilters] = useState<SearchFilters>({ query: '', type: 'all' });
    const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
    const [newMaintenance, setNewMaintenance] = useState<Partial<MaintenanceRecord>>({ date: new Date().toISOString().split('T')[0], type: 'Préventive', description: '', technician: user?.displayName || '' });



    const [showInspector, setShowInspector] = useState(false);
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; loading?: boolean; closeOnConfirm?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingLabels, setIsGeneratingLabels] = useState(false);
    const [isAddingMaintenance, setIsAddingMaintenance] = useState(false);



    // AI Helper State


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

            setSelectedAsset(null);
            setCreationMode(true);
            setIsEditing(false);
            setInspectorTab('details');
            setShowInspector(true);
        } else {
            setSelectedAsset(asset);
            setCreationMode(false);
            setIsEditing(false);
            setInspectorTab('details');
            setShowInspector(true);

            try {
                const logsQ = query(collection(db, 'system_logs'), where('organizationId', '==', user?.organizationId), orderBy('timestamp', 'desc'), limit(50));
                const snap = await getDocs(logsQ);
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

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || assets.length === 0) return;
        const asset = assets.find(a => a.id === state.voxelSelectedId);
        if (asset) {

            openInspector(asset);
        }
    }, [location.state, loading, assets]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCreate = async (data: AssetFormData) => {
        if (!user?.organizationId || !canEdit) return;
        setIsSubmitting(true);
        try {
            const validatedData = assetSchema.parse(data);
            const cleanData = sanitizeData(validatedData);
            const newDoc = { ...cleanData, organizationId: user.organizationId, createdAt: new Date().toISOString() };
            await addDoc(collection(db, 'assets'), newDoc);


            await logAction(user, 'CREATE', 'Asset', `Création Actif: ${cleanData.name}`);
            addToast("Actif créé avec succès", "success");

            refreshAssets();
            setCreationMode(false);
            setShowInspector(false);
        } catch (e) {
            if (e instanceof z.ZodError) {
                addToast((e as unknown as { errors: { message: string }[] }).errors[0].message, "error");
            } else {
                ErrorLogger.handleErrorWithToast(e, 'Assets.handleCreate', 'CREATE_FAILED');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async (data: AssetFormData) => {
        if (!selectedAsset || !user?.organizationId || !canEdit) return;
        setIsSubmitting(true);
        try {
            const validatedData = assetSchema.parse(data);
            const cleanData = sanitizeData(validatedData);
            // Track History if Criticality Changes
            const prev = selectedAsset;
            const dataToUpdate: Partial<Asset> = {
                ...cleanData,
                aiAnalysis: cleanData.aiAnalysis || undefined
            };

            if (prev.confidentiality !== cleanData.confidentiality || prev.integrity !== cleanData.integrity || prev.availability !== cleanData.availability) {
                const historyEntry: AssetHistory = {
                    date: new Date().toISOString(),
                    userId: user.uid,
                    userName: user.displayName || user.email || 'Unknown',
                    previousConfidentiality: prev.confidentiality,
                    newConfidentiality: cleanData.confidentiality as Criticality,
                    previousIntegrity: prev.integrity,
                    newIntegrity: cleanData.integrity as Criticality,
                    previousAvailability: prev.availability,
                    newAvailability: cleanData.availability as Criticality,
                    reason: 'Mise à jour des criticités (DIC)'
                };
                dataToUpdate.history = [...(prev.history || []), historyEntry];
            }

            await updateDoc(doc(db, 'assets', selectedAsset.id), dataToUpdate);
            await logAction(user, 'UPDATE', 'Asset', `MAJ Actif: ${cleanData.name}`);

            const updatedAsset = { ...selectedAsset, ...dataToUpdate, currentValue: calculateDepreciation(cleanData.purchasePrice || 0, cleanData.purchaseDate || '') } as Asset;
            setSelectedAsset(updatedAsset);
            addToast("Modifications enregistrées", "success");

            refreshAssets();
            setIsEditing(false);
        } catch (e) {
            if (e instanceof z.ZodError) {
                addToast((e as unknown as { errors: { message: string }[] }).errors[0].message, "error");
            } else {
                ErrorLogger.handleErrorWithToast(e, 'Assets.handleUpdate', 'UPDATE_FAILED');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDuplicate = () => {
        if (!selectedAsset || !canEdit) return;
        const copy = { ...selectedAsset, name: `${selectedAsset.name} (Copie)` };
        setSelectedAsset(copy);
        setCreationMode(true);
        setIsEditing(false);
        setShowInspector(true);
        addToast("Mode création activé avec les données dupliquées.", "info");
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
        if (!selectedAsset || !newMaintenance.description || !canEdit) return;
        setIsAddingMaintenance(true);
        try {
            await addDoc(collection(db, 'assets', selectedAsset.id, 'maintenance'), newMaintenance);
            if (newMaintenance.type === 'Préventive') {
                const nextDate = new Date(newMaintenance.date!);
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                const nextStr = nextDate.toISOString().split('T')[0];
                await updateDoc(doc(db, 'assets', selectedAsset.id), { nextMaintenance: nextStr });
                setSelectedAsset(prev => prev ? { ...prev, nextMaintenance: nextStr } : null);
                addToast("Maintenance ajoutée et prochaine échéance planifiée (+1 an)", "success");
            } else {
                addToast("Intervention enregistrée", "success");
            }
            setNewMaintenance({ date: new Date().toISOString().split('T')[0], type: 'Préventive', description: '', technician: user?.displayName || '' });
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Assets.handleAddMaintenance', 'CREATE_FAILED');
        } finally {
            setIsAddingMaintenance(false);
        }
    };

    const initiateDelete = async (id: string, name: string) => {
        if (!canDeleteResource(user, 'Asset')) return;
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
        setConfirmData({
            isOpen: true,
            title: "Supprimer l'actif ?",
            message: `Voulez-vous vraiment supprimer "${name}" ?`,
            onConfirm: () => handleDeleteAsset(id, name),
            closeOnConfirm: false
        });
    };

    const handleDeleteAsset = async (id: string, name: string) => {
        if (!canDeleteResource(user, 'Asset')) return;
        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            await deleteDoc(doc(db, 'assets', id));
            await logAction(user, 'DELETE', 'Asset', `Suppression actif: ${name}`);
            refreshAssets();
            setSelectedAsset(null);
            setShowInspector(false);
            addToast("Actif supprimé", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Assets.handleDeleteAsset', 'DELETE_FAILED');
        } finally {
            setConfirmData(prev => ({ ...prev, isOpen: false, loading: false }));
        }
    };

    const handleScanAsset = async () => {
        if (!selectedAsset || !user?.organizationId) {
            return;
        }

        if (!user.hasShodanKey) {
            addToast("Clé API Shodan manquante dans les paramètres", "info");
            return;
        }

        const target = selectedAsset.location;
        if (!target || (!target.includes('.') && !target.includes(':'))) {
            addToast("Aucune adresse IP ou domaine valide trouvé dans le champ 'Localisation'", "info");
            return;
        }

        setScanning(true);
        try {
            const functions = getFunctions();
            const scanAssetWithShodan = httpsCallable(functions, 'scanAssetWithShodan');
            const { data } = await scanAssetWithShodan({ ip: target });
            const result = (data as { result?: unknown } | undefined)?.result;
            if (!result) {
                addToast("Erreur lors du scan", "error");
            } else {
                setShodanResult(result as ShodanResult);
                setInspectorTab('security');
                addToast("Scan Shodan terminé", "success");
            }
        } catch (err) {
            ErrorLogger.handleErrorWithToast(err, 'Assets.handleScanAsset', 'SCAN_FAILED');
        } finally {
            setScanning(false);
        }
    };

    const handleCheckCVEs = async () => {
        if (!selectedAsset) return;
        setScanning(true);
        try {
            // Use asset name or type as CPE query
            // Ideally we need a CPE field. Let's use name.
            const vulns = await integrationService.checkVulnerabilities(selectedAsset.name, demoMode);
            setVulnerabilities(vulns);
            if (vulns.length > 0) {
                setInspectorTab('security');
                addToast(`${vulns.length} vulnérabilités trouvées`, "info");
            } else {
                addToast("Aucune vulnérabilité connue trouvée (NVD)", "success");
            }
        } catch {
            addToast("Erreur lors de la recherche CVE", "error");
        } finally {
            setScanning(false);
        }
    };

    const handleCreateRiskFromVuln = async (vuln: Vulnerability) => {
        if (!selectedAsset || !user?.organizationId) return;
        try {
            await addDoc(collection(db, 'risks'), sanitizeData({
                organizationId: user.organizationId,
                assetId: selectedAsset.id,
                threat: `Vulnérabilité ${vuln.cveId}`,
                vulnerability: vuln.description,
                consequences: "Compromission de la confidentialité, intégrité ou disponibilité de l'actif.",
                probability: 3, // Default Medium
                impact: vuln.severity === 'High' || vuln.severity === 'Critical' ? 4 : 2,
                score: (vuln.severity === 'High' || vuln.severity === 'Critical' ? 4 : 2) * 3,
                status: 'Identifié',
                owner: user.displayName || 'Système',
                createdAt: new Date().toISOString(),
                history: []
            }));
            await logAction(user, 'CREATE', 'Risk', `Création auto risque pour CVE ${vuln.cveId} sur ${selectedAsset.name}`);
            addToast(`Risque créé pour ${vuln.cveId}`, "success");
            // Refresh risks
            setLinkedRisks(prev => [...prev]); // Trigger refresh implicitly if using real-time listener, but here we might need manual refresh or just wait for listener.
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Assets.handleCreateRiskFromVuln');
        }
    };

    const handleExportCSV = () => {
        const headers = ["Nom", "Type", "Propriétaire", "Confidentialité", "Intégrité", "Disponibilité", "Localisation", "Statut", "Valeur Actuelle"];
        const rows = filteredAssets.map(a => [a.name, a.type, a.owner, a.confidentiality, a.integrity, a.availability, a.location, a.lifecycleStatus || 'Neuf', a.currentValue || 0]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })); link.download = `assets_export.csv`; link.click();
    };

    const generateLabels = async (targetAsset?: Asset) => {
        const assetsToPrint = targetAsset ? [targetAsset] : assets;
        setIsGeneratingLabels(true);

        try {
            // Pre-generate QR codes
            const qrCodes: Record<string, string> = {};
            await Promise.all(assetsToPrint.map(async (asset) => {
                try {
                    // Generate QR code with asset ID and URL to view it
                    const url = `${window.location.origin}/#/assets?id=${asset.id}`;
                    qrCodes[asset.id] = await QRCode.toDataURL(url, { width: 100, margin: 0 });
                } catch (e) {
                    ErrorLogger.error(e, 'Assets.generateLabels', { metadata: { assetId: asset.id, code: 'QR_GEN_FAILED' } });
                }
            }));

            PdfService.generateCustomReport(
                {
                    title: 'Étiquettes d\'Actifs',
                    orientation: 'landscape',
                    filename: targetAsset ? `etiquette-${targetAsset.name}.pdf` : 'etiquettes-actifs.pdf'
                },
                (doc) => {
                    let x = 10, y = 10;
                    assetsToPrint.forEach((asset, index) => {
                        if (index > 0 && index % 8 === 0) {
                            doc.addPage();
                            x = 10; y = 10;
                        }

                        doc.setDrawColor(200);
                        doc.rect(x, y, 90, 50);

                        doc.setFontSize(12);
                        doc.setFont('helvetica', 'bold');
                        // Truncate name if too long
                        const name = asset.name.length > 25 ? asset.name.substring(0, 25) + '...' : asset.name;
                        doc.text(name, x + 5, y + 10);

                        doc.setFontSize(10);
                        doc.setFont('helvetica', 'normal');
                        doc.text(`ID: ${asset.id.substring(0, 8)}`, x + 5, y + 20);
                        doc.text(`Type: ${asset.type}`, x + 5, y + 27);
                        doc.text(`Propriétaire: ${asset.owner || 'N/A'}`, x + 5, y + 34);
                        doc.text(`Statut: ${asset.lifecycleStatus || 'N/A'}`, x + 5, y + 41);

                        // QR Code
                        const qr = qrCodes[asset.id];
                        if (qr) {
                            doc.addImage(qr, 'PNG', x + 65, y + 5, 20, 20);
                        } else {
                            // Fallback if generation failed
                            doc.rect(x + 65, y + 5, 20, 20);
                            doc.setFontSize(6);
                            doc.text('Err', x + 72, y + 17);
                        }

                        x += 95;
                        if (x > 200) { x = 10; y += 55; }
                    });
                }
            );
            addToast("Étiquettes générées avec succès", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Assets.generateLabels', 'CREATE_FAILED');
        } finally {
            setIsGeneratingLabels(false);
        }
    };

    const generateIntakeLink = () => {
        if (!user?.organizationId) return;
        const url = `${window.location.origin}/#/intake?org=${user.organizationId}`;
        navigator.clipboard.writeText(url);
        addToast("Lien kiosque copié !", "success");
    };

    const getBreadcrumbs = () => {
        const crumbs: { label: string; onClick?: () => void }[] = [{ label: 'Actifs', onClick: () => { setShowInspector(false); setSelectedAsset(null); } }];

        if (creationMode) {
            crumbs.push({ label: 'Création' });
            return crumbs;
        }

        if (selectedAsset) {
            if (selectedAsset.type) {
                crumbs.push({ label: selectedAsset.type });
            }
            crumbs.push({ label: selectedAsset.name });
        }

        return crumbs;
    };

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <div className="space-y-8 animate-fade-in pb-10 relative w-full max-w-full overflow-x-hidden">
            <Helmet>
                <title>{selectedAsset ? `${selectedAsset.name} - Actifs` : 'Inventaire des Actifs - Sentinel GRC'}</title>
            </Helmet>
            {/* Confirm Modal */}
            <ConfirmModal isOpen={confirmData.isOpen} onClose={() => setConfirmData({ ...confirmData, isOpen: false })} onConfirm={confirmData.onConfirm} title={confirmData.title} message={confirmData.message} loading={confirmData.loading} closeOnConfirm={confirmData.closeOnConfirm} />



            <SlideUp>
                <PageHeader
                    title={assetsTitle}
                    subtitle={assetsSubtitle}
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
            </SlideUp>

            {/* KPIs */}
            {/* KPIs */}
            {/* Dashboard */}
            <SlideUp>
                <AssetDashboard
                    assets={filteredAssets}
                    onFilterChange={(filter) => {
                        if (filter?.type === 'criticality') {
                            setActiveFilters(prev => ({ ...prev, criticality: filter.value as Criticality }));
                        } else if (filter === null) {
                            setActiveFilters(prev => ({ ...prev, criticality: undefined }));
                        }
                    }}
                />
            </SlideUp>

            {showAdvancedSearch && (
                <SlideUp>
                    <AdvancedSearch
                        onSearch={(filters) => { setActiveFilters(filters); setShowAdvancedSearch(false); }}
                        onClose={() => setShowAdvancedSearch(false)}
                    />
                </SlideUp>
            )}

            <SlideUp>
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="flex-1 w-full glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
                        <Search className="h-5 w-5 text-slate-500" />
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
                        <button onClick={handleExportCSV} className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"><FileSpreadsheet className="h-4 w-4" /></button>
                        <button disabled={isGeneratingLabels} onClick={() => generateLabels()} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50" title="Imprimer Étiquette">
                            {isGeneratingLabels ? <span className="animate-spin">⏳</span> : <QrCode className="h-4 w-4" />}
                        </button>
                    </div>

                    <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-600'}`}
                        >
                            <List className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </SlideUp>

            {/* List / Grid */}
            {viewMode === 'list' ? (
                <div className="glass-panel w-full max-w-full rounded-[2.5rem] overflow-hidden shadow-sm">
                    <DataTable
                        columns={[
                            {
                                header: 'Actif',
                                accessorKey: 'name',
                                cell: ({ row }) => {
                                    const asset = row.original;
                                    const warrantyExpired = asset.warrantyEnd && new Date(asset.warrantyEnd) < new Date();
                                    const maintenanceOverdue = asset.nextMaintenance && new Date(asset.nextMaintenance) < new Date();
                                    return (
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center mr-4 text-slate-600 dark:text-slate-300">
                                                <Server className="h-5 w-5" strokeWidth={1.5} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white text-[15px]">{asset.name}</div>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    <span className="text-xs text-slate-600 font-medium">{asset.owner}</span>
                                                    {warrantyExpired && <span className="text-[9px] bg-red-50 text-red-600 border border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900 px-1.5 py-0.5 rounded font-bold">Garantie Exp.</span>}
                                                    {maintenanceOverdue && <span className="text-[9px] bg-orange-50 text-orange-600 border border-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-900 px-1.5 py-0.5 rounded font-bold flex items-center"><Clock className="h-2.5 w-2.5 mr-1" />Maint.</span>}
                                                    {asset.scope && asset.scope.map(s => <span key={s} className="text-[9px] bg-indigo-50 dark:bg-slate-900 text-indigo-600 border border-indigo-100 dark:bg-slate-900/30 dark:text-indigo-400 dark:border-indigo-900 px-1.5 py-0.5 rounded font-bold">{s}</span>)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                },
                            },
                            {
                                header: 'Type',
                                accessorKey: 'type',
                                cell: ({ row }) => <span className="text-slate-600 dark:text-slate-400 font-medium">{row.original.type}</span>,
                            },
                            {
                                header: 'Classification',
                                accessorKey: 'confidentiality',
                                cell: ({ row }) => (
                                    <span className={`px-3 py-1 rounded-lg text-[11px] font-bold tracking-wide border shadow-sm ${getCriticalityColor(row.original.confidentiality)}`}>
                                        {row.original.confidentiality}
                                    </span>
                                ),
                            },
                            {
                                header: 'Statut',
                                accessorKey: 'lifecycleStatus',
                                cell: ({ row }) => {
                                    const status = row.original.lifecycleStatus || 'Neuf';
                                    const isService = status === 'En service';
                                    return (
                                        <span className={`flex items-center w-fit px-2.5 py-1 rounded-full text-[11px] font-bold border ${isService ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full mr-2 ${isService ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                                            {status}
                                        </span>
                                    );
                                },
                            },
                            {
                                header: 'Localisation',
                                accessorKey: 'location',
                                cell: ({ row }) => <span className="text-slate-600 dark:text-slate-400 font-medium text-xs">{row.original.location}</span>,
                            },
                            {
                                id: 'actions',
                                header: '',
                                cell: ({ row }) => (
                                    <div className="flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()}>
                                        <button disabled={isGeneratingLabels} onClick={() => generateLabels(row.original)} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all disabled:opacity-50" title="Imprimer Étiquette">
                                            {isGeneratingLabels ? <span className="animate-spin text-xs">⏳</span> : <QrCode className="h-4 w-4" />}
                                        </button>
                                        {canDeleteResource(user, 'Asset') && (
                                            <button onClick={() => initiateDelete(row.original.id, row.original.name)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" title="Supprimer">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ),
                            },
                        ]}
                        data={filteredAssets}
                        selectable={canDeleteResource(user, 'Asset')}
                        onRowClick={(asset) => openInspector(asset)}
                        searchable={false}
                        exportable={false}
                        loading={loading}
                        pageSize={12}
                        onBulkDelete={async (selectedIds) => {
                            if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedIds.length} actifs ? Cette action est irréversible.`)) {
                                return;
                            }

                            try {
                                const batch = writeBatch(db);
                                selectedIds.forEach(id => {
                                    const ref = doc(db, 'assets', id);
                                    batch.delete(ref);
                                });
                                await batch.commit();

                                addToast(`${selectedIds.length} actifs supprimés avec succès`, 'success');
                                // Refresh logic is usually automatic with Firestore subscription
                            } catch (error) {
                                ErrorLogger.handleErrorWithToast(error, 'Assets.bulkDelete', 'DELETE_FAILED');
                            }
                        }}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full"><TableSkeleton rows={3} columns={1} /></div>
                    ) : paginatedItems.length === 0 ? (
                        <div className="col-span-full">
                            <EmptyState
                                icon={Server}
                                title="Aucun actif trouvé"
                                description={activeFilters.query ? "Aucun actif ne correspond à votre recherche." : "Commencez par ajouter votre premier actif pour suivre votre parc."}
                                actionLabel={activeFilters.query || !canEdit ? undefined : "Nouvel Actif"}
                                onAction={activeFilters.query || !canEdit ? undefined : () => openInspector(undefined)}
                            />
                        </div>
                    ) : (
                        paginatedItems.map((asset) => {
                            const warrantyExpired = asset.warrantyEnd && new Date(asset.warrantyEnd) < new Date();
                            const maintenanceOverdue = asset.nextMaintenance && new Date(asset.nextMaintenance) < new Date();
                            return (
                                <div key={asset.id} onClick={() => openInspector(asset)} className="glass-panel p-6 rounded-[2.5rem] shadow-sm card-hover cursor-pointer group flex flex-col">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300">
                                            <Server className="h-6 w-6" />
                                        </div>
                                        <div className="flex gap-2">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getCriticalityColor(asset.confidentiality)}`}>{asset.confidentiality}</span>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 leading-tight">{asset.name}</h3>
                                    <p className="text-xs text-slate-600 font-medium mb-4">{asset.type} • {asset.owner}</p>

                                    <div className="mt-auto pt-4 border-t border-dashed border-slate-200 dark:border-white/10 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${asset.lifecycleStatus === 'En service' ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{asset.lifecycleStatus || 'Neuf'}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            {warrantyExpired && <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">Garantie Exp.</span>}
                                            {maintenanceOverdue && <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-bold">Maint.</span>}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}

            {/* Pagination */}
            {!loading && filteredAssets.length > 0 && viewMode === 'grid' && (
                <Pagination
                    currentPage={currentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                />
            )}

            {/* Inspector Drawer */}

            <Drawer
                isOpen={showInspector}
                onClose={() => { setShowInspector(false); setSelectedAsset(null); }}
                title={selectedAsset ? selectedAsset.name : 'Nouvel Actif'}
                breadcrumbs={getBreadcrumbs()}
                width={creationMode ? "max-w-4xl" : "max-w-6xl"}
                subtitle={
                    <div className="flex items-center gap-2">
                        <>
                            {!creationMode && !isEditing && (
                                <>
                                    {canEdit && (
                                        <>
                                            <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-brand-500">
                                                <Edit className="h-5 w-5" />
                                            </button>
                                            <button onClick={() => handleDuplicate()} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-blue-500">
                                                <Copy className="h-5 w-5" />
                                            </button>
                                        </>
                                    )}
                                    {canDeleteResource(user, 'Asset') && (
                                        <button onClick={() => selectedAsset && initiateDelete(selectedAsset.id, selectedAsset.name)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-red-500">
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    )}
                                </>
                            )}
                        </>
                    </div>
                }
            >
                {creationMode || (isEditing && selectedAsset) ? (
                    <div className="p-6">
                        <AssetForm
                            onSubmit={creationMode ? handleCreate : handleUpdate}
                            onCancel={() => {
                                if (creationMode) setShowInspector(false);
                                else setIsEditing(false);
                            }}
                            initialData={selectedAsset}
                            usersList={usersList}
                            suppliers={suppliers}
                            isEditing={isEditing}
                            isLoading={isSubmitting}
                        />
                    </div>
                ) : (
                    <>
                        <div className="px-8 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-transparent">
                            <ScrollableTabs
                                tabs={[
                                    { id: 'details', label: 'Général', icon: Tag },
                                    { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
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
                            {inspectorTab === 'details' && selectedAsset && (
                                <div className="space-y-8">
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">Informations Principales</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="col-span-2">
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nom de l'actif</label>
                                                <div className="text-lg font-medium text-slate-900 dark:text-white">{selectedAsset.name}</div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Type</label>
                                                <div className="text-base text-slate-900 dark:text-white">{selectedAsset.type}</div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Propriétaire</label>
                                                <div className="text-base text-slate-900 dark:text-white">{selectedAsset.owner || 'Non assigné'}</div>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Localisation</label>
                                                <div className="text-base text-slate-900 dark:text-white">{selectedAsset.location || 'Non spécifiée'}</div>
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Fournisseur / Mainteneur</label>
                                                {(() => {
                                                    const sup = suppliers.find(s => s.id === selectedAsset.supplierId);
                                                    return sup ? (
                                                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                                            <div className="font-bold text-slate-900 dark:text-white">{sup.name}</div>
                                                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{sup.category}</div>
                                                        </div>
                                                    ) : <p className="text-sm text-slate-500 italic">Aucun fournisseur lié.</p>;
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Specific Details based on Type */}
                                    {(selectedAsset.type === 'Matériel' || selectedAsset.type === 'Logiciel' || selectedAsset.type === 'Humain') && (
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">
                                                Détails {selectedAsset.type}
                                            </h3>
                                            <div className="grid grid-cols-2 gap-6">
                                                {selectedAsset.type === 'Matériel' && selectedAsset.ipAddress && (
                                                    <div>
                                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Adresse IP</label>
                                                        <div className="text-base text-slate-900 dark:text-white font-mono bg-slate-100 dark:bg-black/30 px-2 py-1 rounded inline-block">{selectedAsset.ipAddress}</div>
                                                    </div>
                                                )}
                                                {selectedAsset.type === 'Logiciel' && (
                                                    <>
                                                        {selectedAsset.version && (
                                                            <div>
                                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Version</label>
                                                                <div className="text-base text-slate-900 dark:text-white">{selectedAsset.version}</div>
                                                            </div>
                                                        )}
                                                        {selectedAsset.licenseExpiry && (
                                                            <div>
                                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Expiration Licence</label>
                                                                <div className="text-base text-slate-900 dark:text-white">{new Date(selectedAsset.licenseExpiry).toLocaleDateString()}</div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {selectedAsset.type === 'Humain' && (
                                                    <>
                                                        {selectedAsset.email && (
                                                            <div className="col-span-2">
                                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                                                                <div className="text-base text-slate-900 dark:text-white">{selectedAsset.email}</div>
                                                            </div>
                                                        )}
                                                        {selectedAsset.role && (
                                                            <div>
                                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Fonction</label>
                                                                <div className="text-base text-slate-900 dark:text-white">{selectedAsset.role}</div>
                                                            </div>
                                                        )}
                                                        {selectedAsset.department && (
                                                            <div>
                                                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Département</label>
                                                                <div className="text-base text-slate-900 dark:text-white">{selectedAsset.department}</div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600/80 mb-6 flex items-center">
                                            <AlertTriangle className="h-4 w-4 mr-2" /> Classification DIC
                                        </h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            {['confidentiality', 'integrity', 'availability'].map((field) => (
                                                <div key={field} className="p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5">
                                                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-3 tracking-wider">{field.charAt(0).toUpperCase() + field.slice(1)}</label>
                                                    <div className={`text-sm font-bold ${getCriticalityColor(selectedAsset[field as 'confidentiality' | 'integrity' | 'availability'])} px-2 py-1 rounded-lg inline-block`}>
                                                        {selectedAsset[field as 'confidentiality' | 'integrity' | 'availability']}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center">
                                            <ShieldCheck className="h-4 w-4 mr-2" /> Périmètre de Conformité (Scope)
                                        </h3>
                                        <div className="flex flex-wrap gap-3">
                                            {selectedAsset.scope && selectedAsset.scope.length > 0 ? selectedAsset.scope.map((scope) => (
                                                <span key={scope} className="px-4 py-2 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 font-bold">
                                                    {scope.replace('_', ' ')}
                                                </span>
                                            )) : <p className="text-sm text-slate-500 italic">Aucun périmètre défini.</p>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center">
                                                <HeartPulse className="h-4 w-4 mr-2" /> Processus Supportés
                                            </h3>
                                            {(() => {
                                                const supported = processes.filter(p => p.supportingAssetIds?.includes(selectedAsset.id));
                                                return supported.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {supported.map(p => (
                                                            <div key={p.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 flex justify-between items-center">
                                                                <span className="text-sm font-medium text-slate-700 dark:text-white">{p.name}</span>
                                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${p.priority === 'Critique' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{p.priority}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-sm text-slate-500 italic">Cet actif ne supporte aucun processus critique.</p>;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {inspectorTab === 'lifecycle' && (
                                <div className="space-y-8">
                                    <div className="bg-white dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm overflow-x-auto">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-8">Timeline du cycle de vie</h3>
                                        <div className="min-w-[600px] px-4">
                                            <LifecycleTimeline
                                                status={selectedAsset?.lifecycleStatus || 'Neuf'}
                                                purchaseDate={selectedAsset?.purchaseDate}
                                                warrantyEnd={selectedAsset?.warrantyEnd}
                                                nextMaintenance={selectedAsset?.nextMaintenance}
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-blue-600/80 flex items-center"><Archive className="h-4 w-4 mr-2" /> État du cycle de vie</h3>
                                            <div className="px-3 py-1 rounded-full bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/20 text-blue-600 text-xs font-bold">{selectedAsset?.lifecycleStatus || 'Neuf'}</div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-6 pt-2">
                                                <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Date d'achat</label><div className="text-sm font-medium text-slate-900 dark:text-white">{selectedAsset?.purchaseDate ? new Date(selectedAsset.purchaseDate).toLocaleDateString() : '-'}</div></div>
                                                <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Fin de garantie</label><div className="text-sm font-medium text-slate-900 dark:text-white">{selectedAsset?.warrantyEnd ? new Date(selectedAsset.warrantyEnd).toLocaleDateString() : '-'}</div></div>
                                                <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Prix d'achat (€)</label><div className="text-sm font-medium text-slate-900 dark:text-white">{selectedAsset?.purchasePrice ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(selectedAsset.purchasePrice) : '-'}</div></div>
                                                <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Coût Maintenance (€)</label><div className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/5 text-sm font-bold">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(maintenanceRecords.reduce((acc, m) => acc + (m.cost || 0), 0))}</div></div>
                                            </div>

                                            {/* Financial Charts */}
                                            {selectedAsset?.purchasePrice && (
                                                <div className="mt-6 pt-6 border-t border-dashed border-slate-200 dark:border-white/10">
                                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                                                            <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">Valeur Actuelle (Net)</p>
                                                            <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(calculateDepreciation(selectedAsset.purchasePrice, selectedAsset.purchaseDate || ''))}</p>
                                                        </div>
                                                        <div className="p-4 bg-blue-50 dark:bg-slate-900 dark:bg-slate-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                                                            <p className="text-[10px] font-bold uppercase text-blue-600 mb-1">TCO (Coût Total)</p>
                                                            <p className="text-xl font-black text-blue-700 dark:text-blue-400">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(calculateTCO())}</p>
                                                        </div>
                                                    </div>
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Courbe d'amortissement (5 ans)</h4>
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
                                    <div><div className="flex items-center justify-between mb-4 px-1"><h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center"><ClipboardList className="h-4 w-4 mr-2 text-brand-500" /> Historique Maintenance</h3></div>{canEdit && (<div className="bg-white dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-white/5 mb-6 shadow-sm"><div className="grid grid-cols-2 gap-4 mb-4"><input type="date" className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm dark:text-white outline-none focus:ring-2 focus:ring-brand-500" value={newMaintenance.date} onChange={e => setNewMaintenance({ ...newMaintenance, date: e.target.value })} /><select className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm dark:text-white outline-none focus:ring-2 focus:ring-brand-500" value={newMaintenance.type} onChange={e => setNewMaintenance({ ...newMaintenance, type: e.target.value as MaintenanceRecord['type'] })}>{['Préventive', 'Corrective', 'Mise à jour', 'Inspection'].map(t => <option key={t} value={t}>{t}</option>)}</select></div><div className="flex gap-4 mb-4"><input type="text" placeholder="Description..." className="flex-1 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm dark:text-white outline-none focus:ring-2 focus:ring-brand-500" value={newMaintenance.description} onChange={e => setNewMaintenance({ ...newMaintenance, description: e.target.value })} /><input type="number" placeholder="Coût (€)..." className="w-24 p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm dark:text-white outline-none focus:ring-2 focus:ring-brand-500" value={newMaintenance.cost || ''} onChange={e => setNewMaintenance({ ...newMaintenance, cost: parseFloat(e.target.value) })} /></div><button onClick={handleAddMaintenance} disabled={isAddingMaintenance} className="w-full py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:scale-[1.02] transition-transform disabled:opacity-50 flex justify-center items-center">{isAddingMaintenance ? <span className="animate-spin mr-2">⏳</span> : null}Ajouter Intervention</button></div>)}<div className="space-y-3">{maintenanceRecords.length === 0 ? <p className="text-sm text-slate-500 text-center italic py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucune intervention enregistrée.</p> : maintenanceRecords.map(rec => (<div key={rec.id} className="flex items-start p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-2xl shadow-sm hover:shadow-md transition-all"><div className={`mt-1.5 w-2.5 h-2.5 rounded-full mr-4 flex-shrink-0 ${rec.type === 'Corrective' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`}></div><div className="flex-1"><div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-slate-900 dark:text-white">{new Date(rec.date).toLocaleDateString()}</span><span className="text-[10px] uppercase tracking-wider bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300 font-bold">{rec.type}</span></div><p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{rec.description}</p><div className="flex justify-between mt-2"><span className="text-[10px] text-slate-500 font-medium">Tech: {rec.technician}</span>{rec.cost && <span className="text-[10px] font-bold text-slate-600">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(rec.cost)}</span>}</div></div></div>))}</div></div>
                                </div>
                            )}
                            {inspectorTab === 'security' && (
                                <div className="space-y-8">
                                    {/* Scan Actions */}
                                    <div className="flex gap-4">
                                        <button
                                            onClick={handleScanAsset}
                                            disabled={scanning}
                                            className="flex-1 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center disabled:opacity-50"
                                        >
                                            {scanning ? <span className="animate-spin mr-2">⏳</span> : <Search className="w-4 h-4 mr-2" />}
                                            Scan Shodan
                                        </button>
                                        <button
                                            onClick={handleCheckCVEs}
                                            disabled={scanning}
                                            className="flex-1 py-3 bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white rounded-xl text-sm font-bold shadow-sm hover:bg-slate-200 dark:hover:bg-white/20 transition-colors flex items-center justify-center disabled:opacity-50"
                                        >
                                            {scanning ? <span className="animate-spin mr-2">⏳</span> : <ShieldAlert className="w-4 h-4 mr-2" />}
                                            Check CVEs (NVD)
                                        </button>
                                    </div>

                                    {/* Shodan Results */}
                                    {shodanResult && (
                                        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4 flex items-center">
                                                <Server className="h-4 w-4 mr-2" /> Résultat Shodan
                                            </h3>
                                            <div className="space-y-2 text-sm font-mono">
                                                <p><span className="text-slate-500">IP:</span> {shodanResult.ip_str}</p>
                                                <p><span className="text-slate-500">OS:</span> {shodanResult.os || 'N/A'}</p>
                                                <p><span className="text-slate-500">Ports:</span> {shodanResult.ports?.join(', ') || 'None'}</p>
                                                <p><span className="text-slate-500">Org:</span> {shodanResult.org || 'N/A'}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* NVD Results */}
                                    {vulnerabilities.length > 0 && (
                                        <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/30">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-red-600 mb-4 flex items-center">
                                                <ShieldAlert className="h-4 w-4 mr-2" /> Vulnérabilités NVD ({vulnerabilities.length})
                                            </h3>
                                            <div className="space-y-3">
                                                {vulnerabilities.map(vuln => (
                                                    <div key={vuln.cveId} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900/20 shadow-sm">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-sm font-bold text-red-700 dark:text-red-400">{vuln.cveId}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-800 rounded">{vuln.severity} ({vuln.score})</span>
                                                                <button
                                                                    onClick={() => handleCreateRiskFromVuln(vuln)}
                                                                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400 transition-colors"
                                                                    title="Créer un risque"
                                                                >
                                                                    <Plus className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2" title={vuln.description}>{vuln.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div><h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><ShieldAlert className="h-4 w-4 mr-2" /> Risques Identifiés ({linkedRisks.length})</h3>{linkedRisks.length === 0 ? (<p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun risque associé.</p>) : (<div className="grid gap-4">{linkedRisks.map(risk => (<div key={risk.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all"><div className="flex justify-between items-start mb-2"><span className="text-sm font-bold text-slate-900 dark:text-white">{risk.threat}</span><span className={`text-[10px] px-2 py-1 rounded-lg font-bold ${risk.score >= 15 ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'}`}>Score {risk.score}</span></div><p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{risk.vulnerability}</p>{risk.score >= 15 && <div className="flex items-center text-[10px] text-red-600 font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-xl w-fit"><Flame className="h-3 w-3 mr-1.5" /> Risque Critique</div>}</div>))}</div>)}</div><div><h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><Siren className="h-4 w-4 mr-2" /> Incidents ({linkedIncidents.length})</h3>{linkedIncidents.length === 0 ? (<p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun incident signalé.</p>) : (<div className="grid gap-4">{linkedIncidents.map(inc => (<div key={inc.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all"><div className="flex justify-between items-start mb-2"><span className="text-sm font-bold text-slate-900 dark:text-white">{inc.title}</span><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${inc.status === 'Résolu' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inc.status}</span></div><p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{new Date(inc.dateReported).toLocaleDateString()}</p></div>))}</div>)}</div></div>
                            )}
                            {inspectorTab === 'projects' && (
                                <div className="space-y-8">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><FolderKanban className="h-4 w-4 mr-2" /> Projets Liés ({linkedProjects.length})</h3>
                                    {linkedProjects.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun projet associé.</p>
                                    ) : (
                                        <div className="grid gap-4">
                                            {linkedProjects.map(proj => (
                                                <div key={proj.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{proj.name}</span>
                                                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${proj.status === 'En cours' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{proj.status}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{proj.description}</p>
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
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center"><CheckSquare className="h-4 w-4 mr-2" /> Audits Liés ({linkedAudits.length})</h3>
                                    {linkedAudits.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">Aucun audit associé.</p>
                                    ) : (
                                        <div className="grid gap-4">
                                            {linkedAudits.map(audit => (
                                                <div key={audit.id} className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{audit.name}</span>
                                                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${audit.status === 'Terminé' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{audit.status}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-2">
                                                        <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                                            <CalendarClock className="h-3 w-3" />
                                                            {new Date(audit.dateScheduled).toLocaleDateString()}
                                                        </div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
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

                            {inspectorTab === 'history' && selectedAsset && (
                                <div className="space-y-8">
                                    {/* DICP History */}
                                    <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center">
                                            <History className="h-4 w-4 mr-2" /> Historique DICP
                                        </h3>
                                        {!selectedAsset.history || selectedAsset.history.length === 0 ? (
                                            <p className="text-sm text-slate-500 italic">Aucune modification enregistrée.</p>
                                        ) : (
                                            <div className="space-y-4">
                                                {selectedAsset.history.slice().reverse().map((h, i) => (
                                                    <div key={i} className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{new Date(h.date).toLocaleString()}</span>
                                                            <span className="text-xs font-medium text-slate-500">par {h.userName}</span>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                                            <div className="flex flex-col items-center p-2 rounded bg-white dark:bg-black/20">
                                                                <span className="text-[10px] text-slate-500 uppercase">Confidentialité</span>
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    <span className="line-through opacity-50">{h.previousConfidentiality}</span>
                                                                    <span>→</span>
                                                                    <span className="font-bold">{h.newConfidentiality}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-center p-2 rounded bg-white dark:bg-black/20">
                                                                <span className="text-[10px] text-slate-500 uppercase">Intégrité</span>
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    <span className="line-through opacity-50">{h.previousIntegrity}</span>
                                                                    <span>→</span>
                                                                    <span className="font-bold">{h.newIntegrity}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-center p-2 rounded bg-white dark:bg-black/20">
                                                                <span className="text-[10px] text-slate-500 uppercase">Disponibilité</span>
                                                                <div className="flex items-center gap-1 mt-1">
                                                                    <span className="line-through opacity-50">{h.previousAvailability}</span>
                                                                    <span>→</span>
                                                                    <span className="font-bold">{h.newAvailability}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* System Logs */}
                                    <div className="relative border-l-2 border-slate-200 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                        {assetHistory.map((log, i) => (
                                            <div key={i} className="relative">
                                                <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-900">
                                                    <div className="h-2 w-2 rounded-full bg-brand-500"></div>
                                                </span>
                                                <div>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{log.details}</p>
                                                    <div className="mt-2 inline-flex items-center px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-[10px] font-medium text-slate-600">{log.userEmail}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {inspectorTab === 'graph' && selectedAsset && (
                                <div className="h-[500px]">
                                    <RelationshipGraph rootId={selectedAsset.id} rootType="Asset" />
                                </div>
                            )}
                            {inspectorTab === 'intelligence' && selectedAsset && (
                                <div className="h-full overflow-y-auto p-6">
                                    <AssetAIAssistant
                                        asset={selectedAsset}
                                        onUpdate={(updates) => handleUpdate({ ...selectedAsset, ...updates } as unknown as AssetFormData)}
                                    />
                                </div>
                            )}
                            {inspectorTab === 'comments' && selectedAsset && (<div className="h-full flex flex-col"><Comments collectionName="assets" documentId={selectedAsset.id} /></div>)}
                        </div>
                    </>
                )}
            </Drawer >
        </div>
    );
};
