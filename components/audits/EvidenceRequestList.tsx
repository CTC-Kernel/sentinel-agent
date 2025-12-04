import React, { useState } from 'react';
import { useFirestoreCollection } from '../../hooks/useFirestore';
import { EvidenceRequest, UserProfile, Document, Control } from '../../types';
import { where, addDoc, collection, updateDoc, doc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Plus, FileText, Clock, Trash2, X, ChevronDown, ChevronUp, User, ShieldCheck } from '../ui/Icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CustomSelect } from '../ui/CustomSelect';
import { FloatingLabelInput } from '../ui/FloatingLabelInput';
import { FloatingLabelTextarea } from '../ui/FloatingLabelTextarea';
import { FileUploader } from '../ui/FileUploader';
import { EmptyState } from '../ui/EmptyState';
import { ErrorLogger } from '../../services/errorLogger';

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

    const { data: requests, refresh } = useFirestoreCollection<EvidenceRequest>(
        'evidence_requests',
        [where('auditId', '==', auditId)],
        { logError: true, realtime: true }
    );

    const { data: documents } = useFirestoreCollection<Document>(
        'documents',
        [where('organizationId', '==', user?.organizationId)],
        { logError: true, realtime: true }
    );

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        assignedTo: '',
        dueDate: '',
        relatedControlId: ''
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            await addDoc(collection(db, 'evidence_requests'), {
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
            });
            addToast("Demande de preuve créée", "success");
            setIsCreating(false);
            setFormData({ title: '', description: '', assignedTo: '', dueDate: '', relatedControlId: '' });
            refresh();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleCreate', 'CREATE_FAILED');
        }
    };

    const handleStatusChange = async (req: EvidenceRequest, status: EvidenceRequest['status']) => {
        try {
            await updateDoc(doc(db, 'evidence_requests', req.id), {
                status,
                updatedAt: new Date().toISOString()
            });
            refresh();
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleStatusChange', 'UPDATE_FAILED');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Supprimer cette demande ?")) return;
        try {
            await deleteDoc(doc(db, 'evidence_requests', id));
            refresh();
            addToast("Demande supprimée", "info");
        } catch (error) {
            ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleDelete', 'DELETE_FAILED');
        }
    };

    const handleFileUpload = async (req: EvidenceRequest, url: string, fileName: string) => {
        if (!user) return;
        try {
            // Create Document
            const docRef = await addDoc(collection(db, 'documents'), {
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
            });

            // Link to Request
            const currentDocs = req.documentIds || [];
            await updateDoc(doc(db, 'evidence_requests', req.id), {
                documentIds: [...currentDocs, docRef.id],
                status: 'Provided', // Auto-update status
                updatedAt: new Date().toISOString()
            });

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
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30';
            case 'Provided': return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30';
            case 'Accepted': return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/30';
            case 'Rejected': return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30';
            default: return 'bg-gray-50 text-slate-700 border-gray-100 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Demandes de Preuves</h3>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            try {
                                const JSZip = (await import('jszip')).default;
                                const zip = new JSZip();
                                const folder = zip.folder(`Preuves_Audit_${auditId}`);

                                // Generate CSV report of requests
                                const csvHeaders = ['Titre', 'Description', 'Statut', 'Assigné à', 'Echéance', 'Contrôle lié', 'Documents'];
                                const csvRows = requests.map(req => {
                                    const assignedUser = users.find(u => u.uid === req.assignedTo)?.displayName || '';
                                    const control = controls.find(c => c.id === req.relatedControlId)?.code || '';
                                    const docs = req.documentIds?.map(id => documents.find(d => d.id === id)?.title).join('; ') || '';
                                    return [
                                        `"${req.title}"`,
                                        `"${req.description}"`,
                                        req.status,
                                        `"${assignedUser}"`,
                                        req.dueDate || '',
                                        control,
                                        `"${docs}"`
                                    ].join(',');
                                });
                                const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
                                folder?.file('rapport_demandes.csv', csvContent);

                                // Add documents (as text files with URLs if fetch fails, or try to fetch)
                                // Note: Fetching from Firebase Storage might fail due to CORS if not configured.
                                // We will create a text file with links for now to ensure reliability.
                                const linksContent = requests.map(req => {
                                    if (!req.documentIds?.length) return null;
                                    return `Demande: ${req.title}\n` +
                                        req.documentIds.map(id => {
                                            const doc = documents.find(d => d.id === id);
                                            return doc ? `- ${doc.title}: ${doc.url}` : null;
                                        }).filter(Boolean).join('\n') + '\n\n';
                                }).filter(Boolean).join('-------------------\n');

                                if (linksContent) {
                                    folder?.file('liens_documents.txt', linksContent);
                                }

                                const content = await zip.generateAsync({ type: 'blob' });
                                const url = window.URL.createObjectURL(content);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `Preuves_Audit_${auditId}_${format(new Date(), 'yyyyMMdd')}.zip`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);

                                addToast("Export ZIP téléchargé", "success");
                            } catch (error) {
                                ErrorLogger.handleErrorWithToast(error, 'EvidenceRequestList.handleExport', 'UNKNOWN_ERROR');
                                addToast("Erreur lors de l'export", "error");
                            }
                        }}
                        className="flex items-center px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Exporter (ZIP)
                    </button>
                    {canEdit && (
                        <button
                            onClick={() => setIsCreating(!isCreating)}
                            className="flex items-center px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold hover:scale-105 transition-transform"
                        >
                            {isCreating ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            {isCreating ? 'Annuler' : 'Nouvelle Demande'}
                        </button>
                    )}
                </div>
            </div>

            {isCreating && (
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
                        <button type="submit" className="px-6 py-2 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors">
                            Créer la demande
                        </button>
                    </div>
                </form>
            )}

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
                    <div key={req.id} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5"
                            onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${req.status === 'Accepted' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white">{req.title}</h4>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                        <span className={`px-2 py-0.5 rounded border ${getStatusColor(req.status)}`}>{req.status}</span>
                                        {req.dueDate && (
                                            <span className="flex items-center text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {format(new Date(req.dueDate), 'dd MMM yyyy', { locale: fr })}
                                            </span>
                                        )}
                                        {req.assignedTo && (
                                            <span className="flex items-center">
                                                <User className="w-3 h-3 mr-1" />
                                                {users.find(u => u.uid === req.assignedTo)?.displayName || 'Utilisateur inconnu'}
                                            </span>
                                        )}
                                        {req.relatedControlId && (
                                            <span className="flex items-center text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded">
                                                <ShieldCheck className="w-3 h-3 mr-1" />
                                                {controls.find(c => c.id === req.relatedControlId)?.code || 'Contrôle'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {expandedId === req.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                            </div>
                        </div>

                        {expandedId === req.id && (
                            <div className="p-6 border-t border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                                <div className="mb-6">
                                    <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Description</h5>
                                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                        {req.description}
                                    </p>
                                </div>

                                {/* Documents List */}
                                <div className="space-y-3 mb-6">
                                    <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Preuves fournies</h5>
                                    {req.documentIds && req.documentIds.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {req.documentIds.map(docId => {
                                                const docObj = documents.find(d => d.id === docId);
                                                if (!docObj) return null;
                                                return (
                                                    <div key={docId} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-white/10 text-sm hover:border-brand-300 transition-colors group">
                                                        <div className="flex items-center overflow-hidden">
                                                            <FileText className="w-4 h-4 text-brand-500 mr-2 flex-shrink-0" />
                                                            <span className="truncate font-medium text-slate-700 dark:text-slate-200">{docObj.title}</span>
                                                        </div>
                                                        <a href={docObj.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700 text-xs font-bold px-3 py-1 bg-brand-50 dark:bg-brand-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                                            Voir
                                                        </a>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                                            <p className="text-xs text-slate-400 italic">Aucun document fourni pour le moment.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col md:flex-row gap-6 pt-6 border-t border-gray-200 dark:border-white/10">
                                    <div className="flex-1">
                                        <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Ajouter une preuve</h5>
                                        <FileUploader
                                            onUploadComplete={(url, name) => handleFileUpload(req, url, name)}
                                            category="evidence"
                                        />
                                    </div>

                                    {canEdit && (
                                        <div className="flex flex-col gap-2 min-w-[150px]">
                                            <h5 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Actions</h5>
                                            {req.status !== 'Accepted' && (
                                                <button onClick={() => handleStatusChange(req, 'Accepted')} className="w-full px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors flex items-center justify-center">
                                                    <ShieldCheck className="w-4 h-4 mr-2" />
                                                    Accepter
                                                </button>
                                            )}
                                            {req.status !== 'Rejected' && (
                                                <button onClick={() => handleStatusChange(req, 'Rejected')} className="w-full px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors flex items-center justify-center">
                                                    <X className="w-4 h-4 mr-2" />
                                                    Rejeter
                                                </button>
                                            )}
                                            <button onClick={() => handleDelete(req.id)} className="w-full px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-colors flex items-center justify-center mt-auto">
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Supprimer
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
