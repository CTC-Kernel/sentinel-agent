import React, { useDeferredValue, useEffect, useMemo, useState, useRef } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { SEO } from '../components/SEO';
import { canEditResource } from '../utils/permissions';

import { Supplier, Criticality, UserProfile } from '../types';
import { Plus, Building, Trash2, Handshake, Truck, ShieldAlert, FileSpreadsheet, ClipboardList, Upload, Loader2, MoreVertical, MessageSquare } from '../components/ui/Icons';
import { PremiumPageControl } from '../components/ui/PremiumPageControl';
import { useStore } from '../store';
import { useSuppliers } from '../hooks/useSuppliers';
import { useSuppliersData } from '../hooks/suppliers/useSuppliersData';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CardSkeleton } from '../components/ui/Skeleton';
import { DataTable } from '../components/ui/DataTable';
import { motion } from 'framer-motion';
import { slideUpVariants, staggerContainerVariants } from '../components/ui/animationVariants';
import { ColumnDef } from '@tanstack/react-table';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorLogger } from '../services/errorLogger';
import { useLocation } from 'react-router-dom';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supplierSchema, SupplierFormData } from '../schemas/supplierSchema';
import { Drawer } from '../components/ui/Drawer';
import { SupplierForm } from '../components/suppliers/SupplierForm';
import { usePersistedState } from '../hooks/usePersistedState';
import { SupplierDashboard } from '../components/suppliers/SupplierDashboard';
import { Tooltip as CustomTooltip } from '../components/ui/Tooltip';
import { MasterpieceBackground } from '../components/ui/MasterpieceBackground';
import { CsvParser } from '../utils/csvUtils';
import { QuestionnaireBuilder } from '../components/suppliers/QuestionnaireBuilder';
import { AssessmentView } from '../components/suppliers/AssessmentView';

