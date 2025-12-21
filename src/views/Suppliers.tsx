import React, { useDeferredValue, useEffect, useMemo, useState, useRef } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { SEO } from '../components/SEO';
import { canEditResource } from '../utils/permissions';
import { sanitizeData } from '../utils/dataSanitizer';

import { collection, addDoc, query, deleteDoc, doc, updateDoc, where, limit, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Supplier, Document, SystemLog, Criticality, UserProfile, BusinessProcess, Asset, Risk, Project } from '../types';
import { Plus, Building, Trash2, Edit, Handshake, Truck, Mail, ShieldAlert, FileText, ClipboardList, History, MessageSquare, Save, FileSpreadsheet, Link, CalendarDays, Upload, Server, BrainCircuit, Loader2, MoreVertical, ChevronRight } from '../components/ui/Icons';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { useStore } from '../store';
import { useFirestoreCollection } from '../hooks/useFirestore';
import { logAction } from '../services/logger';
import { Comments } from '../components/ui/Comments';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton } from '../components/ui/Skeleton';
import { DataTable } from '../components/ui/DataTable';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { ColumnDef } from '@tanstack/react-table';
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
import { SupplierDashboard } from '../components/suppliers/SupplierDashboard';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { SupplierAIAssistant } from '../components/suppliers/SupplierAIAssistant';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { CsvParser } from '../utils/csvUtils';
import { QuestionnaireBuilder } from '../components/suppliers/QuestionnaireBuilder';
import { AssessmentView } from '../components/suppliers/AssessmentView';
import { QuestionnaireTemplate, SupplierQuestionnaireResponse } from '../types/business';
import { SupplierService } from '../services/SupplierService';

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

