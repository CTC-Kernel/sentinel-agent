import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm, SubmitHandler, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { documentSchema, DocumentFormData } from '../schemas/documentSchema';
import { createPortal } from 'react-dom';
import { collection, addDoc, getDocs, query, deleteDoc, doc, updateDoc, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Document, UserProfile, SystemLog, Control, Asset, Audit } from '../types';
import { canEditResource } from '../utils/permissions';
import { Plus, Search, File, ExternalLink, Trash2, Link as LinkIcon, Edit, Users, Bell, FileText, X, History, MessageSquare, Save, Eye, FileSpreadsheet, ShieldCheck, CheckCircle2, CalendarDays } from '../components/ui/Icons';
import { useStore } from '../store';
import { logAction } from '../services/logger';
import { sendEmail } from '../services/emailService';
import { getDocumentReviewTemplate } from '../services/emailTemplates';
import { generateICS } from '../utils/calendar';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Comments } from '../components/ui/Comments';
import { CardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { FileUploader } from '../components/ui/FileUploader';
import { FilePreview } from '../components/ui/FilePreview';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorLogger } from '../services/errorLogger';

import { useFirestoreCollection } from '../hooks/useFirestore';

export const Documents: React.FC = () => {
    const { user, addToast } = useStore();
    const location = useLocation();
    const canCreate = canEditResource(user, 'Document');

    // Data Fetching with Hooks
    const { data: rawDocuments, loading: loadingDocuments } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    const { data: usersList, loading: loadingUsers } = useFirestoreCollection<UserProfile>(
        'users',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    const { data: rawControls, loading: loadingControls } = useFirestoreCollection<Control>(
        'controls',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    const { data: rawAssets, loading: loadingAssets } = useFirestoreCollection<Asset>(
        'assets',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    const { data: rawAudits, loading: loadingAudits } = useFirestoreCollection<Audit>(
        'audits',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true }
    );

    // Derived State
    const documents = React.useMemo(() => [...rawDocuments].sort((a, b) => a.title.localeCompare(b.title)), [rawDocuments]);
    const controls = React.useMemo(() => [...rawControls].sort((a, b) => a.code.localeCompare(b.code)), [rawControls]);
    const assets = React.useMemo(() => [...rawAssets].sort((a, b) => a.name.localeCompare(b.name)), [rawAssets]);
    const audits = React.useMemo(() => [...rawAudits].sort((a, b) => new Date(b.dateScheduled).getTime() - new Date(a.dateScheduled).getTime()), [rawAudits]);

    const loading = loadingDocuments || loadingUsers || loadingControls || loadingAssets || loadingAudits;

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [filter, setFilter] = useState('');

    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [inspectorTab, setInspectorTab] = useState<'details' | 'history' | 'comments'>('details');
    const [docHistory, setDocHistory] = useState<SystemLog[]>([]);

    useEffect(() => {
        const state = (location.state || {}) as { fromVoxel?: boolean; voxelSelectedId?: string; voxelSelectedType?: string };
        if (!state.fromVoxel || !state.voxelSelectedId) return;
        if (loading || documents.length === 0) return;
        const doc = documents.find(d => d.id === state.voxelSelectedId);
        if (doc && selectedDocument?.id !== doc.id) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedDocument(doc);
        }
    }, [location.state, loading, documents, selectedDocument]);

    const [isEditing, setIsEditing] = useState(false);

    const createForm = useForm<DocumentFormData>({
        resolver: zodResolver(documentSchema),
        defaultValues: {
            title: '', type: 'Politique', version: '1.0', status: 'Brouillon', workflowStatus: 'Draft',
            owner: user?.displayName || '', ownerId: user?.uid || '', nextReviewDate: '', readBy: [], reviewers: [], approvers: [],
            relatedControlIds: [], relatedAssetIds: [], relatedAuditIds: []
        }
    });

    const editForm = useForm<DocumentFormData>({
        resolver: zodResolver(documentSchema),
        defaultValues: {
            title: '', type: 'Politique', version: '1.0', status: 'Brouillon', workflowStatus: 'Draft',
            owner: '', ownerId: '', nextReviewDate: '', readBy: [], reviewers: [], approvers: [],
            relatedControlIds: [], relatedAssetIds: [], relatedAuditIds: []
        }
    });
    const [uploadedFileUrl, setUploadedFileUrl] = useState<string>('');
    const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

    // Watch ownerId to update owner name
    const createOwnerId = useWatch({ control: createForm.control, name: 'ownerId' });
    useEffect(() => {
        const u = usersList.find(u => u.uid === createOwnerId);
        if (u) createForm.setValue('owner', u.displayName);
    }, [createOwnerId, usersList, createForm]);

    const editOwnerId = useWatch({ control: editForm.control, name: 'ownerId' });
    useEffect(() => {
        const u = usersList.find(u => u.uid === editOwnerId);
        if (u) editForm.setValue('owner', u.displayName);
    }, [editOwnerId, usersList, editForm]);

    // Confirm Dialog
    const [confirmData, setConfirmData] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false, title: '', message: '', onConfirm: () => { }
    });

    const openInspector = async (docItem: Document) => {
        setSelectedDocument(docItem);
        setInspectorTab('details');
        editForm.reset({
            title: docItem.title,
            type: docItem.type,
            version: docItem.version,
            status: docItem.status,
            workflowStatus: docItem.workflowStatus,
            owner: docItem.owner,
            ownerId: docItem.ownerId,
            nextReviewDate: docItem.nextReviewDate,
            readBy: docItem.readBy || [],
            reviewers: docItem.reviewers || [],
            approvers: docItem.approvers || [],
            relatedControlIds: docItem.relatedControlIds || [],
            relatedAssetIds: docItem.relatedAssetIds || [],
            relatedAuditIds: docItem.relatedAuditIds || [],
            url: docItem.url
        });
        setIsEditing(false);

        try {
            // Limit history fetch to avoid heavy reads
            const q = query(collection(db, 'system_logs'), where('organizationId', '==', user?.organizationId), limit(50));
            const snap = await getDocs(q);
            const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemLog));

            // Filter and sort client side
            const relevantLogs = logs.filter(l => l.resource === 'Document' && l.details?.includes(docItem.title));
            relevantLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setDocHistory(relevantLogs);
        } catch (e) { ErrorLogger.handleErrorWithToast(e, 'Documents.handleSelectDocument'); }
    };

    const handleFileUploadComplete = (url: string, fileName: string) => {
        setUploadedFileUrl(url);
        addToast(`Fichier ${fileName} téléversé avec succès`, 'success');
    };

    const handleWorkflowAction = async (action: 'submit' | 'approve' | 'reject' | 'sign') => {
        if (!selectedDocument || !user) return;
        let updates: Partial<Document> = {};
        let logMsg = '';

        if (action === 'submit') {
            updates = { status: 'En revue', workflowStatus: 'Review' };
            logMsg = 'Document soumis pour revue';
        } else if (action === 'approve') {
            updates = { status: 'Approuvé', workflowStatus: 'Approved' };
            logMsg = 'Document approuvé';
        } else if (action === 'reject') {
            updates = { status: 'Rejeté', workflowStatus: 'Rejected' };
            logMsg = 'Document rejeté';
        } else if (action === 'sign') {
            const newSignature = { userId: user.uid, date: new Date().toISOString(), role: user.role };
            const currentSignatures = selectedDocument.signatures || [];
            updates = {
                status: 'Publié',
                workflowStatus: 'Approved',
                signatures: [...currentSignatures, newSignature]
            };
            logMsg = 'Document signé et publié';
        }

        try {
            await updateDoc(doc(db, 'documents', selectedDocument.id), { ...updates, updatedAt: new Date().toISOString() });
            await logAction(user, 'WORKFLOW', 'Document', `${logMsg}: ${selectedDocument.title}`);

            await logAction(user, 'WORKFLOW', 'Document', `${logMsg}: ${selectedDocument.title}`);
            setSelectedDocument({ ...selectedDocument, ...updates });
            addToast(logMsg, "success");
        } catch (error) {
            ErrorLogger.error(error, 'Documents.handleWorkflowAction');
            addToast("Erreur workflow", "error");
        }
    };

    const handleCreate: SubmitHandler<DocumentFormData> = async (data) => {
        if (!user?.organizationId) return;

        try {
            await addDoc(collection(db, 'documents'), {
                ...data,
                url: uploadedFileUrl || '',
                organizationId: user.organizationId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            await logAction(user, 'CREATE', 'Document', `Nouveau document: ${data.title}`);
            addToast("Document ajouté", "success");
            setShowCreateModal(false);
            setUploadedFileUrl('');
            createForm.reset({
                title: '', type: 'Politique', version: '1.0', status: 'Brouillon', workflowStatus: 'Draft',
                owner: user?.displayName || '', ownerId: user?.uid || '', nextReviewDate: '', readBy: [], reviewers: [], approvers: [],
                relatedControlIds: [], relatedAssetIds: [], relatedAuditIds: []
            });
            createForm.reset({
                title: '', type: 'Politique', version: '1.0', status: 'Brouillon', workflowStatus: 'Draft',
                owner: user?.displayName || '', ownerId: user?.uid || '', nextReviewDate: '', readBy: [], reviewers: [], approvers: [],
                relatedControlIds: [], relatedAssetIds: [], relatedAuditIds: []
            });
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Documents.handleCreate');
            addToast("Erreur lors de la création", "error");
        }
    };

    const handleUpdate: SubmitHandler<DocumentFormData> = async (data) => {
        if (!canEditResource(user, 'Document', selectedDocument?.ownerId || selectedDocument?.owner) || !selectedDocument) return;
        try {
            await updateDoc(doc(db, 'documents', selectedDocument.id), {
                ...data,
                updatedAt: new Date().toISOString()
            });

            await logAction(user, 'UPDATE', 'Document', `MAJ document: ${data.title}`);

            await logAction(user, 'UPDATE', 'Document', `MAJ document: ${data.title}`);
            setSelectedDocument({ ...selectedDocument, ...data, updatedAt: new Date().toISOString() });
            setIsEditing(false);
            addToast("Document mis à jour", "success");
        } catch (error) {
            ErrorLogger.error(error, 'Documents.handleUpdate');
            addToast("Erreur lors de la modification", "error");
        }
    };

    const initiateDelete = async (id: string, title: string) => {
        // Check permissions
        if (!canEditResource(user, 'Document', selectedDocument?.ownerId || selectedDocument?.owner)) return;

        // Check for dependencies (Data Integrity)
        try {
            // Check Controls (evidence)
            const linkedControls = controls.filter(c => c.evidenceIds?.includes(id));

            // Check Suppliers (contracts)
            const suppliersQ = query(collection(db, 'suppliers'), where('organizationId', '==', user?.organizationId), where('contractDocumentId', '==', id));

            // Check Business Processes (DRP)
            const bcpQ = query(collection(db, 'business_processes'), where('organizationId', '==', user?.organizationId), where('drpDocumentId', '==', id));

            // Check Findings (evidence)
            const findingsQ = query(collection(db, 'findings'), where('organizationId', '==', user?.organizationId), where('evidenceIds', 'array-contains', id));

            const [suppliersSnap, bcpSnap, findingsSnap] = await Promise.all([
                getDocs(suppliersQ),
                getDocs(bcpQ),
                getDocs(findingsQ)
            ]);

            if (linkedControls.length > 0 || !suppliersSnap.empty || !bcpSnap.empty || !findingsSnap.empty) {
                const controlNames = linkedControls.map(c => c.code).join(', ');
                const supplierNames = suppliersSnap.docs.map(d => d.data().name).join(', ');
                const bcpNames = bcpSnap.docs.map(d => d.data().name).join(', ');

                let msg = "Impossible de supprimer ce document car il est utilisé :";
                if (linkedControls.length > 0) msg += `\n- Preuve pour ${linkedControls.length} contrôle(s) (${controlNames})`;
                if (!suppliersSnap.empty) msg += `\n- Contrat pour ${suppliersSnap.size} fournisseur(s) (${supplierNames})`;
                if (!bcpSnap.empty) msg += `\n- DRP pour ${bcpSnap.size} processus (${bcpNames})`;
                if (!findingsSnap.empty) msg += `\n- Preuve pour ${findingsSnap.size} constat(s) d'audit`;

                addToast(msg, "error");
                return;
            }

            setConfirmData({
                isOpen: true,
                title: "Supprimer le document ?",
                message: "Cette action est définitive.",
                onConfirm: () => handleDelete(id, title)
            });
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'Documents.initiateDelete');
            addToast("Erreur lors de la vérification des dépendances", "error");
        }
    };

    const handleDelete = async (id: string, title: string) => {
        try {
            await deleteDoc(doc(db, 'documents', id));
            setSelectedDocument(null);
            await logAction(user, 'DELETE', 'Document', `Suppression: ${title}`);
            addToast("Document supprimé", "info");
        } catch (error) {
            ErrorLogger.error(error, 'Documents.handleDelete');
            addToast("Erreur lors de la suppression", "error");
        }
    };

    const sendReviewReminder = async () => {
        if (!selectedDocument || !user) return;
        try {
            const link = `${window.location.origin}/#/documents`;
            const html = getDocumentReviewTemplate(selectedDocument.title, selectedDocument.owner, selectedDocument.nextReviewDate || new Date().toISOString(), link);

            await sendEmail(user, {
                to: usersList.find(u => u.displayName === selectedDocument.owner)?.email || selectedDocument.owner,
                subject: `Rappel de révision : ${selectedDocument.title}`,
                type: 'DOCUMENT_REVIEW',
                html
            });
            addToast("Rappel envoyé au propriétaire", "success");
        } catch (error) {
            ErrorLogger.error(error, 'Documents.sendReminder');
            addToast("Erreur envoi rappel", "error");
        }
    };

    const handleExportCSV = () => {
        const headers = ["Titre", "Type", "Version", "Statut", "Propriétaire", "Prochaine Révision", "Fichier Joint"];
        const rows = filteredDocuments.map(d => [
            d.title,
            d.type,
            d.version,
            d.status,
            d.owner,
            d.nextReviewDate ? new Date(d.nextReviewDate).toLocaleDateString() : '',
            d.url ? 'Oui' : 'Non'
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.map(f => `"${f}"`).join(','))].join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
        link.download = `documents_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const filteredDocuments = documents.filter(d => d.title.toLowerCase().includes(filter.toLowerCase()));

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Publié': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-900/50';
            case 'Approuvé': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50';
            case 'En revue': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50';
            case 'Rejeté': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50';
            case 'Obsolète': return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
            default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
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
                title="Gestion Documentaire"
                subtitle="Politiques, procédures et preuves (ISO 27001 A.5.37)."
                breadcrumbs={[
                    { label: 'Documents' }
                ]}
                icon={<FileText className="h-6 w-6 text-white" strokeWidth={2.5} />}
                actions={canCreate && (
                    <button
                        onClick={() => {
                            createForm.reset({
                                title: '', type: 'Politique', version: '1.0', status: 'Brouillon', workflowStatus: 'Draft',
                                owner: user?.displayName || '', ownerId: user?.uid || '', nextReviewDate: '', readBy: [], reviewers: [], approvers: [],
                                relatedControlIds: [], relatedAssetIds: [], relatedAuditIds: []
                            });
                            setShowCreateModal(true);
                        }}
                        className="flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-lg shadow-blue-500/20"
                    >
                        <Plus className="h-4 w-4 mr-2" /> Nouveau Document
                    </button>
                )}
            />

            <div className="glass-panel p-1.5 pl-4 rounded-2xl flex items-center space-x-4 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all border border-slate-200 dark:border-white/5">
                <Search className="h-5 w-5 text-gray-400" />
                <input type="text" placeholder="Rechercher un document..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white py-2.5 font-medium placeholder-gray-400"
                    value={filter} onChange={e => setFilter(e.target.value)} />
                <button onClick={handleExportCSV} className="p-2.5 bg-gray-50 dark:bg-white/5 rounded-xl text-gray-500 hover:text-slate-900 dark:hover:text-white transition-colors" title="Exporter CSV">
                    <FileSpreadsheet className="h-4 w-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full"><CardSkeleton count={3} /></div>
                ) : filteredDocuments.length === 0 ? (
                    <div className="col-span-full">
                        <EmptyState
                            icon={FileText}
                            title="Aucun document"
                            description={filter ? "Aucun document ne correspond à votre recherche." : "Centralisez vos politiques et procédures de sécurité."}
                            actionLabel={filter ? undefined : "Nouveau Document"}
                            onAction={filter ? undefined : () => {
                                createForm.reset({
                                    title: '', type: 'Politique', version: '1.0', status: 'Brouillon', workflowStatus: 'Draft',
                                    owner: user?.displayName || '', ownerId: user?.uid || '', nextReviewDate: '', readBy: [], reviewers: [], approvers: [],
                                    relatedControlIds: [], relatedAssetIds: [], relatedAuditIds: []
                                });
                                setShowCreateModal(true);
                            }}
                        />
                    </div>
                ) : (
                    filteredDocuments.map(docItem => (
                        <div key={docItem.id} onClick={() => openInspector(docItem)} className="glass-panel rounded-[2.5rem] p-7 shadow-sm card-hover cursor-pointer border border-white/50 dark:border-white/5 group flex flex-col">
                            <div className="flex justify-between items-start mb-5">
                                <div className="p-3 bg-blue-50 dark:bg-slate-800 rounded-2xl text-blue-600 shadow-inner">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border shadow-sm ${getStatusColor(docItem.status)}`}>{docItem.status}</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-tight line-clamp-2">{docItem.title}</h3>
                            <div className="flex items-center text-xs font-medium text-slate-500 dark:text-slate-400 mb-6">
                                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md mr-2">v{docItem.version}</span>
                                <span>{docItem.type}</span>
                            </div>
                            <div className="mt-auto pt-4 border-t border-dashed border-gray-200 dark:border-white/10 flex justify-between items-center">
                                <div className="flex items-center text-xs text-slate-400 font-medium" title="Propriétaire">
                                    <Users className="h-3.5 w-3.5 mr-1.5" /> {docItem.owner}
                                </div>
                                {docItem.url && <ExternalLink className="h-4 w-4 text-slate-300 hover:text-blue-500 transition-colors" />}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Inspector */}
            {selectedDocument && createPortal(
                <div className="fixed inset-0 z-[9999] overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={() => setSelectedDocument(null)} />
                    <div className="absolute inset-y-0 right-0 sm:pl-10 max-w-full flex pointer-events-none">
                        <div className="w-screen max-w-6xl pointer-events-auto">
                            <div className="h-full flex flex-col bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border-l border-white/20 dark:border-white/5 animate-slide-up">
                                <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-start justify-between bg-white/50 dark:bg-white/5">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight tracking-tight">{selectedDocument.title}</h2>
                                        <p className="text-sm font-medium text-slate-500 mt-1">v{selectedDocument.version} • {selectedDocument.type}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {selectedDocument.url && (
                                            <a href={selectedDocument.url} target="_blank" rel="noreferrer" className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm" title="Ouvrir">
                                                <Eye className="h-5 w-5" />
                                            </a>
                                        )}
                                        {canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner) && !isEditing && (
                                            <button onClick={() => setIsEditing(true)} className="p-2.5 text-slate-500 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Edit className="h-5 w-5" /></button>
                                        )}
                                        {canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner) && isEditing && (
                                            <button onClick={editForm.handleSubmit(handleUpdate)} className="p-2.5 text-blue-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors shadow-sm"><Save className="h-5 w-5" /></button>
                                        )}
                                        {canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner) && (
                                            <button onClick={() => initiateDelete(selectedDocument.id, selectedDocument.title)} className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shadow-sm"><Trash2 className="h-5 w-5" /></button>
                                        )}
                                        <button onClick={() => setSelectedDocument(null)} className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-colors"><X className="h-5 w-5" /></button>
                                    </div>
                                </div>

                                <div className="px-8 border-b border-gray-100 dark:border-white/5 flex gap-8 bg-white/30 dark:bg-white/5 overflow-x-auto no-scrollbar">
                                    {[
                                        { id: 'details', label: 'Détails', icon: File },
                                        { id: 'history', label: 'Historique', icon: History },
                                        { id: 'comments', label: 'Discussion', icon: MessageSquare },
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setInspectorTab(tab.id as 'details' | 'history' | 'comments')}
                                            className={`py-4 text-sm font-semibold flex items-center border-b-2 transition-all whitespace-nowrap ${inspectorTab === tab.id ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                        >
                                            <tab.icon className={`h-4 w-4 mr-2.5 ${inspectorTab === tab.id ? 'text-blue-500' : 'opacity-70'}`} />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 dark:bg-transparent custom-scrollbar">
                                    {inspectorTab === 'details' && (
                                        <div className="space-y-8">
                                            {isEditing ? (
                                                <div className="space-y-6">
                                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Titre</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium" {...editForm.register('title')} /></div>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Version</label><input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium" {...editForm.register('version')} /></div>
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Type</label>
                                                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none" {...editForm.register('type')}>
                                                                {['Politique', 'Procédure', 'Preuve', 'Rapport', 'Autre'].map(t => <option key={t} value={t}>{t}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Statut</label>
                                                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none" {...editForm.register('status')}>
                                                                {['Brouillon', 'En revue', 'Approuvé', 'Rejeté', 'Publié', 'Obsolète'].map(s => <option key={s} value={s}>{s}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Propriétaire</label>
                                                            <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none" {...editForm.register('ownerId')}>
                                                                {usersList.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Prochaine révision</label><input type="date" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium" {...editForm.register('nextReviewDate')} /></div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div className="p-5 bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">Propriétaire</span>
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedDocument.owner}</span>
                                                        </div>
                                                        <div className="p-5 bg-white dark:bg-slate-800/50 border border-gray-100 dark:border-white/5 rounded-3xl shadow-sm">
                                                            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1 tracking-wide">Dernière MAJ</span>
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{new Date(selectedDocument.updatedAt).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>

                                                    {/* Workflow Actions */}
                                                    <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Workflow de Validation</h4>

                                                        {/* Status Steps */}
                                                        <div className="flex items-center justify-between mb-6 relative">
                                                            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-200 dark:bg-gray-700 -z-10" />
                                                            {['Brouillon', 'En revue', 'Approuvé', 'Publié'].map((step, idx) => {
                                                                const isCompleted = ['Brouillon', 'En revue', 'Approuvé', 'Publié'].indexOf(selectedDocument.status) >= idx;
                                                                const isCurrent = selectedDocument.status === step;
                                                                return (
                                                                    <div key={step} className="flex flex-col items-center bg-white dark:bg-slate-900 px-2">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isCompleted ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-gray-600 text-gray-300'}`}>
                                                                            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                                                                        </div>
                                                                        <span className={`text-[10px] font-bold mt-2 uppercase tracking-wide ${isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>{step}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className="flex flex-wrap gap-3">
                                                            {selectedDocument.status === 'Brouillon' && canEditResource(user, 'Document', selectedDocument.ownerId || selectedDocument.owner) && (
                                                                <button onClick={() => handleWorkflowAction('submit')} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
                                                                    Soumettre pour revue
                                                                </button>
                                                            )}
                                                            {selectedDocument.status === 'En revue' && (
                                                                <>
                                                                    <button onClick={() => handleWorkflowAction('approve')} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center">
                                                                        <CheckCircle2 className="h-4 w-4 mr-2" /> Approuver
                                                                    </button>
                                                                    <button onClick={() => handleWorkflowAction('reject')} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center">
                                                                        <X className="h-4 w-4 mr-2" /> Rejeter
                                                                    </button>
                                                                </>
                                                            )}
                                                            {selectedDocument.status === 'Approuvé' && (
                                                                <button onClick={() => handleWorkflowAction('sign')} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors shadow-lg shadow-purple-500/20 flex items-center justify-center">
                                                                    <ShieldCheck className="h-4 w-4 mr-2" /> Signer & Publier
                                                                </button>
                                                            )}
                                                        </div>

                                                        {selectedDocument.signatures && selectedDocument.signatures.length > 0 && (
                                                            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-white/10">
                                                                <h5 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">Signatures</h5>
                                                                <div className="space-y-2">
                                                                    {selectedDocument.signatures.map((sig, i) => (
                                                                        <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-white/5">
                                                                            <div className="flex items-center">
                                                                                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center mr-3">
                                                                                    <ShieldCheck className="h-4 w-4" />
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">Signé par {usersList.find(u => u.uid === sig.userId)?.displayName || 'Utilisateur inconnu'}</p>
                                                                                    <p className="text-[10px] text-slate-500">{new Date(sig.date).toLocaleString()}</p>
                                                                                </div>
                                                                            </div>
                                                                            <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded text-slate-500">{sig.role}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between items-center mb-4">
                                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Révision</h4>
                                                            {selectedDocument.nextReviewDate && (
                                                                <span className={`text-xs font-bold ${new Date(selectedDocument.nextReviewDate) < new Date() ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                    {new Date(selectedDocument.nextReviewDate).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button onClick={sendReviewReminder} className="w-full py-3 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center border border-slate-200 dark:border-white/5">
                                                            <Bell className="h-3.5 w-3.5 mr-2" /> Envoyer rappel de révision
                                                        </button>
                                                        <button onClick={() => selectedDocument.nextReviewDate && generateICS([{
                                                            title: `Révision : ${selectedDocument.title}`,
                                                            description: `Révision du document ${selectedDocument.title} (v${selectedDocument.version})`,
                                                            startDate: new Date(selectedDocument.nextReviewDate)
                                                        }])} className="w-full mt-2 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center border border-slate-200 dark:border-white/5">
                                                            <CalendarDays className="h-3.5 w-3.5 mr-2" /> Ajouter au calendrier
                                                        </button>
                                                    </div>

                                                    <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-sm flex items-center justify-between">
                                                        <div className="flex items-center text-blue-700 dark:text-blue-300 text-sm font-bold">
                                                            <LinkIcon className="h-4 w-4 mr-3" /> Fichier Joint
                                                        </div>
                                                        {selectedDocument.url ? (
                                                            <a href={selectedDocument.url} target="_blank" rel="noreferrer" className="text-xs font-bold bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm hover:text-blue-600 transition-colors">
                                                                Télécharger
                                                            </a>
                                                        ) : <span className="text-xs text-gray-400 italic">Aucun fichier</span>}
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-6">
                                                        <div className="bg-white dark:bg-slate-800/50 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Contrôles Liés</h4>
                                                            <div className="space-y-1">
                                                                {selectedDocument.relatedControlIds?.map(cid => {
                                                                    const c = controls.find(x => x.id === cid);
                                                                    return c ? <div key={cid} className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded">{c.code}</div> : null;
                                                                })}
                                                                {(!selectedDocument.relatedControlIds || selectedDocument.relatedControlIds.length === 0) && <span className="text-xs text-gray-400 italic">Aucun</span>}
                                                            </div>
                                                        </div>
                                                        <div className="bg-white dark:bg-slate-800/50 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Actifs Liés</h4>
                                                            <div className="space-y-1">
                                                                {selectedDocument.relatedAssetIds?.map(aid => {
                                                                    const a = assets.find(x => x.id === aid);
                                                                    return a ? <div key={aid} className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded">{a.name}</div> : null;
                                                                })}
                                                                {(!selectedDocument.relatedAssetIds || selectedDocument.relatedAssetIds.length === 0) && <span className="text-xs text-gray-400 italic">Aucun</span>}
                                                            </div>
                                                        </div>
                                                        <div className="bg-white dark:bg-slate-800/50 p-4 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
                                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Audits Liés</h4>
                                                            <div className="space-y-1">
                                                                {selectedDocument.relatedAuditIds?.map(aid => {
                                                                    const a = audits.find(x => x.id === aid);
                                                                    return a ? <div key={aid} className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded">{a.name}</div> : null;
                                                                })}
                                                                {(!selectedDocument.relatedAuditIds || selectedDocument.relatedAuditIds.length === 0) && <span className="text-xs text-gray-400 italic">Aucun</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {inspectorTab === 'history' && (
                                        <div className="relative border-l-2 border-gray-100 dark:border-white/5 ml-3 space-y-8 pl-8 py-2">
                                            {docHistory.length === 0 ? <p className="text-sm text-gray-500 pl-6">Aucun historique.</p> :
                                                docHistory.map((log, i) => (
                                                    <div key={i} className="relative">
                                                        <span className="absolute -left-[41px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-blue-100 dark:border-blue-900">
                                                            <div className="h-2 w-2 rounded-full bg-blue-600"></div>
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
                                            <Comments collectionName="documents" documentId={selectedDocument.id} />
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
            {showCreateModal && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-850 rounded-[2.5rem] shadow-2xl w-full max-w-4xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-gray-100 dark:border-white/5 bg-blue-50/30 dark:bg-blue-900/10">
                            <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100 tracking-tight">Nouveau Document</h2>
                        </div>
                        <form onSubmit={createForm.handleSubmit(handleCreate)} className="p-8 space-y-5 overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Titre</label>
                                <input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                    {...createForm.register('title')} placeholder="Ex: PSSI" />
                                {createForm.formState.errors.title && <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.title.message}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Type</label>
                                    <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none"
                                        {...createForm.register('type')}>
                                        {['Politique', 'Procédure', 'Preuve', 'Rapport', 'Autre'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Version</label>
                                    <input className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                        {...createForm.register('version')} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Propriétaire</label>
                                <select className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none"
                                    {...createForm.register('ownerId')}>
                                    <option value="">Sélectionner...</option>
                                    {usersList.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Reviewers</label>
                                    <select multiple className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium custom-scrollbar h-24"
                                        {...createForm.register('reviewers')}>
                                        {usersList.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Approbateurs</label>
                                    <select multiple className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium custom-scrollbar h-24"
                                        {...createForm.register('approvers')}>
                                        {usersList.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Prochaine révision</label>
                                <input type="date" className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                    {...createForm.register('nextReviewDate')} />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Contrôles</label>
                                    <select multiple className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium custom-scrollbar h-24"
                                        {...createForm.register('relatedControlIds')}>
                                        {controls.map(c => <option key={c.id} value={c.id}>{c.code} {c.name.substring(0, 20)}...</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Actifs</label>
                                    <select multiple className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium custom-scrollbar h-24"
                                        {...createForm.register('relatedAssetIds')}>
                                        {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Audits</label>
                                    <select multiple className="w-full px-4 py-3.5 rounded-2xl border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-medium custom-scrollbar h-24"
                                        {...createForm.register('relatedAuditIds')}>
                                        {audits.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Fichier</label>
                                <FileUploader
                                    onUploadComplete={handleFileUploadComplete}
                                    category="documents"
                                    maxSizeMB={10}
                                    allowedTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*']}
                                />
                                <div className="mt-2 flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <span className="text-sm text-green-600 dark:text-green-400">✓ Fichier téléversé</span>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewFile({ url: uploadedFileUrl, name: createForm.getValues('title') || 'Document', type: 'application/pdf' })}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        Prévisualiser
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-gray-100 dark:border-white/5">
                                <button type="button" onClick={() => { setShowCreateModal(false); setUploadedFileUrl(''); }} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">Annuler</button>
                                <button type="submit" className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:scale-105 transition-transform font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center">
                                    Créer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* File Preview Modal */}
            {previewFile && (
                <FilePreview
                    url={previewFile.url}
                    fileName={previewFile.name}
                    fileType={previewFile.type}
                    onClose={() => setPreviewFile(null)}
                    onDownload={() => {
                        const link = document.createElement('a');
                        link.href = previewFile.url;
                        link.download = previewFile.name;
                        link.click();
                    }}
                />
            )}
        </div>
    );
};
