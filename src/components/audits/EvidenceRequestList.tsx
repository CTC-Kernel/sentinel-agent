import React, { useState, useCallback } from 'react';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { EvidenceRequest, UserProfile, Document, Control } from '../../types';
import { where, addDoc, collection, updateDoc, doc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Plus, FileText, X } from '../ui/Icons';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { EmptyState } from '../ui/EmptyState';
import { ErrorLogger } from '../../services/errorLogger';
import { sanitizeData } from '../../utils/dataSanitizer';
import { EvidenceRequestItem } from './EvidenceRequestItem';
import { exportEvidenceRequestsZip } from '../../utils/EvidenceExportUtils';

interface EvidenceRequestListProps {
    auditId: string;
    organizationId: string;
    users: UserProfile[];
    controls: Control[];
    canEdit: boolean;
}

export const EvidenceRequestList: React.FC<EvidenceRequestListProps> = ({ auditId, organizationId, users, controls, canEdit }) => {
    const { user, addToast } = useStore();
    const [isCreating, setIsCreating] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data: requests, refresh, loading } = useFirestoreCollection<EvidenceRequest>(
        'evidence_requests',
        [where('organizationId', '==', organizationId), where('auditId', '==', auditId)],
        { logError: true, realtime: true }
    );

    const { data: documents } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', organizationId)],
        { logError: true, realtime: true }
    );

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        assignedTo: '',
        dueDate: '',
        relatedControlId: ''
    });

    const handleCreate = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            await addDoc(collection(db, 'evidence_requests'), sanitizeData({
                auditId,
                organizationId,
                title: formData.title,
                description: formData.description,
                status: 'Pending',
                requestedBy: user.uid,
                assignedTo: formData.assignedTo || null,
                dueDate: formData.dueDate || null,
                relatedControlId: formData.relatedControlId || null,
                documentIds: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }));
            addToast("Demande de preuve créée", "success");
            setIsCreating(false);
            setFormData({ title: '', description: '', assignedTo: '', dueDate: '', relatedControlId: '' });
            refresh();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleCreate', 'CREATE_FAILED');
        }
    }, [user, auditId, organizationId, formData, addToast, refresh]);

    const handleStatusChange = useCallback(async (req: EvidenceRequest, status: EvidenceRequest['status']) => {
        try {
            await updateDoc(doc(db, 'evidence_requests', req.id), sanitizeData({
                status,
                updatedAt: new Date().toISOString()
            }));
            refresh();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleStatusChange', 'UPDATE_FAILED');
        }
    }, [refresh]);

    const handleDelete = useCallback(async (id: string) => {
        if (!window.confirm("Supprimer cette demande ?")) return;
        try {
            await deleteDoc(doc(db, 'evidence_requests', id));
            refresh();
            addToast("Demande supprimée", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleDelete', 'DELETE_FAILED');
        }
    }, [refresh, addToast]);

    const handleFileUpload = useCallback(async (req: EvidenceRequest, url: string, fileName: string) => {
        if (!user) return;
        try {
            // Create Document
            const docRef = await addDoc(collection(db, 'documents'), sanitizeData({
                title: `Preuve - ${fileName}`,
                type: 'Preuve',
                version: '1.0',
                status: 'Publié',
                url: url,
                organizationId,
                owner: user.displayName || user.email,
                ownerId: user.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                relatedAuditIds: [auditId],
                relatedControlIds: req.relatedControlId ? [req.relatedControlId] : []
            }));

            // Link to Request
            const currentDocs = req.documentIds || [];

            await updateDoc(doc(db, 'evidence_requests', req.id), sanitizeData({
                documentIds: [...currentDocs, docRef.id],
                status: 'Provided', // Auto-update status
                updatedAt: new Date().toISOString()
            }));

            // Link to Control (if applicable)
            if (req.relatedControlId) {
                await updateDoc(doc(db, 'controls', req.relatedControlId), {
                    evidenceIds: arrayUnion(docRef.id)
                });
            }

            refresh();
            addToast("Preuve ajoutée et liée", "success");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleFileUpload', 'FILE_UPLOAD_FAILED');
        }
    }, [user, organizationId, auditId, refresh, addToast]);

    const handleExport = useCallback(() => {
        exportEvidenceRequestsZip({
            auditId,
            requests,
            users,
            controls,
            documents,
            onSuccess: (msg) => addToast(msg, 'success'),
            onError: (err) => {
                ErrorLogger.handleErrorWithToast(err, 'EvidenceRequestList.handleExport', 'UNKNOWN_ERROR');
                addToast("Erreur lors de l'export", 'error');
            }
        });
    }, [auditId, requests, users, controls, documents, addToast]);

    const handleExpand = useCallback((id: string | null) => {
        setExpandedId(id);
    }, []);

    const toggleCreation = useCallback(() => {
        setIsCreating(prev => !prev);
    }, []);

    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={`skeleton-${i}`} className="h-24 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Demandes de Preuves</h3>
                <div className="flex flex-wrap gap-2 max-w-full">
                    <button
                        onClick={handleExport}
                        className="flex items-center px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        aria-label="Exporter les preuves (ZIP)"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Exporter (ZIP)
                    </button>
                    {canEdit && (
                        <button
                            onClick={toggleCreation}
                            className="flex items-center px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:scale-105 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                            aria-label={isCreating ? "Annuler la création" : "Nouvelle demande de preuve"}
                        >
                            {isCreating ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            {isCreating ? 'Annuler' : 'Nouvelle Demande'}
                        </button>
                    )}
                </div>
            </div>

            {
                isCreating && (
                    <form onSubmit={handleCreate} className="bg-slate-50 dark:bg-white/5 p-6 rounded-2xl border border-slate-100 dark:border-white/10 space-y-4 animate-fade-in">
                        <FloatingLabelInput
                            label="Titre de la demande"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                        <FloatingLabelTextarea
                            label="Description détaillée"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            required
                            rows={3}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <CustomSelect
                                label="Assigné à"
                                value={formData.assignedTo}
                                onChange={val => setFormData({ ...formData, assignedTo: val as string })}
                                options={users.map(u => ({ value: u.uid, label: u.displayName || u.email }))}
                                placeholder="Sélectionner un responsable..."
                            />
                            <FloatingLabelInput
                                label="Date d'échéance"
                                type="date"
                                value={formData.dueDate}
                                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                            />
                        </div>
                        <CustomSelect
                            label="Lier à un contrôle (Optionnel)"
                            value={formData.relatedControlId}
                            onChange={val => setFormData({ ...formData, relatedControlId: val as string })}
                            options={controls.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                            placeholder="Sélectionner un contrôle..."
                        />
                        <div className="flex justify-end pt-2">
                            <button type="submit" aria-label="Soumettre la demande" className="px-6 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                                Créer la demande
                            </button>
                        </div>
                    </form>
                )
            }

            <div className="space-y-4">
                {requests.length === 0 && !isCreating && (
                    <EmptyState
                        icon={FileText}
                        title="Aucune demande de preuve"
                        description="Créez des demandes de preuves pour collecter les documents nécessaires à l'audit."
                        actionLabel={canEdit ? "Créer une demande" : undefined}
                        onAction={canEdit ? () => setIsCreating(true) : undefined}
                    />
                )}
                {requests.map(req => (
                    <EvidenceRequestItem
                        key={req.id}
                        req={req}
                        user={user}
                        users={users}
                        documents={documents}
                        isExpanded={expandedId === req.id}
                        canEdit={canEdit}
                        onExpand={handleExpand}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                        onUpload={handleFileUpload}
                    />
                ))}
            </div>
        </div>
    );
};