export const Suppliers: React.FC = () => {
    const [filter, setFilter] = useState('');
    const { user, addToast } = useStore();
    const location = useLocation();
    const canEdit = canEditResource(user, 'Supplier');
    const [viewMode, setViewMode] = usePersistedState<'grid' | 'list' | 'matrix' | 'kanban'>('suppliers_view_mode', 'grid');

    const [creationMode, setCreationMode] = useState(false);
    const [templateMode, setTemplateMode] = useState(false);
    const [assessmentMode, setAssessmentMode] = useState<string | null>(null); // responseId

    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [isExportingDORA, setIsExportingDORA] = useState(false);

    // Inspector State
    const [inspectorTab, setInspectorTab] = useState<'profile' | 'assessment' | 'incidents' | 'history' | 'comments' | 'intelligence'>('profile');
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
                supportedProcessIds: selectedSupplier.supportedProcessIds,
                relatedAssetIds: selectedSupplier.relatedAssetIds || [],
                relatedRiskIds: selectedSupplier.relatedRiskIds || [],
                relatedProjectIds: selectedSupplier.relatedProjectIds || []
            });
        }
    }, [selectedSupplier, editForm]);

    const { data: suppliersRaw, loading: loadingSuppliers } = useFirestoreCollection<Supplier>(
        'suppliers',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: usersRaw } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const selectedOwnerId = editForm.watch('ownerId');

    useEffect(() => {
        if (selectedOwnerId) {
            const selectedUser = usersRaw.find(u => u.uid === selectedOwnerId);
            if (selectedUser) editForm.setValue('owner', selectedUser.displayName || '');
        }
    }, [selectedOwnerId, usersRaw, editForm]);

    const { data: documentsRaw } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: processesRaw, loading: loadingProcesses } = useFirestoreCollection<BusinessProcess>(
        'business_processes',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: assetsRaw } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: risksRaw } = useFirestoreCollection<Risk>(
        'risks',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const { data: projectsRaw } = useFirestoreCollection<Project>(
        'projects',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
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

    const role = user?.role || 'user';

    let suppliersTitle = 'Fournisseurs';
    let suppliersSubtitle = 'Gestion des tiers et des contrats (ISO 27001 A.15).';

    if (role === 'admin' || role === 'rssi') {
        suppliersTitle = 'Gestion des Tiers & Exposition Fournisseurs';
        suppliersSubtitle = "Pilotez les fournisseurs critiques, les contrats, la conformité SSI et les risques associés.";
    } else if (role === 'direction') {
        suppliersTitle = 'Vue Risques Fournisseurs';
        suppliersSubtitle = "Surveillez les fournisseurs critiques, les contrats à risque et les obligations réglementaires.";
    } else if (role === 'auditor') {
        suppliersTitle = 'Fournisseurs à Auditer';
        suppliersSubtitle = "Préparez vos audits fournisseurs, preuves et contrôles attendus.";
    } else if (role === 'project_manager') {
        suppliersTitle = 'Fournisseurs liés aux Projets';
        suppliersSubtitle = "Identifiez les fournisseurs impliqués dans vos projets et suivez leurs engagements.";
    } else {
        suppliersTitle = 'Mes Fournisseurs';
        suppliersSubtitle = "Consultez les fournisseurs et contacts qui concernent votre périmètre.";
    }

    // Hook Definitions (Moved up to avoid conditional hook errors)
    const performDelete = React.useCallback(async (id: string) => {
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
    }, []);

    const handleDelete = React.useCallback(async (id: string) => {
        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            await performDelete(id);
            await logAction(user, 'DELETE', 'Supplier', `Suppression Fournisseur: ${selectedSupplier?.name || id}`);
            addToast('Fournisseur et données associées supprimés', 'success');
            if (selectedSupplier?.id === id) setSelectedSupplier(null);
            setConfirmData(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Suppliers.handleDelete');
        } finally {
            setConfirmData(prev => ({ ...prev, loading: false }));
        }
    }, [performDelete, user, addToast, selectedSupplier]);

    const initiateDelete = React.useCallback((id: string, name: string) => {
        if (!canEdit) return;
        setConfirmData({
            isOpen: true,
            title: `Supprimer ${name} ?`,
            message: "Cette action est définitive et supprimera toutes les données associées à ce fournisseur.",
            onConfirm: () => handleDelete(id),
            closeOnConfirm: false
        });
    }, [canEdit, handleDelete]);

    const deferredFilter = useDeferredValue(filter);
    const filteredSuppliers = useMemo(() => {
        const needle = (deferredFilter || '').toLowerCase().trim();
        if (!needle) return suppliers;
        return suppliers.filter(s => s.name.toLowerCase().includes(needle));
    }, [suppliers, deferredFilter]);

    const columns = React.useMemo<ColumnDef<Supplier>[]>(() => [
        {
            accessorKey: 'name',
            header: 'Fournisseur',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-bold text-slate-900 dark:text-white text-[15px]">{row.original.name}</span>
                    {row.original.isICTProvider && (
                        <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800 dark:bg-slate-900/30 dark:text-indigo-300 w-fit">
                            DORA ICT
                        </span>
                    )}
                </div>
            )
        },
        {
            accessorKey: 'category',
            header: 'Catégorie',
            cell: ({ row }) => (
                <span className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">
                    {row.original.category}
                </span>
            )
        },
        {
            accessorKey: 'criticality',
            header: 'Criticité',
            cell: ({ row }) => (
                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase border ${getCriticalityColor(row.original.criticality || Criticality.MEDIUM)}`}>
                    {row.original.criticality}
                </span>
            )
        },
        {
            accessorKey: 'securityScore',
            header: 'Score Sécurité',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${getScoreColor(row.original.securityScore || 0)}`} style={{ width: `${row.original.securityScore || 0}%` }}></div>
                    </div>
                    <span className={`text-xs font-bold ${getScoreColor(row.original.securityScore || 0).replace('bg-', 'text-')}`}>
                        {row.original.securityScore || 0}
                    </span>
                </div>
            )
        },
        {
            header: 'Contact',
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{row.original.contactName || '-'}</span>
                    <span className="text-[10px] text-slate-500">{row.original.contactEmail}</span>
                </div>
            )
        },
        {
            accessorKey: 'contractEnd',
            header: 'Fin Contrat',
            cell: ({ row }) => {
                const d = row.original.contractEnd;
                const isExpired = d && new Date(d) < new Date();
                return d ? (
                    <span className={`text-sm font-medium ${isExpired ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                        {new Date(d).toLocaleDateString()}
                    </span>
                ) : <span className="text-slate-500">-</span>;
            }
        },
        {
            accessorKey: 'status',
            header: 'Statut',
            cell: ({ row }) => (
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border ${row.original.status === 'Actif' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20' : 'bg-gray-50 text-slate-600 border-gray-200'}`}>
                    {row.original.status}
                </span>
            )
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="text-right flex justify-end items-center space-x-1" onClick={e => e.stopPropagation()}>
                    {canEdit && (
                        <CustomTooltip content="Supprimer le fournisseur">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    initiateDelete(row.original.id, row.original.name);
                                }}
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </CustomTooltip>
                    )}
                </div>
            )
        }
    ], [canEdit, initiateDelete]);

    // Import
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; loading?: boolean; closeOnConfirm?: boolean }>({
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

    // VRM: Load Templates and Responses
    const { data: templates } = useFirestoreCollection<QuestionnaireTemplate>('questionnaire_templates', [where('organizationId', '==', user?.organizationId)], { realtime: true });
    const { data: assessments } = useFirestoreCollection<SupplierQuestionnaireResponse>('questionnaire_responses', [where('organizationId', '==', user?.organizationId)], { realtime: true });

    // Logic to start assessment
    const startAssessment = async (supplier: Supplier, templateId: string) => {
        if (!templateId || !user?.organizationId) return;
        try {
            const tpl = templates.find(t => t.id === templateId);
            if (!tpl) return;
            const resId = await SupplierService.createAssessment(user.organizationId, supplier.id, supplier.name, tpl);
            setAssessmentMode(resId);
            addToast('Évaluation démarrée', 'success');
        } catch (e) { console.error(e); addToast('Erreur démarage évaluation', 'error'); }
    };

    // Render Assessment View Overlay
    if (assessmentMode) {
        return (
            <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 animate-slide-up">
                <AssessmentView responseId={assessmentMode} onClose={() => setAssessmentMode(null)} />
            </div>
        );
    }

    // Render Builder
    if (templateMode) {
        return (
            <div className="p-8 max-w-5xl mx-auto animate-fade-in">
                <div className="mb-6 flex items-center">
                    <button onClick={() => setTemplateMode(false)} className="text-slate-500 hover:text-slate-700 mr-4">Retour</button>
                    <h1 className="text-2xl font-bold dark:text-white">Éditeur de Modèle de Questionnaire</h1>
                </div>
                <QuestionnaireBuilder onCancel={() => setTemplateMode(false)} onSave={() => setTemplateMode(false)} />
            </div>
        )
    }

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
        setIsSubmitting(true);
        try {
            const sanitizedData = sanitizeData(data);
            await addDoc(collection(db, 'suppliers'), {
                ...sanitizedData,
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            await logAction(user, 'CREATE', 'Supplier', `Ajout Fournisseur: ${data.name}`);
            addToast("Fournisseur ajouté", "success");
            setCreationMode(false);
        } catch (error) {
            console.error("Error creating supplier:", error);
            ErrorLogger.handleErrorWithToast(error, 'Suppliers.handleCreate');
            // addToast("Erreur enregistrement", "error"); // ErrorLogger does this
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate: SubmitHandler<SupplierFormData> = async (data) => {
        if (!canEdit || !selectedSupplier) return;
        setIsSubmitting(true);
        try {
            const sanitizedData = sanitizeData(data);
            const now = new Date().toISOString();
            await updateDoc(doc(db, 'suppliers', selectedSupplier.id), {
                ...sanitizedData,
                updatedAt: now
            });
            await logAction(user, 'UPDATE', 'Supplier', `MAJ Fournisseur: ${data.name}`);
            setSelectedSupplier({ ...selectedSupplier, ...data, criticality: data.criticality as Criticality, updatedAt: now });
            setIsEditing(false);
            addToast("Fournisseur mis à jour", "success");
        } catch (error) {
            console.error("Error updating supplier:", error);
            ErrorLogger.handleErrorWithToast(error, 'Suppliers.handleUpdate');
        } finally {
            setIsSubmitting(false);
        }
    };







    const handleBulkDelete = async (selectedIds: string[]) => {
        if (!canEdit) return;
        if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ces ${selectedIds.length} fournisseurs ? Cette action est définitive.`)) return;

        try {
            await Promise.all(selectedIds.map(id => performDelete(id)));
            addToast(`${selectedIds.length} fournisseurs supprimés`, 'success');
            setSelectedSupplier(null);
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'Suppliers.handleBulkDelete');
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

    const handleExportCSV = async () => {
        if (isExportingCSV) return;
        setIsExportingCSV(true);
        try {
            const headers = ["Nom", "Catégorie", "Criticité", "Score Sécurité", "Contact", "Fin Contrat", "Statut"];
            const rows = filteredSuppliers.map(s => ([
                s.name,
                s.category,
                s.criticality,
                s.securityScore?.toString() || '0',
                s.contactEmail,
                s.contractEnd ? new Date(s.contractEnd).toLocaleDateString() : '',
                s.status
            ]));
            CsvParser.downloadCSV(headers, rows, `suppliers_export_${new Date().toISOString().split('T')[0]}.csv`);
        } finally {
            setTimeout(() => setIsExportingCSV(false), 0);
        }
    };

    const handleExportDORARegister = async () => {
        if (isExportingDORA) return;
        setIsExportingDORA(true);
        try {
            const headers = ["Nom Fournisseur", "Type Service", "Prestataire TIC", "Fonction Critique", "Criticité DORA", "Localisation Données", "Date Contrat"];
            const rows = filteredSuppliers.filter(s => s.isICTProvider).map(s => ([
                s.name,
                s.serviceType || 'N/A',
                s.isICTProvider ? 'OUI' : 'NON',
                s.supportsCriticalFunction ? 'OUI' : 'NON',
                s.doraCriticality || 'None',
                'UE (Simulé)', // Placeholder as we don't have location field yet
                s.contractEnd ? new Date(s.contractEnd).toLocaleDateString() : ''
            ]));
            CsvParser.downloadCSV(headers, rows, `dora_register_of_information_${new Date().toISOString().split('T')[0]}.csv`);
        } finally {
            setTimeout(() => setIsExportingDORA(false), 0);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!canEdit || !user?.organizationId) return;
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) return;

            const lines = CsvParser.parseCSV(text);
            if (lines.length === 0) { addToast("Fichier vide ou invalide", "error"); return; }

            setIsImporting(true);
            addToast("Import en cours...", "info");
            try {
                const batch = writeBatch(db);
                let count = 0;

                // Only process first 50 rows for safety in batch, or we could chunk it 
                // but let's stick to the simpler logic for now, iterating all parsed objects.
                // The CsvParser returns objects with keys from headers.
                // The previous logic assumed no headers or columns index access.
                // WE MUST ADAPT: If the CSV has headers, CsvParser uses them.
                // If the user's CSV format is fixed columns without headers, existing logic relied on splits.
                // Let's assume the user now provides a CSV with headers OR we map values by index if no headers were expected?
                // Looking at the original code: 
                // "const lines = text.split('\n').slice(1)..." -> Implies there WAS a header row.
                // "const cols = line.split(',');" -> "cols[0]", "cols[1]"...
                // So the CSV structure was: Name, Category, Criticality, ContactName, ContactEmail.

                // With CsvParser.parseCSV, we get an array of objects.
                // We should check if the keys match expected header names OR iterate values if the keys are generic.
                // Since CsvParser uses the first row as headers, the objects will have keys like 'Name', 'Category' etc.
                // IF the CSV truly has those headers. 

                // Let's make it robust: Iterate the objects.
                // If objects have properties, we try to guess or use the values.
                // Since we don't know the EXACT header names the user might use, maybe we just take the first 5 values of each object?
                // OR we can update the template to require headers: Name, Category, Criticality, ContactName, ContactEmail.

                lines.forEach((row: Record<string, string>) => {
                    const values = Object.values(row) as string[];
                    // Fallback to values by index if keys don't match or for flexibility
                    // Name is likely first, Category second...

                    // Actually, let's try to look for specific keys, else fallback to index.
                    const name = row['Nom'] || row['Name'] || values[0] || 'Inconnu';
                    const category = row['Catégorie'] || row['Category'] || values[1] || 'Autre';
                    const criticality = row['Criticité'] || row['Criticality'] || values[2] || 'Moyenne';
                    const contactName = row['Contact'] || row['ContactName'] || values[3] || '';
                    const contactEmail = row['Email'] || row['ContactEmail'] || values[4] || '';

                    if (name) {
                        const newRef = doc(collection(db, 'suppliers'));
                        const newSupplierData: Partial<Supplier> = {
                            organizationId: user.organizationId,
                            name: name.trim(),
                            category: (category.trim() || 'Autre') as Supplier['category'],
                            criticality: (criticality.trim() || 'Moyenne') as Criticality,
                            contactName: contactName.trim(),
                            contactEmail: contactEmail.trim(),
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
                        };
                        batch.set(newRef, sanitizeData(newSupplierData));
                        count++;
                    }
                });
                await batch.commit();
                await logAction(user, 'IMPORT', 'Supplier', `Import CSV de ${count} fournisseurs`);
                addToast(`${count} fournisseurs importés`, "success");
            } catch {
                addToast("Erreur import CSV", "error");
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };





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
        <motion.div
            variants={staggerContainerVariants}
            initial="initial"
            animate="visible"
            className="space-y-8 min-w-0"
        >
            <MasterpieceBackground />
            <SEO
                title="Gestion des Fournisseurs"
                description="Gérez vos fournisseurs, évaluez leur conformité DORA et suivez les contrats."
                keywords="Fournisseurs, DORA, Contrats, Tiers"
            />
            <ConfirmModal
                isOpen={confirmData.isOpen}
                onClose={() => setConfirmData({ ...confirmData, isOpen: false })}
                onConfirm={confirmData.onConfirm}
                title={confirmData.title}
                message={confirmData.message}
                loading={confirmData.loading}
                closeOnConfirm={confirmData.closeOnConfirm}
            />

            <motion.div variants={slideUpVariants}>
                <PageHeader
                    title={suppliersTitle}
                    subtitle={suppliersSubtitle}
                    breadcrumbs={[
                        { label: 'Fournisseurs' }
                    ]}
                    icon={<Handshake className="h-6 w-6 text-white" strokeWidth={2.5} />}
                    actions={canEdit && (
                        <>
                            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                            <Menu as="div" className="relative inline-block text-left">
                                <Menu.Button className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                                    <MoreVertical className="h-5 w-5" />
                                </Menu.Button>
                                <Transition
                                    as={React.Fragment}
                                    enter="transition ease-out duration-100"
                                    enterFrom="transform opacity-0 scale-95"
                                    enterTo="transform opacity-100 scale-100"
                                    leave="transition ease-in duration-75"
                                    leaveFrom="transform opacity-100 scale-100"
                                    leaveTo="transform opacity-0 scale-95"
                                >
                                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 dark:divide-white/10 rounded-xl bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                                        <div className="p-1">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Outils
                                            </div>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={isImporting}
                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50`}
                                                    >
                                                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />}
                                                        Importer CSV
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </div>
                                        <div className="p-1">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                Rapports & Exports
                                            </div>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        onClick={handleExportCSV}
                                                        disabled={isExportingCSV}
                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50`}
                                                    >
                                                        {isExportingCSV ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />}
                                                        Export CSV
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        onClick={handleExportDORARegister}
                                                        disabled={isExportingDORA}
                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50`}
                                                    >
                                                        {isExportingDORA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />}
                                                        Export DORA
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </div>
                                    </Menu.Items>
                                </Transition>
                            </Menu>

                            <CustomTooltip content="Gérer les modèles d'évaluation">
                                <button
                                    onClick={() => setTemplateMode(true)}
                                    className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm"
                                >
                                    <ClipboardList className="h-5 w-5" />
                                </button>
                            </CustomTooltip>

                            <CustomTooltip content="Ajouter un nouveau fournisseur">
                                <button
                                    onClick={() => openCreationDrawer()}
                                    className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">Nouveau Fournisseur</span>
                                </button>
                            </CustomTooltip>
                        </>
                    )}
                />
            </motion.div>

            {/* Dashboard */}
            {/* Dashboard */}
            <motion.div variants={slideUpVariants}>
                <SupplierDashboard
                    suppliers={filteredSuppliers}

                    onFilterChange={(filter) => {
                        if (filter?.type === 'criticality') {
                            // Implement filter logic if needed, currently just visual
                        }
                    }}
                />
            </motion.div>

            <motion.div variants={slideUpVariants} className="mb-6">
                <PremiumPageControl
                    searchQuery={filter}
                    onSearchChange={setFilter}
                    searchPlaceholder="Rechercher un fournisseur..."
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                />
            </motion.div>

            {viewMode === 'list' ? (
                <motion.div variants={slideUpVariants} className="glass-panel rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200 dark:border-white/5">
                    <DataTable
                        columns={columns}
                        data={filteredSuppliers}
                        selectable={true}
                        onBulkDelete={handleBulkDelete}
                        onRowClick={openInspector}
                        searchable={false}
                        loading={loadingSuppliers}
                    />
                </motion.div>
            ) : (
                <motion.div variants={slideUpVariants} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {loadingSuppliers ? (
                        <div className="col-span-full"><CardSkeleton count={3} /></div>
                    ) : filteredSuppliers.length === 0 ? (
                        <div className="col-span-full">
                            <EmptyState
                                icon={Building}
                                title="Aucun fournisseur"
                                description={filter ? "Aucun fournisseur ne correspond à votre recherche." : "Gérez vos fournisseurs et évaluez leur sécurité."}
                                actionLabel={filter || !canEdit ? undefined : "Nouveau Fournisseur"}
                                onAction={filter || !canEdit ? undefined : openCreationDrawer}
                            />
                        </div>
                    ) : (
                        filteredSuppliers.map(supplier => {
                            const linkedDoc = documentsRaw.find(d => d.id === supplier.contractDocumentId);
                            const isExpired = supplier.contractEnd && new Date(supplier.contractEnd) < new Date();

                            return (
                                <div key={supplier.id} onClick={() => openInspector(supplier)} className="glass-panel p-6 rounded-[2.5rem] shadow-sm card-hover cursor-pointer group flex flex-col border border-white/50 dark:border-white/5 relative overflow-hidden h-full">
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                                    <div className="relative z-10 flex flex-col h-full">

                                        <div className="flex justify-between items-start mb-5">
                                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 shadow-inner group-hover:bg-brand-50 dark:group-hover:bg-brand-900/10 group-hover:text-brand-600 transition-colors">
                                                {supplier.category === 'Matériel' ? <Truck className="h-6 w-6" /> : <Building className="h-6 w-6" />}
                                            </div>
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase border shadow-sm ${getCriticalityColor(supplier.criticality || Criticality.MEDIUM)}`}>
                                                {supplier.criticality}
                                            </span>
                                        </div>

                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 leading-tight">{supplier.name}</h3>
                                        <div className="flex flex-wrap gap-2 mb-6">
                                            <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">{supplier.category}</span>
                                            <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wide border ${supplier.status === 'Actif' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20' : 'bg-gray-50 text-slate-600 border-gray-200'}`}>{supplier.status}</span>
                                            {supplier.isICTProvider && (
                                                <span className="px-2.5 py-0.5 bg-indigo-100 dark:bg-slate-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800">DORA ICT</span>
                                            )}
                                        </div>

                                        <div className="mb-6 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                                            <div className="flex justify-between text-xs mb-2">
                                                <span className="text-slate-600 dark:text-slate-400 flex items-center font-bold uppercase tracking-wide"><ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> Sécurité</span>
                                                <span className={`font-black ${getScoreColor(supplier.securityScore || 0).replace('bg-', 'text-')}`}>{supplier.securityScore || 0}/100</span>
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                                <div className={`h-2 rounded-full transition-all duration-500 ${getScoreColor(supplier.securityScore || 0)}`} style={{ width: `${supplier.securityScore || 0}%` }}></div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t border-dashed border-gray-200 dark:border-white/10 mt-auto">
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex items-center font-medium text-slate-600 dark:text-slate-300">
                                                    <Handshake className="h-3.5 w-3.5 mr-2 text-slate-500" /> {supplier.contactName || 'Non spécifié'}
                                                </div>
                                                {supplier.contractEnd && (
                                                    <div className={`flex items-center font-bold ${isExpired ? 'text-red-500' : 'text-slate-500'}`}>
                                                        <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                                                        {new Date(supplier.contractEnd).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center text-xs font-medium text-slate-600 dark:text-slate-300">
                                                <FileText className="h-3.5 w-3.5 mr-2 text-slate-500" />
                                                {linkedDoc ? (
                                                    <span className="text-brand-600 truncate max-w-[180px] hover:underline">{linkedDoc.title}</span>
                                                ) : <span className="text-slate-500 italic">Aucun contrat lié</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </motion.div>
            )
            }

            {/* Inspector Drawer */}
            < Drawer
                isOpen={!!selectedSupplier}
                onClose={() => setSelectedSupplier(null)}
                title={selectedSupplier?.name || ''}
                subtitle={selectedSupplier ? `${selectedSupplier.category} • ${selectedSupplier.status}` : ''}
                width="max-w-6xl"
                breadcrumbs={getBreadcrumbs()}
                actions={
                    <div className="flex gap-2">
                        {canEdit && !isEditing && (
                            <CustomTooltip content="Modifier le fournisseur">
                                <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                            </CustomTooltip>
                        )}
                        {canEdit && isEditing && (
                            <CustomTooltip content="Enregistrer les modifications">
                                <button onClick={editForm.handleSubmit(handleUpdate)} className="p-2.5 text-brand-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Save className="h-5 w-5" /></button>
                            </CustomTooltip>
                        )}
                        {canEdit && (
                            <CustomTooltip content="Supprimer le fournisseur">
                                <button onClick={() => initiateDelete(selectedSupplier!.id, selectedSupplier!.name)} className="p-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                            </CustomTooltip>
                        )}
                    </div>
                }
            >
                {selectedSupplier && (
                    <>
                        <div className="px-4 md:px-8 border-b border-gray-100 dark:border-white/5 bg-white/30 dark:bg-white/5">
                            <ScrollableTabs
                                tabs={[
                                    { id: 'profile', label: 'Profil', icon: Building },
                                    { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
                                    { id: 'assessment', label: 'Évaluation Sécurité', icon: ClipboardList },
                                    { id: 'history', label: 'Historique', icon: History },
                                    { id: 'comments', label: 'Discussion', icon: MessageSquare },
                                ]}
                                activeTab={inspectorTab}
                                onTabChange={(id) => setInspectorTab(id as typeof inspectorTab)}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
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
                                            isLoading={isSubmitting}
                                        />
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                                <div className="p-5 bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1 tracking-wide">Criticité</span>
                                                    <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase border ${getCriticalityColor(selectedSupplier.criticality || Criticality.MEDIUM)}`}>{selectedSupplier.criticality}</span>
                                                </div>
                                                <div className="p-5 bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1 tracking-wide">Score Sécurité</span>
                                                    <span className={`font-bold text-xl ${selectedSupplier.securityScore! >= 50 ? 'text-emerald-500' : 'text-red-500'}`}>{selectedSupplier.securityScore}/100</span>
                                                </div>
                                            </div>
                                            <div className="p-6 bg-white dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-4">Contact</h4>
                                                <div className="flex items-center mb-3 text-sm font-medium text-slate-900 dark:text-white"><Handshake className="h-4 w-4 mr-3 text-slate-500" /> {selectedSupplier.contactName}</div>
                                                <div className="flex items-center text-sm font-medium text-slate-900 dark:text-white"><Mail className="h-4 w-4 mr-3 text-slate-500" /> {selectedSupplier.contactEmail}</div>
                                            </div>
                                            <div className="p-6 bg-blue-50/80 dark:bg-slate-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
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
                                                    <CustomTooltip content="Visualiser le contrat signé">
                                                        <a href={documentsRaw.find(d => d.id === selectedSupplier.contractDocumentId)?.url} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-sm hover:text-brand-600 flex items-center justify-center transition-all w-full border border-blue-200 dark:border-blue-900/30">
                                                            <Link className="h-3 w-3 mr-2" /> Ouvrir le contrat
                                                        </a>
                                                    </CustomTooltip>
                                                ) : <span className="text-xs text-blue-400 font-medium italic text-center block">Aucun document lié</span>}
                                            </div>

                                            {selectedSupplier.isICTProvider && (
                                                <div className="p-6 bg-indigo-50/80 dark:bg-slate-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 shadow-sm">
                                                    <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4 flex items-center">
                                                        <ShieldAlert className="h-4 w-4 mr-2" /> DORA Status
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <span className="block text-xs text-slate-600 mb-1">Type Service</span>

                                                            <span className="font-bold text-slate-900 dark:text-white">{selectedSupplier.serviceType || 'N/A'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-xs text-slate-600 mb-1">Fonction Critique</span>
                                                            <span className={`font-bold ${selectedSupplier.supportsCriticalFunction ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                                                                {selectedSupplier.supportsCriticalFunction ? 'OUI' : 'NON'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-xs text-slate-600 mb-1">Criticité DORA</span>
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
                                                                    <span className="text-xs text-slate-600">RTO: {process.rto}</span>
                                                                </div>
                                                            ) : null;
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Linked Assets */}
                                            <div className="p-6 bg-slate-50/80 dark:bg-slate-800/30 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm mt-6">
                                                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-4 flex items-center">
                                                    <Server className="h-4 w-4 mr-2" /> Actifs Fournis ({assetsRaw.filter(a => a.supplierId === selectedSupplier.id || selectedSupplier.relatedAssetIds?.includes(a.id)).length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {assetsRaw.filter(a => a.supplierId === selectedSupplier.id || selectedSupplier.relatedAssetIds?.includes(a.id)).map(asset => (
                                                        <div key={asset.id} className="flex items-center justify-between text-sm p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-white/5">
                                                            <span className="font-medium text-slate-700 dark:text-slate-300">{asset.name}</span>
                                                            <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600">{asset.type}</span>
                                                        </div>
                                                    ))}
                                                    {assetsRaw.filter(a => a.supplierId === selectedSupplier.id || selectedSupplier.relatedAssetIds?.includes(a.id)).length === 0 && (
                                                        <p className="text-sm text-slate-500 italic">Aucun actif associé.</p>
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
                                                        <p className="text-sm text-slate-500 italic">Aucun risque associé.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Linked Projects */}
                                            <div className="p-6 bg-blue-50/50 dark:bg-slate-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm mt-6">
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
                                                        <p className="text-sm text-slate-500 italic">Aucun projet associé.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div >
                            )}

                            {inspectorTab === 'intelligence' && (
                                <div className="h-full overflow-y-auto p-6">
                                    <SupplierAIAssistant
                                        supplier={selectedSupplier}
                                        onUpdate={(updates) => handleUpdate(updates as unknown as SupplierFormData)}
                                    />
                                </div>
                            )}

                            {
                                inspectorTab === 'assessment' && (
                                    <div className="space-y-6">
                                        <div className="bg-white dark:bg-slate-800/50 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                            <div className="flex items-center justify-between mb-6">
                                                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center uppercase tracking-wide">
                                                    <ShieldAlert className="h-4 w-4 mr-2 text-brand-500" /> Profil de Risque
                                                </h3>
                                                <div className={`text-2xl font-black ${editForm.watch('securityScore')! >= 80 ? 'text-emerald-500' : editForm.watch('securityScore')! >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                                    {editForm.watch('securityScore')}/100
                                                </div>
                                            </div>

                                            {/* List of Assessments */}
                                            <div className="mb-8">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Évaluations Réalisées</h4>
                                                <div className="space-y-3">
                                                    {assessments.filter(a => a.supplierId === selectedSupplier.id).map(a => (
                                                        <div key={a.id} onClick={() => setAssessmentMode(a.id)} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group">
                                                            <div className="flex items-center">
                                                                <FileText className="h-4 w-4 text-slate-400 mr-3" />
                                                                <div>
                                                                    <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">{templates.find(t => t.id === a.templateId)?.title || 'Questionnaire'}</div>
                                                                    <div className="text-xs text-slate-500">{new Date(a.updatedAt || a.sentDate).toLocaleDateString()} • {a.status}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${a.overallScore >= 80 ? 'bg-green-100 text-green-700' : a.overallScore >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {a.overallScore}%
                                                                </span>
                                                                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-brand-500" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {assessments.filter(a => a.supplierId === selectedSupplier.id).length === 0 && (
                                                        <p className="text-sm text-slate-500 italic">Aucune évaluation passée.</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Start New Assessment */}
                                            {canEdit && (
                                                <div className="mb-8">
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Lancer une nouvelle évaluation</h4>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {templates.map(tpl => (
                                                            <button
                                                                key={tpl.id}
                                                                onClick={() => startAssessment(selectedSupplier, tpl.id)}
                                                                className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-brand-100 dark:border-brand-900/30 rounded-xl hover:ring-2 hover:ring-brand-500 transition-all text-left group"
                                                            >
                                                                <div className="flex items-center">
                                                                    <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg text-brand-600 mr-3 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                                                                        <Plus className="h-4 w-4" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-bold text-slate-900 dark:text-white text-sm">{tpl.title}</div>
                                                                        <div className="text-xs text-slate-500">{tpl.sections.length} sections</div>
                                                                    </div>
                                                                </div>
                                                                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-brand-500" />
                                                            </button>
                                                        ))}
                                                        {templates.length === 0 && (
                                                            <p className="text-sm text-slate-500 italic">Aucun modèle de questionnaire disponible. Créez-en un dans l'onglet Modèles.</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

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
                                                <p className="text-sm text-slate-600 italic text-center py-4">Mode lecture seule. Contactez un administrateur pour modifier.</p>
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
                                        {supplierHistory.length === 0 ? <p className="text-sm text-slate-600 pl-6">Aucun historique récent.</p> :
                                            supplierHistory.map((log, i) => (
                                                <div key={i} className="relative">
                                                    <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-brand-100 dark:border-brand-900">
                                                        <div className="h-2 w-2 rounded-full bg-brand-600"></div>
                                                    </span>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{new Date(log.timestamp).toLocaleString()}</span>
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{log.action}</p>
                                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{log.details}</p>
                                                        <p className="text-[10px] text-slate-500 mt-1">Par: {log.userEmail}</p>
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
        </motion.div>
    );
};