import { SupplierService } from '../services/SupplierService';
import { ResourceHistory } from '../components/shared/ResourceHistory';
import { CommentSection } from '../components/collaboration/CommentSection';

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
    const { user, addToast, t } = useStore();
    const location = useLocation();
    const canEdit = canEditResource(user, 'Supplier');
    const [viewMode, setViewMode] = usePersistedState<'grid' | 'list' | 'matrix' | 'kanban'>('suppliers_view_mode', 'grid');

    const [creationMode, setCreationMode] = useState(false);
    const [templateMode, setTemplateMode] = useState(false);
    const [assessmentMode, setAssessmentMode] = useState<string | null>(null); // responseId

    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [isExportingDORA, setIsExportingDORA] = useState(false);

    // Inspector State
    const [inspectorTab, setInspectorTab] = useState<'profile' | 'assessment' | 'incidents' | 'history' | 'comments' | 'intelligence'>('profile');

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

    // Data Hooks
    const { suppliers: suppliersRaw, loading: loadingSuppliers, addSupplier, updateSupplier, deleteSupplier, importSuppliers, checkDependencies } = useSuppliers();

    const {
        usersRaw,
        documentsRaw,
        processesRaw,
        assetsRaw,
        risksRaw,
        templates,
        loading: loadingData
    } = useSuppliersData(user?.organizationId);


    // FIX: Ensure usersList is never empty if logged in
    const effectiveUsers = useMemo(() => {
        if (usersRaw && usersRaw.length > 0) return usersRaw;
        if (user && user.uid) return [user as UserProfile];
        return [];
    }, [usersRaw, user]);


    const selectedOwnerId = editForm.watch('ownerId');

    useEffect(() => {
        if (selectedOwnerId) {
            const selectedUser = usersRaw.find(u => u.displayName === selectedOwnerId || u.uid === selectedOwnerId); // Enhanced check
            if (selectedUser) editForm.setValue('owner', selectedUser.displayName || '');
        }
    }, [selectedOwnerId, usersRaw, editForm]);


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

    let suppliersTitle = t('suppliers.title');
    let suppliersSubtitle = t('suppliers.subtitle');

    if (role === 'admin' || role === 'rssi') {
        suppliersTitle = t('suppliers.title_admin');
        suppliersSubtitle = t('suppliers.subtitle_admin');
    } else if (role === 'direction') {
        suppliersTitle = t('suppliers.title_exec');
        suppliersSubtitle = t('suppliers.subtitle_exec');
    } else if (role === 'auditor') {
        suppliersTitle = t('suppliers.title_audit');
        suppliersSubtitle = t('suppliers.subtitle_audit');
    } else if (role === 'project_manager') {
        suppliersTitle = t('suppliers.title_project');
        suppliersSubtitle = t('suppliers.subtitle_project');
    } else {
        suppliersTitle = t('suppliers.title_user');
        suppliersSubtitle = t('suppliers.subtitle_user');
    }

    // Hook Definitions
    const handleDelete = React.useCallback(async (id: string, name: string) => {
        setConfirmData(prev => ({ ...prev, loading: true }));
        try {
            await deleteSupplier(id, name);
            if (selectedSupplier?.id === id) setSelectedSupplier(null);
            setConfirmData(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            ErrorLogger.warn('Delete handled in hook', 'Suppliers.handleDelete', { metadata: { error } });
        } finally {
            setConfirmData(prev => ({ ...prev, loading: false }));
        }
    }, [deleteSupplier, selectedSupplier]);

    const initiateDelete = React.useCallback(async (id: string, name: string) => {
        if (!canEdit) return;

        // Check dependencies
        let message = t('suppliers.deleteMessage');
        try {
            const deps = await checkDependencies(id);
            if (deps.controls > 0 || deps.risks > 0) {
                message = t('suppliers.deleteWarning', { details: deps.details });
            }
        } catch (e) {
            ErrorLogger.warn('Dependency check error', 'Suppliers.initiateDelete', { metadata: { error: e } });
        }

        setConfirmData({
            isOpen: true,
            title: t('suppliers.deleteTitle', { name }),
            message: message,
            onConfirm: () => handleDelete(id, name),
            closeOnConfirm: false
        });
    }, [canEdit, handleDelete, user?.organizationId, t]);

    const deferredFilter = useDeferredValue(filter);
    const filteredSuppliers = useMemo(() => {
        const needle = (deferredFilter || '').toLowerCase().trim();
        if (!needle) return suppliers;
        return suppliers.filter(s => s.name.toLowerCase().includes(needle));
    }, [suppliers, deferredFilter]);

    const columns = React.useMemo<ColumnDef<Supplier>[]>(() => [
        {
            accessorKey: 'name',
            header: t('common.name'),
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
            header: t('common.category'),
            cell: ({ row }) => (
                <span className="px-2.5 py-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300">
                    {row.original.category}
                </span>
            )
        },
        {
            accessorKey: 'criticality',
            header: t('common.criticality'),
            cell: ({ row }) => (
                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase border ${getCriticalityColor(row.original.criticality || Criticality.MEDIUM)}`}>
                    {row.original.criticality}
                </span>
            )
        },
        {
            accessorKey: 'securityScore',
            header: t('suppliers.cards.security'),
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
            header: t('suppliers.cards.contact'),
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{row.original.contactName || '-'}</span>
                    <span className="text-[10px] text-slate-500">{row.original.contactEmail}</span>
                </div>
            )
        },
        {
            accessorKey: 'contractEnd',
            header: t('suppliers.cards.contract'),
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
            header: t('common.status'),
            cell: ({ row }) => (
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border ${row.original.status === 'Actif' ? 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20' : 'bg-gray-50 text-slate-600 border-gray-200'}`}>
                    {row.original.status}
                </span>
            )
        },
        {
            id: 'actions',
            cell: ({ row }) => (
                <div className="text-right flex justify-end items-center space-x-1 hover:cursor-default" onClick={e => e.stopPropagation()}>
                    {canEdit && (
                        <CustomTooltip content="Supprimer le fournisseur">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    initiateDelete(row.original.id, row.original.name);
                                }}
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 transform scale-90 hover:scale-100"
                                aria-label={`Delete supplier ${row.original.name}`}
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </CustomTooltip>
                    )}
                </div>
            )
        }
    ], [canEdit, initiateDelete, t]);

    // Import
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; loading?: boolean; closeOnConfirm?: boolean }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;

        if (loadingSuppliers || loadingData || suppliers.length === 0) return;
        const supplier = suppliers.find(s => s.id === state.voxelSelectedId);
        if (supplier) {
            setSelectedSupplier(supplier);
            setInspectorTab('profile');
        }
    }, [location.state, loadingSuppliers, loadingData, suppliers]);

    // Logic to start assessment
    const startAssessment = async (supplier: Supplier, templateId: string) => {
        if (!templateId || !user?.organizationId) return;
        try {
            const tpl = templates.find(t => t.id === templateId);
            if (!tpl) return;
            const resId = await SupplierService.createAssessment(user.organizationId, supplier.id, supplier.name, tpl);
            setAssessmentMode(resId);
            addToast('Évaluation démarrée', 'success');
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Suppliers.startAssessment');
        }
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
                    <button aria-label="Retour au tableau de bord" onClick={() => setTemplateMode(false)} className="text-slate-500 hover:text-slate-700 mr-4 transition-colors" title="Retour au tableau de bord">Retour</button>
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
    };

    const openCreationDrawer = () => {
        setCreationMode(true);
        setSelectedSupplier(null);
    };


    const handleCreate: SubmitHandler<SupplierFormData> = async (data) => {
        if (!canEdit || !user?.organizationId) return;
        setIsSubmitting(true);
        try {
            await addSupplier(data);
            setCreationMode(false);
        } catch (error) {
            ErrorLogger.warn('Creation handled in hook', 'Suppliers.handleCreate', { metadata: { error } });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate: SubmitHandler<SupplierFormData> = async (data) => {
        if (!canEdit || !selectedSupplier) return;
        setIsSubmitting(true);
        try {
            await updateSupplier(selectedSupplier.id, data);
            setSelectedSupplier(prev => prev ? { ...prev, ...data } : null);
        } catch (error) {
            ErrorLogger.warn('Update handled in hook', 'Suppliers.handleUpdate', { metadata: { error } });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBulkDelete = async (selectedIds: string[]) => {
        if (!canEdit) return;
        if (!window.confirm(t('suppliers.deleteBulk', { count: selectedIds.length }))) return;

        try {
            await Promise.all(selectedIds.map(id => deleteSupplier(id)));
            setSelectedSupplier(null);
        } catch (error) {
            ErrorLogger.warn('Bulk delete handled in hook', 'Suppliers.handleBulkDelete', { metadata: { error } });
        }
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
            setIsImporting(true);
            try {
                await importSuppliers(text);
            } catch (error) {
                ErrorLogger.warn('Import handled in hook', 'Suppliers.handleFileUpload', { metadata: { error } });
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
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
                title={t('suppliers.title')}
                description={t('suppliers.subtitle')}
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
                        { label: t('suppliers.title') }
                    ]}
                    icon={<Handshake className="h-6 w-6 text-white" strokeWidth={2.5} />}
                    actions={canEdit && (
                        <>
                            <input aria-label={t('common.import')} type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                            <Menu as="div" className="relative inline-block text-left">
                                <Menu.Button aria-label={t('common.more')} className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
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
                                                {t('suppliers.tools')}
                                            </div>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={isImporting}
                                                        className={`${active ? 'bg-brand-500 text-white hover:bg-brand-600' : 'text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50 transition-colors`}
                                                        aria-label="Import Suppliers CSV"
                                                    >
                                                        {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />}
                                                        {t('suppliers.importCsv')}
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </div>
                                        <div className="p-1">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                {t('suppliers.reports')}
                                            </div>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        aria-label={t('suppliers.exportCsv')}
                                                        onClick={handleExportCSV}
                                                        disabled={isExportingCSV}
                                                        className={`${active ? 'bg-brand-500 text-white' : 'text-slate-900 dark:text-slate-200'
                                                            } group flex w-full items-center rounded-lg px-2 py-2 text-sm disabled:opacity-50`}
                                                    >
                                                        {isExportingCSV ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className={`mr-2 h-4 w-4 ${active ? 'text-white' : 'text-slate-500'}`} />}
                                                        {t('suppliers.exportCsv')}
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        aria-label="Export DORA"
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
                                    aria-label="Gérer les modèles d'évaluation"
                                    onClick={() => setTemplateMode(true)}
                                    className="p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm"
                                >
                                    <ClipboardList className="h-5 w-5" />
                                </button>
                            </CustomTooltip>

                            <CustomTooltip content="Ajouter un nouveau fournisseur">
                                <button
                                    aria-label={t('suppliers.newSupplier')}
                                    onClick={() => openCreationDrawer()}
                                    className="flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    <span className="hidden sm:inline">{t('suppliers.newSupplier')}</span>
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
                    searchPlaceholder={t('suppliers.searchPlaceholder')}
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
                                title={t('suppliers.emptyTitle')}
                                description={filter ? "Aucun fournisseur trouvé." : t('suppliers.emptyDesc')}
                                actionLabel={filter || !canEdit ? undefined : t('suppliers.newSupplier')}
                                onAction={filter || !canEdit ? undefined : openCreationDrawer}
                            />
                        </div>
                    ) : (
                        filteredSuppliers.map(supplier => {
                            const isExpired = supplier.contractEnd && new Date(supplier.contractEnd) < new Date();

                            return (
                                <div key={supplier.id} onClick={() => openInspector(supplier)} className="glass-panel p-6 rounded-[2.5rem] shadow-sm card-hover cursor-pointer group flex flex-col border border-white/50 dark:border-white/5 relative overflow-hidden h-full hover:border-brand-500 dark:hover:border-brand-400 transition-colors">
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
                                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-4">
                                                <div className={`h-1.5 rounded-full ${getScoreColor(supplier.securityScore || 0)} transition-all duration-1000`} style={{ width: `${supplier.securityScore || 0}%` }}></div>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-slate-500 dark:text-slate-400">Contrat</span>
                                                {supplier.contractEnd ? (
                                                    <span className={`font-medium ${isExpired ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>{new Date(supplier.contractEnd).toLocaleDateString()}</span>
                                                ) : <span className="text-slate-400">-</span>}
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center">
                                                {supplier.contactName && <span className="font-medium mr-1">{supplier.contactName}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </motion.div>
            )}

            {/* Creation Drawer */}
            <Drawer
                isOpen={creationMode}
                onClose={() => setCreationMode(false)}
                title={t('suppliers.newSupplier')}
                subtitle="Ajouter un nouveau tiers"
                width="max-w-4xl"
            >
                <div className="p-6">
                    <SupplierForm
                        onSubmit={handleCreate}
                        onCancel={() => setCreationMode(false)}
                        isLoading={isSubmitting}
                        users={effectiveUsers}
                        processes={processesRaw}
                        assets={assetsRaw}
                        risks={risksRaw}
                        documents={documentsRaw}
                    />
                </div>
            </Drawer>

            {/* Edit Drawer */}
            <Drawer
                isOpen={!!selectedSupplier}
                onClose={() => setSelectedSupplier(null)}
                title={selectedSupplier?.name || ''}
                subtitle="Détails du fournisseur"
                width="max-w-4xl"
                actions={
                    <div className="flex items-center gap-2">
                        {selectedSupplier && (
                            <CustomTooltip content="Démarrer une évaluation">
                                <button
                                    aria-label="Démarrer une évaluation"
                                    onClick={() => {
                                        // Auto-select first template or open selector? 
                                        // For now just demo one
                                        if (templates.length > 0) startAssessment(selectedSupplier, templates[0].id);
                                        else addToast('Aucun modèle disponible', 'error');
                                    }}
                                    className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                >
                                    <ClipboardList className="h-5 w-5" />
                                </button>
                            </CustomTooltip>
                        )}
                        <button
                            aria-label="Discussion"
                            onClick={() => setInspectorTab('comments')}
                            className={`p-2 rounded-lg transition-colors ${inspectorTab === 'comments' ? 'bg-brand-50 text-brand-600' : 'text-slate-500 hover:bg-slate-100'}`}
                        >
                            <MessageSquare className="h-5 w-5" />
                        </button>
                    </div>
                }
            >
                {selectedSupplier && (
                    <div className="h-full flex flex-col">
                        {/* Tabs */}
                        <div className="flex items-center space-x-1 px-6 border-b border-slate-100 dark:border-white/5 overflow-x-auto custom-scrollbar">
                            {[
                                { id: 'profile', label: 'Profil', icon: Building },
                                { id: 'history', label: 'Historique', icon: FileSpreadsheet }, // Using FileSpreadsheet as generic history/log icon for now or Clock if avail
                                { id: 'comments', label: 'Commentaires', icon: MessageSquare }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    aria-label={tab.label}
                                    onClick={() => setInspectorTab(tab.id as any)}
                                    className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${inspectorTab === tab.id
                                        ? 'border-brand-500 text-brand-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                        }`}
                                >
                                    <tab.icon className="h-4 w-4 mr-2" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-hidden relative">
                            {inspectorTab === 'profile' && (
                                <SupplierForm
                                    initialData={selectedSupplier}
                                    onSubmit={handleUpdate}
                                    onCancel={() => setSelectedSupplier(null)}
                                    isLoading={isSubmitting}
                                    users={effectiveUsers}
                                    processes={processesRaw}
                                    assets={assetsRaw}
                                    risks={risksRaw}
                                    documents={documentsRaw}
                                    isEditing={true} // It is editing mode here
                                />
                            )}
                            {inspectorTab === 'assessment' && (
                                <div className="p-6 h-full overflow-y-auto">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-bold text-lg">Évaluations</h3>
                                        <button
                                            aria-label="Nouvelle Évaluation"
                                            onClick={() => templates.length > 0 && startAssessment(selectedSupplier, templates[0].id)}
                                            className="px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700"
                                        >
                                            Nouvelle Évaluation
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {/* List assessments for this supplier */}
                                        <EmptyState
                                            icon={ClipboardList}
                                            title="Aucune évaluation"
                                            description="Lancez une évaluation pour ce fournisseur."
                                        />
                                    </div>
                                </div>
                            )}
                            {inspectorTab === 'history' && (
                                <div className="p-6 h-full overflow-y-auto">
                                    <ResourceHistory resourceId={selectedSupplier.id} resourceType="suppliers" />
                                </div>
                            )}
                            {inspectorTab === 'comments' && (
                                <div className="p-6 h-full overflow-y-auto">
                                    <CommentSection collectionName="suppliers" documentId={selectedSupplier.id} />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Drawer>
        </motion.div>
    );
};


